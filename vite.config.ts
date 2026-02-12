import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // GCP: em dev, proxy para a function no Netlify (caminho direto evita HTML)
      '/api/historical-rain': {
        target: process.env.VITE_HISTORICAL_RAIN_PROXY || 'https://chovendo-agora.netlify.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/historical-rain/, '/.netlify/functions/historical-rain'),
      },
      // API de chuvas em tempo real
      '/api': {
        target: 'https://websempre.rio.rj.gov.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
