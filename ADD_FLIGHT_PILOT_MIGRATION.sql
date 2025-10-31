-- Migration: Add flight_pilot column to flight_recordings table
-- Date: 2025-10-31
-- Description: Separates actual pilot name from customer names
-- pilot_name continues to store customer names (e.g., "Emily & John")
-- flight_pilot stores the actual pilot who flew the aircraft (optional)

-- Add the flight_pilot column
ALTER TABLE flight_recordings
ADD COLUMN IF NOT EXISTS flight_pilot TEXT;

-- Add an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_flight_recordings_flight_pilot
ON flight_recordings(flight_pilot)
WHERE flight_pilot IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN flight_recordings.flight_pilot IS 'Actual pilot who flew the aircraft (optional, from FlightMetadataDialog dropdown)';
COMMENT ON COLUMN flight_recordings.pilot_name IS 'Customer names who took the flight (e.g., "Emily & John")';
