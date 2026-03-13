#!/usr/bin/env python3
"""
Script to populate service_uptime_logs with historical data
Run this once to create 90 days of uptime history for all services
"""

import psycopg2
import os
from datetime import datetime, timedelta
import random

# Database connection
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'statuspage')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'postgres')

def populate_uptime_logs():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        cursor = conn.cursor()
        
        # Get all services
        cursor.execute("SELECT id, status FROM services")
        services = cursor.fetchall()
        
        print(f"Found {len(services)} services")
        
        # Generate 90 days of history for each service
        today = datetime.now().date()
        
        for service_id, current_status in services:
            print(f"Populating uptime logs for service {service_id}...")
            
            for days_ago in range(90, 0, -1):
                date = today - timedelta(days=days_ago)
                
                # Generate realistic uptime data
                # 95% chance of 100% uptime
                # 4% chance of degraded (95-99% uptime)
                # 1% chance of outage (0-50% uptime)
                rand = random.random()
                
                if rand > 0.99:  # 1% outage
                    status = 'outage'
                    uptime_percentage = random.uniform(0, 50)
                    total_checks = 1440  # checks per day (every minute)
                    successful_checks = int(total_checks * uptime_percentage / 100)
                elif rand > 0.95:  # 4% degraded
                    status = 'degraded'
                    uptime_percentage = random.uniform(95, 99)
                    total_checks = 1440
                    successful_checks = int(total_checks * uptime_percentage / 100)
                else:  # 95% operational
                    status = 'operational'
                    uptime_percentage = 100.0
                    total_checks = 1440
                    successful_checks = total_checks
                
                # Insert log
                cursor.execute("""
                    INSERT INTO service_uptime_logs 
                    (service_id, date, status, uptime_percentage, total_checks, successful_checks)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (service_id, date) DO UPDATE
                    SET status = EXCLUDED.status,
                        uptime_percentage = EXCLUDED.uptime_percentage,
                        total_checks = EXCLUDED.total_checks,
                        successful_checks = EXCLUDED.successful_checks
                """, (service_id, date, status, uptime_percentage, total_checks, successful_checks))
            
            conn.commit()
            print(f"✓ Service {service_id} completed")
        
        cursor.close()
        conn.close()
        print("\n✅ Successfully populated uptime logs for all services!")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    populate_uptime_logs()
