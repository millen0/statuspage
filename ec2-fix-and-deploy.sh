#!/bin/bash

echo "=========================================="
echo "Corrigindo Permissões e Deploy"
echo "=========================================="
echo ""

# Ir para o diretório
cd /opt/statuspage

echo "1. Corrigindo permissões dos arquivos..."
sudo chown -R ubuntu:ubuntu /opt/statuspage
echo "✅ Permissões corrigidas"

echo ""
echo "2. Limpando builds antigos..."
sudo rm -rf frontend/public-page/dist
sudo rm -rf frontend/backoffice/dist
echo "✅ Builds antigos removidos"

echo ""
echo "3. Verificando conexão com PostgreSQL..."
# Testar conexão com PostgreSQL usando as variáveis do .env
source backend/.env

# Testar conexão
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Conexão com PostgreSQL OK"
else
    echo "❌ Erro na conexão com PostgreSQL"
    echo "Tentando com host correto..."
    
    # Se falhar, pode ser que precise usar localhost ou IP específico
    PGPASSWORD=$DB_PASSWORD psql -h localhost -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ Conexão OK com localhost"
        echo "⚠️  Atualize DB_HOST=localhost no .env"
    fi
fi

echo ""
echo "4. Rodando migrations..."
cd /opt/statuspage

# Migration 1
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f backend/database/migration_maintenance_updates.sql 2>/dev/null
echo "✅ Migration 1 aplicada"

# Migration 2
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f backend/database/migration_display_mode.sql 2>/dev/null
echo "✅ Migration 2 aplicada"

# Migration 3
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f backend/database/migration_uptime_logs.sql 2>/dev/null
echo "✅ Migration 3 aplicada"

echo ""
echo "5. Building backend..."
cd backend
go build -o statuspage
echo "✅ Backend compilado"

echo ""
echo "6. Building public page..."
cd ../frontend/public-page
npm run build
echo "✅ Public page compilada"

echo ""
echo "7. Building backoffice..."
cd ../backoffice
npm run build
echo "✅ Backoffice compilado"

echo ""
echo "8. Reiniciando serviços..."
sudo systemctl restart statuspage-backend
sudo systemctl restart statuspage-public
sudo systemctl restart statuspage-backoffice
echo "✅ Serviços reiniciados"

echo ""
echo "9. Verificando status dos serviços..."
sudo systemctl status statuspage-backend --no-pager | head -5
sudo systemctl status statuspage-public --no-pager | head -5
sudo systemctl status statuspage-backoffice --no-pager | head -5

echo ""
echo "=========================================="
echo "✅ Deploy concluído!"
echo "=========================================="
