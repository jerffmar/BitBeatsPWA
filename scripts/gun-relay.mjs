import Gun from 'gun';
import 'gun/sea.js';
import 'gun/axe.js';
import http from 'http';

const PORT = process.env.PORT || 8765;
const HOST = process.env.HOST || '0.0.0.0';

// Serve the Gun endpoint at /gun (WebSocket + HTTP fallback)
const server = http.createServer(Gun.serve);
Gun({
  web: server,
  path: '/gun',
  radisk: true,
  file: 'data', // persistent storage on server disk
  axe: true
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 Gun relay running at http://${HOST}:${PORT}/gun`);
});
