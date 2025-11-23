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

        const result = await drive.files.list({
          q: query,
          fields: 'files(id, name)',
          spaces: 'drive'
        });

        if (!result.data.files || result.data.files.length === 0) {
          console.warn(`❌ Folder not found: "${folderName}"`);

          // Try searching for the entire folder path as a fallback
          const finalFolderName = pathParts[pathParts.length - 1];
          const searchResult = await drive.files.list({
            q: `name='${finalFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name, parents)',
            spaces: 'drive'
          });

          if (searchResult.data.files && searchResult.data.files.length > 0) {
            return searchResult.data.files[0].id!;
          }

          return null;
        }

        parentId = result.data.files[0].id!;
      }

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

      console.log(`✅ Folder shared with ${customerEmail}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to share folder:`, error);
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

  /**
   * Find a folder by name in root of Drive (does not create if missing)
   * Returns folder ID or null if not found
   */
  private async findFolderByName(drive: any, name: string): Promise<string | null> {
    const query = `name='${name}' and 'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

    const result = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (result.data.files && result.data.files.length > 0) {
      console.log(`📁 Found folder "${name}" with ID: ${result.data.files[0].id}`);
      return result.data.files[0].id!;
    }

    return null;
  }

  /**
   * Get or create a folder, returns folder ID
   */
  private async getOrCreateFolder(drive: any, name: string, parentId: string | null): Promise<string> {
    const parent = parentId || 'root';
    const query = `name='${name}' and '${parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

    const result = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (result.data.files && result.data.files.length > 0) {
      return result.data.files[0].id!;
    }

    // Create the folder
    const folderResult = await drive.files.create({
      requestBody: {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parent]
      },
      fields: 'id'
    });

    console.log(`📁 Created folder: ${name}`);
    return folderResult.data.id!;
  }

  /**
   * Create project folder structure for a new project
   * Structure: Year/Month/Day/FlightNumber-PilotInitials/CustomerName/
   *   ├── Video/
   *   └── Photos/
   */
  async createProjectFolderStructure(
    customerName: string,
    pilotName: string,
    flightTime: string,
    flightDate?: Date
  ): Promise<{ folderId: string; folderUrl: string; videoFolderId: string; photosFolderId: string } | null> {
    if (!this.isAuthenticated) {
      console.warn('❌ Google Drive OAuth not authenticated - cannot create project folder');
      return null;
    }

    try {
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
      const date = flightDate || new Date();

      // Format date components
      const year = date.getFullYear().toString();
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
      const month = `${(date.getMonth() + 1).toString().padStart(2, '0')}-${monthNames[date.getMonth()]}`;
      const day = date.getDate().toString().padStart(2, '0');

      // Get pilot initials - the value passed should already be initials (e.g., "SK", "JP")
      // If it's a 2-3 character uppercase string, use it directly
      // Otherwise fall back to extracting initials from full name
      let pilotInitials: string;
      if (pilotName.length <= 3 && /^[A-Z]+$/.test(pilotName)) {
        // Already initials format (e.g., "SK", "JP", "HR")
        pilotInitials = pilotName;
      } else {
        // Legacy format - extract initials from name (e.g., "captain_mike" -> "CM")
        pilotInitials = pilotName
          .replace('captain_', '')
          .split(/[\s_]+/)
          .map(word => word.charAt(0).toUpperCase())
          .join('');
      }

      // Calculate flight number based on time (count of flights that day)
      // For now, use time-based numbering: format time as flight number
      const flightNumber = flightTime ? flightTime.replace(':', '') : '0000';

      // Build folder names
      const flightFolderName = `${flightNumber}-${pilotInitials}`;
      const customerFolderName = customerName.replace(/[/\\:*?"<>|]/g, '_'); // Sanitize for filesystem

      // Find the "Magnum Media Purchases" folder as the root parent
      const rootFolderName = 'Magnum Media Purchases';
      const rootFolderId = await this.findFolderByName(drive, rootFolderName);

      if (!rootFolderId) {
        console.error(`❌ Could not find "${rootFolderName}" folder in Google Drive. Please create it first.`);
        throw new Error(`Root folder "${rootFolderName}" not found in Google Drive`);
      }

      console.log(`📁 Creating project folder structure inside "${rootFolderName}":`);
      console.log(`   ${year}/${month}/${day}/${flightFolderName}/${customerFolderName}/`);

      // Create folder hierarchy inside Magnum Media Purchases
      const yearFolderId = await this.getOrCreateFolder(drive, year, rootFolderId);
      const monthFolderId = await this.getOrCreateFolder(drive, month, yearFolderId);
      const dayFolderId = await this.getOrCreateFolder(drive, day, monthFolderId);
      const flightFolderId = await this.getOrCreateFolder(drive, flightFolderName, dayFolderId);
      const customerFolderId = await this.getOrCreateFolder(drive, customerFolderName, flightFolderId);

      // Create Video and Photos subfolders
      const videoFolderId = await this.getOrCreateFolder(drive, 'Video', customerFolderId);
      const photosFolderId = await this.getOrCreateFolder(drive, 'Photos', customerFolderId);

      const folderUrl = this.getFolderWebUrl(customerFolderId);

      console.log(`✅ Project folder structure created: ${folderUrl}`);

      return {
        folderId: customerFolderId,
        folderUrl,
        videoFolderId,
        photosFolderId
      };
    } catch (error) {
      console.error('❌ Failed to create project folder structure:', error);
      return null;
    }
  }
  /**
   * Upload a file to a specific folder
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
      const { Readable } = await import('stream');

      const fileMetadata = {
        name: fileName,
        parents: [folderId]
      };

      const media = {
        mimeType: mimeType,
        body: Readable.from(fileBuffer)
      };

      const result = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink'
      });

      console.log(`📤 Uploaded file: ${fileName}`);

      return {
        fileId: result.data.id!,
        webViewLink: result.data.webViewLink || ''
      };
    } catch (error) {
      console.error(`❌ Failed to upload file ${fileName}:`, error);
      return null;
    }
  }

  /**
   * Get the Photos folder ID from a project's customer folder
   */
  async getPhotosFolderId(customerFolderId: string): Promise<string | null> {
    if (!this.isAuthenticated) {
      return null;
    }

    try {
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

      const result = await drive.files.list({
        q: `name='Photos' and '${customerFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive'
      });

      if (result.data.files && result.data.files.length > 0) {
        return result.data.files[0].id!;
      }

      return null;
    } catch (error) {
      console.error('❌ Failed to get Photos folder:', error);
      return null;
    }
  }

  /**
   * Extract folder ID from a Google Drive folder URL
   */
  extractFolderIdFromUrl(folderUrl: string): string | null {
    // URL format: https://drive.google.com/drive/folders/FOLDER_ID
    const match = folderUrl.match(/folders\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  /**
   * Upload a video file from local path to a specific folder
   * Optimized for large video files using file streams
   */
  async uploadVideoToFolder(
    folderId: string,
    localVideoPath: string,
    fileName?: string
  ): Promise<{ fileId: string; webViewLink: string } | null> {
    if (!this.isAuthenticated) {
      console.warn('❌ Google Drive OAuth not authenticated - cannot upload video');
      return null;
    }

    try {
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });
      const actualFileName = fileName || path.basename(localVideoPath);

      console.log(`📤 Uploading video to Drive folder ${folderId}: ${actualFileName}`);

      const fileMetadata = {
        name: actualFileName,
        parents: [folderId]
      };

      const media = {
        mimeType: 'video/mp4',
        body: fs.createReadStream(localVideoPath)
      };

      const result = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink'
      });

      console.log(`✅ Video uploaded successfully: ${actualFileName}`);

      return {
        fileId: result.data.id!,
        webViewLink: result.data.webViewLink || ''
      };
    } catch (error) {
      console.error(`❌ Failed to upload video ${localVideoPath}:`, error);
      return null;
    }
  }
}

export const googleDriveOAuth = new GoogleDriveOAuth();