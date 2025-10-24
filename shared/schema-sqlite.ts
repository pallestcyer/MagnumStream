import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Flight recordings table
export const flightRecordings = sqliteTable("flight_recordings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
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
  { value: 'video_airtour_photos', label: 'Video + Air Tour + Photos', price: 79.99 },
] as const;

// Scene configuration (defines the 8-slot template structure)
export interface SlotConfig {
  slotNumber: number;
  sceneType: 'cruising' | 'chase' | 'arrival';
  cameraAngle: 1 | 2;
  color: string;
}

export const SLOT_TEMPLATE: SlotConfig[] = [
  // Cruising Scene (3 slots)
  { slotNumber: 1, sceneType: 'cruising', cameraAngle: 1, color: '#FF6B35' },
  { slotNumber: 2, sceneType: 'cruising', cameraAngle: 2, color: '#F7931E' },
  { slotNumber: 3, sceneType: 'cruising', cameraAngle: 1, color: '#FF8C42' },
  // Chase Scene (3 slots)
  { slotNumber: 4, sceneType: 'chase', cameraAngle: 1, color: '#FFA500' },
  { slotNumber: 5, sceneType: 'chase', cameraAngle: 2, color: '#FF9E3D' },
  { slotNumber: 6, sceneType: 'chase', cameraAngle: 1, color: '#FFB84D' },
  // Arrival Scene (2 slots)
  { slotNumber: 7, sceneType: 'arrival', cameraAngle: 1, color: '#FF7A3D' },
  { slotNumber: 8, sceneType: 'arrival', cameraAngle: 2, color: '#FFAB5E' },
];