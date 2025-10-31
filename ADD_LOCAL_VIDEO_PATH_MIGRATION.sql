-- Migration: Add local_video_path column to flight_recordings table
-- Date: 2025-10-31
-- Description: Stores local file path of rendered video on Mac for direct playback

-- Add the local_video_path column
ALTER TABLE flight_recordings
ADD COLUMN IF NOT EXISTS local_video_path TEXT;

-- Add an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_flight_recordings_local_video_path
ON flight_recordings(local_video_path)
WHERE local_video_path IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN flight_recordings.local_video_path IS 'Local file path of rendered video on Mac (e.g., /Users/magnummedia/MagnumStream/rendered/2025/10-October/31/CustomerName/video.mov)';
