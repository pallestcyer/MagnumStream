# Fix: Recording Status Not Updating to "Completed" After Rendering

## Problem Summary

When finishing a DaVinci render, recordings were staying stuck in "in_progress" status instead of updating to "completed". This prevented them from appearing in the History page's completed tab and the Sales page.

## Root Cause

The status update to "completed" was happening **conditionally** in three different places in the code (after Drive upload succeeded, after Drive upload was skipped, and after Drive upload failed). This meant:

1. If any error occurred before reaching these update calls, the status wouldn't be set
2. The updates were scattered throughout the error handling paths
3. The update was using TypeScript type casting (`"completed" as any`) which might have issues

## Solution

**Moved the status update to happen IMMEDIATELY after DaVinci render succeeds**, before any Drive upload logic. This ensures:

1. ✅ Status is always set to "completed" when render finishes
2. ✅ Status update happens regardless of Drive upload success/failure
3. ✅ Recording appears in History and Sales immediately after render

### Code Changes

File: `server/routes.ts` (lines 644-656)

**Before:**
```typescript
if (stdout.includes('SUCCESS:')) {
  const outputPath = stdout.split('SUCCESS: ')[1]?.trim();
  console.log(`✅ DaVinci render completed: ${outputPath}`);

  // Copy the rendered video to Google Drive (local sync)
  let actualRecordingId = recordingId;
  // ... Drive upload logic ...
  // Status update happened AFTER Drive upload logic ❌
}
```

**After:**
```typescript
if (stdout.includes('SUCCESS:')) {
  const outputPath = stdout.split('SUCCESS: ')[1]?.trim();
  console.log(`✅ DaVinci render completed: ${outputPath}`);

  // IMPORTANT: Always update status to completed when render succeeds ✅
  console.log(`📊 Updating recording ${recordingId} status to completed...`);
  await storage.updateFlightRecording(recordingId, {
    exportStatus: "completed",
    localVideoPath: outputPath
  });
  console.log(`✅ Recording ${recordingId} marked as completed`);

  // Copy the rendered video to Google Drive (local sync)
  let actualRecordingId = recordingId;
  // ... Drive upload logic ...
}
```

### Additional Changes

Removed redundant status updates from:
- Line ~690: When Drive is not available
- Line ~750: After successful Drive upload
- Line ~784: After failed Drive upload

These locations now only update Drive-related fields (driveFileUrl, driveFolderUrl, etc.) since status is already set to "completed" earlier.

## How to Fix Existing Stuck Recordings

### Option 1: SQL Script (Fastest)

Run this in your Supabase SQL Editor:

```sql
-- Update all recordings that have a local_video_path but are not marked as completed
UPDATE flight_recordings
SET export_status = 'completed'
WHERE local_video_path IS NOT NULL
  AND export_status != 'completed';
```

See full script: `fix-stuck-recordings.sql`

### Option 2: TypeScript Script

Run the interactive TypeScript script:

```bash
npx tsx fix-stuck-recordings.ts
```

This will:
1. Find all recordings with `local_video_path` but not marked as "completed"
2. Show you what will be updated
3. Ask for confirmation
4. Update all stuck recordings

## Workflow Flow After Fix

```
1. User clicks "Start Export" in Recording phase
   └─> POST /api/recordings/{id}/render-davinci

2. Mac service generates clips with FFmpeg
   └─> Clips saved to ~/MagnumStream/projects/{id}/clips/

3. Mac service executes Davinci.py script
   └─> DaVinci Resolve renders video to ~/MagnumStream/rendered/

4. ✅ IMMEDIATELY: Status set to "completed" + localVideoPath saved
   └─> Recording now appears in History "Completed" tab

5. Mac service copies to Google Drive folder (if available)
   └─> Updates driveFileUrl and driveFolderUrl

6. Recording appears in Sales page (ready to sell)
```

## Testing the Fix

1. **Test with new recording:**
   - Complete a recording through the Editing phase
   - Click "Start Export" in Recording page
   - Wait for render to complete
   - Check History page - should immediately show as "completed"

2. **Test Drive upload failure:**
   - Temporarily disable Google Drive for Desktop
   - Complete a recording and export
   - Should still appear as "completed" in History
   - localVideoPath should be set for local playback

3. **Test existing stuck recordings:**
   - Run `fix-stuck-recordings.sql` or `fix-stuck-recordings.ts`
   - Refresh History page
   - All previously stuck recordings should now be in "Completed" tab

## Files Modified

- `server/routes.ts` - Main fix for status update logic
- `fix-stuck-recordings.sql` - SQL script to fix existing stuck recordings
- `fix-stuck-recordings.ts` - TypeScript script to fix existing stuck recordings
- `STATUS_UPDATE_FIX.md` - This documentation

## Prevention

The fix prevents this issue from occurring in the future by:
1. Setting status immediately after render success (before any Drive logic)
2. Making Drive upload purely optional (doesn't affect completion status)
3. Always saving localVideoPath for local playback fallback
