import { BaseAdapter } from './base-adapter.js';

export class DeepSeekAdapter extends BaseAdapter {
  constructor(logger) {
    const config = {
      name: 'DeepSeek',
      domain: 'https://deepseek.com',
      loginUrl: 'https://deepseek.com/login',
      chatUrl: 'https://deepseek.com/chat',
      defaultModel: 'deepseek-chat',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    super('deepseek', config, logger);
    
    this.selectors = {
      loginButton: 'button[type="submit"]',
      emailInput: 'input[name="email"]',
      passwordInput: 'input[name="password"]',
      chatInput: 'textarea[placeholder*="Ask DeepSeek"]',
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
      
      if (credentials.email && credentials.password) {
        await this.page.fill(this.selectors.emailInput, credentials.email);
        await this.page.fill(this.selectors.passwordInput, credentials.password);
        await this.page.click(this.selectors.loginButton);
      } else {
        throw new Error('Email/password credentials required for DeepSeek');
      }
      
      await this.page.waitForTimeout(3000);
    } catch (error) {
      this.logger.error('DeepSeek login failed:', error);
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
