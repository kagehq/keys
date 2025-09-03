# 🔐 Kage Keys

**Scoped, expiring keys for AI agents**. A permissions layer for AI Agents.

Kage Keys transforms how you manage AI agent permissions - from simple scoped keys to a complete enterprise permissions system with approval workflows, multi-tenancy, and real-time monitoring.

## 🚀 Quick Start

### Install
```bash
npm install @kagehq/keys
```

### Basic Usage (5 minutes)
```javascript
import { withAgentKey } from '@kagehq/keys';

// Simple scoped access
await withAgentKey("openai:chat.create", async (token) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello!' }] })
  });
  return response.json();
});
```

### With Custom Duration
```javascript
// Token expires in 1 hour
await withAgentKey("github:repos.read", async (token) => {
  return await github.getRepos(token);
}, { expiresIn: 3600 });
```

## 🏗️ Architecture Overview

Kage Keys operates in two modes, allowing you to start simple and enhance when needed:

| Feature | SDK Mode | Broker Mode |
|---------|----------|-------------|
| **Setup** | Zero config | Start broker service |
| **Tokens** | Local generation | Real JWT with HMAC |
| **Security** | Basic scoping | Full validation + audit |
| **Logging** | Local files | SQLite + export |
| **Use Case** | Development, demos | Production, compliance |

## 🔑 Core Concepts

### Scope Format
Scopes follow the pattern: `service:resource.action`

```javascript
// Examples
"openai:chat.create"      // OpenAI chat completion
"github:repos.read"        // GitHub repository read access
"slack:chat.post"          // Slack message posting
"aws:sts.assume_role"      // AWS role assumption
```

- **Exact**: `openai:chat.create`
- **Wildcards**: `openai:chat.*`, `github:repos.*`
- **Bundles**: Predefined groups like `ai_assistant`, `code_reviewer`

### Two Modes

#### **SDK Mode** (Default)
- **Local token generation** and validation
- **No external dependencies** or services
- **Immediate implementation** in existing code
- **Perfect for development** and simple use cases

#### **Broker Mode** (Enhanced)
- **HTTP broker** for centralized token management
- **Real JWT tokens** with HMAC signing
- **SQLite audit logging** for compliance
- **Service catalogs** for provider routing
- **Rate limiting** and anti-replay protection

## 🏢 Enterprise Features

### **Multi-Tenancy & RBAC**
- **Organizations → Projects → Agents**: Hierarchical structure
- **Role-Based Access Control**: Fine-grained permissions with time/condition restrictions
- **Scope Bundles**: Pre-configured permission sets for agent types
- **Agent Management**: Create, suspend, and manage AI agents

### **Approval Workflows**
- **High-Risk Scope Approval**: Optional approval gates for sensitive operations
- **Multiple Channels**: Slack, Email, CLI, and Webhook integrations
- **Automated Workflows**: Configurable approval processes
- **Audit Trail**: Complete approval history and decisions

### **Real-Time Dashboard**
- **Live Metrics**: Requests per minute, success rates, response times
- **Time Series Data**: Historical trends and patterns
- **Top Performers**: Agents, providers, and endpoint analytics
- **Live Request Streaming**: Real-time monitoring of all operations

### **Web Management Interface**
- **Modern Dashboard**: Beautiful, responsive web interface
- **Real-Time Updates**: Live data without page refreshes
- **Approval Management**: Handle pending requests via web UI
- **Export Capabilities**: CSV/JSON data export for SIEM integration

### **Production Security**
- **Immediate Revocation**: Live token revocation by JTI or session
- **Rate Limiting**: Per-agent and per-scope rate controls
- **IP Restrictions**: Configurable access controls
- **Compliance Ready**: Enterprise-grade audit logging

## 📚 API Reference

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

### Enterprise Features

```javascript
// Multi-tenancy and RBAC
import { TenancyManager, ApprovalManager, Dashboard } from '@kagehq/keys';

const tenancy = new TenancyManager({ enableRBAC: true });
const approval = new ApprovalManager({ enableCLI: true });
const dashboard = new Dashboard({ auditLogger });

// Create organization and project
const org = await tenancy.createOrganization('Acme Corp', 'acme-corp');
const project = await tenancy.createProject(org.id, 'AI Platform', 'ai-platform');

// Create AI agent with scope bundles
const agent = await tenancy.createAgent(
  project.id,
  'Customer Support AI',
  'ai-assistant',
  'AI agent for customer support',
  ['ai_assistant', 'team_collaborator']
);

// Check permissions
const canCreate = await tenancy.checkPermission(
  org.id, 'developer', 'create', 'ai_assistant:chat.create'
);

// Approval workflow for high-risk scopes
const approvalRequest = await approval.createApprovalRequest(
  org.id, project.id, agent.id, 'aws:sts.assume_role', 3600
);

// Real-time dashboard metrics
const metrics = await dashboard.getMetrics({
  start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  end: new Date().toISOString()
});

// Web dashboard (starts on port 8080)
const webDashboard = new WebDashboard({
  dashboard, approvalManager, tenancyManager, auditLogger
});
await webDashboard.start(8080);
```

## 🛠️ Management Tools

### CLI Management

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
- **Scope-based access control**
- **Configurable token expiration**
- **Local token generation**

### Broker Mode
- **JWT tokens with HMAC signing**
- **Anti-replay protection (JTI)**
- **Rate limiting per agent/scope**
- **Clock skew tolerance**
- **Token revocation lists**

### Security Hardening

- **mTLS Support**: Mutual TLS authentication between client and broker
- **CSRF Protection**: Cross-site request forgery protection for web UI
- **Strict CORS**: Configurable cross-origin resource sharing policies
- **Security Headers**: Comprehensive security headers (CSP, HSTS, XSS protection)
- **Session Management**: Secure session handling with configurable policies
- **Password Policies**: Enforceable password strength requirements
- **Sensitive Data Masking**: Automatic redaction of sensitive information in logs
- **Certificate Management**: SSL/TLS certificate loading and validation

## 📊 Monitoring & Compliance

### Token Lifecycle Monitoring
- **Real-time request tracking**
- **Success/failure rate monitoring**
- **Response time analytics**
- **Agent usage patterns**

### Audit Logging
- **SQLite database storage**
- **JSONL/CSV export capabilities**
- **SIEM integration ready**
- **Compliance reporting**

### Duration Best Practices
- **Short-lived tokens** (5-15 minutes) for high-frequency operations
- **Medium-lived tokens** (1-4 hours) for user sessions
- **Long-lived tokens** (24 hours) for background jobs
- **Never use permanent tokens** - always set expiration

## 🚀 Implementation Guide

### Security Configuration

Configure production-grade security for your deployment:

```javascript
import { SecurityManager } from '@kagehq/keys';

const securityManager = new SecurityManager({
  tls: {
    enabled: true,
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.3'
  },
  mtls: {
    enabled: true,
    verifyClient: true
  },
  cors: {
    origins: ['https://yourdomain.com'],
    credentials: true
  },
  csrf: {
    enabled: true,
    tokenLength: 32
  },
  session: {
    secure: true,
    httpOnly: true,
    sameSite: 'strict'
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 100
  }
});
```

### Quick Demo

Experience the full enterprise features in minutes:

```bash
# Run the complete enterprise demo
node examples/enterprise-demo.js

# Run the security hardening demo
node examples/security-demo.js

# This will start:
# - Multi-tenant organization structure
# - Approval workflows with CLI prompts
# - Real-time dashboard metrics
# - Web dashboard on http://localhost:8080
# - Broker service on http://localhost:3001
```

**Demo Features:**
- 🏢 **Multi-Tenancy**: Create orgs, projects, and agents
- 🔐 **Approvals**: Test approval workflows for high-risk scopes
- 📊 **Dashboard**: Real-time metrics and monitoring
- 🌐 **Web UI**: Beautiful management interface
- 🔒 **RBAC**: Role-based access control policies

### Where to Implement Kage Keys

#### Option 1: Backend API Gateway (Recommended)

**Best for:** Teams with existing backend infrastructure

**Implementation:**
```javascript
// In your API gateway/middleware
import { withAgentKey } from '@kagehq/keys';

app.use('/api/*', async (req, res, next) => {
  const agentKey = req.headers['x-agent-key'];
  if (!agentKey) {
    return res.status(401).json({ error: 'Agent key required' });
  }

  try {
    // Validate and scope the request
    await withAgentKey(agentKey, async (token) => {
      req.validatedToken = token;
      req.scope = agentKey;
      next();
    });
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired agent key' });
  }
});

// Your API endpoints now have validated, scoped access
app.post('/api/openai/chat', async (req, res) => {
  const { validatedToken, scope } = req;
  
  // Check if scope allows this operation
  if (!scope.includes('openai:chat.create')) {
    return res.status(403).json({ error: 'Insufficient scope' });
  }

  // Make the actual OpenAI call
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    headers: { 'Authorization': `Bearer ${validatedToken}` },
    body: JSON.stringify(req.body)
  });

  res.json(await response.json());
});
```

**Benefits:**
- ✅ **Centralized control** over all AI agent access
- ✅ **Unified logging** and monitoring
- ✅ **Easy scope management** across services
- ✅ **Consistent security** policies

#### Option 2: AI Agent with Scoped Access

**Best for:** Teams building AI agents that need to call multiple APIs

**Implementation:**
```javascript
import { withAgentKey } from '@kagehq/keys';

class AIAgent {
  constructor(scope) {
    this.scope = scope;
  }

  async callOpenAI(prompt) {
    return await withAgentKey(this.scope, async (token) => {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        headers: { 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }]
        })
      });
      return response.json();
    });
  }

  async callGitHub(endpoint) {
    return await withAgentKey(this.scope, async (token) => {
      const response = await fetch(`https://api.github.com${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.json();
    });
  }
}

// Usage
const agent = new AIAgent('openai:chat.create,github:repos.read');
await agent.callOpenAI('Analyze this code...');
await agent.callGitHub('/repos/owner/repo/issues');
```

**Benefits:**
- ✅ **Agent-level scoping** for different use cases
- ✅ **Automatic token management** and renewal
- ✅ **Scope validation** before API calls
- ✅ **Clean separation** of concerns

### Migration from Traditional API Keys

#### Before (Traditional Approach)
```javascript
// Hardcoded API keys everywhere
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;

// No scope control - full access to everything
const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
  headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
  body: JSON.stringify(req.body)
});

// No expiration - keys live forever
// No audit trail - no visibility into usage
// No rate limiting - can overwhelm APIs
```

#### After (With Kage Keys)
```javascript
// Scoped, expiring tokens
await withAgentKey('openai:chat.create', async (token) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(req.body)
  });
  return response.json();
}, { expiresIn: 300 }); // 5 minutes

// Benefits:
// ✅ Scoped access - only chat.create permission
// ✅ Automatic expiration - tokens expire automatically
// ✅ Audit logging - all usage is tracked
// ✅ Rate limiting - built-in protection
```

### Quick Migration Steps

1. **Install Kage Keys**: `npm install @kagehq/keys`
2. **Replace API calls**: Wrap with `withAgentKey(scope, fn)`
3. **Define scopes**: Map your use cases to scope patterns
4. **Test locally**: Verify scoped access works correctly
5. **Deploy gradually**: Migrate one service at a time

### Benefits of This Approach

- **🔒 Security**: No more hardcoded API keys
- **📊 Visibility**: Complete audit trail of all AI agent usage
- **⚡ Performance**: Automatic token management and renewal
- **🔄 Flexibility**: Easy to change scopes without code changes
- **📈 Scalability**: Built-in rate limiting and monitoring
- **🏢 Compliance**: Enterprise-grade logging and controls

## 📖 Examples

See the `examples/` directory:

- `demo.js` - Basic SDK functionality
- `unified-sdk-demo.js` - Both modes in action
- `broker-demo.js` - Full broker system
- `enterprise-demo.js` - Complete enterprise features demo
- `security-demo.js` - Security hardening features demo

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

## 🎯 Use Cases

### SDK Mode (Immediate Value)
- **Development environments** and testing
- **Simple AI agents** with basic scope needs
- **Prototyping** and proof-of-concepts
- **Teams** getting started with AI agent security

### Broker Mode (Production Value)
- **Production AI systems** requiring compliance
- **Multi-tenant applications** with different permission levels
- **Enterprise teams** needing audit trails
- **High-security environments** with approval workflows

## 🚀 Getting Started

1. **Install**: `npm install @kagehq/keys`
2. **Basic**: Use `withAgentKey` for simple scoped keys
3. **Enhanced**: Add broker configuration when ready
4. **Advanced**: Use CLI tools for production management
5. **Enterprise**: Run enterprise demo for full features

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.
