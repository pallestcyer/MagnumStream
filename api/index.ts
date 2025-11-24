import type { VercelRequest, VercelResponse } from '@vercel/node';
import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { googleDriveOAuth as importedDriveOAuth } from './GoogleDriveOAuth';

// Slot template configuration
interface SlotConfig {
  slotNumber: number;
  sceneType: 'cruising' | 'chase' | 'arrival';
  cameraAngle: 1 | 2;
  color: string;
  duration: number;
}

const SLOT_TEMPLATE: SlotConfig[] = [
  // Cruising Scene (7 slots)
  { slotNumber: 1, sceneType: 'cruising', cameraAngle: 2, color: '#FF6B35', duration: 0.876 },
  { slotNumber: 2, sceneType: 'cruising', cameraAngle: 2, color: '#F7931E', duration: 1.210 },
  { slotNumber: 3, sceneType: 'cruising', cameraAngle: 1, color: '#FFA500', duration: 1.293 },
  { slotNumber: 4, sceneType: 'cruising', cameraAngle: 2, color: '#FF9E3D', duration: 0.959 },
  { slotNumber: 5, sceneType: 'cruising', cameraAngle: 1, color: '#FF7A3D', duration: 1.502 },
  { slotNumber: 6, sceneType: 'cruising', cameraAngle: 2, color: '#FF6B6B', duration: 0.667 },
  { slotNumber: 7, sceneType: 'cruising', cameraAngle: 1, color: '#FFA07A', duration: 0.793 },
  // Chase Scene (6 slots)
  { slotNumber: 8,  sceneType: 'chase', cameraAngle: 2, color: '#FFB347', duration: 0.876 },
  { slotNumber: 9,  sceneType: 'chase', cameraAngle: 1, color: '#FFCC00', duration: 1.418 },
  { slotNumber: 10, sceneType: 'chase', cameraAngle: 2, color: '#FFD700', duration: 0.542 },
  { slotNumber: 11, sceneType: 'chase', cameraAngle: 2, color: '#FFA500', duration: 1.460 },
  { slotNumber: 12, sceneType: 'chase', cameraAngle: 1, color: '#FF8C00', duration: 1.543 },
  { slotNumber: 13, sceneType: 'chase', cameraAngle: 1, color: '#FF7F50', duration: 0.542 },
  // Arrival Scene (1 slot)
  { slotNumber: 14, sceneType: 'arrival', cameraAngle: 1, color: '#FF6347', duration: 3.212 },
];

// Inline Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const localDeviceUrl = process.env.LOCAL_DEVICE_URL || 'http://localhost:5000';

let supabase: any = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Database operations (handled by Vercel)
class DatabaseStorage {
  async createFlightRecording(data: any) {
    // Generate project name from pilot name
    const projectName = data.projectName || `${data.pilotName} Flight`;

    const { data: result, error } = await (supabase as any)
      .from('flight_recordings')
      .insert({
        project_name: projectName,
        pilot_name: data.pilotName,
        pilot_email: data.pilotEmail || '',
        flight_pilot: data.flightPilot,
        staff_member: data.staffMember,
        flight_date: data.flightDate,
        flight_time: data.flightTime,
        export_status: data.exportStatus || 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // Transform the result to match the client expectations
    return {
      id: result.id,
      projectName: result.project_name,
      pilotName: result.pilot_name,
      pilotEmail: result.pilot_email,
      flightPilot: result.flight_pilot,
      staffMember: result.staff_member,
      flightDate: result.flight_date,
      flightTime: result.flight_time,
      exportStatus: result.export_status,
      driveFileId: result.drive_file_id,
      driveFileUrl: result.drive_file_url,
      driveFolderUrl: result.drive_folder_url,
      driveFolderId: result.drive_folder_id,
      videoFolderId: result.video_folder_id,
      photosFolderId: result.photos_folder_id,
      localVideoPath: result.local_video_path,
      thumbnailUrl: result.thumbnail_url,
      smsPhoneNumber: result.sms_phone_number,
      sold: result.sold,
      photosUploaded: result.photos_uploaded,
      createdAt: new Date(result.created_at)
    };
  }

  async updateFlightRecording(id: string, data: any) {
    const updateData: any = {};

    if (data.pilotName !== undefined) updateData.pilot_name = data.pilotName;
    if (data.pilotEmail !== undefined) updateData.pilot_email = data.pilotEmail;
    if (data.flightPilot !== undefined) updateData.flight_pilot = data.flightPilot;
    if (data.staffMember !== undefined) updateData.staff_member = data.staffMember;
    if (data.flightDate !== undefined) updateData.flight_date = data.flightDate;
    if (data.flightTime !== undefined) updateData.flight_time = data.flightTime;
    if (data.exportStatus !== undefined) updateData.export_status = data.exportStatus;
    if (data.driveFileId !== undefined) updateData.drive_file_id = data.driveFileId;
    if (data.driveFileUrl !== undefined) updateData.drive_file_url = data.driveFileUrl;
    if (data.driveFolderUrl !== undefined) updateData.drive_folder_url = data.driveFolderUrl;
    if (data.driveFolderId !== undefined) updateData.drive_folder_id = data.driveFolderId;
    if (data.videoFolderId !== undefined) updateData.video_folder_id = data.videoFolderId;
    if (data.photosFolderId !== undefined) updateData.photos_folder_id = data.photosFolderId;
    if (data.localVideoPath !== undefined) updateData.local_video_path = data.localVideoPath;
    if (data.thumbnailUrl !== undefined) updateData.thumbnail_url = data.thumbnailUrl;
    if (data.smsPhoneNumber !== undefined) updateData.sms_phone_number = data.smsPhoneNumber;
    if (data.sold !== undefined) updateData.sold = data.sold;
    if (data.photosUploaded !== undefined) updateData.photos_uploaded = data.photosUploaded;

    const { data: result, error } = await (supabase as any)
      .from('flight_recordings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Transform the result to match the client expectations
    return {
      id: result.id,
      projectName: result.project_name,
      pilotName: result.pilot_name,
      pilotEmail: result.pilot_email,
      flightPilot: result.flight_pilot,
      staffMember: result.staff_member,
      flightDate: result.flight_date,
      flightTime: result.flight_time,
      exportStatus: result.export_status,
      driveFileId: result.drive_file_id,
      driveFileUrl: result.drive_file_url,
      driveFolderUrl: result.drive_folder_url,
      driveFolderId: result.drive_folder_id,
      videoFolderId: result.video_folder_id,
      photosFolderId: result.photos_folder_id,
      localVideoPath: result.local_video_path,
      thumbnailUrl: result.thumbnail_url,
      smsPhoneNumber: result.sms_phone_number,
      sold: result.sold,
      photosUploaded: result.photos_uploaded,
      createdAt: new Date(result.created_at)
    };
  }

  async getFlightRecording(id: string) {
    const { data: result, error } = await (supabase as any)
      .from('flight_recordings')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    // Transform the result to match the client expectations
    return {
      id: result.id,
      projectName: result.project_name,
      pilotName: result.pilot_name,
      pilotEmail: result.pilot_email,
      flightPilot: result.flight_pilot,
      staffMember: result.staff_member,
      flightDate: result.flight_date,
      flightTime: result.flight_time,
      exportStatus: result.export_status,
      driveFileId: result.drive_file_id,
      driveFileUrl: result.drive_file_url,
      driveFolderUrl: result.drive_folder_url,
      driveFolderId: result.drive_folder_id,
      videoFolderId: result.video_folder_id,
      photosFolderId: result.photos_folder_id,
      localVideoPath: result.local_video_path,
      thumbnailUrl: result.thumbnail_url,
      smsPhoneNumber: result.sms_phone_number,
      sold: result.sold,
      photosUploaded: result.photos_uploaded,
      createdAt: new Date(result.created_at)
    };
  }

  async getAllFlightRecordings() {
    const { data, error } = await (supabase as any)
      .from('flight_recordings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data?.map((record: any) => ({
      id: record.id,
      projectName: record.project_name,
      pilotName: record.pilot_name,
      pilotEmail: record.pilot_email,
      flightPilot: record.flight_pilot,
      staffMember: record.staff_member,
      flightDate: record.flight_date,
      flightTime: record.flight_time,
      exportStatus: record.export_status,
      driveFileId: record.drive_file_id,
      driveFileUrl: record.drive_file_url,
      driveFolderUrl: record.drive_folder_url,
      driveFolderId: record.drive_folder_id,
      videoFolderId: record.video_folder_id,
      photosFolderId: record.photos_folder_id,
      localVideoPath: record.local_video_path,
      thumbnailUrl: record.thumbnail_url,
      smsPhoneNumber: record.sms_phone_number,
      sold: record.sold,
      photosUploaded: record.photos_uploaded,
      createdAt: new Date(record.created_at)
    })) || [];
  }

  async createSale(data: any) {
    const { data: result, error } = await (supabase as any)
      .from('sales')
      .insert({
        recording_id: data.recordingId,
        customer_name: data.customerName,
        customer_email: data.customerEmail,
        staff_member: data.staffMember,
        bundle: data.bundle,
        sale_amount: data.saleAmount
      })
      .select()
      .single();

    if (error) throw error;

    // Mark the recording as sold
    try {
      await (supabase as any)
        .from('flight_recordings')
        .update({ sold: true })
        .eq('id', data.recordingId);

      console.log(`✅ Marked recording ${data.recordingId} as sold`);
    } catch (updateError) {
      console.warn('⚠️ Failed to mark recording as sold:', updateError);
      // Don't fail the sale if this update fails
    }

    return {
      id: result.id,
      recordingId: result.recording_id,
      customerName: result.customer_name,
      customerEmail: result.customer_email,
      staffMember: result.staff_member,
      bundle: result.bundle,
      saleAmount: result.sale_amount,
      saleDate: new Date(result.sale_date),
      driveShared: result.drive_shared
    };
  }

  async getAllSales() {
    const { data, error } = await (supabase as any)
      .from('sales')
      .select('*')
      .order('sale_date', { ascending: false });

    if (error) throw error;
    return data?.map((sale: any) => ({
      id: sale.id,
      recordingId: sale.recording_id,
      customerName: sale.customer_name,
      customerEmail: sale.customer_email,
      staffMember: sale.staff_member,
      bundle: sale.bundle,
      saleAmount: sale.sale_amount,
      saleDate: new Date(sale.sale_date),
      driveShared: sale.drive_shared
    })) || [];
  }

  async getVideoSlotsByRecordingId(recordingId: string) {
    const { data, error } = await (supabase as any)
      .from('video_slots')
      .select('*')
      .eq('recording_id', recordingId)
      .order('slot_number');

    if (error) throw error;
    return data || [];
  }

  async createVideoSlot(slotData: {
    recordingId: string;
    slotNumber: number;
    sceneId: string;
    cameraAngle: number;
    windowStart: number;
    slotDuration: number;
  }) {
    const { data, error } = await (supabase as any)
      .from('video_slots')
      .upsert({
        recording_id: slotData.recordingId,
        slot_number: slotData.slotNumber,
        scene_id: slotData.sceneId,
        camera_angle: slotData.cameraAngle,
        window_start: slotData.windowStart,
        slot_duration: slotData.slotDuration
      }, {
        onConflict: 'recording_id,slot_number'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Issue methods
  async createIssue(issue: {
    staffName: string;
    issueType: string;
    priority?: string | null;
    description: string;
  }) {
    const { data, error } = await (supabase as any)
      .from('issues')
      .insert({
        staff_name: issue.staffName,
        issue_type: issue.issueType,
        priority: issue.priority || null,
        description: issue.description,
        status: 'open'
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      staffName: data.staff_name,
      issueType: data.issue_type,
      priority: data.priority,
      description: data.description,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      resolvedAt: data.resolved_at,
      notes: data.notes
    };
  }

  async getAllIssues() {
    const { data, error } = await (supabase as any)
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data?.map((issue: any) => ({
      id: issue.id,
      staffName: issue.staff_name,
      issueType: issue.issue_type,
      priority: issue.priority,
      description: issue.description,
      status: issue.status,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      resolvedAt: issue.resolved_at,
      notes: issue.notes
    })) || [];
  }
}

// Video operations delegator (calls local device)
class VideoOperations {
  async delegateToLocal(endpoint: string, data?: any, method: string = 'GET') {
    try {
      // If data is provided but no method specified, default to POST
      const httpMethod = data && method === 'GET' ? 'POST' : method;
      
      const response = await fetch(`${localDeviceUrl}/api${endpoint}`, {
        method: httpMethod,
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined
      });
      
      if (!response.ok) {
        throw new Error(`Local device responded with ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to connect to local device:', error);
      throw new Error('Local device unavailable');
    }
  }
}

let app: express.Application | null = null;
const storage = new DatabaseStorage();
const videoOps = new VideoOperations();
const driveOAuth = importedDriveOAuth;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!app) {
      app = express();
      app.use(express.json());
      
      // Database routes (handled by Vercel)
      app.get('/api/recordings', async (req, res) => {
        try {
          const recordings = await storage.getAllFlightRecordings();
          res.json(recordings);
        } catch (error) {
          res.status(500).json({ error: 'Failed to fetch recordings' });
        }
      });

      app.post('/api/recordings', async (req, res) => {
        try {
          const recording = await storage.createFlightRecording(req.body);
          res.json(recording);
        } catch (error) {
          res.status(500).json({ error: 'Failed to create recording' });
        }
      });

      app.patch('/api/recordings/:id', async (req, res) => {
        try {
          const recording = await storage.updateFlightRecording(req.params.id, req.body);
          res.json(recording);
        } catch (error) {
          res.status(500).json({ error: 'Failed to update recording' });
        }
      });

      app.get('/api/sales', async (req, res) => {
        try {
          const sales = await storage.getAllSales();
          res.json(sales);
        } catch (error) {
          res.status(500).json({ error: 'Failed to fetch sales' });
        }
      });

      app.post('/api/sales', async (req, res) => {
        try {
          const sale = await storage.createSale(req.body);
          res.json(sale);
        } catch (error) {
          res.status(500).json({ error: 'Failed to create sale' });
        }
      });

      // Issue routes (handled by Vercel database)
      app.post('/api/issues', async (req, res) => {
        try {
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

      app.get('/api/issues', async (req, res) => {
        try {
          const issues = await storage.getAllIssues();
          res.json(issues);
        } catch (error: any) {
          res.status(500).json({ error: error.message });
        }
      });

      // Video routes (delegated to local device)
      app.post('/api/recordings/:recordingId/generate-clips', async (req, res) => {
        try {
          const result = await videoOps.delegateToLocal(`/recordings/${req.params.recordingId}/generate-clips`, req.body);
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      app.get('/api/recordings/:recordingId/clips', async (req, res) => {
        try {
          const result = await videoOps.delegateToLocal(`/recordings/${req.params.recordingId}/clips`);
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      app.post('/api/recordings/:recordingId/create-davinci-job', async (req, res) => {
        try {
          const result = await videoOps.delegateToLocal(`/recordings/${req.params.recordingId}/create-davinci-job`, req.body);
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      app.get('/api/recordings/:recordingId/project-info', async (req, res) => {
        try {
          const result = await videoOps.delegateToLocal(`/recordings/${req.params.recordingId}/project-info`);
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      // Video slots routes (handled by Vercel database)
      app.get('/api/recordings/:recordingId/video-slots', async (req, res) => {
        try {
          const { recordingId } = req.params;
          const slots = await storage.getVideoSlotsByRecordingId(recordingId);
          res.setHeader('Content-Type', 'application/json');
          res.json(Array.isArray(slots) ? slots : []);
        } catch (error: any) {
          res.status(500).json({ error: error.message });
        }
      });

      app.post('/api/recordings/:recordingId/video-slots', async (req, res) => {
        try {
          const { recordingId } = req.params;
          const { slotNumber, sceneId, cameraAngle, windowStart, slotDuration } = req.body;

          if (!slotNumber || !sceneId || !cameraAngle || windowStart === undefined) {
            return res.status(400).json({
              error: "Missing required fields: slotNumber, sceneId, cameraAngle, windowStart"
            });
          }

          const slot = await storage.createVideoSlot({
            recordingId,
            slotNumber: parseInt(slotNumber),
            sceneId,
            cameraAngle: parseInt(cameraAngle),
            windowStart: parseFloat(windowStart),
            slotDuration: slotDuration || 3.0
          });

          res.json(slot);
        } catch (error: any) {
          res.status(500).json({ error: error.message });
        }
      });

      app.patch('/api/recordings/:recordingId/video-slots/:slotNumber', async (req, res) => {
        try {
          const { recordingId, slotNumber } = req.params;
          const { windowStart } = req.body;

          if (windowStart === undefined) {
            return res.status(400).json({ error: "windowStart is required" });
          }

          const existingSlots = await storage.getVideoSlotsByRecordingId(recordingId);
          const existingSlot = existingSlots.find((s: any) => s.slot_number === parseInt(slotNumber));

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

            const newSlot = await storage.createVideoSlot({
              recordingId,
              slotNumber: parseInt(slotNumber),
              sceneId: `${recordingId}_${slotConfig.sceneType}`,
              cameraAngle: slotConfig.cameraAngle,
              windowStart: parseFloat(windowStart),
              slotDuration: slotConfig.duration
            });
            res.json(newSlot);
          }
        } catch (error: any) {
          res.status(500).json({ error: error.message });
        }
      });

      // Photo upload endpoint
      const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

      app.post('/api/recordings/:recordingId/upload-photos', upload.array('photos', 50), async (req: any, res) => {
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

          if (!driveOAuth.isReady()) {
            return res.status(503).json({ error: "Google Drive not authenticated" });
          }

          // Extract the customer folder ID from the URL
          console.log(`📁 Drive folder URL: ${recording.driveFolderUrl}`);
          const customerFolderId = driveOAuth.extractFolderIdFromUrl(recording.driveFolderUrl);
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
          const photosFolderId = await driveOAuth.getPhotosFolderId(customerFolderId);
          if (!photosFolderId) {
            return res.status(400).json({ error: "Photos folder not found in Drive" });
          }

          console.log(`📸 Uploading ${files.length} photos for recording ${recordingId}`);

          // Upload each photo
          const uploadResults = [];
          for (const file of files) {
            const result = await driveOAuth.uploadFileToFolder(
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

      // Google Drive OAuth endpoints (handled by Vercel using env vars)
      app.get('/api/drive/auth/url', async (req, res) => {
        try {
          const authUrl = driveOAuth.generateAuthUrl();
          res.json({ authUrl });
        } catch (error: any) {
          res.status(500).json({ error: error.message });
        }
      });

      app.get('/api/drive/auth/status', async (req, res) => {
        try {
          const isReady = driveOAuth.isReady();
          res.json({ authenticated: isReady });
        } catch (error: any) {
          res.status(500).json({ error: error.message });
        }
      });

      app.post('/api/drive/share-folder', async (req, res) => {
        try {
          const { recordingId, customerEmail, customerEmails, bundle } = req.body;

          // Support both single email and multiple emails
          const hasEmails = customerEmails?.length > 0 || customerEmail;
          if (!recordingId || !hasEmails) {
            return res.status(400).json({ error: 'recordingId and at least one email are required' });
          }

          if (!driveOAuth.isReady()) {
            return res.status(503).json({ error: 'Google Drive not authenticated' });
          }

          // Delegate to local device which has the file structure and folder mapping
          const result = await videoOps.delegateToLocal(`/drive/share-folder`, { recordingId, customerEmail, customerEmails, bundle }, 'POST');
          res.json(result);
        } catch (error: any) {
          res.status(500).json({ error: error.message });
        }
      });

      // Old Google Drive routes (delegated to local device) - kept for backward compatibility
      app.get('/api/google/auth-url', async (req, res) => {
        try {
          const result = await videoOps.delegateToLocal('/google/auth-url');
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      app.get('/api/google/auth-status', async (req, res) => {
        try {
          const result = await videoOps.delegateToLocal('/google/auth-status');
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      app.post('/api/google/upload-video', async (req, res) => {
        try {
          const result = await videoOps.delegateToLocal('/google/upload-video', req.body);
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      app.post('/api/google/signout', async (req, res) => {
        try {
          const result = await videoOps.delegateToLocal('/google/signout', req.body);
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      // Camera configuration
      app.get('/api/camera-config', async (req, res) => {
        try {
          const result = await videoOps.delegateToLocal('/camera-config');
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      // Health check
      app.get('/api/health', (req, res) => {
        res.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: {
            database: !!supabase,
            localDevice: localDeviceUrl
          }
        });
      });

      // API status endpoint
      app.get('/api', (req, res) => {
        res.json({
          message: 'MagnumStream API - Hybrid Architecture',
          timestamp: new Date().toISOString(),
          endpoints: {
            database: ['GET /api/recordings', 'POST /api/recordings', 'GET /api/sales', 'POST /api/sales', 'GET /api/issues', 'POST /api/issues'],
            video: [
              'POST /api/recordings/:id/generate-clips',
              'GET /api/recordings/:id/clips',
              'POST /api/recordings/:id/create-davinci-job',
              'GET /api/recordings/:id/project-info'
            ],
            google: [
              'GET /api/google/auth-url',
              'GET /api/google/auth-status',
              'POST /api/google/upload-video',
              'POST /api/google/signout'
            ],
            health: ['GET /api/health']
          },
          architecture: {
            database: 'Handled by Vercel + Supabase',
            video: 'Delegated to local device',
            google: 'Delegated to local device',
            issues: 'Handled by Vercel + Supabase'
          }
        });
      });
    }
    
    return app(req, res);
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}