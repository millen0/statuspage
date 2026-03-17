#!/bin/bash
# Script para verificar logs de email no backend
# Execute na EC2: bash check-email-logs.sh

echo "=========================================="
echo "📋 VERIFICANDO LOGS DE EMAIL"
echo "=========================================="
echo ""

# 1. Verificar se o backend está rodando
echo "1️⃣ Verificando se o backend está rodando..."
if pgrep -f "statuspage" > /dev/null; then
    echo "   ✅ Backend está rodando"
    ps aux | grep statuspage | grep -v grep
else
    echo "   ❌ Backend NÃO está rodando!"
fi
echo ""

# 2. Verificar logs do systemd (se estiver usando)
echo "2️⃣ Verificando logs do systemd..."
if systemctl list-units | grep -q statuspage; then
    echo "   Últimas 20 linhas com 'EMAIL':"
    sudo journalctl -u statuspage-backend -n 100 | grep -i email | tail -20
else
    echo "   ⚠️  Serviço systemd não encontrado"
fi
echo ""

# 3. Verificar logs em arquivos
echo "3️⃣ Verificando arquivos de log..."
LOG_LOCATIONS=(
    "/var/log/statuspage/backend.log"
    "/opt/statuspage/backend.log"
    "/opt/statuspage/logs/backend.log"
    "backend.log"
)

for log_file in "${LOG_LOCATIONS[@]}"; do
    if [ -f "$log_file" ]; then
        echo "   📄 Encontrado: $log_file"
        echo "   Últimas linhas com 'EMAIL':"
        tail -100 "$log_file" | grep -i email | tail -10
        echo ""
    fi
done

# 4. Verificar configurações SMTP no .env
echo "4️⃣ Verificando configurações SMTP..."
ENV_LOCATIONS=(
    "/opt/statuspage/backend/.env"
    "backend/.env"
)

for env_file in "${ENV_LOCATIONS[@]}"; do
    if [ -f "$env_file" ]; then
        echo "   📄 Arquivo: $env_file"
        echo "   SMTP_HOST: $(grep SMTP_HOST $env_file | cut -d'=' -f2)"
        echo "   SMTP_PORT: $(grep SMTP_PORT $env_file | cut -d'=' -f2)"
        echo "   SMTP_USERNAME: $(grep SMTP_USERNAME $env_file | cut -d'=' -f2)"
        echo "   SES_FROM_EMAIL: $(grep SES_FROM_EMAIL $env_file | cut -d'=' -f2)"
        echo "   SMTP_PASSWORD: $(grep SMTP_PASSWORD $env_file | cut -d'=' -f2 | sed 's/./*/g')"
        echo ""
    fi
done

# 5. Verificar última manutenção no banco
echo "5️⃣ Verificando última manutenção no banco..."
if command -v psql &> /dev/null; then
    DB_HOST=$(grep DB_HOST /opt/statuspage/backend/.env 2>/dev/null | cut -d'=' -f2)
    DB_USER=$(grep DB_USER /opt/statuspage/backend/.env 2>/dev/null | cut -d'=' -f2)
    DB_NAME=$(grep DB_NAME /opt/statuspage/backend/.env 2>/dev/null | cut -d'=' -f2)
    
    if [ ! -z "$DB_HOST" ]; then
        echo "   Conectando em: $DB_HOST"
        PGPASSWORD=$(grep DB_PASSWORD /opt/statuspage/backend/.env | cut -d'=' -f2) psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "
            SELECT id, title, send_email, email_sent, 
                   TO_CHAR(email_scheduled_time, 'YYYY-MM-DD HH24:MI:SS') as email_time,
                   TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created
            FROM maintenances 
            ORDER BY created_at DESC 
            LIMIT 3;
        " 2>/dev/null || echo "   ⚠️  Não foi possível conectar no banco"
    fi
else
    echo "   ⚠️  psql não instalado"
fi
echo ""

# 6. Verificar cron jobs de email
echo "6️⃣ Verificando cron jobs..."
crontab -l 2>/dev/null | grep -i "email\|maintenance" || echo "   ⚠️  Nenhum cron job encontrado"
echo ""

echo "=========================================="
echo "✅ Verificação concluída!"
echo "=========================================="
