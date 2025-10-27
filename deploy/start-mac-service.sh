#!/bin/bash

# MagnumStream Local Device Service Startup Script for Mac
# This script starts the local video processing service and ngrok tunnel

set -e

# Configuration
PROJECT_DIR="$HOME/MagnumStream"
LOG_DIR="$PROJECT_DIR/logs"
NGROK_LOG="$LOG_DIR/ngrok.log"
SERVER_LOG="$LOG_DIR/server.log"
DAVINCI_LOG="$LOG_DIR/davinci.log"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

echo "🚀 Starting MagnumStream Local Device Service..."

# Check if project directory exists
if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ Project directory not found at $PROJECT_DIR"
    echo "Please clone the repository first:"
    echo "git clone https://github.com/your-repo/MagnumStream $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the project
echo "🔨 Building project..."
npm run build

# Check Google Drive
echo "☁️  Checking Google Drive..."
GOOGLE_DRIVE_PATH="$HOME/Library/CloudStorage"
GOOGLE_DRIVE_FOUND=false

if [ -d "$GOOGLE_DRIVE_PATH" ]; then
    # Look for GoogleDrive folder
    DRIVE_FOLDER=$(find "$GOOGLE_DRIVE_PATH" -maxdepth 1 -type d -name "GoogleDrive-*" 2>/dev/null | head -1)

    if [ -n "$DRIVE_FOLDER" ]; then
        echo "✅ Google Drive found: $DRIVE_FOLDER"
        GOOGLE_DRIVE_FOUND=true

        # Extract email from folder name
        DRIVE_EMAIL=$(basename "$DRIVE_FOLDER" | sed 's/GoogleDrive-//')
        echo "   Account: $DRIVE_EMAIL"
        echo "   Videos will sync to: My Drive/MagnumStream_Videos"
    fi
fi

if [ "$GOOGLE_DRIVE_FOUND" = false ]; then
    echo "⚠️  Google Drive not found or not running"
    echo "   Rendered videos will be saved locally only"
    echo "   To enable auto-sync to Drive:"
    echo "   1. Install Google Drive for Desktop"
    echo "   2. Sign in with your account"
    echo "   3. Restart this service"
fi

# Make sync script executable if it exists
SYNC_SCRIPT="$PROJECT_DIR/sync-to-drive.sh"
if [ -f "$SYNC_SCRIPT" ]; then
    chmod +x "$SYNC_SCRIPT"
    echo "✅ Google Drive sync script ready"
fi

# Check Python and DaVinci Resolve setup
echo "🐍 Checking Python and DaVinci Resolve setup..."

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3 for DaVinci automation."
    echo "   Install via: brew install python3"
    exit 1
fi

echo "✅ Python 3 found: $(python3 --version)"

# Check if DaVinci Resolve is installed (look for common installation paths)
DAVINCI_PATHS=(
    "/Applications/DaVinci Resolve/DaVinci Resolve.app"
    "/Applications/DaVinci Resolve Studio/DaVinci Resolve.app"
)

DAVINCI_FOUND=false
for path in "${DAVINCI_PATHS[@]}"; do
    if [ -d "$path" ]; then
        echo "✅ DaVinci Resolve found: $path"
        DAVINCI_FOUND=true
        break
    fi
done

if [ "$DAVINCI_FOUND" = false ]; then
    echo "⚠️  DaVinci Resolve not found in standard locations."
    echo "   Please ensure DaVinci Resolve Studio is installed for video rendering."
    echo "   Download from: https://www.blackmagicdesign.com/products/davinciresolve"
    echo "   Note: Studio version required for scripting API"
fi

# Make DaVinci script executable
if [ -f "$PROJECT_DIR/Davinci.py" ]; then
    chmod +x "$PROJECT_DIR/Davinci.py"
    echo "✅ DaVinci automation script ready"
else
    echo "⚠️  DaVinci.py not found at $PROJECT_DIR/Davinci.py"
fi

# Setup DaVinci Resolve Python API environment
echo "🔧 Setting up DaVinci Resolve Python API environment..."
export RESOLVE_SCRIPT_LIB="/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so"
export RESOLVE_SCRIPT_API="/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting"
export PYTHONPATH="${PYTHONPATH}:/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules"

# Test DaVinci Python API
echo "🔧 Testing DaVinci Resolve Python API..."
python3 -c "
try:
    import DaVinciResolveScript as dvr
    resolve = dvr.scriptapp('Resolve')
    if resolve:
        print('✅ DaVinci Resolve Python API connected successfully')
    else:
        print('⚠️  DaVinci Resolve not running or scripting not enabled')
        print('   Please enable: DaVinci Resolve > Preferences > System > General > External scripting using > Network')
except ImportError:
    print('⚠️  DaVinci Resolve Python API not available')
    print('   Please check DaVinci Resolve installation')
" 2>/dev/null || echo "⚠️  Could not test DaVinci API"

# Pre-start DaVinci Resolve in background if available
echo "🎬 Pre-starting DaVinci Resolve in background..."
DAVINCI_PRESTART_PATHS=(
    "/Applications/DaVinci Resolve/DaVinci Resolve.app"
    "/Applications/DaVinci Resolve Studio/DaVinci Resolve.app"
)

DAVINCI_STARTED=false
for path in "${DAVINCI_PRESTART_PATHS[@]}"; do
    if [ -d "$path" ]; then
        echo "🎬 Starting DaVinci Resolve in background: $path"
        # Use 'open -g' to start in background without stealing focus
        open -g "$path" 2>/dev/null &
        DAVINCI_STARTED=true
        echo "✅ DaVinci Resolve started in background (will minimize automatically during render)"
        break
    fi
done

if [ "$DAVINCI_STARTED" = false ]; then
    echo "⚠️  DaVinci Resolve not started (will auto-start when needed)"
fi

# Start the Express server in background
echo "🖥️  Starting local video processing server..."
nohup npm start > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > "$LOG_DIR/server.pid"

# Wait for server to start
sleep 3

# Check if server started successfully
if ! curl -s http://localhost:3001/api/health > /dev/null; then
    echo "❌ Server failed to start. Check logs at $SERVER_LOG"
    exit 1
fi

echo "✅ Server started successfully (PID: $SERVER_PID)"

# Start ngrok tunnel
echo "🌐 Starting ngrok tunnel..."

# Check authentication status
AUTH_STATUS=$(ngrok config check 2>&1)
if echo "$AUTH_STATUS" | grep -q "authtoken" && ! echo "$AUTH_STATUS" | grep -q "not found"; then
    echo "✅ Using authenticated ngrok (stable URL)"
else
    echo "⚠️  Using unauthenticated ngrok (URL will change on restart)"
    echo "   To authenticate: ngrok authtoken YOUR_TOKEN"
fi

echo "🔍 Starting ngrok with verbose logging..."
# For now, remove auth token to use free version
export NGROK_AUTHTOKEN=""
nohup ngrok http 3001 --log=stdout --log-level=info > "$NGROK_LOG" 2>&1 &
NGROK_PID=$!
echo $NGROK_PID > "$LOG_DIR/ngrok.pid"

# Show immediate ngrok output for debugging
echo "📋 Initial ngrok output:"
sleep 2
head -20 "$NGROK_LOG" 2>/dev/null || echo "No log output yet..."

# Wait for ngrok to establish tunnel
echo "⏳ Waiting for ngrok to start..."
sleep 10

# Extract ngrok URL with retries
for i in {1..6}; do
    NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | jq -r '.tunnels[]?.public_url' 2>/dev/null | grep https | head -1)
    
    if [ -z "$NGROK_URL" ] || [ "$NGROK_URL" = "null" ]; then
        # Fallback: try grep method
        NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -o 'https://[^"]*\.ngrok\.io' | head -1)
    fi
    
    if [ -n "$NGROK_URL" ] && [ "$NGROK_URL" != "null" ]; then
        echo "✅ ngrok tunnel established: $NGROK_URL"
        break
    fi
    
    echo "⏳ Attempt $i: Waiting for ngrok tunnel... (${i}0s)"
    sleep 10
done

if [ -z "$NGROK_URL" ] || [ "$NGROK_URL" = "null" ]; then
    echo "❌ Failed to get ngrok URL after multiple attempts"
    echo "🔍 Checking ngrok status manually..."
    echo "📋 Try: curl http://127.0.0.1:4040/api/tunnels"
    echo "📋 Or check ngrok web interface at: http://127.0.0.1:4040"
    echo "📋 Logs at: $NGROK_LOG"
    
    # Don't exit - show manual instructions
    echo ""
    echo "🔧 Manual steps to get URL:"
    echo "1. Open http://127.0.0.1:4040 in browser"
    echo "2. Copy the https://*.ngrok.io URL"
    echo "3. Set LOCAL_DEVICE_URL in Vercel to that URL"
    NGROK_URL="MANUAL_CHECK_REQUIRED"
fi

echo "✅ ngrok tunnel established: $NGROK_URL"
echo "$NGROK_URL" > "$LOG_DIR/ngrok-url.txt"

echo ""
echo "🎉 MagnumStream Local Device Service is running!"
echo ""
echo "📊 Service Status:"
echo "   Local Server:  http://localhost:3001"
echo "   Public URL:    $NGROK_URL"
echo "   Server PID:    $SERVER_PID"
echo "   ngrok PID:     $NGROK_PID"
echo ""
echo "📝 Important: Add this to your Vercel environment variables:"
echo "   LOCAL_DEVICE_URL=$NGROK_URL"
echo ""
echo "📋 Logs:"
echo "   Server: $SERVER_LOG"
echo "   ngrok:  $NGROK_LOG"
echo "   DaVinci: $DAVINCI_LOG"
echo ""
echo "🎬 DaVinci Resolve Integration:"
echo "   - Ensure DaVinci Resolve Studio is running"
echo "   - Enable Scripting in DaVinci Resolve > Preferences > System > General"
echo "   - Template project: 'MAG_FERRARI-BACKUP' with 5-slot timeline"
echo "   - Clips will be processed: FFMPEG → DaVinci → Final render"
echo ""
echo "🛑 To stop the service: ./deploy/stop-mac-service.sh"