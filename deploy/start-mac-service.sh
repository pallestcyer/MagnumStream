#!/bin/bash

# MagnumStream Local Device Service Startup Script for Mac
# This script starts the local video processing service and ngrok tunnel

set -e

# Configuration
PROJECT_DIR="$HOME/MagnumStream"
LOG_DIR="$PROJECT_DIR/logs"
NGROK_LOG="$LOG_DIR/ngrok.log"
SERVER_LOG="$LOG_DIR/server.log"

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

# Start the Express server in background
echo "🖥️  Starting local video processing server..."
nohup npm start > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > "$LOG_DIR/server.pid"

# Wait for server to start
sleep 3

# Check if server started successfully
if ! curl -s http://localhost:5000/api/health > /dev/null; then
    echo "❌ Server failed to start. Check logs at $SERVER_LOG"
    exit 1
fi

echo "✅ Server started successfully (PID: $SERVER_PID)"

# Start ngrok tunnel
echo "🌐 Starting ngrok tunnel..."
if ngrok config check 2>/dev/null | grep -q "authtoken"; then
    echo "✅ Using authenticated ngrok (stable URL)"
else
    echo "⚠️  Using unauthenticated ngrok (URL will change on restart)"
    echo "   For stable URLs, get auth token from: https://ngrok.com/signup"
fi
nohup ngrok http 5000 --log=stdout > "$NGROK_LOG" 2>&1 &
NGROK_PID=$!
echo $NGROK_PID > "$LOG_DIR/ngrok.pid"

# Wait for ngrok to establish tunnel
sleep 5

# Extract ngrok URL
NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | grep -o 'https://[^"]*\.ngrok\.io' | head -1)

if [ -z "$NGROK_URL" ]; then
    echo "❌ Failed to get ngrok URL. Check logs at $NGROK_LOG"
    exit 1
fi

echo "✅ ngrok tunnel established: $NGROK_URL"
echo "$NGROK_URL" > "$LOG_DIR/ngrok-url.txt"

echo ""
echo "🎉 MagnumStream Local Device Service is running!"
echo ""
echo "📊 Service Status:"
echo "   Local Server:  http://localhost:5000"
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
echo ""
echo "🛑 To stop the service: ./deploy/stop-mac-service.sh"