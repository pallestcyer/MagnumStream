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
  getAllFlightRecordings(): Promise<FlightRecording[]>;
  
  createSale(sale: InsertSale): Promise<Sale>;
  getAllSales(): Promise<Sale[]>;
  getSalesByRecording(recordingId: string): Promise<Sale[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private flightRecordings: Map<string, FlightRecording>;
  private sales: Map<string, Sale>;

  constructor() {
    this.users = new Map();
    this.flightRecordings = new Map();
    this.sales = new Map();
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

  async getAllFlightRecordings(): Promise<FlightRecording[]> {
    return Array.from(this.flightRecordings.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createSale(sale: InsertSale): Promise<Sale> {
    const id = randomUUID();
    const newSale: Sale = {
      ...sale,
      id,
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
}

export const storage = new MemStorage();
