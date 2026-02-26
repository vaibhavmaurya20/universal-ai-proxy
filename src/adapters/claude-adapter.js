import { BaseAdapter } from './base-adapter.js';

export class ClaudeAdapter extends BaseAdapter {
  constructor(logger) {
    const config = {
      name: 'Claude',
      domain: 'https://claude.ai',
      loginUrl: 'https://claude.ai/login',
      chatUrl: 'https://claude.ai/chat',
      defaultModel: 'claude-3-5-sonnet-20241022',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    super('claude', config, logger);
    
    this.selectors = {
      loginButton: 'button[type="submit"], .cl-login-button',
      emailInput: 'input[type="email"], input[name="email"]',
      passwordInput: 'input[type="password"], input[name="password"]',
      continueButton: 'button[type="submit"]',
      googleButton: 'button:has-text("Google"), .cl-google-signin',
      chatInput: '[data-testid="chat-input-textarea"]',
      sendButton: 'button[type="submit"]',
      messageSelector: '.cl-message-content',
      streamSelector: '.cl-message-stream',
      modelSelect: '[data-testid="model-selector"]',
      newChatButton: '[data-testid="start-new-chat"]'
    };
  }

  async checkLoginStatus() {
    if (!this.page) return false;
    
    try {
      await this.page.waitForTimeout(2000);
      const currentUrl = this.page.url();
      
      if (currentUrl.includes('/login') || currentUrl.includes('/onboarding')) {
        return false;
      }
      
      const chatInput = await this.page.$(this.selectors.chatInput);
      return chatInput !== null;
    } catch (error) {
      this.logger.debug('Login check failed:', error.message);
      return false;
    }
  }

  async performLogin(credentials) {
    try {
      await this.page.goto(this.config.loginUrl, { waitUntil: 'networkidle' });
      
      const googleButton = await this.page.$(this.selectors.googleButton);
      if (googleButton) {
        this.logger.info('Using Google OAuth for Claude');
        await googleButton.click();
        
        await this.handleGoogleSignup(credentials);
      } else {
        throw new Error('Google OAuth not available');
      }
      
      await this.page.waitForTimeout(3000);
    } catch (error) {
      this.logger.error('Claude login failed:', error);
      throw error;
    }
  }

  async handleGoogleSignup(credentials) {
    try {
      const email = credentials.email || process.env.GOOGLE_EMAIL;
      const password = credentials.password || process.env.GOOGLE_PASSWORD;
      
      if (!email || !password) {
        throw new Error('Google credentials not provided');
      }
      
      const pagePromise = this.context.waitForEvent('page');
      await this.page.click('button:has-text("Google")');
      const googlePage = await pagePromise;
      
      await googlePage.waitForLoadState();
      
      await googlePage.fill('input[type="email"]', email);
      await googlePage.click('button[type="submit"]');
      
      await googlePage.waitForTimeout(2000);
      
      await googlePage.fill('input[type="password"]', password);
      await googlePage.click('button[type="submit"]');
      
      await googlePage.waitForTimeout(3000);
      
      try {
        await googlePage.click('button:has-text("Continue")');
      } catch (e) {
        // Continue button might not be present
      }
    } catch (error) {
      this.logger.error('Google OAuth failed:', error);
      throw error;
    }
  }

  async createRegularCompletion(messages, model) {
    await this.navigateToChat();
    
    let prompt = '';
    for (const message of messages) {
      if (message.role === 'user') {
        prompt = message.content;
        break;
      }
    }
    
    if (!prompt) {
      throw new Error('No user message found');
    }
    
    if (model) {
      await this.selectModel(model);
    }
    
    await this.sendMessage(prompt);
    const response = await this.waitForResponse();
    
    return this.formatResponse(response, model);
  }

  async *createStreamingCompletion(messages, model) {
    await this.navigateToChat();
    
    let prompt = '';
    for (const message of messages) {
      if (message.role === 'user') {
        prompt = message.content;
        break;
      }
    }
    
    if (!prompt) {
      throw new Error('No user message found');
    }
    
    if (model) {
      await this.selectModel(model);
    }
    
    yield this.formatStreamChunk('', model);
    
    await this.sendMessage(prompt);
    
    const stream = await this.streamResponse();
    for await (const chunk of stream) {
      yield chunk;
    }
  }

  async navigateToChat() {
    try {
      await this.page.goto(this.config.chatUrl, { waitUntil: 'networkidle' });
      
      try {
        const chatInput = await this.page.$(this.selectors.chatInput);
        if (!chatInput) {
          await this.page.click(this.selectors.newChatButton);
          await this.page.waitForTimeout(2000);
        }
      } catch (error) {
        // If new chat button doesn't exist, assume we're already in a chat
      }
    } catch (error) {
      this.logger.error('Failed to navigate to chat:', error);
      throw error;
    }
  }

  async selectModel(model) {
    try {
      const modelSelect = await this.page.$(this.selectors.modelSelect);
      if (modelSelect) {
        await modelSelect.click();
        await this.page.waitForTimeout(1000);
        
        const modelOption = await this.page.$(`[data-testid="model-option-${model}"]`);
        if (modelOption) {
          await modelOption.click();
          await this.page.waitForTimeout(1000);
        }
      }
    } catch (error) {
      this.logger.warn('Model selection failed:', error.message);
    }
  }

  async sendMessage(content) {
    try {
      await this.page.fill(this.selectors.chatInput, content);
      await this.page.waitForTimeout(500);
      
      const sendButton = await this.page.$(this.selectors.sendButton);
      if (sendButton) {
        await sendButton.click();
      } else {
        await this.page.press(this.selectors.chatInput, 'Enter');
      }
      
      await this.page.waitForTimeout(1000);
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      throw error;
    }
  }

  async waitForResponse() {
    try {
      await this.page.waitForSelector(this.selectors.messageSelector, { timeout: 30000 });
      
      const messages = await this.page.$$(this.selectors.messageSelector);
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        return await lastMessage.textContent();
      }
      
      return 'No response received';
    } catch (error) {
      this.logger.error('Failed to wait for response:', error);
      return 'Error: Failed to get response';
    }
  }

  async *streamResponse() {
    try {
      await this.page.waitForSelector(this.selectors.streamSelector);
      
      const streamElement = await this.page.$(this.selectors.streamSelector);
      if (!streamElement) {
        yield this.formatStreamChunk('Error: Stream element not found');
        return;
      }
      
      let previousContent = '';
      const maxAttempts = 60;
      let attempts = 0;
      
      while (attempts < maxAttempts) {
        const currentContent = await streamElement.textContent();
        
        if (currentContent && currentContent !== previousContent) {
          const newContent = currentContent.substring(previousContent.length);
          previousContent = currentContent;
          
          if (newContent.trim()) {
            yield this.formatStreamChunk(newContent);
          }
        }
        
        const isComplete = await this.page.$(`${this.selectors.streamSelector}:not([data-streaming="true"])`);
        if (isComplete) {
          break;
        }
        
        await this.page.waitForTimeout(500);
        attempts++;
      }
      
      if (attempts >= maxAttempts) {
        yield this.formatStreamChunk('\n[Stream timeout - partial response]');
      }
    } catch (error) {
      this.logger.error('Streaming failed:', error);
      yield this.formatStreamChunk(`\n[Stream error: ${error.message}]`);
    }
  }
}
