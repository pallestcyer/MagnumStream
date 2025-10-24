import { 
  type User, 
  type InsertUser, 
  type FlightRecording, 
  type InsertFlightRecording,
  type Sale,
  type InsertSale
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createFlightRecording(recording: InsertFlightRecording): Promise<FlightRecording>;
  getFlightRecording(id: string): Promise<FlightRecording | undefined>;
  updateFlightRecording(id: string, updates: Partial<FlightRecording>): Promise<FlightRecording | undefined>;
  deleteFlightRecording?(id: string): Promise<boolean>;
  getAllFlightRecordings(): Promise<FlightRecording[]>;
  findRecordingBySessionId?(sessionId: string): Promise<FlightRecording | undefined>;
  
  createSale(sale: InsertSale): Promise<Sale>;
  getAllSales(): Promise<Sale[]>;
  getSalesByRecording(recordingId: string): Promise<Sale[]>;
  
  // Video slots methods
  createVideoSlot?(slotData: {
    recordingId: string;
    slotNumber: number;
    sceneId: string;
    cameraAngle: number;
    windowStart: number;
    slotDuration: number;
  }): Promise<any>;
  getVideoSlotsByRecordingId?(recordingId: string): Promise<any[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private flightRecordings: Map<string, FlightRecording>;
  private sales: Map<string, Sale>;
  private videoSlots: Map<string, any[]>; // Map recordingId -> slots

  constructor() {
    this.users = new Map();
    this.flightRecordings = new Map();
    this.sales = new Map();
    this.videoSlots = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createFlightRecording(recording: InsertFlightRecording): Promise<FlightRecording> {
    const id = randomUUID();
    const flightRecording: FlightRecording = {
      pilotEmail: null,
      staffMember: null,
      flightDate: null,
      flightTime: null,
      exportStatus: "pending",
      driveFileId: null,
      driveFileUrl: null,
      smsPhoneNumber: null,
      sold: false,
      ...recording,
      id,
      createdAt: new Date(),
    };
    this.flightRecordings.set(id, flightRecording);
    return flightRecording;
  }

  async getFlightRecording(id: string): Promise<FlightRecording | undefined> {
    return this.flightRecordings.get(id);
  }

  async updateFlightRecording(id: string, updates: Partial<FlightRecording>): Promise<FlightRecording | undefined> {
    const recording = this.flightRecordings.get(id);
    if (!recording) return undefined;
    
    const updated = { ...recording, ...updates };
    this.flightRecordings.set(id, updated);
    return updated;
  }

  async deleteFlightRecording(id: string): Promise<boolean> {
    return this.flightRecordings.delete(id);
  }

  async getAllFlightRecordings(): Promise<FlightRecording[]> {
    return Array.from(this.flightRecordings.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findRecordingBySessionId(sessionId: string): Promise<FlightRecording | undefined> {
    // Convert sessionId back to pilot name format for lookup
    const pilotName = sessionId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    return Array.from(this.flightRecordings.values())
      .filter(recording => recording.pilotName === pilotName)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  }

  async createSale(sale: InsertSale): Promise<Sale> {
    const id = randomUUID();
    const newSale: Sale = {
      ...sale,
      id,
      saleAmount: sale.saleAmount ?? null,
      saleDate: new Date(),
      driveShared: false,
    };
    this.sales.set(id, newSale);
    
    // Mark recording as sold
    await this.updateFlightRecording(sale.recordingId, { sold: true });
    
    return newSale;
  }

  async getAllSales(): Promise<Sale[]> {
    return Array.from(this.sales.values())
      .sort((a, b) => b.saleDate.getTime() - a.saleDate.getTime());
  }

  async getSalesByRecording(recordingId: string): Promise<Sale[]> {
    return Array.from(this.sales.values())
      .filter(sale => sale.recordingId === recordingId);
  }

  async createVideoSlot(slotData: {
    recordingId: string;
    slotNumber: number;
    sceneId: string;
    cameraAngle: number;
    windowStart: number;
    slotDuration: number;
  }): Promise<any> {
    const slot = {
      id: randomUUID(),
      recording_id: slotData.recordingId,
      slot_number: slotData.slotNumber,
      scene_id: slotData.sceneId,
      camera_angle: slotData.cameraAngle,
      window_start: slotData.windowStart,
      slot_duration: slotData.slotDuration,
      created_at: new Date().toISOString()
    };

    // Get existing slots for this recording
    const existingSlots = this.videoSlots.get(slotData.recordingId) || [];
    
    // Remove any existing slot with the same slot number
    const updatedSlots = existingSlots.filter(s => s.slot_number !== slotData.slotNumber);
    
    // Add the new slot
    updatedSlots.push(slot);
    
    // Store updated slots
    this.videoSlots.set(slotData.recordingId, updatedSlots);
    
    return slot;
  }

  async getVideoSlotsByRecordingId(recordingId: string): Promise<any[]> {
    return this.videoSlots.get(recordingId) || [];
  }
}

// Initialize storage based on environment
async function initializeStorage(): Promise<IStorage> {
  if (process.env.USE_SUPABASE === 'true') {
    // Use Supabase storage
    try {
      const { SupabaseStorage } = await import('./db/supabase-storage');
      console.log('🔗 Using Supabase database');
      return new SupabaseStorage();
    } catch (error) {
      console.error('❌ Failed to initialize Supabase storage:', error);
      console.log('💾 Falling back to in-memory storage');
      return new MemStorage();
    }
  } else {
    // Use in-memory storage (SQLite will be handled separately)
    console.log('💾 Using in-memory storage');
    return new MemStorage();
  }
}

// Create a storage instance - this will be initialized async
let storage: IStorage = new MemStorage(); // Temporary default

// Function to get the initialized storage
async function getStorage(): Promise<IStorage> {
  if (!storage || storage instanceof MemStorage) {
    storage = await initializeStorage();
  }
  return storage;
}

export { storage, initializeStorage, getStorage };
