import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { storage } from '../storage';
import { SLOT_TEMPLATE } from '../../shared/schema';

const execAsync = promisify(exec);

interface SlotSelection {
  slotNumber: number;
  windowStart: number;
  sceneType: 'cruising' | 'chase' | 'arrival';
  cameraAngle: 1 | 2;
}

interface ClipFile {
  slotNumber: number;
  filePath: string;
  windowStart: number;
  duration: number;
  sceneType: string;
  cameraAngle: number;
  sceneId: string;
}

interface GeneratedClip {
  id: string;
  recordingId: string;
  sceneId: string;
  slotNumber: number;
  filePath: string;
  windowStart: number;
  duration: number;
  cameraAngle: number;
  sceneType: string;
  clipStatus: string;
  createdAt: Date;
}

export class ClipGenerator {
  private readonly baseDir = './projects';
  
  constructor() {
    this.ensureBaseDirectory();
  }

  private async ensureBaseDirectory() {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create projects directory:', error);
    }
  }

  /**
   * Generate project directory structure:
   * ./projects/
   *   └── John_Doe_2024-01-15/
   *       ├── clips/
   *       │   ├── slot_1_cruising_cam1.mp4
   *       │   ├── slot_2_cruising_cam2.mp4
   *       │   └── ...
   *       └── davinci/
   *           └── job_files/
   */
  private async getProjectDirectory(recordingId: string): Promise<string> {
    // For Mac service: Find project directory by looking for existing uploads
    // Since recording may not exist in local SQLite database
    try {
      // Search for project directories that contain files for this recording
      const projectDirs = await fs.readdir(this.baseDir);
      
      for (const dirName of projectDirs) {
        const projectPath = path.join(this.baseDir, dirName);
        const metadataPath = path.join(projectPath, '.expiration');
        
        try {
          // Check if this project contains our recording
          const metadataContent = await fs.readFile(metadataPath, 'utf8');
          const metadata = JSON.parse(metadataContent);

          if (metadata.recordingId === recordingId || metadata.sessionId === recordingId) {
            console.log(`🎬 Found project directory: ${projectPath}`);
            
            // Create subdirectories
            const clipsDir = path.join(projectPath, 'clips');
            const davinciDir = path.join(projectPath, 'davinci');
            const sourceDir = path.join(projectPath, 'source');
            
            await fs.mkdir(clipsDir, { recursive: true });
            await fs.mkdir(davinciDir, { recursive: true });
            await fs.mkdir(sourceDir, { recursive: true });
            
            return projectPath;
          }
        } catch (metadataError) {
          // Skip directories without valid metadata
          continue;
        }
      }
      
      // Fallback: use the most recent project directory if no exact match found
      console.log(`⚠️ No exact match found for recording ${recordingId}, using most recent project`);
      const sortedDirs = projectDirs.sort((a, b) => {
        const statA = require('fs').statSync(path.join(this.baseDir, a));
        const statB = require('fs').statSync(path.join(this.baseDir, b));
        return statB.mtime.getTime() - statA.mtime.getTime();
      });
      
      if (sortedDirs.length > 0) {
        const fallbackPath = path.join(this.baseDir, sortedDirs[0]);
        console.log(`🎬 Using fallback project directory: ${fallbackPath}`);
        
        // Create subdirectories
        const clipsDir = path.join(fallbackPath, 'clips');
        const davinciDir = path.join(fallbackPath, 'davinci');
        const sourceDir = path.join(fallbackPath, 'source');
        
        await fs.mkdir(clipsDir, { recursive: true });
        await fs.mkdir(davinciDir, { recursive: true });
        await fs.mkdir(sourceDir, { recursive: true });
        
        return fallbackPath;
      }
      
      throw new Error(`No project directory found for recording ${recordingId}`);
    } catch (error) {
      console.error(`🎬 Error finding project directory:`, error);
      throw new Error(`Failed to locate project directory for recording ${recordingId}`);
    }
  }

  async generateClipsFromSlotSelections(recordingId: string, slotSelections?: SlotSelection[]): Promise<ClipFile[]> {
    const clipFiles: ClipFile[] = [];
    const projectDir = await this.getProjectDirectory(recordingId);
    const clipsDir = path.join(projectDir, 'clips');
    const sourceDir = path.join(projectDir, 'source');
    
    console.log(`🎬 Generating clips for recording ${recordingId}`);
    console.log(`📁 Project directory: ${projectDir}`);
    
    // If no slot selections provided, get them from the database
    let slotsToProcess = slotSelections;
    if (!slotsToProcess && storage.getVideoSlotsByRecordingId) {
      console.log(`📊 Fetching saved video slots from database...`);
      const savedSlots = await storage.getVideoSlotsByRecordingId(recordingId);
      slotsToProcess = savedSlots.map(slot => ({
        slotNumber: slot.slot_number,
        windowStart: slot.window_start,
        sceneType: this.getSceneTypeFromSlotNumber(slot.slot_number),
        cameraAngle: slot.camera_angle
      }));
      console.log(`📊 Found ${slotsToProcess.length} saved slots`);
    }
    
    if (!slotsToProcess || slotsToProcess.length === 0) {
      console.warn(`⚠️ No slot selections found for recording ${recordingId}`);
      return clipFiles;
    }
    
    // Group slots by scene type for efficient processing
    const slotsByScene = this.groupSlotsByScene(slotsToProcess);
    
    for (const [sceneType, sceneSlots] of Object.entries(slotsByScene)) {
      console.log(`🎬 Processing ${sceneSlots.length} slots for ${sceneType} scene`);
      
      // Extract scene videos from storage to temporary files
      const sceneVideos = await this.extractSceneVideos(recordingId, sceneType, sourceDir);
      
      for (const slot of sceneSlots) {
        const outputFilename = `slot_${slot.slotNumber}_${slot.sceneType}_cam${slot.cameraAngle}.mp4`;
        const outputPath = path.join(clipsDir, outputFilename);
        
        try {
          // Get the appropriate source video file
          const sourceVideo = sceneVideos[`camera${slot.cameraAngle}`];
          // Get the duration for this slot from SLOT_TEMPLATE
          const slotConfig = SLOT_TEMPLATE.find(config => config.slotNumber === slot.slotNumber);
          const clipDuration = slotConfig?.duration || 3.0; // Fallback to 3.0 if not found
          
          if (!sourceVideo) {
            console.warn(`⚠️ No camera ${slot.cameraAngle} video found for ${sceneType} scene, creating placeholder`);
            await this.createMockClip(outputPath, slot.windowStart, clipDuration);
          } else {
            // Generate clip using FFmpeg
            await this.generateClipFromVideo(sourceVideo, outputPath, slot.windowStart, clipDuration);
          }
          
          const clipFile: ClipFile = {
            slotNumber: slot.slotNumber,
            filePath: outputPath,
            windowStart: slot.windowStart,
            duration: clipDuration,
            sceneType: slot.sceneType,
            cameraAngle: slot.cameraAngle,
            sceneId: `${recordingId}_${slot.sceneType}`
          };
          
          clipFiles.push(clipFile);
          console.log(`✅ Generated clip: ${outputFilename} (${slot.windowStart}s - ${slot.windowStart + clipDuration}s, duration: ${clipDuration}s)`);
          
        } catch (error) {
          console.error(`❌ Failed to generate clip for slot ${slot.slotNumber}:`, error);
        }
      }
    }
    
    console.log(`🎬 Clip generation complete: ${clipFiles.length} clips generated`);
    return clipFiles;
  }

  private getSceneTypeFromSlotNumber(slotNumber: number): 'cruising' | 'chase' | 'arrival' {
    // Based on 14-SLOT TEMPLATE matching DaVinci structure:
    // Slots 1-7: cruising, 8-13: chase, 14: arrival
    if (slotNumber >= 1 && slotNumber <= 7) return 'cruising';
    if (slotNumber >= 8 && slotNumber <= 13) return 'chase';
    if (slotNumber === 14) return 'arrival';
    throw new Error(`Invalid slot number: ${slotNumber}. Valid range is 1-14.`);
  }
  
  private groupSlotsByScene(slots: SlotSelection[]): Record<string, SlotSelection[]> {
    return slots.reduce((groups, slot) => {
      if (!groups[slot.sceneType]) {
        groups[slot.sceneType] = [];
      }
      groups[slot.sceneType].push(slot);
      return groups;
    }, {} as Record<string, SlotSelection[]>);
  }
  
  private async extractSceneVideos(recordingId: string, sceneType: string, sourceDir: string): Promise<Record<string, string>> {
    const videos: Record<string, string> = {};
    
    console.log(`📹 Looking for uploaded ${sceneType} scene videos for recording ${recordingId} in ${sourceDir}`);
    
    const camera1Path = path.join(sourceDir, `${sceneType}_camera1.mp4`);
    const camera2Path = path.join(sourceDir, `${sceneType}_camera2.mp4`);
    
    // Check if uploaded files exist
    try {
      await fs.access(camera1Path);
      videos.camera1 = camera1Path;
      console.log(`📹 Found uploaded camera 1 file: ${camera1Path}`);
    } catch {
      console.log(`📹 Camera 1 file not found for ${sceneType}, skipping`);
    }
    
    try {
      await fs.access(camera2Path);
      videos.camera2 = camera2Path;
      console.log(`📹 Found uploaded camera 2 file: ${camera2Path}`);
    } catch {
      console.log(`📹 Camera 2 file not found for ${sceneType}, skipping`);
    }
    
    return videos;
  }
  
  private async generateClipFromVideo(sourceVideoPath: string, outputPath: string, startTime: number, duration: number): Promise<void> {
    // CRITICAL: Frame-accurate cutting for DaVinci Resolve timeline placement
    // Must produce EXACT duration to match template slot positions on track V3

    // Calculate exact frame count at 23.976 fps (DaVinci template frame rate)
    const fps = 23.976;
    const exactFrames = Math.round(duration * fps);
    const exactDuration = exactFrames / fps;

    console.log(`🎬 Generating clip: ${exactFrames} frames (${exactDuration.toFixed(3)}s) at ${fps} fps`);

    const ffmpegCommand = [
      'ffmpeg', '-y',
      '-ss', startTime.toString(),          // Seek to start time
      '-i', `"${sourceVideoPath}"`,
      '-t', exactDuration.toString(),       // Use frame-accurate duration
      '-vf', `fps=${fps}`,                  // Force exact frame rate with filter
      '-c:v', 'libx264',
      '-preset', 'fast',                    // Balance speed and quality
      '-crf', '18',                         // High quality (visually lossless)
      '-g', '1',                            // Keyframe every frame (GOP=1) for frame accuracy
      '-vsync', 'cfr',                      // Constant frame rate - no dropped frames
      '-video_track_timescale', '24000',    // Match DaVinci timeline timescale
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '48000',
      '-ac', '2',                           // Stereo audio
      '-avoid_negative_ts', 'make_zero',   // Fix timestamp issues
      '-movflags', '+faststart',            // Optimize for playback
      '-pix_fmt', 'yuv420p',               // Ensure compatible pixel format
      `"${outputPath}"`
    ].join(' ');

    console.log(`🔧 FFmpeg command: ${ffmpegCommand}`);

    try {
      const { stderr } = await execAsync(ffmpegCommand);
      if (stderr && !stderr.includes('frame=')) {
        console.warn(`FFmpeg stderr: ${stderr}`);
      }
    } catch (error) {
      console.error('FFmpeg error:', error);
      // Fall back to creating a mock clip
      await this.createMockClip(outputPath, startTime, duration);
    }
  }

  private async createMockClip(outputPath: string, startTime: number, duration: number): Promise<void> {
    // Create a simple test video using FFmpeg (black screen with timer)
    const ffmpegCommand = [
      'ffmpeg', '-y',
      '-f', 'lavfi',
      '-i', `color=black:size=1920x1080:duration=${duration}:rate=24`,
      '-f', 'lavfi',
      '-i', `sine=frequency=440:duration=${duration}`,
      '-vf', `drawtext=text='Slot Demo ${startTime.toFixed(1)}s':fontcolor=white:fontsize=72:x=(w-text_w)/2:y=(h-text_h)/2`,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      `"${outputPath}"`
    ].join(' ');
    
    try {
      await execAsync(ffmpegCommand);
    } catch (error) {
      // If FFmpeg is not available, create a placeholder file
      console.warn('FFmpeg not available, creating placeholder file');
      await fs.writeFile(outputPath, `Mock video clip - Slot demo ${startTime.toFixed(1)}s`);
    }
  }

  async getProjectClips(recordingId: string): Promise<any[]> {
    const projectDir = await this.getProjectDirectory(recordingId);
    const clipsDir = path.join(projectDir, 'clips');
    
    try {
      const files = await fs.readdir(clipsDir);
      const clipFiles = files.filter(f => f.endsWith('.mp4')).map(filename => {
        const match = filename.match(/slot_(\d+)_(\w+)_cam(\d+)\.mp4/);
        if (match) {
          const [, slotNumber, sceneType, cameraAngle] = match;
          return {
            slotNumber: parseInt(slotNumber),
            sceneType,
            cameraAngle: parseInt(cameraAngle),
            filePath: path.join(clipsDir, filename),
            filename
          };
        }
        return null;
      }).filter((item): item is NonNullable<typeof item> => item !== null);
      
      return clipFiles.sort((a, b) => a.slotNumber - b.slotNumber);
    } catch (error) {
      console.warn(`No clips directory found for recording ${recordingId}`);
      return [];
    }
  }

  async getProjectDirectoryPath(recordingId: string): Promise<string> {
    return await this.getProjectDirectory(recordingId);
  }

  async createDaVinciJobFile(recordingId: string): Promise<string> {
    const clips = await this.getProjectClips(recordingId);
    const projectDir = await this.getProjectDirectory(recordingId);
    const davinciDir = path.join(projectDir, 'davinci');
    
    // For Mac service: Get project info from metadata instead of database lookup
    const metadataPath = path.join(projectDir, '.expiration');
    let projectMetadata: any = {};
    
    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      projectMetadata = JSON.parse(metadataContent);
      console.log('📄 Using project metadata for DaVinci job:', projectMetadata);
    } catch (error) {
      console.warn('📄 No project metadata found, using defaults');
    }
    
    const currentDate = new Date().toISOString().split('T')[0];
    const projectName = projectMetadata.projectName || `Project_${currentDate}`;
    
    const jobData = {
      jobId: randomUUID(),
      recordingId,
      projectName: `${projectName}_${currentDate}`,
      templateProject: "MagnumPI_Template",
      clips: {} as Record<number, any>,
      metadata: {
        projectName: projectName,
        sessionId: projectMetadata.sessionId || 'unknown',
        createdAt: new Date().toISOString(),
        recordingId: recordingId
      }
    };
    
    // Map clips to DaVinci slot positions
    clips.forEach(clip => {
      // Get the duration for this slot from SLOT_TEMPLATE
      const slotConfig = SLOT_TEMPLATE.find(config => config.slotNumber === clip.slotNumber);
      const clipDuration = slotConfig?.duration || 3.0; // Fallback to 3.0 if not found
      
      jobData.clips[clip.slotNumber] = {
        filename: clip.filename,
        fullPath: path.resolve(clip.filePath),
        slotNumber: clip.slotNumber,
        sceneType: clip.sceneType,
        cameraAngle: clip.cameraAngle,
        duration: clipDuration
      };
    });
    
    const jobFilePath = path.join(davinciDir, `job_${jobData.jobId}.json`);
    await fs.writeFile(jobFilePath, JSON.stringify(jobData, null, 2));
    
    console.log(`📄 Created DaVinci job file: ${jobFilePath}`);
    console.log(`📊 Job includes ${clips.length} clips for ${Object.keys(jobData.clips).length} slots`);
    
    return jobFilePath;
  }
}