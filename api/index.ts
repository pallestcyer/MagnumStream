import type { VercelRequest, VercelResponse } from '@vercel/node';
import 'dotenv/config';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// Inline Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const localDeviceUrl = process.env.LOCAL_DEVICE_URL || 'http://localhost:5000';

let supabase: any = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Database operations (handled by Vercel)
class DatabaseStorage {
  async createFlightRecording(data: any) {
    const { data: result, error } = await (supabase as any)
      .from('flight_recordings')
      .insert({
        project_name: data.projectName,
        pilot_name: data.pilotName,
        pilot_email: data.pilotEmail,
        staff_member: data.staffMember,
        flight_date: data.flightDate,
        flight_time: data.flightTime,
        export_status: 'pending'
      })
      .select()
      .single();
      
    if (error) throw error;
    return result;
  }

  async getAllFlightRecordings() {
    const { data, error } = await (supabase as any)
      .from('flight_recordings')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return data?.map((record: any) => ({
      id: record.id,
      projectName: record.project_name,
      pilotName: record.pilot_name,
      pilotEmail: record.pilot_email,
      staffMember: record.staff_member,
      flightDate: record.flight_date,
      flightTime: record.flight_time,
      exportStatus: record.export_status,
      driveFileId: record.drive_file_id,
      driveFileUrl: record.drive_file_url,
      smsPhoneNumber: record.sms_phone_number,
      sold: record.sold,
      createdAt: new Date(record.created_at)
    })) || [];
  }

  async createSale(data: any) {
    const { data: result, error } = await (supabase as any)
      .from('sales')
      .insert({
        recording_id: data.recordingId,
        customer_name: data.customerName,
        customer_email: data.customerEmail,
        staff_member: data.staffMember,
        bundle: data.bundle,
        sale_amount: data.saleAmount
      })
      .select()
      .single();
      
    if (error) throw error;
    return result;
  }

  async getAllSales() {
    const { data, error } = await (supabase as any)
      .from('sales')
      .select('*')
      .order('sale_date', { ascending: false });
      
    if (error) throw error;
    return data?.map((sale: any) => ({
      id: sale.id,
      recordingId: sale.recording_id,
      customerName: sale.customer_name,
      customerEmail: sale.customer_email,
      staffMember: sale.staff_member,
      bundle: sale.bundle,
      saleAmount: sale.sale_amount,
      saleDate: new Date(sale.sale_date),
      driveShared: sale.drive_shared
    })) || [];
  }
}

// Video operations delegator (calls local device)
class VideoOperations {
  async delegateToLocal(endpoint: string, data?: any) {
    try {
      const response = await fetch(`${localDeviceUrl}/api${endpoint}`, {
        method: data ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined
      });
      
      if (!response.ok) {
        throw new Error(`Local device responded with ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to connect to local device:', error);
      throw new Error('Local device unavailable');
    }
  }
}

let app: express.Application | null = null;
const storage = new DatabaseStorage();
const videoOps = new VideoOperations();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!app) {
      app = express();
      app.use(express.json());
      
      // Database routes (handled by Vercel)
      app.get('/api/recordings', async (req, res) => {
        try {
          const recordings = await storage.getAllFlightRecordings();
          res.json(recordings);
        } catch (error) {
          res.status(500).json({ error: 'Failed to fetch recordings' });
        }
      });

      app.post('/api/recordings', async (req, res) => {
        try {
          const recording = await storage.createFlightRecording(req.body);
          res.json(recording);
        } catch (error) {
          res.status(500).json({ error: 'Failed to create recording' });
        }
      });

      app.get('/api/sales', async (req, res) => {
        try {
          const sales = await storage.getAllSales();
          res.json(sales);
        } catch (error) {
          res.status(500).json({ error: 'Failed to fetch sales' });
        }
      });

      app.post('/api/sales', async (req, res) => {
        try {
          const sale = await storage.createSale(req.body);
          res.json(sale);
        } catch (error) {
          res.status(500).json({ error: 'Failed to create sale' });
        }
      });

      // Video routes (delegated to local device)
      app.post('/api/clips/generate', async (req, res) => {
        try {
          const result = await videoOps.delegateToLocal('/clips/generate', req.body);
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      app.get('/api/clips/:recordingId', async (req, res) => {
        try {
          const result = await videoOps.delegateToLocal(`/clips/${req.params.recordingId}`);
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      app.post('/api/export/:recordingId', async (req, res) => {
        try {
          const result = await videoOps.delegateToLocal(`/export/${req.params.recordingId}`, req.body);
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      // Google Drive routes (delegated to local device)
      app.get('/api/google/auth', async (req, res) => {
        try {
          const result = await videoOps.delegateToLocal('/google/auth');
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      app.post('/api/google/upload', async (req, res) => {
        try {
          const result = await videoOps.delegateToLocal('/google/upload', req.body);
          res.json(result);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      // Health check
      app.get('/api/health', (req, res) => {
        res.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: {
            database: !!supabase,
            localDevice: localDeviceUrl
          }
        });
      });

      // Catch-all for client-side routing
      app.get('*', (req, res) => {
        res.json({
          message: 'MagnumStream API - Hybrid Architecture',
          timestamp: new Date().toISOString(),
          endpoints: {
            database: ['GET /api/recordings', 'POST /api/recordings', 'GET /api/sales', 'POST /api/sales'],
            video: ['POST /api/clips/generate', 'GET /api/clips/:id', 'POST /api/export/:id'],
            google: ['GET /api/google/auth', 'POST /api/google/upload'],
            health: ['GET /api/health']
          }
        });
      });
    }
    
    return app(req, res);
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}