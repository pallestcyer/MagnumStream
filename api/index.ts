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
      
      console.log('Testing shared schema import...');
      try {
        const schema = await import('../shared/schema');
        console.log('Schema import successful, available exports:', Object.keys(schema));
      } catch (importError) {
        console.error('Schema import failed:', importError);
        return res.status(500).json({
          error: 'Schema import failed',
          details: importError instanceof Error ? importError.message : 'Unknown error',
          stack: importError instanceof Error ? importError.stack : undefined
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