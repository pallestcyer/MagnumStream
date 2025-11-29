import type { VercelRequest, VercelResponse } from '@vercel/node';
import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { googleDriveOAuth as importedDriveOAuth } from './GoogleDriveOAuth.js';

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
          const { pilotName, flightPilot, flightTime } = req.body;

          // Create the recording in the database first
          let recording = await storage.createFlightRecording(req.body);

          // Try to create Google Drive folder structure if we have the required fields
          if (driveOAuth.isReady() && pilotName && flightPilot && flightTime) {
            try {
              console.log(`📁 Creating Google Drive folder for project: ${pilotName}`);

              const folderResult = await driveOAuth.createProjectFolderStructure(
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
              }
            } catch (driveError: any) {
              // Don't fail the recording creation if Drive folder creation fails
              console.error(`⚠️ Failed to create Google Drive folder (non-fatal):`, driveError.message);
            }
          } else if (!driveOAuth.isReady()) {
            console.log(`⚠️ Google Drive not authenticated - skipping folder creation`);
          } else {
            console.log(`⚠️ Missing required fields for folder creation (pilotName, flightPilot, or flightTime)`);
          }

          res.json(recording);
        } catch (error) {
          res.status(500).json({ error: 'Failed to create recording' });
        }
      });

      app.patch('/api/recordings/:id', async (req, res) => {
        try {
          const { id } = req.params;
          const updates = req.body;

          // Get the current recording to compare old values
          const currentRecording = await storage.getFlightRecording(id);
          if (!currentRecording) {
            return res.status(404).json({ error: 'Recording not found' });
          }

          // Check if we need to update Google Drive folder names
          const folderRelevantFields = ['pilotName', 'flightPilot', 'flightTime'];
          const hasFolderChanges = folderRelevantFields.some(
            field => updates[field] !== undefined && updates[field] !== currentRecording[field as keyof typeof currentRecording]
          );

          if (hasFolderChanges && currentRecording.driveFolderId && driveOAuth.isReady()) {
            try {
              const folderResult = await driveOAuth.updateProjectFolders(
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

      // Direct photo upload endpoints (bypasses Vercel payload limit)
      // Step 1: Get upload credentials for direct-to-Drive uploads
      app.get('/api/recordings/:recordingId/photo-upload-session', async (req, res) => {
        try {
          const { recordingId } = req.params;

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
          const customerFolderId = driveOAuth.extractFolderIdFromUrl(recording.driveFolderUrl);
          if (!customerFolderId) {
            return res.status(400).json({
              error: "Invalid Drive folder URL",
              help: "Expected format: https://drive.google.com/drive/folders/FOLDER_ID"
            });
          }

          // Get the Photos subfolder ID
          const photosFolderId = await driveOAuth.getPhotosFolderId(customerFolderId);
          if (!photosFolderId) {
            return res.status(400).json({ error: "Photos folder not found in Drive" });
          }

          // Get a fresh access token for the client to use
          const accessToken = await driveOAuth.getAccessToken();
          if (!accessToken) {
            return res.status(503).json({ error: "Failed to get access token" });
          }

          console.log(`📸 Photo upload session created for recording ${recordingId}`);
          console.log(`📁 Photos folder ID: ${photosFolderId}`);

          res.json({
            photosFolderId,
            accessToken,
            // Token expires in ~1 hour, but uploads should be quick
            expiresIn: 3600
          });

        } catch (error: any) {
          console.error('❌ Photo upload session error:', error);
          res.status(500).json({ error: error.message });
        }
      });

      // Step 2: Mark photos as uploaded after direct upload completes
      app.post('/api/recordings/:recordingId/photos-complete', async (req, res) => {
        try {
          const { recordingId } = req.params;
          const { uploadedCount, photosFolderId } = req.body;

          const recording = await storage.getFlightRecording(recordingId);
          if (!recording) {
            return res.status(404).json({ error: "Recording not found" });
          }

          // Update the recording to mark photos as uploaded
          await storage.updateFlightRecording(recordingId, {
            photosUploaded: true,
            photosFolderId: photosFolderId || recording.photosFolderId
          });

          console.log(`✅ Marked ${uploadedCount} photos as uploaded for recording ${recordingId}`);

          res.json({
            success: true,
            uploaded: uploadedCount
          });

        } catch (error: any) {
          console.error('❌ Photos complete error:', error);
          res.status(500).json({ error: error.message });
        }
      });

      // Legacy photo upload endpoint (kept for backward compatibility, but will hit Vercel payload limit)
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
          console.log(`📁 Photos folder ID: ${photosFolderId}`);

          // Upload each photo
          const uploadResults = [];
          const errors = [];
          for (const file of files) {
            console.log(`📤 Uploading: ${file.originalname} (${file.size} bytes, ${file.mimetype})`);
            try {
              const result = await driveOAuth.uploadFileToFolder(
                photosFolderId,
                file.originalname,
                file.buffer,
                file.mimetype
              );
              if (result) {
                uploadResults.push(result);
                console.log(`✅ Upload success: ${file.originalname}`);
              } else {
                console.log(`⚠️ Upload returned null for: ${file.originalname}`);
                errors.push({ file: file.originalname, error: 'Upload returned null' });
              }
            } catch (uploadError: any) {
              console.error(`❌ Upload failed for ${file.originalname}:`, uploadError.message);
              errors.push({ file: file.originalname, error: uploadError.message });
            }
          }

          // Mark photos as uploaded in the database and store the photos folder ID
          await storage.updateFlightRecording(recordingId, {
            photosUploaded: true,
            photosFolderId: photosFolderId
          });

          console.log(`✅ Uploaded ${uploadResults.length}/${files.length} photos`);
          if (errors.length > 0) {
            console.log(`⚠️ ${errors.length} errors:`, JSON.stringify(errors));
          }

          res.json({
            success: uploadResults.length > 0,
            uploaded: uploadResults.length,
            total: files.length,
            files: uploadResults,
            errors: errors.length > 0 ? errors : undefined
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

      // Admin analytics endpoint
      app.get('/api/admin/analytics', async (req, res) => {
        try {
          const { from, to } = req.query;

          // Fetch all recordings and sales
          const recordings = await storage.getAllFlightRecordings();
          const sales = await storage.getAllSales();

          // Apply date filter
          const fromDate = from ? new Date(from as string) : new Date(0);
          const toDate = to ? new Date(to as string) : new Date();
          toDate.setHours(23, 59, 59, 999);

          const filteredRecordings = recordings.filter((r: any) => {
            const date = new Date(r.createdAt);
            return date >= fromDate && date <= toDate;
          });

          const recordingIds = new Set(filteredRecordings.map((r: any) => r.id));
          const filteredSales = sales.filter((s: any) => recordingIds.has(s.recordingId));

          // Calculate statistics
          const totalSessions = filteredRecordings.length;
          const totalSales = filteredSales.length;
          const conversionRate = totalSessions > 0 ? Math.round((totalSales / totalSessions) * 100) : 0;
          const totalRevenue = filteredSales.reduce((acc: number, s: any) => acc + (s.saleAmount || 0), 0);
          const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

          // Package breakdown
          const combos = filteredSales.filter((s: any) => s.bundle === 'combo').length;
          const videoOnly = filteredSales.filter((s: any) => s.bundle === 'video_only').length;
          const photosOnly = filteredSales.filter((s: any) => s.bundle === 'photos_only').length;

          // Daily revenue
          const dailyRevenueMap: Record<string, number> = {};
          filteredSales.forEach((s: any) => {
            const date = new Date(s.saleDate).toISOString().split('T')[0];
            dailyRevenueMap[date] = (dailyRevenueMap[date] || 0) + (s.saleAmount || 0);
          });
          const dailyRevenue = Object.entries(dailyRevenueMap)
            .map(([date, revenue]) => ({ date, revenue }))
            .sort((a, b) => a.date.localeCompare(b.date));

          // Availability paths
          const availabilityPaths: Record<string, { sessions: number; conversions: number }> = {
            'Both Available': { sessions: 0, conversions: 0 },
            'Video Only Available': { sessions: 0, conversions: 0 },
            'Photos Only Available': { sessions: 0, conversions: 0 },
            'Neither Available': { sessions: 0, conversions: 0 }
          };

          filteredRecordings.forEach((r: any) => {
            const hasVideo = r.exportStatus === 'completed' || r.driveFileUrl;
            const hasPhotos = r.photosUploaded;

            let path: string;
            if (hasVideo && hasPhotos) path = 'Both Available';
            else if (hasVideo) path = 'Video Only Available';
            else if (hasPhotos) path = 'Photos Only Available';
            else path = 'Neither Available';

            availabilityPaths[path].sessions++;

            const sale = filteredSales.find((s: any) => s.recordingId === r.id);
            if (sale) availabilityPaths[path].conversions++;
          });

          // Sankey data
          const sankeyLinks: Record<string, number> = {};
          const incrementSankeyLink = (from: string, to: string) => {
            const key = `${from}|${to}`;
            sankeyLinks[key] = (sankeyLinks[key] || 0) + 1;
          };

          filteredRecordings.forEach((r: any) => {
            const hasVideo = r.exportStatus === 'completed' || r.driveFileUrl;
            const hasPhotos = r.photosUploaded;

            let source: string;
            if (hasVideo && hasPhotos) source = 'Both Available';
            else if (hasVideo) source = 'Video Only';
            else if (hasPhotos) source = 'Photos Only';
            else source = 'Neither';

            const sale = filteredSales.find((s: any) => s.recordingId === r.id);
            if (sale) {
              if (sale.bundle === 'combo') incrementSankeyLink(source, 'Bought Combo');
              else if (sale.bundle === 'video_only') incrementSankeyLink(source, 'Bought Video');
              else if (sale.bundle === 'photos_only') incrementSankeyLink(source, 'Bought Photos');
            } else {
              incrementSankeyLink(source, 'No Purchase');
            }
          });

          const sankeyData = Object.entries(sankeyLinks).map(([key, weight]) => {
            const [from, to] = key.split('|');
            return [from, to, weight];
          });

          // Ground crew performance (based on sales.staffMember)
          const groundCrewPerformance: Record<string, any> = {};
          filteredSales.forEach((s: any) => {
            const staff = s.staffMember || 'Unknown';
            if (!groundCrewPerformance[staff]) {
              groundCrewPerformance[staff] = { name: staff, revenue: 0, combos: 0, videos: 0, photos: 0, totalSales: 0 };
            }
            groundCrewPerformance[staff].revenue += s.saleAmount || 0;
            groundCrewPerformance[staff].totalSales++;
            if (s.bundle === 'combo') groundCrewPerformance[staff].combos++;
            else if (s.bundle === 'video_only') groundCrewPerformance[staff].videos++;
            else if (s.bundle === 'photos_only') groundCrewPerformance[staff].photos++;
          });
          const groundCrewData = Object.values(groundCrewPerformance).sort((a: any, b: any) => b.revenue - a.revenue);

          // Pilot performance (based on recordings.flightPilot)
          const pilotPerformance: Record<string, any> = {};
          const recordingToPilot = new Map<string, string>();
          filteredRecordings.forEach((r: any) => {
            if (r.flightPilot) recordingToPilot.set(r.id, r.flightPilot);
          });
          filteredSales.forEach((s: any) => {
            const pilot = recordingToPilot.get(s.recordingId) || 'Unknown';
            if (!pilotPerformance[pilot]) {
              pilotPerformance[pilot] = { name: pilot, revenue: 0, combos: 0, videos: 0, photos: 0, totalSales: 0 };
            }
            pilotPerformance[pilot].revenue += s.saleAmount || 0;
            pilotPerformance[pilot].totalSales++;
            if (s.bundle === 'combo') pilotPerformance[pilot].combos++;
            else if (s.bundle === 'video_only') pilotPerformance[pilot].videos++;
            else if (s.bundle === 'photos_only') pilotPerformance[pilot].photos++;
          });
          const pilotData = Object.values(pilotPerformance).sort((a: any, b: any) => b.revenue - a.revenue);

          // Hourly distribution
          const hourlyDistribution: Record<number, number> = {};
          filteredSales.forEach((s: any) => {
            const hour = new Date(s.saleDate).getHours();
            hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
          });
          const hourlyData = Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            sales: hourlyDistribution[i] || 0
          }));

          // Incomplete projects
          const incompleteProjects = filteredRecordings
            .filter((r: any) => {
              const hasVideo = r.exportStatus === 'completed' || r.driveFileUrl;
              const hasPhotos = r.photosUploaded;
              return !hasVideo || !hasPhotos;
            })
            .map((r: any) => {
              const sale = filteredSales.find((s: any) => s.recordingId === r.id);
              return {
                id: r.id,
                flightDate: r.flightDate || null,
                flightTime: r.flightTime || null,
                customerNames: [r.pilotName],
                email: r.pilotEmail || '',
                pilot: r.flightPilot || 'Unknown',
                groundCrew: r.staffMember || '',
                videoCompleted: r.exportStatus === 'completed' || !!r.driveFileUrl,
                photosCompleted: r.photosUploaded,
                packagePurchased: sale?.bundle || null
              };
            });

          const missingVideo = incompleteProjects.filter((p: any) => !p.videoCompleted).length;
          const missingPhotos = incompleteProjects.filter((p: any) => !p.photosCompleted).length;
          const missingBoth = incompleteProjects.filter((p: any) => !p.videoCompleted && !p.photosCompleted).length;

          // Non-purchasers
          const nonPurchasers = filteredRecordings
            .filter((r: any) => !filteredSales.find((s: any) => s.recordingId === r.id))
            .map((r: any) => ({
              id: r.id,
              flightDate: r.flightDate || null,
              flightTime: r.flightTime || null,
              customerNames: [r.pilotName],
              email: r.pilotEmail || '',
              packagePurchased: null,
              upsellOpportunity: 'Full Package',
              potentialValue: 49.99
            }));

          res.json({
            totalSessions,
            totalSales,
            conversionRate,
            totalRevenue,
            avgOrderValue,
            combos,
            videoOnly,
            photosOnly,
            dailyRevenue,
            availabilityPaths: Object.entries(availabilityPaths).map(([path, data]) => ({
              path,
              sessions: data.sessions,
              conversions: data.conversions,
              conversionRate: data.sessions > 0 ? Math.round((data.conversions / data.sessions) * 100) : 0
            })),
            sankeyData,
            groundCrewData,
            pilotData,
            hourlyData,
            incompleteProjects,
            missingVideo,
            missingPhotos,
            missingBoth,
            nonPurchasers,
            totalGroups: totalSessions
          });
        } catch (error: any) {
          console.error('Admin analytics error:', error);
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