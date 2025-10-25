-- Migration: Update MagnumStream from 8-slot to 5-slot structure
-- This migration updates the slot structure to match the DaVinci template
-- From: 3 cruising + 3 chase + 2 arrival (8 slots)
-- To: 2 cruising + 2 chase + 1 arrival (5 slots)

-- ===========================================================================
-- BACKUP EXISTING DATA (IMPORTANT: Run this first!)
-- ===========================================================================

-- Create backup tables before making changes
CREATE TABLE video_slots_backup AS SELECT * FROM video_slots;
CREATE TABLE generated_clips_backup AS SELECT * FROM generated_clips;
CREATE TABLE project_templates_backup AS SELECT * FROM project_templates;

-- ===========================================================================
-- UPDATE DATABASE CONSTRAINTS
-- ===========================================================================

-- Update video_slots table constraints (1-8 to 1-5)
ALTER TABLE video_slots DROP CONSTRAINT IF EXISTS chk_slot_number;
ALTER TABLE video_slots ADD CONSTRAINT chk_slot_number CHECK (slot_number >= 1 AND slot_number <= 5);

-- Update generated_clips table constraints (1-8 to 1-5)  
ALTER TABLE generated_clips DROP CONSTRAINT IF EXISTS chk_slot_number;
ALTER TABLE generated_clips ADD CONSTRAINT chk_slot_number CHECK (slot_number >= 1 AND slot_number <= 5);

-- ===========================================================================
-- UPDATE PROJECT TEMPLATES
-- ===========================================================================

-- Update the default project template to use 5-slot configuration
UPDATE project_templates 
SET 
    name = 'DaVinci Compatible Flight Video',
    description = '5-slot configuration matching DaVinci template (2 cruising + 2 chase + 1 arrival)',
    slot_configuration = '[
        {"slotNumber": 1, "sceneType": "cruising", "cameraAngle": 1, "color": "#FF6B35"},
        {"slotNumber": 2, "sceneType": "cruising", "cameraAngle": 2, "color": "#F7931E"},
        {"slotNumber": 3, "sceneType": "chase", "cameraAngle": 2, "color": "#FFA500"},
        {"slotNumber": 4, "sceneType": "chase", "cameraAngle": 2, "color": "#FF9E3D"},
        {"slotNumber": 5, "sceneType": "arrival", "cameraAngle": 2, "color": "#FF7A3D"}
    ]'::jsonb
WHERE is_default = true;

-- ===========================================================================
-- MIGRATE EXISTING SLOT DATA (OPTIONAL - CAREFUL!)
-- ===========================================================================

-- WARNING: This section migrates existing 8-slot data to 5-slot structure
-- Only run this if you have existing projects you want to preserve
-- Otherwise, you can skip this section and start fresh

-- Map existing 8-slot data to new 5-slot structure:
-- Old slots 1,2,3 (cruising) -> New slots 1,2 (keep first 2)
-- Old slots 4,5,6 (chase) -> New slots 3,4 (keep first 2) 
-- Old slots 7,8 (arrival) -> New slot 5 (keep first 1)

/*
-- Uncomment this section if you want to migrate existing data:

-- Step 1: Create temporary mapping table
CREATE TEMP TABLE slot_mapping (
    old_slot INTEGER,
    new_slot INTEGER,
    action TEXT
);

INSERT INTO slot_mapping VALUES
    (1, 1, 'keep'),     -- cruising cam 1 -> slot 1
    (2, 2, 'keep'),     -- cruising cam 2 -> slot 2  
    (3, NULL, 'delete'), -- cruising cam 1 -> delete (extra)
    (4, 3, 'remap'),    -- chase cam 1 -> slot 3 (now cam 2)
    (5, 4, 'keep'),     -- chase cam 2 -> slot 4
    (6, NULL, 'delete'), -- chase cam 1 -> delete (extra)
    (7, 5, 'remap'),    -- arrival cam 1 -> slot 5 (now cam 2)
    (8, NULL, 'delete'); -- arrival cam 2 -> delete (extra)

-- Step 2: Delete slots that don't map to new structure
DELETE FROM video_slots 
WHERE slot_number IN (SELECT old_slot FROM slot_mapping WHERE action = 'delete');

DELETE FROM generated_clips 
WHERE slot_number IN (SELECT old_slot FROM slot_mapping WHERE action = 'delete');

-- Step 3: Update remaining slots to new positions
UPDATE video_slots 
SET slot_number = sm.new_slot,
    camera_angle = CASE 
        WHEN sm.action = 'remap' THEN 2  -- Change camera 1 to camera 2 for chase/arrival
        ELSE camera_angle 
    END
FROM slot_mapping sm 
WHERE video_slots.slot_number = sm.old_slot 
    AND sm.action IN ('keep', 'remap');

UPDATE generated_clips 
SET slot_number = sm.new_slot,
    camera_angle = CASE 
        WHEN sm.action = 'remap' THEN 2  -- Change camera 1 to camera 2 for chase/arrival
        ELSE camera_angle 
    END
FROM slot_mapping sm 
WHERE generated_clips.slot_number = sm.old_slot 
    AND sm.action IN ('keep', 'remap');
*/

-- ===========================================================================
-- UPDATE SCHEMA COMMENTS
-- ===========================================================================

COMMENT ON TABLE video_slots IS 'Final 5-slot video template configuration (updated from 8-slot)';
COMMENT ON COLUMN video_slots.slot_number IS 'Slot position 1-5 (updated from 1-8)';

-- ===========================================================================
-- VERIFICATION QUERIES
-- ===========================================================================

-- Run these queries to verify the migration:

-- Check constraint updates
SELECT conname, consrc 
FROM pg_constraint 
WHERE conrelid IN ('video_slots'::regclass, 'generated_clips'::regclass)
    AND conname LIKE '%slot_number%';

-- Check updated project template
SELECT name, description, jsonb_pretty(slot_configuration)
FROM project_templates 
WHERE is_default = true;

-- Check slot distribution in existing data
SELECT 
    slot_number,
    COUNT(*) as count,
    string_agg(DISTINCT recording_id, ', ') as recording_ids
FROM video_slots 
GROUP BY slot_number 
ORDER BY slot_number;

-- ===========================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ===========================================================================

/*
If you need to rollback this migration:

1. Restore from backup tables:
   DROP TABLE video_slots;
   CREATE TABLE video_slots AS SELECT * FROM video_slots_backup;
   -- (Add back all original constraints and indexes)

2. Restore project templates:
   UPDATE project_templates SET 
       slot_configuration = (SELECT slot_configuration FROM project_templates_backup WHERE is_default = true)
   WHERE is_default = true;

3. Clean up backup tables:
   DROP TABLE video_slots_backup;
   DROP TABLE generated_clips_backup; 
   DROP TABLE project_templates_backup;
*/

-- ===========================================================================
-- CLEANUP (run after verifying migration success)
-- ===========================================================================

-- Drop backup tables after confirming migration success
-- DROP TABLE video_slots_backup;
-- DROP TABLE generated_clips_backup;
-- DROP TABLE project_templates_backup;

-- Schema version update
INSERT INTO schema_version (version) VALUES (2)
ON CONFLICT (version) DO NOTHING;

SELECT 'Migration completed successfully! New 5-slot structure is active.' as result;