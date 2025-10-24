-- MagnumStream Complete Supabase Database Schema
-- Generated for flight recording and video editing platform
-- Includes all tables for users, recordings, scenes, sales, and new scene editor functionality

-- Enable UUID extension for PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================================================
-- USERS TABLE
-- ===========================================================================
CREATE TABLE users (
    id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================================================
-- FLIGHT RECORDINGS TABLE (Main Projects)
-- ===========================================================================
CREATE TABLE flight_recordings (
    id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    sold BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for flight_recordings
CREATE INDEX idx_flight_recordings_created_at ON flight_recordings(created_at DESC);
CREATE INDEX idx_flight_recordings_export_status ON flight_recordings(export_status);
CREATE INDEX idx_flight_recordings_sold ON flight_recordings(sold);
CREATE INDEX idx_flight_recordings_pilot_name ON flight_recordings(pilot_name);

-- ===========================================================================
-- SALES TABLE
-- ===========================================================================
CREATE TABLE sales (
    id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4(),
    recording_id VARCHAR NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    staff_member TEXT NOT NULL,
    bundle TEXT NOT NULL, -- 'video_photos' | 'video_only' | 'video_airtour_photos'
    sale_amount DECIMAL(10,2),
    sale_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    drive_shared BOOLEAN NOT NULL DEFAULT false,
    
    -- Foreign key constraint
    CONSTRAINT fk_sales_recording_id 
        FOREIGN KEY (recording_id) 
        REFERENCES flight_recordings(id) 
        ON DELETE CASCADE
);

-- Indexes for sales
CREATE INDEX idx_sales_recording_id ON sales(recording_id);
CREATE INDEX idx_sales_sale_date ON sales(sale_date DESC);
CREATE INDEX idx_sales_staff_member ON sales(staff_member);
CREATE INDEX idx_sales_bundle ON sales(bundle);

-- ===========================================================================
-- SCENE RECORDINGS TABLE (3 scenes per project)
-- ===========================================================================
CREATE TABLE scene_recordings (
    id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4(),
    recording_id VARCHAR NOT NULL,
    scene_type TEXT NOT NULL, -- 'cruising' | 'chase' | 'arrival'
    scene_index INTEGER NOT NULL, -- 1, 2, 3
    camera1_url TEXT,
    camera2_url TEXT,
    camera1_source TEXT DEFAULT 'front', -- Auto-set device source for camera 1
    camera2_source TEXT DEFAULT 'rear',  -- Auto-set device source for camera 2
    duration DECIMAL(8,2) NOT NULL, -- Total duration of recording in seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_scene_recordings_recording_id 
        FOREIGN KEY (recording_id) 
        REFERENCES flight_recordings(id) 
        ON DELETE CASCADE,
    
    -- Ensure valid scene types
    CONSTRAINT chk_scene_type 
        CHECK (scene_type IN ('cruising', 'chase', 'arrival')),
    
    -- Ensure valid scene index
    CONSTRAINT chk_scene_index 
        CHECK (scene_index >= 1 AND scene_index <= 3),
        
    -- Unique constraint to prevent duplicate scene types per recording
    CONSTRAINT uk_scene_recordings_recording_scene 
        UNIQUE (recording_id, scene_type, scene_index)
);

-- Indexes for scene_recordings
CREATE INDEX idx_scene_recordings_recording_id ON scene_recordings(recording_id);
CREATE INDEX idx_scene_recordings_scene_type ON scene_recordings(scene_type);
CREATE INDEX idx_scene_recordings_created_at ON scene_recordings(created_at DESC);

-- ===========================================================================
-- SCENE SEGMENTS TABLE (New - for scene editor functionality)
-- ===========================================================================
CREATE TABLE scene_segments (
    id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4(),
    scene_id VARCHAR NOT NULL,
    segment_number INTEGER NOT NULL,
    start_time DECIMAL(8,2) NOT NULL, -- Start time in scene (0-30s typically)
    duration DECIMAL(8,2) NOT NULL,   -- 3s, 5s, or custom duration
    camera_angle INTEGER NOT NULL,   -- 1 or 2
    color TEXT NOT NULL DEFAULT '#FF6B35', -- Visual indicator color
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_scene_segments_scene_id 
        FOREIGN KEY (scene_id) 
        REFERENCES scene_recordings(id) 
        ON DELETE CASCADE,
    
    -- Ensure valid camera angles
    CONSTRAINT chk_camera_angle 
        CHECK (camera_angle IN (1, 2)),
    
    -- Ensure positive durations and start times
    CONSTRAINT chk_positive_start_time 
        CHECK (start_time >= 0),
    CONSTRAINT chk_positive_duration 
        CHECK (duration > 0),
    
    -- Unique constraint for segment numbers per scene
    CONSTRAINT uk_scene_segments_scene_segment 
        UNIQUE (scene_id, segment_number)
);

-- Indexes for scene_segments
CREATE INDEX idx_scene_segments_scene_id ON scene_segments(scene_id);
CREATE INDEX idx_scene_segments_segment_number ON scene_segments(segment_number);
CREATE INDEX idx_scene_segments_start_time ON scene_segments(start_time);

-- ===========================================================================
-- VIDEO SLOTS TABLE (8-slot template system)
-- ===========================================================================
CREATE TABLE video_slots (
    id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4(),
    recording_id VARCHAR NOT NULL,
    slot_number INTEGER NOT NULL, -- 1-8
    scene_id VARCHAR NOT NULL,
    camera_angle INTEGER NOT NULL, -- 1 or 2
    window_start DECIMAL(8,2) NOT NULL DEFAULT 0, -- Start time in seconds
    slot_duration DECIMAL(8,2) NOT NULL, -- Variable duration (was fixed 3s)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraints
    CONSTRAINT fk_video_slots_recording_id 
        FOREIGN KEY (recording_id) 
        REFERENCES flight_recordings(id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_video_slots_scene_id 
        FOREIGN KEY (scene_id) 
        REFERENCES scene_recordings(id) 
        ON DELETE CASCADE,
    
    -- Ensure valid slot numbers
    CONSTRAINT chk_slot_number 
        CHECK (slot_number >= 1 AND slot_number <= 8),
    
    -- Ensure valid camera angles
    CONSTRAINT chk_video_slots_camera_angle 
        CHECK (camera_angle IN (1, 2)),
    
    -- Ensure positive values
    CONSTRAINT chk_positive_window_start 
        CHECK (window_start >= 0),
    CONSTRAINT chk_positive_slot_duration 
        CHECK (slot_duration > 0),
    
    -- Unique constraint for slot numbers per recording
    CONSTRAINT uk_video_slots_recording_slot 
        UNIQUE (recording_id, slot_number)
);

-- Indexes for video_slots
CREATE INDEX idx_video_slots_recording_id ON video_slots(recording_id);
CREATE INDEX idx_video_slots_scene_id ON video_slots(scene_id);
CREATE INDEX idx_video_slots_slot_number ON video_slots(slot_number);

-- ===========================================================================
-- DEVICE CONFIGURATIONS TABLE (New - for camera source management)
-- ===========================================================================
CREATE TABLE device_configurations (
    id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    camera1_device_id TEXT NOT NULL,
    camera2_device_id TEXT NOT NULL,
    camera1_label TEXT NOT NULL DEFAULT 'Front Camera',
    camera2_label TEXT NOT NULL DEFAULT 'Rear Camera',
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure only one default configuration
CREATE UNIQUE INDEX idx_device_configurations_default 
    ON device_configurations(is_default) 
    WHERE is_default = true;

-- Insert default device configuration
INSERT INTO device_configurations (name, camera1_device_id, camera2_device_id, camera1_label, camera2_label, is_default)
VALUES ('Default Setup', 'front', 'rear', 'Front Camera', 'Rear Camera', true);

-- ===========================================================================
-- GENERATED CLIPS TABLE (New - for local file storage tracking)
-- ===========================================================================
CREATE TABLE generated_clips (
    id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4(),
    recording_id VARCHAR NOT NULL,
    scene_id VARCHAR NOT NULL,
    slot_number INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    window_start REAL NOT NULL,
    duration REAL NOT NULL DEFAULT 3.0,
    camera_angle INTEGER NOT NULL,
    scene_type TEXT NOT NULL,
    clip_status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraints
    CONSTRAINT fk_generated_clips_recording_id 
        FOREIGN KEY (recording_id) 
        REFERENCES flight_recordings(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_generated_clips_scene_id 
        FOREIGN KEY (scene_id) 
        REFERENCES scene_recordings(id) 
        ON DELETE CASCADE,
    
    -- Ensure valid scene types
    CONSTRAINT chk_scene_type 
        CHECK (scene_type IN ('cruising', 'chase', 'arrival')),
    
    -- Ensure valid camera angles
    CONSTRAINT chk_camera_angle 
        CHECK (camera_angle IN (1, 2)),
    
    -- Ensure valid clip status
    CONSTRAINT chk_clip_status 
        CHECK (clip_status IN ('pending', 'generated', 'exported')),
    
    -- Ensure valid slot numbers (1-8 for template)
    CONSTRAINT chk_slot_number 
        CHECK (slot_number >= 1 AND slot_number <= 8)
);

-- Indexes for generated_clips
CREATE INDEX idx_generated_clips_recording_id ON generated_clips(recording_id);
CREATE INDEX idx_generated_clips_scene_id ON generated_clips(scene_id);
CREATE INDEX idx_generated_clips_slot_number ON generated_clips(slot_number);
CREATE INDEX idx_generated_clips_status ON generated_clips(clip_status);
CREATE INDEX idx_generated_clips_created_at ON generated_clips(created_at DESC);

-- ===========================================================================
-- EXPORT JOBS TABLE (New - for tracking video export status)
-- ===========================================================================
CREATE TABLE export_jobs (
    id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4(),
    recording_id VARCHAR NOT NULL,
    job_type TEXT NOT NULL DEFAULT 'final_video', -- 'final_video' | 'scene_preview' | 'segment_export'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'completed' | 'failed'
    progress INTEGER DEFAULT 0, -- 0-100
    output_url TEXT,
    error_message TEXT,
    metadata JSONB, -- Store additional job-specific data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Foreign key constraint
    CONSTRAINT fk_export_jobs_recording_id 
        FOREIGN KEY (recording_id) 
        REFERENCES flight_recordings(id) 
        ON DELETE CASCADE,
    
    -- Ensure valid job types
    CONSTRAINT chk_job_type 
        CHECK (job_type IN ('final_video', 'scene_preview', 'segment_export')),
    
    -- Ensure valid status
    CONSTRAINT chk_export_status 
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    
    -- Ensure valid progress range
    CONSTRAINT chk_progress_range 
        CHECK (progress >= 0 AND progress <= 100)
);

-- Indexes for export_jobs
CREATE INDEX idx_export_jobs_recording_id ON export_jobs(recording_id);
CREATE INDEX idx_export_jobs_status ON export_jobs(status);
CREATE INDEX idx_export_jobs_created_at ON export_jobs(created_at DESC);
CREATE INDEX idx_export_jobs_job_type ON export_jobs(job_type);

-- ===========================================================================
-- USER SESSIONS TABLE (New - for authentication)
-- ===========================================================================
CREATE TABLE user_sessions (
    id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR NOT NULL,
    session_token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_user_sessions_user_id 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE
);

-- Indexes for user_sessions
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Clean up expired sessions automatically
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM user_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ===========================================================================
-- PROJECT TEMPLATES TABLE (New - for reusable slot configurations)
-- ===========================================================================
CREATE TABLE project_templates (
    id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    slot_configuration JSONB NOT NULL, -- Store the 8-slot template as JSON
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_by VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_project_templates_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL
);

-- Ensure only one default template
CREATE UNIQUE INDEX idx_project_templates_default 
    ON project_templates(is_default) 
    WHERE is_default = true;

-- Insert default project template
INSERT INTO project_templates (name, description, slot_configuration, is_default)
VALUES (
    'Standard Flight Video',
    'Default 8-slot configuration for flight videos',
    '[
        {"slotNumber": 1, "sceneType": "cruising", "cameraAngle": 1, "color": "#FF6B35"},
        {"slotNumber": 2, "sceneType": "cruising", "cameraAngle": 2, "color": "#F7931E"},
        {"slotNumber": 3, "sceneType": "cruising", "cameraAngle": 1, "color": "#FF8C42"},
        {"slotNumber": 4, "sceneType": "chase", "cameraAngle": 1, "color": "#FFA500"},
        {"slotNumber": 5, "sceneType": "chase", "cameraAngle": 2, "color": "#FF9E3D"},
        {"slotNumber": 6, "sceneType": "chase", "cameraAngle": 1, "color": "#FFB84D"},
        {"slotNumber": 7, "sceneType": "arrival", "cameraAngle": 1, "color": "#FF7A3D"},
        {"slotNumber": 8, "sceneType": "arrival", "cameraAngle": 2, "color": "#FFAB5E"}
    ]'::jsonb,
    true
);

-- ===========================================================================
-- AUDIT LOG TABLE (New - for tracking changes)
-- ===========================================================================
CREATE TABLE audit_logs (
    id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id VARCHAR NOT NULL,
    action TEXT NOT NULL, -- 'INSERT' | 'UPDATE' | 'DELETE'
    old_values JSONB,
    new_values JSONB,
    user_id VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_audit_logs_user_id 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL,
    
    -- Ensure valid actions
    CONSTRAINT chk_audit_action 
        CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'))
);

-- Indexes for audit_logs
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- ===========================================================================
-- STORAGE USAGE TABLE (New - for tracking video file storage)
-- ===========================================================================
CREATE TABLE storage_usage (
    id VARCHAR PRIMARY KEY DEFAULT uuid_generate_v4(),
    recording_id VARCHAR NOT NULL,
    file_type TEXT NOT NULL, -- 'scene_recording' | 'final_video' | 'thumbnail' | 'segment_cache'
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    storage_provider TEXT NOT NULL DEFAULT 'local', -- 'local' | 'gcs' | 's3' | 'drive'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_storage_usage_recording_id 
        FOREIGN KEY (recording_id) 
        REFERENCES flight_recordings(id) 
        ON DELETE CASCADE,
    
    -- Ensure valid file types
    CONSTRAINT chk_file_type 
        CHECK (file_type IN ('scene_recording', 'final_video', 'thumbnail', 'segment_cache')),
    
    -- Ensure positive file sizes
    CONSTRAINT chk_positive_file_size 
        CHECK (file_size_bytes > 0)
);

-- Indexes for storage_usage
CREATE INDEX idx_storage_usage_recording_id ON storage_usage(recording_id);
CREATE INDEX idx_storage_usage_file_type ON storage_usage(file_type);
CREATE INDEX idx_storage_usage_storage_provider ON storage_usage(storage_provider);
CREATE INDEX idx_storage_usage_created_at ON storage_usage(created_at DESC);

-- ===========================================================================
-- TRIGGERS AND FUNCTIONS
-- ===========================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger to device_configurations (column already exists in table definition)
CREATE TRIGGER trigger_device_configurations_updated_at 
    BEFORE UPDATE ON device_configurations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_values)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD));
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (table_name, record_id, action, new_values)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Add audit triggers to important tables
CREATE TRIGGER audit_flight_recordings 
    AFTER INSERT OR UPDATE OR DELETE ON flight_recordings 
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_scene_recordings 
    AFTER INSERT OR UPDATE OR DELETE ON scene_recordings 
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_scene_segments 
    AFTER INSERT OR UPDATE OR DELETE ON scene_segments 
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_video_slots 
    AFTER INSERT OR UPDATE OR DELETE ON video_slots 
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_sales 
    AFTER INSERT OR UPDATE OR DELETE ON sales 
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ===========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ===========================================================================

-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE flight_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Users can only see their own records
CREATE POLICY users_policy ON users
    FOR ALL USING (id = current_setting('app.current_user_id', true)::varchar);

-- Sessions policy
CREATE POLICY user_sessions_policy ON user_sessions
    FOR ALL USING (user_id = current_setting('app.current_user_id', true)::varchar);

-- Flight recordings policy (allow all for now, can be restricted later)
CREATE POLICY flight_recordings_policy ON flight_recordings
    FOR ALL USING (true);

-- Sales policy (allow all for now, can be restricted later)  
CREATE POLICY sales_policy ON sales
    FOR ALL USING (true);

-- ===========================================================================
-- VIEWS FOR COMMON QUERIES
-- ===========================================================================

-- View for complete recording data with scenes and sales
CREATE VIEW recording_summary AS
SELECT 
    fr.id,
    fr.project_name,
    fr.pilot_name,
    fr.pilot_email,
    fr.staff_member,
    fr.flight_date,
    fr.flight_time,
    fr.export_status,
    fr.sold,
    fr.created_at,
    
    -- Scene counts
    COUNT(DISTINCT sr.id) as scene_count,
    COUNT(DISTINCT vs.id) as slot_count,
    COUNT(DISTINCT seg.id) as segment_count,
    
    -- Sales info
    COUNT(DISTINCT s.id) as sale_count,
    COALESCE(SUM(s.sale_amount), 0) as total_sales,
    
    -- Storage info
    COALESCE(SUM(su.file_size_bytes), 0) as total_storage_bytes
    
FROM flight_recordings fr
LEFT JOIN scene_recordings sr ON fr.id = sr.recording_id
LEFT JOIN video_slots vs ON fr.id = vs.recording_id
LEFT JOIN scene_segments seg ON sr.id = seg.scene_id
LEFT JOIN sales s ON fr.id = s.recording_id
LEFT JOIN storage_usage su ON fr.id = su.recording_id

GROUP BY fr.id, fr.project_name, fr.pilot_name, fr.pilot_email, 
         fr.staff_member, fr.flight_date, fr.flight_time, 
         fr.export_status, fr.sold, fr.created_at;

-- View for scene details with segments
CREATE VIEW scene_details AS
SELECT 
    sr.id as scene_id,
    sr.recording_id,
    sr.scene_type,
    sr.scene_index,
    sr.camera1_url,
    sr.camera2_url,
    sr.camera1_source,
    sr.camera2_source,
    sr.duration as scene_duration,
    sr.created_at,
    
    -- Segment counts and duration
    COUNT(seg.id) as segment_count,
    COALESCE(SUM(seg.duration), 0) as total_segment_duration,
    MIN(seg.start_time) as earliest_segment_start,
    MAX(seg.start_time + seg.duration) as latest_segment_end
    
FROM scene_recordings sr
LEFT JOIN scene_segments seg ON sr.id = seg.scene_id
GROUP BY sr.id, sr.recording_id, sr.scene_type, sr.scene_index,
         sr.camera1_url, sr.camera2_url, sr.camera1_source, 
         sr.camera2_source, sr.duration, sr.created_at;

-- ===========================================================================
-- SAMPLE DATA (Optional - for development/testing)
-- ===========================================================================

-- Insert sample user
INSERT INTO users (username, password) 
VALUES ('admin', '$2b$10$sample_hashed_password_here');

-- Insert sample flight recording
INSERT INTO flight_recordings (project_name, pilot_name, pilot_email, staff_member)
VALUES ('Sample Flight Project', 'John Pilot', 'john@example.com', 'Jane Staff');

-- ===========================================================================
-- CLEANUP AND MAINTENANCE FUNCTIONS
-- ===========================================================================

-- Function to clean up old audit logs (keep only last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM audit_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Function to calculate storage usage by recording
CREATE OR REPLACE FUNCTION get_recording_storage_usage(recording_uuid VARCHAR)
RETURNS TABLE(
    total_bytes BIGINT,
    file_count INTEGER,
    by_type JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(file_size_bytes), 0) as total_bytes,
        COUNT(*)::INTEGER as file_count,
        COALESCE(
            jsonb_object_agg(
                file_type, 
                jsonb_build_object(
                    'count', type_count,
                    'total_bytes', type_bytes
                )
            ), 
            '{}'::jsonb
        ) as by_type
    FROM (
        SELECT 
            file_type,
            COUNT(*) as type_count,
            SUM(file_size_bytes) as type_bytes
        FROM storage_usage 
        WHERE recording_id = recording_uuid
        GROUP BY file_type
    ) type_summary;
END;
$$ LANGUAGE plpgsql;

-- ===========================================================================
-- FINAL INDEXES AND OPTIMIZATIONS
-- ===========================================================================

-- Composite indexes for common query patterns
CREATE INDEX idx_scene_recordings_recording_type ON scene_recordings(recording_id, scene_type);
CREATE INDEX idx_video_slots_scene_slot ON video_slots(scene_id, slot_number);
CREATE INDEX idx_scene_segments_scene_start ON scene_segments(scene_id, start_time);
CREATE INDEX idx_sales_date_staff ON sales(sale_date DESC, staff_member);

-- Partial indexes for specific use cases
CREATE INDEX idx_flight_recordings_unsold ON flight_recordings(created_at DESC) WHERE sold = false;
CREATE INDEX idx_export_jobs_active ON export_jobs(created_at DESC) WHERE status IN ('pending', 'processing');

-- ===========================================================================
-- COMMENTS FOR DOCUMENTATION
-- ===========================================================================

COMMENT ON TABLE flight_recordings IS 'Main project table for flight recording sessions';
COMMENT ON TABLE scene_recordings IS 'Individual scenes within a flight recording (cruising, chase, arrival)';
COMMENT ON TABLE scene_segments IS 'Configurable segments within scenes for the scene editor';
COMMENT ON TABLE video_slots IS 'Final 8-slot video template configuration';
COMMENT ON TABLE sales IS 'Customer sales and bundles for recordings';
COMMENT ON TABLE export_jobs IS 'Background job tracking for video exports';
COMMENT ON TABLE device_configurations IS 'Camera device setup configurations';
COMMENT ON TABLE project_templates IS 'Reusable slot configuration templates';
COMMENT ON TABLE storage_usage IS 'File storage tracking and usage analytics';
COMMENT ON TABLE audit_logs IS 'Change tracking and audit trail';

-- Schema version for migrations
CREATE TABLE schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO schema_version (version) VALUES (1);

-- Grant necessary permissions (adjust based on your Supabase setup)
-- These would typically be handled by Supabase's auth system
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;