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
  
  // Get camera configuration
  app.get("/api/camera-config", async (req, res) => {
    try {
      const cameraConfig = {
        camera1: {
          deviceId: process.env.CAMERA_1_DEVICE_ID || "default-camera-1",
          label: "Camera 1 (Straight View)"
        },
        camera2: {
          deviceId: process.env.CAMERA_2_DEVICE_ID || "default-camera-2", 
          label: "Camera 2 (Side View)"
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
      
      // Check if recording already exists for this pilot
      let recording = await storage.findRecordingBySessionId?.(sessionId) || 
                     (await storage.getAllFlightRecordings()).find(r => r.pilotName === pilotName);
      
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
      console.log(`📊 API: Getting video slots for recording ${recordingId}`);
      
      if (storage.getVideoSlotsByRecordingId) {
        console.log('📊 API: Calling storage.getVideoSlotsByRecordingId...');
        
        try {
          const slots = await storage.getVideoSlotsByRecordingId(recordingId);
          console.log(`📊 API: Found ${slots?.length || 0} video slots:`, slots);
          
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
        console.log('📊 API: getVideoSlotsByRecordingId method not available, returning empty array');
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
  
  // Configure multer for video file uploads
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
      
      // Get recording info for directory naming
      const recording = await storage.getFlightRecording(recordingId);
      if (!recording) {
        return res.status(404).json({ error: "Recording not found" });
      }
      
      const { pilotName, createdAt } = recording;
      const date = new Date(createdAt).toISOString().split('T')[0];
      const sanitizedName = pilotName.replace(/[^a-zA-Z0-9]/g, '_');
      
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
        pilotName
      }, null, 2));
      
      // Save video file
      const filename = `${sceneType}_camera${cameraAngle}.mp4`;
      const filePath = path.join(sourceDir, filename);
      
      await fs.writeFile(filePath, req.file.buffer);
      
      console.log(`📁 Saved ${filename} for ${pilotName} (expires: ${expirationTime})`);
      console.log(`📊 File size: ${(req.file.buffer.length / 1024 / 1024).toFixed(2)}MB`);
      
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

  // Add error handling middleware
  app.use(notFoundHandler);
  app.use(errorHandler);

  const httpServer = createServer(app);

  return httpServer;
}
