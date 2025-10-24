# 🚀 Simple Vercel Deployment - Personal Google Drive Integration

## Much Simpler Approach!

Instead of complex service accounts, we're using **OAuth** so users authenticate with their **own Google accounts** and save to their **personal Google Drive**.

## Prerequisites

### 1. Google Cloud Console Setup (5 minutes)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable **Google Drive API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure OAuth consent screen:
   - **Application type**: Web application
   - **Authorized redirect URIs**: 
     - `http://localhost:5000/auth/google/callback` (development)
     - `https://your-app.vercel.app/auth/google/callback` (production)

### 2. Get OAuth Credentials
- Copy **Client ID** and **Client Secret**
- No service account JSON needed!

## Environment Variables for Vercel

Only these simple variables needed:

### Database
```
USE_SUPABASE=true
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Google OAuth (much simpler!)
```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-app.vercel.app/auth/google/callback
```

### Server
```
NODE_ENV=production
```

## How It Works

### 1. User Experience
1. **Export Video** → User clicks "Save to Google Drive"
2. **Google Login** → Popup opens with Google's secure login
3. **Permission Grant** → User authorizes access to their Drive
4. **Auto Upload** → Video saves to their personal Google Drive
5. **Sharing** → User can share the Drive link with customers

### 2. Technical Flow
```
User → Google OAuth → User's Drive → Shareable Link → Customer Access
```

No complex service accounts or API keys to manage!

## Deployment Steps

### 1. Push to GitHub
```bash
git add .
git commit -m "Add personal Google Drive integration"
git push origin main
```

### 2. Deploy to Vercel
1. Connect repository to Vercel
2. Add environment variables (listed above)
3. Deploy!

### 3. Update Google OAuth Settings
After deployment:
1. Go back to Google Cloud Console
2. Update **Authorized redirect URIs** with your Vercel URL:
   `https://your-app.vercel.app/auth/google/callback`

## Benefits of This Approach

✅ **No service accounts** - Much simpler setup  
✅ **Personal Drive** - Videos go to user's own Google Drive  
✅ **User control** - Users manage their own sharing/permissions  
✅ **Secure** - Uses Google's OAuth (most secure method)  
✅ **Cost effective** - No Google Cloud billing for API usage  
✅ **Familiar UX** - Users understand "Login with Google"  

## Testing

### Local Testing
1. Start the app: `npm run dev`
2. Go to export workflow
3. Click "Connect Google Drive"
4. Authenticate with your Google account
5. Upload test video

### Production Testing
1. Deploy to Vercel
2. Update Google OAuth redirect URI
3. Test the same workflow on production

## Security Notes

- OAuth tokens are stored in session (secure)
- Users only grant access to their own Drive
- No long-term API keys to manage
- Google handles all security aspects

## Troubleshooting

### "OAuth Error" 
- Check Client ID/Secret are correct
- Verify redirect URI matches exactly
- Ensure Google Drive API is enabled

### "Upload Failed"
- User needs to be authenticated first
- Check if Drive API quotas are exceeded
- Verify file permissions

This approach is **much simpler** and more user-friendly than service accounts!