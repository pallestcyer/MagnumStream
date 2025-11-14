import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSaleSchema, insertFlightRecordingSchema, SLOT_TEMPLATE } from "./schema";
import { ClipGenerator } from "./services/ClipGenerator";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

// Extend session to include Google OAuth properties
declare module 'express-session' {
  interface SessionData {
    googleTokens?: any;
    googleUserInfo?: any;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  console.log('🔧 Starting route registration...');
  
  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      res.json({ 
        status: "ok", 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: "MagnumStream Local Device Service"
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get camera configuration
  app.get("/api/camera-config", async (req, res) => {
    try {
      const cameraConfig = {
        camera1: {
          deviceId: process.env.CAMERA_1_DEVICE_ID || "default-camera-1",
          label: "Camera 1 (Side View)"
        },
        camera2: {
          deviceId: process.env.CAMERA_2_DEVICE_ID || "default-camera-2",
          label: "Camera 2 (Front View)"
        }
      };
      
      console.log('📹 Camera configuration requested:', cameraConfig);
      res.json(cameraConfig);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get all flight recordings with optional date filter
  app.get("/api/recordings", async (req, res) => {
    try {
      const { date } = req.query;
      let recordings = await storage.getAllFlightRecordings();
      
      // Filter by date if provided
      if (date && typeof date === 'string') {
        recordings = recordings.filter(r => r.flightDate === date);
      }
      
      res.json(recordings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create or update flight recording (for session-based projects)
  app.post("/api/recordings", async (req, res) => {
    try {
      const { projectName, pilotName, pilotEmail, staffMember, flightDate, flightTime, exportStatus, sessionId } = req.body;
      
      // Check if recording already exists for this session/pilot
      let recording;

      if (sessionId && storage.findRecordingBySessionId) {
        recording = await storage.findRecordingBySessionId(sessionId);
      }

      // If not found by session ID, look for recent recording with matching name (case-insensitive)
      // Only match recordings from last 24 hours to avoid matching old customers with same name
      if (!recording) {
        const allRecordings = await storage.getAllFlightRecordings();
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        recording = allRecordings.find(r =>
          r.pilotName.toLowerCase() === pilotName.toLowerCase() &&
          new Date(r.createdAt) > oneDayAgo
        );
      }
      
      if (recording) {
        // Update existing recording
        recording = await storage.updateFlightRecording(recording.id, {
          exportStatus: exportStatus || recording.exportStatus,
          flightDate: flightDate || recording.flightDate,
          flightTime: flightTime || recording.flightTime
        });
      } else {
        // Create new recording
        recording = await storage.createFlightRecording({
          projectName: projectName || `${pilotName} Flight`,
          pilotName,
          pilotEmail,
          staffMember,
          flightDate,
          flightTime,
          exportStatus: exportStatus || 'pending'
        });
      }
      
      res.json(recording);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================================================
  // VIDEO SLOTS TIMELINE PERSISTENCE ENDPOINTS (Must come before generic :id routes)
  // ============================================================================

  // Get video slots for a recording
  app.get("/api/recordings/:recordingId/video-slots", async (req, res) => {
    try {
      const { recordingId } = req.params;

      if (storage.getVideoSlotsByRecordingId) {
        try {
          const slots = await storage.getVideoSlotsByRecordingId(recordingId);
          
          // Ensure we return a valid JSON array
          const validSlots = Array.isArray(slots) ? slots : [];
          res.setHeader('Content-Type', 'application/json');
          res.json(validSlots);
        } catch (storageError: any) {
          console.error('❌ API: Storage error:', storageError.message);
          // Return empty array instead of error to avoid breaking the UI
          res.setHeader('Content-Type', 'application/json');
          res.json([]);
        }
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.json([]);
      }
    } catch (error: any) {
      console.error('❌ API: Error getting video slots:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Create or update video slot
  app.post("/api/recordings/:recordingId/video-slots", async (req, res) => {
    try {
      const { recordingId } = req.params;
      const { slotNumber, sceneId, cameraAngle, windowStart, slotDuration } = req.body;
      
      if (!slotNumber || !sceneId || !cameraAngle || windowStart === undefined) {
        return res.status(400).json({ 
          error: "Missing required fields: slotNumber, sceneId, cameraAngle, windowStart" 
        });
      }
      
      if (storage.createVideoSlot) {
        const slot = await storage.createVideoSlot({
          recordingId,
          slotNumber: parseInt(slotNumber),
          sceneId,
          cameraAngle: parseInt(cameraAngle),
          windowStart: parseFloat(windowStart),
          slotDuration: slotDuration ? parseFloat(slotDuration) : 3.0
        });
        
        res.json(slot);
      } else {
        res.status(501).json({ error: "Video slot creation not implemented" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update video slot timeline position
  app.patch("/api/recordings/:recordingId/video-slots/:slotNumber", async (req, res) => {
    try {
      const { recordingId, slotNumber } = req.params;
      const { windowStart } = req.body;
      
      if (windowStart === undefined) {
        return res.status(400).json({ error: "windowStart is required" });
      }
      
      if (storage.createVideoSlot && storage.getVideoSlotsByRecordingId) {
        const existingSlots = await storage.getVideoSlotsByRecordingId(recordingId);
        const existingSlot = existingSlots.find(s => s.slot_number === parseInt(slotNumber));
        
        if (existingSlot) {
          // Update existing slot
          const updatedSlot = await storage.createVideoSlot({
            recordingId,
            slotNumber: parseInt(slotNumber),
            sceneId: existingSlot.scene_id,
            cameraAngle: existingSlot.camera_angle,
            windowStart: parseFloat(windowStart),
            slotDuration: existingSlot.slot_duration
          });
          
          res.json(updatedSlot);
        } else {
          // Create new slot with default values from SLOT_TEMPLATE
          const slotConfig = SLOT_TEMPLATE.find(s => s.slotNumber === parseInt(slotNumber));
          if (!slotConfig) {
            return res.status(400).json({ error: "Invalid slot number" });
          }
          
          // For now, use a placeholder scene ID - this should be improved to get actual scene IDs
          const newSlot = await storage.createVideoSlot({
            recordingId,
            slotNumber: parseInt(slotNumber),
            sceneId: `${recordingId}_${slotConfig.sceneType}`, // Placeholder scene ID
            cameraAngle: slotConfig.cameraAngle,
            windowStart: parseFloat(windowStart),
            slotDuration: 3.0
          });
          
          res.json(newSlot);
        }
      } else {
        res.status(501).json({ error: "Video slot update not implemented" });
      }
    } catch (error: any) {
      console.error('❌ Error updating video slot:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update flight recording status
  app.patch("/api/recordings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const recording = await storage.updateFlightRecording(id, updates);
      
      if (!recording) {
        return res.status(404).json({ error: "Recording not found" });
      }
      
      res.json(recording);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create sale with automatic Google Drive sharing
  app.post("/api/sales", async (req, res) => {
    try {
      const validated = insertSaleSchema.parse(req.body);
      const sale = await storage.createSale(validated);
      
      // Automatically share Google Drive folder with customer
      try {
        const { googleDriveService } = await import('./services/GoogleDriveService');
        await googleDriveService.addCustomerCollaborator(
          validated.recordingId, 
          validated.customerEmail
        );
        console.log(`🔗 Google Drive access granted to ${validated.customerEmail}`);
      } catch (driveError) {
        console.warn('⚠️ Failed to share Google Drive access:', driveError);
        // Don't fail the sale if Drive sharing fails
      }
      
      res.json(sale);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get all sales
  app.get("/api/sales", async (_req, res) => {
    try {
      const sales = await storage.getAllSales();
      res.json(sales);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get sales analytics with per-day breakdown
  app.get("/api/sales/analytics", async (_req, res) => {
    try {
      const sales = await storage.getAllSales();
      const recordings = await storage.getAllFlightRecordings();
      
      const totalRecordings = recordings.length;
      const totalSales = sales.length;
      const exportedRecordings = recordings.filter(r => r.exportStatus === "completed").length;
      const conversionRate = exportedRecordings > 0 ? (totalSales / exportedRecordings) * 100 : 0;
      
      // Staff performance
      const staffSales = sales.reduce((acc, sale) => {
        acc[sale.staffMember] = (acc[sale.staffMember] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Revenue
      const totalRevenue = sales.reduce((sum, sale) => sum + (sale.saleAmount || 0), 0);
      
      // Per-day analytics
      const dailyStats = sales.reduce((acc, sale) => {
        const dateKey = sale.saleDate.toISOString().split('T')[0];
        if (!acc[dateKey]) {
          acc[dateKey] = { date: dateKey, sales: 0, revenue: 0 };
        }
        acc[dateKey].sales += 1;
        acc[dateKey].revenue += sale.saleAmount || 0;
        return acc;
      }, {} as Record<string, { date: string; sales: number; revenue: number }>);
      
      const dailyBreakdown = Object.values(dailyStats).sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      res.json({
        totalRecordings,
        totalSales,
        exportedRecordings,
        conversionRate,
        staffSales,
        totalRevenue,
        dailyBreakdown,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Submit issue report
  app.post("/api/issues", async (req, res) => {
    try {
      if (!storage.createIssue) {
        return res.status(501).json({
          error: "Issue reporting not available with current storage implementation"
        });
      }

      const { staffName, issueType, priority, description } = req.body;

      if (!staffName || !issueType || !description) {
        return res.status(400).json({
          error: "Missing required fields: staffName, issueType, and description are required"
        });
      }

      const issue = await storage.createIssue({
        staffName,
        issueType,
        priority: priority || null,
        description,
      });

      console.log('📝 Issue reported:', {
        id: issue.id,
        staffName,
        issueType,
        priority: priority || 'not specified',
      });

      res.json(issue);
    } catch (error: any) {
      console.error('❌ Error creating issue:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all issues
  app.get("/api/issues", async (_req, res) => {
    try {
      if (!storage.getAllIssues) {
        return res.status(501).json({
          error: "Issue retrieval not available with current storage implementation"
        });
      }

      const issues = await storage.getAllIssues();
      res.json(issues);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update issue status
  app.patch("/api/issues/:issueId", async (req, res) => {
    try {
      if (!storage.updateIssue) {
        return res.status(501).json({
          error: "Issue updates not available with current storage implementation"
        });
      }

      const { issueId } = req.params;
      const { status, notes } = req.body;

      const updatedIssue = await storage.updateIssue(issueId, {
        status,
        notes,
        ...(status === 'resolved' || status === 'closed' ? { resolvedAt: new Date().toISOString() } : {}),
      });

      res.json(updatedIssue);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Debug storage info
  app.get("/api/debug/storage-info", async (req, res) => {
    try {
      res.json({
        storageType: storage.constructor.name,
        hasDeleteMethod: typeof storage.deleteFlightRecording === 'function',
        useSupabase: process.env.USE_SUPABASE,
        recordingCount: (await storage.getAllFlightRecordings()).length
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Clear sample data endpoint (for development only)
  app.delete("/api/recordings/clear-sample-data", async (req, res) => {
    try {
      const recordings = await storage.getAllFlightRecordings();
      let deletedCount = 0;
      const deletedRecords = [];
      
      // Delete the specific sample records
      for (const recording of recordings) {
        if (['Sunset Flight Tour', 'Mountain Adventure', 'Coastal Tour'].includes(recording.projectName)) {
          if (storage.deleteFlightRecording) {
            const success = await storage.deleteFlightRecording(recording.id);
            if (success) {
              console.log(`🗑️ Deleted sample record: ${recording.projectName} (${recording.id})`);
              deletedCount++;
              deletedRecords.push({
                id: recording.id,
                projectName: recording.projectName,
                pilotName: recording.pilotName
              });
            } else {
              console.log(`❌ Failed to delete: ${recording.projectName} (${recording.id})`);
            }
          } else {
            console.log(`🗑️ Would delete sample record: ${recording.projectName}`);
            deletedCount++;
          }
        }
      }
      
      res.json({ 
        message: `Successfully deleted ${deletedCount} sample records.`,
        deletedRecords: deletedRecords,
        success: true
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Sample data initialization disabled for production use
  // Uncomment the following section if you want to add sample data for testing:
  
  /*
  const initData = async () => {
    const existing = await storage.getAllFlightRecordings();
    if (existing.length === 0) {
      console.log('📝 Adding sample data for testing...');
      // Create sample recordings here if needed
    }
  };
  initData();
  */

  // ============================================================================
  // VIDEO UPLOAD ENDPOINTS
  // ============================================================================
  
  console.log('🔧 Setting up video upload endpoints...');
  
  try {
    console.log('🔧 Importing multer...');
    const multer = (await import('multer')).default;
    console.log('🔧 Importing fs...');
    const fs = (await import('fs')).promises;
    console.log('🔧 Importing path...');
    const path = await import('path');
    console.log('✅ All imports successful for video upload endpoints');
  
  const multerStorage = multer.memoryStorage();
  const upload = multer({ 
    storage: multerStorage,
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
  });

  // Cleanup expired project folders
  const cleanupExpiredFolders = async () => {
    try {
      const projectsDir = './projects';
      const folders = await fs.readdir(projectsDir);
      let cleanedCount = 0;
      
      for (const folder of folders) {
        const metadataPath = path.join(projectsDir, folder, '.expiration');
        try {
          const metadataContent = await fs.readFile(metadataPath, 'utf8');
          const metadata = JSON.parse(metadataContent);
          
          if (new Date(metadata.expiresAt) < new Date()) {
            const folderPath = path.join(projectsDir, folder);
            await fs.rm(folderPath, { recursive: true, force: true });
            console.log(`🗑️ Cleaned up expired folder: ${folder}`);
            cleanedCount++;
          }
        } catch {
          // No metadata file or parsing error, skip this folder
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🧹 Cleanup complete: ${cleanedCount} expired folders removed`);
      }
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  };
  
  // Run cleanup every hour
  setInterval(cleanupExpiredFolders, 60 * 60 * 1000);
  
  // Manual cleanup endpoint
  app.post("/api/cleanup-expired", async (_req, res) => {
    try {
      await cleanupExpiredFolders();
      res.json({ success: true, message: "Cleanup completed" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Upload scene video from browser IndexedDB to server file system
  app.post("/api/recordings/:recordingId/upload-scene-video", upload.single('video'), async (req: any, res) => {
    try {
      const { recordingId } = req.params;
      const { sceneType, cameraAngle, duration, sessionId } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: "No video file provided" });
      }
      
      // Create directory structure using sessionId instead of database recording
      const date = new Date().toISOString().split('T')[0];
      const sanitizedName = sessionId.replace(/[^a-zA-Z0-9_]/g, '_');
      
      // Create project directory structure with expiration metadata
      const projectDir = path.join('./projects', `${sanitizedName}_${date}`);
      const sourceDir = path.join(projectDir, 'source');
      
      await fs.mkdir(sourceDir, { recursive: true });
      
      // Create expiration metadata file (24 hours from now)
      const expirationTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const metadataPath = path.join(projectDir, '.expiration');
      await fs.writeFile(metadataPath, JSON.stringify({
        createdAt: new Date().toISOString(),
        expiresAt: expirationTime,
        recordingId,
        sessionId,
        projectName: sanitizedName
      }, null, 2));
      
      // Save video file
      const filename = `${sceneType}_camera${cameraAngle}.mp4`;
      const filePath = path.join(sourceDir, filename);
      
      await fs.writeFile(filePath, req.file.buffer);

      res.json({
        success: true,
        message: `Video uploaded successfully`,
        filePath,
        sceneType,
        cameraAngle,
        duration: parseFloat(duration),
        expiresAt: expirationTime
      });
      
    } catch (error: any) {
      console.error('Video upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // CLIP GENERATION ENDPOINTS
  // ============================================================================
  
  const clipGenerator = new ClipGenerator();

  // Generate clips from slot selections
  app.post("/api/recordings/:recordingId/generate-clips", async (req, res) => {
    try {
      const { recordingId } = req.params;
      const { slotSelections } = req.body;
      
      if (!slotSelections || !Array.isArray(slotSelections)) {
        return res.status(400).json({ error: "slotSelections array is required" });
      }
      
      const clipFiles = await clipGenerator.generateClipsFromSlotSelections(recordingId, slotSelections);
      
      res.json({
        success: true,
        message: `Generated ${clipFiles.length} clips`,
        clips: clipFiles
      });
      
    } catch (error: any) {
      console.error('Clip generation error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get clips for a recording
  app.get("/api/recordings/:recordingId/clips", async (req, res) => {
    try {
      const { recordingId } = req.params;
      const clips = await clipGenerator.getProjectClips(recordingId);
      res.json(clips);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create DaVinci job file for a recording
  app.post("/api/recordings/:recordingId/create-davinci-job", async (req, res) => {
    try {
      const { recordingId } = req.params;
      const jobFilePath = await clipGenerator.createDaVinciJobFile(recordingId);
      
      res.json({
        success: true,
        message: "DaVinci job file created",
        jobFilePath
      });
      
    } catch (error: any) {
      console.error('DaVinci job creation error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Render project with DaVinci Resolve (final step in workflow)
  app.post("/api/recordings/:recordingId/render-davinci", async (req, res) => {
    try {
      const { recordingId } = req.params;
      const { projectName, googleTokens } = req.body;
      
      console.log(`🎬 Starting DaVinci render for recording ${recordingId}`);
      
      // First ensure clips and job file exist
      const clips = await clipGenerator.getProjectClips(recordingId);
      if (clips.length === 0) {
        return res.status(400).json({ error: "No clips found. Please generate clips first." });
      }
      
      // Create job file if it doesn't exist
      let jobFilePath;
      try {
        jobFilePath = await clipGenerator.createDaVinciJobFile(recordingId);
        console.log(`📄 Using DaVinci job file: ${jobFilePath}`);
      } catch (error) {
        console.error('Failed to create job file:', error);
        return res.status(500).json({ error: "Failed to create DaVinci job file" });
      }
      
      // Execute DaVinci.py script to render the project
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const path = await import('path');
      
      // Get the absolute path to DaVinci.py (should be in project root)
      const davinciScriptPath = path.resolve('./Davinci.py');
      
      // Set up DaVinci environment variables for the Python script
      const davinciEnv = {
        ...process.env,
        RESOLVE_SCRIPT_LIB: "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so",
        RESOLVE_SCRIPT_API: "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting",
        PYTHONPATH: `${process.env.PYTHONPATH || ''}:/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules`
      };
      
      const davinciCommand = `python3 "${davinciScriptPath}" --job-file "${jobFilePath}"`;
      
      console.log(`🔧 Executing DaVinci command: ${davinciCommand}`);
      console.log(`🔧 DaVinci environment: RESOLVE_SCRIPT_API=${davinciEnv.RESOLVE_SCRIPT_API}`);
      
      // Execute with timeout and proper environment (DaVinci rendering can take a while)
      const { stdout, stderr } = await execAsync(davinciCommand, { 
        timeout: 30 * 60 * 1000, // 30 minutes timeout
        env: davinciEnv
      });
      
      console.log(`🎬 DaVinci stdout: ${stdout}`);
      if (stderr) {
        console.warn(`🎬 DaVinci stderr: ${stderr}`);
      }
      
      // Parse output to get result
      if (stdout.includes('SUCCESS:')) {
        const outputPath = stdout.split('SUCCESS: ')[1]?.trim();
        console.log(`✅ DaVinci render completed: ${outputPath}`);

        // IMPORTANT: Always update status to completed when render succeeds
        // This ensures the recording appears in History as complete even if Drive upload fails
        console.log(`📊 Updating recording ${recordingId} status to completed...`);
        try {
          await storage.updateFlightRecording(recordingId, {
            exportStatus: "completed",
            localVideoPath: outputPath
          });
          console.log(`✅ Recording ${recordingId} marked as completed`);

          // VERIFY the update actually worked
          const verifyRecording = await storage.getFlightRecording(recordingId);
          if (verifyRecording) {
            console.log(`✅ VERIFIED: Recording ${recordingId} status is now: ${verifyRecording.exportStatus}`);
            if (verifyRecording.exportStatus !== 'completed') {
              console.error(`❌ STATUS UPDATE FAILED! Expected 'completed', got '${verifyRecording.exportStatus}'`);
            }
          } else {
            console.error(`❌ Could not verify recording ${recordingId} - recording not found after update`);
          }
        } catch (statusUpdateError) {
          console.error(`❌ CRITICAL: Failed to update recording ${recordingId} status to completed:`, statusUpdateError);
          // Continue with thumbnail generation and Drive upload even if status update fails
        }

        // Generate thumbnail from the rendered video and upload to Supabase
        console.log(`📸 Generating thumbnail for recording ${recordingId}...`);
        try {
          const { thumbnailGenerator } = await import('./services/ThumbnailGenerator');

          // Generate thumbnail at 41 seconds and upload to Supabase Storage
          // Returns the Supabase public URL
          const thumbnailUrl = await thumbnailGenerator.generateThumbnail(
            outputPath,
            recordingId,
            41 // Time offset in seconds
          );

          // Update recording with Supabase public URL
          await storage.updateFlightRecording(recordingId, {
            thumbnailUrl
          });

          console.log(`✅ Thumbnail generated and uploaded to Supabase: ${thumbnailUrl}`);
        } catch (thumbnailError) {
          console.error(`⚠️  Failed to generate thumbnail (non-critical):`, thumbnailError);
          // Don't fail the whole render if thumbnail generation fails
        }

        // Copy the rendered video to Google Drive (local sync)
        // Declare actualRecordingId at outer scope so it's available in catch block
        let actualRecordingId = recordingId;

        try {
          const fs = await import('fs');
          const path = await import('path');

          // Check if the rendered file exists
          if (!fs.existsSync(outputPath)) {
            console.error(`❌ Rendered file not found at: ${outputPath}`);
            throw new Error(`Rendered file not found: ${outputPath}`);
          }

          console.log(`📤 Syncing rendered video to Google Drive...`);

          // Use local Google Drive sync instead of API
          const { googleDriveLinkGenerator } = await import('./services/GoogleDriveLinkGenerator');

          // Get the recording to extract customer info
          // IMPORTANT: Use the exact recording ID provided - do NOT fall back to latest
          let recording = await storage.getFlightRecording(recordingId);

          if (!recording) {
            console.error(`❌ Recording not found by ID ${recordingId}`);
            throw new Error(`Recording not found: ${recordingId}. Cannot update status for a different recording.`);
          }

          console.log(`✅ Found recording: ${recording.id} (${recording.pilotName}, status: ${recording.exportStatus})`);
          actualRecordingId = recording.id;

          const customerName = recording.pilotName || 'Customer';
          const fileName = path.basename(outputPath);

          // Check if Google Drive for Desktop is available
          if (!googleDriveLinkGenerator.isAvailable()) {
            console.warn('⚠️ Google Drive for Desktop not found - skipping sync');
            console.warn('⚠️ Video file saved locally at: ' + outputPath);

            // Status already updated above, just log
            console.log(`✅ Recording ${actualRecordingId} completed (Drive sync skipped)`);

            res.json({
              success: true,
              message: "DaVinci render completed successfully (Drive sync skipped - not available)",
              outputPath,
              renderInfo: {
                recordingId,
                projectName: projectName || `Project_${recordingId}`,
                clipCount: clips.length,
                completedAt: new Date().toISOString()
              },
              warning: "Google Drive for Desktop not installed - video saved locally only"
            });
            return;
          }

          // Copy file to Google Drive local folder (will auto-sync to cloud)
          console.log(`📂 Copying to Google Drive folder...`);
          const driveFilePath = await googleDriveLinkGenerator.copyToGoogleDrive(outputPath, actualRecordingId);

          // Generate link info
          const linkInfo = await googleDriveLinkGenerator.generateShareableLink(driveFilePath);

          console.log(`✅ Video synced to Google Drive:`);
          console.log(`   Path: ${linkInfo.relativePath}`);
          console.log(`   Web URL: ${linkInfo.webUrl}`);
          console.log(`   ${linkInfo.instructions}`);

          // Get folder URL using OAuth - this provides direct link to folder
          let driveFolderUrl = null;
          try {
            const { googleDriveOAuth } = await import('./services/GoogleDriveOAuth');
            console.log(`🔍 OAuth ready status: ${googleDriveOAuth.isReady()}`);

            if (googleDriveOAuth.isReady()) {
              // Get the folder path (everything except the filename)
              const path = await import('path');
              const folderPath = path.dirname(linkInfo.relativePath);
              console.log(`🔍 Looking up folder path in Drive: ${folderPath}`);

              const folderInfo = await googleDriveOAuth.getFolderInfoByPath(folderPath);
              if (folderInfo) {
                driveFolderUrl = folderInfo.webUrl;
                console.log(`✅ Got Drive folder URL: ${driveFolderUrl}`);
              } else {
                console.warn(`⚠️  Folder not found in Google Drive: ${folderPath}`);
              }
            } else {
              console.warn('⚠️  Google Drive OAuth not ready - folder URL will not be available');
              console.warn('   To fix: Ensure google-drive-tokens.json exists or GOOGLE_REFRESH_TOKEN env var is set');
            }
          } catch (error) {
            console.error('❌ Error getting folder URL:', error);
          }

          // Update the recording in the database with Drive path info (status already set to completed above)
          await storage.updateFlightRecording(actualRecordingId, {
            driveFileUrl: linkInfo.webUrl, // Store the web URL for opening in browser
            driveFileId: linkInfo.relativePath, // Store relative path for reference
            driveFolderUrl: driveFolderUrl // Store folder URL if available
          });

          console.log(`✅ Recording ${actualRecordingId} Drive info updated and ready for sale`);

          res.json({
            success: true,
            message: "DaVinci render completed and synced to Google Drive",
            outputPath,
            driveInfo: {
              filePath: driveFilePath,
              relativePath: linkInfo.relativePath,
              displayPath: googleDriveLinkGenerator.getDisplayPath(driveFilePath),
              instructions: linkInfo.instructions,
              fileUrl: linkInfo.webUrl,
              folderUrl: driveFolderUrl  // Include folder URL in response
            },
            renderInfo: {
              recordingId,
              projectName: projectName || `Project_${recordingId}`,
              clipCount: clips.length,
              completedAt: new Date().toISOString()
            }
          });

        } catch (uploadError: any) {
          console.error('❌ Failed to upload to Google Drive:', uploadError);

          // Status already marked as completed above - just log the error
          console.log(`✅ Recording ${actualRecordingId} completed locally (Drive upload failed)`);

          res.json({
            success: true,
            message: "DaVinci render completed but Google Drive upload failed",
            outputPath,
            error: uploadError.message,
            renderInfo: {
              recordingId,
              projectName: projectName || `Project_${recordingId}`,
              clipCount: clips.length,
              completedAt: new Date().toISOString()
            }
          });
        }
      } else {
        throw new Error("DaVinci render failed: " + stdout);
      }
      
    } catch (error: any) {
      console.error('DaVinci render error:', error);
      res.status(500).json({ 
        error: error.message,
        details: "Make sure DaVinci Resolve Studio is running and scripting is enabled"
      });
    }
  });

  // Stream local video file for playback in browser
  app.get("/api/videos/:recordingId/stream", async (req, res) => {
    try {
      const { recordingId } = req.params;

      // Get recording to find local video path
      const recording = await storage.getFlightRecording(recordingId);

      if (!recording) {
        return res.status(404).json({ error: "Recording not found" });
      }

      if (!recording.localVideoPath) {
        return res.status(404).json({ error: "No local video path available for this recording" });
      }

      const fs = await import('fs');
      const path = await import('path');
      const videoPath = recording.localVideoPath;

      // Check if file exists
      if (!fs.existsSync(videoPath)) {
        console.error(`Video file not found at: ${videoPath}`);
        return res.status(404).json({ error: "Video file not found" });
      }

      const stat = fs.statSync(videoPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      // Handle range requests for video seeking
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(videoPath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
      }

    } catch (error: any) {
      console.error('Video streaming error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // THUMBNAIL ENDPOINTS
  // ============================================================================

  // Generate thumbnail for a recording
  app.post("/api/recordings/:recordingId/generate-thumbnail", async (req, res) => {
    try {
      const { recordingId } = req.params;
      const { timeOffset } = req.body;

      // Get recording to find local video path
      const recording = await storage.getFlightRecording(recordingId);

      if (!recording) {
        return res.status(404).json({ error: "Recording not found" });
      }

      if (!recording.localVideoPath) {
        return res.status(400).json({ error: "No local video path available for this recording" });
      }

      const { thumbnailGenerator } = await import('./services/ThumbnailGenerator');

      // Generate thumbnail and upload to Supabase (returns public URL)
      const thumbnailUrl = await thumbnailGenerator.generateThumbnail(
        recording.localVideoPath,
        recordingId,
        timeOffset || 41
      );

      // Update recording with Supabase public URL
      await storage.updateFlightRecording(recordingId, {
        thumbnailUrl
      });

      console.log(`✅ Thumbnail generated and uploaded for ${recordingId}: ${thumbnailUrl}`);

      res.json({
        success: true,
        thumbnailUrl
      });

    } catch (error: any) {
      console.error('Thumbnail generation error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Serve thumbnail images
  app.get("/api/thumbnails/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      const path = await import('path');
      const fs = await import('fs');

      // Security: Only allow jpg files and sanitize filename
      if (!filename.endsWith('.jpg') || filename.includes('..')) {
        return res.status(400).json({ error: "Invalid filename" });
      }

      const thumbnailsDir = path.join(process.cwd(), 'thumbnails');
      const thumbnailPath = path.join(thumbnailsDir, filename);

      // Check if file exists
      if (!fs.existsSync(thumbnailPath)) {
        return res.status(404).json({ error: "Thumbnail not found" });
      }

      // Serve the image file
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      fs.createReadStream(thumbnailPath).pipe(res);

    } catch (error: any) {
      console.error('Thumbnail serving error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get thumbnail info for a recording
  app.get("/api/recordings/:recordingId/thumbnail", async (req, res) => {
    try {
      const { recordingId } = req.params;
      const { thumbnailGenerator } = await import('./services/ThumbnailGenerator');

      const exists = thumbnailGenerator.thumbnailExists(recordingId);

      if (exists) {
        const thumbnailPath = thumbnailGenerator.getThumbnailPath(recordingId);
        const thumbnailUrl = thumbnailGenerator.getThumbnailUrl(thumbnailPath);

        res.json({
          exists: true,
          thumbnailUrl,
          thumbnailPath
        });
      } else {
        res.json({
          exists: false
        });
      }

    } catch (error: any) {
      console.error('Thumbnail info error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Open local video file on Mac (for sales page preview)
  app.post("/api/recordings/open-local-video", async (req, res) => {
    try {
      const { drivePath, localVideoPath, recordingId } = req.body;

      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const os = await import('os');
      const path = await import('path');
      const fs = await import('fs');

      let fullPath: string;

      // Priority 1: Use direct localVideoPath if provided
      if (localVideoPath) {
        fullPath = localVideoPath;
      }
      // Priority 2: Look up recording by ID and get localVideoPath
      else if (recordingId) {
        const recording = await storage.getFlightRecording(recordingId);
        if (!recording || !recording.localVideoPath) {
          return res.status(404).json({ error: "Recording not found or no local video path" });
        }
        fullPath = recording.localVideoPath;
      }
      // Priority 3: Legacy drivePath format (Google Drive sync)
      else if (drivePath) {
        // Construct full path to Google Drive file
        const homeDir = os.homedir();
        const googleDriveBase = path.join(homeDir, 'Library', 'CloudStorage');

        // Find the Google Drive folder
        const cloudStorageContents = fs.readdirSync(googleDriveBase);
        const googleDriveFolder = cloudStorageContents.find(folder => folder.startsWith('GoogleDrive-'));

        if (!googleDriveFolder) {
          return res.status(404).json({ error: "Google Drive folder not found" });
        }

        fullPath = path.join(googleDriveBase, googleDriveFolder, 'My Drive', drivePath);
      } else {
        return res.status(400).json({ error: "localVideoPath, recordingId, or drivePath is required" });
      }

      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: `Video file not found: ${fullPath}` });
      }

      // Open the video file with default application (usually QuickTime on Mac)
      await execAsync(`open "${fullPath}"`);

      console.log(`📹 Opened video file: ${fullPath}`);

      res.json({
        success: true,
        message: "Video file opened successfully",
        path: fullPath
      });

    } catch (error: any) {
      console.error('Error opening video file:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Manual fix endpoint: Update recording status and video path
  app.post("/api/recordings/:recordingId/fix-status", async (req, res) => {
    try {
      const { recordingId } = req.params;
      const { exportStatus, localVideoPath } = req.body;

      console.log(`🔧 Fixing recording ${recordingId} - status: ${exportStatus}, path: ${localVideoPath}`);

      const updates: any = {};
      if (exportStatus) updates.exportStatus = exportStatus;
      if (localVideoPath) updates.localVideoPath = localVideoPath;

      const updated = await storage.updateFlightRecording(recordingId, updates);

      if (!updated) {
        return res.status(404).json({ error: "Recording not found" });
      }

      res.json({
        success: true,
        message: "Recording updated successfully",
        recording: updated
      });

    } catch (error: any) {
      console.error('Fix status error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get project directory structure
  app.get("/api/recordings/:recordingId/project-info", async (req, res) => {
    try {
      const { recordingId } = req.params;
      const projectDir = await clipGenerator.getProjectDirectoryPath(recordingId);
      const clips = await clipGenerator.getProjectClips(recordingId);
      
      res.json({
        projectDirectory: projectDir,
        clipCount: clips.length,
        clips: clips.map(clip => ({
          slotNumber: clip.slotNumber,
          sceneType: clip.sceneType,
          cameraAngle: clip.cameraAngle,
          status: clip.clipStatus,
          filename: clip.filePath.split('/').pop()
        }))
      });
      
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // GOOGLE DRIVE OAUTH INTEGRATION ENDPOINTS
  // ============================================================================

  // Get Google OAuth authorization URL
  app.get("/api/google/auth-url", async (req, res) => {
    try {
      const { googleDriveOAuth } = await import('./services/GoogleDriveOAuth');
      const authUrl = googleDriveOAuth.generateAuthUrl();
      res.json({ authUrl });
    } catch (error: any) {
      console.error('OAuth URL generation error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Handle Google OAuth callback
  app.get("/auth/google/callback", async (req, res) => {
    try {
      const { code } = req.query;
      
      if (!code) {
        return res.status(400).send('Authorization code not provided');
      }

      const { googleDriveOAuth } = await import('./services/GoogleDriveOAuth');
      const tokens = await googleDriveOAuth.getTokensFromCode(code as string);
      
      // Store tokens in session (in production, use secure storage)
      req.session.googleTokens = tokens;
      
      // Get user info
      googleDriveOAuth.setCredentials(tokens);
      const userInfo = await googleDriveOAuth.getUserInfo();
      req.session.googleUserInfo = userInfo;

      // Close popup and redirect to success
      res.send(`
        <script>
          window.opener.postMessage({ success: true, userInfo: ${JSON.stringify(userInfo)} }, '*');
          window.close();
        </script>
      `);

    } catch (error: any) {
      console.error('OAuth callback error:', error);
      res.send(`
        <script>
          window.opener.postMessage({ success: false, error: '${error.message}' }, '*');
          window.close();
        </script>
      `);
    }
  });

  // Check authentication status
  app.get("/api/google/auth-status", async (req, res) => {
    try {
      if (!req.session.googleTokens || !req.session.googleUserInfo) {
        return res.json({ authenticated: false });
      }

      const { googleDriveOAuth } = await import('./services/GoogleDriveOAuth');
      googleDriveOAuth.setCredentials(req.session.googleTokens);

      const isValid = await googleDriveOAuth.validateTokens();
      if (!isValid) {
        req.session.googleTokens = null;
        req.session.googleUserInfo = null;
        return res.json({ authenticated: false });
      }

      res.json({
        authenticated: true,
        userInfo: req.session.googleUserInfo
      });

    } catch (error: any) {
      console.error('Auth status check error:', error);
      res.json({ authenticated: false });
    }
  });

  // Get OAuth tokens for passing to Mac service
  app.get("/api/google/tokens", async (req, res) => {
    try {
      if (!req.session.googleTokens) {
        return res.status(401).json({ error: "Not authenticated with Google" });
      }

      // Return tokens so frontend can pass them to Mac service
      res.json({
        tokens: req.session.googleTokens
      });

    } catch (error: any) {
      console.error('Get tokens error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Upload video to user's personal Google Drive
  app.post("/api/google/upload-video", async (req, res) => {
    try {
      if (!req.session.googleTokens) {
        return res.status(401).json({ error: "Not authenticated with Google" });
      }

      const { customerName, fileName } = req.body;
      if (!customerName || !fileName) {
        return res.status(400).json({ error: "customerName and fileName are required" });
      }

      const { googleDriveOAuth } = await import('./services/GoogleDriveOAuth');
      googleDriveOAuth.setCredentials(req.session.googleTokens);

      // For demo purposes, we'll simulate the upload
      // In production, you'd use the actual video file path
      const mockVideoPath = '/tmp/demo-flight-video.mp4';
      
      const driveInfo = await googleDriveOAuth.uploadVideoToUserDrive(
        mockVideoPath,
        fileName,
        customerName
      );

      res.json({
        success: true,
        driveInfo,
        message: "Video uploaded to your Google Drive successfully"
      });

    } catch (error: any) {
      console.error('Video upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Sign out from Google
  app.post("/api/google/signout", async (req, res) => {
    try {
      req.session.googleTokens = null;
      req.session.googleUserInfo = null;
      res.json({ success: true, message: "Signed out successfully" });
    } catch (error: any) {
      console.error('Sign out error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  console.log('✅ Video upload endpoints registered successfully');
  
  } catch (error) {
    console.error('❌ Error setting up video upload endpoints:', error);
    console.error('❌ Full error details:', error);
    throw error;
  }

  console.log('🔧 Setting up error handling middleware...');
  
  // Google Drive OAuth endpoints
  app.get("/api/drive/auth/url", async (req, res) => {
    try {
      const { googleDriveOAuth } = await import('./services/GoogleDriveOAuth');
      const authUrl = googleDriveOAuth.generateAuthUrl();
      res.json({ authUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/drive/auth/callback", async (req, res) => {
    try {
      const { code } = req.query;
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Authorization code is required' });
      }

      const { googleDriveOAuth } = await import('./services/GoogleDriveOAuth');
      await googleDriveOAuth.getTokensFromCode(code);

      res.send(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1 style="color: #10b981;">✓ Google Drive Connected!</h1>
            <p>You can close this window and return to MagnumStream.</p>
            <script>setTimeout(() => window.close(), 2000);</script>
          </body>
        </html>
      `);
    } catch (error: any) {
      res.status(500).send(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1 style="color: #ef4444;">✗ Authentication Failed</h1>
            <p>${error.message}</p>
          </body>
        </html>
      `);
    }
  });

  app.get("/api/drive/auth/status", async (req, res) => {
    try {
      const { googleDriveOAuth } = await import('./services/GoogleDriveOAuth');
      const isReady = googleDriveOAuth.isReady();
      res.json({ authenticated: isReady });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Share Drive folder with customer email
  app.post("/api/drive/share-folder", async (req, res) => {
    try {
      const { recordingId, customerEmail } = req.body;

      if (!recordingId || !customerEmail) {
        return res.status(400).json({ error: 'recordingId and customerEmail are required' });
      }

      const { googleDriveOAuth } = await import('./services/GoogleDriveOAuth');

      if (!googleDriveOAuth.isReady()) {
        return res.status(503).json({ error: 'Google Drive not authenticated. Please authenticate first.' });
      }

      // Get recording to find folder path
      const recording = await storage.getFlightRecording(recordingId);
      if (!recording || !recording.driveFileId) {
        return res.status(404).json({ error: 'Recording or Drive path not found' });
      }

      // Get folder path (directory of the file)
      const path = await import('path');
      const folderPath = path.dirname(recording.driveFileId);

      // Find folder ID
      const folderInfo = await googleDriveOAuth.getFolderInfoByPath(folderPath);
      if (!folderInfo) {
        return res.status(404).json({ error: 'Drive folder not found' });
      }

      // Share folder with customer
      const shared = await googleDriveOAuth.shareFolderWithEmail(folderInfo.id, customerEmail);

      if (shared) {
        // Update the sale record to mark Drive as shared
        // Find the most recent sale for this recording and customer email
        try {
          const sales = await storage.getAllSales?.();
          if (sales) {
            const matchingSale = sales
              .filter((s: any) => s.recordingId === recordingId && s.customerEmail === customerEmail)
              .sort((a: any, b: any) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())[0];

            if (matchingSale && storage.updateSale) {
              await storage.updateSale(matchingSale.id, { driveShared: true });
              console.log(`✅ Updated sale ${matchingSale.id} - marked Drive as shared`);
            }
          }
        } catch (updateError) {
          console.warn('⚠️ Could not update sale drive_shared status:', updateError);
          // Don't fail the sharing if sale update fails
        }

        res.json({ success: true, message: `Folder shared with ${customerEmail}` });
      } else {
        res.status(500).json({ error: 'Failed to share folder' });
      }
    } catch (error: any) {
      console.error('Failed to share folder:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add error handling middleware
  app.use(notFoundHandler);
  app.use(errorHandler);

  console.log('🔧 Creating HTTP server...');
  const httpServer = createServer(app);

  console.log('✅ Route registration completed successfully');
  return httpServer;
}
