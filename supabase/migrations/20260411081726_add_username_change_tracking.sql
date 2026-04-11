-- Add username change tracking fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS username_last_changed TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS username_change_count INTEGER DEFAULT 0;
