import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Copy fpcalc.wasm to the server root so fpcalc-browser can fetch "/fpcalc.wasm"
    viteStaticCopy({
      targets: [{ src: 'node_modules/fpcalc-browser/dist/fpcalc.wasm', dest: '.' }]
    })
  ],
  base: '/',
  build: {
    outDir: 'dist',
    target: 'esnext', // Required for Top-level await and advanced Storage APIs
    sourcemap: false,
    rollupOptions: {
      external: ['fpcalc-browser']
    }
  },
  server: {
    host: true,
    // Proxy API calls to backend during dev
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8080',
        changeOrigin: true
      }
    }
  },
  // Specific config for WASM libraries like fpcalc-browser or chromaprint-js
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['fpcalc-browser'] // Prevent Vite from pre-bundling the WASM wrapper
  }
});