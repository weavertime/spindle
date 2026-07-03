import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Small React SPA for spindle.weavertime.com, deployed to Cloudflare Pages.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
