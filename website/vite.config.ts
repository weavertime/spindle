import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Small React SPA for spindle.weavertime.com, deployed to Cloudflare Pages.
export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      // Slides isn't published to npm yet — resolve it from local source so the
      // live demo builds in the monorepo. (Published packages resolve normally.)
      '@weavertime/spindle-slides-core': path.resolve(__dirname, '../packages/slides-core/src'),
      '@weavertime/spindle-slides-react': path.resolve(__dirname, '../packages/slides-react/src'),
    },
  },
  server: {
    // Docs content lives in the repo-root `documentation/` folder, one level
    // above this Vite root — allow the dev server to read it.
    fs: { allow: ['..'] },
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
