#!/bin/bash
# Deploy Monitor Fix - Respeitar Heartbeat Interval e Retries

echo "🚀 Deploying Monitor Fix to EC2..."

# Backup do monitor atual
echo "📦 Creating backup..."
sudo cp /opt/statuspage/monitor-hybrid.py /opt/statuspage/monitor-hybrid.py.backup.$(date +%Y%m%d_%H%M%S)

# Copiar novo monitor
echo "📝 Updating monitor-hybrid.py..."
sudo cp monitor-hybrid.py /opt/statuspage/monitor-hybrid.py

# Ajustar permissões
echo "🔐 Setting permissions..."
sudo chown root:root /opt/statuspage/monitor-hybrid.py
sudo chmod 755 /opt/statuspage/monitor-hybrid.py

# Limpar arquivos de estado antigos para forçar nova checagem
echo "🧹 Cleaning old state files..."
sudo rm -f /opt/statuspage/monitor-last-check.json

echo ""
echo "✅ Deploy completed!"
echo ""
echo "📊 Monitor will now:"
echo "   - Respect heartbeat_interval for each service"
echo "   - Retry on 5xx errors before alerting"
echo "   - Use configured request_timeout"
echo ""
echo "🔍 Test manually:"
echo "   cd /opt/statuspage && sudo python3 monitor-hybrid.py"
echo ""
echo "📋 Check logs:"
echo "   tail -f /var/log/statuspage-monitor.log"
