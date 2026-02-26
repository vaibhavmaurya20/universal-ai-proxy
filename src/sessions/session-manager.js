import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export class SessionManager {
  constructor(logger) {
    this.logger = logger;
    this.sessions = new Map();
    this.sessionDir = path.join(process.cwd(), '.sessions');
    this.initialized = false;
  }

  async initialize() {
    try {
      await fs.mkdir(this.sessionDir, { recursive: true });
      await this.loadSessions();
      this.initialized = true;
      this.logger.info('Session Manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Session Manager:', error);
      throw error;
    }
  }

  async loadSessions() {
    try {
      const files = await fs.readdir(this.sessionDir);
      const sessionFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of sessionFiles) {
        try {
          const filePath = path.join(this.sessionDir, file);
          const data = await fs.readFile(filePath, 'utf8');
          const sessionData = JSON.parse(data);
          
          if (this.isValidSession(sessionData)) {
            this.sessions.set(sessionData.id, sessionData);
            this.logger.debug(`Loaded session: ${sessionData.id}`);
          }
        } catch (error) {
          this.logger.warn(`Failed to load session file ${file}:`, error);
        }
      }
      
      this.logger.info(`Loaded ${this.sessions.size} sessions`);
    } catch (error) {
      this.logger.error('Failed to load sessions:', error);
    }
  }

  isValidSession(sessionData) {
    if (!sessionData.id || !sessionData.platform || !sessionData.createdAt) {
      return false;
    }
    
    const createdAt = new Date(sessionData.createdAt);
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    return (Date.now() - createdAt.getTime()) < maxAge;
  }

  async createSession(platform, credentials = {}) {
    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      platform,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      authenticated: false,
      credentials: {},
      cookies: [],
      userAgent: this.generateUserAgent(),
      metadata: {}
    };

    if (credentials && Object.keys(credentials).length > 0) {
      session.credentials = this.encryptCredentials(credentials);
    }

    this.sessions.set(sessionId, session);
    await this.saveSession(sessionId);
    
    this.logger.info(`Created new session for ${platform}: ${sessionId}`);
    return session;
  }

  async getOrCreateSession(platform) {
    const existingSession = Array.from(this.sessions.values())
      .find(s => s.platform === platform && !s.isExpired);
    
    if (existingSession) {
      existingSession.lastUsed = new Date().toISOString();
      await this.saveSession(existingSession.id);
      return existingSession;
    }
    
    return await this.createSession(platform);
  }

  async getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    if (this.isSessionExpired(session)) {
      this.logger.warn(`Session ${sessionId} has expired`);
      await this.deleteSession(sessionId);
      return null;
    }
    
    session.lastUsed = new Date().toISOString();
    await this.saveSession(sessionId);
    
    return session;
  }

  async deleteSession(sessionId) {
    this.sessions.delete(sessionId);
    
    try {
      const filePath = path.join(this.sessionDir, `${sessionId}.json`);
      await fs.unlink(filePath);
      this.logger.info(`Deleted session: ${sessionId}`);
    } catch (error) {
      this.logger.warn(`Failed to delete session file for ${sessionId}:`, error);
    }
  }

  async saveSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    try {
      const filePath = path.join(this.sessionDir, `${sessionId}.json`);
      await fs.writeFile(filePath, JSON.stringify(session, null, 2));
      this.logger.debug(`Saved session: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to save session ${sessionId}:`, error);
    }
  }

  isSessionExpired(session) {
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    const createdAt = new Date(session.createdAt);
    return (Date.now() - createdAt.getTime()) > maxAge;
  }

  encryptCredentials(credentials) {
    const salt = crypto.randomBytes(16).toString('hex');
    const key = crypto.pbkdf2Sync(process.env.SESSION_SECRET || 'default-secret', salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(credentials), 'utf8'),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      salt
    };
  }

  decryptCredentials(encryptedData) {
    try {
      const { encrypted, iv, authTag, salt } = encryptedData;
      const key = crypto.pbkdf2Sync(process.env.SESSION_SECRET || 'default-secret', salt, 100000, 32, 'sha256');
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encrypted, 'hex')),
        decipher.final()
      ]);
      
      return JSON.parse(decrypted.toString('utf8'));
    } catch (error) {
      this.logger.error('Failed to decrypt credentials:', error);
      return {};
    }
  }

  async authenticateSession(sessionId, credentials) {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    
    session.credentials = this.encryptCredentials(credentials);
    session.authenticated = true;
    session.metadata.authTime = new Date().toISOString();
    
    await this.saveSession(sessionId);
    this.logger.info(`Authenticated session ${sessionId} for ${session.platform}`);
    
    return session;
  }

  isAuthenticated(sessionId) {
    const session = this.sessions.get(sessionId);
    return session?.authenticated || false;
  }

  getSessionCookies(sessionId) {
    const session = this.sessions.get(sessionId);
    return session?.cookies || [];
  }

  async updateSessionCookies(sessionId, cookies) {
    const session = await this.getSession(sessionId);
    if (session) {
      session.cookies = cookies;
      await this.saveSession(sessionId);
    }
  }

  generateUserAgent() {
    return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  getSessionsForPlatform(platform) {
    return Array.from(this.sessions.values())
      .filter(s => s.platform === platform && !this.isSessionExpired(s));
  }

  async cleanupExpiredSessions() {
    const expiredSessions = Array.from(this.sessions.entries())
      .filter(([_, session]) => this.isSessionExpired(session));
    
    for (const [sessionId] of expiredSessions) {
      await this.deleteSession(sessionId);
    }
    
    this.logger.info(`Cleaned up ${expiredSessions.length} expired sessions`);
  }
}
