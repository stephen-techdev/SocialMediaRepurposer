import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { aiProxy } from './server/aiProxy';

// https://vitejs.dev/config/
export default defineConfig({
  // Only VITE_-prefixed vars reach the browser. Every other key in .env stays
  // on the server and is read by server/aiProxy.ts at request time.
  envPrefix: ['VITE_'],
  plugins: [react(), aiProxy()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
