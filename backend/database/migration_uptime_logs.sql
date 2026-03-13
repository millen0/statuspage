-- Create service_uptime_logs table to track daily uptime
CREATE TABLE IF NOT EXISTS service_uptime_logs (
    id SERIAL PRIMARY KEY,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status VARCHAR(50) NOT NULL,
    uptime_percentage DECIMAL(5,2) DEFAULT 100.00,
    total_checks INTEGER DEFAULT 0,
    successful_checks INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(service_id, date)
);

CREATE INDEX idx_uptime_logs_service_date ON service_uptime_logs(service_id, date DESC);
CREATE INDEX idx_uptime_logs_date ON service_uptime_logs(date DESC);
