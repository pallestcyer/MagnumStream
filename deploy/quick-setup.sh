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
    echo "⚠️  Node.js not found. Installing via Homebrew..."
    
    # Check if Homebrew exists in common locations
    BREW_PATH=""
    if command -v brew &> /dev/null; then
        BREW_PATH="brew"
    elif [[ -f "/opt/homebrew/bin/brew" ]]; then
        BREW_PATH="/opt/homebrew/bin/brew"
        eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [[ -f "/usr/local/bin/brew" ]]; then
        BREW_PATH="/usr/local/bin/brew"
        eval "$(/usr/local/bin/brew shellenv)"
    fi
    
    if [[ -z "$BREW_PATH" ]]; then
        echo "📦 Installing Homebrew first..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        # Add Homebrew to PATH for this session
        if [[ -f "/opt/homebrew/bin/brew" ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
            BREW_PATH="/opt/homebrew/bin/brew"
        elif [[ -f "/usr/local/bin/brew" ]]; then
            eval "$(/usr/local/bin/brew shellenv)"
            BREW_PATH="/usr/local/bin/brew"
        else
            BREW_PATH="brew"
        fi
    fi
    
    echo "📦 Installing Node.js using: $BREW_PATH"
    $BREW_PATH install node
    
    # Refresh PATH
    hash -r
    
    # Verify installation with retry
    for i in {1..3}; do
        if command -v node &> /dev/null; then
            echo "✅ Node.js successfully installed: $(node --version)"
            break
        else
            echo "⏳ Attempt $i: Node.js not yet available, retrying..."
            sleep 2
            # Re-evaluate PATH
            if [[ -f "/opt/homebrew/bin/brew" ]]; then
                eval "$(/opt/homebrew/bin/brew shellenv)"
            elif [[ -f "/usr/local/bin/brew" ]]; then
                eval "$(/usr/local/bin/brew shellenv)"
            fi
            hash -r
        fi
        
        if [[ $i -eq 3 ]]; then
            echo "❌ Node.js installation failed after multiple attempts"
            echo "🔧 Manual fallback option available: ./deploy/install-nodejs-mac.sh"
            echo "📋 Or download from: https://nodejs.org/"
            exit 1
        fi
    done
fi
echo "✅ Node.js $(node --version)"

# Check npm (should come with Node.js)
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found even after Node.js installation. Something went wrong."
    echo "Please install Node.js manually from https://nodejs.org/"
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