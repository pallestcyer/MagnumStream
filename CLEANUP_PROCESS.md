# Automatic Cleanup of FFmpeg Clips

## Overview

The Mac service now automatically removes old FFmpeg-generated clips to keep storage usage manageable. This cleanup runs automatically in the background without requiring any manual intervention.

## What Gets Cleaned Up

- **Project folders** in `~/MagnumStream/projects/{recordingId}/`
  - Source videos (cruising, chase, arrival recordings)
  - Generated clips (14 individual FFmpeg-generated clips)
  - DaVinci job files
  - Metadata files

## What Gets Kept

- ✅ **Final rendered videos** in `~/MagnumStream/rendered/` (NEVER deleted automatically)
- ✅ **Videos synced to Google Drive** (safe in the cloud)

## Cleanup Schedule

### When Cleanup Runs

1. **On service startup** - Runs immediately when `start-mac-service.sh` starts
2. **Every 24 hours** - Background job runs continuously while service is active

### Cleanup Criteria

- Projects **older than 24 hours** (modified more than 1 day ago) are deleted
- This gives plenty of time for renders to complete and Drive sync to finish
- Only intermediate working files are removed, never final rendered videos

## How It Works

### Automatic Process (No Setup Required!)

When you run `./deploy/start-mac-service.sh`:

1. ✅ Cleanup runs immediately to clear old projects
2. ✅ Background cleanup service starts (PID saved to logs)
3. ✅ Every 24 hours, cleanup runs again automatically
4. ✅ When you stop the service, cleanup background job stops too

### Logs

Check cleanup activity at:
```
~/MagnumStream/logs/cleanup.log
```

Example log output:
```
[2025-11-11 15:30:00] 🧹 Starting automatic cleanup of old FFmpeg clips...
[2025-11-11 15:30:01] 🗑️  Removing: john_doe_20251110 (modified: 2025-11-10 14:22, size: 2048MB)
[2025-11-11 15:30:05] ✅ Cleanup complete: Removed 1 project(s), freed 2048MB
[2025-11-11 15:30:05] 📊 Current projects: 2 directories, 1.5G total
[2025-11-11 15:30:05] 🏁 Cleanup finished
```

## Storage Management

### Typical Storage Pattern

```
Day 1 (Recording):
  projects/        2GB   (active recordings + clips)
  rendered/        500MB (final videos accumulate)

Day 2 (Auto cleanup):
  projects/        500MB (only current day's clips)
  rendered/        1GB   (final videos kept)

Day 7:
  projects/        500MB (only current day's clips)
  rendered/        3.5GB (week's worth of final videos)
```

### Manual Cleanup (Optional)

If you want to manually clean up old projects:
```bash
cd ~/MagnumStream
./cleanup-old-clips.sh
```

If you want to remove old rendered videos (use with caution!):
```bash
cd ~/MagnumStream
python3 cleanup-projects.py
# Select option 2: Remove old rendered files (7+ days)
```

## Monitoring

### Check Current Storage Usage

```bash
du -sh ~/MagnumStream/projects
du -sh ~/MagnumStream/rendered
```

### View Cleanup Logs

```bash
tail -f ~/MagnumStream/logs/cleanup.log
```

### Check Cleanup Service Status

```bash
# Check if cleanup service is running
ps aux | grep cleanup-old-clips.sh
```

## Benefits

1. ✅ **Automatic** - No manual intervention needed
2. ✅ **Safe** - Never deletes final rendered videos
3. ✅ **Efficient** - Keeps only current day's working files
4. ✅ **Reliable** - Runs as long as the Mac service is running
5. ✅ **Logged** - Full audit trail of what was cleaned and when

## Troubleshooting

### Cleanup Not Running

1. Check if the service is running:
   ```bash
   cat ~/MagnumStream/logs/cleanup.pid
   ps aux | grep [PID_FROM_ABOVE]
   ```

2. Check cleanup logs:
   ```bash
   tail ~/MagnumStream/logs/cleanup.log
   tail ~/MagnumStream/logs/cleanup-bg.log
   ```

### Storage Still Growing

Remember: **Final rendered videos are kept permanently** by design. These are your deliverables!

To manage rendered videos:
- Manually archive them to external storage
- Use Google Drive as your primary storage (videos auto-sync there)
- Periodically use `cleanup-projects.py` to remove very old rendered files

### Need to Keep Projects Longer

Edit `cleanup-old-clips.sh` and change:
```bash
# Change this line:
find "$PROJECTS_DIR" -maxdepth 1 -type d -mtime +1

# To keep for 3 days:
find "$PROJECTS_DIR" -maxdepth 1 -type d -mtime +3
```

Then restart the service.

## Summary

The cleanup process is **fully automatic** and requires **no manual intervention**. Just run `start-mac-service.sh` and it handles everything!

- Old project clips: **Auto-deleted after 24 hours**
- Final rendered videos: **Kept forever** (safe in `~/MagnumStream/rendered/`)
- Drive synced videos: **Safe in the cloud**
