#!/bin/bash

# Helper script to open Google Drive folder and get shareable links
# Usage: ./get-drive-link.sh [customer_name]

# Configuration
GOOGLE_DRIVE_BASE="$HOME/Library/CloudStorage/GoogleDrive-photos@magnumhelicopters.com/My Drive"
GOOGLE_DRIVE_FOLDER="$GOOGLE_DRIVE_BASE/MagnumStream_Videos"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔗 MagnumStream - Google Drive Link Helper${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if Google Drive is available
if [ ! -d "$GOOGLE_DRIVE_BASE" ]; then
    echo -e "${RED}❌ Google Drive not found!${NC}"
    echo "Expected location: $GOOGLE_DRIVE_BASE"
    echo "Please ensure Google Drive is running and signed in."
    exit 1
fi

# Check if MagnumStream folder exists
if [ ! -d "$GOOGLE_DRIVE_FOLDER" ]; then
    echo -e "${YELLOW}⚠️  MagnumStream_Videos folder not found${NC}"
    echo "Creating folder..."
    mkdir -p "$GOOGLE_DRIVE_FOLDER"
fi

# If a customer name is provided, search for their videos
if [ -n "$1" ]; then
    customer_name="$1"
    echo -e "${BLUE}🔍 Searching for videos matching: $customer_name${NC}"
    echo ""

    # Find videos matching the customer name
    found_videos=()
    while IFS= read -r -d '' video_file; do
        found_videos+=("$video_file")
    done < <(find "$GOOGLE_DRIVE_FOLDER" -type f \( -name "*$customer_name*" -o -iname "*$customer_name*" \) \( -name "*.mp4" -o -name "*.mov" -o -name "*.avi" \) -print0 2>/dev/null)

    if [ ${#found_videos[@]} -eq 0 ]; then
        echo -e "${YELLOW}No videos found matching '$customer_name'${NC}"
        echo ""
        echo "Recent videos in Drive:"
        find "$GOOGLE_DRIVE_FOLDER" -type f \( -name "*.mp4" -o -name "*.mov" -o -name "*.avi" \) -exec stat -f "%Sm %N" -t "%Y-%m-%d %H:%M" {} \; 2>/dev/null | sort -r | head -5
        exit 0
    fi

    echo -e "${GREEN}Found ${#found_videos[@]} video(s):${NC}"
    echo ""

    for i in "${!found_videos[@]}"; do
        video="${found_videos[$i]}"
        filename=$(basename "$video")
        relative_path="${video#$GOOGLE_DRIVE_FOLDER/}"
        file_size=$(stat -f "%z" "$video" 2>/dev/null | awk '{printf "%.1f MB", $1/1024/1024}')
        modified=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$video" 2>/dev/null)

        echo -e "${BLUE}[$((i+1))]${NC} $filename"
        echo "    📍 $relative_path"
        echo "    📦 Size: $file_size"
        echo "    📅 Modified: $modified"
        echo ""
    done

    # Open the folder in Finder for easy sharing
    if [ ${#found_videos[@]} -eq 1 ]; then
        echo -e "${GREEN}Opening video location in Finder...${NC}"
        open -R "${found_videos[0]}"
    else
        echo -e "${GREEN}Opening MagnumStream_Videos folder in Finder...${NC}"
        open "$GOOGLE_DRIVE_FOLDER"
    fi
else
    # No search term - show recent videos
    echo -e "${BLUE}📹 Recent videos in Google Drive:${NC}"
    echo ""

    # Find and display the 10 most recent videos
    recent_videos=()
    while IFS= read -r line; do
        recent_videos+=("$line")
    done < <(find "$GOOGLE_DRIVE_FOLDER" -type f \( -name "*.mp4" -o -name "*.mov" -o -name "*.avi" \) -exec stat -f "%m %N" {} \; 2>/dev/null | sort -rn | head -10)

    if [ ${#recent_videos[@]} -eq 0 ]; then
        echo -e "${YELLOW}No videos found in Google Drive yet${NC}"
        echo "Rendered videos will appear here automatically after DaVinci processing."
    else
        for i in "${!recent_videos[@]}"; do
            # Parse stat output: timestamp filepath
            timestamp=$(echo "${recent_videos[$i]}" | awk '{print $1}')
            filepath=$(echo "${recent_videos[$i]}" | cut -d' ' -f2-)
            filename=$(basename "$filepath")
            relative_path="${filepath#$GOOGLE_DRIVE_FOLDER/}"
            file_size=$(stat -f "%z" "$filepath" 2>/dev/null | awk '{printf "%.1f MB", $1/1024/1024}')
            modified=$(date -r "$timestamp" "+%Y-%m-%d %H:%M" 2>/dev/null)

            echo -e "${BLUE}[$((i+1))]${NC} $filename"
            echo "    📍 $relative_path"
            echo "    📦 Size: $file_size"
            echo "    📅 Modified: $modified"
            echo ""
        done
    fi

    echo -e "${GREEN}Opening MagnumStream_Videos folder in Finder...${NC}"
    open "$GOOGLE_DRIVE_FOLDER"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📋 To get a shareable link:${NC}"
echo "   1. In Finder, right-click the video file"
echo "   2. Select 'Share' → 'Copy Link'"
echo "   3. Paste the link wherever you need it"
echo ""
echo -e "${YELLOW}💡 Alternative method:${NC}"
echo "   1. Open drive.google.com in your browser"
echo "   2. Navigate to: My Drive → MagnumStream_Videos"
echo "   3. Right-click the video → Share → Copy link"
echo ""
echo -e "${GREEN}✨ The link will work for anyone with access to your Drive!${NC}"
