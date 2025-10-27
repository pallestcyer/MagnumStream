#!/bin/bash

# Sync rendered videos to Google Drive and generate shareable links
# This script runs automatically after DaVinci Resolve completes rendering

set -e

# Configuration
RENDERED_DIR="$HOME/MagnumStream/rendered"
GOOGLE_DRIVE_BASE="$HOME/Library/CloudStorage/GoogleDrive-photos@magnumhelicopters.com/My Drive"
GOOGLE_DRIVE_FOLDER="$GOOGLE_DRIVE_BASE/MagnumStream_Videos"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 MagnumStream - Google Drive Sync${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if Google Drive is mounted
if [ ! -d "$GOOGLE_DRIVE_BASE" ]; then
    echo -e "${RED}❌ Google Drive not found!${NC}"
    echo "Expected location: $GOOGLE_DRIVE_BASE"
    echo "Please ensure Google Drive is running and signed in as photos@magnumhelicopters.com"
    exit 1
fi

echo -e "${GREEN}✅ Google Drive found${NC}"

# Create MagnumStream folder in Google Drive if it doesn't exist
mkdir -p "$GOOGLE_DRIVE_FOLDER"
echo -e "${GREEN}✅ Google Drive folder ready: MagnumStream_Videos${NC}"

# Function to sync a single video file
sync_video() {
    local video_file="$1"
    local relative_path="${video_file#$RENDERED_DIR/}"
    local year_month_day=$(dirname "$relative_path")
    local filename=$(basename "$video_file")

    # Create organized folder structure in Google Drive
    local drive_dest_dir="$GOOGLE_DRIVE_FOLDER/$year_month_day"
    mkdir -p "$drive_dest_dir"

    local drive_dest_file="$drive_dest_dir/$filename"

    # Check if file already exists and is identical
    if [ -f "$drive_dest_file" ]; then
        local src_size=$(stat -f%z "$video_file" 2>/dev/null || stat -c%s "$video_file" 2>/dev/null)
        local dst_size=$(stat -f%z "$drive_dest_file" 2>/dev/null || stat -c%s "$drive_dest_file" 2>/dev/null)

        if [ "$src_size" == "$dst_size" ]; then
            echo -e "${YELLOW}⏭️  Already synced: $filename${NC}"
            echo "   📍 $year_month_day/$filename"
            return 0
        fi
    fi

    # Copy file to Google Drive
    echo -e "${BLUE}📤 Uploading: $filename${NC}"
    echo "   📍 Destination: $year_month_day/$filename"

    cp "$video_file" "$drive_dest_file"

    # Wait for file to sync (check file size stability)
    echo -e "${YELLOW}⏳ Waiting for Google Drive to sync...${NC}"
    local prev_size=0
    local stable_count=0

    while [ $stable_count -lt 3 ]; do
        sleep 2
        local current_size=$(stat -f%z "$drive_dest_file" 2>/dev/null || stat -c%s "$drive_dest_file" 2>/dev/null || echo "0")

        if [ "$current_size" == "$prev_size" ] && [ "$current_size" != "0" ]; then
            ((stable_count++))
        else
            stable_count=0
        fi

        prev_size=$current_size
    done

    echo -e "${GREEN}✅ Synced successfully!${NC}"
    echo ""
}

# If a specific file is provided, sync only that file
if [ -n "$1" ]; then
    if [ ! -f "$1" ]; then
        echo -e "${RED}❌ File not found: $1${NC}"
        exit 1
    fi

    sync_video "$1"

    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ Sync complete!${NC}"
    echo ""
    echo -e "${BLUE}📋 To get a shareable link:${NC}"
    echo "   1. Open Google Drive in your browser"
    echo "   2. Navigate to: My Drive > MagnumStream_Videos"
    echo "   3. Right-click the video → Share → Copy link"
    echo ""
    echo -e "${YELLOW}💡 TIP: The video will automatically sync to Google Drive's cloud${NC}"
    echo "   You can share it once the upload icon disappears in Drive."

    exit 0
fi

# Otherwise, sync all videos in the rendered directory
echo "Scanning for videos to sync..."
echo ""

# Find all video files recursively
video_count=0
while IFS= read -r -d '' video_file; do
    sync_video "$video_file"
    ((video_count++))
done < <(find "$RENDERED_DIR" -type f \( -name "*.mp4" -o -name "*.mov" -o -name "*.avi" \) -print0 2>/dev/null)

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Sync complete! Processed $video_count video(s)${NC}"
echo ""
echo -e "${BLUE}📂 Videos are now in Google Drive:${NC}"
echo "   My Drive > MagnumStream_Videos"
echo ""
echo -e "${BLUE}📋 To get shareable links:${NC}"
echo "   1. Open Google Drive in your browser"
echo "   2. Navigate to: My Drive > MagnumStream_Videos"
echo "   3. Right-click any video → Share → Copy link"
echo ""
echo -e "${YELLOW}💡 TIP: Videos sync automatically to Google Drive's cloud${NC}"
echo "   You can share them once the upload icon disappears in Drive."
