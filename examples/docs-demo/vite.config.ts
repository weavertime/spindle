import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@weavertime/docs-core': path.resolve(__dirname, '../../packages/docs-core/src'),
      '@weavertime/docs-react': path.resolve(__dirname, '../../packages/docs-react/src'),
      '@weavertime/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@weavertime/transport-websocket': path.resolve(__dirname, '../../packages/transport-websocket/src'),
    },
  },
  server: {
    port: 5176,
  },
});
