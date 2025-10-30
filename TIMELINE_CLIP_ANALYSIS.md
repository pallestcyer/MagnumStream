# DaVinci Timeline Clip Analysis

Analysis of clips on Video Track 3 (V3) in the MAG_FERRARI template timeline.

## Timeline Information

- **Project**: project
- **Timeline**: MAG_FERRARI
- **Frame Rate**: 23.976 fps
- **Timeline Range**: Frame 86400 - 87726
- **Total Clips**: 14 clips on V3

---

## Camera View Legend

- **CAM_A**: Side view
- **CAM_B**: Front view

---

## Scene Breakdown

### Cruising Scene (Clips 1-7)

| Clip | Name | View | Start Frame | Duration | Adjacent to Previous? |
|------|------|------|-------------|----------|----------------------|
| 1 | FERRARI_CHASE-CAM_B.MOV | Front | 86485 | 21 | N/A (first clip) |
| 2 | FERRARI_CHASE-CAM_B.MOV | Front | 86549 | 29 | No (gap: 43 frames) |
| 3 | FERRARI_CHASE-CAM_A.MOV | Side | 86578 | 31 | ✅ **Yes - seamless cut** |
| 4 | FERRARI_CHASE-CAM_B.MOV | Front | 86631 | 23 | No (gap: 22 frames) |
| 5 | FERRARI_CHASE-CAM_A.MOV | Side | 86654 | 36 | ✅ **Yes - seamless cut** |
| 6 | FERRARI_CHASE-CAM_B.MOV | Front | 86790 | 16 | No (gap: 100 frames) |
| 7 | FERRARI_CHASE-CAM_A.MOV | Side | 86844 | 19 | No (gap: 38 frames) |

**Seamless Transitions in Cruising:**
- Clip 2 (Front) → Clip 3 (Side): Direct cut at frame 86578
- Clip 4 (Front) → Clip 5 (Side): Direct cut at frame 86654

---

### Chase Scene (Clips 8-13)

| Clip | Name | View | Start Frame | Duration | Adjacent to Previous? |
|------|------|------|-------------|----------|----------------------|
| 8 | FERRARI_CHASE-CAM_B.MOV | Front | 86905 | 21 | No (gap: 42 frames) |
| 9 | FERRARI_CHASE-CAM_A.MOV | Side | 86926 | 34 | ✅ **Yes - seamless cut** |
| 10 | FERRARI_CHASE-CAM_B.MOV | Front | 87035 | 13 | No (gap: 75 frames) |
| 11 | FERRARI_CHASE-CAM_B.MOV | Front | 87105 | 35 | No (gap: 57 frames) |
| 12 | FERRARI_CHASE-CAM_A.MOV | Side | 87140 | 37 | ✅ **Yes - seamless cut** |
| 13 | FERRARI_CHASE-CAM_A.MOV | Side | 87216 | 13 | No (gap: 39 frames) |

**Seamless Transitions in Chase:**
- Clip 8 (Front) → Clip 9 (Side): Direct cut at frame 86926
- Clip 11 (Front) → Clip 12 (Side): Direct cut at frame 87140

---

### Arrival Scene (Clip 14)

| Clip | Name | View | Start Frame | Duration | Adjacent to Previous? |
|------|------|------|-------------|----------|----------------------|
| 14 | FERRARI_CHASE-CAM_A.MOV | Side | 87352 | 77 | No (gap: 123 frames) |

---

## Key Patterns

### Seamless Transitions (No Gap)

All seamless transitions follow the same pattern:
- **Front view (CAM_B) → Side view (CAM_A)**
- Total of 4 seamless cuts across the timeline

**List of Adjacent Clips:**
1. Clip 2 → Clip 3
2. Clip 4 → Clip 5
3. Clip 8 → Clip 9
4. Clip 11 → Clip 12

### Camera Distribution

**Front View (CAM_B):**
- Clips: 1, 2, 4, 6, 8, 10, 11
- Total: 7 clips

**Side View (CAM_A):**
- Clips: 3, 5, 7, 9, 12, 13, 14
- Total: 7 clips

### Scene Structure

- **Cruising**: 7 clips, balanced mix of views, 2 seamless cuts
- **Chase**: 6 clips, balanced mix of views, 2 seamless cuts
- **Arrival**: 1 clip (side view only), longest duration (77 frames)

---

## Notes

- Source file names all reference "FERRARI_CHASE" but clips are used across all three scenes
- Seamless cuts create smooth camera angle transitions within scenes
- Gaps between non-adjacent clips allow for transitions, effects, or pacing
- The timeline structure supports dynamic editing with multiple camera angles

---

## File Location

Generated from: `get_timeline_clips_debug.lua`
Debug log: `debug.log`
Timeline data: Available in `clip_positions_auto.json`
