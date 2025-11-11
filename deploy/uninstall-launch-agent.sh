#!/bin/bash

# Uninstallation script for MagnumStream LaunchAgent
# This removes the auto-start service from macOS

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🗑️  MagnumStream LaunchAgent Uninstallation${NC}"
echo "============================================"
echo ""

# Define paths
PLIST_NAME="com.magnumstream.service.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
TARGET_PLIST="${LAUNCH_AGENTS_DIR}/${PLIST_NAME}"

echo -e "${BLUE}📂 Target: ${TARGET_PLIST}${NC}"
echo ""

# Check if LaunchAgent exists
if [ ! -f "$TARGET_PLIST" ]; then
    echo -e "${YELLOW}⚠️  LaunchAgent not found - nothing to uninstall${NC}"
    exit 0
fi

# Check if service is running
if launchctl list | grep -q "com.magnumstream.service"; then
    echo -e "${BLUE}🛑 Stopping service...${NC}"
    launchctl unload "$TARGET_PLIST"
    sleep 2
    echo -e "${GREEN}✅ Service stopped${NC}"
else
    echo -e "${YELLOW}⚠️  Service is not running${NC}"
fi

# Remove the plist file
echo -e "${BLUE}🗑️  Removing LaunchAgent file...${NC}"
rm "$TARGET_PLIST"
echo -e "${GREEN}✅ LaunchAgent file removed${NC}"

echo ""
echo -e "${GREEN}🎉 Uninstallation complete!${NC}"
echo ""
echo -e "${BLUE}ℹ️  Note:${NC}"
echo "   • The service will no longer start on system boot"
echo "   • Project files and logs are preserved"
echo "   • To manually start the service, run: ./deploy/start-mac-service.sh"
echo ""
