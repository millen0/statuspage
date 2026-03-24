-- Migration: Add maintenance_updates table
-- Date: 2026-01-27

CREATE TABLE IF NOT EXISTS maintenance_updates (
    id SERIAL PRIMARY KEY,
    maintenance_id INTEGER REFERENCES maintenances(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_maintenance_updates_maintenance ON maintenance_updates(maintenance_id);
CREATE INDEX idx_maintenance_updates_created ON maintenance_updates(created_at DESC);
