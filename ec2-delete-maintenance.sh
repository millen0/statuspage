#!/bin/bash

echo "=========================================="
echo "Deletar Manutenção de Teste"
echo "=========================================="
echo ""

# Carregar variáveis do .env
if [ -f /opt/statuspage/backend/.env ]; then
    source /opt/statuspage/backend/.env
else
    echo "❌ .env não encontrado"
    exit 1
fi

echo "Buscando manutenções com 'Test' no título:"
echo ""

PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << EOF
SELECT 
    id,
    title,
    TO_CHAR(scheduled_start, 'YYYY-MM-DD HH24:MI:SS') as start,
    TO_CHAR(scheduled_end, 'YYYY-MM-DD HH24:MI:SS') as end_time,
    status
FROM maintenances
WHERE title LIKE '%Test%'
ORDER BY created_at DESC;
EOF

echo ""
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
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << EOF
DELETE FROM maintenances WHERE id = $MAINT_ID;
EOF
    echo ""
    echo "✅ Manutenção deletada com sucesso!"
else
    echo "❌ Operação cancelada"
fi
