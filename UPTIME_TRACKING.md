# Uptime Tracking System

## Overview
This system tracks daily uptime for each service and displays it in a GitHub-style 90-day graph on the public status page.

## Database Schema
The `service_uptime_logs` table stores daily uptime data:
- `service_id`: Reference to the service
- `date`: The date of the log
- `status`: Service status for that day (operational, degraded, outage)
- `uptime_percentage`: Percentage of uptime (0-100)
- `total_checks`: Total number of health checks performed
- `successful_checks`: Number of successful checks

## Setup Instructions

### 1. Run Migration
The migration is automatically run during deployment, but you can run it manually:
```bash
psql -U postgres -d statuspage -f /opt/statuspage/backend/database/migration_uptime_logs.sql
```

### 2. Populate Historical Data (First Time Only)
To create 90 days of historical uptime data:
```bash
cd /opt/statuspage
python3 populate-uptime-logs.py
```

This will generate realistic uptime data:
- 95% of days: 100% uptime (operational)
- 4% of days: 95-99% uptime (degraded)
- 1% of days: 0-50% uptime (outage)

### 3. Setup Daily Updates
To automatically update uptime logs daily:
```bash
cd /opt/statuspage
chmod +x setup-uptime-cron.sh
./setup-uptime-cron.sh
```

This creates a cron job that runs daily at 23:59 to record the day's uptime.

## API Endpoints

### Get Service Uptime (90 days)
```
GET /api/public/services/{id}/uptime
```

Response:
```json
[
  {
    "date": "2024-01-15",
    "status": "operational",
    "uptime_percentage": 100.0
  },
  {
    "date": "2024-01-16",
    "status": "degraded",
    "uptime_percentage": 97.5
  }
]
```

## Frontend Display

### Classic Mode
Simple grid with service name and status dot.

### Uptime Mode
Detailed cards showing:
- Service name and current status
- 90-day uptime graph (GitHub-style)
- Overall uptime percentage
- Color coding:
  - Green: 99-100% uptime (operational)
  - Yellow: 50-99% uptime (degraded)
  - Red: 0-50% uptime (outage)

## Manual Updates

To manually update today's uptime:
```bash
cd /opt/statuspage
python3 update-daily-uptime.py
```

## Logs

Daily update logs are stored in:
```
/var/log/uptime-update.log
```

## Customization

To adjust uptime calculation logic, edit:
- `update-daily-uptime.py` - Daily update script
- `populate-uptime-logs.py` - Historical data generation

To change the display, edit:
- `frontend/public-page/src/components/ServiceList.jsx`
