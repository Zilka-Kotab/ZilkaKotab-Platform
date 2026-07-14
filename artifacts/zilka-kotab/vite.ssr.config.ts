// Vite config for SSR bundle — no PORT/BASE_PATH env requirements.
import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(import.meta.dirname, '..', '..', 'attached_assets'),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/server'),
    emptyOutDir: true,
    ssr: 'src/entry-server.tsx',
    rollupOptions: {
      output: { format: 'esm' },
    },
  },
  // In SSR mode tell Vite to keep asset imports as URLs
  ssr: {
    noExternal: [],
  },
});
