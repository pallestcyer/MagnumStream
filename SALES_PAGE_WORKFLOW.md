# Sales Page Workflow - Google Drive Integration

## Overview

The Sales Page displays rendered videos with seamless Google Drive integration. Staff can preview videos locally and get shareable links instantly.

## Complete Workflow

### 1. Video Rendering Complete
When DaVinci Resolve finishes rendering:
- ✅ Video saved to `~/MagnumStream/rendered/YYYY/MM-DD/CustomerName_TIMESTAMP.mp4`
- ✅ Automatically copied to `~/Library/CloudStorage/GoogleDrive-.../My Drive/MagnumStream_Videos/YYYY/MM-DD/`
- ✅ Google Drive syncs to cloud automatically
- ✅ Recording status updated to "completed"
- ✅ Video appears on Sales Page

### 2. Sales Page Display
Each video card shows:
- **Customer Name** - e.g., "Joe&Sam"
- **Flight Date & Time** - e.g., "2025-10-26 at 14:30"
- **Play Button** (hover overlay) - Preview video locally
- **Google Drive Icon** - Get shareable link
- **Create Sale Button** - Process purchase

### 3. Preview Video (Local)
**Click the Play button or thumbnail:**
- Opens the video file in QuickTime on the Mac
- Video plays from local Google Drive folder
- Fast preview without internet connection needed

### 4. Get Shareable Link (Google Drive)
**Click the Google Drive icon (ExternalLink):**
- Opens Google Drive web interface in new tab
- Searches for the specific video file
- Staff can right-click → Share → Copy link
- Link ready to send to customer

### 5. Complete Sale
**Click "Create Sale" button:**
- Opens purchase confirmation dialog
- Enter customer details (name, email, staff, bundle)
- System records the sale
- Video marked as "sold"

## Technical Details

### Database Schema
```typescript
flightRecordings {
  driveFileUrl: "googledrive:///MagnumStream_Videos/2025/10-October/26/Joe&Sam_20251026_143000.mp4"
  driveFileId: "MagnumStream_Videos/2025/10-October/26/Joe&Sam_20251026_143000.mp4"
  exportStatus: "completed"
}
```

### File Paths
- **Local Render**: `~/MagnumStream/rendered/2025/10-October/26/Joe&Sam_20251026_143000.mp4`
- **Google Drive Sync**: `~/Library/CloudStorage/GoogleDrive-.../My Drive/MagnumStream_Videos/2025/10-October/26/Joe&Sam_20251026_143000.mp4`
- **Web URL**: `https://drive.google.com/drive/search?q=Joe%26Sam_20251026_143000.mp4`

### API Endpoints

#### Open Local Video
```
POST /api/recordings/open-local-video
Body: { drivePath: "MagnumStream_Videos/2025/..." }
```
Opens the video file in QuickTime on the Mac for preview.

#### Render with Auto-Sync
```
POST /api/recordings/:recordingId/render-davinci
```
Renders video in DaVinci, automatically copies to Google Drive, and updates database.

## User Experience

### For Staff (Sales Page)
1. See all available videos in grid layout
2. Click Play → Video opens in QuickTime (instant preview)
3. Click Drive icon → Google Drive opens in browser
4. Right-click video → Share → Copy link
5. Click "Create Sale" → Record purchase
6. Send link to customer via email/SMS

### For Customers
- Receive shareable Google Drive link via email/SMS
- Click link → Video opens in Google Drive
- Can view online or download
- Access persists as long as link is active

## Benefits

✅ **No Re-Authentication** - Google Drive stays signed in
✅ **Instant Preview** - Local file opens immediately
✅ **Easy Sharing** - One click to Google Drive web interface
✅ **Automatic Sync** - Videos sync to cloud automatically
✅ **Organized Storage** - Date-based folder structure
✅ **Persistent Access** - Videos backed up in cloud

## Troubleshooting

### Video Won't Preview
- Check Google Drive for Desktop is running
- Verify file exists: `ls ~/Library/CloudStorage/GoogleDrive-*/My\ Drive/MagnumStream_Videos/`
- Check file permissions

### Can't Find Video in Drive
- Wait a few seconds for sync to complete
- Check Google Drive menu bar icon for sync status
- Search by customer name in drive.google.com

### Drive Icon Not Showing
- Video may not have synced yet (still rendering or copying)
- Check `exportStatus` is "completed"
- Verify `driveFileUrl` starts with "googledrive:///"

## Setup Requirements

1. **Google Drive for Desktop** installed and running
2. Signed in as `photos@magnumhelicopters.com`
3. Sync enabled for "My Drive"
4. MagnumStream service running

## File Structure

```
Google Drive/
└── My Drive/
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

This organized structure makes it easy to:
- Find videos by date
- Browse customer flights
- Manage storage over time
- Archive old content
