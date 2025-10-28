import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import session from 'express-session';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeDatabase } from "./db";
import { initializeStorage, storage } from "./storage";

const app = express();

// CORS middleware for cross-origin requests from Vercel
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session configuration for Vercel
import { getVercelSessionConfig, jwtSessionMiddleware } from "./middleware/vercelSession";

// Use JWT-based sessions for Vercel compatibility
if (process.env.NODE_ENV === 'production') {
  app.use(jwtSessionMiddleware);
} else {
  // Use regular sessions for development
  app.use(session(getVercelSessionConfig()));
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize storage first and assign it to the storage variable
  Object.assign(storage, await initializeStorage());

  // Initialize database (SQLite only if not using Supabase)
  if (process.env.USE_SUPABASE !== 'true') {
    await initializeDatabase();
  } else {
    console.log('🔗 Using Supabase database - skipping SQLite initialization');
  }
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // For local device service, default to 3001 to match start-mac-service.sh
  // For production, use PORT env var or 5000
  const port = parseInt(process.env.PORT || '3001', 10);
  server.listen(port, () => {
    log(`serving on port ${port}`);
  });
})();
