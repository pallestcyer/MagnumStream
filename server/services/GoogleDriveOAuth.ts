import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';

const TOKEN_PATH = path.join(process.cwd(), 'google-drive-tokens.json');

export class GoogleDriveOAuth {
  private oauth2Client: OAuth2Client;
  private isAuthenticated: boolean = false;

  constructor() {
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/auth/google/callback'
    );

    // Try to load existing tokens on startup
    this.loadTokens();
  }

  /**
   * Load tokens from environment variable (Vercel) or disk (Mac service)
   */
  private loadTokens(): void {
    try {
      // Priority 1: Check for refresh token in environment variable (for Vercel)
      if (process.env.GOOGLE_REFRESH_TOKEN) {
        const tokens = {
          refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        };
        this.oauth2Client.setCredentials(tokens);
        this.isAuthenticated = true;
        console.log('✅ Google Drive OAuth tokens loaded from environment variable (Vercel)');
        return;
      }

      // Priority 2: Check for tokens in local file (for Mac service)
      if (fs.existsSync(TOKEN_PATH)) {
        const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
        this.oauth2Client.setCredentials(tokens);
        this.isAuthenticated = true;
        console.log('✅ Google Drive OAuth tokens loaded from disk (Mac service)');
        return;
      }

      console.log('⚠️  No Google Drive OAuth tokens found. Authentication required.');
    } catch (error) {
      console.error('Failed to load Google Drive tokens:', error);
    }
  }

  /**
   * Save tokens to disk for persistence across restarts
   */
  private saveTokens(tokens: any): void {
    try {
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      console.log('✅ Google Drive OAuth tokens saved to disk');
    } catch (error) {
      console.error('Failed to save Google Drive tokens:', error);
    }
  }

  /**
   * Check if service is authenticated
   */
  public isReady(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Generate OAuth URL for user to authenticate with Google
   */
  generateAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  /**
   * Exchange authorization code for tokens and save them
   */
  async getTokensFromCode(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    this.saveTokens(tokens);
    this.isAuthenticated = true;
    return tokens;
  }

  /**
   * Set user tokens for API calls
   */
  setCredentials(tokens: any) {
    this.oauth2Client.setCredentials(tokens);
    this.saveTokens(tokens);
    this.isAuthenticated = true;
  }

  /**
   * Upload video to user's Google Drive
   */
  async uploadVideoToUserDrive(
    videoFilePath: string,
    fileName: string,
    customerName: string
  ) {
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

    try {
      // Create a folder for the customer if it doesn't exist
      const folderName = `${customerName}_Flight_${new Date().toISOString().split('T')[0]}`;
      
      // Check if folder exists
      const folderSearch = await drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)'
      });

      let folderId: string;
      if (folderSearch.data.files && folderSearch.data.files.length > 0) {
        folderId = folderSearch.data.files[0].id!;
      } else {
        // Create folder
        const folderResult = await drive.files.create({
          requestBody: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder'
          },
          fields: 'id'
        });
        folderId = folderResult.data.id!;
      }

      // Upload video to the folder
      const fileMetadata = {
        name: fileName,
        parents: [folderId]
      };

      const media = {
        mimeType: 'video/mp4',
        body: require('fs').createReadStream(videoFilePath)
      };

      const result = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink, webContentLink'
      });

      // Make file shareable (anyone with link can view)
      await drive.permissions.create({
        fileId: result.data.id!,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });

      return {
        fileId: result.data.id,
        webViewLink: result.data.webViewLink,
        webContentLink: result.data.webContentLink,
        folderId
      };

    } catch (error) {
      console.error('Failed to upload to Google Drive:', error);
      throw error;
    }
  }

  /**
   * Get user's Google account info
   */
  async getUserInfo() {
    const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    return userInfo.data;
  }

  /**
   * Check if tokens are still valid
   */
  async validateTokens() {
    try {
      await this.getUserInfo();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Find folder ID by relative path from My Drive
   * Example: MagnumStream_Videos/2025/10-October/29/CustomerName
   */
  async findFolderByPath(relativePath: string): Promise<string | null> {
    if (!this.isAuthenticated) {
      console.warn('❌ Google Drive OAuth not authenticated - cannot find folder');
      return null;
    }

    try {
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
      const pathParts = relativePath.split('/').filter(p => p);

      console.log(`🔍 Searching for folder path in Drive: ${relativePath}`);
      console.log(`   Path parts: ${pathParts.join(' > ')}`);

      let parentId = 'root';

      // Navigate through each folder in the path
      for (let i = 0; i < pathParts.length; i++) {
        const folderName = pathParts[i];
        const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

        console.log(`   [${i + 1}/${pathParts.length}] Looking for: "${folderName}" under parent ${parentId}`);

        const result = await drive.files.list({
          q: query,
          fields: 'files(id, name)',
          spaces: 'drive'
        });

        if (!result.data.files || result.data.files.length === 0) {
          console.warn(`❌ Folder not found: "${folderName}" (part ${i + 1} of ${pathParts.length})`);
          console.warn(`   Full path attempted: ${relativePath}`);
          console.warn(`   This means the folder structure in Google Drive doesn't match the local structure`);
          return null;
        }

        parentId = result.data.files[0].id!;
        console.log(`   ✅ Found: ${result.data.files[0].name} (ID: ${parentId})`);
      }

      console.log(`✅ Successfully found folder! Final ID: ${parentId}`);
      return parentId;
    } catch (error) {
      console.error('Error finding folder by path:', error);
      return null;
    }
  }

  /**
   * Get folder web URL from folder ID
   */
  getFolderWebUrl(folderId: string): string {
    return `https://drive.google.com/drive/folders/${folderId}`;
  }

  /**
   * Share folder with customer email
   */
  async shareFolderWithEmail(folderId: string, customerEmail: string): Promise<boolean> {
    if (!this.isAuthenticated) {
      console.warn('Google Drive OAuth not authenticated');
      return false;
    }

    try {
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

      await drive.permissions.create({
        fileId: folderId,
        requestBody: {
          role: 'reader',
          type: 'user',
          emailAddress: customerEmail
        },
        sendNotificationEmail: true,
        emailMessage: `Your MagnumStream flight video is ready! You now have access to view and download your personalized flight experience.`
      });

      console.log(`✅ Shared folder ${folderId} with ${customerEmail}`);
      return true;
    } catch (error) {
      console.error(`Failed to share folder with ${customerEmail}:`, error);
      return false;
    }
  }

  /**
   * Get folder metadata including web URL by searching for it
   */
  async getFolderInfoByPath(relativePath: string): Promise<{ id: string; webUrl: string } | null> {
    const folderId = await this.findFolderByPath(relativePath);
    if (!folderId) {
      return null;
    }

    return {
      id: folderId,
      webUrl: this.getFolderWebUrl(folderId)
    };
  }
}

export const googleDriveOAuth = new GoogleDriveOAuth();