import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  root: '.', // or 'public' if your index.html is in /public
  plugins: [
    react(),
    nodePolyfills(),
  ],
  define: {
    global: 'globalThis',
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'vendor-react';
            if (id.includes('webtorrent')) return 'vendor-webtorrent';
            return 'vendor';
          }
        },
      },
    },
  },
});
