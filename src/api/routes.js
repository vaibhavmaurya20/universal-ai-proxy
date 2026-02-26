import express from 'express';
import { v4 as uuidv4 } from 'uuid';

export function setupRoutes(app, wss) {
  app.get('/', (req, res) => {
    res.json({
      message: 'Universal AI Proxy API',
      version: '1.0.0',
      endpoints: [
        'POST /v1/chat/completions',
        'GET /v1/models',
        'POST /v1/auth/login',
        'GET /v1/auth/callback',
        'GET /api/docs'
      ],
      platforms: ['chatgpt', 'grok', 'claude', 'kimi', 'deepseek', 'gemini']
    });
  });

  app.get('/api/docs', (req, res) => {
    res.json({
      openapi: '3.0.0',
      info: {
        title: 'Universal AI Proxy API',
        version: '1.0.0',
        description: 'OpenAI-compatible API for multiple AI platforms'
      },
      paths: {
        '/v1/chat/completions': {
          post: {
            summary: 'Create chat completion',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      messages: {
                        type: 'array',
                        description: 'Chat messages'
                      },
                      model: {
                        type: 'string',
                        description: 'Model name (e.g., claude-3-5-sonnet)'
                      },
                      platform: {
                        type: 'string',
                        enum: ['chatgpt', 'grok', 'claude', 'kimi', 'deepseek', 'gemini'],
                        description: 'AI platform'
                      },
                      stream: {
                        type: 'boolean',
                        description: 'Enable streaming'
                      }
                    }
                  }
                }
              }
            }
          }
        },
        '/v1/models': {
          get: {
            summary: 'List available models'
          }
        }
      }
    });
  });

  app.post('/v1/chat/completions', async (req, res) => {
    try {
      const { messages, model, platform, stream } = req.body;
      const auth = req.headers.authorization;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array required' });
      }

      if (!platform) {
        return res.status(400).json({ 
          error: 'platform required',
          available: ['chatgpt', 'grok', 'claude', 'kimi', 'deepseek', 'gemini']
        });
      }

      const validPlatforms = ['chatgpt', 'grok', 'claude', 'kimi', 'deepseek', 'gemini'];
      if (!validPlatforms.includes(platform)) {
        return res.status(400).json({ 
          error: 'Invalid platform',
          available: validPlatforms
        });
      }

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const streamId = uuidv4();
        const stream = await req.proxyAdapter.createChatCompletion({
          messages,
          platform,
          model,
          stream: true
        });

        let accumulatedContent = '';
        for await (const chunk of stream) {
          if (chunk.choices && chunk.choices[0]) {
            const delta = chunk.choices[0].delta?.content || '';
            accumulatedContent += delta;
          }
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }

        res.write('data: [DONE]\n\n');
        res.end();

      } else {
        const result = await req.proxyAdapter.createChatCompletion({
          messages,
          platform,
          model
        });

        res.json(result);
      }

    } catch (error) {
      req.logger.error('Chat completion error:', error);
      
      if (stream) {
        res.write(`data: {"error": "${error.message}"}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  app.get('/v1/models', (req, res) => {
    res.json({
      object: 'list',
      data: [
        {
          id: 'claude-3-5-sonnet-20241022',
          object: 'model',
          created: Date.now(),
          owned_by: 'anthropic'
        },
        {
          id: 'gpt-4o',
          object: 'model',
          created: Date.now(),
          owned_by: 'openai'
        },
        {
          id: 'grok-2',
          object: 'model',
          created: Date.now(),
          owned_by: 'xai'
        },
        {
          id: 'kimi-k2',
          object: 'model',
          created: Date.now(),
          owned_by: 'moonshot'
        },
        {
          id: 'deepseek-chat',
          object: 'model',
          created: Date.now(),
          owned_by: 'deepseek'
        },
        {
          id: 'gemini-1.5-pro',
          object: 'model',
          created: Date.now(),
          owned_by: 'google'
        }
      ]
    });
  });

  app.get('/v1/platforms', (req, res) => {
    res.json({
      platforms: [
        {
          id: 'chatgpt',
          name: 'ChatGPT',
          domain: 'chatgpt.com',
          auth_type: 'google'
        },
        {
          id: 'grok',
          name: 'Grok',
          domain: 'grok.com',
          auth_type: 'google'
        },
        {
          id: 'claude',
          name: 'Claude',
          domain: 'claude.ai',
          auth_type: 'google'
        },
        {
          id: 'kimi',
          name: 'Kimi',
          domain: 'kimi.com',
          auth_type: 'google'
        },
        {
          id: 'deepseek',
          name: 'DeepSeek',
          domain: 'deepseek.com',
          auth_type: 'email'
        },
        {
          id: 'gemini',
          name: 'Gemini',
          domain: 'gemini.google.com',
          auth_type: 'google'
        }
      ]
    });
  });

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      platforms: {
        chatgpt: true,
        grok: true,
        claude: true,
        kimi: true,
        deepseek: true,
        gemini: true
      }
    });
  });
}
