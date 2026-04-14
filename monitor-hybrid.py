#!/usr/bin/env python3
"""
Monitor Híbrido - Melhor dos Dois Mundos
- Registra downtimes automáticos (service_downtimes)
- Cria/atualiza incidents automaticamente (incidents)
- Respeita configurações individuais de cada serviço
- Suporta TCP checks
- Envia alertas Slack
"""

import json
import requests
import sys
import time
import socket
import os
import psycopg2
import urllib3
from datetime import datetime
from urllib.parse import urlparse
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Carregar configurações
load_dotenv('/opt/statuspage/backend/.env')  # EC2 path
load_dotenv('backend/.env')  # Local path
load_dotenv('monitor-config.env')  # Fallback

DB_CONFIG = {
    'host': os.getenv('DB_HOST', '127.0.0.1'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres'),
    'database': os.getenv('DB_NAME', 'statuspage')
}

SLACK_WEBHOOK = os.getenv('SLACK_WEBHOOK', '')
STATE_FILE = "monitor-state.json"

# Configurações padrão
DEFAULT_REQUEST_TIMEOUT = 10
DEFAULT_RETRIES = 1
TCP_PORT = 80

def get_db_connection():
    """Conecta ao banco de dados"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"⚠️  Erro ao conectar ao banco: {e}")
        return None

def load_state():
    """Carrega estado anterior dos serviços"""
    try:
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, 'r') as f:
                return json.load(f)
    except:
        pass
    return {}

def save_state(state):
    """Salva estado atual dos serviços"""
    try:
        with open(STATE_FILE, 'w') as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        print(f"   → Failed to save state: {e}")

def send_slack_alert(service_name, old_status, new_status, error_message=None):
    """Envia alerta para o Slack"""
    if not SLACK_WEBHOOK:
        print(f"   ⚠️  SLACK_WEBHOOK not configured")
        return
    
    # Definir cor e emoji baseado no novo status
    if new_status == "operational":
        color = "good"
        emoji = "✅"
        title = f"{emoji} Service Recovered: {service_name}"
    elif new_status == "outage":
        color = "danger"
        emoji = "🚨"
        title = f"{emoji} Service Status Changed: {service_name}"
    else:  # degraded
        color = "warning"
        emoji = "⚠️"
        title = f"{emoji} Service Status Changed: {service_name}"
    
    fields = [
        {"title": "Service", "value": service_name, "short": True},
        {"title": "Old Status", "value": old_status, "short": True},
        {"title": "New Status", "value": new_status, "short": True}
    ]
    
    if error_message:
        fields.append({"title": "Error", "value": error_message, "short": False})
    
    payload = {
        "attachments": [{
            "color": color,
            "title": title,
            "fields": fields
        }]
    }
    
    try:
        resp = requests.post(SLACK_WEBHOOK, json=payload, timeout=5)
        print(f"   📤 Slack alert sent: {resp.status_code}")
    except Exception as e:
        print(f"   ❌ Slack error: {e}")

def check_tcp(host, port=TCP_PORT, timeout=DEFAULT_REQUEST_TIMEOUT):
    """Verifica conectividade TCP"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except Exception as e:
        return False

def track_downtime_start(conn, service_id, status_code, error_message):
    """Registra início de downtime"""
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO service_downtimes (service_id, start_time, status_code, error_message)
            VALUES (%s, NOW(), %s, %s)
        """, (service_id, status_code, error_message))
        conn.commit()
        cur.close()
        print(f"   → Downtime started (recorded)")
    except Exception as e:
        print(f"   → Failed to record downtime start: {e}")

def track_downtime_end(conn, service_id):
    """Registra fim de downtime"""
    try:
        cur = conn.cursor()
        # Finalizar downtimes abertos
        cur.execute("""
            UPDATE service_downtimes 
            SET end_time = NOW()
            WHERE service_id = %s AND end_time IS NULL
        """, (service_id,))
        conn.commit()
        cur.close()
        print(f"   → Downtime ended (recorded)")
    except Exception as e:
        print(f"   → Failed to record downtime end: {e}")

def create_or_update_incident(conn, service_id, name, new_status, error_message=None):
    """Cria ou atualiza incidents automaticamente"""
    cur = conn.cursor()
    
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
            severity = 'critical' if new_status == 'outage' else 'minor'
            title = f"{name} - {'Service Outage' if new_status == 'outage' else 'Performance Degraded'}"
            description = error_message or f"Automated detection: {name} is {new_status}"
            
            cur.execute("""
                INSERT INTO incidents (title, description, severity, status, service_id, is_visible, created_at, updated_at)
                VALUES (%s, %s, %s, 'investigating', %s, false, NOW(), NOW())
            """, (title, description, severity, service_id))
            conn.commit()
            print(f"   → Created incident for {name}")
    else:
        # Resolver incidentes ativos se serviço voltou
        cur.execute("""
            UPDATE incidents 
            SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
            WHERE service_id = %s AND status != 'resolved'
        """, (service_id,))
        if cur.rowcount > 0:
            conn.commit()
            print(f"   → Resolved incidents for {name}")
    
    cur.close()

def check_service(service_id, name, url, timeout, retries, previous_state):
    """
    Verifica serviço com retry logic
    
    Status Logic:
    - 200-299 ou 400-499: ✅ Operational (não registra downtime)
    - 500-599: 🟡 Degraded (registra downtime)
    - Erro de conexão: 🔴 Outage (registra downtime)
    """
    print(f"🔍 {name}")
    print(f"   Config: Timeout={timeout}s | Retries={retries}")
    
    status_code = None
    error = None
    is_tcp_check = False
    success = False
    is_degraded = False
    
    # Detectar se é TCP check (sem scheme http/https)
    parsed = urlparse(url)
    if not parsed.scheme:
        is_tcp_check = True
        host = url.rstrip('.')
        print(f"   🔌 TCP Check: {host}")
    
    # Tentar com retries
    for attempt in range(1, retries + 1):
        try:
            if is_tcp_check:
                if check_tcp(host, timeout=timeout):
                    status_code = 200
                    print(f"   ✅ TCP connection successful")
                    success = True
                    break
                else:
                    raise Exception("TCP connection failed")
            else:
                response = requests.get(url, timeout=timeout, verify=False, allow_redirects=True)
                status_code = response.status_code
                
                # Status Logic:
                # 200-299 ou 400-499 = Operational (não é downtime)
                # 500-599 = Degraded (é downtime)
                # Outros = Degraded (é downtime)
                if 200 <= status_code <= 299:
                    print(f"   ✅ Status {status_code} (Operational)")
                    success = True
                    break
                elif 400 <= status_code <= 499:
                    print(f"   ✅ Status {status_code} (Client Error - Operational)")
                    success = True
                    break
                elif status_code >= 500:
                    # 500-599 = Degraded
                    print(f"   🟡 Status {status_code} (Degraded Performance)")
                    success = False
                    is_degraded = True
                    error = f"HTTP {status_code}"
                    break
                else:
                    # Outros códigos = Degraded
                    print(f"   🟡 Status {status_code} (Degraded)")
                    success = False
                    is_degraded = True
                    error = f"HTTP {status_code}"
                    break
            
        except Exception as e:
            error = str(e)
            status_code = 0
            
            if attempt < retries:
                print(f"   ⚠️  Attempt {attempt}/{retries} failed, retrying...")
                time.sleep(2)
            else:
                # Erro de conexão = Outage
                print(f"   🔴 OUTAGE: Error after {retries} retries: {error}")
                success = False
                is_degraded = False  # É outage, não degraded
    
    # Determinar novo status
    if success:
        new_status = 'operational'
    elif is_degraded:
        new_status = 'degraded'
    else:
        new_status = 'outage'
    
    return new_status, status_code, error

def monitor_services():
    """Função principal de monitoramento"""
    conn = get_db_connection()
    if not conn:
        print("❌ Não foi possível conectar ao banco de dados")
        sys.exit(1)
    
    # Carregar estado anterior
    previous_state = load_state()
    current_state = {}
    
    print(f"\n{'='*60}")
    print(f"Health Check - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Hybrid Monitor: Downtime Tracking + Incident Creation")
    print(f"{'='*60}\n")
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Buscar serviços com URL
        cur.execute("""
            SELECT id, name, url, status, request_timeout, retries
            FROM services 
            WHERE url IS NOT NULL AND url != ''
            ORDER BY position
        """)
        
        services = cur.fetchall()
        failed = []
        
        for service in services:
            service_id = service['id']
            name = service['name']
            url = service['url']
            current_status = service['status']
            timeout = service['request_timeout'] or DEFAULT_REQUEST_TIMEOUT
            retries = service['retries'] or DEFAULT_RETRIES
            
            # Verificar status com retries
            new_status, status_code, error = check_service(
                service_id, name, url, timeout, retries, previous_state
            )
            
            # Se mudou, atualizar
            if new_status != current_status:
                cur.execute(
                    "UPDATE services SET status = %s, updated_at = NOW() WHERE id = %s",
                    (new_status, service_id)
                )
                conn.commit()
                
                # Registrar downtime
                if new_status in ['degraded', 'outage'] and current_status == 'operational':
                    # Serviço caiu agora
                    error_msg = error or f"Status {status_code}"
                    track_downtime_start(conn, service_id, status_code or 0, error_msg)
                elif new_status == 'operational' and current_status in ['degraded', 'outage']:
                    # Serviço recuperou
                    track_downtime_end(conn, service_id)
                
                # Criar/atualizar incidentes
                create_or_update_incident(conn, service_id, name, new_status, error)
                
                # Enviar alerta Slack
                send_slack_alert(name, current_status, new_status, error)
                print(f"✅ Service {name}: {current_status} → {new_status}")
            
            # Atualizar estado
            if new_status != 'operational':
                failed.append(name)
                current_state[name] = 'down'
            else:
                current_state[name] = 'up'
            
            print()
        
        cur.close()
        
    finally:
        conn.close()
    
    # Salvar estado atual
    save_state(current_state)
    
    print(f"{'='*60}")
    print(f"Total: {len(services)} | Failed: {len(failed)}")
    if failed:
        print(f"Failed services: {', '.join(failed)}")
    print(f"{'='*60}\n")
    
    sys.exit(len(failed))

if __name__ == "__main__":
    monitor_services()
