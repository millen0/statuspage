#!/usr/bin/env python3
"""
Auto-generate incidents from uptime logs with degraded performance
Creates incidents for days with uptime < 99.9%
"""

import psycopg2
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv('backend/.env')

DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'statuspage')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD')

def get_severity_from_uptime(uptime):
    """Determine severity based on uptime percentage"""
    uptime = float(uptime)
    if uptime < 50:
        return 'critical'
    elif uptime < 95:
        return 'major'
    elif uptime < 99:
        return 'minor'
    else:
        return 'info'

def calculate_downtime(uptime_percentage):
    """Calculate downtime in hours and minutes"""
    downtime_minutes = round((100 - float(uptime_percentage)) * 14.4)  # 1440 minutes in a day
    hours = downtime_minutes // 60
    minutes = downtime_minutes % 60
    return hours, minutes

def generate_incident_title(service_name, uptime_percentage):
    """Generate incident title based on uptime"""
    uptime_percentage = float(uptime_percentage)
    if uptime_percentage < 50:
        return f"{service_name} - Major Outage"
    elif uptime_percentage < 95:
        return f"{service_name} - Partial Outage"
    elif uptime_percentage < 99:
        return f"{service_name} - Degraded Performance"
    else:
        return f"{service_name} - Minor Issues"

def generate_incident_description(uptime_percentage, hours, minutes):
    """Generate incident description"""
    downtime_str = ""
    if hours > 0:
        downtime_str += f"{hours} hour{'s' if hours > 1 else ''}"
    if minutes > 0:
        if downtime_str:
            downtime_str += f" and {minutes} minute{'s' if minutes > 1 else ''}"
        else:
            downtime_str += f"{minutes} minute{'s' if minutes > 1 else ''}"
    
    return f"Service experienced {downtime_str} of downtime ({float(uptime_percentage):.2f}% uptime). This incident was automatically detected from uptime monitoring data."

def create_auto_incidents():
    """Create incidents for uptime logs with degraded performance"""
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )
    cursor = conn.cursor()
    
    try:
        # Get all uptime logs with uptime < 99.9% that don't have incidents yet
        cursor.execute("""
            SELECT ul.service_id, ul.date, ul.uptime_percentage, s.name
            FROM uptime_logs ul
            LEFT JOIN services s ON ul.service_id = s.id
            LEFT JOIN incidents i ON i.uptime_date = ul.date AND i.service_id = ul.service_id
            WHERE ul.uptime_percentage < 99.9
            AND i.id IS NULL
            AND ul.service_id > 0
            ORDER BY ul.date DESC, ul.service_id
        """)
        
        degraded_logs = cursor.fetchall()
        
        if not degraded_logs:
            print("No new degraded uptime logs found")
            return
        
        print(f"Found {len(degraded_logs)} degraded uptime logs without incidents")
        
        for service_id, date, uptime_percentage, service_name in degraded_logs:
            severity = get_severity_from_uptime(uptime_percentage)
            hours, minutes = calculate_downtime(uptime_percentage)
            title = generate_incident_title(service_name, uptime_percentage)
            description = generate_incident_description(uptime_percentage, hours, minutes)
            
            # Create incident
            cursor.execute("""
                INSERT INTO incidents 
                (title, description, severity, status, service_id, created_at, updated_at, resolved_at, is_visible, auto_generated, uptime_date)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                title,
                description,
                severity,
                'resolved',  # Auto-generated incidents are marked as resolved
                service_id,
                datetime.combine(date, datetime.min.time()),  # Set created_at to start of day
                datetime.combine(date, datetime.max.time()),  # Set updated_at to end of day
                datetime.combine(date, datetime.max.time()),  # Set resolved_at to end of day
                True,  # Make visible
                True,  # Mark as auto-generated
                date
            ))
            
            incident_id = cursor.fetchone()[0]
            
            # Create initial incident update
            cursor.execute("""
                INSERT INTO incident_updates 
                (incident_id, status, message, created_at)
                VALUES (%s, %s, %s, %s)
            """, (
                incident_id,
                'resolved',
                f"Service has been restored. Total downtime: {hours}h {minutes}m",
                datetime.combine(date, datetime.max.time())
            ))
            
            print(f"✓ Created incident #{incident_id} for {service_name} on {date} ({float(uptime_percentage):.2f}% uptime)")
        
        conn.commit()
        print(f"\n✅ Successfully created {len(degraded_logs)} auto-generated incidents")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error creating auto incidents: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    create_auto_incidents()
