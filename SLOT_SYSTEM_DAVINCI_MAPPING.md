# MagnumStream Slot System & DaVinci Template Mapping

This document maps the MagnumStream recording/slot system to the actual DaVinci Resolve MAG_FERRARI template structure.

## Current System Overview

### Recording Process
1. **Record 3 Scenes** (RecordingDashboard.tsx)
   - Cruising scene: ~30-60 seconds, dual camera (front + side)
   - Chase scene: ~30-60 seconds, dual camera (front + side)
   - Arrival scene: ~30-60 seconds, dual camera (front + side)

2. **Store in IndexedDB**
   - 6 total videos stored (3 scenes × 2 cameras)
   - Keys: `${sessionId}_${sceneType}_camera${angle}`

3. **Select 5 Slots** (EditorCruising/Chase/Arrival.tsx)
   - User chooses `windowStart` time for each slot
   - Each slot has fixed `slotDuration` from template
   - Selected segments: `windowStart` → `windowStart + slotDuration`

4. **Generate 5 Clips** (ClipGenerator via FFmpeg)
   - Extract precise segments from source videos
   - Save to: `/projects/${sessionId}/clips/slot_${n}.mp4`

5. **Render with DaVinci** (Davinci.py)
   - Replace template clips with generated clips
   - Automated rendering with effects/music

---

## DaVinci Template Reality vs. Current Configuration

### ⚠️ **MISMATCH DETECTED**

**DaVinci Template (MAG_FERRARI):**
- **14 clips** on Video Track 3
- Cruising: 7 clips
- Chase: 6 clips
- Arrival: 1 clip

**Current MagnumStream SLOT_TEMPLATE:**
- **5 slots** only
- Cruising: 2 slots
- Chase: 2 slots
- Arrival: 1 slot

### Analysis

The current 5-slot system **does not match** the actual 14-clip DaVinci template structure. This explains potential issues with template replacement.

---

## Proposed Slot Mapping (Updated to Match Template)

Based on the clip analysis from `TIMELINE_CLIP_ANALYSIS.md`, here's the corrected slot configuration:

### Cruising Scene Slots (7 clips)

| Slot | Camera | Duration (frames) | Duration (seconds) | Seamless Cut? | Notes |
|------|--------|-------------------|-------------------|---------------|-------|
| 1 | Front (CAM_B) | 21 | 0.876 | No | Opening clip |
| 2 | Front (CAM_B) | 29 | 1.210 | → Slot 3 | Leads into side view |
| 3 | Side (CAM_A) | 31 | 1.293 | ✅ From Slot 2 | Seamless transition |
| 4 | Front (CAM_B) | 23 | 0.959 | → Slot 5 | Leads into side view |
| 5 | Side (CAM_A) | 36 | 1.502 | ✅ From Slot 4 | Seamless transition |
| 6 | Front (CAM_B) | 16 | 0.667 | No | |
| 7 | Side (CAM_A) | 19 | 0.793 | No | |

**Total Cruising Duration:** 175 frames = ~7.3 seconds

### Chase Scene Slots (6 clips)

| Slot | Camera | Duration (frames) | Duration (seconds) | Seamless Cut? | Notes |
|------|--------|-------------------|-------------------|---------------|-------|
| 8 | Front (CAM_B) | 21 | 0.876 | → Slot 9 | Leads into side view |
| 9 | Side (CAM_A) | 34 | 1.418 | ✅ From Slot 8 | Seamless transition |
| 10 | Front (CAM_B) | 13 | 0.542 | No | Short clip |
| 11 | Front (CAM_B) | 35 | 1.460 | → Slot 12 | Leads into side view |
| 12 | Side (CAM_A) | 37 | 1.543 | ✅ From Slot 11 | Seamless transition |
| 13 | Side (CAM_A) | 13 | 0.542 | No | |

**Total Chase Duration:** 153 frames = ~6.4 seconds

### Arrival Scene Slot (1 clip)

| Slot | Camera | Duration (frames) | Duration (seconds) | Seamless Cut? | Notes |
|------|--------|-------------------|-------------------|---------------|-------|
| 14 | Side (CAM_A) | 77 | 3.212 | No | Longest clip |

**Total Arrival Duration:** 77 frames = ~3.2 seconds

---

## Updated SLOT_TEMPLATE Configuration

```typescript
// Updated to match actual DaVinci template structure
export const SLOT_TEMPLATE: SlotConfig[] = [
  // Cruising Scene (7 slots)
  { slotNumber: 1,  sceneType: 'cruising', cameraAngle: 2, duration: 0.876, seamlessCut: false },
  { slotNumber: 2,  sceneType: 'cruising', cameraAngle: 2, duration: 1.210, seamlessCut: true },  // → Slot 3
  { slotNumber: 3,  sceneType: 'cruising', cameraAngle: 1, duration: 1.293, seamlessCut: false }, // ← Slot 2
  { slotNumber: 4,  sceneType: 'cruising', cameraAngle: 2, duration: 0.959, seamlessCut: true },  // → Slot 5
  { slotNumber: 5,  sceneType: 'cruising', cameraAngle: 1, duration: 1.502, seamlessCut: false }, // ← Slot 4
  { slotNumber: 6,  sceneType: 'cruising', cameraAngle: 2, duration: 0.667, seamlessCut: false },
  { slotNumber: 7,  sceneType: 'cruising', cameraAngle: 1, duration: 0.793, seamlessCut: false },

  // Chase Scene (6 slots)
  { slotNumber: 8,  sceneType: 'chase', cameraAngle: 2, duration: 0.876, seamlessCut: true },  // → Slot 9
  { slotNumber: 9,  sceneType: 'chase', cameraAngle: 1, duration: 1.418, seamlessCut: false }, // ← Slot 8
  { slotNumber: 10, sceneType: 'chase', cameraAngle: 2, duration: 0.542, seamlessCut: false },
  { slotNumber: 11, sceneType: 'chase', cameraAngle: 2, duration: 1.460, seamlessCut: true },  // → Slot 12
  { slotNumber: 12, sceneType: 'chase', cameraAngle: 1, duration: 1.543, seamlessCut: false }, // ← Slot 11
  { slotNumber: 13, sceneType: 'chase', cameraAngle: 1, duration: 0.542, seamlessCut: false },

  // Arrival Scene (1 slot)
  { slotNumber: 14, sceneType: 'arrival', cameraAngle: 1, duration: 3.212, seamlessCut: false },
];
```

**Note on Camera Angles:**
- `cameraAngle: 1` = Side view (CAM_A)
- `cameraAngle: 2` = Front view (CAM_B)

---

## Window Selection System (How Timing Works)

### For Each Slot:

```typescript
interface VideoSlot {
  slotNumber: number;      // 1-14 (updated)
  sceneType: string;       // 'cruising' | 'chase' | 'arrival'
  cameraAngle: number;     // 1 (side) or 2 (front)
  windowStart: number;     // User-selected start time in scene (e.g., 12.5s)
  slotDuration: number;    // Fixed duration from template (e.g., 1.293s)
}
```

### Example User Flow:

**Scenario:** Editing Slot 3 (Cruising, Side View)

1. **Load Scene**: Cruising scene camera 1 (side view) video
   - Total duration: 45 seconds (user recorded this long)

2. **Adjust Window**: User drags slider to choose start time
   - Window start: 18.3 seconds
   - Window end: 18.3s + 1.293s = 19.593 seconds

3. **Preview**: Video plays from 18.3s to 19.593s in loop

4. **Save**: `windowStart = 18.3` saved to database

5. **Generate Clip**: FFmpeg extracts exactly 1.293s starting at 18.3s
   ```bash
   ffmpeg -i cruising_camera1.mp4 -ss 18.3 -t 1.293 -c copy slot_3.mp4
   ```

6. **DaVinci Replacement**: `slot_3.mp4` replaces Clip 3 in template

---

## Storage Implementation

### Database Schema Update

```sql
-- video_slots table needs to support 14 slots now
ALTER TABLE video_slots DROP CONSTRAINT IF EXISTS video_slots_slot_number_check;
ALTER TABLE video_slots ADD CONSTRAINT video_slots_slot_number_check
  CHECK (slot_number >= 1 AND slot_number <= 14);

-- Add seamless cut indicator
ALTER TABLE video_slots ADD COLUMN seamless_cut BOOLEAN DEFAULT false;
```

### File Storage Structure

```
projects/
└── Joe_&_Sam_2025-10-30/
    ├── source/
    │   ├── cruising_camera1.mp4  (side view, ~45s)
    │   ├── cruising_camera2.mp4  (front view, ~45s)
    │   ├── chase_camera1.mp4     (side view, ~50s)
    │   ├── chase_camera2.mp4     (front view, ~50s)
    │   ├── arrival_camera1.mp4   (side view, ~30s)
    │   └── arrival_camera2.mp4   (front view, ~30s)
    │
    ├── clips/
    │   ├── slot_1.mp4   (0.876s from cruising_camera2)
    │   ├── slot_2.mp4   (1.210s from cruising_camera2)
    │   ├── slot_3.mp4   (1.293s from cruising_camera1)
    │   ├── slot_4.mp4   (0.959s from cruising_camera2)
    │   ├── slot_5.mp4   (1.502s from cruising_camera1)
    │   ├── slot_6.mp4   (0.667s from cruising_camera2)
    │   ├── slot_7.mp4   (0.793s from cruising_camera1)
    │   ├── slot_8.mp4   (0.876s from chase_camera2)
    │   ├── slot_9.mp4   (1.418s from chase_camera1)
    │   ├── slot_10.mp4  (0.542s from chase_camera2)
    │   ├── slot_11.mp4  (1.460s from chase_camera2)
    │   ├── slot_12.mp4  (1.543s from chase_camera1)
    │   ├── slot_13.mp4  (0.542s from chase_camera1)
    │   └── slot_14.mp4  (3.212s from arrival_camera1)
    │
    └── davinci/
        └── job_123.json  (references all 14 clips)
```

---

## Seamless Cut Implementation

### Special Handling for Adjacent Clips

Slots with `seamlessCut: true` indicate they transition directly into the next clip:

**Pairs:**
- Slot 2 → Slot 3 (Cruising: Front → Side)
- Slot 4 → Slot 5 (Cruising: Front → Side)
- Slot 8 → Slot 9 (Chase: Front → Side)
- Slot 11 → Slot 12 (Chase: Front → Side)

### User Experience Considerations:

1. **Visual Indicator**: Show connector line between seamless pairs in editor
2. **Timing Suggestion**: When Slot 2 ends at time X, suggest Slot 3 starts near X
3. **Preview Mode**: Play Slot 2 + Slot 3 together to preview seamless cut
4. **Validation**: Warn if seamless pairs don't flow well together

---

## Migration Plan: 5 Slots → 14 Slots

### Phase 1: Database Migration
```sql
-- Run MIGRATION_5_TO_14_SLOTS.sql
-- Expand slot_number constraint
-- Add seamless_cut column
-- Migrate existing 5-slot data to new structure
```

### Phase 2: Update SLOT_TEMPLATE
- Update `/shared/schema.ts` with new 14-slot configuration
- Add `seamlessCut` field to `SlotConfig` interface

### Phase 3: UI Updates
- **EditorCruising**: Support 7 slots instead of 2
- **EditorChase**: Support 6 slots instead of 2
- **EditorArrival**: Keep 1 slot (no change)
- **SlotSelector**: Add seamless cut indicators

### Phase 4: Clip Generation
- Update `ClipGenerator` to generate 14 clips
- Ensure frame-accurate cutting with FFmpeg
- Match exact durations from template

### Phase 5: DaVinci Integration
- Update `Davinci.py` to replace all 14 clips in template
- Validate clip order and positioning
- Test seamless transitions in rendered output

---

## Benefits of 14-Slot System

1. **Perfect Template Match**: Clips map 1:1 with DaVinci template
2. **More Creative Control**: Users can fine-tune 14 segments vs. only 5
3. **Seamless Cuts**: Explicit handling of smooth transitions
4. **Professional Quality**: Frame-accurate editing with precise durations
5. **Scalability**: System can adapt to different templates

---

## Key Insights

### Why the 5-Slot System Was Created:
- **Simplification**: Easier for users to edit fewer segments
- **Faster Workflow**: Less time spent selecting windows
- **Historical**: May have been based on an older/simpler template

### Why 14-Slot System is Better:
- **Accuracy**: Matches actual template requirements
- **Flexibility**: More editing control per scene
- **Quality**: Seamless cuts create professional transitions
- **Future-Proof**: Can accommodate template updates

### Technical Constraints:
- **Frame Rate**: 23.976 fps must be precise
- **Duration Accuracy**: FFmpeg must cut to exact frame counts
- **Transition Timing**: Seamless cuts require perfect alignment
- **IndexedDB Limits**: 6 source videos × ~50s = manageable storage

---

## Next Steps

1. ✅ Document current system (this file)
2. ⏭️ Create migration SQL script (5 → 14 slots)
3. ⏭️ Update SLOT_TEMPLATE in schema.ts
4. ⏭️ Refactor editor components for 14 slots
5. ⏭️ Update ClipGenerator for 14-clip output
6. ⏭️ Test full workflow with real recordings
7. ⏭️ Validate DaVinci template replacement

---

## Related Files

- `TIMELINE_CLIP_ANALYSIS.md` - DaVinci template structure analysis
- `shared/schema.ts` - SLOT_TEMPLATE definition
- `MIGRATION_8_TO_5_SLOTS.sql` - Previous migration (now outdated)
- `client/src/pages/Editor*.tsx` - Slot editor components
- `server/services/ClipGenerator.ts` - FFmpeg clip generation
- `Davinci.py` - Template rendering automation
