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
      const { projectName, pilotName, pilotEmail, staffMember, flightDate, flightTime, flightPilot, exportStatus, sessionId } = req.body;

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
          flightTime: flightTime || recording.flightTime,
          flightPilot: flightPilot || recording.flightPilot
        });

        // If Drive folder doesn't exist yet, create it now (for projects created via Vercel)
        if (!recording.driveFolderUrl) {
          try {
            const { googleDriveOAuth } = await import('./services/GoogleDriveOAuth');
            const pilotForFolder = flightPilot || recording.flightPilot;
            const timeForFolder = flightTime || recording.flightTime;

            if (googleDriveOAuth.isReady() && pilotForFolder && timeForFolder) {
              console.log(`📁 Creating Google Drive folder for existing project: ${recording.pilotName}`);

              const folderResult = await googleDriveOAuth.createProjectFolderStructure(
                recording.pilotName,
                pilotForFolder,
                timeForFolder
              );

              if (folderResult) {
                recording = await storage.updateFlightRecording(recording.id, {
                  driveFolderUrl: folderResult.folderUrl,
                  driveFolderId: folderResult.folderId,
                  videoFolderId: folderResult.videoFolderId,
                  photosFolderId: folderResult.photosFolderId
                });
                console.log(`✅ Google Drive folder created for existing project: ${folderResult.folderUrl}`);
              }
            } else if (!googleDriveOAuth.isReady()) {
              console.log(`⚠️ Google Drive not authenticated - skipping folder creation for existing project`);
            }
          } catch (driveError: any) {
            console.error(`⚠️ Failed to create Google Drive folder for existing project (non-fatal):`, driveError.message);
          }
        }
      } else {
        // Create new recording
        recording = await storage.createFlightRecording({
          projectName: projectName || `${pilotName} Flight`,
          pilotName,
          pilotEmail,
          flightPilot,
          staffMember,
          flightDate,
          flightTime,
          exportStatus: exportStatus || 'pending'
        });

        // Try to create Google Drive folder structure for the new project
        try {
          const { googleDriveOAuth } = await import('./services/GoogleDriveOAuth');

          if (googleDriveOAuth.isReady() && flightPilot && flightTime) {
            console.log(`📁 Creating Google Drive folder for project: ${pilotName}`);

            const folderResult = await googleDriveOAuth.createProjectFolderStructure(
              pilotName,
              flightPilot,
              flightTime
            );

            if (folderResult) {
              // Update recording with the folder URL and all folder IDs
              recording = await storage.updateFlightRecording(recording.id, {
                driveFolderUrl: folderResult.folderUrl,
                driveFolderId: folderResult.folderId,
                videoFolderId: folderResult.videoFolderId,
                photosFolderId: folderResult.photosFolderId
              });
              console.log(`✅ Google Drive folder created: ${folderResult.folderUrl}`);
              console.log(`   Customer folder ID: ${folderResult.folderId}`);
              console.log(`   Video folder ID: ${folderResult.videoFolderId}`);
              console.log(`   Photos folder ID: ${folderResult.photosFolderId}`);
            }
          } else if (!googleDriveOAuth.isReady()) {
            console.log(`⚠️ Google Drive not authenticated - skipping folder creation`);
          }
        } catch (driveError: any) {
          // Don't fail the recording creation if Drive folder creation fails
          console.error(`⚠️ Failed to create Google Drive folder (non-fatal):`, driveError.message);
        }
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
          console.error('❌ Storage error:', storageError.message);
          // Return empty array instead of error to avoid breaking the UI
          res.setHeader('Content-Type', 'application/json');
          res.json([]);
        }
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.json([]);
      }
    } catch (error: any) {
      console.error('❌ Error getting video slots:', error.message);
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

      // Get the current recording to compare old values
      const currentRecording = await storage.getFlightRecording(id);
      if (!currentRecording) {
        return res.status(404).json({ error: "Recording not found" });
      }

      // Check if we need to update Google Drive folder names
      const folderRelevantFields = ['pilotName', 'flightPilot', 'flightTime'];
      const hasFolderChanges = folderRelevantFields.some(
        field => updates[field] !== undefined && updates[field] !== currentRecording[field as keyof typeof currentRecording]
      );

      if (hasFolderChanges && currentRecording.driveFolderId && googleDriveOAuth.isReady()) {
        try {
          const folderResult = await googleDriveOAuth.updateProjectFolders(
            currentRecording.driveFolderId,
            {
              pilotName: updates.pilotName,
              flightPilot: updates.flightPilot,
              flightTime: updates.flightTime
            },
            {
              pilotName: currentRecording.pilotName,
              flightPilot: currentRecording.flightPilot,
              flightTime: currentRecording.flightTime
            }
          );
          if (folderResult.success && folderResult.message !== 'No folder changes needed') {
            console.log(`📁 Drive folder update: ${folderResult.message}`);
          }
        } catch (driveError: any) {
          console.warn('⚠️ Failed to update Drive folders (non-fatal):', driveError.message);
          // Don't fail the update if folder rename fails
        }
      }

      const recording = await storage.updateFlightRecording(id, updates);
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
        console.warn('⚠️ Failed to share Google Drive access');
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

      console.log(`📝 Issue reported: ${issueType} by ${staffName}`);

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
              deletedCount++;
              deletedRecords.push({
                id: recording.id,
                projectName: recording.projectName,
                pilotName: recording.pilotName
              });
            }
          } else {
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

  try {
    const multer = (await import('multer')).default;
    const fs = (await import('fs')).promises;
    const path = await import('path');
  
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

  // Upload photos to Google Drive Photos folder
  app.post("/api/recordings/:recordingId/upload-photos", upload.array('photos', 50), async (req: any, res) => {
    try {
      const { recordingId } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No photos provided" });
      }

      // Get the recording to find the drive folder URL
      const recording = await storage.getFlightRecording(recordingId);
      if (!recording) {
        return res.status(404).json({ error: "Recording not found" });
      }

      if (!recording.driveFolderUrl) {
        return res.status(400).json({ error: "No Google Drive folder associated with this project" });
      }

      const { googleDriveOAuth } = await import('./services/GoogleDriveOAuth');

      if (!googleDriveOAuth.isReady()) {
        return res.status(503).json({ error: "Google Drive not authenticated" });
      }

      // Extract the customer folder ID from the URL
      console.log(`📁 Drive folder URL: ${recording.driveFolderUrl}`);
      const customerFolderId = googleDriveOAuth.extractFolderIdFromUrl(recording.driveFolderUrl);
      if (!customerFolderId) {
        console.error(`❌ Could not extract folder ID from URL: ${recording.driveFolderUrl}`);
        return res.status(400).json({
          error: "Invalid Drive folder URL",
          url: recording.driveFolderUrl,
          help: "Expected format: https://drive.google.com/drive/folders/FOLDER_ID"
        });
      }
      console.log(`✅ Extracted folder ID: ${customerFolderId}`);

      // Get the Photos subfolder ID
      const photosFolderId = await googleDriveOAuth.getPhotosFolderId(customerFolderId);
      if (!photosFolderId) {
        return res.status(400).json({ error: "Photos folder not found in Drive" });
      }

      console.log(`📸 Uploading ${files.length} photos for recording ${recordingId}`);

      // Upload each photo
      const uploadResults = [];
      for (const file of files) {
        const result = await googleDriveOAuth.uploadFileToFolder(
          photosFolderId,
          file.originalname,
          file.buffer,
          file.mimetype
        );
        if (result) {
          uploadResults.push(result);
        }
      }

      // Mark photos as uploaded in the database and store the photos folder ID
      await storage.updateFlightRecording(recordingId, {
        photosUploaded: true,
        photosFolderId: photosFolderId
      });

      console.log(`✅ Uploaded ${uploadResults.length}/${files.length} photos`);

      res.json({
        success: true,
        uploaded: uploadResults.length,
        total: files.length,
        files: uploadResults
      });

    } catch (error: any) {
      console.error('❌ Photo upload error:', error);
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

      console.log(`🎬 Starting DaVinci render for ${recordingId}`);
      
      // First ensure clips and job file exist
      const clips = await clipGenerator.getProjectClips(recordingId);
      if (clips.length === 0) {
        return res.status(400).json({ error: "No clips found. Please generate clips first." });
      }
      
      // Create job file if it doesn't exist
      let jobFilePath;
      try {
        jobFilePath = await clipGenerator.createDaVinciJobFile(recordingId);
      } catch (error) {
        console.error('❌ Failed to create job file:', error);
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

      // Execute with timeout and proper environment (DaVinci rendering can take a while)
      const { stdout, stderr } = await execAsync(davinciCommand, {
        timeout: 30 * 60 * 1000, // 30 minutes timeout
        env: davinciEnv
      });
      
      // Parse output to get result
      if (stdout.includes('SUCCESS:')) {
        const outputPath = stdout.split('SUCCESS: ')[1]?.trim();
        console.log(`✅ DaVinci render completed: ${outputPath}`);

        // IMPORTANT: Always update status to completed when render succeeds
        // This ensures the recording appears in History as complete even if Drive upload fails
        try {
          await storage.updateFlightRecording(recordingId, {
            exportStatus: "completed",
            localVideoPath: outputPath
          });
          console.log(`✅ Recording ${recordingId} marked as completed`);
        } catch (statusUpdateError) {
          console.error(`❌ Failed to update recording status:`, statusUpdateError);
          // Continue with thumbnail generation and Drive upload even if status update fails
        }

        // Generate thumbnail from the rendered video and upload to Supabase
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

          console.log(`✅ Thumbnail generated and uploaded`);
        } catch (thumbnailError) {
          console.error(`⚠️  Failed to generate thumbnail:`, thumbnailError);
          // Don't fail the whole render if thumbnail generation fails
        }

        // Upload the rendered video to Google Drive using the project's Video folder
        let actualRecordingId = recordingId;

        try {
          const fs = await import('fs');
          const path = await import('path');

          // Check if the rendered file exists
          if (!fs.existsSync(outputPath)) {
            console.error(`❌ Rendered file not found: ${outputPath}`);
            throw new Error(`Rendered file not found: ${outputPath}`);
          }

          // Get the recording to check for Video folder ID
          let recording = await storage.getFlightRecording(recordingId);

          if (!recording) {
            console.error(`❌ Recording not found: ${recordingId}`);
            throw new Error(`Recording not found: ${recordingId}`);
          }

          actualRecordingId = recording.id;
          const fileName = path.basename(outputPath);

          // Check if the project has a Video folder ID from when the project was created
          if (!recording.videoFolderId) {
            console.warn('⚠️ No Video folder ID found for this project - skipping Drive upload');
            console.log('   Project may have been created before folder structure feature');

            res.json({
              success: true,
              message: "DaVinci render completed successfully (Drive upload skipped - no Video folder)",
              outputPath,
              renderInfo: {
                recordingId,
                projectName: projectName || `Project_${recordingId}`,
                clipCount: clips.length,
                completedAt: new Date().toISOString()
              },
              warning: "No Video folder ID - project was created before folder structure feature"
            });
            return;
          }

          console.log(`📤 Uploading video to Google Drive Video folder...`);

          const { googleDriveOAuth } = await import('./services/GoogleDriveOAuth');

          if (!googleDriveOAuth.isReady()) {
            console.warn('⚠️ Google Drive OAuth not ready - skipping upload');

            res.json({
              success: true,
              message: "DaVinci render completed successfully (Drive upload skipped - OAuth not ready)",
              outputPath,
              renderInfo: {
                recordingId,
                projectName: projectName || `Project_${recordingId}`,
                clipCount: clips.length,
                completedAt: new Date().toISOString()
              },
              warning: "Google Drive OAuth not authenticated"
            });
            return;
          }

          // Upload video directly to the project's Video folder via Drive API
          const uploadResult = await googleDriveOAuth.uploadVideoToFolder(
            recording.videoFolderId,
            outputPath,
            fileName
          );

          if (!uploadResult) {
            throw new Error('Failed to upload video to Google Drive');
          }

          console.log(`✅ Video uploaded to Google Drive`);

          // Update the recording in the database with Drive file info
          await storage.updateFlightRecording(actualRecordingId, {
            driveFileUrl: uploadResult.webViewLink,
            driveFileId: uploadResult.fileId
          });

          console.log(`✅ Drive info updated - ready for sale`);

          res.json({
            success: true,
            message: "DaVinci render completed and uploaded to Google Drive",
            outputPath,
            driveInfo: {
              fileId: uploadResult.fileId,
              fileUrl: uploadResult.webViewLink,
              folderUrl: recording.driveFolderUrl
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
        console.error(`❌ Video file not found: ${videoPath}`);
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

      console.log(`✅ Thumbnail generated for ${recordingId}`);

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

  } catch (error) {
    console.error('❌ Error setting up video upload endpoints:', error);
    throw error;
  }

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

  // Create Drive folder for existing project (for projects created via Vercel that don't have folders)
  app.post("/api/drive/create-folder", async (req, res) => {
    try {
      const { recordingId } = req.body;

      if (!recordingId) {
        return res.status(400).json({ error: 'recordingId is required' });
      }

      const { googleDriveOAuth } = await import('./services/GoogleDriveOAuth');

      if (!googleDriveOAuth.isReady()) {
        return res.status(503).json({ error: 'Google Drive not authenticated. Please authenticate first.' });
      }

      // Get recording
      const recording = await storage.getFlightRecording(recordingId);
      if (!recording) {
        return res.status(404).json({ error: 'Recording not found' });
      }

      // Check if folder already exists
      if (recording.driveFolderUrl) {
        return res.json({
          success: true,
          message: 'Folder already exists',
          folderUrl: recording.driveFolderUrl
        });
      }

      // Need flightPilot and flightTime to create folder
      if (!recording.flightPilot || !recording.flightTime) {
        return res.status(400).json({
          error: 'Recording is missing flightPilot or flightTime required for folder creation'
        });
      }

      console.log(`📁 Creating Google Drive folder for project: ${recording.pilotName}`);

      const folderResult = await googleDriveOAuth.createProjectFolderStructure(
        recording.pilotName,
        recording.flightPilot,
        recording.flightTime
      );

      if (folderResult) {
        // Update recording with folder info
        const updated = await storage.updateFlightRecording(recording.id, {
          driveFolderUrl: folderResult.folderUrl,
          driveFolderId: folderResult.folderId,
          videoFolderId: folderResult.videoFolderId,
          photosFolderId: folderResult.photosFolderId
        });

        console.log(`✅ Google Drive folder created: ${folderResult.folderUrl}`);

        res.json({
          success: true,
          folderUrl: folderResult.folderUrl,
          recording: updated
        });
      } else {
        res.status(500).json({ error: 'Failed to create folder' });
      }
    } catch (error: any) {
      console.error('Error creating Drive folder:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Share Drive folder with customer email(s) based on bundle type
  app.post("/api/drive/share-folder", async (req, res) => {
    try {
      const { recordingId, customerEmail, customerEmails, bundle } = req.body;

      // Support both single email (customerEmail) and multiple emails (customerEmails)
      const emails: string[] = customerEmails && Array.isArray(customerEmails)
        ? customerEmails.filter((e: string) => e && e.trim())
        : customerEmail ? [customerEmail] : [];

      if (!recordingId || emails.length === 0) {
        return res.status(400).json({ error: 'recordingId and at least one email are required' });
      }

      const { googleDriveOAuth } = await import('./services/GoogleDriveOAuth');

      if (!googleDriveOAuth.isReady()) {
        return res.status(503).json({ error: 'Google Drive not authenticated. Please authenticate first.' });
      }

      // Get recording to find folder IDs
      const recording = await storage.getFlightRecording(recordingId);
      if (!recording) {
        return res.status(404).json({ error: 'Recording not found' });
      }

      // Determine which folder(s) to share based on bundle type
      // video_photos: share parent folder (contains both Video and Photos)
      // video_only: share Video folder
      // photos_only: share Photos folder
      const foldersToShare: string[] = [];
      let shareDescription = '';

      if (bundle === 'video_only') {
        if (recording.videoFolderId) {
          foldersToShare.push(recording.videoFolderId);
          shareDescription = 'Video folder';
        } else {
          return res.status(404).json({ error: 'Video folder not found for this project' });
        }
      } else if (bundle === 'photos_only') {
        if (recording.photosFolderId) {
          foldersToShare.push(recording.photosFolderId);
          shareDescription = 'Photos folder';
        } else {
          return res.status(404).json({ error: 'Photos folder not found for this project' });
        }
      } else {
        // video_photos or default: share parent folder (customer folder containing both)
        if (recording.driveFolderId) {
          foldersToShare.push(recording.driveFolderId);
          shareDescription = 'Video + Photos folder';
        } else {
          return res.status(404).json({ error: 'Project folder not found' });
        }
      }

      // Share the folder(s) with all customer emails
      const sharedEmails: string[] = [];
      const failedEmails: string[] = [];

      for (const email of emails) {
        let emailShared = true;
        for (const folderId of foldersToShare) {
          const shared = await googleDriveOAuth.shareFolderWithEmail(folderId, email);
          if (!shared) {
            emailShared = false;
            console.error(`❌ Failed to share folder ${folderId} with ${email}`);
          }
        }
        if (emailShared) {
          sharedEmails.push(email);
          console.log(`✅ ${shareDescription} shared with ${email}`);
        } else {
          failedEmails.push(email);
        }
      }

      if (sharedEmails.length > 0) {
        // Update the sale record to mark Drive as shared (use first email for lookup)
        try {
          const sales = await storage.getAllSales?.();
          if (sales) {
            const matchingSale = sales
              .filter((s: any) => s.recordingId === recordingId && emails.includes(s.customerEmail))
              .sort((a: any, b: any) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())[0];

            if (matchingSale && storage.updateSale) {
              await storage.updateSale(matchingSale.id, { driveShared: true });
              console.log(`✅ Sale marked as Drive shared`);
            }
          }
        } catch (updateError) {
          console.warn('⚠️ Could not update sale drive_shared status:', updateError);
        }

        const message = failedEmails.length > 0
          ? `${shareDescription} shared with ${sharedEmails.join(', ')}. Failed for: ${failedEmails.join(', ')}`
          : `${shareDescription} shared with ${sharedEmails.join(', ')}`;

        res.json({ success: true, message, sharedEmails, failedEmails });
      } else {
        res.status(500).json({ error: 'Failed to share folder with any email' });
      }
    } catch (error: any) {
      console.error('Failed to share folder:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add error handling middleware
  app.use(notFoundHandler);
  app.use(errorHandler);

  const httpServer = createServer(app);
  return httpServer;
}
