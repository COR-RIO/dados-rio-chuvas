import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Nominatim (geocoding) – evita CORS; User-Agent obrigatório para evitar 429
      '/api/nominatim': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nominatim/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'DadosRioChuvas/1.0 (https://github.com)');
          });
        },
      },
      // Ocorrências abertas (Simaa) – tempo real, sem login
      '/api/ocorrencias-abertas': {
        target: 'https://apisimaa.computei.srv.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ocorrencias-abertas/, ''),
      },
      // API de ocorrências (Hexagon) – evita CORS em dev; path mais específico que /api
      '/api/ocorrencias': {
        target: 'http://35.199.126.236:8085',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ocorrencias/, '/api'),
      },
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
