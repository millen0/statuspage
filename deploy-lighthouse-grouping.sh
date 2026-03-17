#!/bin/bash
# Script de deploy para EC2 - Atualização de Agrupamento de Serviços

set -e

echo "=========================================="
echo "🚀 DEPLOY - Agrupamento LIGHTHOUSE"
echo "=========================================="
echo ""

# 1. Aplicar migrations no banco
echo "1️⃣ Aplicando migrations no banco de dados..."
cd /opt/statuspage

# Carregar variáveis de ambiente
source backend/.env

# Aplicar migration de grupos
echo "   Criando tabelas de agrupamento..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f backend/database/migration_service_groups.sql

if [ $? -eq 0 ]; then
    echo "   ✅ Migration aplicada com sucesso"
else
    echo "   ❌ Erro ao aplicar migration"
    exit 1
fi

echo ""

# 2. Verificar serviços que serão agrupados
echo "2️⃣ Verificando serviços para agrupamento..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT s.id, s.name, s.is_visible, s.status
FROM services s
WHERE s.name IN ('LOGIN', 'WEBSOCKET', 'LAKE', 'LIGHTHOUSE-BACKEND', 'DATA', 'NLB - KONG', 'AUTH')
ORDER BY s.name;
"

echo ""

# 3. Recompilar backend Go
echo "3️⃣ Recompilando backend Go..."
cd /opt/statuspage/backend
go build -o statuspage

if [ $? -eq 0 ]; then
    echo "   ✅ Backend compilado com sucesso"
else
    echo "   ❌ Erro ao compilar backend"
    exit 1
fi

echo ""

# 4. Reiniciar backend
echo "4️⃣ Reiniciando backend..."
sudo systemctl restart statuspage-backend
sleep 3

if systemctl is-active --quiet statuspage-backend; then
    echo "   ✅ Backend reiniciado com sucesso"
else
    echo "   ❌ Erro ao reiniciar backend"
    sudo journalctl -u statuspage-backend -n 20
    exit 1
fi

echo ""

# 5. Executar cálculo inicial de uptime do grupo
echo "5️⃣ Calculando uptime inicial do grupo LIGHTHOUSE..."
cd /opt/statuspage
python3 update-group-uptime.py

if [ $? -eq 0 ]; then
    echo "   ✅ Uptime calculado com sucesso"
else
    echo "   ⚠️  Erro ao calcular uptime (pode ser normal se não houver dados históricos)"
fi

echo ""

# 6. Configurar cron job para atualização diária
echo "6️⃣ Configurando cron job para atualização diária..."

# Verificar se já existe
if crontab -l 2>/dev/null | grep -q "update-group-uptime.py"; then
    echo "   ℹ️  Cron job já existe"
else
    # Adicionar cron job (executa às 23:55 todos os dias)
    (crontab -l 2>/dev/null; echo "55 23 * * * cd /opt/statuspage && /usr/bin/python3 update-group-uptime.py >> /var/log/statuspage/group-uptime.log 2>&1") | crontab -
    echo "   ✅ Cron job adicionado (executa às 23:55 diariamente)"
fi

echo ""

# 7. Rebuild frontend (se necessário)
echo "7️⃣ Verificando frontend..."
if [ -d "/opt/statuspage/frontend/public-page" ]; then
    echo "   ℹ️  Frontend encontrado"
    # Não precisa rebuild se não mudou o código do frontend
    echo "   ✅ Frontend OK (sem alterações necessárias)"
else
    echo "   ⚠️  Diretório do frontend não encontrado"
fi

echo ""

# 8. Verificar status final
echo "8️⃣ Verificando status final..."
echo ""
echo "   Backend:"
systemctl status statuspage-backend --no-pager | head -5

echo ""
echo "   Grupo LIGHTHOUSE:"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT 
    sg.display_name,
    COUNT(sgm.service_id) as total_services,
    COUNT(CASE WHEN s.is_visible THEN 1 END) as visible_services,
    COUNT(CASE WHEN NOT s.is_visible THEN 1 END) as hidden_services
FROM service_groups sg
LEFT JOIN service_group_members sgm ON sg.id = sgm.group_id
LEFT JOIN services s ON sgm.service_id = s.id
WHERE sg.name = 'lighthouse'
GROUP BY sg.display_name;
"

echo ""
echo "   Últimos logs de uptime do grupo:"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT date, status, uptime_percentage
FROM service_uptime_logs
WHERE service_id < 0
ORDER BY date DESC
LIMIT 7;
"

echo ""
echo "=========================================="
echo "✅ DEPLOY CONCLUÍDO!"
echo "=========================================="
echo ""
echo "📋 Próximos passos:"
echo "   1. Acesse a página pública e verifique se o LIGHTHOUSE aparece"
echo "   2. Verifique os logs: tail -f /var/log/statuspage/group-uptime.log"
echo "   3. Teste manualmente: python3 update-group-uptime.py"
echo ""
