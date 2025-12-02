import { supabase } from './supabase';
import type { IStorage } from '../storage';
import type { 
  User, 
  InsertUser, 
  FlightRecording, 
  InsertFlightRecording,
  Sale,
  InsertSale
} from "../schema";

// Type-safe wrapper for Supabase operations  
const db = supabase as any;

export class SupabaseStorage implements IStorage {
  
  async getUser(id: string): Promise<User | undefined> {
    const { data, error } = await db
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      console.error('Error fetching user:', error);
      return undefined;
    }
    
    return {
      id: (data as any).id,
      username: (data as any).username,
      password: (data as any).password
    };
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const { data, error } = await db
      .from('users')
      .select('*')
      .eq('username', username)
      .single();
    
    if (error || !data) {
      console.error('Error fetching user by username:', error);
      return undefined;
    }
    
    return {
      id: (data as any).id,
      username: (data as any).username,
      password: (data as any).password
    };
  }

  async createUser(user: InsertUser): Promise<User> {
    const { data, error } = await db
      .from('users')
      .insert({
        username: user.username,
        password: user.password
      })
      .select()
      .single();
    
    if (error || !data) {
      throw new Error(`Failed to create user: ${error?.message || 'Unknown error'}`);
    }
    
    return {
      id: (data as any).id,
      username: (data as any).username,
      password: (data as any).password
    };
  }

  async createFlightRecording(recording: InsertFlightRecording): Promise<FlightRecording> {
    const { data, error } = await db
      .from('flight_recordings')
      .insert({
        project_name: recording.projectName,
        pilot_name: recording.pilotName,
        pilot_email: recording.pilotEmail,
        flight_pilot: recording.flightPilot,
        staff_member: recording.staffMember,
        flight_date: recording.flightDate,
        flight_time: recording.flightTime,
        export_status: recording.exportStatus || 'pending',
        drive_file_url: recording.driveFileUrl,
        sms_phone_number: recording.smsPhoneNumber,
        // New intake form fields
        phone: recording.phone,
        origin: recording.origin,
        referral: recording.referral,
        purpose: recording.purpose,
        language: recording.language || 'english',
        contact_consent: recording.contactConsent || false,
        waiver_consent: recording.waiverConsent || false
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create flight recording: ${error.message}`);
    }

    return {
      id: data.id,
      projectName: data.project_name,
      pilotName: data.pilot_name,
      pilotEmail: data.pilot_email,
      flightPilot: data.flight_pilot,
      staffMember: data.staff_member,
      flightDate: data.flight_date,
      flightTime: data.flight_time,
      exportStatus: data.export_status,
      driveFileId: data.drive_file_id,
      driveFileUrl: data.drive_file_url,
      driveFolderUrl: data.drive_folder_url,
      driveFolderId: data.drive_folder_id,
      videoFolderId: data.video_folder_id,
      photosFolderId: data.photos_folder_id,
      localVideoPath: data.local_video_path,
      thumbnailUrl: data.thumbnail_url,
      smsPhoneNumber: data.sms_phone_number,
      sold: data.sold,
      soldBundle: data.sold_bundle,
      photosUploaded: data.photos_uploaded,
      archived: data.archived,
      // New intake form fields
      phone: data.phone,
      origin: data.origin,
      referral: data.referral,
      purpose: data.purpose,
      language: data.language,
      contactConsent: data.contact_consent,
      waiverConsent: data.waiver_consent,
      createdAt: new Date(data.created_at)
    };
  }

  async getFlightRecording(id: string): Promise<FlightRecording | undefined> {
    const { data, error } = await db
      .from('flight_recordings')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching flight recording:', error);
      return undefined;
    }

    return data ? {
      id: data.id,
      projectName: data.project_name,
      pilotName: data.pilot_name,
      pilotEmail: data.pilot_email,
      staffMember: data.staff_member,
      flightDate: data.flight_date,
      flightTime: data.flight_time,
      flightPilot: data.flight_pilot,
      exportStatus: data.export_status,
      driveFileId: data.drive_file_id,
      driveFileUrl: data.drive_file_url,
      driveFolderUrl: data.drive_folder_url,
      driveFolderId: data.drive_folder_id,
      videoFolderId: data.video_folder_id,
      photosFolderId: data.photos_folder_id,
      localVideoPath: data.local_video_path,
      thumbnailUrl: data.thumbnail_url,
      smsPhoneNumber: data.sms_phone_number,
      sold: data.sold,
      soldBundle: data.sold_bundle,
      photosUploaded: data.photos_uploaded,
      archived: data.archived,
      // New intake form fields
      phone: data.phone,
      origin: data.origin,
      referral: data.referral,
      purpose: data.purpose,
      language: data.language,
      contactConsent: data.contact_consent,
      waiverConsent: data.waiver_consent,
      createdAt: new Date(data.created_at)
    } : undefined;
  }

  async updateFlightRecording(id: string, updates: Partial<FlightRecording>): Promise<FlightRecording | undefined> {
    // Convert camelCase to snake_case for Supabase
    const dbUpdates: any = {};
    if (updates.projectName !== undefined) dbUpdates.project_name = updates.projectName;
    if (updates.pilotName !== undefined) dbUpdates.pilot_name = updates.pilotName;
    if (updates.pilotEmail !== undefined) dbUpdates.pilot_email = updates.pilotEmail;
    if (updates.flightPilot !== undefined) dbUpdates.flight_pilot = updates.flightPilot;
    if (updates.staffMember !== undefined) dbUpdates.staff_member = updates.staffMember;
    if (updates.flightDate !== undefined) dbUpdates.flight_date = updates.flightDate;
    if (updates.flightTime !== undefined) dbUpdates.flight_time = updates.flightTime;
    if (updates.exportStatus !== undefined) dbUpdates.export_status = updates.exportStatus;
    if (updates.driveFileId !== undefined) dbUpdates.drive_file_id = updates.driveFileId;
    if (updates.driveFileUrl !== undefined) dbUpdates.drive_file_url = updates.driveFileUrl;
    if (updates.driveFolderUrl !== undefined) dbUpdates.drive_folder_url = updates.driveFolderUrl;
    if (updates.driveFolderId !== undefined) dbUpdates.drive_folder_id = updates.driveFolderId;
    if (updates.videoFolderId !== undefined) dbUpdates.video_folder_id = updates.videoFolderId;
    if (updates.photosFolderId !== undefined) dbUpdates.photos_folder_id = updates.photosFolderId;
    if (updates.localVideoPath !== undefined) dbUpdates.local_video_path = updates.localVideoPath;
    if (updates.thumbnailUrl !== undefined) dbUpdates.thumbnail_url = updates.thumbnailUrl;
    if (updates.smsPhoneNumber !== undefined) dbUpdates.sms_phone_number = updates.smsPhoneNumber;
    if (updates.sold !== undefined) dbUpdates.sold = updates.sold;
    if (updates.soldBundle !== undefined) dbUpdates.sold_bundle = updates.soldBundle;
    if (updates.photosUploaded !== undefined) dbUpdates.photos_uploaded = updates.photosUploaded;
    if (updates.archived !== undefined) dbUpdates.archived = updates.archived;

    console.log(`🔍 SUPABASE UPDATE: Recording ${id}`);
    console.log(`   Updates requested:`, updates);
    console.log(`   DB updates (snake_case):`, dbUpdates);

    const { data, error } = await db
      .from('flight_recordings')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`❌ SUPABASE ERROR updating recording ${id}:`, error);
      console.error(`   Error details:`, JSON.stringify(error, null, 2));
      return undefined;
    }

    console.log(`✅ SUPABASE UPDATE SUCCESS: Recording ${id}`);
    console.log(`   Updated export_status:`, data?.export_status);

    return data ? {
      id: data.id,
      projectName: data.project_name,
      pilotName: data.pilot_name,
      pilotEmail: data.pilot_email,
      staffMember: data.staff_member,
      flightDate: data.flight_date,
      flightTime: data.flight_time,
      flightPilot: data.flight_pilot,
      exportStatus: data.export_status,
      driveFileId: data.drive_file_id,
      driveFileUrl: data.drive_file_url,
      driveFolderUrl: data.drive_folder_url,
      driveFolderId: data.drive_folder_id,
      videoFolderId: data.video_folder_id,
      photosFolderId: data.photos_folder_id,
      localVideoPath: data.local_video_path,
      thumbnailUrl: data.thumbnail_url,
      smsPhoneNumber: data.sms_phone_number,
      sold: data.sold,
      soldBundle: data.sold_bundle,
      photosUploaded: data.photos_uploaded,
      archived: data.archived,
      // New intake form fields
      phone: data.phone,
      origin: data.origin,
      referral: data.referral,
      purpose: data.purpose,
      language: data.language,
      contactConsent: data.contact_consent,
      waiverConsent: data.waiver_consent,
      createdAt: new Date(data.created_at)
    } : undefined;
  }

  async deleteFlightRecording(id: string): Promise<boolean> {
    const { error } = await db
      .from('flight_recordings')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting flight recording:', error);
      return false;
    }
    
    return true;
  }

  async getAllFlightRecordings(): Promise<FlightRecording[]> {
    const { data, error } = await db
      .from('flight_recordings')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch flight recordings: ${error.message}`);
    }
    
    return data.map((record: any) => ({
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
      photoThumbnailUrl: record.photo_thumbnail_url,
      smsPhoneNumber: record.sms_phone_number,
      sold: record.sold,
      soldBundle: record.sold_bundle,
      photosUploaded: record.photos_uploaded,
      archived: record.archived,
      // New intake form fields
      phone: record.phone,
      origin: record.origin,
      referral: record.referral,
      purpose: record.purpose,
      language: record.language,
      contactConsent: record.contact_consent,
      waiverConsent: record.waiver_consent,
      createdAt: new Date(record.created_at)
    }));
  }

  async createSale(sale: InsertSale): Promise<Sale> {
    const { data, error } = await db
      .from('sales')
      .insert({
        recording_id: sale.recordingId,
        customer_name: sale.customerName,
        customer_email: sale.customerEmail,
        staff_member: sale.staffMember,
        bundle: sale.bundle,
        sale_amount: sale.saleAmount
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create sale: ${error.message}`);
    }
    
    // Mark recording as sold
    await this.updateFlightRecording(sale.recordingId, { sold: true });
    
    return {
      id: data.id,
      recordingId: data.recording_id,
      customerName: data.customer_name,
      customerEmail: data.customer_email,
      staffMember: data.staff_member,
      bundle: data.bundle,
      saleAmount: data.sale_amount,
      saleDate: new Date(data.sale_date),
      driveShared: data.drive_shared
    };
  }

  async getAllSales(): Promise<Sale[]> {
    const { data, error } = await db
      .from('sales')
      .select('*')
      .order('sale_date', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch sales: ${error.message}`);
    }
    
    return data.map((sale: any) => ({
      id: sale.id,
      recordingId: sale.recording_id,
      customerName: sale.customer_name,
      customerEmail: sale.customer_email,
      staffMember: sale.staff_member,
      bundle: sale.bundle,
      saleAmount: sale.sale_amount,
      saleDate: new Date(sale.sale_date),
      driveShared: sale.drive_shared
    }));
  }

  async getSalesByRecording(recordingId: string): Promise<Sale[]> {
    const { data, error } = await db
      .from('sales')
      .select('*')
      .eq('recording_id', recordingId)
      .order('sale_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch sales for recording: ${error.message}`);
    }

    return data.map((sale: any) => ({
      id: sale.id,
      recordingId: sale.recording_id,
      customerName: sale.customer_name,
      customerEmail: sale.customer_email,
      staffMember: sale.staff_member,
      bundle: sale.bundle,
      saleAmount: sale.sale_amount,
      saleDate: new Date(sale.sale_date),
      driveShared: sale.drive_shared
    }));
  }

  async updateSale(saleId: string, updates: {
    customerEmail?: string;
    staffMember?: string;
    bundle?: string;
    saleAmount?: number;
    driveShared?: boolean;
  }): Promise<Sale> {
    const updateData: any = {};

    if (updates.customerEmail !== undefined) updateData.customer_email = updates.customerEmail;
    if (updates.staffMember !== undefined) updateData.staff_member = updates.staffMember;
    if (updates.bundle !== undefined) updateData.bundle = updates.bundle;
    if (updates.saleAmount !== undefined) updateData.sale_amount = updates.saleAmount;
    if (updates.driveShared !== undefined) updateData.drive_shared = updates.driveShared;

    const { data, error } = await db
      .from('sales')
      .update(updateData)
      .eq('id', saleId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update sale: ${error.message}`);
    }

    return {
      id: data.id,
      recordingId: data.recording_id,
      customerName: data.customer_name,
      customerEmail: data.customer_email,
      staffMember: data.staff_member,
      bundle: data.bundle,
      saleAmount: data.sale_amount,
      saleDate: new Date(data.sale_date),
      driveShared: data.drive_shared
    };
  }

  // Scene recordings methods
  async createSceneRecording(sceneData: {
    recordingId: string;
    sceneType: string;
    sceneIndex: number;
    camera1Url?: string;
    camera2Url?: string;
    duration: number;
  }) {
    const { data, error } = await db
      .from('scene_recordings')
      .insert({
        recording_id: sceneData.recordingId,
        scene_type: sceneData.sceneType,
        scene_index: sceneData.sceneIndex,
        camera1_url: sceneData.camera1Url,
        camera2_url: sceneData.camera2Url,
        duration: sceneData.duration
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create scene recording: ${error.message}`);
    }
    
    return data;
  }

  async getSceneRecordingsByFlightId(recordingId: string) {
    const { data, error } = await db
      .from('scene_recordings')
      .select('*')
      .eq('recording_id', recordingId)
      .order('scene_index');
    
    if (error) {
      throw new Error(`Failed to fetch scene recordings: ${error.message}`);
    }
    
    return data;
  }

  // Video slots methods
  async createVideoSlot(slotData: {
    recordingId: string;
    slotNumber: number;
    sceneId: string;
    cameraAngle: number;
    windowStart: number;
    slotDuration: number;
  }) {
    const { data, error } = await db
      .from('video_slots')
      .insert({
        recording_id: slotData.recordingId,
        slot_number: slotData.slotNumber,
        scene_id: slotData.sceneId,
        camera_angle: slotData.cameraAngle,
        window_start: slotData.windowStart,
        slot_duration: slotData.slotDuration
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create video slot: ${error.message}`);
    }
    
    return data;
  }

  async getVideoSlotsByRecordingId(recordingId: string) {
    const { data, error } = await db
      .from('video_slots')
      .select('*')
      .eq('recording_id', recordingId)
      .order('slot_number');
    
    if (error) {
      throw new Error(`Failed to fetch video slots: ${error.message}`);
    }
    
    return data;
  }

  // Find recording by session ID (pilot name sanitized)
  async findRecordingBySessionId(sessionId: string): Promise<FlightRecording | undefined> {
    // Convert sessionId back to pilot name format for lookup
    const pilotName = sessionId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Use ilike for case-insensitive matching to handle different capitalizations
    const { data, error } = await db
      .from('flight_recordings')
      .select('*')
      .ilike('pilot_name', pilotName)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      return undefined;
    }
    
    return {
      id: data.id,
      projectName: data.project_name,
      pilotName: data.pilot_name,
      pilotEmail: data.pilot_email,
      flightPilot: data.flight_pilot,
      staffMember: data.staff_member,
      flightDate: data.flight_date,
      flightTime: data.flight_time,
      exportStatus: data.export_status,
      driveFileId: data.drive_file_id,
      driveFileUrl: data.drive_file_url,
      driveFolderUrl: data.drive_folder_url,
      localVideoPath: data.local_video_path,
      thumbnailUrl: data.thumbnail_url,
      smsPhoneNumber: data.sms_phone_number,
      sold: data.sold,
      createdAt: new Date(data.created_at)
    };
  }

  // Issue methods
  async createIssue(issue: {
    staffName: string;
    issueType: 'camera' | 'recording' | 'editing' | 'export' | 'performance' | 'ui' | 'other';
    priority?: 'low' | 'medium' | 'high' | 'critical' | null;
    description: string;
  }) {
    const { data, error } = await db
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

    if (error) {
      throw new Error(`Failed to create issue: ${error.message}`);
    }

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
    const { data, error } = await db
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch issues: ${error.message}`);
    }

    return data.map((issue: any) => ({
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
    }));
  }

  async updateIssue(issueId: string, updates: {
    status?: 'open' | 'in_progress' | 'resolved' | 'closed';
    notes?: string;
    resolvedAt?: string;
  }) {
    const updateData: any = {};

    if (updates.status) updateData.status = updates.status;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.resolvedAt) updateData.resolved_at = updates.resolvedAt;

    const { data, error } = await db
      .from('issues')
      .update(updateData)
      .eq('id', issueId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update issue: ${error.message}`);
    }

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
}