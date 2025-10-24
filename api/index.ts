import type { VercelRequest, VercelResponse } from '@vercel/node';
import 'dotenv/config';
import express from 'express';
import { initializeStorage } from '../server/storage';

let app: express.Application | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('Testing with storage - starting');
  
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
      
      console.log('Initializing storage...');
      await initializeStorage();
      console.log('Storage initialized successfully');
      
      // Add a simple route
      app.get('/', (req, res) => {
        res.json({
          message: 'Express + dotenv + storage function works',
          environment: {
            NODE_ENV: process.env.NODE_ENV,
            USE_SUPABASE: process.env.USE_SUPABASE,
            hasSupabaseUrl: !!process.env.SUPABASE_URL
          },
          timestamp: new Date().toISOString()
        });
      });
      
      console.log('Express app with storage created successfully');
    }
    
    console.log(`Handling ${req.method} ${req.url} with Express + storage`);
    return app(req, res);
  } catch (error) {
    console.error('Express + storage function error:', error);
    return res.status(500).json({ 
      error: 'Express + storage function failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}