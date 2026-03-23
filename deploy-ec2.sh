#!/bin/bash
set -e
export PATH=$PATH:/usr/local/go/bin

echo "🚀 Deploying PierCloud Status Page..."

# Ir para o diretório do projeto
cd /opt/statuspage

# Atualizar código do GitHub
echo "📥 Pulling latest code..."
git fetch --all
git reset --hard origin/master

# Executar migrações do banco
echo "🗄️ Running database migrations..."
psql -U postgres -d statuspage -f /opt/statuspage/backend/database/migrations/001_add_incident_fields.sql || echo "Migration already applied or failed"
psql -U postgres -d statuspage -f /opt/statuspage/backend/database/migration_display_mode.sql || echo "Display mode migration already applied or failed"
psql -U postgres -d statuspage -f /opt/statuspage/backend/database/migration_uptime_logs.sql || echo "Uptime logs migration already applied or failed"

# Rebuild Backend
echo "🔨 Building backend..."
cd backend
go mod download
go build -o statuspage main.go
sudo systemctl restart statuspage-backend

# Rebuild Frontend - Public Page
echo "🔨 Building public page..."
cd /opt/statuspage/frontend/public-page
npm install --legacy-peer-deps
npm run build

# Rebuild Frontend - Backoffice
echo "🔨 Building backoffice..."
cd /opt/statuspage/frontend/backoffice
npm install --legacy-peer-deps
npm run build

# Restart Nginx
echo "🔄 Restarting nginx..."
sudo systemctl restart nginx

echo "✅ Deploy complete!"
echo "🌐 Public Page: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
echo "🔐 Backoffice: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)/admin"
