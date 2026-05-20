import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@pagent-libs/docs-core': path.resolve(__dirname, '../../packages/docs-core/src'),
      '@pagent-libs/docs-react': path.resolve(__dirname, '../../packages/docs-react/src'),
      '@pagent-libs/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@pagent-libs/transport-websocket': path.resolve(__dirname, '../../packages/transport-websocket/src'),
    },
  },
  server: {
    port: 5176,
  },
});
