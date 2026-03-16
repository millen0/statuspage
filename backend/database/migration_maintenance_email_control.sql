-- Add email control to maintenances
ALTER TABLE maintenances ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT false;
ALTER TABLE maintenances ADD COLUMN IF NOT EXISTS send_email BOOLEAN DEFAULT false;
