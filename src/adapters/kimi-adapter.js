import { BaseAdapter } from './base-adapter.js';

export class KimiAdapter extends BaseAdapter {
  constructor(logger) {
    const config = {
      name: 'Kimi',
      domain: 'https://kimi.com',
      loginUrl: 'https://kimi.com/login',
      chatUrl: 'https://kimi.com/chat',
      defaultModel: 'kimi-k2',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    super('kimi', config, logger);
    
    this.selectors = {
      loginButton: 'button[type="submit"]',
      googleButton: 'button:has-text("Google")',
      emailInput: 'input[name="email"]',
      passwordInput: 'input[name="password"]',
      chatInput: 'textarea[placeholder*="Ask Kimi"]',
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
        this.logger.info('Using Google OAuth for Kimi');
        await this.handleGoogleAuth(credentials);
      }
      
      await this.page.waitForTimeout(3000);
    } catch (error) {
      this.logger.error('Kimi login failed:', error);
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
      this.logger.error('Google Auth failed for Kimi:', error);
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
}
