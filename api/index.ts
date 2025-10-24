import type { VercelRequest, VercelResponse } from '@vercel/node';
import 'dotenv/config';
import express from 'express';

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
      
      console.log('Testing Supabase import...');
      try {
        const { supabase } = await import('../server/db/supabase');
        console.log('Supabase import successful');
      } catch (importError) {
        console.error('Supabase import failed:', importError);
        throw importError;
      }
      
      console.log('Testing shared schema import...');
      try {
        const schema = await import('../shared/schema');
        console.log('Schema import successful, available exports:', Object.keys(schema));
      } catch (importError) {
        console.error('Schema import failed:', importError);
        throw importError;
      }
      
      // Add a simple route
      app.get('/', (req, res) => {
        res.json({
          message: 'Import tests passed',
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