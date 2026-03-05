-- Add display_mode configuration table
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default display mode (classic = antigo)
INSERT INTO settings (key, value) VALUES ('display_mode', 'classic')
ON CONFLICT (key) DO NOTHING;
