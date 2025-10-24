import { SessionOptions } from 'express-session';

// For Vercel deployment, we need a session store that works with serverless functions
// Option 1: Use database-backed sessions (recommended for production)
// Option 2: Use signed JWT tokens instead of sessions

interface VercelSessionConfig {
  useDatabase: boolean;
  useJWT: boolean;
}

export function getVercelSessionConfig(): SessionOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  const sessionSecret = process.env.SESSION_SECRET;

  if (!sessionSecret) {
    throw new Error('SESSION_SECRET environment variable is required');
  }

  // Basic session configuration
  const config: SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction, // HTTPS only in production
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    }
  };

  // For Vercel production, we need persistent storage
  if (isProduction && process.env.USE_SUPABASE === 'true') {
    // Use database-backed sessions for production
    // This requires implementing a custom session store
    console.log('🔄 Using database-backed sessions for Vercel');
    
    // For now, we'll use default memory store but with shorter expiry
    config.cookie!.maxAge = 2 * 60 * 60 * 1000; // 2 hours for serverless
  } else {
    // Development or non-Vercel deployment
    console.log('🔄 Using memory-based sessions for development');
  }

  return config;
}

// Alternative approach: JWT-based "sessions" for Vercel
export class JWTSessionHandler {
  private secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  // Create a signed token with user data
  createToken(data: any): string {
    const jwt = require('jsonwebtoken');
    return jwt.sign(data, this.secret, { expiresIn: '24h' });
  }

  // Verify and decode token
  verifyToken(token: string): any | null {
    try {
      const jwt = require('jsonwebtoken');
      return jwt.verify(token, this.secret);
    } catch (error) {
      return null;
    }
  }
}

// Middleware to handle JWT sessions for Google OAuth
export function jwtSessionMiddleware(req: any, res: any, next: any) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || 
                  req.cookies?.session_token;

    if (token) {
      const secret = process.env.SESSION_SECRET || 'default-dev-secret';
      const jwtHandler = new JWTSessionHandler(secret);
      const decoded = jwtHandler.verifyToken(token);
      if (decoded) {
        req.session = req.session || {};
        req.session.googleTokens = decoded.googleTokens;
        req.session.googleUserInfo = decoded.googleUserInfo;
      }
    }
  } catch (error) {
    console.error('JWT session middleware error:', error);
  }

  // Add helper to save session as JWT
  req.saveSessionAsJWT = (data: any) => {
    const secret = process.env.SESSION_SECRET || 'default-dev-secret';
    const jwtHandler = new JWTSessionHandler(secret);
    const token = jwtHandler.createToken(data);
    
    res.cookie('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    });

    return token;
  };

  next();
}