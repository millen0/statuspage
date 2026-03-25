#!/bin/bash

# Deploy das alterações de manutenção
# Adiciona indicação de manutenção nos tooltips do uptime bar

set -e

echo "🚀 Deploying maintenance tooltip updates..."

# 1. Rebuild backend
echo "📦 Building backend..."
cd backend
go build -o statuspage
cd ..

# 2. Rebuild frontend
echo "🎨 Building frontend..."
cd frontend/public-page
npm run build
cd ../..

# 3. Restart services
echo "🔄 Restarting services..."
if command -v docker &> /dev/null && docker ps | grep -q statuspage; then
    echo "Using Docker..."
    docker-compose restart backend
else
    echo "Using systemd..."
    sudo systemctl restart statuspage-backend
fi

echo "✅ Deploy completed!"
echo ""
echo "📋 Changes:"
echo "   - Added maintenance_id field to incidents"
echo "   - Tooltips now show 'Occurred during scheduled maintenance' for linked incidents"
echo "   - Incidents #3 and #4 are now linked to Feb 14-15 maintenance"
echo ""
echo "🌐 Check: https://status.piercloud.com"
