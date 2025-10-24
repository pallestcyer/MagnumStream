import type { VercelRequest, VercelResponse } from '@vercel/node';
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

// Import our routes and setup
import { registerRoutes } from '../server/routes';
import { initializeStorage } from '../server/storage';
import { getVercelSessionConfig } from '../server/middleware/vercelSession';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let app: express.Application | null = null;

async function createApp() {
  if (app) return app;

  app = express();
  
  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  
  // Session middleware
  app.use(session(getVercelSessionConfig()));
  
  // Initialize storage
  await initializeStorage();
  
  // Register routes
  await registerRoutes(app);
  
  // Serve static files from the built client
  const staticPath = path.join(__dirname, '..', 'dist', 'public');
  app.use(express.static(staticPath));
  
  // Fallback to index.html for SPA routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
  
  return app;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const expressApp = await createApp();
    return expressApp(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}