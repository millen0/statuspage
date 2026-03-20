-- Script para popular histórico de downtime do dia 15/02/2025
-- Baseado nos alertas do Slack sobre indisponibilidade

-- Primeiro, vamos identificar o service_id do Lighthouse-Backend
-- Execute este comando para ver os IDs dos serviços:
-- SELECT id, name FROM services WHERE name ILIKE '%lighthouse%';

-- Assumindo que o Lighthouse-Backend tem um service_id específico
-- Vamos inserir/atualizar o registro de uptime para 15/02/2025

-- Exemplo: Se o serviço ficou indisponível por 2 horas em um dia de 24 horas
-- Uptime = ((24 - 2) / 24) * 100 = 91.67%

-- Para Lighthouse-Backend (ajuste o service_id conforme necessário)
INSERT INTO uptime_logs (service_id, date, uptime_percentage)
VALUES (
    (SELECT id FROM services WHERE name ILIKE '%lighthouse-backend%' LIMIT 1),
    '2025-02-15',
    0.00  -- 0% se ficou completamente indisponível, ajuste conforme necessário
)
ON CONFLICT (service_id, date) 
DO UPDATE SET 
    uptime_percentage = EXCLUDED.uptime_percentage,
    created_at = CURRENT_TIMESTAMP;

-- Se você souber a duração exata do downtime, calcule:
-- Exemplo: 30 minutos de downtime em 1440 minutos (24h)
-- uptime_percentage = ((1440 - 30) / 1440) * 100 = 97.92%

-- Para múltiplos serviços afetados, repita o INSERT para cada um:
-- INSERT INTO uptime_logs (service_id, date, uptime_percentage)
-- VALUES (
--     (SELECT id FROM services WHERE name = 'OUTRO_SERVICO'),
--     '2025-02-15',
--     95.00
-- )
-- ON CONFLICT (service_id, date) 
-- DO UPDATE SET uptime_percentage = EXCLUDED.uptime_percentage;

-- Verificar os registros inseridos:
SELECT 
    s.name,
    ul.date,
    ul.uptime_percentage,
    ul.created_at
FROM uptime_logs ul
JOIN services s ON s.id = ul.service_id
WHERE ul.date = '2025-02-15'
ORDER BY s.name;
