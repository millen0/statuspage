#!/bin/bash

# Carregar variáveis do .env
source backend/.env

echo "=========================================="
echo "Verificando manutenções com 'Test' no título"
echo "=========================================="

# Buscar manutenções
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
SELECT id, title, scheduled_start, scheduled_end, email_scheduled_time, email_sent, send_email, status
FROM maintenances
WHERE title LIKE '%Test%'
ORDER BY created_at DESC
LIMIT 5;
"

echo ""
echo "=========================================="
echo "Digite o ID da manutenção para deletar (ou 'n' para cancelar):"
read -p "ID: " MAINT_ID

if [ "$MAINT_ID" = "n" ] || [ -z "$MAINT_ID" ]; then
    echo "❌ Operação cancelada"
    exit 0
fi

echo ""
echo "⚠️  Tem certeza que deseja deletar a manutenção ID $MAINT_ID? (s/n)"
read -p "Confirmar: " CONFIRM

if [ "$CONFIRM" = "s" ] || [ "$CONFIRM" = "S" ]; then
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
    DELETE FROM maintenances WHERE id = $MAINT_ID;
    "
    echo "✅ Manutenção deletada com sucesso!"
else
    echo "❌ Operação cancelada"
fi
