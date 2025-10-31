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
  pilotName: text("pilot_name").notNull(), // Customer names (e.g., "Emily & John")
  pilotEmail: text("pilot_email"),
  flightPilot: text("flight_pilot"), // Actual pilot who flew (optional)
  staffMember: text("staff_member"),
  flightDate: text("flight_date"),
  flightTime: text("flight_time"),
  exportStatus: text("export_status").notNull().default("pending"),
  driveFileId: text("drive_file_id"),
  driveFileUrl: text("drive_file_url"),
  driveFolderUrl: text("drive_folder_url"),
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
  bundle: text("bundle").notNull(), // 'video_photos' | 'video_only' | 'video_airtour_photos'
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

export const BUNDLE_OPTIONS = [
  { value: 'video_photos', label: 'Video + Photos', price: 49.99 },
  { value: 'video_only', label: 'Video Only', price: 39.99 },
  { value: 'video_airtour_photos', label: 'Video + Air Tour + Photos', price: 79.99 },
] as const;

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

// Scene configuration (defines the 5-slot template structure matching DaVinci template)
export interface SlotConfig {
  slotNumber: number;
  sceneType: 'cruising' | 'chase' | 'arrival';
  cameraAngle: 1 | 2;
  color: string;
  duration: number; // Duration in seconds for DaVinci template compatibility
}

export const SLOT_TEMPLATE: SlotConfig[] = [
  // Cruising Scene (2 slots) - matches DaVinci template positions 1-2
  { slotNumber: 1, sceneType: 'cruising', cameraAngle: 1, color: '#FF6B35', duration: 1.627 }, // Front view (39 frames @ 23.976fps)
  { slotNumber: 2, sceneType: 'cruising', cameraAngle: 2, color: '#F7931E', duration: 1.502 }, // Side view (36 frames @ 23.976fps)
  // Chase Scene (2 slots) - matches DaVinci template positions 3-4  
  { slotNumber: 3, sceneType: 'chase', cameraAngle: 2, color: '#FFA500', duration: 1.543 }, // Side view (37 frames @ 23.976fps)
  { slotNumber: 4, sceneType: 'chase', cameraAngle: 2, color: '#FF9E3D', duration: 2.503 }, // Side view (60 frames @ 23.976fps)
  // Arrival Scene (1 slot) - matches DaVinci template position 5
  { slotNumber: 5, sceneType: 'arrival', cameraAngle: 2, color: '#FF7A3D', duration: 2.002 }, // Side view (48 frames @ 23.976fps)
];

// Generated clips table for local file storage
export const generatedClips = pgTable("generated_clips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recordingId: varchar("recording_id").notNull(), // Links to flight_recordings
  sceneId: varchar("scene_id").notNull(), // Links to scene_recordings  
  slotNumber: integer("slot_number").notNull(), // 1-8
  filePath: text("file_path").notNull(), // Local file path
  windowStart: real("window_start").notNull(), // Start time in original scene
  duration: real("duration").notNull().default(3), // Clip duration
  cameraAngle: integer("camera_angle").notNull(), // 1 or 2
  sceneType: text("scene_type").notNull(), // 'cruising' | 'chase' | 'arrival'
  clipStatus: text("clip_status").notNull().default("pending"), // 'pending' | 'generated' | 'exported'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGeneratedClipSchema = createInsertSchema(generatedClips).omit({
  id: true,
  createdAt: true,
});

export type InsertGeneratedClip = z.infer<typeof insertGeneratedClipSchema>;
export type GeneratedClip = typeof generatedClips.$inferSelect;
