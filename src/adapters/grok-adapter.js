import { BaseAdapter } from './base-adapter.js';

export class GrokAdapter extends BaseAdapter {
  constructor(logger) {
    const config = {
      name: 'Grok',
      domain: 'https://grok.com',
      loginUrl: 'https://grok.com/login',
      chatUrl: 'https://grok.com/chat',
      defaultModel: 'grok-2',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    super('grok', config, logger);
    
    this.selectors = {
      loginButton: 'button[type="submit"]',
      googleButton: 'button:has-text("Google")',
      emailInput: 'input[name="email"]',
      passwordInput: 'input[name="password"]',
      chatInput: 'textarea[placeholder*="Ask Grok"]',
      sendButton: 'button[type="submit"]',
      messageSelector: '.message-content',
      streamSelector: '.streaming-content'
    };
  }

  async checkLoginStatus() {
    try {
      await this.page.waitForTimeout(2000);
      const chatInput = await this.page.$(this.selectors.chatInput);
      return chatInput !== null;
    } catch (error) {
      return false;
    }
  }

  async performLogin(credentials) {
    try {
      await this.page.goto(this.config.loginUrl, { waitUntil: 'networkidle' });
      
      const googleButton = await this.page.$(this.selectors.googleButton);
      if (googleButton) {
        this.logger.info('Using Google OAuth for Grok');
        await this.handleGoogleAuth(credentials);
      }
      
      await this.page.waitForTimeout(3000);
    } catch (error) {
      this.logger.error('Grok login failed:', error);
      throw error;
    }
  }

  async handleGoogleAuth(credentials) {
    try {
      const email = credentials.email || process.env.GOOGLE_EMAIL;
      const password = credentials.password || process.env.GOOGLE_PASSWORD;
      
      if (!email || !password) {
        throw new Error('Google credentials not provided');
      }
      
      const pagePromise = this.context.waitForEvent('page');
      await this.page.click(this.selectors.googleButton);
      const popupPage = await pagePromise;
      
      await popupPage.waitForLoadState();
      
      await popupPage.fill(this.selectors.emailInput, email);
      await popupPage.click(this.selectors.loginButton);
      
      await popupPage.waitForTimeout(2000);
      
      await popupPage.fill(this.selectors.passwordInput, password);
      await popupPage.click(this.selectors.loginButton);
      
      await popupPage.waitForTimeout(3000);
    } catch (error) {
      this.logger.error('Google Auth failed for Grok:', error);
      throw error;
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
}
