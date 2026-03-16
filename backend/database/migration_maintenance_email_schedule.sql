-- Add scheduled email send time
ALTER TABLE maintenances ADD COLUMN IF NOT EXISTS email_scheduled_time TIMESTAMP;
