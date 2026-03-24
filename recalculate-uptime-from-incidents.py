#!/usr/bin/env python3
"""
Script to recalculate daily uptime based on resolved incidents
This ensures uptime_logs reflect actual downtime from incidents
"""

import psycopg2
import os
from datetime import datetime, timedelta
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

def recalculate_uptime_from_incidents(days_back=91):
    """
    Recalculate uptime for the last N days based on resolved incidents
    """
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
        start_date = today - timedelta(days=days_back)
        
        print(f"Recalculating uptime from {start_date} to {today} based on incidents...")
        
        # Get all services
        cursor.execute("SELECT id, name FROM services")
        services = cursor.fetchall()
        
        for service_id, service_name in services:
            print(f"\n📊 Processing {service_name} (ID: {service_id})")
            
            # Get all resolved incidents for this service in the date range
            cursor.execute("""
                SELECT 
                    DATE(created_at) as incident_date,
                    created_at,
                    resolved_at
                FROM incidents
                WHERE service_id = %s
                    AND status = 'resolved'
                    AND created_at >= %s
                    AND resolved_at IS NOT NULL
                ORDER BY created_at
            """, (service_id, start_date))
            
            incidents = cursor.fetchall()
            
            if not incidents:
                print(f"  No incidents found")
                continue
            
            # Group incidents by date and calculate downtime
            downtime_by_date = {}
            
            for incident_date, created_at, resolved_at in incidents:
                # Calculate downtime in minutes
                downtime_minutes = (resolved_at - created_at).total_seconds() / 60
                
                # Add to the date's total downtime
                if incident_date not in downtime_by_date:
                    downtime_by_date[incident_date] = 0
                downtime_by_date[incident_date] += downtime_minutes
                
                print(f"  {incident_date}: +{downtime_minutes:.1f} mins downtime")
            
            # Update uptime_logs for each date with incidents
            for incident_date, total_downtime_minutes in downtime_by_date.items():
                # Calculate uptime percentage
                # 1 day = 1440 minutes
                uptime_percentage = max(0, 100 - (total_downtime_minutes / 1440 * 100))
                
                # Check if uptime log exists
                cursor.execute("""
                    SELECT uptime_percentage FROM uptime_logs
                    WHERE service_id = %s AND date = %s
                """, (service_id, incident_date))
                
                existing = cursor.fetchone()
                
                if existing:
                    # Update existing record
                    cursor.execute("""
                        UPDATE uptime_logs
                        SET uptime_percentage = %s
                        WHERE service_id = %s AND date = %s
                    """, (uptime_percentage, service_id, incident_date))
                    print(f"  ✓ Updated {incident_date}: {existing[0]:.2f}% → {uptime_percentage:.2f}%")
                else:
                    # Insert new record
                    cursor.execute("""
                        INSERT INTO uptime_logs (service_id, date, uptime_percentage)
                        VALUES (%s, %s, %s)
                    """, (service_id, incident_date, uptime_percentage))
                    print(f"  ✓ Created {incident_date}: {uptime_percentage:.2f}%")
        
        conn.commit()
        cursor.close()
        conn.close()
        print(f"\n✅ Successfully recalculated uptime from incidents")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    recalculate_uptime_from_incidents()
