import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

/**
 * Simplified GoogleDriveOAuth for Vercel serverless environment
 * Uses environment variables instead of file storage
 */
export class GoogleDriveOAuth {
  private oauth2Client: OAuth2Client;
  private isAuthenticated: boolean = false;

  constructor() {
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/auth/google/callback'
    );

    // Load refresh token from environment variable
    this.loadTokens();
  }

  /**
   * Load tokens from environment variable (Vercel)
   */
  private loadTokens(): void {
    try {
      if (process.env.GOOGLE_REFRESH_TOKEN) {
        const tokens = {
          refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        };
        this.oauth2Client.setCredentials(tokens);
        this.isAuthenticated = true;
        console.log('✅ Google Drive OAuth tokens loaded from environment variable (Vercel)');
        return;
      }

      console.log('⚠️  No GOOGLE_REFRESH_TOKEN environment variable found');
    } catch (error) {
      console.error('Failed to load Google Drive tokens:', error);
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
   * Find folder by navigating through the folder hierarchy
   */
  async findFolderByPath(relativePath: string): Promise<string | null> {
    try {
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

      // Split path into parts
      const parts = relativePath.split('/').filter(p => p.length > 0);

      // Start from root of My Drive
      let parentId = 'root';

      for (const folderName of parts) {
        // Search for folder with this name under current parent
        const response = await drive.files.list({
          q: `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id, name)',
          spaces: 'drive'
        });

        if (!response.data.files || response.data.files.length === 0) {
          console.log(`Folder not found: ${folderName} under parent ${parentId}`);
          return null;
        }

        // Move to next level
        parentId = response.data.files[0].id!;
      }

      return parentId;
    } catch (error) {
      console.error('Error finding folder:', error);
      return null;
    }
  }

  /**
   * Get folder info including web URL
   */
  async getFolderInfoByPath(relativePath: string): Promise<{ id: string; webUrl: string } | null> {
    try {
      const folderId = await this.findFolderByPath(relativePath);
      if (!folderId) return null;

      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
      const response = await drive.files.get({
        fileId: folderId,
        fields: 'id, webViewLink'
      });

      return {
        id: response.data.id!,
        webUrl: response.data.webViewLink!
      };
    } catch (error) {
      console.error('Error getting folder info:', error);
      return null;
    }
  }

  /**
   * Share folder with customer email
   */
  async shareFolderWithEmail(folderId: string, customerEmail: string): Promise<boolean> {
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
        emailMessage: 'Your MagnumStream helicopter tour video is ready! You can now view and download it from Google Drive.'
      });

      console.log(`✅ Shared folder ${folderId} with ${customerEmail}`);
      return true;
    } catch (error) {
      console.error('Error sharing folder:', error);
      return false;
    }
  }

  /**
   * Extract folder ID from a Google Drive folder URL
   */
  extractFolderIdFromUrl(folderUrl: string): string | null {
    if (!folderUrl) {
      console.error('❌ extractFolderIdFromUrl: folderUrl is null or undefined');
      return null;
    }
    const match = folderUrl.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      console.error(`❌ extractFolderIdFromUrl: No match found for URL: ${folderUrl}`);
    }
    return match ? match[1] : null;
  }

  /**
   * Get the Photos folder ID from a project's customer folder
   */
  async getPhotosFolderId(customerFolderId: string): Promise<string | null> {
    if (!this.isAuthenticated) {
      console.error('❌ getPhotosFolderId: Not authenticated');
      return null;
    }

    if (!customerFolderId) {
      console.error('❌ getPhotosFolderId: customerFolderId is null or undefined');
      return null;
    }

    try {
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

      console.log(`🔍 Searching for Photos folder in parent: ${customerFolderId}`);
      const query = `name='Photos' and '${customerFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      console.log(`📝 Query: ${query}`);

      const result = await drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive'
      });

      if (result.data.files && result.data.files.length > 0) {
        console.log(`✅ Found Photos folder: ${result.data.files[0].id}`);
        return result.data.files[0].id!;
      }

      console.warn(`⚠️ No Photos folder found in parent: ${customerFolderId}`);
      return null;
    } catch (error: any) {
      console.error('❌ Failed to get Photos folder:', error.message || error);
      if (error.response) {
        console.error('   Response:', JSON.stringify(error.response.data, null, 2));
      }
      return null;
    }
  }

  /**
   * Upload a file to a specific folder from a buffer
   */
  async uploadFileToFolder(
    folderId: string,
    fileName: string,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<{ fileId: string; webViewLink: string } | null> {
    if (!this.isAuthenticated) {
      console.warn('❌ Google Drive OAuth not authenticated - cannot upload file');
      return null;
    }

    try {
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

      const response = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId],
          mimeType: mimeType
        },
        media: {
          mimeType: mimeType,
          body: require('stream').Readable.from(fileBuffer)
        },
        fields: 'id, webViewLink'
      });

      if (response.data.id && response.data.webViewLink) {
        console.log(`✅ Uploaded file ${fileName} to Drive (ID: ${response.data.id})`);
        return {
          fileId: response.data.id,
          webViewLink: response.data.webViewLink
        };
      }

      return null;
    } catch (error: any) {
      console.error(`❌ Failed to upload file ${fileName}:`, error.message || error);
      return null;
    }
  }
}

// Export singleton instance for Vercel
export const googleDriveOAuth = new GoogleDriveOAuth();
