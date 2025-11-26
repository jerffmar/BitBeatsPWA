import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(async () => {
  // Try to import vite-plugin-static-copy; skip if not installed
  let staticCopyPlugin: any = null;
  try {
    const mod = await import('vite-plugin-static-copy');
    staticCopyPlugin = mod.viteStaticCopy({
      targets: [{ src: 'node_modules/fpcalc-browser/dist/fpcalc.wasm', dest: '.' }]
    });
  } catch {
    console.warn('vite-plugin-static-copy not found. Skipping WASM copy. Ensure fpcalc.wasm is served manually in production.');
  }

  return {
    plugins: [
      react(),
      // Conditionally include the static copy plugin
      ...(staticCopyPlugin ? [staticCopyPlugin] : [])
    ],
    base: '/',
    build: {
      outDir: 'dist',
      target: 'esnext', // Required for Top-level await and advanced Storage APIs
      sourcemap: false,
      rollupOptions: {
        external: [
          'fpcalc-browser',
          'music-metadata-browser' // externalize dynamic import to prevent Rollup resolution errors
        ]
      }
    },
    server: {
      host: true,
      // Optional: dev API proxy (kept if backend exists)
      // proxy: { '/api': { target: process.env.VITE_API_URL || 'http://localhost:8080', changeOrigin: true } }
    },
    // Specific config for WASM libraries like fpcalc-browser or chromaprint-js
    assetsInclude: ['**/*.wasm'],
    optimizeDeps: {
      exclude: ['fpcalc-browser'] // Prevent Vite from pre-bundling the WASM wrapper
    }
  };
});