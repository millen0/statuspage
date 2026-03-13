#!/bin/bash
set -e

echo "🔧 Setting up daily uptime log update cron job..."

# Make scripts executable
chmod +x /opt/statuspage/update-daily-uptime.py
chmod +x /opt/statuspage/populate-uptime-logs.py

# Create cron job to run daily at 23:59
CRON_JOB="59 23 * * * cd /opt/statuspage && /usr/bin/python3 update-daily-uptime.py >> /var/log/uptime-update.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "update-daily-uptime.py"; then
    echo "⚠️  Cron job already exists"
else
    # Add cron job
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "✅ Cron job added successfully"
fi

echo "📋 Current crontab:"
crontab -l

echo ""
echo "✅ Setup complete!"
echo "📝 The uptime logs will be updated daily at 23:59"
echo "📝 Logs will be written to /var/log/uptime-update.log"
echo ""
echo "To populate historical data (90 days), run:"
echo "  cd /opt/statuspage && python3 populate-uptime-logs.py"
