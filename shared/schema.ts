import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Main flight recording project
export const flightRecordings = pgTable("flight_recordings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectName: text("project_name").notNull(),
  pilotName: text("pilot_name").notNull(),
  pilotEmail: text("pilot_email"),
  staffMember: text("staff_member"),
  flightDate: text("flight_date"),
  flightTime: text("flight_time"),
  exportStatus: text("export_status").notNull().default("pending"),
  driveFileId: text("drive_file_id"),
  driveFileUrl: text("drive_file_url"),
  smsPhoneNumber: text("sms_phone_number"),
  sold: boolean("sold").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFlightRecordingSchema = createInsertSchema(flightRecordings).omit({
  id: true,
  createdAt: true,
});

export type InsertFlightRecording = z.infer<typeof insertFlightRecordingSchema>;
export type FlightRecording = typeof flightRecordings.$inferSelect;

// Sales tracking
export const sales = pgTable("sales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recordingId: varchar("recording_id").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  staffMember: text("staff_member").notNull(),
  saleAmount: real("sale_amount"),
  saleDate: timestamp("sale_date").notNull().defaultNow(),
  driveShared: boolean("drive_shared").notNull().default(false),
});

export const insertSaleSchema = createInsertSchema(sales).omit({
  id: true,
  saleDate: true,
});

export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof sales.$inferSelect;

// Scene recordings (3 scenes per project)
export const sceneRecordings = pgTable("scene_recordings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recordingId: varchar("recording_id").notNull(),
  sceneType: text("scene_type").notNull(), // 'cruising' | 'chase' | 'arrival'
  sceneIndex: integer("scene_index").notNull(), // 1, 2, 3
  camera1Url: text("camera1_url"),
  camera2Url: text("camera2_url"),
  duration: real("duration").notNull(), // Total duration of recording in seconds
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSceneRecordingSchema = createInsertSchema(sceneRecordings).omit({
  id: true,
  createdAt: true,
});

export type InsertSceneRecording = z.infer<typeof insertSceneRecordingSchema>;
export type SceneRecording = typeof sceneRecordings.$inferSelect;

// 8 Slot selections (how scenes map into final video)
export const videoSlots = pgTable("video_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recordingId: varchar("recording_id").notNull(),
  slotNumber: integer("slot_number").notNull(), // 1-8
  sceneId: varchar("scene_id").notNull(),
  cameraAngle: integer("camera_angle").notNull(), // 1 or 2
  windowStart: real("window_start").notNull().default(0), // Start time in seconds for 3-second window
  slotDuration: real("slot_duration").notNull().default(3), // Always 3 seconds
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertVideoSlotSchema = createInsertSchema(videoSlots).omit({
  id: true,
  createdAt: true,
});

export type InsertVideoSlot = z.infer<typeof insertVideoSlotSchema>;
export type VideoSlot = typeof videoSlots.$inferSelect;

// Scene configuration (defines the 8-slot template structure)
export interface SlotConfig {
  slotNumber: number;
  sceneType: 'cruising' | 'chase' | 'arrival';
  cameraAngle: 1 | 2;
  color: string;
}

export const SLOT_TEMPLATE: SlotConfig[] = [
  // Cruising Scene (3 slots)
  { slotNumber: 1, sceneType: 'cruising', cameraAngle: 1, color: '#FF6B35' }, // Vibrant Orange
  { slotNumber: 2, sceneType: 'cruising', cameraAngle: 2, color: '#F7931E' }, // Bright Orange
  { slotNumber: 3, sceneType: 'cruising', cameraAngle: 1, color: '#FF8C42' }, // Light Orange
  // Chase Scene (3 slots)
  { slotNumber: 4, sceneType: 'chase', cameraAngle: 1, color: '#FFA500' }, // Classic Orange
  { slotNumber: 5, sceneType: 'chase', cameraAngle: 2, color: '#FF9E3D' }, // Amber Orange
  { slotNumber: 6, sceneType: 'chase', cameraAngle: 1, color: '#FFB84D' }, // Soft Orange
  // Arrival Scene (2 slots)
  { slotNumber: 7, sceneType: 'arrival', cameraAngle: 1, color: '#FF7A3D' }, // Medium Orange
  { slotNumber: 8, sceneType: 'arrival', cameraAngle: 2, color: '#FFAB5E' }, // Warm Orange
];
