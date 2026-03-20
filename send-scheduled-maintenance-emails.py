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
    
    subject = f"Informe Plataforma Pier Cloud: Manutenção Programada"
    
    # Carregar template
    template_path = 'templates/email_maintenance_template.html'
    if not os.path.exists(template_path):
        template_path = '/opt/statuspage/templates/email_maintenance_template.html'
    
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            template = f.read()
    except Exception as e:
        print(f"❌ Error loading template: {e}")
        return False
    
    # Conteúdo personalizado da manutenção
    maintenance_content = f"""<p style="line-height: inherit; margin: 0px;">
        <strong>Prezados clientes e parceiros,</strong><br><br>
        A Pier Cloud informa que realizará uma <strong>manutenção programada</strong> conforme detalhes abaixo:<br><br>
        <strong>{maintenance['title']}</strong><br><br>
        {maintenance['description']}<br><br>
        <strong>Início:</strong> {maintenance['start_utc']}<br>
        <strong>Término:</strong> {maintenance['end_utc']}
    </p>"""
    
    sent_count = 0
    for sub in subscribers:
        email = sub['email']
        token = sub['token']
        
        # Substituir conteúdo no template
        html_body = template.replace('{{MAINTENANCE_CONTENT}}', maintenance_content)
        html_body = html_body.replace('{{UNSUBSCRIBE_TOKEN}}', token)
        
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
        
        # Format as UTC
        start_utc = start.strftime('%Y-%m-%d %H:%M UTC')
        end_utc = end.strftime('%Y-%m-%d %H:%M UTC')
        
        maintenance_data = {
            'title': title,
            'description': desc,
            'start_utc': start_utc,
            'end_utc': end_utc
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
