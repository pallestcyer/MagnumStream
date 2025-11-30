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
      
      // No fallback - each project must have its own directory with correct recordingId
      // Using "most recent" fallback was causing clips from different projects to mix!
      console.error(`❌ No project directory found for recordingId: ${recordingId}`);
      console.error(`   Available projects: ${projectDirs.join(', ')}`);
      throw new Error(`No project directory found for recordingId: ${recordingId}. Ensure videos were uploaded for this project.`);
    } catch (error) {
      console.error(`❌ Error finding project directory:`, error);
      throw new Error(`Failed to locate project directory for ${recordingId}`);
    }
  }

  async generateClipsFromSlotSelections(recordingId: string, slotSelections?: SlotSelection[]): Promise<ClipFile[]> {
    const clipFiles: ClipFile[] = [];
    const projectDir = await this.getProjectDirectory(recordingId);
    const clipsDir = path.join(projectDir, 'clips');
    const sourceDir = path.join(projectDir, 'source');

    console.log(`🎬 Generating clips for ${recordingId}`);
    
    // If no slot selections provided, get them from the database
    let slotsToProcess = slotSelections;
    if (!slotsToProcess && storage.getVideoSlotsByRecordingId) {
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

    const camera1Path = path.join(sourceDir, `${sceneType}_camera1.mp4`);
    const camera2Path = path.join(sourceDir, `${sceneType}_camera2.mp4`);

    // Check if uploaded files exist
    try {
      await fs.access(camera1Path);
      videos.camera1 = camera1Path;
    } catch {
      // Camera 1 not found
    }

    try {
      await fs.access(camera2Path);
      videos.camera2 = camera2Path;
    } catch {
      // Camera 2 not found
    }

    return videos;
  }
  
  private async generateClipFromVideo(sourceVideoPath: string, outputPath: string, startTime: number, duration: number): Promise<void> {
    // CRITICAL: Frame-accurate cutting for DaVinci Resolve timeline placement
    // Must produce EXACT duration to match template slot positions on track V3

    // Calculate exact frame count at 23.976 fps (DaVinci template frame rate)
    const fps = 23.976;
    const exactFrames = Math.round(duration * fps);

    // BLACK FRAME FIX + EXACT FRAMES STRATEGY:
    // The black frame issue occurs because H.264/HEVC decoding requires starting from a keyframe.
    // When seeking to a non-keyframe, the decoder may output black/incomplete frames.
    //
    // Solution: Force FFmpeg to fully decode from the previous keyframe before our target,
    // then use the trim filter on the fully-decoded stream to get exact frames.
    // The -accurate_seek flag (default) combined with post-input -ss ensures proper decoding.

    // Calculate time for exact duration needed
    const exactDuration = exactFrames / fps;

    const ffmpegCommand = [
      'ffmpeg', '-y',
      // Force full decode by not using pre-input seek
      '-i', `"${sourceVideoPath}"`,
      // Post-input seek - forces decode from keyframe to target
      '-ss', startTime.toString(),
      // Exact duration output
      '-t', exactDuration.toString(),
      // Force constant frame rate output matching our fps
      '-r', fps.toString(),
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '18',
      // All keyframes for clean editing
      '-g', '1',
      '-bf', '0',
      '-vsync', 'cfr',
      '-video_track_timescale', '24000',
      // Audio processing
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '48000',
      '-ac', '2',
      '-movflags', '+faststart',
      '-pix_fmt', 'yuv420p',
      `"${outputPath}"`
    ].join(' ');

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
    } catch (error) {
      console.warn('⚠️ No project metadata found, using defaults');
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

    console.log(`✅ DaVinci job file created with ${clips.length} clips`);

    return jobFilePath;
  }
}