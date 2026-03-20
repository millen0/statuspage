# Popular Histórico de Downtime

Este guia explica como popular o histórico de uptime com dados de downtimes passados (como o do dia 15/02/2025).

## Métodos Disponíveis

### Método 1: SQL Direto (Rápido)

Execute na EC2:

```bash
cd /opt/statuspage
source backend/.env

# Popular o downtime do dia 15/02/2025
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME << 'EOF'
-- Inserir downtime para Lighthouse-Backend
INSERT INTO uptime_logs (service_id, date, uptime_percentage)
VALUES (
    (SELECT id FROM services WHERE name ILIKE '%lighthouse-backend%' LIMIT 1),
    '2025-02-15',
    91.67  -- Ajuste conforme a duração real do downtime
)
ON CONFLICT (service_id, date) 
DO UPDATE SET 
    uptime_percentage = LEAST(uptime_logs.uptime_percentage, EXCLUDED.uptime_percentage);
EOF
```

### Método 2: Script Python (Recomendado)

O script Python permite popular múltiplos downtimes de uma vez e calcula automaticamente o uptime percentage.

```bash
cd /opt/statuspage
source backend/.env

# Popular histórico
python3 populate-downtime-from-alerts.py --populate

# Verificar logs inseridos
python3 populate-downtime-from-alerts.py --verify 2025-02-15

# Ver todos os downtimes registrados
python3 populate-downtime-from-alerts.py --verify
```

## Como Calcular Uptime Percentage

```
Uptime % = ((Total Minutos - Downtime Minutos) / Total Minutos) * 100
```

**Exemplos:**
- 30 minutos de downtime: `((1440 - 30) / 1440) * 100 = 97.92%`
- 1 hora de downtime: `((1440 - 60) / 1440) * 100 = 95.83%`
- 2 horas de downtime: `((1440 - 120) / 1440) * 100 = 91.67%`
- Completamente indisponível: `0%`

## Adicionar Mais Downtimes

Edite o arquivo `populate-downtime-from-alerts.py` e adicione na lista `downtimes`:

```python
downtimes = [
    ('lighthouse-backend', '2025-02-15', 120, 'Request failed with status code 503'),
    ('outro-servico', '2025-02-15', 30, 'Descrição do problema'),
    # Adicione mais aqui
]
```

## Cores no Tooltip

O sistema automaticamente define as cores baseado no uptime:
- 🔴 **Vermelho (Outage)**: < 50%
- 🟡 **Amarelo (Degraded)**: 50% - 98.99%
- 🟢 **Verde (Operational)**: ≥ 99%

## Verificar Resultado

Após popular, acesse:
- https://status.piercloud.com/
- Passe o mouse sobre a barra do dia 15/02/2025
- O tooltip mostrará o downtime e a porcentagem de uptime

## Notas Importantes

1. **Merge Automático**: Se já existir um registro para a data, o sistema mantém o MENOR uptime (pior cenário)
2. **Histórico de 90 dias**: O frontend mostra apenas os últimos 91 dias
3. **Cache**: O frontend implementa cache para preservar o histórico durante a navegação
