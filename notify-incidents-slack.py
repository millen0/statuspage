#!/usr/bin/env python3
"""
Send Slack notifications for new and updated incidents
"""

import psycopg2
import os
import requests
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv('backend/.env')
load_dotenv('monitor-config.env')

DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'statuspage')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD')
SLACK_WEBHOOK = os.getenv('SLACK_WEBHOOK', '')

STATE_FILE = '/tmp/incident-slack-state.json'

def load_state():
    """Load previously notified incidents"""
    try:
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, 'r') as f:
                return json.load(f)
    except:
        pass
    return {}

def save_state(state):
    """Save notified incidents state"""
    try:
        with open(STATE_FILE, 'w') as f:
            json.dump(state, f)
    except Exception as e:
        print(f"Failed to save state: {e}")

def send_slack_notification(incident, service_name, is_new=True):
    """Send incident notification to Slack"""
    if not SLACK_WEBHOOK:
        print("Slack webhook not configured")
        return
    
    # Determine color and emoji based on severity and status
    if incident['status'] == 'resolved':
        color = 'good'
        emoji = ':white_check_mark:'
        action = 'RESOLVED'
    elif incident['severity'] == 'critical':
        color = 'danger'
        emoji = ':rotating_light:'
        action = 'CRITICAL INCIDENT' if is_new else 'UPDATED'
    elif incident['severity'] == 'major':
        color = 'danger'
        emoji = ':red_circle:'
        action = 'MAJOR INCIDENT' if is_new else 'UPDATED'
    elif incident['severity'] == 'minor':
        color = 'warning'
        emoji = ':warning:'
        action = 'MINOR INCIDENT' if is_new else 'UPDATED'
    else:
        color = '#439FE0'
        emoji = ':information_source:'
        action = 'INCIDENT' if is_new else 'UPDATED'
    
    title = f"{emoji} {action}: {incident['title']}"
    
    fields = [
        {"title": "Service", "value": service_name or "General", "short": True},
        {"title": "Severity", "value": incident['severity'].upper(), "short": True},
        {"title": "Status", "value": incident['status'].upper(), "short": True},
    ]
    
    if incident['status'] == 'resolved' and incident['resolved_at']:
        fields.append({
            "title": "Resolved At",
            "value": incident['resolved_at'].strftime('%Y-%m-%d %H:%M:%S UTC'),
            "short": True
        })
    
    payload = {
        "attachments": [{
            "color": color,
            "title": title,
            "text": incident['description'][:500],  # Limit description length
            "fields": fields,
            "footer": "PierCloud Status Page",
            "ts": int(incident['updated_at'].timestamp())
        }]
    }
    
    try:
        response = requests.post(SLACK_WEBHOOK, json=payload, timeout=5)
        if response.status_code == 200:
            print(f"✓ Slack notification sent for incident #{incident['id']}")
        else:
            print(f"✗ Failed to send Slack notification: {response.status_code}")
    except Exception as e:
        print(f"✗ Error sending Slack notification: {e}")

def check_and_notify():
    """Check for new or updated incidents and send notifications"""
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )
    cursor = conn.cursor()
    
    try:
        # Load previous state
        previous_state = load_state()
        current_state = {}
        
        # Get all visible incidents updated in the last 5 minutes
        cursor.execute("""
            SELECT i.id, i.title, i.description, i.severity, i.status, 
                   i.service_id, i.created_at, i.updated_at, i.resolved_at,
                   s.name as service_name
            FROM incidents i
            LEFT JOIN services s ON i.service_id = s.id
            WHERE i.is_visible = true
            AND i.updated_at >= NOW() - INTERVAL '5 minutes'
            ORDER BY i.updated_at DESC
        """)
        
        incidents = cursor.fetchall()
        
        for row in incidents:
            incident = {
                'id': row[0],
                'title': row[1],
                'description': row[2],
                'severity': row[3],
                'status': row[4],
                'service_id': row[5],
                'created_at': row[6],
                'updated_at': row[7],
                'resolved_at': row[8]
            }
            service_name = row[9]
            
            incident_key = f"{incident['id']}"
            last_update = previous_state.get(incident_key, {}).get('updated_at')
            
            # Check if this is a new incident or an update
            is_new = incident_key not in previous_state
            is_updated = last_update and incident['updated_at'].isoformat() != last_update
            
            if is_new or is_updated:
                send_slack_notification(incident, service_name, is_new)
                current_state[incident_key] = {
                    'updated_at': incident['updated_at'].isoformat(),
                    'status': incident['status']
                }
            else:
                # Keep existing state
                current_state[incident_key] = previous_state[incident_key]
        
        # Save current state
        save_state(current_state)
        
    except Exception as e:
        print(f"Error checking incidents: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    check_and_notify()
