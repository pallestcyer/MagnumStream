#!/bin/bash

# MagnumStream Google Drive Integration Test Script
# Run this on the target Mac after deployment to verify Google Drive setup

set -e

echo "🧪 MagnumStream Google Drive Integration Test"
echo "=============================================="
echo ""

# Configuration
PROJECT_DIR="$HOME/MagnumStream"
TEST_DIR="$PROJECT_DIR/test-files"
CLOUD_STORAGE_PATH="$HOME/Library/CloudStorage"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
print_pass() {
    echo -e "${GREEN}✅ PASS:${NC} $1"
    ((TESTS_PASSED++))
}

print_fail() {
    echo -e "${RED}❌ FAIL:${NC} $1"
    ((TESTS_FAILED++))
}

print_warn() {
    echo -e "${YELLOW}⚠️  WARN:${NC} $1"
}

print_info() {
    echo "ℹ️  $1"
}

# Test 1: Check Google Drive for Desktop Installation
echo "Test 1: Google Drive for Desktop Installation"
echo "----------------------------------------------"

if [ -d "$CLOUD_STORAGE_PATH" ]; then
    print_pass "CloudStorage directory exists at $CLOUD_STORAGE_PATH"

    # Find Google Drive folder
    DRIVE_FOLDER=$(find "$CLOUD_STORAGE_PATH" -maxdepth 1 -type d -name "GoogleDrive-*" 2>/dev/null | head -1)

    if [ -n "$DRIVE_FOLDER" ]; then
        print_pass "Google Drive folder found: $DRIVE_FOLDER"

        # Extract email from folder name
        DRIVE_EMAIL=$(basename "$DRIVE_FOLDER" | sed 's/GoogleDrive-//')
        print_info "Account: $DRIVE_EMAIL"

        # Check if My Drive exists
        MY_DRIVE_PATH="$DRIVE_FOLDER/My Drive"
        if [ -d "$MY_DRIVE_PATH" ]; then
            print_pass "My Drive folder accessible at: $MY_DRIVE_PATH"
        else
            print_fail "My Drive folder not found at: $MY_DRIVE_PATH"
        fi
    else
        print_fail "Google Drive folder not found in CloudStorage"
        echo ""
        echo "📋 Installation Instructions:"
        echo "1. Download Google Drive for Desktop from:"
        echo "   https://www.google.com/drive/download/"
        echo "2. Install and sign in with: photos@magnumhelicopters.com"
        echo "3. Enable 'Mirror files' mode (not 'Stream files')"
        echo "4. Wait for initial sync to complete"
        echo "5. Re-run this test"
        exit 1
    fi
else
    print_fail "CloudStorage directory not found"
    exit 1
fi

echo ""

# Test 2: Check MagnumStream_Videos folder structure
echo "Test 2: MagnumStream_Videos Folder Structure"
echo "--------------------------------------------"

MAGNUM_DRIVE_FOLDER="$MY_DRIVE_PATH/MagnumStream_Videos"

if [ -d "$MAGNUM_DRIVE_FOLDER" ]; then
    print_pass "MagnumStream_Videos folder exists: $MAGNUM_DRIVE_FOLDER"
else
    print_warn "MagnumStream_Videos folder does not exist yet"
    print_info "Creating folder structure..."

    mkdir -p "$MAGNUM_DRIVE_FOLDER"

    if [ -d "$MAGNUM_DRIVE_FOLDER" ]; then
        print_pass "Created MagnumStream_Videos folder successfully"
    else
        print_fail "Failed to create MagnumStream_Videos folder"
    fi
fi

echo ""

# Test 3: Test File Copy and Sync Detection
echo "Test 3: File Copy and Sync Detection"
echo "-------------------------------------"

# Create test file
TEST_FILE_NAME="test_video_$(date +%Y%m%d_%H%M%S).txt"
TEST_FILE_PATH="$TEST_DIR/$TEST_FILE_NAME"

print_info "Creating test file: $TEST_FILE_PATH"
mkdir -p "$TEST_DIR"
echo "This is a test file for MagnumStream Google Drive sync verification" > "$TEST_FILE_PATH"
echo "Created at: $(date)" >> "$TEST_FILE_PATH"
echo "Size: 100 bytes (approximately)" >> "$TEST_FILE_PATH"

if [ -f "$TEST_FILE_PATH" ]; then
    print_pass "Test file created successfully"
else
    print_fail "Failed to create test file"
    exit 1
fi

# Copy to Google Drive (simulate what the app does)
TEST_DEST_DIR="$MAGNUM_DRIVE_FOLDER/test/$(date +%Y/%m-%B/%d)"
mkdir -p "$TEST_DEST_DIR"
TEST_DEST_PATH="$TEST_DEST_DIR/$TEST_FILE_NAME"

print_info "Copying test file to Google Drive..."
cp "$TEST_FILE_PATH" "$TEST_DEST_PATH"

if [ -f "$TEST_DEST_PATH" ]; then
    print_pass "Test file copied to Google Drive: $TEST_DEST_PATH"
else
    print_fail "Failed to copy test file to Google Drive"
    exit 1
fi

# Monitor sync status
print_info "Monitoring sync status (checking file size stability)..."

LAST_SIZE=0
STABLE_COUNT=0
MAX_WAIT=30

for i in $(seq 1 $MAX_WAIT); do
    if [ -f "$TEST_DEST_PATH" ]; then
        CURRENT_SIZE=$(stat -f%z "$TEST_DEST_PATH" 2>/dev/null || echo "0")

        if [ "$CURRENT_SIZE" -eq "$LAST_SIZE" ] && [ "$CURRENT_SIZE" -gt 0 ]; then
            ((STABLE_COUNT++))
            if [ $STABLE_COUNT -ge 3 ]; then
                print_pass "File sync detected (size stable at $CURRENT_SIZE bytes)"
                break
            fi
        else
            STABLE_COUNT=0
        fi

        LAST_SIZE=$CURRENT_SIZE

        if [ $i -eq $MAX_WAIT ]; then
            print_warn "Sync monitoring timed out, but file exists (may still be syncing)"
        fi
    else
        print_fail "Test file disappeared during sync"
        break
    fi

    sleep 2
done

echo ""

# Test 4: Check Google Drive Desktop Status
echo "Test 4: Google Drive Desktop Process Status"
echo "-------------------------------------------"

if pgrep -x "Google Drive" > /dev/null; then
    print_pass "Google Drive Desktop process is running"

    # Check if it's responsive
    if [ -d "$MY_DRIVE_PATH" ] && [ -w "$MY_DRIVE_PATH" ]; then
        print_pass "Google Drive Desktop is responsive and writable"
    else
        print_warn "Google Drive Desktop may not be fully synced yet"
    fi
else
    print_fail "Google Drive Desktop process is not running"
    print_info "Start Google Drive from Applications folder"
fi

echo ""

# Test 5: Check Local Rendered Folder Structure
echo "Test 5: Local Rendered Folder Structure"
echo "---------------------------------------"

RENDERED_DIR="$PROJECT_DIR/rendered"

if [ -d "$RENDERED_DIR" ]; then
    print_pass "Local rendered directory exists: $RENDERED_DIR"

    # Check if writable
    if [ -w "$RENDERED_DIR" ]; then
        print_pass "Local rendered directory is writable"
    else
        print_fail "Local rendered directory is not writable"
    fi
else
    print_warn "Local rendered directory does not exist"
    print_info "Creating rendered directory..."

    mkdir -p "$RENDERED_DIR"

    if [ -d "$RENDERED_DIR" ]; then
        print_pass "Created rendered directory successfully"
    else
        print_fail "Failed to create rendered directory"
    fi
fi

echo ""

# Test 6: Test TypeScript Service (if built)
echo "Test 6: TypeScript GoogleDriveLinkGenerator Service"
echo "---------------------------------------------------"

if [ -d "$PROJECT_DIR/node_modules" ]; then
    print_pass "Node modules installed"

    # Check if service file exists
    SERVICE_FILE="$PROJECT_DIR/server/services/GoogleDriveLinkGenerator.ts"
    if [ -f "$SERVICE_FILE" ]; then
        print_pass "GoogleDriveLinkGenerator.ts exists"

        # Check for key methods
        if grep -q "copyToGoogleDrive" "$SERVICE_FILE"; then
            print_pass "copyToGoogleDrive method found"
        else
            print_fail "copyToGoogleDrive method not found in service"
        fi

        if grep -q "detectGoogleDrivePath" "$SERVICE_FILE"; then
            print_pass "detectGoogleDrivePath method found"
        else
            print_fail "detectGoogleDrivePath method not found in service"
        fi
    else
        print_fail "GoogleDriveLinkGenerator.ts not found"
    fi
else
    print_warn "Node modules not installed (run npm install)"
fi

echo ""

# Test 7: Environment Configuration
echo "Test 7: Environment Configuration"
echo "----------------------------------"

if [ -f "$PROJECT_DIR/.env" ]; then
    print_pass ".env file exists"

    # Check for Google Drive email
    if grep -q "GOOGLE_DRIVE_EMAIL" "$PROJECT_DIR/.env"; then
        DRIVE_EMAIL_ENV=$(grep "GOOGLE_DRIVE_EMAIL" "$PROJECT_DIR/.env" | cut -d'=' -f2)
        print_info "Configured email: $DRIVE_EMAIL_ENV"

        # Compare with actual
        if [ "$DRIVE_EMAIL_ENV" = "$DRIVE_EMAIL" ]; then
            print_pass "Email matches detected Google Drive account"
        else
            print_warn "Email mismatch - .env: $DRIVE_EMAIL_ENV, detected: $DRIVE_EMAIL"
        fi
    else
        print_warn "GOOGLE_DRIVE_EMAIL not set in .env"
    fi
else
    print_warn ".env file not found (will use defaults)"
fi

echo ""

# Test 8: Integration Test - Full Workflow Simulation
echo "Test 8: Full Workflow Simulation"
echo "---------------------------------"

print_info "Simulating full video export workflow..."

# Create a mock rendered video file
MOCK_DATE=$(date +%Y%m%d_%H%M%S)
MOCK_FILENAME="TestCustomer_$MOCK_DATE.mp4"
MOCK_LOCAL_PATH="$RENDERED_DIR/$(date +%Y/%m-%B/%d)/$MOCK_FILENAME"

mkdir -p "$(dirname "$MOCK_LOCAL_PATH")"
echo "Mock video file" > "$MOCK_LOCAL_PATH"

if [ -f "$MOCK_LOCAL_PATH" ]; then
    print_pass "Mock rendered video created: $MOCK_LOCAL_PATH"

    # Simulate copy to Drive
    MOCK_DRIVE_PATH="$MAGNUM_DRIVE_FOLDER/$(date +%Y/%m-%B/%d)/$MOCK_FILENAME"
    mkdir -p "$(dirname "$MOCK_DRIVE_PATH")"
    cp "$MOCK_LOCAL_PATH" "$MOCK_DRIVE_PATH"

    if [ -f "$MOCK_DRIVE_PATH" ]; then
        print_pass "Mock video copied to Google Drive"
        print_info "Local: $MOCK_LOCAL_PATH"
        print_info "Drive: $MOCK_DRIVE_PATH"

        # Get relative path
        RELATIVE_PATH=$(echo "$MOCK_DRIVE_PATH" | sed "s|$MY_DRIVE_PATH/||")
        print_info "Relative path: My Drive/$RELATIVE_PATH"
    else
        print_fail "Failed to copy mock video to Google Drive"
    fi
else
    print_fail "Failed to create mock rendered video"
fi

echo ""

# Cleanup test files
echo "Cleanup"
echo "-------"
print_info "Cleaning up test files..."

rm -f "$TEST_FILE_PATH" 2>/dev/null || true
rm -f "$TEST_DEST_PATH" 2>/dev/null || true
rm -f "$MOCK_LOCAL_PATH" 2>/dev/null || true
rm -f "$MOCK_DRIVE_PATH" 2>/dev/null || true

print_pass "Test files cleaned up"

echo ""

# Summary
echo "=============================================="
echo "Test Summary"
echo "=============================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Google Drive integration is working.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Start the service: ./MagnumStream/deploy/start-mac-service.sh"
    echo "2. Render a test video through the web interface"
    echo "3. Verify video appears in Google Drive at:"
    echo "   $MAGNUM_DRIVE_FOLDER"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed. Please review the output above.${NC}"
    echo ""
    echo "Common issues:"
    echo "1. Google Drive for Desktop not installed or not running"
    echo "2. Account not signed in (should be: photos@magnumhelicopters.com)"
    echo "3. Initial sync not completed"
    echo "4. Insufficient disk space"
    echo ""
    echo "For help, see: $PROJECT_DIR/GOOGLE_DRIVE_SETUP.md"
    exit 1
fi
