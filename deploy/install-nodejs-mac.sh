#!/bin/bash

# Simple Node.js installer for Mac
# Run this if the quick-setup.sh fails to install Node.js

echo "🍎 Installing Node.js on Mac"
echo "=========================="

# Check if already installed
if command -v node &> /dev/null; then
    echo "✅ Node.js is already installed: $(node --version)"
    echo "✅ npm is already installed: $(npm --version)"
    exit 0
fi

echo "📦 Installing Node.js..."

# Method 1: Try Homebrew
if command -v brew &> /dev/null; then
    echo "Using Homebrew to install Node.js..."
    brew install node
elif [[ -f "/opt/homebrew/bin/brew" ]]; then
    echo "Using Homebrew (Apple Silicon) to install Node.js..."
    /opt/homebrew/bin/brew install node
elif [[ -f "/usr/local/bin/brew" ]]; then
    echo "Using Homebrew (Intel) to install Node.js..."
    /usr/local/bin/brew install node
else
    # Method 2: Install Homebrew first, then Node.js
    echo "Installing Homebrew first..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add to PATH
    if [[ -f "/opt/homebrew/bin/brew" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
    elif [[ -f "/usr/local/bin/brew" ]]; then
        eval "$(/usr/local/bin/brew shellenv)"
        echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zshrc
    fi
    
    echo "Installing Node.js via Homebrew..."
    brew install node
fi

# Verify installation
if command -v node &> /dev/null; then
    echo "✅ Successfully installed Node.js: $(node --version)"
    echo "✅ npm version: $(npm --version)"
    echo ""
    echo "🎉 Ready to run MagnumStream setup!"
    echo "You can now run: ./deploy/quick-setup.sh"
else
    echo ""
    echo "❌ Automatic installation failed."
    echo ""
    echo "📝 Manual installation options:"
    echo "1. Download from https://nodejs.org/ (recommended)"
    echo "2. Install using nvm: https://github.com/nvm-sh/nvm"
    echo ""
    echo "After installing manually, run: ./deploy/quick-setup.sh"
    exit 1
fi