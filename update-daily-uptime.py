#!/usr/bin/env python3
"""
Script to update daily uptime logs based on current service status
Should be run via cron hourly to track status changes throughout the day
"""

import psycopg2
import os
from datetime import datetime, time as dt_time
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/opt/statuspage/backend/.env')
load_dotenv('backend/.env')

# Database connection
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'statuspage')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'postgres')

def calculate_uptime_for_status(status, hours_in_status, total_hours_today):
    """
    Calculate uptime percentage based on status and time spent in that status
    """
    if status == 'operational':
        return 100.0
    elif status == 'degraded':
        return 97.0
    elif status == 'outage':
        return 0.0  # Full outage = 0% uptime
    elif status == 'maintenance':
        return 100.0  # Maintenance doesn't count as downtime
    else:
        return 100.0

def update_daily_uptime():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        cursor = conn.cursor()
        
        today = datetime.now().date()
        now = datetime.now()
        
        # Calculate how many hours have passed today
        start_of_day = datetime.combine(today, dt_time.min)
        hours_elapsed = (now - start_of_day).total_seconds() / 3600
        
        # Get all services with their current status and last update time
        cursor.execute("""
            SELECT id, status, updated_at 
            FROM services
        """)
        services = cursor.fetchall()
        
        print(f"Updating uptime logs for {len(services)} services on {today} ({hours_elapsed:.1f}h elapsed)")
        
        for service_id, status, updated_at in services:
            # Get existing uptime for today
            cursor.execute("""
                SELECT uptime_percentage 
                FROM uptime_logs 
                WHERE service_id = %s AND date = %s
            """, (service_id, today))
            
            existing = cursor.fetchone()
            
            if existing:
                # Update existing record - calculate weighted average
                current_uptime = float(existing[0])  # Convert Decimal to float
                status_uptime = calculate_uptime_for_status(status, 1, hours_elapsed)
                
                # Weighted update: blend current status into the day's average
                # This gives more weight to the current status as the day progresses
                weight = 1.0 / max(hours_elapsed, 1)
                new_uptime = (current_uptime * (1 - weight)) + (status_uptime * weight)
                
                cursor.execute("""
                    UPDATE uptime_logs 
                    SET uptime_percentage = %s
                    WHERE service_id = %s AND date = %s
                """, (new_uptime, service_id, today))
                
                print(f"✓ Service {service_id}: {status} - {current_uptime:.1f}% → {new_uptime:.1f}% uptime")
            else:
                # Create new record for today
                uptime_percentage = calculate_uptime_for_status(status, hours_elapsed, hours_elapsed)
                
                cursor.execute("""
                    INSERT INTO uptime_logs 
                    (service_id, date, uptime_percentage)
                    VALUES (%s, %s, %s)
                """, (service_id, today, uptime_percentage))
                
                print(f"✓ Service {service_id}: {status} - {uptime_percentage:.1f}% uptime (new)")
        
        conn.commit()
        cursor.close()
        conn.close()
        print(f"\n✅ Successfully updated uptime logs for {today}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    update_daily_uptime()
