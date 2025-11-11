#!/bin/bash

# Automatic cleanup script for old FFmpeg-generated clips
# This runs daily to remove project clips older than 1 day
# Keeps rendered videos and removes only intermediate clips

set -e

# Configuration
PROJECTS_DIR="$HOME/MagnumStream/projects"
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

# Find and remove project directories older than 1 day
REMOVED_COUNT=0
TOTAL_SIZE=0

# Find directories older than 1 day (modified more than 24 hours ago)
while IFS= read -r -d '' project_dir; do
    # Calculate size before deletion
    SIZE=$(du -sk "$project_dir" 2>/dev/null | cut -f1)
    PROJECT_NAME=$(basename "$project_dir")

    # Get last modification time for logging
    MOD_TIME=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$project_dir" 2>/dev/null || stat -c "%y" "$project_dir" 2>/dev/null | cut -d' ' -f1,2)

    log "🗑️  Removing: $PROJECT_NAME (modified: $MOD_TIME, size: $((SIZE / 1024))MB)"

    # Remove the project directory
    rm -rf "$project_dir"

    REMOVED_COUNT=$((REMOVED_COUNT + 1))
    TOTAL_SIZE=$((TOTAL_SIZE + SIZE))
done < <(find "$PROJECTS_DIR" -maxdepth 1 -type d -mtime +1 -not -path "$PROJECTS_DIR" -print0 2>/dev/null)

# Log summary
if [ $REMOVED_COUNT -eq 0 ]; then
    log "✅ No old projects found (all projects modified within last 24 hours)"
else
    TOTAL_SIZE_MB=$((TOTAL_SIZE / 1024))
    log "✅ Cleanup complete: Removed $REMOVED_COUNT project(s), freed ${TOTAL_SIZE_MB}MB"
fi

# Show current storage usage
if [ -d "$PROJECTS_DIR" ]; then
    CURRENT_PROJECTS=$(find "$PROJECTS_DIR" -maxdepth 1 -type d | wc -l)
    CURRENT_PROJECTS=$((CURRENT_PROJECTS - 1)) # Subtract the projects dir itself
    CURRENT_SIZE=$(du -sh "$PROJECTS_DIR" 2>/dev/null | cut -f1)
    log "📊 Current projects: $CURRENT_PROJECTS directories, $CURRENT_SIZE total"
fi

log "🏁 Cleanup finished"
