
import { Request, Response } from 'express';
import { resolveFingerprint } from '../services/metadataCache';

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
