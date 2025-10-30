# Seamless Cut Behavior Specification

This document defines how seamless cuts work in the MagnumStream slot editor, ensuring smooth camera transitions that maintain temporal continuity.

---

## Core Concept

For seamless cut pairs, the **second slot automatically positions itself** to start exactly where the first slot ends in the timeline.

### Example: Slot 2 → Slot 3 (Cruising: Front → Side)

**User Action:**
1. User sets Slot 2 (Front view) window:
   - Window Start: `10.5s`
   - Duration: `1.210s`
   - Window End: `10.5 + 1.210 = 11.71s`

**Automatic Response:**
2. Slot 3 (Side view) automatically updates:
   - Window Start: `11.71s` (picks up where Slot 2 ended)
   - Duration: `1.293s` (fixed from template)
   - Window End: `11.71 + 1.293 = 13.003s`

**Result:**
- Front view shows action from 10.5s → 11.71s
- Side view shows same action continuing from 11.71s → 13.003s
- No jump in time - smooth camera angle transition

---

## Seamless Cut Pairs

### Cruising Scene

**Pair 1: Slots 2 → 3**
```typescript
{
  leadSlot: { number: 2, camera: 'Front', duration: 1.210 },
  followSlot: { number: 3, camera: 'Side', duration: 1.293 },
  behavior: 'Slot 3 windowStart = Slot 2 windowStart + 1.210'
}
```

**Pair 2: Slots 4 → 5**
```typescript
{
  leadSlot: { number: 4, camera: 'Front', duration: 0.959 },
  followSlot: { number: 5, camera: 'Side', duration: 1.502 },
  behavior: 'Slot 5 windowStart = Slot 4 windowStart + 0.959'
}
```

### Chase Scene

**Pair 3: Slots 8 → 9**
```typescript
{
  leadSlot: { number: 8, camera: 'Front', duration: 0.876 },
  followSlot: { number: 9, camera: 'Side', duration: 1.418 },
  behavior: 'Slot 9 windowStart = Slot 8 windowStart + 0.876'
}
```

**Pair 4: Slots 11 → 12**
```typescript
{
  leadSlot: { number: 11, camera: 'Front', duration: 1.460 },
  followSlot: { number: 12, camera: 'Side', duration: 1.543 },
  behavior: 'Slot 12 windowStart = Slot 11 windowStart + 1.460'
}
```

---

## Implementation Specifications

### Auto-Positioning Logic

```typescript
// In SlotSelector component or editor
const SEAMLESS_PAIRS = [
  { lead: 2, follow: 3 },
  { lead: 4, follow: 5 },
  { lead: 8, follow: 9 },
  { lead: 11, follow: 12 },
];

function handleSlotWindowChange(slotNumber: number, newWindowStart: number) {
  // Save the changed slot
  updateSlot(slotNumber, { windowStart: newWindowStart });

  // Check if this slot is the LEAD in a seamless pair
  const pair = SEAMLESS_PAIRS.find(p => p.lead === slotNumber);

  if (pair) {
    // Get the lead slot's duration
    const leadSlot = SLOT_TEMPLATE.find(s => s.slotNumber === slotNumber);
    const leadDuration = leadSlot.duration;

    // Calculate where the follow slot should start
    const followWindowStart = newWindowStart + leadDuration;

    // Auto-update the follow slot
    updateSlot(pair.follow, { windowStart: followWindowStart });

    console.log(`Auto-positioned Slot ${pair.follow} to start at ${followWindowStart}s`);
  }
}
```

### User Override

Users can still manually adjust the follow slot if needed:

```typescript
function handleManualSlotAdjustment(slotNumber: number, newWindowStart: number) {
  // Check if this is a FOLLOW slot in a seamless pair
  const pair = SEAMLESS_PAIRS.find(p => p.follow === slotNumber);

  if (pair) {
    // Calculate expected position
    const leadSlot = getSlot(pair.lead);
    const leadEnd = leadSlot.windowStart + leadSlot.duration;
    const deviation = newWindowStart - leadEnd;

    // Show warning if user moves away from seamless position
    if (Math.abs(deviation) > 0.1) { // More than 0.1s deviation
      showWarning(`This slot is designed to follow Slot ${pair.lead} seamlessly.
                   Adjusting it may break the smooth transition.
                   Current gap: ${deviation.toFixed(2)}s`);
    }
  }

  // Still allow the update
  updateSlot(slotNumber, { windowStart: newWindowStart });
}
```

---

## UI/UX Design

### Visual Indicators

1. **Connected Slider Tracks**
```
Slot 2 (Front)  [===========]
                           ↓ seamless cut
Slot 3 (Side)              [============]
```

2. **Linked Icon**
```
Slot 2 [slider]  🔗  Slot 3 [slider]
```

3. **Timeline Visualization**
```
Cruising Scene Timeline (0s ────────────────── 45s)

Slot 2:  [10.5s ──► 11.71s]
           └─────────┐
Slot 3:              [11.71s ──► 13.003s]
```

### Interactive Behavior

**When editing Slot 2 (lead):**
- Dragging Slot 2's slider
- Slot 3's slider moves automatically in real-time
- Show preview: "Slot 3 will start at X.XXs"
- Highlight the connection with animated line

**When editing Slot 3 (follow):**
- Allow manual adjustment
- Show warning if moved away from seamless position
- Display deviation: "Gap: +0.5s" or "Overlap: -0.3s"
- Provide "Reset to Seamless" button

### State Management

```typescript
interface SlotState {
  slotNumber: number;
  windowStart: number;
  isAutoPositioned: boolean;  // true if positioned by seamless logic
  manuallyAdjusted: boolean;  // true if user overrode auto-position
  seamlessLinkActive: boolean; // true if maintaining seamless connection
}

// Example states
const slot2State = {
  slotNumber: 2,
  windowStart: 10.5,
  isAutoPositioned: false,
  manuallyAdjusted: true,
  seamlessLinkActive: true,
};

const slot3State = {
  slotNumber: 3,
  windowStart: 11.71,  // Auto-calculated from Slot 2
  isAutoPositioned: true,
  manuallyAdjusted: false,
  seamlessLinkActive: true,
};
```

---

## Edge Cases & Validations

### Case 1: User Adjusts Lead Slot Multiple Times

**Scenario:**
1. User sets Slot 2 to start at 5s → Slot 3 auto-positions to 6.21s
2. User changes Slot 2 to start at 15s → Slot 3 updates to 16.21s
3. Slot 3 always follows Slot 2

**Implementation:** Update follow slot every time lead slot changes

### Case 2: Not Enough Scene Duration

**Scenario:**
- User sets Slot 2 to start at 43s (duration 1.21s, ends at 44.21s)
- Slot 3 would need to start at 44.21s (duration 1.293s, ends at 45.503s)
- Scene only has 45s of footage

**Validation:**
```typescript
function validateSeamlessPosition(leadSlotNumber: number, windowStart: number) {
  const pair = SEAMLESS_PAIRS.find(p => p.lead === leadSlotNumber);
  if (!pair) return { valid: true };

  const leadSlot = SLOT_TEMPLATE.find(s => s.slotNumber === leadSlotNumber);
  const followSlot = SLOT_TEMPLATE.find(s => s.slotNumber === pair.follow);

  const leadEnd = windowStart + leadSlot.duration;
  const followEnd = leadEnd + followSlot.duration;

  const sceneType = leadSlot.sceneType;
  const sceneDuration = getSceneDuration(sceneType);

  if (followEnd > sceneDuration) {
    return {
      valid: false,
      message: `Cannot position here: Slot ${pair.follow} would extend beyond scene end.
                Max start time for Slot ${leadSlotNumber}: ${sceneDuration - leadSlot.duration - followSlot.duration}s`
    };
  }

  return { valid: true };
}
```

### Case 3: User Manually Breaks Seamless Link

**Scenario:**
- Slot 3 is auto-positioned at 11.71s
- User manually moves Slot 3 to 20s
- Link should break but can be restored

**UI:**
```typescript
// Show broken link indicator
if (slot.manuallyAdjusted && slot.seamlessLinkActive === false) {
  showUI({
    icon: '🔗💔',
    message: 'Seamless link broken',
    action: {
      label: 'Restore Seamless Position',
      onClick: () => restoreSeamlessLink(slot.slotNumber)
    }
  });
}
```

### Case 4: Scene Recording Starts Mid-Action

**Scenario:**
- User started recording scene 3 seconds into the action
- Slot 2 set to 0s (start of recording)
- Slot 3 would be at 1.21s

**This is fine!** The seamless cut maintains continuity within the recording, even if recording started late.

---

## Preview Functionality

### Seamless Preview Mode

**Feature:** Play both clips together to preview the transition

```typescript
function previewSeamlessTransition(leadSlotNumber: number) {
  const pair = SEAMLESS_PAIRS.find(p => p.lead === leadSlotNumber);
  if (!pair) return;

  const leadSlot = getSlot(leadSlotNumber);
  const followSlot = getSlot(pair.follow);

  // Play lead slot
  playVideoSegment({
    sceneType: leadSlot.sceneType,
    camera: leadSlot.cameraAngle,
    start: leadSlot.windowStart,
    duration: leadSlot.slotDuration,
    onComplete: () => {
      // Immediately play follow slot (seamless)
      playVideoSegment({
        sceneType: followSlot.sceneType,
        camera: followSlot.cameraAngle,
        start: followSlot.windowStart,
        duration: followSlot.slotDuration,
      });
    }
  });
}
```

**UI Button:**
```
[Preview Transition] ▶️  "See how Slot 2 → 3 flows"
```

---

## Database Storage

### Seamless Link Metadata

```sql
ALTER TABLE video_slots ADD COLUMN seamless_lead_slot INTEGER NULL;

-- For follow slots, store their lead slot number
UPDATE video_slots SET seamless_lead_slot = 2 WHERE slot_number = 3;
UPDATE video_slots SET seamless_lead_slot = 4 WHERE slot_number = 5;
UPDATE video_slots SET seamless_lead_slot = 8 WHERE slot_number = 9;
UPDATE video_slots SET seamless_lead_slot = 11 WHERE slot_number = 12;
```

### Query Example

```sql
-- Get all seamless pairs for a recording
SELECT
  lead.slot_number as lead_slot,
  lead.window_start as lead_start,
  lead.slot_duration as lead_duration,
  follow.slot_number as follow_slot,
  follow.window_start as follow_start,
  (lead.window_start + lead.slot_duration) as expected_follow_start,
  (follow.window_start - (lead.window_start + lead.slot_duration)) as deviation
FROM video_slots lead
INNER JOIN video_slots follow ON follow.seamless_lead_slot = lead.slot_number
WHERE lead.recording_id = ?;
```

---

## Testing Scenarios

### Test 1: Basic Auto-Positioning
1. Set Slot 2 windowStart to 10s
2. Verify Slot 3 windowStart automatically becomes 11.21s
3. ✅ Pass if Slot 3 updates immediately

### Test 2: Cascading Updates
1. Change Slot 2 windowStart from 10s to 20s
2. Verify Slot 3 windowStart updates from 11.21s to 21.21s
3. ✅ Pass if Slot 3 follows the change

### Test 3: Manual Override
1. Auto-position Slot 3 at 11.21s
2. User manually changes Slot 3 to 15s
3. Change Slot 2 to 25s
4. Verify Slot 3 does NOT auto-update (link broken)
5. ✅ Pass if Slot 3 stays at 15s

### Test 4: Restore Seamless Link
1. Break link by manual adjustment
2. Click "Restore Seamless Position"
3. Verify Slot 3 returns to correct position (Slot 2 end)
4. ✅ Pass if link restored and Slot 3 follows Slot 2 again

### Test 5: Preview Transition
1. Set Slot 2 and Slot 3 positions
2. Click "Preview Transition"
3. Verify playback flows smoothly from Slot 2 → Slot 3
4. ✅ Pass if transition is seamless (no visual jump)

### Test 6: Boundary Validation
1. Set Slot 2 near end of scene (e.g., 43s in 45s scene)
2. Verify warning appears about insufficient space
3. ✅ Pass if validation prevents invalid positioning

---

## Implementation Phases

### Phase 1: Data Layer
- Add `seamless_lead_slot` column to database
- Update SLOT_TEMPLATE with seamless indicators
- Create SEAMLESS_PAIRS configuration

### Phase 2: Core Logic
- Implement auto-positioning calculation
- Add validation for scene boundaries
- Handle manual override detection

### Phase 3: UI Components
- Visual connection indicators (lines/links)
- Warning messages for broken links
- "Restore Seamless" button
- Real-time slider updates

### Phase 4: Preview Features
- Seamless preview playback
- Timeline visualization
- Transition quality indicators

### Phase 5: Polish
- Animations for slider movements
- Tooltips explaining seamless cuts
- Help documentation in UI

---

## Benefits

1. **Maintains Temporal Continuity**: No time jumps in seamless transitions
2. **Smooth Camera Changes**: Professional-looking angle switches
3. **User-Friendly**: Auto-positioning reduces manual work
4. **Flexible**: Users can still override if needed
5. **Quality Control**: Validation prevents invalid configurations
6. **Visual Feedback**: Clear indicators show seamless relationships

---

## Example User Experience

**User Story:**

> Sarah is editing a cruising scene. She finds a great moment at 12 seconds where the Ferrari enters a turn. She sets Slot 2 (front view) to start at 12s, showing the approach to the turn. The system automatically positions Slot 3 (side view) to start at 13.21s (right after Slot 2 ends), seamlessly cutting to the side angle as the car goes through the turn. Sarah previews the transition and sees a smooth, professional camera angle change that maintains the flow of action. Perfect!

---

## Related Files

- `SLOT_SYSTEM_DAVINCI_MAPPING.md` - Overall slot system design
- `TIMELINE_CLIP_ANALYSIS.md` - DaVinci template structure
- `shared/schema.ts` - SLOT_TEMPLATE configuration
- `client/src/components/SlotSelector.tsx` - Main implementation file
- `client/src/pages/Editor*.tsx` - Scene editor components
