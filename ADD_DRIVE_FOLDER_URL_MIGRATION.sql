-- Migration: Add drive_folder_url column to flight_recordings table
-- Date: 2025-10-30
-- Description: Adds support for storing Google Drive folder URLs alongside file URLs

-- Add the drive_folder_url column to flight_recordings table
ALTER TABLE flight_recordings
ADD COLUMN IF NOT EXISTS drive_folder_url TEXT;

-- Add an index for faster lookups when querying by drive_folder_url
CREATE INDEX IF NOT EXISTS idx_flight_recordings_drive_folder_url
ON flight_recordings(drive_folder_url)
WHERE drive_folder_url IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN flight_recordings.drive_folder_url IS 'Google Drive folder URL for the exported video folder';

-- Update schema version
INSERT INTO schema_version (version) VALUES (2)
ON CONFLICT (version) DO NOTHING;
