#!/bin/bash

# MagnumStream Local Device Quick Setup for Mac
# Run this script on the Mac device to set everything up

set -e

echo "🍎 MagnumStream Local Device Quick Setup for Mac"
echo "================================================"

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script is for macOS only"
    exit 1
fi

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install from https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found"
    exit 1
fi
echo "✅ npm $(npm --version)"

# Check git
if ! command -v git &> /dev/null; then
    echo "❌ Git not found. Install with: xcode-select --install"
    exit 1
fi
echo "✅ Git $(git --version | head -n1)"

# Check FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️  FFmpeg not found. Installing via Homebrew..."
    if ! command -v brew &> /dev/null; then
        echo "❌ Homebrew not found. Please install from https://brew.sh/"
        exit 1
    fi
    brew install ffmpeg
fi
echo "✅ FFmpeg $(ffmpeg -version | head -n1)"

# Check ngrok
if ! command -v ngrok &> /dev/null; then
    echo "⚠️  ngrok not found. Please install from https://ngrok.com/download"
    echo "   Or install via Homebrew: brew install ngrok/ngrok/ngrok"
    read -p "Continue without ngrok? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ ngrok $(ngrok --version)"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "⚙️  Creating environment configuration..."
    cp deploy/mac-local-device.env .env
    echo "✅ Created .env file - please edit it with your Google OAuth credentials"
fi

# Make scripts executable
echo "🔧 Setting up scripts..."
chmod +x deploy/start-mac-service.sh
chmod +x deploy/stop-mac-service.sh

# Create logs directory
mkdir -p logs

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Edit .env file with your Google OAuth credentials:"
echo "   nano .env"
echo ""
echo "2. Set up ngrok authentication:"
echo "   ngrok authtoken YOUR_AUTH_TOKEN"
echo ""
echo "3. Start the service:"
echo "   ./deploy/start-mac-service.sh"
echo ""
echo "4. Configure Vercel with the ngrok URL shown after startup"
echo ""
echo "📚 For detailed instructions, see: deploy/MAC_DEPLOYMENT_GUIDE.md"