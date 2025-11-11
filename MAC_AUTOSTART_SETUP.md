# MagnumStream Mac Auto-Start Setup

This guide explains how to set up the MagnumStream Mac service to run automatically on startup in the background.

## Overview

The Mac service handles:
- FFmpeg clip generation
- DaVinci Resolve rendering
- Google Drive syncing
- Background cleanup of old clips

By setting it up as a LaunchAgent, it will:
- ✅ Start automatically when the Mac boots up
- ✅ Run in the background (no visible window)
- ✅ Restart automatically if it crashes
- ✅ Run as the logged-in user (access to DaVinci Resolve, Google Drive, etc.)

## Prerequisites

Before setting up auto-start, ensure you have:

1. **Project location**: `/Users/magnummedia/MagnumStream/`
2. **Dependencies installed**:
   ```bash
   # Node.js and npm
   node --version  # Should be v18 or higher
   npm --version

   # FFmpeg
   ffmpeg -version

   # ngrok
   ngrok version
   ```

3. **DaVinci Resolve Studio** installed at:
   `/Applications/DaVinci Resolve/DaVinci Resolve.app`

4. **Google Drive for Desktop** (optional but recommended)

## Installation

### Step 1: Clone or Pull Latest Code

On the Mac that will run the service:

```bash
cd ~/MagnumStream
git pull origin main
npm install
```

### Step 2: Install the LaunchAgent

Run the installation script:

```bash
cd ~/MagnumStream
./deploy/install-launch-agent.sh
```

This will:
1. Copy the LaunchAgent plist to `~/Library/LaunchAgents/`
2. Load the service immediately
3. Configure it to start on boot

### Step 3: Verify Installation

Check if the service is running:

```bash
launchctl list | grep magnumstream
```

You should see output like:
```
12345	0	com.magnumstream.service
```

The first number is the PID (process ID), which means it's running.

### Step 4: Check Logs

View the service logs to ensure it started correctly:

```bash
tail -f ~/MagnumStream/logs/launchd-stdout.log
```

You should see:
```
🎉 MagnumStream Local Device Service is running!
📊 Service Status:
   Local Server:  http://localhost:3001
   Public URL:    https://xxxxx.ngrok.io
   ...
```

## Uninstallation

To remove the auto-start service:

```bash
cd ~/MagnumStream
./deploy/uninstall-launch-agent.sh
```

This will:
1. Stop the service
2. Remove the LaunchAgent
3. Preserve project files and logs

## Management

### Check Service Status

```bash
launchctl list | grep magnumstream
```

### Stop Service

```bash
launchctl unload ~/Library/LaunchAgents/com.magnumstream.service.plist
```

### Start Service

```bash
launchctl load ~/Library/LaunchAgents/com.magnumstream.service.plist
```

### View Logs

```bash
# Live logs
tail -f ~/MagnumStream/logs/launchd-stdout.log

# Error logs
tail -f ~/MagnumStream/logs/launchd-stderr.log

# Server logs
tail -f ~/MagnumStream/logs/server.log

# Cleanup logs
tail -f ~/MagnumStream/logs/cleanup.log
```

### Restart Service

```bash
launchctl unload ~/Library/LaunchAgents/com.magnumstream.service.plist
sleep 2
launchctl load ~/Library/LaunchAgents/com.magnumstream.service.plist
```

## Troubleshooting

### Service Not Starting

1. **Check logs**:
   ```bash
   cat ~/MagnumStream/logs/launchd-stderr.log
   ```

2. **Verify paths in plist**:
   ```bash
   cat ~/Library/LaunchAgents/com.magnumstream.service.plist
   ```

   Ensure paths match your setup (especially username).

3. **Check permissions**:
   ```bash
   ls -la ~/MagnumStream/deploy/start-mac-service.sh
   ```

   Should be executable (`-rwxr-xr-x`).

4. **Manually test the script**:
   ```bash
   cd ~/MagnumStream
   ./deploy/start-mac-service.sh
   ```

   If it fails manually, fix those issues first.

### Service Crashes Repeatedly

The LaunchAgent will throttle restart attempts if the service crashes too quickly:

1. **Check error logs**:
   ```bash
   tail -50 ~/MagnumStream/logs/launchd-stderr.log
   ```

2. **Common issues**:
   - DaVinci Resolve not running → Start DaVinci manually first
   - Port 3001 already in use → Kill other processes using that port
   - Node modules missing → Run `npm install` in project directory
   - ngrok auth issues → Check ngrok configuration

### Getting ngrok URL

The public ngrok URL is saved to:
```bash
cat ~/MagnumStream/logs/ngrok-url.txt
```

Or visit: http://localhost:4040 (ngrok web interface)

### DaVinci Resolve Integration Issues

1. **Enable DaVinci scripting**:
   - Open DaVinci Resolve Studio
   - Go to: Preferences > System > General
   - Enable "External scripting using"
   - Select "Local" or "Network"

2. **Verify template project**:
   - Open DaVinci Resolve
   - Ensure project named `MAG_FERRARI-BACKUP` exists
   - Template should have 14 clips on timeline matching the slot structure

### Google Drive Sync Issues

1. **Check Google Drive for Desktop**:
   ```bash
   ls ~/Library/CloudStorage/GoogleDrive-*/My\ Drive/
   ```

2. **OAuth tokens**:
   ```bash
   cat ~/MagnumStream/google-drive-tokens.json
   ```

   Should contain valid `refresh_token`.

## System Requirements

### macOS Settings

1. **Prevent Sleep** (recommended):
   - System Settings > Energy Saver
   - Prevent computer from sleeping automatically when display is off

2. **Auto-login** (optional but recommended):
   - System Settings > Users & Groups
   - Enable automatic login for your user

3. **Start DaVinci on Login** (optional):
   - System Settings > General > Login Items
   - Add DaVinci Resolve to login items

## Important Notes

### User Context

- The service runs as **your user account** (not root)
- This gives it access to:
  - DaVinci Resolve scripting API
  - Google Drive for Desktop
  - User environment variables
  - Desktop applications

### Startup Timing

- Service starts ~10 seconds after login
- This delay ensures system is fully ready
- DaVinci Resolve should be launched first for best results

### Background Operation

- **No visible window** - runs completely in background
- **No Dock icon** - doesn't appear in Dock
- **No menu bar** - invisible during operation
- Check logs to verify it's working

### Security

- Service has full access to your user account
- Ensure Mac has strong password/FileVault enabled
- ngrok exposes local server to internet (be aware)

## Advanced Configuration

### Custom User/Path

If you need to change the username or project path:

1. Edit the plist file:
   ```bash
   nano ~/Library/LaunchAgents/com.magnumstream.service.plist
   ```

2. Update these lines:
   ```xml
   <string>/Users/YOUR_USERNAME/MagnumStream/deploy/start-mac-service.sh</string>
   <string>/Users/YOUR_USERNAME/MagnumStream</string>
   <string>/Users/YOUR_USERNAME/MagnumStream/logs/launchd-stdout.log</string>
   <string>/Users/YOUR_USERNAME/MagnumStream/logs/launchd-stderr.log</string>
   <string>/Users/YOUR_USERNAME</string>
   ```

3. Reload:
   ```bash
   launchctl unload ~/Library/LaunchAgents/com.magnumstream.service.plist
   launchctl load ~/Library/LaunchAgents/com.magnumstream.service.plist
   ```

### Environment Variables

Add custom environment variables in the plist:

```xml
<key>EnvironmentVariables</key>
<dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin</string>
    <key>HOME</key>
    <string>/Users/magnummedia</string>
    <key>YOUR_CUSTOM_VAR</key>
    <string>value</string>
</dict>
```

## Summary

Once installed, the MagnumStream service will:
- ✅ Start automatically when Mac boots
- ✅ Run in background without user interaction
- ✅ Restart automatically if it crashes
- ✅ Process video rendering requests 24/7
- ✅ Clean up old clips daily
- ✅ Log all activity to files

Perfect for a dedicated Mac that runs unattended!
