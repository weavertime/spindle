import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@pagent-libs/sheets-core': path.resolve(__dirname, '../../packages/sheets-core/src'),
      '@pagent-libs/sheets-react': path.resolve(__dirname, '../../packages/sheets-react/src'),
      '@pagent-libs/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  server: {
    port: 5175,
  },
});
