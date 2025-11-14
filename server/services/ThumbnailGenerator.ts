import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Service for generating video thumbnails using FFmpeg
 */
export class ThumbnailGenerator {
  private thumbnailsDir: string;

  constructor() {
    // Store thumbnails in a dedicated directory
    this.thumbnailsDir = path.join(process.cwd(), 'thumbnails');
    this.ensureThumbnailsDirectory();
  }

  /**
   * Ensure the thumbnails directory exists
   */
  private ensureThumbnailsDirectory(): void {
    if (!fs.existsSync(this.thumbnailsDir)) {
      fs.mkdirSync(this.thumbnailsDir, { recursive: true });
      console.log(`📁 Created thumbnails directory: ${this.thumbnailsDir}`);
    }
  }

  /**
   * Generate a thumbnail from a video file at a specific timestamp
   * @param videoPath - Absolute path to the video file
   * @param recordingId - Recording ID for naming the thumbnail
   * @param timeOffset - Time in seconds to extract the frame (default: 5)
   * @returns Path to the generated thumbnail image
   */
  async generateThumbnail(
    videoPath: string,
    recordingId: string,
    timeOffset: number = 5
  ): Promise<string> {
    // Validate video file exists
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    // Generate thumbnail filename
    const thumbnailFilename = `${recordingId}.jpg`;
    const thumbnailPath = path.join(this.thumbnailsDir, thumbnailFilename);

    // Check if thumbnail already exists
    if (fs.existsSync(thumbnailPath)) {
      console.log(`✓ Thumbnail already exists: ${thumbnailPath}`);
      return thumbnailPath;
    }

    console.log(`🎬 Generating thumbnail for ${recordingId} at ${timeOffset}s...`);

    try {
      // Use FFmpeg to extract a single frame at the specified time
      // -ss: seek to specified time
      // -i: input file
      // -vframes 1: extract one frame
      // -q:v 2: high quality JPEG (range 1-31, lower is better)
      // -vf scale=640:-1: scale width to 640px, maintain aspect ratio
      const ffmpegCommand = `ffmpeg -ss ${timeOffset} -i "${videoPath}" -vframes 1 -q:v 2 -vf "scale=640:-1" "${thumbnailPath}"`;

      const { stdout, stderr } = await execAsync(ffmpegCommand, {
        timeout: 30000 // 30 second timeout
      });

      // FFmpeg outputs to stderr even on success
      if (stderr && !stderr.includes('frame=')) {
        console.warn(`⚠️  FFmpeg warning: ${stderr.substring(0, 200)}`);
      }

      // Verify the thumbnail was created
      if (!fs.existsSync(thumbnailPath)) {
        throw new Error('Thumbnail file was not created');
      }

      const stats = fs.statSync(thumbnailPath);
      console.log(`✅ Thumbnail generated: ${thumbnailPath} (${(stats.size / 1024).toFixed(1)} KB)`);

      return thumbnailPath;
    } catch (error: any) {
      console.error(`❌ Failed to generate thumbnail for ${recordingId}:`, error.message);

      // Clean up partial file if it exists
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
      }

      throw new Error(`Thumbnail generation failed: ${error.message}`);
    }
  }

  /**
   * Get the web-accessible URL for a thumbnail
   * @param thumbnailPath - Local file path to the thumbnail
   * @returns Relative URL path for serving the thumbnail
   */
  getThumbnailUrl(thumbnailPath: string): string {
    const filename = path.basename(thumbnailPath);
    return `/api/thumbnails/${filename}`;
  }

  /**
   * Get the local file path for a thumbnail by recording ID
   * @param recordingId - Recording ID
   * @returns Local file path to the thumbnail
   */
  getThumbnailPath(recordingId: string): string {
    return path.join(this.thumbnailsDir, `${recordingId}.jpg`);
  }

  /**
   * Check if a thumbnail exists for a recording
   * @param recordingId - Recording ID
   * @returns True if thumbnail exists
   */
  thumbnailExists(recordingId: string): boolean {
    const thumbnailPath = this.getThumbnailPath(recordingId);
    return fs.existsSync(thumbnailPath);
  }

  /**
   * Delete a thumbnail for a recording
   * @param recordingId - Recording ID
   */
  async deleteThumbnail(recordingId: string): Promise<boolean> {
    const thumbnailPath = this.getThumbnailPath(recordingId);

    if (fs.existsSync(thumbnailPath)) {
      try {
        fs.unlinkSync(thumbnailPath);
        console.log(`🗑️  Deleted thumbnail: ${thumbnailPath}`);
        return true;
      } catch (error: any) {
        console.error(`❌ Failed to delete thumbnail: ${error.message}`);
        return false;
      }
    }

    return false;
  }

  /**
   * Get video duration using FFprobe
   * @param videoPath - Absolute path to the video file
   * @returns Duration in seconds
   */
  async getVideoDuration(videoPath: string): Promise<number> {
    try {
      const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;
      const { stdout } = await execAsync(command, { timeout: 10000 });
      const duration = parseFloat(stdout.trim());

      if (isNaN(duration)) {
        throw new Error('Invalid duration returned from ffprobe');
      }

      return duration;
    } catch (error: any) {
      console.error(`❌ Failed to get video duration: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
export const thumbnailGenerator = new ThumbnailGenerator();
