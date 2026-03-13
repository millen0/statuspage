#!/usr/bin/env python3
"""
Script to update daily uptime logs based on current service status
Should be run via cron daily
"""

import psycopg2
import os
from datetime import datetime

# Database connection
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'statuspage')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'postgres')

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
        
        # Get all services with their current status
        cursor.execute("SELECT id, status FROM services")
        services = cursor.fetchall()
        
        print(f"Updating uptime logs for {len(services)} services on {today}")
        
        for service_id, status in services:
            # Calculate uptime based on status
            if status == 'operational':
                uptime_percentage = 100.0
            elif status == 'degraded':
                uptime_percentage = 97.0
            elif status == 'outage':
                uptime_percentage = 30.0
            else:
                uptime_percentage = 100.0
            
            total_checks = 1440  # Assuming checks every minute
            successful_checks = int(total_checks * uptime_percentage / 100)
            
            # Insert or update today's log
            cursor.execute("""
                INSERT INTO service_uptime_logs 
                (service_id, date, status, uptime_percentage, total_checks, successful_checks)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (service_id, date) DO UPDATE
                SET status = EXCLUDED.status,
                    uptime_percentage = EXCLUDED.uptime_percentage,
                    total_checks = EXCLUDED.total_checks,
                    successful_checks = EXCLUDED.successful_checks
            """, (service_id, today, status, uptime_percentage, total_checks, successful_checks))
            
            print(f"✓ Service {service_id}: {status} - {uptime_percentage}% uptime")
        
        conn.commit()
        cursor.close()
        conn.close()
        print(f"\n✅ Successfully updated uptime logs for {today}")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    update_daily_uptime()
