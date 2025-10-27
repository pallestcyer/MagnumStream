# Google Drive Integration for MagnumStream

This document explains how MagnumStream automatically syncs rendered videos to Google Drive and how to get shareable links.

## Overview

After DaVinci Resolve finishes rendering a video, it automatically:
1. ✅ Saves the video locally to `~/MagnumStream/rendered/YYYY/MM-DD/`
2. ✅ Copies the video to your Google Drive
3. ✅ Organizes it in `My Drive/MagnumStream_Videos/YYYY/MM-DD/`
4. ✅ Google Drive automatically syncs it to the cloud

**No re-authentication needed!** Once Google Drive is signed in on your Mac, it stays authenticated.

## Requirements

- **Google Drive for Desktop** installed and signed in
- Currently using account: `photos@magnumhelicopters.com`

## How It Works

### Automatic Sync

When DaVinci Resolve completes a render:

```
1. Video rendered → ~/MagnumStream/rendered/2025/10-October/26/Joe&Sam_20251026_143000.mp4
2. Auto-copied to → Google Drive/My Drive/MagnumStream_Videos/2025/10-October/26/
3. Google Drive syncs to cloud automatically
4. Ready to share!
```

### Folder Structure

Your Google Drive will have this organized structure:

```
My Drive/
└── MagnumStream_Videos/
    ├── 2025/
    │   ├── 10-October/
    │   │   ├── 25/
    │   │   │   ├── Emily_20251025_120000.mp4
    │   │   │   └── Joe&Sam_20251025_153000.mp4
    │   │   └── 26/
    │   │       └── Mike_20251026_143000.mp4
    │   └── 11-November/
    │       └── ...
```

## Getting Shareable Links

### Method 1: Command Line (Recommended)

```bash
# Show all recent videos and open Drive folder
./get-drive-link.sh

# Search for a specific customer's videos
./get-drive-link.sh "Joe&Sam"
./get-drive-link.sh "Emily"
```

This will:
- 🔍 Find matching videos
- 📂 Open the folder in Finder
- 📋 Show file details (size, date, location)

### Method 2: Finder

1. Navigate to the file in Finder
2. Right-click the video → **Share** → **Copy Link**
3. Paste the link anywhere

### Method 3: Web Browser

1. Go to [drive.google.com](https://drive.google.com)
2. Navigate to: **My Drive** → **MagnumStream_Videos**
3. Right-click the video → **Share** → **Copy link**

## Manual Sync

If you need to manually sync videos (e.g., if auto-sync failed):

```bash
# Sync all rendered videos
./sync-to-drive.sh

# Sync a specific video
./sync-to-drive.sh ~/MagnumStream/rendered/2025/10-October/26/Customer_20251026_120000.mp4
```

## Troubleshooting

### Google Drive Not Found

If you see "Google Drive not found" when starting the service:

1. **Check if Google Drive is running:**
   ```bash
   ls ~/Library/CloudStorage/
   ```
   You should see a folder like `GoogleDrive-photos@magnumhelicopters.com`

2. **If not found:**
   - Open **Google Drive for Desktop** from Applications
   - Sign in with `photos@magnumhelicopters.com`
   - Wait for it to sync
   - Restart the MagnumStream service

### Videos Not Syncing

If videos aren't appearing in Google Drive:

1. **Check sync status:**
   ```bash
   ./sync-to-drive.sh
   ```

2. **Manually verify Google Drive:**
   ```bash
   ls -la ~/Library/CloudStorage/GoogleDrive-*/My\ Drive/MagnumStream_Videos/
   ```

3. **Check Google Drive is syncing:**
   - Look for the Google Drive icon in your Mac menu bar
   - Click it to see sync status
   - Make sure sync is not paused

### Re-authentication

**You should NOT need to re-authenticate!** Google Drive for Desktop stays signed in even after Mac restarts.

If you ARE being asked to re-authenticate:
- This is a Google Drive app issue, not MagnumStream
- Simply sign in once through Google Drive for Desktop
- It will remember your credentials

## Service Startup

The `start-mac-service.sh` script automatically checks Google Drive status:

```bash
☁️  Checking Google Drive...
✅ Google Drive found: /Users/you/Library/CloudStorage/GoogleDrive-photos@magnumhelicopters.com
   Account: photos@magnumhelicopters.com
   Videos will sync to: My Drive/MagnumStream_Videos
✅ Google Drive sync script ready
```

## Video Sharing Workflow

### Typical Workflow:

1. **Customer completes flight** → DaVinci renders video
2. **Video auto-syncs to Google Drive** → No action needed
3. **Get shareable link:**
   ```bash
   ./get-drive-link.sh "CustomerName"
   ```
4. **Right-click in Finder** → Share → Copy Link
5. **Send link to customer** via email/SMS

### Link Permissions

By default, links are private to your Google account. To share with customers:

1. Get the link using methods above
2. Click **Share** or **Manage access**
3. Change permissions:
   - **Restricted** → Only specific people
   - **Anyone with the link** → Anyone can view (recommended for customers)

## Advanced Features

### Bulk Sync All Videos

Sync all videos from rendered folder:

```bash
./sync-to-drive.sh
```

### Check What's in Drive

List all videos currently in Google Drive:

```bash
./get-drive-link.sh
```

### Find Videos by Date

```bash
ls ~/Library/CloudStorage/GoogleDrive-*/My\ Drive/MagnumStream_Videos/2025/10-October/26/
```

## Benefits

✅ **No authentication hassles** - Google Drive stays signed in
✅ **Automatic organization** - Videos organized by date
✅ **Cloud backup** - Videos backed up to Google's servers
✅ **Easy sharing** - Right-click to get shareable links
✅ **Accessible anywhere** - View videos from any device
✅ **Integrated workflow** - Everything happens automatically

## Support

If you encounter issues:

1. Check Google Drive is running (menu bar icon)
2. Run diagnostics: `./sync-to-drive.sh`
3. Check logs: `~/MagnumStream/logs/server.log`
4. Restart Google Drive for Desktop
5. Restart MagnumStream service: `./deploy/start-mac-service.sh`
