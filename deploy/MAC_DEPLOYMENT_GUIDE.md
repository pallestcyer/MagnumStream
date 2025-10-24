# MagnumStream Local Device Deployment - Mac Guide

## 🎯 Overview
This guide helps you set up the MagnumStream local video processing service on a Mac device. The service will:

- Handle video file storage and processing locally
- Run FFmpeg operations for clip generation
- Integrate with DaVinci Resolve 
- Upload finished videos to Google Drive
- Communicate with Vercel-hosted UI via secure tunnel

## 📋 Prerequisites

### Required Software
1. **Node.js 18+**: Download from [nodejs.org](https://nodejs.org/)
2. **Git**: Install via Xcode Command Line Tools: `xcode-select --install`
3. **ngrok**: Install from [ngrok.com](https://ngrok.com/)
4. **FFmpeg**: Install via Homebrew: `brew install ffmpeg`

### Optional Software
- **DaVinci Resolve**: For video editing integration
- **Homebrew**: For easy package management: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`

## 🚀 Installation Steps

### 1. Clone the Repository
```bash
cd ~
git clone https://github.com/your-repo/MagnumStream
cd MagnumStream
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
# Copy the example environment file
cp deploy/mac-local-device.env .env

# Edit the .env file with your Google OAuth credentials
nano .env
```

Required configuration in `.env`:
```env
USE_SUPABASE=false
NODE_ENV=production
PORT=5000

# Get these from Google Cloud Console
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/google/callback

SESSION_SECRET=change-this-to-random-secret
```

### 4. Set Up ngrok
```bash
# Sign up for free account at ngrok.com
# Get your auth token from the dashboard
ngrok authtoken YOUR_AUTH_TOKEN
```

### 5. Make Scripts Executable
```bash
chmod +x deploy/start-mac-service.sh
chmod +x deploy/stop-mac-service.sh
```

## 🎮 Running the Service

### Manual Start
```bash
./deploy/start-mac-service.sh
```

This will:
- Start the Express server on port 5000
- Create an ngrok tunnel for public access
- Display the public URL to configure in Vercel

### Manual Stop
```bash
./deploy/stop-mac-service.sh
```

### Auto-Start on Boot (Optional)
```bash
# Copy the LaunchAgent file (replace USERNAME with your actual username)
cp deploy/com.magnumstream.localdevice.plist ~/Library/LaunchAgents/
sed -i '' 's/USERNAME/'$(whoami)'/g' ~/Library/LaunchAgents/com.magnumstream.localdevice.plist

# Load the service
launchctl load ~/Library/LaunchAgents/com.magnumstream.localdevice.plist

# The service will now start automatically on boot
```

## 🔧 Configuration

### Vercel Environment Variables
After starting the service, add this to your Vercel project:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add: `LOCAL_DEVICE_URL` = `https://your-ngrok-url.ngrok.io`
3. Redeploy your Vercel project

### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Drive API
4. Create OAuth 2.0 credentials
5. Add `http://localhost:5000/auth/google/callback` to authorized redirect URIs
6. Copy Client ID and Secret to your `.env` file

## 📊 Monitoring

### Check Service Status
```bash
# Check if services are running
curl http://localhost:5000/api/health

# View logs
tail -f logs/server.log
tail -f logs/ngrok.log
```

### Directory Structure
```
~/MagnumStream/
├── projects/           # Video files stored here
│   └── pilot_name/
│       ├── clips/      # Generated clips
│       ├── source/     # Raw recordings
│       └── davinci/    # DaVinci project files
├── logs/              # Service logs
└── deploy/            # Deployment files
```

## 🔄 Updates

### Update the Service
```bash
cd ~/MagnumStream
git pull origin main
npm install
npm run build

# Restart service
./deploy/stop-mac-service.sh
./deploy/start-mac-service.sh
```

## 🛠️ Troubleshooting

### Common Issues

**Port 5000 already in use:**
```bash
# Find and kill process using port 5000
lsof -ti:5000 | xargs kill -9
```

**ngrok authentication failed:**
```bash
# Re-authenticate with ngrok
ngrok authtoken YOUR_AUTH_TOKEN
```

**FFmpeg not found:**
```bash
# Install FFmpeg via Homebrew
brew install ffmpeg
```

**Permission denied on scripts:**
```bash
# Make scripts executable
chmod +x deploy/*.sh
```

### Log Locations
- Server logs: `~/MagnumStream/logs/server.log`
- ngrok logs: `~/MagnumStream/logs/ngrok.log`  
- LaunchAgent logs: `~/MagnumStream/logs/launchd.log`

## 🆘 Support

If you encounter issues:
1. Check the logs for error messages
2. Ensure all prerequisites are installed
3. Verify environment variables are correct
4. Test network connectivity to Vercel

The service provides a health check endpoint at `http://localhost:5000/api/health` for monitoring.