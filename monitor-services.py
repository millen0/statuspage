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

def check_service_with_codes(service_id, name, url, timeout, accepted_codes):
    try:
        response = requests.get(url, timeout=timeout, allow_redirects=True)
        status_code = response.status_code
        
        # Se tem accepted_codes configurado, usar ele
        if accepted_codes and '400-499' in accepted_codes:
            # Aceita 2xx e 4xx
            if (200 <= status_code <= 299) or (400 <= status_code <= 499):
                return 'operational'
            elif status_code >= 500:
                return 'outage'
            else:
                return 'degraded'
        else:
            # Padrão: apenas 2xx é operational
            if status_code >= 500:
                return 'outage'
            elif status_code >= 300 and status_code < 400:
                return 'degraded'
            elif 200 <= status_code <= 299:
                return 'operational'
            else:
                return 'degraded'
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
        SELECT id, name, url, status, request_timeout, accepted_status_codes 
        FROM services 
        WHERE url IS NOT NULL AND url != ''
    """)
    
    for row in cur.fetchall():
        service_id, name, url, current_status, timeout, accepted_codes = row
        timeout = timeout if timeout else 10
        
        # Verificar status
        new_status = check_service_with_codes(service_id, name, url, timeout, accepted_codes)
        
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
