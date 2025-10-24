import type { VercelRequest, VercelResponse } from '@vercel/node';
import 'dotenv/config';
import express, { type Express } from 'express';
import { registerRoutes } from '../server/routes';
import { initializeStorage } from '../server/storage';
import { jwtSessionMiddleware } from '../server/middleware/vercelSession';

let app: Express | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Log environment info for debugging
    console.log('Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      USE_SUPABASE: process.env.USE_SUPABASE,
      SUPABASE_URL: process.env.SUPABASE_URL ? 'present' : 'missing',
      PORT: process.env.PORT
    });
    
    // Initialize Express app once
    if (!app) {
      console.log('Initializing Express app...');
      app = express();
      app.use(express.json());
      app.use(express.urlencoded({ extended: false }));
      
      console.log('Setting up JWT sessions...');
      // Use JWT sessions for Vercel
      app.use(jwtSessionMiddleware);
      
      console.log('Initializing storage...');
      // Initialize storage
      await initializeStorage();
      
      console.log('Registering routes...');
      // Register routes
      await registerRoutes(app);
      
      console.log('Setting up error handler...');
      // Error handler
      app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        console.error('Express error handler:', err);
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        res.status(status).json({ message });
      });
      
      console.log('Express app initialization complete');
    }
    
    // Handle the request
    console.log(`Handling ${req.method} ${req.url}`);
    return app(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}