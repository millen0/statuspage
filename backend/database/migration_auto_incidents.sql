-- Add auto_generated flag and uptime_date to incidents table
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT false;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS uptime_date DATE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_incidents_uptime_date ON incidents(uptime_date);
CREATE INDEX IF NOT EXISTS idx_incidents_auto_generated ON incidents(auto_generated);
