#!/usr/bin/env python3
"""
Monitor Integrado com Tracking Automático de Downtime
Monitora serviços e registra downtimes automaticamente
RESPEITA configurações individuais de cada serviço (heartbeat_interval, request_timeout, retries)
"""

import json
import requests
import sys
import time
import socket
import os
import subprocess
import psycopg2
from datetime import datetime
from urllib.parse import urlparse
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

# Carregar configurações
load_dotenv('monitor-config.env')
load_dotenv('backend/.env')

BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:8080/api/monitors/report')
SLACK_WEBHOOK = os.getenv('SLACK_WEBHOOK', '')
STATE_FILE = "monitor-state.json"
DOWNTIME_TRACKER = "./auto-track-downtime.py"

# Configurações padrão (fallback)
DEFAULT_REQUEST_TIMEOUT = 120
DEFAULT_RETRIES = 5
DEFAULT_HEARTBEAT_INTERVAL = 60
TCP_PORT = 80

def get_db_connection():
    """Conecta ao banco de dados"""
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', '5432'),
            database=os.getenv('DB_NAME', 'statuspage'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', '')
        )
        return conn
    except Exception as e:
        print(f"⚠️  Erro ao conectar ao banco: {e}")
        return None

def get_service_config(service_name):
    """
    Busca configurações do serviço no banco de dados
    Retorna: (service_id, url, heartbeat_interval, request_timeout, retries)
    """
    conn = get_db_connection()
    if not conn:
        return None, None, DEFAULT_HEARTBEAT_INTERVAL, DEFAULT_REQUEST_TIMEOUT, DEFAULT_RETRIES
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    id,
                    url,
                    heartbeat_interval,
                    request_timeout,
                    retries
                FROM services
                WHERE name ILIKE %s
                LIMIT 1
            """, (f"%{service_name}%",))
            
            result = cur.fetchone()
            if result:
                return (
                    result['id'],
                    result['url'],
                    result['heartbeat_interval'] or DEFAULT_HEARTBEAT_INTERVAL,
                    result['request_timeout'] or DEFAULT_REQUEST_TIMEOUT,
                    result['retries'] or DEFAULT_RETRIES
                )
    except Exception as e:
        print(f"   ⚠️  Erro ao buscar config do serviço: {e}")
    finally:
        conn.close()
    
    return None, None, DEFAULT_HEARTBEAT_INTERVAL, DEFAULT_REQUEST_TIMEOUT, DEFAULT_RETRIES

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

def track_downtime(service_name, is_down, error_message=None):
    """Registra downtime usando o sistema automático"""
    try:
        if is_down:
            cmd = [
                'python3', DOWNTIME_TRACKER,
                '--down', service_name, error_message or 'Service unavailable'
            ]
        else:
            cmd = ['python3', DOWNTIME_TRACKER, '--up', service_name]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            print(f"   → Downtime tracked")
        else:
            print(f"   → Downtime tracking failed: {result.stderr}")
    except Exception as e:
        print(f"   → Downtime tracking error: {e}")

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

def send_slack_alert(name, url, status_code, error, is_recovery=False):
    """Envia alerta para o Slack"""
    if not SLACK_WEBHOOK:
        return
    
    if is_recovery:
        color = "good"
        emoji = ":white_check_mark:"
        title = f"{emoji} RECOVERED: {name} is back online"
        message = "Service has recovered"
    elif error:
        color = "danger"
        emoji = ":rotating_light:"
        title = f"{emoji} ALERT: {name} is DOWN"
        message = f"Error: {error}"
    elif status_code and not (200 <= status_code <= 299 or 400 <= status_code <= 499):
        color = "warning"
        emoji = ":warning:"
        title = f"{emoji} WARNING: {name} returned unexpected status"
        message = f"Status Code: {status_code}"
    else:
        return
    
    payload = {
        "attachments": [{
            "color": color,
            "title": title,
            "fields": [
                {"title": "Service", "value": name, "short": True},
                {"title": "URL", "value": url, "short": True},
                {"title": "Status", "value": message, "short": False},
                {"title": "Time", "value": datetime.now().strftime('%Y-%m-%d %H:%M:%S'), "short": True}
            ]
        }]
    }
    
    try:
        requests.post(SLACK_WEBHOOK, json=payload, timeout=5)
        print(f"   → Slack alert sent ({color})")
    except Exception as e:
        print(f"   → Failed to send Slack alert: {e}")

def check_and_report(name, url, previous_state, service_config=None):
    """
    Verifica serviço e reporta status
    service_config: (service_id, db_url, heartbeat_interval, request_timeout, retries)
    """
    # Usar configurações do serviço ou padrões
    if service_config:
        service_id, db_url, heartbeat_interval, request_timeout, retries = service_config
        # Se URL do banco existe, usar ela
        if db_url:
            url = db_url
    else:
        service_id = None
        heartbeat_interval = DEFAULT_HEARTBEAT_INTERVAL
        request_timeout = DEFAULT_REQUEST_TIMEOUT
        retries = DEFAULT_RETRIES
    
    print(f"🔍 {name}")
    print(f"   Config: Timeout={request_timeout}s | Retries={retries} | Interval={heartbeat_interval}s")
    
    status_code = None
    error = None
    is_tcp_check = False
    success = False
    
    # Detectar se é TCP check
    parsed = urlparse(url)
    if not parsed.scheme:
        is_tcp_check = True
        host = url.rstrip('.')
        print(f"   🔌 TCP Check: {host}")
    
    # Tentar com retries
    for attempt in range(1, retries + 1):
        try:
            if is_tcp_check:
                if check_tcp(host, timeout=request_timeout):
                    status_code = 200
                    print(f"   ✅ TCP connection successful")
                    success = True
                    break
                else:
                    raise Exception("TCP connection failed")
            else:
                response = requests.get(url, timeout=request_timeout, verify=True)
                status_code = response.status_code
                
                if 200 <= status_code <= 299 or 400 <= status_code <= 499:
                    print(f"   ✅ Status {status_code}")
                    success = True
                else:
                    print(f"   🚨 ALARM: Status {status_code}")
                    success = False
                    if previous_state.get(name) != 'down':
                        send_slack_alert(name, url, status_code, None)
                break
            
        except Exception as e:
            error = str(e)
            status_code = 0
            
            if attempt < retries:
                print(f"   ⚠️  Attempt {attempt}/{retries} failed, retrying...")
                time.sleep(2)
            else:
                print(f"   🚨 ALARM: Error after {retries} retries: {error}")
                success = False
                if previous_state.get(name) != 'down':
                    send_slack_alert(name, url, status_code, error)
    
    # Tracking de downtime automático
    if not success and previous_state.get(name) != 'down':
        # Serviço caiu agora
        track_downtime(name, True, error or f"Status {status_code}")
    elif success and previous_state.get(name) == 'down':
        # Serviço recuperou
        track_downtime(name, False)
        send_slack_alert(name, url, status_code, None, is_recovery=True)
    
    # Enviar ao backend
    try:
        payload = {
            "name": name,
            "url": url,
            "status_code": status_code,
            "error": error or ""
        }
        backend_response = requests.post(BACKEND_URL, json=payload, timeout=5)
        if backend_response.status_code == 200:
            print(f"   → Reported to backend")
        else:
            print(f"   → Failed to report: {backend_response.status_code}")
    except Exception as e:
        print(f"   → Backend error: {e}")
    
    return success

def main():
    """Função principal do monitor"""
    # Carregar estado anterior
    previous_state = load_state()
    current_state = {}
    
    print(f"\n{'='*60}")
    print(f"Health Check - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Downtime Tracking: ENABLED")
    print(f"Service-specific configs: ENABLED")
    print(f"{'='*60}\n")
    
    # Buscar serviços do banco de dados
    conn = get_db_connection()
    if not conn:
        print("❌ Não foi possível conectar ao banco de dados")
        sys.exit(1)
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    id,
                    name,
                    url,
                    heartbeat_interval,
                    request_timeout,
                    retries,
                    status
                FROM services
                WHERE url IS NOT NULL AND url != ''
                ORDER BY position
            """)
            
            services = cur.fetchall()
    finally:
        conn.close()
    
    if not services:
        print("⚠️  Nenhum serviço encontrado no banco de dados")
        sys.exit(0)
    
    failed = []
    for service in services:
        name = service['name']
        url = service['url']
        
        if not url:
            continue
        
        # Preparar configurações do serviço
        service_config = (
            service['id'],
            url,
            service['heartbeat_interval'] or DEFAULT_HEARTBEAT_INTERVAL,
            service['request_timeout'] or DEFAULT_REQUEST_TIMEOUT,
            service['retries'] or DEFAULT_RETRIES
        )
        
        if not check_and_report(name, url, previous_state, service_config):
            failed.append(name)
            current_state[name] = 'down'
        else:
            current_state[name] = 'up'
        print()
    
    # Salvar estado atual
    save_state(current_state)
    
    print(f"{'='*60}")
    print(f"Total: {len(services)} | Failed: {len(failed)}")
    if failed:
        print(f"Failed services: {', '.join(failed)}")
    print(f"{'='*60}\n")
    
    sys.exit(len(failed))

if __name__ == "__main__":
    main()
