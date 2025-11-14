export interface Database {
  public: {
    Tables: {
      flight_recordings: {
        Row: {
          id: string;
          project_name: string;
          pilot_name: string;
          pilot_email: string | null;
          staff_member: string | null;
          flight_date: string | null;
          flight_time: string | null;
          export_status: string;
          drive_file_id: string | null;
          drive_file_url: string | null;
          sms_phone_number: string | null;
          sold: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_name: string;
          pilot_name: string;
          pilot_email?: string | null;
          staff_member?: string | null;
          flight_date?: string | null;
          flight_time?: string | null;
          export_status?: string;
          drive_file_id?: string | null;
          drive_file_url?: string | null;
          sms_phone_number?: string | null;
          sold?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_name?: string;
          pilot_name?: string;
          pilot_email?: string | null;
          staff_member?: string | null;
          flight_date?: string | null;
          flight_time?: string | null;
          export_status?: string;
          drive_file_id?: string | null;
          drive_file_url?: string | null;
          sms_phone_number?: string | null;
          sold?: boolean;
          created_at?: string;
        };
      };
      scene_recordings: {
        Row: {
          id: string;
          recording_id: string;
          scene_type: string;
          scene_index: number;
          camera1_url: string | null;
          camera2_url: string | null;
          camera1_source: string;
          camera2_source: string;
          duration: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          recording_id: string;
          scene_type: string;
          scene_index: number;
          camera1_url?: string | null;
          camera2_url?: string | null;
          camera1_source?: string;
          camera2_source?: string;
          duration: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          recording_id?: string;
          scene_type?: string;
          scene_index?: number;
          camera1_url?: string | null;
          camera2_url?: string | null;
          camera1_source?: string;
          camera2_source?: string;
          duration?: number;
          created_at?: string;
        };
      };
      video_slots: {
        Row: {
          id: string;
          recording_id: string;
          slot_number: number;
          scene_id: string;
          camera_angle: number;
          window_start: number;
          slot_duration: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          recording_id: string;
          slot_number: number;
          scene_id: string;
          camera_angle: number;
          window_start?: number;
          slot_duration: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          recording_id?: string;
          slot_number?: number;
          scene_id?: string;
          camera_angle?: number;
          window_start?: number;
          slot_duration?: number;
          created_at?: string;
        };
      };
      sales: {
        Row: {
          id: string;
          recording_id: string;
          customer_name: string;
          customer_email: string;
          staff_member: string;
          bundle: string;
          sale_amount: number | null;
          sale_date: string;
          drive_shared: boolean;
        };
        Insert: {
          id?: string;
          recording_id: string;
          customer_name: string;
          customer_email: string;
          staff_member: string;
          bundle: string;
          sale_amount?: number | null;
          sale_date?: string;
          drive_shared?: boolean;
        };
        Update: {
          id?: string;
          recording_id?: string;
          customer_name?: string;
          customer_email?: string;
          staff_member?: string;
          bundle?: string;
          sale_amount?: number | null;
          sale_date?: string;
          drive_shared?: boolean;
        };
      };
      issues: {
        Row: {
          id: string;
          staff_name: string;
          issue_type: 'camera' | 'recording' | 'editing' | 'export' | 'performance' | 'ui' | 'other';
          priority: 'low' | 'medium' | 'high' | 'critical' | null;
          description: string;
          status: 'open' | 'in_progress' | 'resolved' | 'closed';
          created_at: string;
          updated_at: string;
          resolved_at: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          staff_name: string;
          issue_type: 'camera' | 'recording' | 'editing' | 'export' | 'performance' | 'ui' | 'other';
          priority?: 'low' | 'medium' | 'high' | 'critical' | null;
          description: string;
          status?: 'open' | 'in_progress' | 'resolved' | 'closed';
          created_at?: string;
          updated_at?: string;
          resolved_at?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          staff_name?: string;
          issue_type?: 'camera' | 'recording' | 'editing' | 'export' | 'performance' | 'ui' | 'other';
          priority?: 'low' | 'medium' | 'high' | 'critical' | null;
          description?: string;
          status?: 'open' | 'in_progress' | 'resolved' | 'closed';
          created_at?: string;
          updated_at?: string;
          resolved_at?: string | null;
          notes?: string | null;
        };
      };
    };
  };
}