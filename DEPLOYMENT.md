# 🚀 Vercel Deployment Guide for MagnumStream

## Prerequisites

### 1. Google Cloud Setup
1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create new project or select existing one
   - Enable Google Drive API

2. **Create Service Account**
   ```bash
   # In Google Cloud Console
   IAM & Admin → Service Accounts → Create Service Account
   
   # Give it these roles:
   - Editor (for Drive access)
   - Service Account User
   ```

3. **Generate Service Account Key**
   - Click on created service account
   - Keys tab → Add Key → Create New Key → JSON
   - Download the JSON file (keep it secure!)

### 2. Supabase Setup
- Ensure your Supabase project is accessible from production
- Verify connection strings and API keys
- Run schema migrations if needed

## Environment Variables for Vercel

In your Vercel dashboard, add these environment variables:

### Database Configuration
```
USE_SUPABASE=true
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Google Drive Configuration
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project-id.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_FROM_JSON\n-----END PRIVATE KEY-----\n"
```

### Server Configuration
```
NODE_ENV=production
PORT=3000
```

## Deployment Steps

### 1. Push to GitHub
```bash
git add .
git commit -m "Add Google Drive integration and prepare for Vercel deployment"
git push origin main
```

### 2. Connect to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Configure project settings:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### 3. Configure Environment Variables
In Vercel dashboard → Settings → Environment Variables, add all the variables listed above.

**Important**: For the private key, make sure to:
- Keep the quotes around the entire key
- Include `\n` for line breaks
- Copy the entire key from the JSON file including headers

### 4. Deploy
- Vercel will automatically deploy on push to main branch
- Monitor the deployment logs for any issues

## Verification Checklist

After deployment, test these features:

### ✅ Basic Functionality
- [ ] Dashboard loads correctly
- [ ] Recording workflow works
- [ ] Scene editing functions properly
- [ ] Sales page displays

### ✅ Database Connectivity
- [ ] Supabase connection established
- [ ] Data persists correctly
- [ ] API endpoints respond

### ✅ Google Drive Integration
- [ ] Service account authentication works
- [ ] Can create customer folders
- [ ] Video upload functions
- [ ] Folder sharing works
- [ ] Email notifications sent

### ✅ Sales Workflow
- [ ] Video previews display
- [ ] Sales creation works
- [ ] Automatic Drive sharing functions
- [ ] Customer receives access

## Troubleshooting

### Common Issues

**1. Google Drive Authentication Fails**
- Verify service account email is correct
- Check private key format (include \n for line breaks)
- Ensure Drive API is enabled in Google Cloud

**2. Build Fails**
- Check all dependencies are in package.json
- Verify TypeScript compilation
- Review build logs in Vercel dashboard

**3. Database Connection Issues**
- Verify Supabase URL and keys
- Check if Supabase project allows connections from Vercel IPs
- Test connection strings locally first

**4. Environment Variables**
- Ensure all required variables are set in Vercel
- Check for typos in variable names
- Verify multiline private key format

### Testing Locally with Production Config

```bash
# Test with production environment
NODE_ENV=production npm start

# Test build locally
npm run build
cd dist && node index.js
```

## File Storage Considerations

### Local Files (Development)
- Raw videos: IndexedDB (browser)
- Generated clips: `./projects/` directory
- Final videos: Google Drive

### Production (Vercel)
- Raw videos: IndexedDB (browser) ✅
- Generated clips: **Will need cloud storage** ⚠️
- Final videos: Google Drive ✅

**Note**: Vercel has ephemeral filesystem. For clip generation in production, you'll need to:
1. Use temporary files only
2. Stream directly to Google Drive
3. Or integrate with cloud storage (AWS S3, Google Cloud Storage)

## Security Notes

- Never commit `.env` files
- Use Vercel environment variables for all secrets
- Rotate service account keys regularly
- Monitor Google Cloud usage and billing
- Set up proper CORS policies

## Monitoring

Set up monitoring for:
- API response times
- Google Drive API quotas
- Database connection health
- Error rates and logs

## Post-Deployment

1. **Test all workflows end-to-end**
2. **Monitor performance and errors**
3. **Set up alerts for critical failures**
4. **Document any production-specific configurations**
5. **Train team on new Google Drive features**