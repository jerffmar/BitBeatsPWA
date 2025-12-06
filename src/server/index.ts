import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Optional controller import (keep try/catch to avoid crash if missing)
let identifyHandler: any = (_req: express.Request, res: express.Response) => res.status(501).json({ error: 'identifyHandler not implemented' });
try {
  identifyHandler = (await import('../controllers/identifyController')).identifyHandler;
} catch (err) {
  console.warn('[server] identifyController not found, falling back to 501:', err);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// API routes
app.post('/api/identify', identifyHandler);
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Static frontend
const distPath = path.resolve(__dirname, '../../dist');
app.use(express.static(distPath));

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API not found' });
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});