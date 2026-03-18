#!/bin/bash
# Setup all cron jobs for statuspage monitoring and automation

echo "🔧 Setting up cron jobs for statuspage..."

# Backup existing crontab
crontab -l > /tmp/crontab_backup_$(date +%Y%m%d_%H%M%S).txt 2>/dev/null || true

# Create new crontab
cat > /tmp/statuspage_crontab << 'EOF'
# StatusPage Monitoring and Automation Cron Jobs

# Monitor services every minute (real-time monitoring)
* * * * * cd /opt/statuspage && /usr/bin/python3 monitor.py >> /var/log/statuspage-monitor.log 2>&1

# Notify incidents to Slack every minute
* * * * * cd /opt/statuspage && /usr/bin/python3 notify-incidents-slack.py >> /var/log/incident-slack-notifications.log 2>&1

# Auto-complete maintenances every minute
* * * * * cd /opt/statuspage && /usr/bin/python3 auto-complete-maintenances.py >> /var/log/maintenance-auto-complete.log 2>&1

# Auto-update maintenance status every minute
* * * * * cd /opt/statuspage && /usr/bin/python3 auto-update-maintenances.py >> /var/log/maintenance-auto-update.log 2>&1

# Send scheduled maintenance emails every 5 minutes
*/5 * * * * cd /opt/statuspage && /usr/bin/python3 send-scheduled-maintenance-emails.py >> /var/log/scheduled-emails.log 2>&1

# Update daily uptime logs at 23:50 every day
50 23 * * * cd /opt/statuspage && /usr/bin/python3 update-daily-uptime.py >> /var/log/daily-uptime.log 2>&1

# Update group uptime at 23:55 every day
55 23 * * * cd /opt/statuspage && /usr/bin/python3 update-group-uptime.py >> /var/log/group-uptime.log 2>&1

# Create auto-incidents from uptime degradation at 00:05 every day
5 0 * * * cd /opt/statuspage && /usr/bin/python3 create-auto-incidents.py >> /var/log/auto-incidents.log 2>&1

# Cleanup old logs every Sunday at 2am
0 2 * * 0 find /var/log -name "statuspage-*.log" -mtime +30 -delete
0 2 * * 0 find /var/log -name "maintenance-*.log" -mtime +30 -delete
0 2 * * 0 find /var/log -name "scheduled-emails.log" -mtime +30 -delete
0 2 * * 0 find /var/log -name "daily-uptime.log" -mtime +30 -delete
0 2 * * 0 find /var/log -name "group-uptime.log" -mtime +30 -delete
0 2 * * 0 find /var/log -name "auto-incidents.log" -mtime +30 -delete

EOF

# Install new crontab
crontab /tmp/statuspage_crontab

echo "✅ Cron jobs installed successfully!"
echo ""
echo "📋 Installed cron jobs:"
crontab -l
echo ""
echo "📁 Log files location: /var/log/"
echo "   - statuspage-monitor.log (service monitoring)"
echo "   - incident-slack-notifications.log (incident Slack notifications)"
echo "   - maintenance-auto-complete.log (auto-complete maintenances)"
echo "   - maintenance-auto-update.log (auto-update maintenance status)"
echo "   - scheduled-emails.log (scheduled maintenance emails)"
echo "   - daily-uptime.log (daily uptime calculation)"
echo "   - group-uptime.log (group uptime calculation)"
echo "   - auto-incidents.log (auto-incident creation)"
echo ""
echo "🔍 To view logs in real-time:"
echo "   tail -f /var/log/statuspage-monitor.log"
echo "   tail -f /var/log/incident-slack-notifications.log"
echo "   tail -f /var/log/auto-incidents.log"
