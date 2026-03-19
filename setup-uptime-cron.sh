#!/bin/bash
# Setup cron job for hourly uptime updates

echo "Setting up cron job for hourly uptime updates..."

# Add cron job if it doesn't exist
CRON_JOB="0 * * * * cd /opt/statuspage && export \$(cat backend/.env | xargs) && /usr/bin/python3 update-daily-uptime.py >> /var/log/uptime-update.log 2>&1"

# Check if cron job already exists
(crontab -l 2>/dev/null | grep -F "update-daily-uptime.py") && echo "Cron job already exists" || (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "✅ Cron job configured to run hourly"
echo "To view cron jobs: crontab -l"
echo "To view logs: tail -f /var/log/uptime-update.log"
