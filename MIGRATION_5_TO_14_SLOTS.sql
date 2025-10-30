-- Migration: Update MagnumStream from 8-slot to 14-slot structure
-- This migration updates the slot structure to match the actual DaVinci template
-- From: 8 slots (previous configuration)
-- To: 7 cruising + 6 chase + 1 arrival (14 slots)

-- ===========================================================================
-- BACKGROUND
-- ===========================================================================
-- DaVinci template (MAG_FERRARI) has 14 clips on Video Track 3:
-- - Cruising Scene: 7 clips (slots 1-7)
-- - Chase Scene: 6 clips (slots 8-13)
-- - Arrival Scene: 1 clip (slot 14)
--
-- Seamless cut pairs (adjacent clips with no gap):
-- - Slot 2 → 3 (Cruising: Front → Side)
-- - Slot 4 → 5 (Cruising: Front → Side)
-- - Slot 8 → 9 (Chase: Front → Side)
-- - Slot 11 → 12 (Chase: Front → Side)

-- ===========================================================================
-- BACKUP EXISTING DATA (IMPORTANT: Run this first!)
-- ===========================================================================

-- Create backup tables before making changes
CREATE TABLE IF NOT EXISTS video_slots_backup_14 AS SELECT * FROM video_slots;
CREATE TABLE IF NOT EXISTS generated_clips_backup_14 AS SELECT * FROM generated_clips;

-- ===========================================================================
-- UPDATE DATABASE CONSTRAINTS
-- ===========================================================================

-- Update video_slots table constraints (1-8 to 1-14)
ALTER TABLE video_slots DROP CONSTRAINT IF EXISTS chk_slot_number;
ALTER TABLE video_slots ADD CONSTRAINT chk_slot_number CHECK (slot_number >= 1 AND slot_number <= 14);

-- Update generated_clips table constraints (1-8 to 1-14)
ALTER TABLE generated_clips DROP CONSTRAINT IF EXISTS chk_slot_number;
ALTER TABLE generated_clips ADD CONSTRAINT chk_slot_number CHECK (slot_number >= 1 AND slot_number <= 14);

-- ===========================================================================
-- CLEAR EXISTING SLOT DATA
-- ===========================================================================

-- WARNING: This will delete all existing slot selections
-- The 8-slot system cannot be directly migrated to 14-slot system
-- Users will need to re-select their slots with the new structure

DELETE FROM video_slots;
DELETE FROM generated_clips;

-- Also update project_templates table to reflect 14-slot configuration
UPDATE project_templates
SET
    name = 'DaVinci MAG_FERRARI Template',
    description = '14-slot configuration matching DaVinci MAG_FERRARI template (7 cruising + 6 chase + 1 arrival)',
    slot_configuration = '[
        {"slotNumber": 1, "sceneType": "cruising", "cameraAngle": 2, "color": "#FF6B35", "duration": 0.876, "seamlessCut": false},
        {"slotNumber": 2, "sceneType": "cruising", "cameraAngle": 2, "color": "#F7931E", "duration": 1.210, "seamlessCut": true},
        {"slotNumber": 3, "sceneType": "cruising", "cameraAngle": 1, "color": "#FFA500", "duration": 1.293, "seamlessCut": false},
        {"slotNumber": 4, "sceneType": "cruising", "cameraAngle": 2, "color": "#FF9E3D", "duration": 0.959, "seamlessCut": true},
        {"slotNumber": 5, "sceneType": "cruising", "cameraAngle": 1, "color": "#FF7A3D", "duration": 1.502, "seamlessCut": false},
        {"slotNumber": 6, "sceneType": "cruising", "cameraAngle": 2, "color": "#FF6B6B", "duration": 0.667, "seamlessCut": false},
        {"slotNumber": 7, "sceneType": "cruising", "cameraAngle": 1, "color": "#FFA07A", "duration": 0.793, "seamlessCut": false},
        {"slotNumber": 8, "sceneType": "chase", "cameraAngle": 2, "color": "#FFB347", "duration": 0.876, "seamlessCut": true},
        {"slotNumber": 9, "sceneType": "chase", "cameraAngle": 1, "color": "#FFCC00", "duration": 1.418, "seamlessCut": false},
        {"slotNumber": 10, "sceneType": "chase", "cameraAngle": 2, "color": "#FFD700", "duration": 0.542, "seamlessCut": false},
        {"slotNumber": 11, "sceneType": "chase", "cameraAngle": 2, "color": "#FFA500", "duration": 1.460, "seamlessCut": true},
        {"slotNumber": 12, "sceneType": "chase", "cameraAngle": 1, "color": "#FF8C00", "duration": 1.543, "seamlessCut": false},
        {"slotNumber": 13, "sceneType": "chase", "cameraAngle": 1, "color": "#FF7F50", "duration": 0.542, "seamlessCut": false},
        {"slotNumber": 14, "sceneType": "arrival", "cameraAngle": 1, "color": "#FF6347", "duration": 3.212, "seamlessCut": false}
    ]'::jsonb
WHERE is_default = true;

-- ===========================================================================
-- UPDATE SCHEMA COMMENTS
-- ===========================================================================

COMMENT ON TABLE video_slots IS 'Final 14-slot video template configuration matching DaVinci MAG_FERRARI template';
COMMENT ON COLUMN video_slots.slot_number IS 'Slot position 1-14: (1-7 cruising, 8-13 chase, 14 arrival)';
COMMENT ON COLUMN video_slots.window_start IS 'Start time in seconds within the scene recording for this slot';
COMMENT ON COLUMN video_slots.slot_duration IS 'Duration of the slot in seconds (matches DaVinci template clip duration)';

COMMENT ON TABLE generated_clips IS 'Generated video clips for each slot, ready for DaVinci template replacement';
COMMENT ON COLUMN generated_clips.slot_number IS 'Slot position 1-14: (1-7 cruising, 8-13 chase, 14 arrival)';

-- ===========================================================================
-- VERIFICATION QUERIES
-- ===========================================================================

-- Run these queries to verify the migration:

-- Check constraint updates
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid IN ('video_slots'::regclass, 'generated_clips'::regclass)
    AND conname LIKE '%slot_number%';

-- Verify tables are empty and ready for new data
SELECT 'video_slots' as table_name, COUNT(*) as row_count FROM video_slots
UNION ALL
SELECT 'generated_clips', COUNT(*) FROM generated_clips;

-- ===========================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ===========================================================================

/*
If you need to rollback this migration:

1. Restore from backup tables:
   DELETE FROM video_slots;
   INSERT INTO video_slots SELECT * FROM video_slots_backup_14;

   DELETE FROM generated_clips;
   INSERT INTO generated_clips SELECT * FROM generated_clips_backup_14;

2. Restore old constraints:
   ALTER TABLE video_slots DROP CONSTRAINT IF EXISTS chk_slot_number;
   ALTER TABLE video_slots ADD CONSTRAINT chk_slot_number CHECK (slot_number >= 1 AND slot_number <= 8);

   ALTER TABLE generated_clips DROP CONSTRAINT IF EXISTS chk_slot_number;
   ALTER TABLE generated_clips ADD CONSTRAINT chk_slot_number CHECK (slot_number >= 1 AND slot_number <= 8);

3. Clean up backup tables:
   DROP TABLE video_slots_backup_14;
   DROP TABLE generated_clips_backup_14;
*/

-- ===========================================================================
-- CLEANUP (run after verifying migration success)
-- ===========================================================================

-- Drop backup tables after confirming migration success
-- DROP TABLE video_slots_backup_14;
-- DROP TABLE generated_clips_backup_14;

-- Schema version update
INSERT INTO schema_version (version)
VALUES (4)
ON CONFLICT (version) DO NOTHING;

SELECT 'Migration completed successfully! New 14-slot structure is active.' as result;
SELECT 'WARNING: All existing slot selections have been cleared. Users must re-select slots.' as notice;
