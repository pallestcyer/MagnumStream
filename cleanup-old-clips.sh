#!/bin/bash

# Automatic cleanup script for old FFmpeg-generated clips
# This runs daily to remove project clips older than 1 day
# IMPORTANT: Always keeps the most recently RENDERED project's clips
# to ensure DaVinci always has valid media references

set -e

# Configuration
PROJECTS_DIR="$HOME/MagnumStream/projects"
RENDERED_DIR="$HOME/MagnumStream/rendered"
LOG_FILE="$HOME/MagnumStream/logs/cleanup.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "🧹 Starting automatic cleanup of old FFmpeg clips..."

# Check if projects directory exists
if [ ! -d "$PROJECTS_DIR" ]; then
    log "📂 No projects directory found at $PROJECTS_DIR"
    exit 0
fi

# Find the most recently rendered project by checking rendered output files
# The rendered files are named like: ProjectName_YYYYMMDD_HHMMSS.mp4
MOST_RECENT_RENDERED=""
if [ -d "$RENDERED_DIR" ]; then
    # Find most recent rendered file and extract project name from it
    MOST_RECENT_FILE=$(find "$RENDERED_DIR" -maxdepth 2 -name "*.mp4" -type f -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -1)
    if [ -n "$MOST_RECENT_FILE" ]; then
        # Get the parent directory name (which is the project folder name)
        MOST_RECENT_RENDERED=$(dirname "$MOST_RECENT_FILE" | xargs basename)
        log "🔒 Protecting most recently rendered project: $MOST_RECENT_RENDERED"
    fi
fi

# Also check for most recent project with a completed render marker or davinci job
if [ -z "$MOST_RECENT_RENDERED" ]; then
    # Fallback: find most recent project with davinci folder (indicates render was attempted)
    MOST_RECENT_RENDERED=$(find "$PROJECTS_DIR" -maxdepth 2 -type d -name "davinci" -print0 2>/dev/null | xargs -0 ls -dt 2>/dev/null | head -1 | xargs dirname 2>/dev/null | xargs basename 2>/dev/null)
    if [ -n "$MOST_RECENT_RENDERED" ]; then
        log "🔒 Protecting most recent project with DaVinci job: $MOST_RECENT_RENDERED"
    fi
fi

# Find and remove project directories older than 1 day
REMOVED_COUNT=0
TOTAL_SIZE=0
SKIPPED_COUNT=0

# Find directories older than 1 day (modified more than 24 hours ago)
while IFS= read -r -d '' project_dir; do
    PROJECT_NAME=$(basename "$project_dir")

    # Skip if this is the most recently rendered project
    if [ "$PROJECT_NAME" = "$MOST_RECENT_RENDERED" ]; then
        log "⏭️  Skipping (most recent render): $PROJECT_NAME"
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        continue
    fi

    # Calculate size before deletion
    SIZE=$(du -sk "$project_dir" 2>/dev/null | cut -f1)

    # Get last modification time for logging
    MOD_TIME=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$project_dir" 2>/dev/null || stat -c "%y" "$project_dir" 2>/dev/null | cut -d' ' -f1,2)

    log "🗑️  Removing: $PROJECT_NAME (modified: $MOD_TIME, size: $((SIZE / 1024))MB)"

    # Remove the project directory
    rm -rf "$project_dir"

    REMOVED_COUNT=$((REMOVED_COUNT + 1))
    TOTAL_SIZE=$((TOTAL_SIZE + SIZE))
done < <(find "$PROJECTS_DIR" -maxdepth 1 -type d -mtime +1 -not -path "$PROJECTS_DIR" -print0 2>/dev/null)

# Log summary
if [ $REMOVED_COUNT -eq 0 ] && [ $SKIPPED_COUNT -eq 0 ]; then
    log "✅ No old projects found (all projects modified within last 24 hours)"
elif [ $REMOVED_COUNT -eq 0 ] && [ $SKIPPED_COUNT -gt 0 ]; then
    log "✅ No projects removed (skipped $SKIPPED_COUNT as most recent render)"
else
    TOTAL_SIZE_MB=$((TOTAL_SIZE / 1024))
    log "✅ Cleanup complete: Removed $REMOVED_COUNT project(s), freed ${TOTAL_SIZE_MB}MB, kept $SKIPPED_COUNT (most recent render)"
fi

# Show current storage usage
if [ -d "$PROJECTS_DIR" ]; then
    CURRENT_PROJECTS=$(find "$PROJECTS_DIR" -maxdepth 1 -type d | wc -l)
    CURRENT_PROJECTS=$((CURRENT_PROJECTS - 1)) # Subtract the projects dir itself
    CURRENT_SIZE=$(du -sh "$PROJECTS_DIR" 2>/dev/null | cut -f1)
    log "📊 Current projects: $CURRENT_PROJECTS directories, $CURRENT_SIZE total"
fi

log "🏁 Cleanup finished"
