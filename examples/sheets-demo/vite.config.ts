import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@weavertime/spindle-sheets-core': path.resolve(__dirname, '../../packages/sheets-core/src'),
      '@weavertime/spindle-sheets-react': path.resolve(__dirname, '../../packages/sheets-react/src'),
      '@weavertime/spindle-shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@weavertime/spindle-transport-websocket': path.resolve(__dirname, '../../packages/transport-websocket/src'),
    },
  },
  server: {
    port: 5175,
  },
});
