import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export class GoogleDriveOAuth {
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/auth/google/callback'
    );
  }

  /**
   * Generate OAuth URL for user to authenticate with Google
   */
  generateAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }

  /**
   * Set user tokens for API calls
   */
  setCredentials(tokens: any) {
    this.oauth2Client.setCredentials(tokens);
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

      let folderId;
      if (folderSearch.data.files && folderSearch.data.files.length > 0) {
        folderId = folderSearch.data.files[0].id;
      } else {
        // Create folder
        const folderResult = await drive.files.create({
          resource: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder'
          },
          fields: 'id'
        });
        folderId = folderResult.data.id;
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
        resource: fileMetadata,
        media: media,
        fields: 'id, webViewLink, webContentLink'
      });

      // Make file shareable (anyone with link can view)
      await drive.permissions.create({
        fileId: result.data.id!,
        resource: {
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
}

export const googleDriveOAuth = new GoogleDriveOAuth();