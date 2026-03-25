#!/bin/bash

# Script para adicionar manutenção de Fevereiro 2026
# Uso: ./add-feb-maintenance.sh

set -e

echo "🔧 Adicionando manutenção de Fevereiro 2026..."

# Verificar se o arquivo SQL existe
if [ ! -f "add_feb_maintenance.sql" ]; then
    echo "❌ Erro: arquivo add_feb_maintenance.sql não encontrado"
    exit 1
fi

# Carregar variáveis de ambiente
if [ -f "backend/.env" ]; then
    export $(grep -v '^#' backend/.env | xargs)
fi

# Executar SQL no PostgreSQL
if command -v docker &> /dev/null && docker ps | grep -q postgres; then
    echo "📦 Usando Docker para executar SQL..."
    docker exec -i $(docker ps -q -f name=postgres) psql -U statuspage -d statuspage < add_feb_maintenance.sql
elif command -v psql &> /dev/null; then
    echo "🐘 Usando psql local..."
    psql -U statuspage -d statuspage < add_feb_maintenance.sql
else
    echo "❌ Erro: PostgreSQL não encontrado (nem Docker nem psql)"
    exit 1
fi

echo "✅ Manutenção adicionada com sucesso!"
echo ""
echo "📋 Detalhes:"
echo "   Título: Platform Maintenance - February 14-15, 2026"
echo "   Status: completed"
echo "   Período: 14-15 de Fevereiro de 2026"
echo "   Updates: 3 (scheduled → in_progress → completed)"
echo ""
echo "🌐 Acesse: https://status.piercloud.com/maintenance-history"
