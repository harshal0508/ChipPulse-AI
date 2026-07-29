import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Three.js ecosystem — largest chunk, load separately
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
          // Charts library
          'recharts-vendor': ['recharts'],
          // Animation library
          'framer-vendor': ['framer-motion'],
          // React core + routing
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
