const express = require('express');
const multer = require('multer');
const WebTorrent = require('webtorrent');
const cors = require('cors');
const app = express();
const upload = multer({ dest: 'uploads/' });
const client = new WebTorrent();

app.use(cors());

let seeds = [];

app.post('/api/seeding/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ success: false, error: 'No file uploaded' });

  client.seed(file.path, torrent => {
    const seedInfo = {
      id: torrent.infoHash,
      magnet: torrent.magnetURI,
      torrentId: torrent.infoHash,
      seeders: torrent.numPeers,
      leechers: 0,
      fileSize: torrent.length,
      expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000, // 90 days
      title: file.originalname,
      artist: req.body.artist || '',
      coverUrl: req.body.coverUrl || ''
    };
    seeds.push(seedInfo);
    res.json(seedInfo);
  });
});

app.get('/api/seeding/list', (req, res) => {
  // Remove expired seeds
  seeds = seeds.filter(seed => seed.expiresAt > Date.now());
  res.json(seeds);
});

app.listen(3001, () => console.log('Server running on port 3001'));
