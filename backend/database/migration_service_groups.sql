-- Create service_groups table to group multiple services into one display
CREATE TABLE IF NOT EXISTS service_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create service_group_members table to link services to groups
CREATE TABLE IF NOT EXISTS service_group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES service_groups(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, service_id)
);

-- Create indexes
CREATE INDEX idx_service_group_members_group ON service_group_members(group_id);
CREATE INDEX idx_service_group_members_service ON service_group_members(service_id);

-- Insert LIGHTHOUSE group
INSERT INTO service_groups (name, display_name, description, is_active) 
VALUES ('lighthouse', 'LIGHTHOUSE', 'Agrupamento de serviços críticos do Lighthouse', true)
ON CONFLICT (name) DO NOTHING;

-- Link services to LIGHTHOUSE group (you'll need to update service names to match your actual service names)
-- This is a template - adjust service names as needed
INSERT INTO service_group_members (group_id, service_id)
SELECT 
    (SELECT id FROM service_groups WHERE name = 'lighthouse'),
    s.id
FROM services s
WHERE s.name IN ('LOGIN', 'WEBSOCKET', 'LAKE', 'LIGHTHOUSE-BACKEND', 'DATA', 'NLB - KONG', 'AUTH')
ON CONFLICT (group_id, service_id) DO NOTHING;
