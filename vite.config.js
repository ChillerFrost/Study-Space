import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Forward /api/* to the Express server (server/index.js) so the browser never sees API keys.
    proxy: { '/api': 'http://localhost:3001' },
  },
});
