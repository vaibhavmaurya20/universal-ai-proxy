import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import winston from 'winston';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { setupRoutes } from './api/routes.js';
import { SessionManager } from './sessions/session-manager.js';
import { AuthManager } from './auth/auth-manager.js';
import { ProxyAdapter } from './adapters/proxy-adapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.colorize({ all: true })
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests from this IP'
});

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(limiter);
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

const sessionManager = new SessionManager(logger);
const authManager = new AuthManager(logger);
const proxyAdapter = new ProxyAdapter(logger, sessionManager);

app.use((req, res, next) => {
  req.sessionManager = sessionManager;
  req.authManager = authManager;
  req.proxyAdapter = proxyAdapter;
  req.logger = logger;
  next();
});

setupRoutes(app, wss);

wss.on('connection', (ws, req) => {
  logger.info('WebSocket connection established');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      await handleWebSocketMessage(ws, data, req);
    } catch (error) {
      logger.error('WebSocket message error:', error);
      ws.send(JSON.stringify({ error: error.message }));
    }
  });
  
  ws.on('close', () => {
    logger.info('WebSocket connection closed');
  });
});

async function handleWebSocketMessage(ws, data, req) {
  const { type, payload } = data;
  
  switch (type) {
    case 'chat':
      await handleChatStream(ws, payload, req);
      break;
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;
    default:
      ws.send(JSON.stringify({ error: 'Unknown message type' }));
  }
}

async function handleChatStream(ws, payload, req) {
  const { messages, platform, model } = payload;
  
  try {
    const stream = await req.proxyAdapter.createChatCompletion({
      messages,
      platform,
      model,
      stream: true
    });
    
    for await (const chunk of stream) {
      ws.send(JSON.stringify({
        type: 'chunk',
        data: chunk
      }));
    }
    
    ws.send(JSON.stringify({ type: 'done' }));
  } catch (error) {
    req.logger.error('Stream error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      error: error.message
    }));
  }
}

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

server.listen(PORT, HOST, () => {
  logger.info(`🚀 Universal AI Proxy Server running on http://${HOST}:${PORT}`);
  logger.info(`📖 API Docs: http://${HOST}:${PORT}/api/docs`);
  logger.info(`🔐 Auth Callback: http://${HOST}:${PORT}/api/auth/callback`);
});

export { sessionManager, authManager, proxyAdapter, logger };
