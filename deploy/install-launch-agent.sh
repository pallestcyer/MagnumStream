#!/bin/bash

# Installation script for MagnumStream LaunchAgent
# This sets up the service to run automatically on Mac startup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 MagnumStream LaunchAgent Installation${NC}"
echo "=========================================="
echo ""

# Get the current user
CURRENT_USER=$(whoami)
echo -e "${BLUE}📋 Current user: ${CURRENT_USER}${NC}"

# Define paths
PLIST_NAME="com.magnumstream.service.plist"
SOURCE_PLIST="$(pwd)/deploy/${PLIST_NAME}"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
TARGET_PLIST="${LAUNCH_AGENTS_DIR}/${PLIST_NAME}"
PROJECT_DIR="$HOME/MagnumStream"

echo ""
echo -e "${BLUE}📂 Checking paths...${NC}"
echo "   Source plist: ${SOURCE_PLIST}"
echo "   Target location: ${TARGET_PLIST}"
echo "   Project directory: ${PROJECT_DIR}"
echo ""

# Check if source plist exists
if [ ! -f "$SOURCE_PLIST" ]; then
    echo -e "${RED}❌ Error: plist file not found at ${SOURCE_PLIST}${NC}"
    echo "   Make sure you're running this from the MagnumStream project directory"
    exit 1
fi

# Create LaunchAgents directory if it doesn't exist
if [ ! -d "$LAUNCH_AGENTS_DIR" ]; then
    echo -e "${YELLOW}📁 Creating LaunchAgents directory...${NC}"
    mkdir -p "$LAUNCH_AGENTS_DIR"
fi

# Check if project directory exists
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${YELLOW}⚠️  Project directory not found at ${PROJECT_DIR}${NC}"
    echo -e "${YELLOW}   You'll need to ensure the project is cloned to this location${NC}"
    read -p "   Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Installation cancelled${NC}"
        exit 1
    fi
fi

# Stop existing service if running
if launchctl list | grep -q "com.magnumstream.service"; then
    echo -e "${YELLOW}🛑 Stopping existing service...${NC}"
    launchctl unload "$TARGET_PLIST" 2>/dev/null || true
    sleep 2
fi

# Copy plist to LaunchAgents directory
echo -e "${BLUE}📋 Installing LaunchAgent...${NC}"
cp "$SOURCE_PLIST" "$TARGET_PLIST"

# Set correct permissions
chmod 644 "$TARGET_PLIST"

echo -e "${GREEN}✅ LaunchAgent file installed${NC}"
echo ""

# Load the LaunchAgent
echo -e "${BLUE}🚀 Loading LaunchAgent...${NC}"
launchctl load "$TARGET_PLIST"

# Wait a moment for the service to start
sleep 3

# Check if service is running
if launchctl list | grep -q "com.magnumstream.service"; then
    echo -e "${GREEN}✅ Service is running!${NC}"
    echo ""
    echo -e "${BLUE}📊 Service Status:${NC}"
    launchctl list | grep "com.magnumstream.service"
else
    echo -e "${YELLOW}⚠️  Service loaded but may not be running yet${NC}"
    echo "   Check logs at: ${PROJECT_DIR}/logs/launchd-stdout.log"
fi

echo ""
echo -e "${GREEN}🎉 Installation complete!${NC}"
echo ""
echo -e "${BLUE}ℹ️  Important Information:${NC}"
echo "   • Service will start automatically on system boot"
echo "   • Service runs in background (no visible window)"
echo "   • Logs location: ${PROJECT_DIR}/logs/"
echo ""
echo -e "${BLUE}📝 Useful Commands:${NC}"
echo "   • Check status:  launchctl list | grep magnumstream"
echo "   • Stop service:  launchctl unload ${TARGET_PLIST}"
echo "   • Start service: launchctl load ${TARGET_PLIST}"
echo "   • View logs:     tail -f ${PROJECT_DIR}/logs/launchd-stdout.log"
echo "   • Uninstall:     ./deploy/uninstall-launch-agent.sh"
echo ""
