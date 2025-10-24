import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';

let app: express.Application | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('Testing with Express - starting');
  
  try {
    if (!app) {
      console.log('Creating Express app...');
      app = express();
      app.use(express.json());
      
      // Add a simple route
      app.get('/', (req, res) => {
        res.json({
          message: 'Express function works',
          timestamp: new Date().toISOString()
        });
      });
      
      console.log('Express app created successfully');
    }
    
    console.log(`Handling ${req.method} ${req.url} with Express`);
    return app(req, res);
  } catch (error) {
    console.error('Express function error:', error);
    return res.status(500).json({ 
      error: 'Express function failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}