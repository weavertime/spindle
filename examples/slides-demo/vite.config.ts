import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@weavertime/spindle-slides-core': path.resolve(__dirname, '../../packages/slides-core/src'),
      '@weavertime/spindle-slides-react': path.resolve(__dirname, '../../packages/slides-react/src'),
      '@weavertime/spindle-shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@weavertime/spindle-transport-websocket': path.resolve(__dirname, '../../packages/transport-websocket/src'),
    },
  },
  server: {
    port: 5176,
  },
});
