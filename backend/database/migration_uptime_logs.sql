-- Migration: Create uptime_logs table
-- Description: Stores daily uptime percentage for each service

CREATE TABLE IF NOT EXISTS uptime_logs (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL,
    date DATE NOT NULL,
    uptime_percentage DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(service_id, date)
);

CREATE INDEX IF NOT EXISTS idx_uptime_logs_service_date ON uptime_logs(service_id, date);
CREATE INDEX IF NOT EXISTS idx_uptime_logs_date ON uptime_logs(date);

COMMENT ON TABLE uptime_logs IS 'Daily uptime percentage logs for services and service groups';
COMMENT ON COLUMN uptime_logs.service_id IS 'Service ID (positive for real services, negative for service groups)';
COMMENT ON COLUMN uptime_logs.date IS 'Date of the uptime log';
COMMENT ON COLUMN uptime_logs.uptime_percentage IS 'Uptime percentage for the day (0-100)';
