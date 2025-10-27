# MagnumStream Deployment Checklist for Target Mac

This checklist ensures the target Mac device is properly configured to run MagnumStream with Google Drive integration.

## Pre-Deployment Requirements

### 1. System Requirements
- [ ] macOS 10.15 (Catalina) or later
- [ ] At least 50GB free disk space (for local renders and Drive sync)
- [ ] 8GB+ RAM recommended
- [ ] Reliable internet connection

### 2. Software Installation

#### Required Software
- [ ] **Google Drive for Desktop**
  - Download from: https://www.google.com/drive/download/
  - Version: Latest stable version
  - Must be configured BEFORE deploying MagnumStream

- [ ] **DaVinci Resolve Studio**
  - Download from: https://www.blackmagicdesign.com/products/davinciresolve
  - Version: 18.5 or later
  - **Important:** Studio version required (free version lacks scripting API)
  - License key should be activated

- [ ] **Node.js**
  - Version: 18.x or 20.x (LTS recommended)
  - Install via: https://nodejs.org/ or `brew install node`
  - Verify: `node --version` and `npm --version`

- [ ] **Python 3**
  - Version: 3.9 or later
  - Install via: `brew install python3`
  - Verify: `python3 --version`

- [ ] **ngrok**
  - Install via: `brew install ngrok` or download from https://ngrok.com/download
  - Optional: Authenticate for stable URLs (free account available)
  - Verify: `ngrok version`

- [ ] **FFmpeg**
  - Install via: `brew install ffmpeg`
  - Verify: `ffmpeg -version`

- [ ] **jq** (for JSON parsing in scripts)
  - Install via: `brew install jq`
  - Verify: `jq --version`

#### Optional but Recommended
- [ ] **Git** (for pulling updates)
  - Usually pre-installed on macOS
  - Verify: `git --version`

- [ ] **Homebrew** (package manager)
  - Install from: https://brew.sh/
  - Verify: `brew --version`

### 3. Google Drive Configuration

⚠️ **CRITICAL:** This must be configured BEFORE running MagnumStream

- [ ] Google Drive for Desktop installed and launched
- [ ] Signed in with account: `photos@magnumhelicopters.com`
  - If you don't have credentials, contact system administrator

- [ ] **Sync mode configured as "Mirror files"** (not "Stream files")
  - Settings: Google Drive icon in menu bar → Preferences → Google Drive → Mirror files
  - This ensures files are physically stored on disk, not just streamed

- [ ] Initial sync completed
  - Check Google Drive status in menu bar
  - Should show "Synced" or "Up to date"

- [ ] Verify Google Drive path exists:
  ```bash
  ls ~/Library/CloudStorage/
  # Should show folder like: GoogleDrive-photos@magnumhelicopters.com
  ```

- [ ] Create MagnumStream_Videos folder (will be auto-created if missing):
  ```bash
  mkdir -p ~/Library/CloudStorage/GoogleDrive-photos@magnumhelicopters.com/My\ Drive/MagnumStream_Videos
  ```

- [ ] Verify write permissions:
  ```bash
  touch ~/Library/CloudStorage/GoogleDrive-photos@magnumhelicopters.com/My\ Drive/test.txt
  rm ~/Library/CloudStorage/GoogleDrive-photos@magnumhelicopters.com/My\ Drive/test.txt
  ```

### 4. DaVinci Resolve Configuration

- [ ] DaVinci Resolve Studio is installed
- [ ] Launch DaVinci Resolve once to complete initial setup
- [ ] Enable External Scripting:
  - DaVinci Resolve → Preferences → System → General
  - Find "External scripting using:" and select **"Network"**
  - Leave "Network" selected (not "Local")

- [ ] Create template project:
  - Project name: `MAG_FERRARI-BACKUP`
  - Timeline: 5 video tracks, 2 audio tracks
  - Settings: 1920x1080, 29.97fps (or your preferred settings)
  - Save and close

- [ ] Verify Python scripting API is accessible:
  ```bash
  python3 -c "import sys; sys.path.append('/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules'); import DaVinciResolveScript as dvr; print('API accessible')"
  ```

### 5. Network Configuration

- [ ] Firewall configured to allow:
  - Incoming connections to port 3001 (Express server)
  - ngrok tunneling
  - Google Drive sync traffic

- [ ] If using ngrok authentication:
  ```bash
  ngrok config add-authtoken YOUR_TOKEN_HERE
  ```

## Deployment Steps

### 1. Clone Repository

```bash
cd ~
git clone https://github.com/your-repo/MagnumStream.git
cd MagnumStream
```

Or if using a different deployment method:
```bash
# Copy files via USB, network share, etc.
# Ensure all files are in ~/MagnumStream
```

### 2. Install Dependencies

```bash
cd ~/MagnumStream
npm install
```

Expected output: No errors, all packages installed successfully

### 3. Configure Environment

- [ ] Copy environment template:
  ```bash
  cp .env.example .env
  ```

- [ ] Edit `.env` file and configure:
  ```bash
  nano .env
  ```

  **Required settings:**
  ```env
  # Google Drive Configuration
  GOOGLE_DRIVE_EMAIL=photos@magnumhelicopters.com

  # Database (if using remote database)
  DATABASE_URL=postgresql://user:pass@host:5432/magnumstream

  # Vercel API (for syncing with web dashboard)
  VERCEL_API_URL=https://your-app.vercel.app
  ```

### 4. Build Project

```bash
npm run build
```

Expected output: TypeScript compiled successfully, no errors

### 5. Run Google Drive Integration Test

```bash
./test-google-drive.sh
```

**All tests must pass before proceeding!**

If tests fail:
1. Review error messages in test output
2. Verify Google Drive is running and synced
3. Check file permissions
4. See troubleshooting section below

### 6. Start Service

```bash
./deploy/start-mac-service.sh
```

Expected output:
- ✅ Google Drive detected
- ✅ DaVinci Resolve found
- ✅ Server started successfully
- ✅ ngrok tunnel established

**Copy the ngrok URL** (e.g., `https://abc123.ngrok.io`)

### 7. Configure Vercel Environment Variable

In your Vercel dashboard:
1. Go to Project Settings → Environment Variables
2. Add or update: `LOCAL_DEVICE_URL=https://abc123.ngrok.io`
3. Redeploy if necessary

### 8. Run End-to-End Test

1. Open your MagnumStream web dashboard
2. Upload a test video
3. Request a render
4. Monitor logs:
   ```bash
   tail -f ~/MagnumStream/logs/server.log
   tail -f ~/MagnumStream/logs/davinci.log
   ```

5. Verify:
   - [ ] Video downloaded locally
   - [ ] DaVinci Resolve opened and rendered video
   - [ ] Output saved to `~/MagnumStream/rendered/YYYY/MM-Month/DD/`
   - [ ] Output copied to Google Drive at `My Drive/MagnumStream_Videos/YYYY/MM-Month/DD/`
   - [ ] Database updated with `driveFileUrl` and `exportStatus: 'completed'`
   - [ ] Web dashboard shows completed render with Drive path

## Troubleshooting

### Google Drive Issues

**Issue:** `Google Drive for Desktop not found`
```bash
# Check if Google Drive is running
pgrep -x "Google Drive"

# Check installation path
ls ~/Library/CloudStorage/

# Restart Google Drive
killall "Google Drive"
open "/Applications/Google Drive.app"
```

**Issue:** `Permission denied` when copying to Drive
```bash
# Check write permissions
ls -la ~/Library/CloudStorage/GoogleDrive-*/My\ Drive/

# Verify you're signed into the correct account
# Google Drive menu bar icon → Settings → Accounts
```

**Issue:** Files not syncing
- Check Google Drive status in menu bar (should be green checkmark)
- Check available disk space: `df -h`
- Check Google Drive quotas in web interface
- Ensure "Mirror files" mode is enabled (not "Stream files")

### DaVinci Resolve Issues

**Issue:** `DaVinci Resolve Python API not available`
```bash
# Verify installation
ls "/Applications/DaVinci Resolve/DaVinci Resolve.app"

# Check scripting modules
ls "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules"

# Try manual connection
python3 -c "import DaVinciResolveScript as dvr; resolve = dvr.scriptapp('Resolve'); print(resolve)"
```

**Issue:** `External scripting not enabled`
1. Open DaVinci Resolve
2. DaVinci Resolve → Preferences → System → General
3. Set "External scripting using:" to "Network"
4. Restart DaVinci Resolve
5. Retry

### Service Issues

**Issue:** Server won't start
```bash
# Check if port 3001 is already in use
lsof -i :3001

# Kill conflicting process
kill -9 <PID>

# Check server logs
cat ~/MagnumStream/logs/server.log
```

**Issue:** ngrok tunnel not established
```bash
# Check ngrok status
curl http://127.0.0.1:4040/api/tunnels | jq

# Check ngrok logs
cat ~/MagnumStream/logs/ngrok.log

# Manually test ngrok
ngrok http 3001
```

### Testing Tools

**Test Google Drive detection:**
```bash
./test-google-drive.sh
```

**Test DaVinci connection:**
```bash
python3 Davinci.py --test
```

**Check service health:**
```bash
curl http://localhost:3001/api/health
```

**View real-time logs:**
```bash
# All logs
tail -f ~/MagnumStream/logs/*.log

# Specific service
tail -f ~/MagnumStream/logs/server.log
```

## Maintenance

### Updating the Service

```bash
cd ~/MagnumStream
git pull origin main
npm install
npm run build
./deploy/stop-mac-service.sh
./deploy/start-mac-service.sh
```

### Monitoring Disk Space

Google Drive sync can consume significant disk space:

```bash
# Check available space
df -h

# Check MagnumStream storage usage
du -sh ~/MagnumStream/rendered
du -sh ~/Library/CloudStorage/GoogleDrive-*/My\ Drive/MagnumStream_Videos
```

**Recommendation:** Keep at least 50GB free for smooth operation

### Cleaning Old Renders

```bash
# Archive old renders (older than 30 days)
find ~/MagnumStream/rendered -type f -mtime +30 -name "*.mp4" -exec rm {} \;

# Note: Google Drive files should be managed through drive.google.com
# to preserve version history and sharing links
```

## Service Management

### Start Service
```bash
./deploy/start-mac-service.sh
```

### Stop Service
```bash
./deploy/stop-mac-service.sh
```

### View Logs
```bash
# All logs
ls -lh ~/MagnumStream/logs/

# Live monitoring
tail -f ~/MagnumStream/logs/server.log
```

### Get ngrok URL
```bash
cat ~/MagnumStream/logs/ngrok-url.txt
# or
curl http://127.0.0.1:4040/api/tunnels | jq -r '.tunnels[0].public_url'
```

## Security Considerations

- [ ] Ensure Mac has FileVault encryption enabled (System Preferences → Security & Privacy → FileVault)
- [ ] Use a strong password for the Mac user account
- [ ] Keep macOS and all software up to date
- [ ] Restrict physical access to the machine
- [ ] Monitor ngrok usage (consider paid plan for authentication)
- [ ] Regularly review Google Drive shared folder permissions

## Support

If you encounter issues not covered in this checklist:

1. Check logs: `~/MagnumStream/logs/`
2. Review implementation docs: `IMPLEMENTATION_REVIEW.md`
3. See Google Drive setup: `GOOGLE_DRIVE_SETUP.md`
4. Contact development team with:
   - Error messages from logs
   - Output of `./test-google-drive.sh`
   - System info: `sw_vers` and `system_profiler SPHardwareDataType`

---

**Last Updated:** 2025-10-27
**Version:** 1.0.0
