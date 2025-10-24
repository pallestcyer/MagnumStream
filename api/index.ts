import type { VercelRequest, VercelResponse } from '@vercel/node';
import 'dotenv/config';
import express from 'express';
import { registerRoutes } from '../server/routes';
import { initializeStorage } from '../server/storage';
import { jwtSessionMiddleware } from '../server/middleware/vercelSession';

let app: express.Application | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Initialize Express app once
    if (!app) {
      app = express();
      app.use(express.json());
      app.use(express.urlencoded({ extended: false }));
      
      // Use JWT sessions for Vercel
      app.use(jwtSessionMiddleware);
      
      // Initialize storage
      await initializeStorage();
      
      // Register routes
      await registerRoutes(app);
      
      // Error handler
      app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        res.status(status).json({ message });
      });
    }
    
    // Handle the request
    return app(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}