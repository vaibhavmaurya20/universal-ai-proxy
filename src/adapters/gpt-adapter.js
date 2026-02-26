import { BaseAdapter } from './base-adapter.js';

export class GPTAdapter extends BaseAdapter {
  constructor(logger) {
    const config = {
      name: 'ChatGPT',
      domain: 'https://chatgpt.com',
      loginUrl: 'https://chatgpt.com/login',
      chatUrl: 'https://chatgpt.com/chat',
      defaultModel: 'gpt-4',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    super('chatgpt', config, logger);
    
    this.selectors = {
      loginButton: 'button[data-auth-modal-type="login"]',
      continueButton: 'button[type="submit"]',
      googleButton: 'button:has-text("Continue with Google")',
      emailInput: 'input[name="email"]',
      passwordInput: 'input[name="password"]',
      chatInput: '[data-qa="message-textarea"]',
      sendButton: 'button[data-qa="messaging-send-button"]',
      messageSelector: '[data-message-author-role="assistant"] .message-content',
      streamSelector: '[data-message-author-role="assistant"] .message-content'
    };
  }
  
  async checkLoginStatus() {
    try {
      await this.page.waitForTimeout(2000);
      const currentUrl = this.page.url();
      
      if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
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
        this.logger.info('Using Google OAuth for ChatGPT');
        
        await googleButton.click();
        
        await this.handleGoogleAuth(credentials);
      } else {
        throw new Error('Google OAuth not available');
      }
      
      await this.page.waitForTimeout(3000);
    } catch (error) {
      this.logger.error('ChatGPT login failed:', error);
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
      await popupPage.click(this.selectors.continueButton);
      
      await popupPage.waitForTimeout(2000);
      
      await popupPage.fill(this.selectors.passwordInput, password);
      await popupPage.click(this.selectors.continueButton);
      
      await popupPage.waitForTimeout(3000);
      
      try {
        const allowButton = await popupPage.$('button:has-text("Allow")');
        if (allowButton) {
          await allowButton.click();
        }
      } catch (e) {
        // No allow button needed
      }
    } catch (error) {
      this.logger.error('Google Auth failed:', error);
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
