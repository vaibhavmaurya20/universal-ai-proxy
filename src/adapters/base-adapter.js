import { v4 as uuidv4 } from 'uuid';

export class BaseAdapter {
  constructor(platformId, config, logger) {
    this.platformId = platformId;
    this.config = config;
    this.logger = logger;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.isAuthenticated = false;
    this.messageQueue = [];
    this.selectors = {
      loginButton: '',
      emailInput: '',
      passwordInput: '',
      continueButton: '',
      chatInput: '',
      sendButton: '',
      messageSelector: '',
      streamSelector: ''
    };
  }

  async initialize() {
    try {
      const { chromium } = await import('playwright');
      
      this.browser = await chromium.launch({
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled'
        ]
      });
      
      this.context = await this.browser.newContext({
        userAgent: this.config.userAgent,
        viewport: { width: 1280, height: 800 },
        storageState: this.config.storageState
      });
      
      this.page = await this.context.newPage();
      
      this.page.on('console', msg => {
        this.logger.debug(`[${this.platformId}] Console: ${msg.text()}`);
      });
      
      this.logger.info(`${this.config.name} adapter initialized`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize ${this.config.name}:`, error);
      return false;
    }
  }

  async authenticate(credentials) {
    try {
      if (!this.page) await this.initialize();
      
      await this.page.goto(this.config.domain, { waitUntil: 'networkidle' });
      
      const isLoggedIn = await this.checkLoginStatus();
      if (isLoggedIn) {
        this.isAuthenticated = true;
        this.logger.info(`${this.config.name}: Already logged in`);
        return { success: true, message: 'Already authenticated' };
      }
      
      await this.performLogin(credentials);
      
      this.isAuthenticated = true;
      this.logger.info(`${this.config.name}: Authentication successful`);
      
      return { success: true, message: 'Authenticated successfully' };
    } catch (error) {
      this.logger.error(`${this.config.name} authentication failed:`, error);
      return { success: false, error: error.message };
    }
  }

  async checkLoginStatus() {
    throw new Error('checkLoginStatus must be implemented by subclass');
  }

  async performLogin(credentials) {
    throw new Error('performLogin must be implemented by subclass');
  }

  async createChatCompletion(options) {
    const { messages, model, stream } = options;
    
    try {
      if (!this.isAuthenticated) {
        throw new Error(`Not authenticated with ${this.config.name}`);
      }
      
      if (stream) {
        return await this.createStreamingCompletion(messages, model);
      } else {
        return await this.createRegularCompletion(messages, model);
      }
    } catch (error) {
      this.logger.error(`${this.config.name} completion error:`, error);
      throw error;
    }
  }

  async createRegularCompletion(messages, model) {
    throw new Error('createRegularCompletion must be implemented by subclass');
  }

  async createStreamingCompletion(messages, model) {
    throw new Error('createStreamingCompletion must be implemented by subclass');
  }

  async navigateToChat() {
    throw new Error('navigateToChat must be implemented by subclass');
  }

  async sendMessage(content) {
    throw new Error('sendMessage must be implemented by subclass');
  }

  async waitForResponse() {
    throw new Error('waitForResponse must be implemented by subclass');
  }

  async *streamResponse() {
    throw new Error('streamResponse must be implemented by subclass');
  }

  async saveSession() {
    if (this.context) {
      return await this.context.storageState();
    }
    return null;
  }

  async restoreSession(storageState) {
    if (!this.context) {
      const { chromium } = await import('playwright');
      this.browser = await chromium.launch({ headless: false });
      this.context = await this.browser.newContext({
        userAgent: this.config.userAgent,
        storageState
      });
      this.page = await this.context.newPage();
    }
  }

  async cleanup() {
    try {
      if (this.browser) {
        await this.browser.close();
      }
      this.logger.info(`${this.config.name} adapter cleaned up`);
    } catch (error) {
      this.logger.error(`Error during cleanup:`, error);
    }
  }

  formatResponse(content, model) {
    return {
      id: `chat-${uuidv4()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model || this.config.defaultModel,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content
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

  formatStreamChunk(content, model) {
    return {
      id: `chat-${uuidv4()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: model || this.config.defaultModel,
      choices: [{
        index: 0,
        delta: { content },
        finish_reason: null
      }]
    };
  }
}
