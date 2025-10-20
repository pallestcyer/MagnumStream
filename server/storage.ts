import { 
  type User, 
  type InsertUser, 
  type FlightRecording, 
  type InsertFlightRecording,
  type Clip,
  type InsertClip 
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createFlightRecording(recording: InsertFlightRecording): Promise<FlightRecording>;
  getFlightRecording(id: string): Promise<FlightRecording | undefined>;
  updateFlightRecording(id: string, updates: Partial<FlightRecording>): Promise<FlightRecording | undefined>;
  getAllFlightRecordings(): Promise<FlightRecording[]>;
  
  createClip(clip: InsertClip): Promise<Clip>;
  getClipsByRecordingId(recordingId: string): Promise<Clip[]>;
  updateClip(id: string, updates: Partial<Clip>): Promise<Clip | undefined>;
  deleteClip(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private flightRecordings: Map<string, FlightRecording>;
  private clips: Map<string, Clip>;

  constructor() {
    this.users = new Map();
    this.flightRecordings = new Map();
    this.clips = new Map();
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
      flightDate: null,
      flightTime: null,
      exportStatus: "pending",
      driveFileId: null,
      driveFileUrl: null,
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

  async getAllFlightRecordings(): Promise<FlightRecording[]> {
    return Array.from(this.flightRecordings.values());
  }

  async createClip(clip: InsertClip): Promise<Clip> {
    const id = randomUUID();
    const newClip: Clip = {
      camera1Url: null,
      camera2Url: null,
      trimStart: 0,
      trimEnd: null,
      ...clip,
      id,
      createdAt: new Date(),
    };
    this.clips.set(id, newClip);
    return newClip;
  }

  async getClipsByRecordingId(recordingId: string): Promise<Clip[]> {
    return Array.from(this.clips.values())
      .filter(clip => clip.recordingId === recordingId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  async updateClip(id: string, updates: Partial<Clip>): Promise<Clip | undefined> {
    const clip = this.clips.get(id);
    if (!clip) return undefined;
    
    const updated = { ...clip, ...updates };
    this.clips.set(id, updated);
    return updated;
  }

  async deleteClip(id: string): Promise<boolean> {
    return this.clips.delete(id);
  }
}

export const storage = new MemStorage();
