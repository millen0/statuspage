#!/usr/bin/env python3
import psycopg2
import requests
import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from dotenv import load_dotenv

# Carregar configurações
load_dotenv('/Users/milleno/Documents/statuspage/monitor-config.env')
load_dotenv('monitor-config.env')  # Fallback para path relativo
load_dotenv('/opt/statuspage/backend/.env')  # EC2

DB_CONFIG = {
    'host': os.getenv('DB_HOST', '127.0.0.1'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres'),
    'database': os.getenv('DB_NAME', 'statuspage')
}

SLACK_WEBHOOK = os.getenv('SLACK_WEBHOOK', '')

def send_slack_alert(title, status, description, scheduled_start, scheduled_end):
    if not SLACK_WEBHOOK:
        return
    
    color = "#439FE0"
    if status == "completed":
        color = "good"
        title_prefix = "✅ Manutenção Concluída: "
    elif status == "in_progress":
        color = "warning"
        title_prefix = "🚧 Manutenção Iniciada: "
    elif status == "scheduled":
        color = "#439FE0"
        title_prefix = "📅 Manutenção Agendada: "
    else:
        return
    
    payload = {
        "attachments": [{
            "color": color,
            "title": title_prefix + title,
            "fields": [
                {"title": "Status", "value": status, "short": True},
                {"title": "Início", "value": scheduled_start, "short": True},
                {"title": "Fim", "value": scheduled_end, "short": True},
                {"title": "Descrição", "value": description or "N/A", "short": False}
            ]
        }]
    }
    
    try:
        requests.post(SLACK_WEBHOOK, json=payload, timeout=5)
        print(f"   → Slack alert sent: {title_prefix}{title}")
    except Exception as e:
        print(f"   → Failed to send Slack: {e}")

def update_maintenances():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    now = datetime.now(timezone.utc)
    
    # Atualizar para in_progress
    cur.execute("""
        SELECT id, title, description, scheduled_start, scheduled_end 
        FROM maintenances 
        WHERE status = 'scheduled' AND scheduled_start <= %s
    """, (now,))
    
    for row in cur.fetchall():
        maintenance_id, title, description, scheduled_start, scheduled_end = row
        cur.execute("UPDATE maintenances SET status = 'in_progress', actual_start = %s, updated_at = %s WHERE id = %s", (now, now, maintenance_id))
        
        # Format as UTC
        start_utc = scheduled_start.replace(tzinfo=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        end_utc = scheduled_end.replace(tzinfo=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        send_slack_alert(title, "in_progress", description, start_utc, end_utc)
        print(f"✅ Manutenção {maintenance_id} iniciada: {title}")
    
    # Atualizar para completed
    cur.execute("""
        SELECT id, title, description, scheduled_start, scheduled_end 
        FROM maintenances 
        WHERE status = 'in_progress' AND scheduled_end <= %s
    """, (now,))
    
    for row in cur.fetchall():
        maintenance_id, title, description, scheduled_start, scheduled_end = row
        cur.execute("UPDATE maintenances SET status = 'completed', actual_end = %s, updated_at = %s WHERE id = %s", (now, now, maintenance_id))
        
        # Format as UTC
        start_utc = scheduled_start.replace(tzinfo=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        end_utc = scheduled_end.replace(tzinfo=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        send_slack_alert(title, "completed", description, start_utc, end_utc)
        print(f"✅ Manutenção {maintenance_id} concluída: {title}")
    
    conn.commit()
    cur.close()
    conn.close()

if __name__ == "__main__":
    update_maintenances()
