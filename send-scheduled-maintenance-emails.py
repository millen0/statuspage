#!/usr/bin/python3
import psycopg2
import requests
import os
import time
from datetime import datetime
from dotenv import load_dotenv
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import ssl

load_dotenv('/opt/statuspage/backend/.env')
load_dotenv('backend/.env')

DB_CONFIG = {
    'host': os.getenv('DB_HOST', '127.0.0.1'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres'),
    'database': os.getenv('DB_NAME', 'statuspage')
}

SMTP_HOST = os.getenv('SMTP_HOST')
SMTP_PORT = int(os.getenv('SMTP_PORT', 587))
SMTP_USER = os.getenv('SMTP_USERNAME')
SMTP_PASS = os.getenv('SMTP_PASSWORD')
FROM_EMAIL = os.getenv('SES_FROM_EMAIL')

def send_maintenance_email(maintenance, subscribers):
    if not all([SMTP_HOST, SMTP_USER, SMTP_PASS, FROM_EMAIL]):
        print("❌ SMTP not configured")
        return False
    
    subject = f"Scheduled Maintenance: {maintenance['title']}"
    
    sent_count = 0
    for sub in subscribers:
        email = sub['email']
        token = sub['token']
        
        unsubscribe_url = f"https://statuspage.piercloud.io/api/public/unsubscribe?token={token}"
        
        html_body = f"""<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">Scheduled Maintenance Notification</h2>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">{maintenance['title']}</h3>
            <p>{maintenance['description']}</p>
            <p><strong>Start (São Paulo):</strong> {maintenance['start_sp']}</p>
            <p><strong>End (São Paulo):</strong> {maintenance['end_sp']}</p>
        </div>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
            You are receiving this email because you subscribed to maintenance notifications.<br>
            <a href="{unsubscribe_url}" style="color: #999; text-decoration: none;">Unsubscribe from notifications</a>
        </p>
    </div>
</body>
</html>"""
        
        try:
            context = ssl.create_default_context()
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls(context=context)
                server.login(SMTP_USER, SMTP_PASS)
                
                msg = MIMEMultipart('alternative')
                msg['Subject'] = subject
                msg['From'] = FROM_EMAIL
                msg['To'] = email
                
                msg.attach(MIMEText(html_body, 'html'))
                server.send_message(msg)
                sent_count += 1
                print(f"✅ Sent to {email}")
        except Exception as e:
            print(f"❌ Failed to send to {email}: {e}")
    
    return sent_count > 0

def process_scheduled_emails():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Buscar maintenances com email agendado para enviar
    cur.execute("""
        SELECT id, title, description, scheduled_start, scheduled_end, email_scheduled_time
        FROM maintenances
        WHERE send_email = true 
          AND email_sent = false
          AND email_scheduled_time IS NOT NULL
          AND email_scheduled_time <= NOW()
    """)
    
    maintenances = cur.fetchall()
    
    if not maintenances:
        print("✅ No scheduled emails to send")
        cur.close()
        conn.close()
        return
    
    print(f"📧 Found {len(maintenances)} maintenance(s) with scheduled emails")
    
    # Buscar subscribers ativos
    cur.execute("SELECT email, unsubscribe_token FROM subscribers WHERE is_active = true")
    subscribers = [{'email': row[0], 'token': row[1]} for row in cur.fetchall()]
    
    if not subscribers:
        print("⚠️  No active subscribers")
        cur.close()
        conn.close()
        return
    
    for maint in maintenances:
        maint_id, title, desc, start, end, scheduled_time = maint
        
        # Converter para São Paulo (UTC-3)
        from datetime import timedelta
        start_sp = (start - timedelta(hours=3)).strftime('%d/%m/%Y %H:%M')
        end_sp = (end - timedelta(hours=3)).strftime('%d/%m/%Y %H:%M')
        
        maintenance_data = {
            'title': title,
            'description': desc,
            'start_sp': start_sp,
            'end_sp': end_sp
        }
        
        print(f"\n📨 Sending emails for: {title}")
        
        if send_maintenance_email(maintenance_data, subscribers):
            # Marcar como enviado
            cur.execute("UPDATE maintenances SET email_sent = true WHERE id = %s", (maint_id,))
            conn.commit()
            print(f"✅ Marked as sent: {title}")
        else:
            print(f"❌ Failed to send: {title}")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    print(f"\n{'='*60}")
    print(f"🕐 Scheduled Maintenance Emails - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")
    
    try:
        process_scheduled_emails()
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print(f"\n{'='*60}\n")
