import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * Service to generate Google Drive shareable links from local file paths
 * Works with Google Drive for Desktop (local sync)
 */
export class GoogleDriveLinkGenerator {
  private googleDriveBasePath: string | null = null;
  private googleDriveFolderName = 'MagnumStream_Videos';

  constructor() {
    this.detectGoogleDrivePath();
  }

  /**
   * Detect Google Drive for Desktop installation path
   */
  private detectGoogleDrivePath(): void {
    const cloudStoragePath = path.join(os.homedir(), 'Library', 'CloudStorage');

    try {
      if (fs.existsSync(cloudStoragePath)) {
        const contents = fs.readdirSync(cloudStoragePath);
        const googleDriveFolder = contents.find(folder => folder.startsWith('GoogleDrive-'));

        if (googleDriveFolder) {
          this.googleDriveBasePath = path.join(cloudStoragePath, googleDriveFolder, 'My Drive');
          console.log(`✅ Google Drive detected at: ${this.googleDriveBasePath}`);
        } else {
          console.warn('⚠️  Google Drive for Desktop not found in CloudStorage');
        }
      }
    } catch (error) {
      console.error('Error detecting Google Drive path:', error);
    }
  }

  /**
   * Check if Google Drive is available
   */
  public isAvailable(): boolean {
    return this.googleDriveBasePath !== null && fs.existsSync(this.googleDriveBasePath);
  }

  /**
   * Copy rendered video to Google Drive and wait for sync
   * @param localVideoPath - Absolute path to the rendered video file
   * @param recordingId - Recording ID for organization
   * @returns Path to file in Google Drive
   */
  public async copyToGoogleDrive(localVideoPath: string, recordingId: string): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Google Drive for Desktop is not available');
    }

    // Verify source file exists
    if (!fs.existsSync(localVideoPath)) {
      throw new Error(`Source video file not found: ${localVideoPath}`);
    }

    // Parse the local path to get date structure and filename
    // Expected format: ~/MagnumStream/rendered/YYYY/MM-Month/DD/Filename.mp4
    const pathParts = localVideoPath.split('/');
    const filename = path.basename(localVideoPath);

    // Find year/month/day from path
    let year = '';
    let month = '';
    let day = '';

    for (let i = pathParts.length - 1; i >= 0; i--) {
      const part = pathParts[i];

      // Day is a 2-digit number (01-31)
      if (!day && /^\d{2}$/.test(part)) {
        day = part;
      }
      // Month is like "10-October"
      else if (!month && /^\d{2}-/.test(part)) {
        month = part;
      }
      // Year is a 4-digit number
      else if (!year && /^\d{4}$/.test(part)) {
        year = part;
      }

      if (year && month && day) break;
    }

    // Create destination path with organized structure
    const destinationDir = path.join(
      this.googleDriveBasePath!,
      this.googleDriveFolderName,
      year || new Date().getFullYear().toString(),
      month || `${String(new Date().getMonth() + 1).padStart(2, '0')}-${new Date().toLocaleDateString('en', { month: 'long' })}`,
      day || String(new Date().getDate()).padStart(2, '0')
    );

    // Ensure destination directory exists
    fs.mkdirSync(destinationDir, { recursive: true });

    const destinationPath = path.join(destinationDir, filename);

    console.log(`📤 Copying video to Google Drive:`);
    console.log(`   Source: ${localVideoPath}`);
    console.log(`   Destination: ${destinationPath}`);

    // Copy file to Google Drive folder
    fs.copyFileSync(localVideoPath, destinationPath);

    // Wait for Google Drive to sync (check file size stability)
    await this.waitForSync(destinationPath);

    console.log(`✅ Video synced to Google Drive: ${destinationPath}`);

    return destinationPath;
  }

  /**
   * Wait for Google Drive to sync a file by checking size stability
   */
  private async waitForSync(filePath: string, maxWaitSeconds: number = 60): Promise<void> {
    const startTime = Date.now();
    let lastSize = 0;
    let stableCount = 0;

    while ((Date.now() - startTime) / 1000 < maxWaitSeconds) {
      try {
        const stats = fs.statSync(filePath);
        const currentSize = stats.size;

        if (currentSize === lastSize && currentSize > 0) {
          stableCount++;
          if (stableCount >= 3) {
            // File size stable for 3 checks = synced
            console.log(`✅ File synced (stable at ${(currentSize / 1024 / 1024).toFixed(2)} MB)`);
            return;
          }
        } else {
          stableCount = 0;
        }

        lastSize = currentSize;
        await new Promise(resolve => setTimeout(resolve, 2000)); // Check every 2 seconds
      } catch (error) {
        console.warn('Error checking sync status:', error);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.warn(`⚠️  Sync check timed out after ${maxWaitSeconds}s - file may still be syncing`);
  }

  /**
   * Generate a Google Drive web link from a file path in Google Drive
   * This creates a link that opens the file in drive.google.com when logged in
   * (Not a public shareable link - requires being logged into the Google account)
   *
   * This method returns the path and web URL for accessing the file
   */
  public async generateShareableLink(driveFilePath: string): Promise<{
    filePath: string;
    relativePath: string;
    instructions: string;
    webUrl: string;
  }> {
    if (!this.isAvailable()) {
      throw new Error('Google Drive not available');
    }

    // Get relative path from My Drive
    const relativePath = driveFilePath.replace(this.googleDriveBasePath! + '/', '');

    const filename = path.basename(driveFilePath);

    // Generate a Google Drive search URL that will find and open the file
    // When logged in, this will show the file in Drive and allow opening it
    const webUrl = `https://drive.google.com/drive/search?q=${encodeURIComponent(filename)}`;

    const instructions = `File synced to Google Drive: ${relativePath}`;

    return {
      filePath: driveFilePath,
      relativePath,
      instructions,
      webUrl
    };
  }

  /**
   * Generate Google Drive web URL from relative path
   * This creates a search URL that finds the file in drive.google.com
   */
  public getWebUrlFromPath(relativePath: string): string {
    const filename = path.basename(relativePath);
    return `https://drive.google.com/drive/search?q=${encodeURIComponent(filename)}`;
  }

  /**
   * Get the full path where a video should be in Google Drive
   * @param customerName - Customer name (extracted from filename)
   * @param timestamp - Timestamp string (YYYYMMDD_HHMMSS format)
   */
  public getExpectedDrivePath(customerName: string, timestamp: string): string | null {
    if (!this.isAvailable()) {
      return null;
    }

    // Parse timestamp to get date structure
    const year = timestamp.substring(0, 4);
    const month = timestamp.substring(4, 6);
    const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en', { month: 'long' });
    const day = timestamp.substring(6, 8);

    const filename = `${customerName}_${timestamp}.mp4`;

    return path.join(
      this.googleDriveBasePath!,
      this.googleDriveFolderName,
      year,
      `${month}-${monthName}`,
      day,
      filename
    );
  }

  /**
   * Check if a file exists in Google Drive
   */
  public fileExistsInDrive(driveFilePath: string): boolean {
    return fs.existsSync(driveFilePath);
  }

  /**
   * Get formatted path for display
   */
  public getDisplayPath(driveFilePath: string): string {
    if (!this.googleDriveBasePath) {
      return driveFilePath;
    }

    return driveFilePath
      .replace(this.googleDriveBasePath, 'My Drive')
      .replace(os.homedir(), '~');
  }
}

// Export singleton instance
export const googleDriveLinkGenerator = new GoogleDriveLinkGenerator();
