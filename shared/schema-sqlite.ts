import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Flight recordings table
export const flightRecordings = sqliteTable("flight_recordings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
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
  localVideoPath: text("local_video_path"), // Local file path on Mac for direct playback
  thumbnailUrl: text("thumbnail_url"), // Thumbnail image path or URL
  smsPhoneNumber: text("sms_phone_number"),
  sold: integer("sold", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertFlightRecordingSchema = createInsertSchema(flightRecordings).omit({
  id: true,
  createdAt: true,
});

export type InsertFlightRecording = z.infer<typeof insertFlightRecordingSchema>;
export type FlightRecording = typeof flightRecordings.$inferSelect;

// Scene recordings table
export const sceneRecordings = sqliteTable("scene_recordings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  recordingId: text("recording_id").notNull(),
  sceneType: text("scene_type").notNull(),
  sceneIndex: integer("scene_index").notNull(),
  camera1Url: text("camera1_url"),
  camera2Url: text("camera2_url"),
  duration: real("duration").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertSceneRecordingSchema = createInsertSchema(sceneRecordings).omit({
  id: true,
  createdAt: true,
});

export type InsertSceneRecording = z.infer<typeof insertSceneRecordingSchema>;
export type SceneRecording = typeof sceneRecordings.$inferSelect;

// Generated clips table
export const generatedClips = sqliteTable("generated_clips", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  recordingId: text("recording_id").notNull(),
  sceneId: text("scene_id").notNull(),
  slotNumber: integer("slot_number").notNull(),
  filePath: text("file_path").notNull(),
  windowStart: real("window_start").notNull(),
  duration: real("duration").notNull().default(3.0),
  cameraAngle: integer("camera_angle").notNull(),
  sceneType: text("scene_type").notNull(),
  clipStatus: text("clip_status").notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertGeneratedClipSchema = createInsertSchema(generatedClips).omit({
  id: true,
  createdAt: true,
});

export type InsertGeneratedClip = z.infer<typeof insertGeneratedClipSchema>;
export type GeneratedClip = typeof generatedClips.$inferSelect;

// Video slots table
export const videoSlots = sqliteTable("video_slots", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  recordingId: text("recording_id").notNull(),
  slotNumber: integer("slot_number").notNull(),
  sceneId: text("scene_id").notNull(),
  cameraAngle: integer("camera_angle").notNull(),
  windowStart: real("window_start").notNull().default(0),
  slotDuration: real("slot_duration").notNull().default(3),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertVideoSlotSchema = createInsertSchema(videoSlots).omit({
  id: true,
  createdAt: true,
});

export type InsertVideoSlot = z.infer<typeof insertVideoSlotSchema>;
export type VideoSlot = typeof videoSlots.$inferSelect;

// Sales table
export const sales = sqliteTable("sales", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  recordingId: text("recording_id").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  staffMember: text("staff_member").notNull(),
  bundle: text("bundle").notNull(),
  saleAmount: real("sale_amount"),
  saleDate: text("sale_date").notNull().default(sql`CURRENT_TIMESTAMP`),
  driveShared: integer("drive_shared", { mode: "boolean" }).notNull().default(false),
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
  { value: 'photos_only', label: 'Photos Only', price: 19.99 },
] as const;

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