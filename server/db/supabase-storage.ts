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
        staff_member: recording.staffMember,
        flight_date: recording.flightDate,
        flight_time: recording.flightTime,
        export_status: recording.exportStatus || 'pending',
        drive_file_url: recording.driveFileUrl,
        sms_phone_number: recording.smsPhoneNumber
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
      staffMember: data.staff_member,
      flightDate: data.flight_date,
      flightTime: data.flight_time,
      exportStatus: data.export_status,
      driveFileId: data.drive_file_id,
      driveFileUrl: data.drive_file_url,
      smsPhoneNumber: data.sms_phone_number,
      sold: data.sold,
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
      exportStatus: data.export_status,
      driveFileId: data.drive_file_id,
      driveFileUrl: data.drive_file_url,
      smsPhoneNumber: data.sms_phone_number,
      sold: data.sold,
      createdAt: new Date(data.created_at)
    } : undefined;
  }

  async updateFlightRecording(id: string, updates: Partial<FlightRecording>): Promise<FlightRecording | undefined> {
    // Convert camelCase to snake_case for Supabase
    const dbUpdates: any = {};
    if (updates.projectName !== undefined) dbUpdates.project_name = updates.projectName;
    if (updates.pilotName !== undefined) dbUpdates.pilot_name = updates.pilotName;
    if (updates.pilotEmail !== undefined) dbUpdates.pilot_email = updates.pilotEmail;
    if (updates.staffMember !== undefined) dbUpdates.staff_member = updates.staffMember;
    if (updates.flightDate !== undefined) dbUpdates.flight_date = updates.flightDate;
    if (updates.flightTime !== undefined) dbUpdates.flight_time = updates.flightTime;
    if (updates.exportStatus !== undefined) dbUpdates.export_status = updates.exportStatus;
    if (updates.driveFileId !== undefined) dbUpdates.drive_file_id = updates.driveFileId;
    if (updates.driveFileUrl !== undefined) dbUpdates.drive_file_url = updates.driveFileUrl;
    if (updates.smsPhoneNumber !== undefined) dbUpdates.sms_phone_number = updates.smsPhoneNumber;
    if (updates.sold !== undefined) dbUpdates.sold = updates.sold;
    
    const { data, error } = await db
      .from('flight_recordings')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating flight recording:', error);
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
      exportStatus: data.export_status,
      driveFileId: data.drive_file_id,
      driveFileUrl: data.drive_file_url,
      smsPhoneNumber: data.sms_phone_number,
      sold: data.sold,
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
      staffMember: record.staff_member,
      flightDate: record.flight_date,
      flightTime: record.flight_time,
      exportStatus: record.export_status,
      driveFileId: record.drive_file_id,
      driveFileUrl: record.drive_file_url,
      smsPhoneNumber: record.sms_phone_number,
      sold: record.sold,
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
      staffMember: data.staff_member,
      flightDate: data.flight_date,
      flightTime: data.flight_time,
      exportStatus: data.export_status,
      driveFileId: data.drive_file_id,
      driveFileUrl: data.drive_file_url,
      smsPhoneNumber: data.sms_phone_number,
      sold: data.sold,
      createdAt: new Date(data.created_at)
    };
  }
}