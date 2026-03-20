#!/usr/bin/env python3
"""
Monitor Integrado com Tracking Automático de Downtime
Monitora serviços e registra downtimes automaticamente
"""

import json
import requests
import sys
import time
import socket
import os
import subprocess
from datetime import datetime
from urllib.parse import urlparse
from dotenv import load_dotenv

# Carregar configurações
load_dotenv('monitor-config.env')
load_dotenv('backend/.env')

BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:8080/api/monitors/report')
SLACK_WEBHOOK = os.getenv('SLACK_WEBHOOK', '')
STATE_FILE = "monitor-state.json"
DOWNTIME_TRACKER = "./auto-track-downtime.py"

# Configurações
REQUEST_TIMEOUT = int(os.getenv('REQUEST_TIMEOUT', '120'))
RETRIES = int(os.getenv('RETRIES', '5'))
HEARTBEAT_INTERVAL = int(os.getenv('HEARTBEAT_INTERVAL', '60'))
TCP_PORT = 80

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

def check_tcp(host, port=TCP_PORT, timeout=REQUEST_TIMEOUT):
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

def check_and_report(name, url, previous_state):
    """Verifica serviço e reporta status"""
    status_code = None
    error = None
    is_tcp_check = False
    success = False
    
    # Detectar se é TCP check
    parsed = urlparse(url)
    if not parsed.scheme:
        is_tcp_check = True
        host = url.rstrip('.')
        print(f"🔌 TCP Check: {name} - {host}")
    
    # Tentar com retries
    for attempt in range(1, RETRIES + 1):
        try:
            if is_tcp_check:
                if check_tcp(host):
                    status_code = 200
                    print(f"✅ {name}: TCP connection successful")
                    success = True
                    break
                else:
                    raise Exception("TCP connection failed")
            else:
                response = requests.get(url, timeout=REQUEST_TIMEOUT, verify=True)
                status_code = response.status_code
                
                if 200 <= status_code <= 299 or 400 <= status_code <= 499:
                    print(f"✅ {name}: {url} - Status {status_code}")
                    success = True
                else:
                    print(f"🚨 ALARM: {name}: {url} - Status {status_code}")
                    success = False
                    if previous_state.get(name) != 'down':
                        send_slack_alert(name, url, status_code, None)
                break
            
        except Exception as e:
            error = str(e)
            status_code = 0
            
            if attempt < RETRIES:
                print(f"⚠️  {name}: Attempt {attempt}/{RETRIES} failed, retrying...")
                time.sleep(2)
            else:
                print(f"🚨 ALARM: {name}: {url} - Error after {RETRIES} retries: {error}")
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
    json_file = os.getenv('SERVICES_JSON', '/opt/statuspage/services.json')
    
    if not os.path.exists(json_file):
        print(f"❌ Arquivo de serviços não encontrado: {json_file}")
        sys.exit(1)
    
    try:
        with open(json_file, 'r') as f:
            content = f.read()
            content = content.replace(',\\n}', '\\n}').replace('},\\n{', '},\\n{')
            services = json.loads(f'[{content}]')
    except Exception as e:
        print(f"❌ Erro ao ler arquivo JSON: {e}")
        sys.exit(1)
    
    # Carregar estado anterior
    previous_state = load_state()
    current_state = {}
    
    print(f"\\n{'='*60}")
    print(f"Health Check - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Config: Timeout={REQUEST_TIMEOUT}s | Retries={RETRIES} | Interval={HEARTBEAT_INTERVAL}s")
    print(f"Downtime Tracking: ENABLED")
    print(f"{'='*60}\\n")
    
    failed = []
    for service in services:
        name = service.get('Name', 'Unknown')
        url = service.get('URL', '').strip()
        
        if not url:
            continue
            
        if not check_and_report(name, url, previous_state):
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
    print(f"Next check in {HEARTBEAT_INTERVAL} seconds")
    print(f"{'='*60}\\n")
    
    sys.exit(len(failed))

if __name__ == "__main__":
    main()
