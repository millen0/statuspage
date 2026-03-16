#!/bin/bash

echo "Setting up scheduled maintenance email cron job..."

# Adicionar cron job para rodar a cada 5 minutos
(crontab -l 2>/dev/null | grep -v "send-scheduled-maintenance-emails.py"; echo "*/5 * * * * cd /opt/statuspage && /usr/bin/python3 send-scheduled-maintenance-emails.py >> /var/log/scheduled-emails.log 2>&1") | crontab -

echo "✅ Cron job configured to run every 5 minutes"
echo "📋 Current crontab:"
crontab -l | grep "send-scheduled-maintenance-emails"
