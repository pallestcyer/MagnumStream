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

// Scene configuration (defines the 14-slot template structure matching DaVinci template)
export interface SlotConfig {
  slotNumber: number;
  sceneType: 'cruising' | 'chase' | 'arrival';
  cameraAngle: 1 | 2;
  color: string;
  duration: number; // Duration in seconds for DaVinci template compatibility
  seamlessCut?: boolean; // True if this slot seamlessly transitions to the next
}

export const SLOT_TEMPLATE: SlotConfig[] = [
  // Cruising Scene (7 slots) - matches DaVinci template positions 1-7
  { slotNumber: 1, sceneType: 'cruising', cameraAngle: 2, color: '#FF6B35', duration: 0.876, seamlessCut: false }, // Front view (21 frames @ 23.976fps)
  { slotNumber: 2, sceneType: 'cruising', cameraAngle: 2, color: '#F7931E', duration: 1.210, seamlessCut: true },  // Front view (29 frames) → seamless to Slot 3
  { slotNumber: 3, sceneType: 'cruising', cameraAngle: 1, color: '#FFA500', duration: 1.293, seamlessCut: false }, // Side view (31 frames) - follows Slot 2
  { slotNumber: 4, sceneType: 'cruising', cameraAngle: 2, color: '#FF9E3D', duration: 0.959, seamlessCut: true },  // Front view (23 frames) → seamless to Slot 5
  { slotNumber: 5, sceneType: 'cruising', cameraAngle: 1, color: '#FF7A3D', duration: 1.502, seamlessCut: false }, // Side view (36 frames) - follows Slot 4
  { slotNumber: 6, sceneType: 'cruising', cameraAngle: 2, color: '#FF6B6B', duration: 0.667, seamlessCut: false }, // Front view (16 frames)
  { slotNumber: 7, sceneType: 'cruising', cameraAngle: 1, color: '#FFA07A', duration: 0.793, seamlessCut: false }, // Side view (19 frames)

  // Chase Scene (6 slots) - matches DaVinci template positions 8-13
  { slotNumber: 8,  sceneType: 'chase', cameraAngle: 2, color: '#FFB347', duration: 0.876, seamlessCut: true },  // Front view (21 frames) → seamless to Slot 9
  { slotNumber: 9,  sceneType: 'chase', cameraAngle: 1, color: '#FFCC00', duration: 1.418, seamlessCut: false }, // Side view (34 frames) - follows Slot 8
  { slotNumber: 10, sceneType: 'chase', cameraAngle: 2, color: '#FFD700', duration: 0.542, seamlessCut: false }, // Front view (13 frames)
  { slotNumber: 11, sceneType: 'chase', cameraAngle: 2, color: '#FFA500', duration: 1.460, seamlessCut: true },  // Front view (35 frames) → seamless to Slot 12
  { slotNumber: 12, sceneType: 'chase', cameraAngle: 1, color: '#FF8C00', duration: 1.543, seamlessCut: false }, // Side view (37 frames) - follows Slot 11
  { slotNumber: 13, sceneType: 'chase', cameraAngle: 1, color: '#FF7F50', duration: 0.542, seamlessCut: false }, // Side view (13 frames)

  // Arrival Scene (1 slot) - matches DaVinci template position 14
  { slotNumber: 14, sceneType: 'arrival', cameraAngle: 1, color: '#FF6347', duration: 3.212, seamlessCut: false }, // Side view (77 frames)
];

// Seamless cut pairs - slots that should auto-position to continue from previous slot
export const SEAMLESS_PAIRS = [
  { lead: 2, follow: 3 },   // Cruising: Front → Side
  { lead: 4, follow: 5 },   // Cruising: Front → Side
  { lead: 8, follow: 9 },   // Chase: Front → Side
  { lead: 11, follow: 12 }, // Chase: Front → Side
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
