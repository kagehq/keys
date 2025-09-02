# 🔑 Kage Keys

**Scoped, expiring keys for AI agents** - Start simple with the SDK, enhance with the broker when you need it.

## Why Kage Keys?

By default, AI agents get **full API keys** with unlimited access. That's a disaster waiting to happen.

`@kagehq/keys` gives you **scoped, temporary tokens** for each action, so your agents stay safe and auditable. Start with the simple SDK, then optionally enhance with the broker for enterprise-grade security.


## Two Ways to Use

### 1. **SDK Mode** (Default) - Simple & Fast
```javascript
import { withAgentKey } from '@kagehq/keys';

// Simple scoped keys - no external dependencies
await withAgentKey("github:repos.read", async (token) => {
  // Your GitHub API call here
  const repos = await github.getRepos(token);
  return repos;
});
```

### 2. **Broker Mode** - Enterprise Security
```javascript
// Enhanced security via HTTP broker
await withAgentKey("openai:chat.create", async (token) => {
  // Routes through broker with real JWT validation
  const response = await openai.chat(token, "Hello!");
  return response;
}, { 
  broker: { 
    url: 'http://localhost:3000', 
    useBroker: true 
  } 
});
```

## Installation

```bash
npm install @kagehq/keys
```

## 🚀 Quick Start

### Basic SDK Usage (5 minutes)

```javascript
import { withAgentKey } from '@kagehq/keys';

// Simple scoped keys
await withAgentKey("github:repos.read", async (token) => {
  console.log(`Using token: ${token}`);
  // Your API call here
  return await fetch('https://api.github.com/user/repos', {
    headers: { 'Authorization': `token ${token}` }
  });
});
```

### Enhanced with Broker

```bash
# Start broker (optional)
npx kage-keys start

# Use enhanced SDK
await withAgentKey("openai:chat.create", async (token) => {
  // Routes through broker automatically
  return await openai.chat(token, "Hello!");
}, { 
  broker: { 
    url: 'http://localhost:3000', 
    useBroker: true 
  } 
});
```

### Token Duration & Expiry

```javascript
// Short-lived token (10 seconds - default)
await withAgentKey("github:repos.read", async (token) => {
  // Quick API call
  return await github.getRepos(token);
});

// Medium-lived token (5 minutes)
await withAgentKey("slack:chat.post", async (token) => {
  // Post message with 5-minute window
  return await slack.postMessage(token, "Hello team!");
}, { expiresIn: 300 });

// Long-lived token (1 hour)
await withAgentKey("openai:chat.create", async (token) => {
  // Extended AI conversation
  return await openai.chat(token, "Let's have a long conversation...");
}, { expiresIn: 3600 });

// Very long-lived token (24 hours)
await withAgentKey("aws:s3.read", async (token) => {
  // Batch processing job
  return await aws.listS3Objects(token);
}, { expiresIn: 86400 });
```

### Duration Examples

| Use Case | Duration | `expiresIn` Value |
|----------|----------|-------------------|
| **Quick API calls** | 10 seconds | `10` (default) |
| **User sessions** | 5 minutes | `300` |
| **AI conversations** | 1 hour | `3600` |
| **Batch jobs** | 24 hours | `86400` |
| **Long-running tasks** | 7 days | `604800` |

## Core Concepts

### Scope Format
Scopes follow the pattern: `service:resource.action`

- **Exact**: `openai:chat.create`
- **Wildcards**: `openai:chat.*`, `github:repos.*`
- **Bundles**: Predefined groups like `ai_assistant`, `code_reviewer`

### Two Modes

| Feature | SDK Mode | Broker Mode |
|---------|----------|-------------|
| **Setup** | Zero config | Start broker service |
| **Tokens** | Local generation | Real JWT with HMAC |
| **Security** | Basic scoping | Full validation + audit |
| **Logging** | Local files | SQLite + export |
| **Use Case** | Development, demos | Production, compliance |

## API Reference

### Primary SDK Interface

```javascript
withAgentKey(scope, fn, options?)
```

**Parameters:**
- `scope` (string): The scope for the agent key
- `fn` (function): Function to execute with the token
- `options` (object, optional):
  - `expiresIn` (number): Token expiration in seconds (default: 10)
  - `broker` (object, optional): Broker configuration

**Returns:** Promise that resolves to the function result

### Broker Integration

```javascript
// Enable broker mode
withAgentKey("scope", fn, {
  broker: {
    url: 'http://localhost:3000',
    useBroker: true
  }
});

// Direct API calls through broker
withBrokeredAPI("scope", apiCall, {
  brokerUrl: 'http://localhost:3000',
  expiresIn: 3600,
  provider: 'openai'
});

// Broker mode with custom duration
await withAgentKey("openai:chat.create", async (token) => {
  // 30-minute AI session
  return await openai.chat(token, "Start conversation...");
}, { 
  expiresIn: 1800,  // 30 minutes
  broker: { 
    url: 'http://localhost:3000', 
    useBroker: true 
  } 
});
```

## Advanced Features

### CLI Management (Optional)

```bash
# Start broker
npx kage-keys start

# View available scopes and service catalogs
npx kage-keys scopes

# Create tokens
npx kage-keys token create --scope "openai:chat.create" --agent "my-agent"

# View logs
npx kage-keys logs

# Show statistics
npx kage-keys stats
```

### Service Catalogs

Pre-configured integrations for:
- **OpenAI**: Chat, models, embeddings
- **GitHub**: Repos, issues, PRs  
- **Slack**: Messages, channels, users
- **Notion**: Pages, databases
- **AWS**: STS, S3, Lambda

**View all available scopes and bundles:**
```bash
npx kage-keys scopes
```

This command shows:
- All available service scopes with their HTTP methods and endpoints
- Predefined scope bundles for common use cases
- Rate limit configurations
- API endpoint mappings

## 🔒 Security Features

### SDK Mode
- ✅ Scoped access control
- ✅ Token expiration
- ✅ Local audit logging

### Broker Mode
- ✅ Real JWT validation
- ✅ HMAC signatures
- ✅ Rate limiting
- ✅ SQLite audit trails
- ✅ Token revocation
- ✅ SIEM export

## Monitoring & Compliance

- **Local logs**: Simple JSON files (SDK mode)
- **Database logs**: SQLite with export (Broker mode)
- **Performance metrics**: Request duration, provider latency
- **Search & filtering**: By time, agent, scope, status

### Token Lifecycle Monitoring

```javascript
// Check token expiry in logs
const logs = await getLogs();
const activeTokens = logs.filter(log => {
  const expiry = new Date(log.expiresAt);
  const now = new Date();
  return expiry > now && log.status === 'success';
});

console.log(`Active tokens: ${activeTokens.length}`);
activeTokens.forEach(token => {
  const timeLeft = Math.ceil((new Date(token.expiresAt) - new Date()) / 1000);
  console.log(`${token.scope}: expires in ${timeLeft}s`);
});
```

### Duration Best Practices

- **Quick operations**: Use default (10s) or shorter
- **User interactions**: 5-15 minutes for session tokens
- **Background jobs**: 1-24 hours depending on complexity
- **Long-running tasks**: Consider token refresh strategies

## Migration Path

### Start Simple
```javascript
// Phase 1: Basic SDK
await withAgentKey("github:repos.read", fn);
```

### Handle Token Expiry

```javascript
try {
  await withAgentKey("github:repos.read", async (token) => {
    // Token expires in 10 seconds by default
    const repos = await github.getRepos(token);
    return repos;
  }, { expiresIn: 10 });
} catch (error) {
  if (error.message.includes('expired')) {
    // Token expired - handle gracefully
    console.log('Token expired, retrying...');
    // Retry with new token
    return await withAgentKey("github:repos.read", async (token) => {
      return await github.getRepos(token);
    });
  }
  throw error;
}
```

### Enhance When Ready
```javascript
// Phase 2: Add broker
await withAgentKey("github:repos.read", fn, {
  broker: { url: 'http://localhost:3000', useBroker: true }
});
```

### Full Enterprise
```javascript
// Phase 3: Direct broker integration
await withBrokeredAPI("github:repos.read", apiCall, {
  brokerUrl: 'http://broker.company.com'
});
```

## Examples

See the `examples/` directory:

- `demo.js` - Original SDK functionality
- `unified-sdk-demo.js` - Both modes in action
- `broker-demo.js` - Full broker system

### Quick Reference

```javascript
// Basic usage
await withAgentKey("service:resource.action", async (token) => {
  // Your API call here
  return await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
});

// With custom duration
await withAgentKey("service:resource.action", async (token) => {
  // Token expires in 1 hour
  return await apiCall(token);
}, { expiresIn: 3600 });

// With broker integration
await withAgentKey("service:resource.action", async (token) => {
  // Enhanced security via broker
  return await apiCall(token);
}, { 
  expiresIn: 3600,
  broker: { url: 'http://localhost:3000', useBroker: true }
});
```

## Use Cases

### SDK Mode (Immediate Value)
- **Development**: Quick prototyping and testing
- **Demos**: Show scoped access concepts
- **Simple apps**: Basic security needs
- **Learning**: Understand the concepts

### Broker Mode (Production Value)
- **Production**: Enterprise-grade security
- **Compliance**: Audit trails and monitoring
- **Teams**: Multi-agent management
- **Integration**: Real API routing

## Getting Started

1. **Install**: `npm install @kagehq/keys`
2. **Basic**: Use `withAgentKey` for simple scoped keys
3. **Enhanced**: Add broker configuration when ready
4. **Advanced**: Use CLI tools for production management

## Implementation Guide

### Where to Implement Kage Keys

Kage Keys can be implemented in **your existing backend** or **AI agent code** without major architectural changes.

#### Option 1: Backend API Gateway (Recommended)

```javascript
// Your existing Express/FastAPI/Flask backend
import { withAgentKey } from '@kagehq/keys';

app.get('/api/github/repos', async (req, res) => {
  // Generate scoped token for this specific request
  const repos = await withAgentKey("github:repos.read", async (token) => {
    // Use scoped token instead of master API key
    const response = await fetch('https://api.github.com/user/repos', {
      headers: { 'Authorization': `token ${token}` }
    });
    return await response.json();
  });
  
  res.json(repos);
});

app.post('/api/openai/chat', async (req, res) => {
  const { message } = req.body;
  
  const response = await withAgentKey("openai:chat.create", async (token) => {
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: message }]
      })
    });
    
    return await openaiResponse.json();
  });
  
  res.json(response);
});
```

#### Option 2: AI Agent with Scoped Access

```javascript
// Your AI agent that needs to call external APIs
class AIAgent {
  async analyzeGitHubRepo(owner, repo) {
    // Get scoped access to GitHub
    const repoData = await withAgentKey("github:repos.read", async (token) => {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { 'Authorization': `token ${token}` }
      });
      return await response.json();
    });
    
    // Now analyze the repo data
    return this.analyzeCode(repoData);
  }
  
  async postSlackMessage(channel, message) {
    // Get scoped access to Slack
    await withAgentKey("slack:chat.post", async (token) => {
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ channel, text: message })
      });
    });
  }
}
```

### Migration from Traditional API Keys

#### Before (Traditional Approach)
```javascript
// Your existing code - using master API keys
const GITHUB_TOKEN = process.env.GITHUB_MASTER_TOKEN;
const OPENAI_KEY = process.env.OPENAI_MASTER_KEY;

app.get('/github/repos', async (req, res) => {
  // Using master token everywhere
  const response = await fetch('https://api.github.com/user/repos', {
    headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
  });
  // ... rest of code
});
```

#### After (With Kage Keys)
```javascript
// Your existing code - now with scoped tokens
import { withAgentKey } from '@kagehq/keys';

app.get('/github/repos', async (req, res) => {
  // Generate scoped token for this specific request
  const repos = await withAgentKey("github:repos.read", async (token) => {
    const response = await fetch('https://api.github.com/user/repos', {
      headers: { 'Authorization': `token ${token}` }
    });
    return await response.json();
  });
  
  res.json(repos);
});
```

### Quick Migration Steps

1. **Install Kage Keys**: `npm install @kagehq/keys`
2. **Import the function**: `import { withAgentKey } from '@kagehq/keys'`
3. **Replace one API call** to test the pattern
4. **Gradually migrate** other API calls
5. **Remove master API keys** from your environment variables

### Benefits of This Approach

- ✅ **No Backend Changes Required**: Works with your existing API structure
- ✅ **Scoped Access**: Each request gets a limited-scope token
- ✅ **Audit Trail**: See exactly what each request accessed
- ✅ **Security**: No more master API keys in your code
- ✅ **Compliance**: Better for enterprise security requirements


## License

This project is licensed under the FSL-1.1-MIT License. See the LICENSE file for details.
