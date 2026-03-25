#!/bin/bash

echo "=========================================="
echo "Diagnóstico de Email - EC2"
echo "=========================================="
echo ""

# Carregar variáveis do .env
if [ -f /opt/statuspage/backend/.env ]; then
    source /opt/statuspage/backend/.env
    echo "✅ .env carregado de /opt/statuspage/backend/.env"
else
    echo "❌ .env não encontrado"
    exit 1
fi

echo ""
echo "1. Verificando configuração SMTP:"
echo "   SMTP_HOST: ${SMTP_HOST:-❌ NÃO CONFIGURADO}"
echo "   SMTP_PORT: ${SMTP_PORT:-❌ NÃO CONFIGURADO}"
echo "   SMTP_USERNAME: ${SMTP_USERNAME:-❌ NÃO CONFIGURADO}"
echo "   SMTP_PASSWORD: ${SMTP_PASSWORD:+✅ CONFIGURADO}${SMTP_PASSWORD:-❌ NÃO CONFIGURADO}"
echo "   SES_FROM_EMAIL: ${SES_FROM_EMAIL:-❌ NÃO CONFIGURADO}"
echo ""

echo "2. Verificando manutenções com 'Test' no título:"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << EOF
SELECT 
    id,
    title,
    TO_CHAR(scheduled_start, 'YYYY-MM-DD HH24:MI:SS') as start,
    TO_CHAR(scheduled_end, 'YYYY-MM-DD HH24:MI:SS') as end_time,
    TO_CHAR(email_scheduled_time, 'YYYY-MM-DD HH24:MI:SS') as email_time,
    email_sent,
    send_email,
    status
FROM maintenances
WHERE title LIKE '%Test%'
ORDER BY created_at DESC
LIMIT 5;
EOF

echo ""
echo "3. Verificando subscribers ativos:"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << EOF
SELECT COUNT(*) as total_subscribers, 
       SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_subscribers
FROM subscribers;
EOF

echo ""
echo "4. Verificando cron job de envio de emails:"
sudo crontab -l 2>/dev/null | grep "send-scheduled-maintenance-emails" || echo "❌ Cron job NÃO encontrado"

echo ""
echo "5. Testando execução manual do script de email:"
if [ -f /opt/statuspage/send-scheduled-maintenance-emails.py ]; then
    echo "✅ Script encontrado"
    echo "Executando teste..."
    cd /opt/statuspage && python3 send-scheduled-maintenance-emails.py
else
    echo "❌ Script NÃO encontrado em /opt/statuspage/"
fi

echo ""
echo "=========================================="
echo "Diagnóstico completo!"
echo "=========================================="
