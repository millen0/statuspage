-- Inserir manutenção de 14-15 de Fevereiro de 2026
INSERT INTO maintenances (
    title, 
    description, 
    status, 
    scheduled_start, 
    scheduled_end,
    actual_start,
    actual_end,
    send_email,
    email_sent,
    created_at,
    updated_at
) VALUES (
    'Platform Maintenance - February 14-15, 2026',
    'Pier Cloud will be performing scheduled platform maintenance on February 14–15, 2026 (Saturday and Sunday).

During this time, the platform may be temporarily unavailable at certain moments while we apply important technical upgrades to core backend components.

This maintenance is part of our ongoing efforts to improve platform stability, performance, and scalability, preparing the environment for upcoming global integrations and product enhancements.

The chosen window falls during a low-usage period, minimizing any potential disruption to daily operations.

Once the maintenance is complete, no action will be required on your end — all services and integrations will automatically return to normal operation.',
    'completed',
    '2026-02-14 00:00:00 UTC',
    '2026-02-15 23:59:00 UTC',
    '2026-02-14 00:00:00 UTC',
    '2026-02-15 18:30:00 UTC',
    true,
    true,
    '2026-02-10 10:00:00 UTC',
    '2026-02-15 18:30:00 UTC'
) RETURNING id;

-- Obter o ID da manutenção criada (substitua <MAINTENANCE_ID> pelo ID retornado)
-- Para PostgreSQL, você pode usar uma CTE:

WITH new_maintenance AS (
    INSERT INTO maintenances (
        title, 
        description, 
        status, 
        scheduled_start, 
        scheduled_end,
        actual_start,
        actual_end,
        send_email,
        email_sent,
        created_at,
        updated_at
    ) VALUES (
        'Platform Maintenance - February 14-15, 2026',
        'Pier Cloud will be performing scheduled platform maintenance on February 14–15, 2026 (Saturday and Sunday).

During this time, the platform may be temporarily unavailable at certain moments while we apply important technical upgrades to core backend components.

This maintenance is part of our ongoing efforts to improve platform stability, performance, and scalability, preparing the environment for upcoming global integrations and product enhancements.

The chosen window falls during a low-usage period, minimizing any potential disruption to daily operations.

Once the maintenance is complete, no action will be required on your end — all services and integrations will automatically return to normal operation.',
        'completed',
        '2026-02-14 00:00:00 UTC',
        '2026-02-15 23:59:00 UTC',
        '2026-02-14 00:00:00 UTC',
        '2026-02-15 18:30:00 UTC',
        true,
        true,
        '2026-02-10 10:00:00 UTC',
        '2026-02-15 18:30:00 UTC'
    ) RETURNING id
)
-- Inserir os 3 updates na timeline
INSERT INTO maintenance_updates (maintenance_id, message, status, created_at)
SELECT 
    id,
    'We will be performing scheduled platform maintenance on February 14–15, 2026 (Saturday and Sunday) between 00:00 and 23:59 UTC. During this time, the platform may be temporarily unavailable at certain moments while we apply important technical upgrades to core backend components.',
    'scheduled',
    '2026-02-10 10:00:00 UTC'
FROM new_maintenance
UNION ALL
SELECT 
    id,
    'Scheduled maintenance is currently in progress. We are applying technical upgrades to core backend components. The platform may experience brief periods of unavailability. We will provide updates as necessary.',
    'in_progress',
    '2026-02-14 00:00:00 UTC'
FROM new_maintenance
UNION ALL
SELECT 
    id,
    'The scheduled maintenance has been completed successfully. All technical upgrades have been applied and all services are now fully operational. No action is required on your end — all integrations have automatically returned to normal operation.',
    'completed',
    '2026-02-15 18:30:00 UTC'
FROM new_maintenance;
