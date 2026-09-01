import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const historicalProxy = env.VITE_HISTORICAL_RAIN_PROXY || 'https://chovendo-agora.netlify.app';
  const redemetApiKey = env.REDEMET_API_KEY || env.VITE_REDEMET_API_KEY;

  return {
    plugins: [react()],
    server: {
      proxy: {
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
        '/api/ocorrencias-abertas': {
          target: 'https://apisimaa.computei.srv.br',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ocorrencias-abertas/, ''),
        },
        '/api/ocorrencias-hexagon': {
          target: historicalProxy,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ocorrencias-hexagon/, '/.netlify/functions/ocorrencias-hexagon'),
        },
        '/api/historical-rain': {
          target: historicalProxy,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/historical-rain/, '/.netlify/functions/historical-rain'),
        },
        '/api/websempre-weather': {
          target: 'https://websempre.rio.rj.gov.br',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/websempre-weather/, '/json/dados_meteorologicos'),
        },
        '/api/redemet-wind': {
          target: 'https://api-redemet.decea.mil.br',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const url = new URL(req.url || '/', 'http://localhost');
              const icao = url.searchParams.get('icao');
              if (!icao || !redemetApiKey) return;

              const params = new URLSearchParams(url.searchParams);
              params.set('api_key', redemetApiKey);
              proxyReq.path = `/mensagens/metar/${icao.toUpperCase()}?${params.toString()}`;
            });
          },
        },
        '/api/wind-events-history': {
          target: historicalProxy,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/wind-events-history/, '/.netlify/functions/wind-events-history'),
        },
        '/api/inmet': {
          target: 'https://apitempo.inmet.gov.br',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/inmet/, ''),
        },
        '/api/v1/rain/historical': {
          target: historicalProxy,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/v1\/rain\/historical/, '/.netlify/functions/historical-rain'),
        },
        '/api/v1/rain': {
          target: historicalProxy,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/v1\/rain/, '/.netlify/functions/v1-rain'),
        },
        '/api/v1/wind': {
          target: historicalProxy,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/v1\/wind/, '/.netlify/functions/v1-wind'),
        },
        '/api/v1/radar': {
          target: historicalProxy,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/v1\/radar/, '/.netlify/functions/v1-radar'),
        },
        '/api/json/chuvas': {
          target: 'https://websempre.rio.rj.gov.br',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/json\/chuvas/, '/json/chuvas'),
        },
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
  };
});
