import type { Request, Response } from 'express';

export const identifyHandler = async (req: Request, res: Response) => {
  // Placeholder: echo input for now
  res.json({
    ok: true,
    message: 'identifyHandler stub',
    received: req.body || null
  });
};
