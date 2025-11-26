import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { Readable } from 'stream';

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
   * Get the web URL for a folder from its ID
   */
  getFolderWebUrl(folderId: string): string {
    return `https://drive.google.com/drive/folders/${folderId}`;
  }

  /**
   * Find a folder by name in root of Drive
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
   * Get or create a folder under a parent
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
   * Structure: Magnum Media Purchases/Year/Month/Day/FlightNumber-PilotInitials/CustomerName/
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

      // Get pilot initials
      let pilotInitials: string;
      if (pilotName.length <= 3 && /^[A-Z]+$/.test(pilotName)) {
        pilotInitials = pilotName;
      } else {
        pilotInitials = pilotName
          .replace('captain_', '')
          .split(/[\s_]+/)
          .map(word => word.charAt(0).toUpperCase())
          .join('');
      }

      const flightNumber = flightTime ? flightTime.replace(':', '') : '0000';
      const flightFolderName = `${flightNumber}-${pilotInitials}`;
      const customerFolderName = customerName.replace(/[/\\:*?"<>|]/g, '_');

      // Find the "Magnum Media Purchases" folder as the root parent
      const rootFolderName = 'Magnum Media Purchases';
      const rootFolderId = await this.findFolderByName(drive, rootFolderName);

      if (!rootFolderId) {
        console.error(`❌ Could not find "${rootFolderName}" folder in Google Drive. Please create it first.`);
        throw new Error(`Root folder "${rootFolderName}" not found in Google Drive`);
      }

      console.log(`📁 Creating project folder structure inside "${rootFolderName}":`);
      console.log(`   ${year}/${month}/${day}/${flightFolderName}/${customerFolderName}/`);

      // Create folder hierarchy
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
   * Get a fresh access token for direct uploads from client
   * This allows the client to upload directly to Google Drive, bypassing Vercel's payload limit
   */
  async getAccessToken(): Promise<string | null> {
    if (!this.isAuthenticated) {
      console.error('❌ getAccessToken: Not authenticated');
      return null;
    }

    try {
      const { token } = await this.oauth2Client.getAccessToken();
      return token || null;
    } catch (error: any) {
      console.error('❌ Failed to get access token:', error.message || error);
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
          body: Readable.from(fileBuffer)
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

  /**
   * Rename a folder in Google Drive
   */
  async renameFolder(folderId: string, newName: string): Promise<boolean> {
    if (!this.isAuthenticated) {
      console.error('❌ renameFolder: Not authenticated');
      return false;
    }

    try {
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

      await drive.files.update({
        fileId: folderId,
        requestBody: {
          name: newName
        }
      });

      console.log(`✅ Renamed folder ${folderId} to "${newName}"`);
      return true;
    } catch (error: any) {
      console.error(`❌ Failed to rename folder ${folderId}:`, error.message || error);
      return false;
    }
  }

  /**
   * Get the parent folder ID of a folder
   */
  async getParentFolderId(folderId: string): Promise<string | null> {
    if (!this.isAuthenticated) {
      console.error('❌ getParentFolderId: Not authenticated');
      return null;
    }

    try {
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

      const result = await drive.files.get({
        fileId: folderId,
        fields: 'parents'
      });

      if (result.data.parents && result.data.parents.length > 0) {
        return result.data.parents[0];
      }

      return null;
    } catch (error: any) {
      console.error(`❌ Failed to get parent folder:`, error.message || error);
      return null;
    }
  }

  /**
   * Move a folder to a new parent folder
   */
  async moveFolderToParent(folderId: string, newParentId: string): Promise<boolean> {
    if (!this.isAuthenticated) {
      console.error('❌ moveFolderToParent: Not authenticated');
      return false;
    }

    try {
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

      // Get current parents
      const file = await drive.files.get({
        fileId: folderId,
        fields: 'parents'
      });

      const previousParents = file.data.parents?.join(',') || '';

      // Move to new parent
      await drive.files.update({
        fileId: folderId,
        addParents: newParentId,
        removeParents: previousParents,
        fields: 'id, parents'
      });

      console.log(`✅ Moved folder ${folderId} to new parent ${newParentId}`);
      return true;
    } catch (error: any) {
      console.error(`❌ Failed to move folder:`, error.message || error);
      return false;
    }
  }

  /**
   * Find or create a folder under a parent
   */
  async findOrCreateFolder(parentId: string, folderName: string): Promise<string | null> {
    if (!this.isAuthenticated) {
      console.error('❌ findOrCreateFolder: Not authenticated');
      return null;
    }

    try {
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

      // First, try to find existing folder
      const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const result = await drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive'
      });

      if (result.data.files && result.data.files.length > 0) {
        console.log(`📁 Found existing folder "${folderName}": ${result.data.files[0].id}`);
        return result.data.files[0].id!;
      }

      // Create new folder
      const folderResult = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId]
        },
        fields: 'id'
      });

      console.log(`📁 Created new folder "${folderName}": ${folderResult.data.id}`);
      return folderResult.data.id!;
    } catch (error: any) {
      console.error(`❌ Failed to find/create folder:`, error.message || error);
      return null;
    }
  }

  /**
   * Update project folder names when project details change
   * @param customerFolderId - The ID of the customer folder (stored in recording.driveFolderId)
   * @param updates - Object containing the new values
   * @param oldValues - Object containing the old values for comparison
   * @returns Object with updated folder IDs if any renames occurred
   *
   * Folder structure: Year/Month/Day/FlightTime-PilotInitials/CustomerName/
   * - Customer name change: renames the customer folder
   * - Flight time/pilot change: MOVES customer folder to new/existing flight folder (doesn't affect other customers)
   */
  async updateProjectFolders(
    customerFolderId: string,
    updates: {
      pilotName?: string;      // Customer name - affects customer folder
      flightPilot?: string;    // Pilot initials - affects flight folder
      flightTime?: string;     // Flight time - affects flight folder
    },
    oldValues: {
      pilotName?: string;
      flightPilot?: string;
      flightTime?: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    if (!this.isAuthenticated) {
      return { success: false, message: 'Not authenticated' };
    }

    if (!customerFolderId) {
      return { success: false, message: 'No customer folder ID provided' };
    }

    try {
      const results: string[] = [];

      // Check if customer folder name needs updating (pilotName = customer name)
      if (updates.pilotName && updates.pilotName !== oldValues.pilotName) {
        const sanitizedName = updates.pilotName.replace(/[/\\:*?"<>|]/g, '_');
        const renamed = await this.renameFolder(customerFolderId, sanitizedName);
        if (renamed) {
          results.push(`Customer folder renamed to "${sanitizedName}"`);
        }
      }

      // Check if flight folder needs changing (flightTime or flightPilot changed)
      // This MOVES the customer folder to a new flight folder, doesn't rename the shared one
      const flightTimeChanged = updates.flightTime && updates.flightTime !== oldValues.flightTime;
      const pilotChanged = updates.flightPilot && updates.flightPilot !== oldValues.flightPilot;

      if (flightTimeChanged || pilotChanged) {
        // Get the current flight folder (parent of customer folder)
        const currentFlightFolderId = await this.getParentFolderId(customerFolderId);

        if (currentFlightFolderId) {
          // Get the day folder (parent of flight folder)
          const dayFolderId = await this.getParentFolderId(currentFlightFolderId);

          if (dayFolderId) {
            // Build the new flight folder name
            const flightTime = updates.flightTime || oldValues.flightTime || '0000';
            const flightNumber = flightTime.replace(':', '');

            // Get pilot initials
            const pilotName = updates.flightPilot || oldValues.flightPilot || '';
            let pilotInitials: string;
            if (pilotName.length <= 3 && /^[A-Z]+$/.test(pilotName)) {
              pilotInitials = pilotName;
            } else {
              pilotInitials = pilotName
                .replace('captain_', '')
                .split(/[\s_]+/)
                .map(word => word.charAt(0).toUpperCase())
                .join('');
            }

            const newFlightFolderName = `${flightNumber}-${pilotInitials}`;

            // Find or create the target flight folder under the day folder
            const targetFlightFolderId = await this.findOrCreateFolder(dayFolderId, newFlightFolderName);

            if (targetFlightFolderId && targetFlightFolderId !== currentFlightFolderId) {
              // Move customer folder to the new flight folder
              const moved = await this.moveFolderToParent(customerFolderId, targetFlightFolderId);
              if (moved) {
                results.push(`Customer moved to flight folder "${newFlightFolderName}"`);
              }
            }
          }
        }
      }

      if (results.length > 0) {
        console.log(`📁 Folder updates: ${results.join(', ')}`);
        return { success: true, message: results.join(', ') };
      }

      return { success: true, message: 'No folder changes needed' };
    } catch (error: any) {
      console.error('❌ Failed to update project folders:', error.message || error);
      return { success: false, message: error.message || 'Unknown error' };
    }
  }
}

// Export singleton instance for Vercel
export const googleDriveOAuth = new GoogleDriveOAuth();
