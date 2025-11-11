#!/bin/bash

# MagnumStream Local Device Service Stop Script for Mac

set -e

PROJECT_DIR="$HOME/MagnumStream"
LOG_DIR="$PROJECT_DIR/logs"

echo "🛑 Stopping MagnumStream Local Device Service..."

# Stop server
if [ -f "$LOG_DIR/server.pid" ]; then
    SERVER_PID=$(cat "$LOG_DIR/server.pid")
    if kill -0 $SERVER_PID 2>/dev/null; then
        echo "🖥️  Stopping server (PID: $SERVER_PID)..."
        kill $SERVER_PID
        rm "$LOG_DIR/server.pid"
        echo "✅ Server stopped"
    else
        echo "⚠️  Server not running"
        rm -f "$LOG_DIR/server.pid"
    fi
fi

# Stop ngrok
if [ -f "$LOG_DIR/ngrok.pid" ]; then
    NGROK_PID=$(cat "$LOG_DIR/ngrok.pid")
    if kill -0 $NGROK_PID 2>/dev/null; then
        echo "🌐 Stopping ngrok (PID: $NGROK_PID)..."
        kill $NGROK_PID
        rm "$LOG_DIR/ngrok.pid"
        echo "✅ ngrok stopped"
    else
        echo "⚠️  ngrok not running"
        rm -f "$LOG_DIR/ngrok.pid"
    fi
fi

# Stop background cleanup job
if [ -f "$LOG_DIR/cleanup.pid" ]; then
    CLEANUP_PID=$(cat "$LOG_DIR/cleanup.pid")
    if kill -0 $CLEANUP_PID 2>/dev/null; then
        echo "🧹 Stopping cleanup service (PID: $CLEANUP_PID)..."
        kill $CLEANUP_PID
        rm "$LOG_DIR/cleanup.pid"
        echo "✅ Cleanup service stopped"
    else
        echo "⚠️  Cleanup service not running"
        rm -f "$LOG_DIR/cleanup.pid"
    fi
fi

# Clean up URL file
rm -f "$LOG_DIR/ngrok-url.txt"

echo "✅ MagnumStream Local Device Service stopped"