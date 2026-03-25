#!/bin/bash

# Carregar variáveis do .env
source backend/.env

echo "=========================================="
echo "Diagnóstico de Email - Manutenções"
echo "=========================================="
echo ""

echo "1. Verificando configuração SMTP no .env:"
echo "   SMTP_HOST: ${SMTP_HOST:-❌ NÃO CONFIGURADO}"
echo "   SMTP_PORT: ${SMTP_PORT:-❌ NÃO CONFIGURADO}"
echo "   SMTP_USERNAME: ${SMTP_USERNAME:-❌ NÃO CONFIGURADO}"
echo "   SMTP_PASSWORD: ${SMTP_PASSWORD:+✅ CONFIGURADO}"
echo "   SES_FROM_EMAIL: ${SES_FROM_EMAIL:-❌ NÃO CONFIGURADO}"
echo ""

echo "2. Verificando manutenções com email pendente:"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT 
    id,
    title,
    scheduled_start,
    scheduled_end,
    email_scheduled_time,
    email_sent,
    send_email,
    CASE 
        WHEN email_scheduled_time IS NULL THEN '⚠️  Sem horário agendado'
        WHEN email_scheduled_time > NOW() THEN '⏰ Agendado para o futuro'
        WHEN email_scheduled_time <= NOW() AND email_sent = false THEN '❌ Deveria ter sido enviado'
        WHEN email_sent = true THEN '✅ Já enviado'
    END as status_email
FROM maintenances
WHERE title LIKE '%Test%'
ORDER BY created_at DESC
LIMIT 5;
"

echo ""
echo "3. Verificando subscribers ativos:"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT COUNT(*) as total_subscribers, 
       SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_subscribers
FROM subscribers;
"

echo ""
echo "4. Verificando cron job de envio de emails:"
crontab -l | grep "send-scheduled-maintenance-emails" || echo "❌ Cron job NÃO encontrado"

echo ""
echo "5. Verificando se o script existe:"
if [ -f "send-scheduled-maintenance-emails.py" ]; then
    echo "✅ Script encontrado: send-scheduled-maintenance-emails.py"
else
    echo "❌ Script NÃO encontrado"
fi

echo ""
echo "=========================================="
echo "Diagnóstico completo!"
echo "=========================================="
