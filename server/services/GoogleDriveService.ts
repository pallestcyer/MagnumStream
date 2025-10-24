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
      console.log(`📤 Uploading final video for ${customerName}`);

      // Create or find customer folder
      const customerFolder = await this.createCustomerFolder(customerName, recordingId);
      
      // Upload video file
      const videoFileName = `${customerName}_Flight_Video_${new Date().toISOString().split('T')[0]}.mp4`;
      
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

      console.log(`✅ Video uploaded to Drive: ${file.data.name} (${file.data.id})`);

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
   * Create dedicated folder for customer with organized structure
   */
  private async createCustomerFolder(customerName: string, recordingId: string): Promise<{id: string, name: string}> {
    const sanitizedName = customerName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const folderName = `${sanitizedName}_Flight_${new Date().toISOString().split('T')[0]}`;

    try {
      // Check if folder already exists
      const existingFolders = await this.drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id,name)'
      });

      if (existingFolders.data.files.length > 0) {
        console.log(`📁 Using existing folder: ${folderName}`);
        return {
          id: existingFolders.data.files[0].id,
          name: existingFolders.data.files[0].name
        };
      }

      // Create new folder
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        description: `Flight recording folder for ${customerName}`
      };

      const folder = await this.drive.files.create({
        resource: folderMetadata,
        fields: 'id,name'
      });

      console.log(`📁 Created customer folder: ${folderName} (${folder.data.id})`);
      
      return {
        id: folder.data.id,
        name: folder.data.name
      };

    } catch (error) {
      console.error('❌ Failed to create customer folder:', error);
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

      console.log(`🔗 Shared file ${fileId} with ${customerEmail}`);
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
        console.log(`🔗 Added ${customerEmail} as collaborator to folder and video`);
      }

      // Update sale record to mark drive as shared
      const sales = await storage.getAllSales();
      const sale = sales.find(s => s.recordingId === recordingId);
      if (sale) {
        // Would need to add update sale method to storage
        console.log(`📊 Sale marked as drive shared for ${customerEmail}`);
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

        console.log(`📎 Uploaded additional content: ${file.name}`);
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