# 14-Slot System Implementation Summary

## Overview
Successfully updated MagnumStream from 5-slot to 14-slot system matching the actual DaVinci MAG_FERRARI template structure.

---

## Complete Pipeline Flow

### 1. Frontend: Slot Selection (EditorCruising, EditorChase, EditorArrival)

**EditorCruising.tsx** - 7 slots (slots 1-7)
- Dynamically loads slots from `SLOT_TEMPLATE.filter(s => s.sceneType === 'cruising')`
- Users select windowStart time for each of the 7 cruising slots
- **Seamless cut auto-positioning:** When user adjusts slot 2 or 4, the following slot (3 or 5) automatically positions itself to maintain temporal continuity
- Saves to database via `/api/recordings/:id/video-slots/:slotNumber` endpoint

**EditorChase.tsx** - 6 slots (slots 8-13)
- Dynamically loads slots from `SLOT_TEMPLATE.filter(s => s.sceneType === 'chase')`
- Users select windowStart time for each of the 6 chase slots
- **Seamless cut auto-positioning:** When user adjusts slot 8 or 11, the following slot (9 or 12) automatically positions itself
- Saves to database via same endpoint

**EditorArrival.tsx** - 1 slot (slot 14)
- Dynamically loads slot from `SLOT_TEMPLATE.filter(s => s.sceneType === 'arrival')`
- User selects windowStart time for the single arrival slot
- No seamless cuts in arrival scene
- Saves to database via same endpoint

### 2. Database: Slot Storage (Supabase PostgreSQL)

**Schema: `video_slots` table**
```sql
CREATE TABLE video_slots (
    id VARCHAR PRIMARY KEY,
    recording_id VARCHAR NOT NULL,
    slot_number INTEGER NOT NULL, -- 1-14 (updated constraint)
    scene_id VARCHAR NOT NULL,
    camera_angle INTEGER NOT NULL, -- 1 or 2
    window_start DECIMAL(8,2) NOT NULL,
    slot_duration DECIMAL(8,2) NOT NULL,
    created_at TIMESTAMP,
    CONSTRAINT chk_slot_number CHECK (slot_number >= 1 AND slot_number <= 14)
);
```

**Migration:** `MIGRATION_5_TO_14_SLOTS.sql`
- Updates constraints from 1-8 to 1-14
- Clears existing slot data (users must re-select)
- Updates project_templates table with new 14-slot configuration

### 3. Backend: Clip Generation (ClipGenerator.ts)

**Updated scene type mapping:**
```typescript
private getSceneTypeFromSlotNumber(slotNumber: number): 'cruising' | 'chase' | 'arrival' {
  if (slotNumber >= 1 && slotNumber <= 7) return 'cruising';
  if (slotNumber >= 8 && slotNumber <= 13) return 'chase';
  if (slotNumber === 14) return 'arrival';
  throw new Error(`Invalid slot number: ${slotNumber}. Valid range is 1-14.`);
}
```

**Process:**
1. Fetches 14 video slot records from database for a recording
2. Groups by scene type (cruising/chase/arrival)
3. Loads source videos from `projects/{sessionId}/source/`
4. Uses FFmpeg to extract 14 clips with exact durations from SLOT_TEMPLATE:
   ```bash
   ffmpeg -i cruising_camera2.mp4 -ss 10.5 -t 0.876 slot_1.mp4
   ffmpeg -i cruising_camera2.mp4 -ss 12.0 -t 1.210 slot_2.mp4
   # ... (14 total clips)
   ```
5. Saves clips to `projects/{sessionId}/clips/slot_{1-14}.mp4`
6. Creates DaVinci job file at `projects/{sessionId}/davinci/job_{jobId}.json`

**Job File Format:**
```json
{
  "jobId": "uuid-here",
  "recordingId": "recording-uuid",
  "projectName": "Joe&Sam_2025-10-30",
  "templateProject": "MAG_FERRARI-BACKUP",
  "clips": {
    "1": {
      "filename": "slot_1_cruising_cam2.mp4",
      "fullPath": "/full/path/to/projects/session/clips/slot_1_cruising_cam2.mp4",
      "slotNumber": 1,
      "sceneType": "cruising",
      "cameraAngle": 2,
      "duration": 0.876
    },
    "2": { ... },
    // ... all 14 clips
    "14": { ... }
  },
  "metadata": {
    "projectName": "Joe&Sam",
    "sessionId": "session-id",
    "createdAt": "2025-10-30T...",
    "recordingId": "recording-uuid"
  }
}
```

### 4. Render Endpoint: DaVinci Execution (server/routes.ts)

**POST `/api/render/:recordingId`**
1. Calls `clipGenerator.generateClipsFromSlotSelections(recordingId)` → generates 14 clips
2. Calls `clipGenerator.createDaVinciJobFile(recordingId)` → creates job JSON
3. Executes Python script:
   ```bash
   python3 ./Davinci.py --job-file "/path/to/davinci/job_uuid.json"
   ```
4. Waits for DaVinci to complete rendering
5. Gets output path from DaVinci Python script
6. Syncs to Google Drive (via GoogleDriveLinkGenerator.ts)
7. Updates database with `driveFileUrl` and `driveFolderUrl`

### 5. DaVinci Automation: Template Replacement (Davinci.py)

**Updated CLIP_POSITIONS (14 slots):**
```python
CLIP_POSITIONS = {
    # Cruising Scene (7 slots) - Track 3
    1: {"track": 3, "start_frame": 86485},   # Front, 21 frames
    2: {"track": 3, "start_frame": 86549},   # Front, 29 frames → seamless to 3
    3: {"track": 3, "start_frame": 86578},   # Side, 31 frames
    4: {"track": 3, "start_frame": 86631},   # Front, 23 frames → seamless to 5
    5: {"track": 3, "start_frame": 86654},   # Side, 36 frames
    6: {"track": 3, "start_frame": 86790},   # Front, 16 frames
    7: {"track": 3, "start_frame": 86844},   # Side, 19 frames

    # Chase Scene (6 slots) - Track 3
    8: {"track": 3, "start_frame": 86905},   # Front, 21 frames → seamless to 9
    9: {"track": 3, "start_frame": 86926},   # Side, 34 frames
    10: {"track": 3, "start_frame": 87035},  # Front, 13 frames
    11: {"track": 3, "start_frame": 87105},  # Front, 35 frames → seamless to 12
    12: {"track": 3, "start_frame": 87140},  # Side, 37 frames
    13: {"track": 3, "start_frame": 87216},  # Side, 13 frames

    # Arrival Scene (1 slot) - Track 3
    14: {"track": 3, "start_frame": 87352},  # Side, 77 frames
}
```

**Process:**
1. Connects to running DaVinci Resolve instance
2. Loads template project: `MAG_FERRARI-BACKUP`
3. Gets timeline: `MAG_FERARRI`
4. Imports 14 clips from job file into media pool
5. Replaces each of the 14 template clips at exact frame positions
6. Saves project
7. Renders to organized folder structure:
   ```
   ~/MagnumStream/rendered/
   └── 2025/
       └── 10-October/
           └── 30/
               └── Joe&Sam/
                   └── Joe&Sam_20251030_143000.mp4
   ```
8. Returns output path to Node.js server

### 6. Google Drive Sync (GoogleDriveLinkGenerator.ts)

**Process:**
1. Waits for Google Drive Desktop to sync the rendered video
2. Searches for file by name (without extension)
3. Retrieves folder ID and file URL
4. If OAuth is set up, shares folder with customer email
5. Returns Drive URLs to server

---

## SLOT_TEMPLATE Configuration

**Location:** `shared/schema.ts`

```typescript
export const SLOT_TEMPLATE: SlotConfig[] = [
  // Cruising Scene (7 slots)
  { slotNumber: 1, sceneType: 'cruising', cameraAngle: 2, color: '#FF6B35', duration: 0.876, seamlessCut: false },
  { slotNumber: 2, sceneType: 'cruising', cameraAngle: 2, color: '#F7931E', duration: 1.210, seamlessCut: true },
  { slotNumber: 3, sceneType: 'cruising', cameraAngle: 1, color: '#FFA500', duration: 1.293, seamlessCut: false },
  { slotNumber: 4, sceneType: 'cruising', cameraAngle: 2, color: '#FF9E3D', duration: 0.959, seamlessCut: true },
  { slotNumber: 5, sceneType: 'cruising', cameraAngle: 1, color: '#FF7A3D', duration: 1.502, seamlessCut: false },
  { slotNumber: 6, sceneType: 'cruising', cameraAngle: 2, color: '#FF6B6B', duration: 0.667, seamlessCut: false },
  { slotNumber: 7, sceneType: 'cruising', cameraAngle: 1, color: '#FFA07A', duration: 0.793, seamlessCut: false },

  // Chase Scene (6 slots)
  { slotNumber: 8, sceneType: 'chase', cameraAngle: 2, color: '#FFB347', duration: 0.876, seamlessCut: true },
  { slotNumber: 9, sceneType: 'chase', cameraAngle: 1, color: '#FFCC00', duration: 1.418, seamlessCut: false },
  { slotNumber: 10, sceneType: 'chase', cameraAngle: 2, color: '#FFD700', duration: 0.542, seamlessCut: false },
  { slotNumber: 11, sceneType: 'chase', cameraAngle: 2, color: '#FFA500', duration: 1.460, seamlessCut: true },
  { slotNumber: 12, sceneType: 'chase', cameraAngle: 1, color: '#FF8C00', duration: 1.543, seamlessCut: false },
  { slotNumber: 13, sceneType: 'chase', cameraAngle: 1, color: '#FF7F50', duration: 0.542, seamlessCut: false },

  // Arrival Scene (1 slot)
  { slotNumber: 14, sceneType: 'arrival', cameraAngle: 1, color: '#FF6347', duration: 3.212, seamlessCut: false },
];

export const SEAMLESS_PAIRS = [
  { lead: 2, follow: 3 },   // Cruising: Front → Side
  { lead: 4, follow: 5 },   // Cruising: Front → Side
  { lead: 8, follow: 9 },   // Chase: Front → Side
  { lead: 11, follow: 12 }, // Chase: Front → Side
];
```

**Key Points:**
- **Single source of truth** for all slot configurations
- Durations match exact frame counts from DaVinci template (@ 23.976 fps)
- Camera angles: 1 = Side view (CAM_A), 2 = Front view (CAM_B)
- Seamless cuts marked for auto-positioning behavior

---

## Files Modified

### Frontend
- ✅ `client/src/pages/EditorCruising.tsx` - Added seamless auto-positioning
- ✅ `client/src/pages/EditorChase.tsx` - Added seamless auto-positioning
- ⚠️ `client/src/pages/EditorArrival.tsx` - No changes needed (already works with 1 slot)

### Backend
- ✅ `server/services/ClipGenerator.ts` - Updated scene type mapping (1-7 cruising, 8-13 chase, 14 arrival)
- ✅ `server/routes.ts` - Already handles dynamic slot count (no changes needed)

### Shared
- ✅ `shared/schema.ts` - Updated SLOT_TEMPLATE to 14 slots with correct durations and seamless cut configuration
- ✅ `server/schema.ts` - Comment updated to reflect 14-slot system

### Database
- ✅ `SUPABASE_SCHEMA.sql` - Updated constraints to 1-14, updated default template
- ✅ `MIGRATION_5_TO_14_SLOTS.sql` - Migration script from 8-slot to 14-slot

### DaVinci
- ✅ `Davinci.py` - Updated CLIP_POSITIONS with all 14 frame positions from actual template

### Documentation
- ✅ `TIMELINE_CLIP_ANALYSIS.md` - Analysis of 14 clips in DaVinci template
- ✅ `SLOT_SYSTEM_DAVINCI_MAPPING.md` - Complete mapping documentation
- ✅ `SEAMLESS_CUT_BEHAVIOR.md` - Seamless cut specification
- ✅ `14_SLOT_IMPLEMENTATION_SUMMARY.md` - This file

---

## Testing Checklist

### Database Migration
- [ ] Run `MIGRATION_5_TO_14_SLOTS.sql` on Supabase database
- [ ] Verify constraints updated: `SELECT * FROM pg_constraint WHERE conname LIKE '%slot_number%'`
- [ ] Verify project template updated: `SELECT slot_configuration FROM project_templates WHERE is_default = true`

### Frontend Testing
- [ ] EditorCruising displays 7 slots
- [ ] EditorChase displays 6 slots
- [ ] EditorArrival displays 1 slot
- [ ] Seamless auto-positioning works:
  - [ ] Adjust slot 2, verify slot 3 follows
  - [ ] Adjust slot 4, verify slot 5 follows
  - [ ] Adjust slot 8, verify slot 9 follows
  - [ ] Adjust slot 11, verify slot 12 follows
- [ ] All slot selections save to database correctly

### Backend Testing
- [ ] ClipGenerator generates 14 clips (verify in projects/session/clips/)
- [ ] Job file contains all 14 clips with correct metadata
- [ ] DaVinci job file validates against expected structure

### DaVinci Testing
- [ ] Python script reads job file with 14 clips
- [ ] All 14 clips found in CLIP_POSITIONS
- [ ] Clips replaced at correct frame positions in template
- [ ] Rendered video plays correctly with all 14 segments
- [ ] Total video duration ~17 seconds (sum of all durations)

### End-to-End Testing
- [ ] Record 3 scenes (cruising, chase, arrival)
- [ ] Select all 14 slots in editors
- [ ] Trigger render
- [ ] Verify 14 clips generated
- [ ] Verify DaVinci renders successfully
- [ ] Verify output video quality
- [ ] Verify Google Drive sync works
- [ ] Verify customer can access video

---

## Rollback Plan

If issues occur, rollback using:

```sql
-- Restore constraints
ALTER TABLE video_slots DROP CONSTRAINT IF EXISTS chk_slot_number;
ALTER TABLE video_slots ADD CONSTRAINT chk_slot_number CHECK (slot_number >= 1 AND slot_number <= 8);

ALTER TABLE generated_clips DROP CONSTRAINT IF EXISTS chk_slot_number;
ALTER TABLE generated_clips ADD CONSTRAINT chk_slot_number CHECK (slot_number >= 1 AND slot_number <= 8);

-- Restore data from backup
DELETE FROM video_slots;
INSERT INTO video_slots SELECT * FROM video_slots_backup_14;

DELETE FROM generated_clips;
INSERT INTO generated_clips SELECT * FROM generated_clips_backup_14;
```

Then revert code changes via Git:
```bash
git revert HEAD
```

---

## Key Improvements

1. **Matches Actual Template:** 14 slots perfectly align with DaVinci MAG_FERRARI template
2. **Seamless Cuts:** Auto-positioning maintains temporal continuity across camera angle changes
3. **Frame-Accurate:** Durations calculated from exact frame counts at 23.976 fps
4. **More Creative Control:** 14 slots vs 5 allows finer editing precision
5. **Professional Quality:** Smooth transitions between front and side camera angles
6. **Maintainable:** SLOT_TEMPLATE is single source of truth
7. **Scalable:** System can adapt to future template changes

---

## Total Video Duration

Sum of all slot durations:
- Cruising: 0.876 + 1.210 + 1.293 + 0.959 + 1.502 + 0.667 + 0.793 = **7.300 seconds**
- Chase: 0.876 + 1.418 + 0.542 + 1.460 + 1.543 + 0.542 = **6.381 seconds**
- Arrival: 3.212 = **3.212 seconds**

**Total:** ~16.9 seconds of final edited video

---

## Contact

For questions about this implementation, refer to:
- SLOT_SYSTEM_DAVINCI_MAPPING.md
- SEAMLESS_CUT_BEHAVIOR.md
- TIMELINE_CLIP_ANALYSIS.md
