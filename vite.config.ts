import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Copy WASM to dist root so dynamic import('fpcalc-browser') can find it
    viteStaticCopy({
      targets: [
        { src: 'node_modules/fpcalc-browser/dist/fpcalc.wasm', dest: '.' }
      ]
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
    // Ensure correct MIME for wasm (usually handled by Vite, kept here for safety)
    // Vite serves .wasm as application/wasm; no extra config typically needed.
  },
  // Specific config for WASM libraries like fpcalc-browser or chromaprint-js
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['fpcalc-browser'] // Prevent Vite from pre-bundling the WASM wrapper
  }
});