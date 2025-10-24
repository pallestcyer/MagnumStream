import type { VercelRequest, VercelResponse } from '@vercel/node';
import 'dotenv/config';
import express from 'express';
import { createClient } from '@supabase/supabase-js';

// Inline Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: any = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Simple storage implementation for Vercel
class SimpleStorage {
  async testConnection() {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    // Test a simple query
    const { data, error } = await (supabase as any).from('users').select('count').limit(1);
    
    if (error) {
      throw new Error(`Supabase connection failed: ${error.message}`);
    }
    
    return { success: true, data };
  }
}

let app: express.Application | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('Self-contained function starting');
  
  try {
    console.log('Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      USE_SUPABASE: process.env.USE_SUPABASE,
      SUPABASE_URL: process.env.SUPABASE_URL ? 'present' : 'missing',
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'missing'
    });
    
    if (!app) {
      console.log('Creating Express app...');
      app = express();
      app.use(express.json());
      
      console.log('Testing storage connection...');
      try {
        const storage = new SimpleStorage();
        const result = await storage.testConnection();
        console.log('Storage connection successful:', result);
      } catch (storageError) {
        console.error('Storage connection failed:', storageError);
        return res.status(500).json({
          error: 'Storage connection failed',
          details: storageError instanceof Error ? storageError.message : 'Unknown error',
          stack: storageError instanceof Error ? storageError.stack : undefined
        });
      }
      
      // Add routes
      app.all('*', (req, res) => {
        res.json({
          message: 'Self-contained function works',
          method: req.method,
          url: req.url,
          environment: {
            NODE_ENV: process.env.NODE_ENV,
            USE_SUPABASE: process.env.USE_SUPABASE,
            hasSupabaseUrl: !!process.env.SUPABASE_URL,
            hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
          },
          timestamp: new Date().toISOString()
        });
      });
      
      console.log('Express app created successfully');
    }
    
    console.log(`Handling ${req.method} ${req.url}`);
    return app(req, res);
  } catch (error) {
    console.error('Function error:', error);
    return res.status(500).json({ 
      error: 'Function failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}