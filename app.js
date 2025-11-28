import { Request, Response } from 'express';
import { resolveFingerprint } from '../services/metadataCache';
import multer from 'multer';
import express from 'express';
import { identifyUploadRoute } from './controllers/identifyController';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

export const audioIdentifyUpload = upload.single('file');

export const identifyUploadHandler = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Audio file missing (multipart field "file").' });
    }
    console.log(`📡 Server-side fingerprint request: ${req.file.originalname}`);
    const metadata = await identifyUploadedAudio(req.file.buffer);
    return res.status(200).json({ success: true, data: metadata });
  } catch (err: any) {
    console.error('Server fingerprint error:', err.message);
    const status = err.message?.includes('fpcalc') ? 503 : 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Fingerprint processing failed.'
    });
  }
};

import { identifyUploadedAudio } from '../services/serverFingerprint';

/**
 * POST /api/identify
 * Body: { fingerprint: string, duration: number }
 */
export const identifyHandler = async (req: Request, res: Response) => {
  try {
    const { fingerprint, duration } = req.body;

    if (!fingerprint || typeof fingerprint !== 'string') {
      return res.status(400).json({ error: 'Invalid or missing fingerprint' });
    }

    if (!duration || typeof duration !== 'number') {
      return res.status(400).json({ error: 'Invalid or missing duration' });
    }

    console.log(`📡 Identification Request received. Duration: ${duration}s`);

    const metadata = await resolveFingerprint(fingerprint, duration);

    return res.status(200).json({
      success: true,
      data: metadata
    });

  } catch (err: any) {
    console.error("Identification Error:", err.message);

    // Handle specific known errors
    if (err.message === "Track not identified by AcoustID") {
        return res.status(404).json({ success: false, error: "Track not found in global database." });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Export a route handler for /api/identify/upload
export const identifyUploadRoute = [
  audioIdentifyUpload,
  identifyUploadHandler
];

const app = express();
app.post('/api/identify/upload', ...identifyUploadRoute);

export default app;