import type { VercelRequest, VercelResponse } from '@vercel/node';
import 'dotenv/config';
import express from 'express';

// Simple type definitions for testing
interface User {
  id: string;
  username: string;
  password: string;
}

interface FlightRecording {
  id: string;
  projectName: string;
  pilotName: string;
  pilotEmail?: string;
  staffMember?: string;
  flightDate?: string;
  flightTime?: string;
  exportStatus: string;
  driveFileId?: string;
  driveFileUrl?: string;
  smsPhoneNumber?: string;
  sold: boolean;
  createdAt: Date;
}

let app: express.Application | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('Testing storage imports - starting');
  
  try {
    console.log('Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      USE_SUPABASE: process.env.USE_SUPABASE,
      SUPABASE_URL: process.env.SUPABASE_URL ? 'present' : 'missing',
      PORT: process.env.PORT
    });
    
    if (!app) {
      console.log('Creating Express app...');
      app = express();
      app.use(express.json());
      
      console.log('Testing storage initialization...');
      try {
        const { initializeStorage } = await import('../server/storage');
        console.log('Storage import successful');
        
        const storage = await initializeStorage();
        console.log('Storage initialized successfully');
      } catch (storageError) {
        console.error('Storage initialization failed:', storageError);
        return res.status(500).json({
          error: 'Storage initialization failed',
          details: storageError instanceof Error ? storageError.message : 'Unknown error',
          stack: storageError instanceof Error ? storageError.stack : undefined
        });
      }
      
      // Add a simple route for all methods and paths
      app.all('*', (req, res) => {
        res.json({
          message: 'Import tests passed',
          method: req.method,
          url: req.url,
          environment: {
            NODE_ENV: process.env.NODE_ENV,
            USE_SUPABASE: process.env.USE_SUPABASE,
            hasSupabaseUrl: !!process.env.SUPABASE_URL
          },
          timestamp: new Date().toISOString()
        });
      });
      
      console.log('Express app with import tests created successfully');
    }
    
    console.log(`Handling ${req.method} ${req.url} with import tests`);
    return app(req, res);
  } catch (error) {
    console.error('Import test function error:', error);
    return res.status(500).json({ 
      error: 'Import test function failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}