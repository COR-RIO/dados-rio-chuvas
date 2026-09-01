/**
 * Express server para rodar as Netlify Functions localmente ou em VPS
 * Adapta o formato de requisição HTTP para o formato esperado pelas funções Netlify
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;
const projectRoot = path.resolve(__dirname, '../..');
const distPath = path.join(projectRoot, 'dist');
const functionsDir = path.join(projectRoot, 'netlify', 'functions');
const RIO_RAIN_API_URL = 'https://websempre.rio.rj.gov.br/json/chuvas';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Serve frontend estático
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Proxy da chuva oficial da Prefeitura do Rio, sem CORS e com cache curto
app.get('/api/json/chuvas', async (req, res) => {
  try {
    const upstream = await fetch(RIO_RAIN_API_URL, {
      headers: { Accept: 'application/json' },
    });

    if (!upstream.ok) {
      return res.status(503).json({ error: 'usage_exceeded', message: 'Fonte de chuva indisponível' });
    }

    const data = await upstream.json();
    res.set('Cache-Control', 'public, max-age=20, s-maxage=20');
    return res.json(data);
  } catch (error) {
    console.error('Proxy chuva falhou:', error);
    return res.status(503).json({ error: 'upstream_error', message: 'Falha ao consultar dados de chuva' });
  }
});

// Helper para converter Express Request para formato Netlify Event
function createNetlifyEvent(req) {
  return {
    httpMethod: req.method,
    path: req.path,
    queryStringParameters: req.query || null,
    headers: req.headers,
    body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
    isBase64Encoded: false,
  };
}

// Helper para converter response Netlify para Express Response
function sendNetlifyResponse(res, result) {
  const statusCode = result.statusCode || 200;
  const headers = result.headers || {};
  const body = result.body;

  Object.entries(headers).forEach(([key, value]) => {
    res.header(key, value);
  });

  if (result.isBase64Encoded) {
    res.status(statusCode).send(Buffer.from(body, 'base64'));
  } else {
    res.status(statusCode).send(body);
  }
}

// Dinamicamente carrega e registra as funções Netlify
// Map de funções carregadas
const functions = {};

// Carrega todas as funções .js (exceto testes)
if (fs.existsSync(functionsDir)) {
  fs.readdirSync(functionsDir)
    .filter(file => file.endsWith('.js') && !file.startsWith('__'))
    .forEach(file => {
      try {
        const functionName = file.replace('.js', '');
        const functionPath = path.join(functionsDir, file);
        
        // Clear require cache e carrega a função
        delete require.cache[require.resolve(functionPath)];
        const func = require(functionPath);
        functions[functionName] = func.handler;
        
        console.log(`✓ Função carregada: ${functionName}`);
      } catch (error) {
        console.error(`✗ Erro ao carregar ${file}:`, error.message);
      }
    });
}

// Registra rotas para cada função
Object.entries(functions).forEach(([name, handler]) => {
  const route = `/api/${name}`;
  
  app.get(route, async (req, res) => {
    try {
      const event = createNetlifyEvent(req);
      const result = await handler(event);
      sendNetlifyResponse(res, result);
    } catch (error) {
      console.error(`Erro em ${route}:`, error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  });

  app.post(route, async (req, res) => {
    try {
      const event = createNetlifyEvent(req);
      const result = await handler(event);
      sendNetlifyResponse(res, result);
    } catch (error) {
      console.error(`Erro em ${route}:`, error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  });
});

// Agendador para funções cron (ex: wind-events-sync a cada 15 min)
if (functions['wind-events-sync']) {
  // Roda a cada 15 minutos
  cron.schedule('*/15 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Executando wind-events-sync...`);
    try {
      const event = {
        httpMethod: 'GET',
        path: '/.netlify/functions/wind-events-sync',
        headers: {},
      };
      await functions['wind-events-sync'](event);
      console.log(`[${new Date().toISOString()}] wind-events-sync completado com sucesso`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Erro em wind-events-sync:`, error.message);
    }
  });
  console.log('✓ Agendador wind-events-sync ativado (a cada 15 minutos)');
}

// SPA fallback - rota catch-all para servir index.html
app.get(/^(?!\/api).*/, (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

// Inicia servidor
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║     Dados Rio Chuvas - Server (VPS Ready)        ║
╠══════════════════════════════════════════════════╣
║  PORT:          ${PORT}                               
║  ENV:           ${process.env.NODE_ENV || 'development'}
║  Frontend:      http://localhost:${PORT}
║  API:           http://localhost:${PORT}/api/*
║  Health:        http://localhost:${PORT}/health
╚══════════════════════════════════════════════════╝
  `);
  console.log(`\nFunções carregadas: ${Object.keys(functions).length}`);
  console.log(`Rotas disponíveis:`);
  Object.keys(functions).forEach(name => {
    console.log(`  GET/POST /api/${name}`);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\nRecebido SIGTERM, encerrando gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nRecebido SIGINT, encerrando gracefully...');
  process.exit(0);
});
