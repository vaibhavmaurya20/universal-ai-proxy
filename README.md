# 🚀 Universal AI Proxy

A powerful, OpenAI-compatible API server that provides unified access to multiple AI platforms through browser automation with Google OAuth.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![Platforms](https://img.shields.io/badge/Platforms-6%2B-blueviolet)](README.md#supported-platforms)

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [📦 Installation](#-installation)
- [⚙️ Configuration](#️-configuration)
- [🚀 Quick Start](#-quick-start)
- [🔐 Authentication Setup](#-authentication-setup)
- [🎮 How to Use](#-how-to-use)
- [🔄 Switching Platforms](#-switching-platforms)
- [🔧 Advanced Configuration](#-advanced-configuration)
- [🛠️ Troubleshooting](#️-troubleshooting)
- [🔌 API Examples](#-api-examples)
- [📚 API Reference](#-api-reference)
- [🎯 Next Steps](#-next-steps)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## ✨ Features

### 🌐 Multi-Platform Support
- **ChatGPT** (chatgpt.com) - Google OAuth
- **Claude** (claude.ai) - Google OAuth  
- **Grok** (grok.com) - Google OAuth
- **Kimi** (kimi.com) - Google OAuth
- **DeepSeek** (deepseek.com) - Email Auth
- **Gemini** (gemini.google.com) - Google OAuth

### 🔌 OpenAI-Compatible API
- ✅ Drop-in replacement for OpenAI API
- ✅ `/v1/chat/completions` endpoint
- ✅ `/v1/models` endpoint  
- ✅ Streaming responses support
- ✅ WebSocket real-time streaming

### 🔐 Authentication
- Google OAuth automatic handling
- Session management with encryption
- Persistent login state (30 days)
- Secure cookie storage

### 🤖 Browser Automation
- Playwright-powered browser control
- Automated login flows
- Real-time chat interaction
- Headless browser support

---

## 📦 Installation

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- Google account with app password (for OAuth platforms)

### Step 1: Clone Repository

```bash
git clone https://github.com/vaibhavmaurya20/universal-ai-proxy.git
cd universal-ai-proxy
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages including:
- express (web server)
- playwright (browser automation)
- cors (cross-origin support)
- ws (WebSocket server)
- winston (logging)
- and other dependencies

### Step 3: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Server Configuration
PORT=3000
HOST=localhost
NODE_ENV=production
LOG_LEVEL=info

# Google OAuth Credentials (GET FROM: Google Cloud Console)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Your Google Account (for AI platforms)
GOOGLE_EMAIL=your-email@gmail.com
GOOGLE_PASSWORD=your-app-password

# Session Encryption (generate random string)
SESSION_SECRET=your-super-secure-random-secret-key

# Optional API Keys (for direct API fallback)
ANTHROPIC_API_KEY=sk-ant-api-key
OPENAI_API_KEY=sk-openai-api-key

# Browser Configuration
BROWSER_HEADLESS=false
BROWSER_TIMEOUT=30000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
```

### Step 4: Getting Google App Password

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Step Verification (required)
3. Go to "App passwords"
4. Generate a new app password
5. Use this password in GOOGLE_PASSWORD field

---

## 🚀 Quick Start

### Development Mode
```bash
npm run dev
# Server with auto-restart on file changes
```

### Production Mode
```bash
npm start
```

### PM2 Process Manager (Recommended for Production)

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start src/index.js --name universal-ai-proxy

# Save PM2 configuration
pm2 save
pm2 startup

# Monitor logs
pm2 logs universal-ai-proxy

# Check status
pm2 status
```

Verify server is running:
```bash
curl http://localhost:3000/health
```

---

## 🔐 Authentication Setup

### Automated Google OAuth Flow

The server will automatically attempt Google OAuth when you first access a platform. No manual intervention needed!

### Check Authentication Status

```bash
# Check all platforms
curl http://localhost:3000/v1/platforms

# Check system health
curl http://localhost:3000/health
```

### Session Management

Sessions are automatically stored in `.sessions/` directory:
- Encrypted using SESSION_SECRET
- Auto-expire after 30 days
- Can be cleared anytime:
  ```bash
  rm -rf .sessions/
  ```

---

## 🎮 How to Use

### 1. Check Available Platforms

```bash
curl http://localhost:3000/v1/platforms
```

**Example Response:**
```json
{
  "platforms": [
    {
      "id": "chatgpt",
      "name": "ChatGPT",
      "domain": "chatgpt.com",
      "auth_type": "google",
      "status": "available"
    },
    {
      "id": "claude", 
      "name": "Claude",
      "domain": "claude.ai",
      "auth_type": "google",
      "status": "available"
    }
  ]
}
```

### 2. List Available Models

```bash
curl http://localhost:3000/v1/models
```

### 3. Send a Chat Message (Basic)

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "platform": "claude",
    "model": "claude-3-5-sonnet"
  }'
```

### 4. Send a Chat Message (Streaming)

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Write a short story about AI"}
    ],
    "platform": "chatgpt",
    "model": "gpt-4",
    "stream": true
  }'
```

---

## 🔄 Switching Platforms & Models

### Switch Between Platforms (Easy!)

Just change the `platform` field in your API call:

```javascript
// ChatGPT
{
  "platform": "chatgpt",
  "model": "gpt-4",
  "messages": [{"role": "user", "content": "Hello"}]
}

// Claude  
{
  "platform": "claude",
  "model": "claude-3-5-sonnet",
  "messages": [{"role": "user", "content": "Hello"}]
}

// Grok
{
  "platform": "grok",
  "model": "grok-2",
  "messages": [{"role": "user", "content": "Hello"}]
}
```

### Platform-Specific Model Names

| Platform | Model Names |
|----------|-------------|
| **ChatGPT** | `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo` |
| **Claude** | `claude-3-5-sonnet`, `claude-3-opus`, `claude-3-haiku` |
| **Grok** | `grok-2`, `grok-1.5` |
| **Kimi** | `kimi-k2`, `kimi-k1` |
| **DeepSeek** | `deepseek-chat`, `deepseek-coder` |
| **Gemini** | `gemini-1.5-pro`, `gemini-1.5-flash` |

---

## 🔌 WebSocket Streaming (Real-time)

Connect to `ws://localhost:3000` for live streaming:

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'chat',
    payload: {
      messages: [{role: 'user', content: 'Tell me a story'}],
      platform: 'claude',
      model: 'claude-3-5-sonnet',
      stream: true
    }
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'chunk') {
    process.stdout.write(data.data);
  }
};
```

---

## 🔧 Advanced Configuration

### Enable Headless Mode

For servers without GUI:
```env
BROWSER_HEADLESS=true
```

### Custom Rate Limiting
```env
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=1000  # 1000 requests per window
```

### Proxy Support

If behind corporate proxy:
```env
HTTP_PROXY=http://corporate-proxy:8080
HTTPS_PROXY=http://corporate-proxy:8080
```

---

## 🔌 API Examples

### Python

```python
import requests

response = requests.post('http://localhost:3000/v1/chat/completions', json={
    'messages': [{'role': 'user', 'content': 'Hello!'}],
    'platform': 'claude'
})
print(response.json())
```

### JavaScript

```javascript
const response = await fetch('http://localhost:3000/v1/chat/completions', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    messages: [{role: 'user', content: 'Hello!'}],
    platform: 'chatgpt'
  })
});
const data = await response.json();
console.log(data.choices[0].message.content);
```

### curl

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Explain quantum computing"}],
    "platform": "claude"
  }' | jq
```

---

## 🛠️ Troubleshooting

### Authentication Failed

1. **Check Google credentials:**
   ```bash
   cat .env | grep GOOGLE_
   ```

2. **Clear sessions and retry:**
   ```bash
   rm -rf .sessions/
   npm restart
   ```

3. **Check browser can open:**
   ```bash
   npx playwright install
   npx playwright open https://claude.ai
   ```

### Port Already in Use

Change port in `.env`:
```env
PORT=3001
```

### View Detailed Logs

```bash
# Debug mode
DEBUG=pw:browser npm start

# Full logs
LOG_LEVEL=debug npm start
```

---

## 📚 API Reference

### Create Chat Completion

**Endpoint:** `POST /v1/chat/completions`

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Hello!"
    }
  ],
  "platform": "claude",
  "model": "claude-3-5-sonnet",
  "stream": false,
  "temperature": 0.7,
  "max_tokens": 1000
}
```

**Response:**
```json
{
  "id": "chat-12345",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "claude-3-5-sonnet",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! I'm doing great. How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 15,
    "total_tokens": 25
  }
}
```

---

## 🎯 Next Steps

1. **Configure real Google OAuth credentials** in `.env`
2. **Test all platforms** using the health endpoint
3. **Integrate with your applications** using the OpenAI-compatible API
4. **Set up PM2** for production deployment
5. **Configure Nginx** reverse proxy (optional)

---

## 🤝 Contributing

This is a production-ready implementation. To extend:

1. Add new platform adapters in `src/adapters/`
2. Extend base adapter class
3. Configure selectors for new platform
4. Update proxy adapter loader

---

## 📄 License

MIT License - Free to use, modify, and distribute.

---

**Made with ❤️ using Playwright, Express, and Node.js**

**GitHub Repository:** https://github.com/vaibhavmaurya20/universal-ai-proxy
