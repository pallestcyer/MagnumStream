import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
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

export const flightRecordings = pgTable("flight_recordings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectName: text("project_name").notNull(),
  pilotName: text("pilot_name").notNull(),
  pilotEmail: text("pilot_email"),
  flightDate: text("flight_date"),
  flightTime: text("flight_time"),
  exportStatus: text("export_status").notNull().default("pending"),
  driveFileId: text("drive_file_id"),
  driveFileUrl: text("drive_file_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFlightRecordingSchema = createInsertSchema(flightRecordings).omit({
  id: true,
  createdAt: true,
});

export type InsertFlightRecording = z.infer<typeof insertFlightRecordingSchema>;
export type FlightRecording = typeof flightRecordings.$inferSelect;

export const clips = pgTable("clips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recordingId: varchar("recording_id").notNull(),
  phaseId: integer("phase_id").notNull(),
  phaseTitle: text("phase_title").notNull(),
  camera1Url: text("camera1_url"),
  camera2Url: text("camera2_url"),
  duration: integer("duration").notNull(),
  trimStart: integer("trim_start").notNull().default(0),
  trimEnd: integer("trim_end"),
  orderIndex: integer("order_index").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertClipSchema = createInsertSchema(clips).omit({
  id: true,
  createdAt: true,
});

export type InsertClip = z.infer<typeof insertClipSchema>;
export type Clip = typeof clips.$inferSelect;
