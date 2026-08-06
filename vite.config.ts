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
      // Vento (REDEMET) em dev: proxy para a function no Netlify (esconde a API key)
      '/api/redemet-wind': {
        target: process.env.VITE_HISTORICAL_RAIN_PROXY || 'https://chovendo-agora.netlify.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/redemet-wind/, '/.netlify/functions/redemet-wind'),
      },
      // INMET (estações automáticas) – API pública, só evita CORS em dev
      '/api/inmet': {
        target: 'https://apitempo.inmet.gov.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/inmet/, ''),
      },
      // API pública v1 (uso por outros projetos) em dev: proxy para as functions no Netlify.
      // Ordem importa: rotas mais específicas antes das mais genéricas.
      '/api/v1/rain/historical': {
        target: process.env.VITE_HISTORICAL_RAIN_PROXY || 'https://chovendo-agora.netlify.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/v1\/rain\/historical/, '/.netlify/functions/historical-rain'),
      },
      '/api/v1/rain': {
        target: process.env.VITE_HISTORICAL_RAIN_PROXY || 'https://chovendo-agora.netlify.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/v1\/rain/, '/.netlify/functions/v1-rain'),
      },
      '/api/v1/wind': {
        target: process.env.VITE_HISTORICAL_RAIN_PROXY || 'https://chovendo-agora.netlify.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/v1\/wind/, '/.netlify/functions/v1-wind'),
      },
      '/api/v1/radar': {
        target: process.env.VITE_HISTORICAL_RAIN_PROXY || 'https://chovendo-agora.netlify.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/v1\/radar/, '/.netlify/functions/v1-radar'),
      },
      // Chuva em tempo real: proxy pra function no Netlify (cache curto de 20s na borda —
      // ver netlify/functions/rain-realtime.js). Rota específica antes do catch-all /api abaixo.
      '/api/json/chuvas': {
        target: process.env.VITE_HISTORICAL_RAIN_PROXY || 'https://chovendo-agora.netlify.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/json\/chuvas/, '/.netlify/functions/rain-realtime'),
      },
      // Fallback genérico (outras rotas /api/* não mapeadas acima)
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
