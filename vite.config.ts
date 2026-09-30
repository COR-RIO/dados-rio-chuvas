import net from 'node:net';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const DEV_PORT = 5173;
const LOOPBACK_HOSTS = ['127.0.0.1', '::1'];

const isListening = (port: number, host: string) =>
  new Promise<boolean>((resolve) => {
    const socket = net.connect({ port, host });
    const done = (inUse: boolean) => {
      socket.destroy();
      resolve(inUse);
    };
    socket.setTimeout(500, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });

// No Windows, um servidor em `::` e outro em `0.0.0.0` não conflitam no bind, então o
// Vite não percebe a porta ocupada por outro projeto. Testa conexão em IPv4 e IPv6.
const findFreePort = async (start: number) => {
  for (let port = start; port < start + 50; port++) {
    const inUse = await Promise.all(LOOPBACK_HOSTS.map((host) => isListening(port, host)));
    if (!inUse.some(Boolean)) return port;
    console.warn(`Porta ${port} já está em uso, tentando a próxima...`);
  }
  throw new Error(`Nenhuma porta livre entre ${start} e ${start + 49}`);
};

export default defineConfig(async ({ mode, command, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devPort = command === 'serve' && !isPreview ? await findFreePort(DEV_PORT) : DEV_PORT;
  const historicalProxy = env.VITE_HISTORICAL_RAIN_PROXY || 'https://chovendo-agora.netlify.app';
  const redemetApiKey = env.REDEMET_API_KEY || env.VITE_REDEMET_API_KEY;

  return {
    plugins: [react()],
    server: {
      port: devPort,
      strictPort: true,
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
