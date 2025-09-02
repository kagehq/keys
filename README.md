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
```

## Advanced Features

### CLI Management (Optional)

```bash
# Start broker
npx kage-keys start

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

## Migration Path

### Start Simple
```javascript
// Phase 1: Basic SDK
await withAgentKey("github:repos.read", fn);
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


## License

This project is licensed under the FSL-1.1-MIT License. See the LICENSE file for details.
