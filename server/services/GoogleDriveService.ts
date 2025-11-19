import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import path from 'path';
import fs from 'fs/promises';
import { storage } from '../storage';

interface DriveFileInfo {
  id: string;
  name: string;
  webViewLink: string;
  webContentLink: string;
  thumbnailLink?: string;
  videoMediaMetadata?: {
    width: number;
    height: number;
    durationMillis: string;
  };
}

export class GoogleDriveService {
  private drive: any;
  private auth: JWT | null = null;

  constructor() {
    // Initialize Google Drive API with service account
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (!email || !privateKey) {
      console.warn('⚠️ Google Drive credentials not configured. Drive features will be disabled.');
      return;
    }

    try {
      this.auth = new JWT({
        email,
        key: privateKey,
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file'
        ]
      });

      this.drive = google.drive({ version: 'v3', auth: this.auth });
      console.log('✅ Google Drive service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Google Drive service:', error);
    }
  }

  /**
   * Upload final video to Google Drive and create customer folder
   */
  async uploadFinalVideo(
    recordingId: string, 
    videoFilePath: string, 
    customerName: string,
    customerEmail: string
  ): Promise<DriveFileInfo> {
    if (!this.drive || !this.auth) {
      throw new Error('Google Drive service not initialized. Check your credentials.');
    }

    try {

      // Create or find customer folder
      const customerFolder = await this.createCustomerFolder(customerName, recordingId);
      
      // Upload video file with customer-based naming (matches DaVinci output)
      const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const videoFileName = `${customerName}_${timestamp}.mp4`;
      
      const fileMetadata = {
        name: videoFileName,
        parents: [customerFolder.id],
        description: `Flight video for ${customerName} - ${new Date().toLocaleDateString()}`
      };

      const media = {
        mimeType: 'video/mp4',
        body: await fs.readFile(videoFilePath).then(buffer => buffer)
      };

      const file = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id,name,webViewLink,webContentLink,thumbnailLink,videoMediaMetadata'
      });

      console.log(`✅ Video uploaded to Drive: ${file.data.name}`);

      // Make file accessible to customer
      await this.shareFileWithCustomer(file.data.id, customerEmail);

      // Update database with Drive info
      await storage.updateFlightRecording(recordingId, {
        driveFileId: file.data.id,
        driveFileUrl: file.data.webViewLink,
        exportStatus: 'completed'
      });

      return {
        id: file.data.id,
        name: file.data.name,
        webViewLink: file.data.webViewLink,
        webContentLink: file.data.webContentLink,
        thumbnailLink: file.data.thumbnailLink,
        videoMediaMetadata: file.data.videoMediaMetadata
      };

    } catch (error) {
      console.error('❌ Failed to upload video to Google Drive:', error);
      throw error;
    }
  }

  /**
   * Create organized folder structure: MagnumStream/Year/Month/Day/CustomerName
   */
  private async createCustomerFolder(customerName: string, recordingId: string): Promise<{id: string, name: string}> {
    const sanitizedName = customerName.replace(/[^a-zA-Z0-9\s&]/g, '').replace(/\s+/g, '_');
    const currentDate = new Date();
    
    // Create organized folder structure
    const year = currentDate.getFullYear().toString();
    const monthNum = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const monthName = currentDate.toLocaleDateString('en', { month: 'long' });
    const month = `${monthNum}-${monthName}`;
    const day = currentDate.getDate().toString().padStart(2, '0');
    
    // Customer folder name with date
    const folderName = `${sanitizedName}_${currentDate.toISOString().split('T')[0]}`;

    try {
      // Get or create the organized folder hierarchy: MagnumStream/Year/Month/Day/Customer
      const magnumStreamFolder = await this.getOrCreateFolder('MagnumStream', null);
      const yearFolder = await this.getOrCreateFolder(year, magnumStreamFolder.id);
      const monthFolder = await this.getOrCreateFolder(month, yearFolder.id);
      const dayFolder = await this.getOrCreateFolder(day, monthFolder.id);
      const customerFolder = await this.getOrCreateFolder(folderName, dayFolder.id);

      return customerFolder;

    } catch (error) {
      console.error('❌ Failed to create customer folder:', error);
      throw error;
    }
  }

  /**
   * Helper method to get or create a folder with the specified name and parent
   */
  private async getOrCreateFolder(name: string, parentId: string | null): Promise<{id: string, name: string}> {
    try {
      // Search for existing folder
      const query = parentId 
        ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
        : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

      const existingFolders = await this.drive.files.list({
        q: query,
        fields: 'files(id,name)'
      });

      if (existingFolders.data.files && existingFolders.data.files.length > 0) {
        const folder = existingFolders.data.files[0];
        return { id: folder.id!, name: folder.name! };
      }

      // Create new folder
      const folderMetadata: any = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder'
      };

      if (parentId) {
        folderMetadata.parents = [parentId];
      }

      const folder = await this.drive.files.create({
        resource: folderMetadata,
        fields: 'id,name'
      });

      return {
        id: folder.data.id!,
        name: folder.data.name!
      };

    } catch (error) {
      console.error(`❌ Failed to get/create folder ${name}:`, error);
      throw error;
    }
  }

  /**
   * Share file/folder with customer email and grant view access
   */
  async shareFileWithCustomer(fileId: string, customerEmail: string): Promise<void> {
    try {
      await this.drive.permissions.create({
        fileId: fileId,
        resource: {
          role: 'reader',
          type: 'user',
          emailAddress: customerEmail
        },
        sendNotificationEmail: true,
        emailMessage: `Your flight video is ready! You now have access to view and download your personalized flight experience.`
      });

      console.log(`✅ File shared with ${customerEmail}`);
    } catch (error) {
      console.error(`❌ Failed to share file with ${customerEmail}:`, error);
      throw error;
    }
  }

  /**
   * Add customer as collaborator when sale is completed
   */
  async addCustomerCollaborator(recordingId: string, customerEmail: string): Promise<void> {
    try {
      const recording = await storage.getFlightRecording(recordingId);
      
      if (!recording || !recording.driveFileId) {
        throw new Error('Recording or Drive file not found');
      }

      // Share the file
      await this.shareFileWithCustomer(recording.driveFileId, customerEmail);

      // Get folder ID and share folder too
      const file = await this.drive.files.get({
        fileId: recording.driveFileId,
        fields: 'parents'
      });

      if (file.data.parents && file.data.parents.length > 0) {
        const folderId = file.data.parents[0];
        await this.shareFileWithCustomer(folderId, customerEmail);
        console.log(`✅ Folder and video shared with ${customerEmail}`);
      }

    } catch (error) {
      console.error('❌ Failed to add customer collaborator:', error);
      throw error;
    }
  }

  /**
   * Get video metadata and preview info for sales interface
   */
  async getVideoInfo(driveFileId: string): Promise<DriveFileInfo | null> {
    try {
      const file = await this.drive.files.get({
        fileId: driveFileId,
        fields: 'id,name,webViewLink,webContentLink,thumbnailLink,videoMediaMetadata,size,createdTime'
      });

      return {
        id: file.data.id,
        name: file.data.name,
        webViewLink: file.data.webViewLink,
        webContentLink: file.data.webContentLink,
        thumbnailLink: file.data.thumbnailLink,
        videoMediaMetadata: file.data.videoMediaMetadata
      };
    } catch (error) {
      console.error(`❌ Failed to get video info for ${driveFileId}:`, error);
      return null;
    }
  }

  /**
   * Generate embedded preview URL for sales interface
   */
  generateEmbedUrl(driveFileId: string): string {
    return `https://drive.google.com/file/d/${driveFileId}/preview`;
  }

  /**
   * Create download link with authentication
   */
  generateDownloadUrl(driveFileId: string): string {
    return `https://drive.google.com/uc?export=download&id=${driveFileId}`;
  }

  /**
   * Upload additional content (photos, raw clips) to customer folder
   */
  async uploadAdditionalContent(
    recordingId: string,
    files: { path: string; name: string; type: string }[]
  ): Promise<DriveFileInfo[]> {
    const uploadedFiles: DriveFileInfo[] = [];

    try {
      const recording = await storage.getFlightRecording(recordingId);
      if (!recording || !recording.driveFileId) {
        throw new Error('Recording or Drive file not found');
      }

      // Get the parent folder ID
      const mainFile = await this.drive.files.get({
        fileId: recording.driveFileId,
        fields: 'parents'
      });

      const folderId = mainFile.data.parents[0];

      for (const file of files) {
        const fileMetadata = {
          name: file.name,
          parents: [folderId]
        };

        const media = {
          mimeType: file.type,
          body: await fs.readFile(file.path).then(buffer => buffer)
        };

        const uploadedFile = await this.drive.files.create({
          resource: fileMetadata,
          media: media,
          fields: 'id,name,webViewLink,webContentLink'
        });

        uploadedFiles.push({
          id: uploadedFile.data.id,
          name: uploadedFile.data.name,
          webViewLink: uploadedFile.data.webViewLink,
          webContentLink: uploadedFile.data.webContentLink
        });
      }

      return uploadedFiles;
    } catch (error) {
      console.error('❌ Failed to upload additional content:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const googleDriveService = new GoogleDriveService();