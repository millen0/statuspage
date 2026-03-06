#!/usr/bin/python3
import psycopg2
import requests
import os
from datetime import datetime
from dotenv import load_dotenv

# Carregar configurações
load_dotenv('/Users/milleno/Documents/statuspage/monitor-config.env')
load_dotenv('monitor-config.env')  # Fallback para path relativo

DB_CONFIG = {
    'host': os.getenv('DB_HOST', '127.0.0.1'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres'),
    'database': os.getenv('DB_NAME', 'statuspage')
}

SLACK_WEBHOOK = os.getenv('SLACK_WEBHOOK', '')

def send_slack_alert(service_name, old_status, new_status):
    if not SLACK_WEBHOOK:
        print(f"   ⚠️  SLACK_WEBHOOK not configured")
        return
    
    color = "danger" if new_status == "outage" else "warning"
    
    payload = {
        "attachments": [{
            "color": color,
            "title": f"🚨 Service Status Changed: {service_name}",
            "fields": [
                {"title": "Service", "value": service_name, "short": True},
                {"title": "Old Status", "value": old_status, "short": True},
                {"title": "New Status", "value": new_status, "short": True}
            ]
        }]
    }
    
    try:
        resp = requests.post(SLACK_WEBHOOK, json=payload, timeout=5)
        print(f"   📤 Slack alert sent: {resp.status_code}")
    except Exception as e:
        print(f"   ❌ Slack error: {e}")

def check_service(service_id, name, url, timeout):
    try:
        response = requests.get(url, timeout=timeout, allow_redirects=True)
        if response.status_code >= 500:
            return 'outage'
        elif response.status_code >= 300 and response.status_code < 400:
            return 'degraded'
        else:
            # 200-299 ou 400-499
            return 'operational'
    except requests.exceptions.Timeout:
        return 'degraded'
    except:
        return 'outage'

def create_or_update_incident(cur, conn, service_id, name, new_status):
    if new_status in ['outage', 'degraded']:
        # Verificar se já existe incidente ativo
        cur.execute("""
            SELECT id FROM incidents 
            WHERE service_id = %s AND status != 'resolved'
            ORDER BY created_at DESC LIMIT 1
        """, (service_id,))
        
        existing = cur.fetchone()
        if not existing:
            # Criar novo incidente
            severity = 'critical' if new_status == 'outage' else 'major'
            title = f"{name} - {'Service Outage' if new_status == 'outage' else 'Performance Degraded'}"
            cur.execute("""
                INSERT INTO incidents (title, description, severity, status, service_id, created_at, updated_at)
                VALUES (%s, %s, %s, 'investigating', %s, NOW(), NOW())
            """, (title, f"Automated detection: {name} is {new_status}", severity, service_id))
            conn.commit()
            print(f"   → Created incident for {name}")
    else:
        # Resolver incidentes ativos se serviço voltou
        cur.execute("""
            UPDATE incidents SET status = 'resolved', updated_at = NOW()
            WHERE service_id = %s AND status != 'resolved'
        """, (service_id,))
        if cur.rowcount > 0:
            conn.commit()
            print(f"   → Resolved incidents for {name}")

def monitor_services():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Buscar services com URL
    cur.execute("""
        SELECT id, name, url, status, request_timeout 
        FROM services 
        WHERE url IS NOT NULL AND url != ''
    """)
    
    for row in cur.fetchall():
        service_id, name, url, current_status, timeout = row
        timeout = timeout if timeout else 10
        
        # Verificar status
        new_status = check_service(service_id, name, url, timeout)
        
        # Se mudou, atualizar
        if new_status != current_status:
            cur.execute(
                "UPDATE services SET status = %s WHERE id = %s",
                (new_status, service_id)
            )
            conn.commit()
            
            # Criar/atualizar incidentes
            create_or_update_incident(cur, conn, service_id, name, new_status)
            
            # Enviar alerta Slack
            send_slack_alert(name, current_status, new_status)
            print(f"✅ Service {name}: {current_status} → {new_status}")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    monitor_services()
