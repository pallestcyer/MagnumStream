import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import fs from 'fs';

// Create database file in project root
const dbPath = path.join(process.cwd(), 'projects.db');

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create SQLite connection
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL'); // Better performance for concurrent access

// Create Drizzle instance
export const db = drizzle(sqlite);

// Initialize database with tables
export async function initializeDatabase() {
  try {
    console.log('🗄️  Initializing SQLite database...');
    
    // Create tables manually since we don't have migrations yet
    sqlite.exec(`
      -- Flight recordings table
      CREATE TABLE IF NOT EXISTS flight_recordings (
        id TEXT PRIMARY KEY,
        project_name TEXT NOT NULL,
        pilot_name TEXT NOT NULL,
        pilot_email TEXT,
        staff_member TEXT,
        flight_date TEXT,
        flight_time TEXT,
        export_status TEXT NOT NULL DEFAULT 'pending',
        drive_file_id TEXT,
        drive_file_url TEXT,
        sms_phone_number TEXT,
        sold INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Scene recordings table
      CREATE TABLE IF NOT EXISTS scene_recordings (
        id TEXT PRIMARY KEY,
        recording_id TEXT NOT NULL,
        scene_type TEXT NOT NULL,
        scene_index INTEGER NOT NULL,
        camera1_url TEXT,
        camera2_url TEXT,
        duration REAL NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (recording_id) REFERENCES flight_recordings(id) ON DELETE CASCADE
      );

      -- Generated clips table
      CREATE TABLE IF NOT EXISTS generated_clips (
        id TEXT PRIMARY KEY,
        recording_id TEXT NOT NULL,
        scene_id TEXT NOT NULL,
        slot_number INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        window_start REAL NOT NULL,
        duration REAL NOT NULL DEFAULT 3.0,
        camera_angle INTEGER NOT NULL,
        scene_type TEXT NOT NULL,
        clip_status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (recording_id) REFERENCES flight_recordings(id) ON DELETE CASCADE,
        FOREIGN KEY (scene_id) REFERENCES scene_recordings(id) ON DELETE CASCADE,
        CHECK (scene_type IN ('cruising', 'chase', 'arrival')),
        CHECK (camera_angle IN (1, 2)),
        CHECK (clip_status IN ('pending', 'generated', 'exported')),
        CHECK (slot_number >= 1 AND slot_number <= 8)
      );

      -- Video slots table
      CREATE TABLE IF NOT EXISTS video_slots (
        id TEXT PRIMARY KEY,
        recording_id TEXT NOT NULL,
        slot_number INTEGER NOT NULL,
        scene_id TEXT NOT NULL,
        camera_angle INTEGER NOT NULL,
        window_start REAL NOT NULL DEFAULT 0,
        slot_duration REAL NOT NULL DEFAULT 3,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (recording_id) REFERENCES flight_recordings(id) ON DELETE CASCADE,
        FOREIGN KEY (scene_id) REFERENCES scene_recordings(id) ON DELETE CASCADE
      );

      -- Sales table
      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        recording_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        staff_member TEXT NOT NULL,
        bundle TEXT NOT NULL,
        sale_amount REAL,
        sale_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        drive_shared INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (recording_id) REFERENCES flight_recordings(id)
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_flight_recordings_created_at ON flight_recordings(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_flight_recordings_export_status ON flight_recordings(export_status);
      CREATE INDEX IF NOT EXISTS idx_scene_recordings_recording_id ON scene_recordings(recording_id);
      CREATE INDEX IF NOT EXISTS idx_generated_clips_recording_id ON generated_clips(recording_id);
      CREATE INDEX IF NOT EXISTS idx_generated_clips_scene_id ON generated_clips(scene_id);
      CREATE INDEX IF NOT EXISTS idx_generated_clips_slot_number ON generated_clips(slot_number);
      CREATE INDEX IF NOT EXISTS idx_sales_recording_id ON sales(recording_id);
    `);

    // Insert sample data for testing
    const existingRecordings = sqlite.prepare('SELECT COUNT(*) as count FROM flight_recordings').get() as { count: number };
    
    if (existingRecordings.count === 0) {
      console.log('🎯 Adding sample flight recordings...');
      
      const insertRecording = sqlite.prepare(`
        INSERT INTO flight_recordings (id, project_name, pilot_name, pilot_email, staff_member, flight_date, flight_time, export_status, drive_file_url, sms_phone_number, sold)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      insertRecording.run(
        'sample-1',
        'Sunset Flight Tour',
        'John & Sarah',
        'john@example.com',
        'Alex Johnson',
        '2025-10-18',
        '18:00',
        'completed',
        'https://drive.google.com/file/d/sample1/view',
        '+1 555-1234',
        0
      );
      
      insertRecording.run(
        'sample-2',
        'Mountain Adventure',
        'Emily',
        'emily@example.com',
        'Maria Garcia',
        '2025-10-19',
        '14:30',
        'completed',
        'https://drive.google.com/file/d/sample2/view',
        null,
        0
      );
      
      insertRecording.run(
        'sample-3',
        'Coastal Tour',
        'Mike & Lisa',
        'mike@example.com',
        'Alex Johnson',
        '2025-10-20',
        '10:00',
        'completed',
        'https://drive.google.com/file/d/sample3/view',
        null,
        0
      );
      
      console.log('✅ Sample data added to SQLite');
    }

    console.log('✅ SQLite database initialized successfully');
    console.log(`📁 Database location: ${dbPath}`);
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🔄 Closing database connection...');
  sqlite.close();
  process.exit(0);
});

export { sqlite };