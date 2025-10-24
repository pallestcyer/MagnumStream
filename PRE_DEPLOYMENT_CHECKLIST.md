# 🚀 Pre-Deployment Checklist for MagnumStream

## ✅ Essential Setup Tasks

### 1. Google Cloud Platform Setup
- [ ] **Create Google Cloud Project**
  - Project name: `magnumstream-production`
  - Enable billing account
  
- [ ] **Enable APIs**
  - Google Drive API
  - Google Cloud Storage API (if using for clips)
  
- [ ] **Create Service Account**
  - Name: `magnumstream-drive-service`
  - Role: Editor + Service Account User
  - Download JSON key file
  
- [ ] **Test Service Account**
  ```bash
  # Test locally with the JSON key
  GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json npm run dev
  ```

### 2. Supabase Production Setup
- [ ] **Verify Supabase Project**
  - Production database is accessible
  - Connection strings are correct
  - API keys are valid
  
- [ ] **Run Database Migrations**
  ```bash
  # Ensure all tables exist
  npm run db:push
  ```
  
- [ ] **Test Database Connection**
  ```bash
  # Test with production credentials
  USE_SUPABASE=true npm run dev
  ```

### 3. Environment Variables Checklist

#### ✅ Required for Production
```bash
# Database
USE_SUPABASE=true
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Drive
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Server
NODE_ENV=production
PORT=3000
```

#### ⚠️ Important Notes
- Private key must include `\n` for line breaks
- Keep quotes around the entire private key
- Test all variables locally before deploying

### 4. Code Quality & Testing
- [ ] **Build Test**
  ```bash
  npm run build
  # Should complete without errors
  ```
  
- [ ] **TypeScript Check**
  ```bash
  npm run check
  # Should pass without errors
  ```
  
- [ ] **Local Production Test**
  ```bash
  NODE_ENV=production npm start
  # Test all major workflows
  ```

### 5. Security Checklist
- [ ] **No Secrets in Code**
  - No API keys in source files
  - .env files are in .gitignore
  - Service account JSON not committed
  
- [ ] **Environment Security**
  - All secrets use environment variables
  - Supabase RLS policies are enabled
  - Google Drive permissions are minimal

### 6. Feature Testing (Local)
- [ ] **Basic Functionality**
  - Dashboard loads
  - Recording workflow works
  - Scene editing functions
  - Sales page displays
  
- [ ] **Database Operations**
  - Create/read/update operations work
  - Timeline positions save
  - Sales records create
  
- [ ] **Google Drive Integration**
  - Service authentication works
  - Can create test folders
  - File upload simulation works
  - Sharing permissions function

## 🎯 Deployment Steps

### 1. Repository Setup
```bash
# Ensure latest code is committed
git add .
git commit -m "Prepare for production deployment"
git push origin main
```

### 2. Vercel Project Creation
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import from GitHub
4. Select your repository

### 3. Vercel Configuration
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`
- **Node.js Version**: 18.x

### 4. Environment Variables in Vercel
Copy all production environment variables to Vercel:
1. Settings → Environment Variables
2. Add each variable from your checklist
3. **Test each variable** by checking logs

### 5. Deploy & Monitor
- [ ] **Initial Deployment**
  - Monitor build logs
  - Check for any errors
  - Verify deployment URL works
  
- [ ] **Function Testing**
  - Test API endpoints
  - Verify database connections
  - Check Google Drive operations

## 🧪 Post-Deployment Testing

### Critical Path Testing
1. **Load Dashboard** → Should display without errors
2. **Create Recording** → Should save to database
3. **Edit Scenes** → Timeline positions should persist
4. **Export Video** → Should trigger Google Drive upload
5. **Create Sale** → Should share Drive folder automatically

### API Endpoint Testing
```bash
# Test key endpoints
curl https://your-app.vercel.app/api/recordings
curl https://your-app.vercel.app/api/sales/analytics
```

### Error Monitoring
- [ ] Check Vercel function logs
- [ ] Monitor error rates
- [ ] Test error handling scenarios

## 🚨 Rollback Plan

If deployment fails:
1. **Immediate**: Revert to previous Vercel deployment
2. **Database**: No changes should affect existing data
3. **Debug**: Check Vercel logs for specific errors
4. **Fix**: Address issues locally, test, redeploy

## 📞 Support Contacts

- **Vercel Support**: [Vercel Help](https://vercel.com/help)
- **Google Cloud**: [Cloud Support](https://cloud.google.com/support)
- **Supabase Support**: [Supabase Help](https://supabase.com/docs)

## ✅ Final Pre-Deploy Verification

Before clicking deploy, confirm:
- [ ] All environment variables are set in Vercel
- [ ] Build completes successfully locally
- [ ] Google Drive service account is properly configured
- [ ] Supabase connection is verified
- [ ] No secrets are committed to repository
- [ ] Rollback plan is understood

**Ready to deploy!** 🚀