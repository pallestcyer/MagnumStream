# Google Drive OAuth Setup Guide

This guide will help you set up Google Drive OAuth authentication for automatic folder sharing with customers.

## ✨ Features Added

1. **Direct Folder Links**: "Open in Drive" button now opens the exact folder containing the video (not a search)
2. **Automatic Folder Sharing**: When a sale is recorded, the customer's email is automatically added to the Google Drive folder
3. **Persistent Authentication**: One-time setup - works across restarts, code updates, and tunnel restarts
4. **Graceful Degradation**: Everything still works if OAuth isn't set up (just no automatic sharing)

---

## 🚀 Setup Instructions

### Step 1: Create Google Cloud Project & Enable Drive API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one (name it "MagnumStream")
3. Enable the Google Drive API:
   - Navigate to "APIs & Services" → "Library"
   - Search for "Google Drive API"
   - Click "Enable"

### Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - User Type: **External** (or Internal if you have Google Workspace)
   - App name: "MagnumStream"
   - User support email: Your email
   - Developer contact: Your email
   - Scopes: Add `https://www.googleapis.com/auth/drive` and `https://www.googleapis.com/auth/userinfo.email`
   - Test users: Add your Gmail address
   - Click "Save and Continue"

4. Back to creating OAuth client ID:
   - Application type: **Web application**
   - Name: "MagnumStream OAuth Client"
   - Authorized redirect URIs:
     - `http://localhost:5000/api/drive/auth/callback`
     - (If using ngrok, add your ngrok URL: `https://your-ngrok-url.ngrok.io/api/drive/auth/callback`)
   - Click "Create"

5. **Download the credentials**:
   - You'll see your Client ID and Client Secret
   - Keep these safe!

### Step 3: Add Credentials to .env File

Add these lines to your `.env` file:

```env
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:5000/api/drive/auth/callback
```

**If using ngrok**, use your ngrok URL:
```env
GOOGLE_REDIRECT_URI=https://your-ngrok-url.ngrok.io/api/drive/auth/callback
```

### Step 4: Restart Your Server

```bash
# Restart your development server
npm run dev
```

The OAuth service will automatically load on startup.

### Step 5: Authenticate (One-Time)

1. Open your app and navigate to the **Sales Page**
2. You'll see a yellow banner at the top: "Google Drive Not Connected"
3. Click the **"Connect Google Drive"** button
4. A popup window will open with Google's authentication page
5. Select your Google account (the one that owns the MagnumStream_Videos folder)
6. Grant permissions to access Google Drive
7. The popup will close automatically and you'll see a green "Google Drive Connected" banner

**That's it!** The authentication token is saved to `google-drive-tokens.json` and will persist across:
- ✅ Server restarts
- ✅ Mac restarts
- ✅ Code updates/deployments
- ✅ Ngrok tunnel restarts

---

## 🎯 How It Works

### When a Video is Rendered:

1. Video is rendered by DaVinci
2. File is copied to local Google Drive folder (existing behavior - unchanged)
3. **NEW**: System finds the folder ID in Google Drive using OAuth
4. **NEW**: Folder URL is saved to database (`driveFolderUrl` field)

### When You Click "Open in Drive":

- **Before**: Opened a search for the video filename
- **After**: Opens the exact folder containing the video

### When a Sale is Made:

1. Sale is recorded in database (existing behavior)
2. **NEW**: Customer's email is automatically added to the Google Drive folder
3. **NEW**: Customer receives email notification with access to the folder
4. Customer can view/download their video directly from Drive

---

## 🔧 Troubleshooting

### "OAuth not authenticated" error

**Solution**: Make sure you've completed Step 5 (Authentication). Check the sales page for the status banner.

### Authentication popup is blocked

**Solution**: Allow popups for your app's domain in your browser settings.

### Folder not found after authentication

**Solution**:
1. Make sure the Google account you authenticated with owns the `MagnumStream_Videos` folder
2. If using a different account, share the folder with the authenticated account

### Token expired or invalid

**Solution**:
1. Delete the `google-drive-tokens.json` file
2. Restart the server
3. Re-authenticate using the sales page button

### Works locally but not with ngrok

**Solution**:
1. Update `GOOGLE_REDIRECT_URI` in `.env` to use your ngrok URL
2. Add the ngrok callback URL to Google Cloud Console authorized redirect URIs
3. Restart server
4. Re-authenticate

---

## 📝 Database Migration

The system automatically adds the `driveFolderUrl` field to existing databases. If you encounter issues:

```sql
ALTER TABLE flight_recordings ADD COLUMN drive_folder_url TEXT;
```

---

## 🔐 Security Notes

- OAuth tokens are stored locally in `google-drive-tokens.json`
- **DO NOT** commit this file to git (it's in `.gitignore`)
- Tokens are encrypted by Google's OAuth library
- Refresh tokens don't expire unless manually revoked
- Only grant permissions to trusted Google accounts

---

## 🎉 Success Indicators

You'll know it's working when:

1. ✅ Sales page shows green "Google Drive Connected" banner
2. ✅ "Open in Drive" button opens the exact folder (not a search)
3. ✅ After creating a sale, customer receives Google Drive email notification
4. ✅ Customer can access the folder without manual sharing

---

## 🆘 Need Help?

If you encounter issues:
1. Check server logs for OAuth errors
2. Verify `.env` credentials are correct
3. Ensure Google Drive API is enabled
4. Make sure you're using the correct Google account
5. Try deleting `google-drive-tokens.json` and re-authenticating

---

## 🔄 Reverting Changes

If you need to revert to the previous version:

```bash
git revert HEAD
```

All existing functionality will continue to work - OAuth is completely optional and backwards-compatible.
