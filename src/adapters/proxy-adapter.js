export class ProxyAdapter {
  constructor(logger, sessionManager) {
    this.logger = logger;
    this.sessionManager = sessionManager;
    this.platforms = new Map();
    this.initializeAdapters();
  }

  async initializeAdapters() {
    const platforms = [
      { id: 'chatgpt', name: 'ChatGPT', domain: 'chatgpt.com', auth: 'google', enabled: true },
      { id: 'grok', name: 'Grok', domain: 'grok.com', auth: 'google', enabled: true },
      { id: 'claude', name: 'Claude', domain: 'claude.ai', auth: 'google', enabled: true },
      { id: 'kimi', name: 'Kimi', domain: 'kimi.com', auth: 'google', enabled: true },
      { id: 'deepseek', name: 'DeepSeek', domain: 'deepseek.com', auth: 'email', enabled: true },
      { id: 'gemini', name: 'Gemini', domain: 'gemini.google.com', auth: 'google', enabled: true }
    ];

    for (const platform of platforms) {
      try {
        const adapter = await this.loadAdapter(platform.id);
        this.platforms.set(platform.id, { adapter, config: platform });
        this.logger.info(`✓ Loaded adapter for ${platform.name}`);
      } catch (error) {
        this.logger.warn(`⚠ Failed to load adapter for ${platform.id}: ${error.message}`);
      }
    }
  }

  async loadAdapter(platformId) {
    try {
      const module = await import(`./${platformId}-adapter.js`);
      return module.adapter;
    } catch (error) {
      this.logger.warn(`No adapter found for ${platformId}, using generic:`, error.message);
      return new GenericAdapter(platformId, this.logger);
    }
  }

  async createChatCompletion(options) {
    const { messages, platform, model, stream } = options;
    
    if (!this.platforms.has(platform)) {
      throw new Error(`Platform '${platform}' not available. Available: ${[...this.platforms.keys()].join(', ')}`);
    }

    const platformData = this.platforms.get(platform);
    const session = await this.sessionManager.getOrCreateSession(platform);
    
    if (!session.isAuthenticated() && platformData.config.auth === 'google') {
      throw new Error(`Not authenticated with ${platform}. Please authenticate using Google OAuth`);
    }

    this.logger.info(`Creating chat completion on ${platform}`, { 
      messages: messages.length, 
      model: model || 'default',
      stream 
    });

    try {
      const result = await platformData.adapter.createChatCompletion({
        messages,
        model,
        stream,
        session
      });

      return result;
    } catch (error) {
      this.logger.error(`Error in ${platform} adapter:`, error);
      throw error;
    }
  }

  async authenticate(platform, credentials) {
    if (!this.platforms.has(platform)) {
      throw new Error(`Platform '${platform}' not available`);
    }

    const platformData = this.platforms.get(platform);
    return await platformData.adapter.authenticate(credentials);
  }

  getAvailablePlatforms() {
    return Array.from(this.platforms.entries()).map(([id, data]) => ({
      id,
      name: data.config.name,
      domain: data.config.domain,
      auth: data.config.auth,
      enabled: data.config.enabled
    }));
  }

  getPlatformInfo(platformId) {
    return this.platforms.get(platformId)?.config || null;
  }
}

class GenericAdapter {
  constructor(platformId, logger) {
    this.platformId = platformId;
    this.logger = logger;
  }

  async createChatCompletion(options) {
    this.logger.warn(`Using generic adapter for ${this.platformId} - limited functionality`);
    
    return {
      id: `generic-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: options.model || 'generic-model',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: `Generic response from ${this.platformId}. This adapter would use browser automation in production.`
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };
  }

  async authenticate(credentials) {
    return { success: true, message: 'Generic authentication simulated' };
  }
}
