import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('Basic function test - starting');
  
  try {
    console.log('Basic function test - in try block');
    
    return res.status(200).json({ 
      message: 'Basic function works',
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Basic function error:', error);
    return res.status(500).json({ 
      error: 'Basic function failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}