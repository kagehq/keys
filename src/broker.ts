import * as http from 'http';
import * as https from 'https';
import * as crypto from 'crypto';
import { HMACSigner } from './signer';
import { SQLiteAuditLogger } from './audit';
import { 
  ProviderConfig, 
  ScopeRoute, 
  AuditLogEntry, 
  RateLimitInfo
} from './types';

export class AgentKeyBroker {
  private signer: HMACSigner;
  private providers: Map<string, ProviderConfig> = new Map();
  private rateLimitStore: Map<string, RateLimitInfo> = new Map();
  private auditLogger: SQLiteAuditLogger;


  constructor(signer?: HMACSigner, auditDbPath?: string) {
    this.signer = signer || new HMACSigner();
    this.auditLogger = new SQLiteAuditLogger(auditDbPath);
    this.loadDefaultProviders();
  }

  async start(port: number = 3000): Promise<void> {
    const server = http.createServer(async (req, res) => {
      try {
        await this.handleRequest(req, res);
      } catch (error) {
        console.error('Request handling error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });

    server.listen(port, () => {
      console.log(`Agent Key Broker running on port ${port}`);
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const startTime = Date.now();
    
    // Extract agent key from header
    const agentKey = req.headers['x-agent-key'] as string;
    if (!agentKey) {
      await this.logAudit({
        timestamp: new Date().toISOString(),
        agent: 'unknown',
        scope: 'unknown',
        duration: Date.now() - startTime,
        status: 'unauthorized',
        route: req.url || 'unknown',
        jti: 'none',
        tokenHash: 'none'
      });
      
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing X-Agent-Key header' }));
      return;
    }

    // Validate token
    const validation = await this.signer.verify(agentKey);
    if (!validation.valid || !validation.token) {
      await this.logAudit({
        timestamp: new Date().toISOString(),
        agent: 'unknown',
        scope: 'unknown',
        duration: Date.now() - startTime,
        status: 'unauthorized',
        route: req.url || 'unknown',
        jti: 'none',
        tokenHash: this.hashToken(agentKey),
        error: validation.error
      });
      
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid agent key', reason: validation.reason }));
      return;
    }

    const token = validation.token;
    const tokenHash = this.hashToken(agentKey);

    // Check rate limits
    const rateLimitKey = `${token.sub}:${token.scope}`;
    if (!this.checkRateLimit(rateLimitKey, token.scope)) {
      await this.logAudit({
        timestamp: new Date().toISOString(),
        agent: token.sub,
        scope: token.scope,
        duration: Date.now() - startTime,
        status: 'rate_limited',
        route: req.url || 'unknown',
        jti: token.jti,
        tokenHash
      });
      
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
      return;
    }

    // Find matching route
    const route = this.findRoute(token.scope, req.method || 'GET');
    if (!route) {
      await this.logAudit({
        timestamp: new Date().toISOString(),
        agent: token.sub,
        scope: token.scope,
        duration: Date.now() - startTime,
        status: 'unauthorized',
        route: req.url || 'unknown',
        jti: token.jti,
        tokenHash
      });
      
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Scope not allowed for this route' }));
      return;
    }

    // Forward request to provider
    try {
      const providerStartTime = Date.now();
      const result = await this.forwardRequest(req, route);
      const providerLatency = Date.now() - providerStartTime;

      await this.logAudit({
        timestamp: new Date().toISOString(),
        agent: token.sub,
        scope: token.scope,
        duration: Date.now() - startTime,
        status: 'success',
        route: req.url || 'unknown',
        providerLatency,
        jti: token.jti,
        tokenHash
      });

      // Forward response
      res.writeHead(result.statusCode, result.headers);
      res.end(result.body);
    } catch (error) {
      await this.logAudit({
        timestamp: new Date().toISOString(),
        agent: token.sub,
        scope: token.scope,
        duration: Date.now() - startTime,
        status: 'error',
        route: req.url || 'unknown',
        jti: token.jti,
        tokenHash,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Provider request failed' }));
    }
  }

  private async forwardRequest(req: http.IncomingMessage, route: ScopeRoute): Promise<{
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  }> {
    return new Promise((resolve, reject) => {
      const providerUrl = new URL(route.url);
      const options = {
        hostname: providerUrl.hostname,
        port: providerUrl.port || (providerUrl.protocol === 'https:' ? 443 : 80),
        path: providerUrl.pathname + providerUrl.search,
        method: route.method,
        headers: {
          ...req.headers,
          ...route.headers,
          host: providerUrl.hostname
        }
      };

      const client = providerUrl.protocol === 'https:' ? https : http;
      const proxyReq = client.request(options, (proxyRes) => {
        let body = '';
        proxyRes.on('data', (chunk) => {
          body += chunk;
        });
        proxyRes.on('end', () => {
          resolve({
            statusCode: proxyRes.statusCode || 500,
            headers: proxyRes.headers as Record<string, string>,
            body
          });
        });
      });

      proxyReq.on('error', reject);

      // Forward request body
      req.on('data', (chunk) => {
        proxyReq.write(chunk);
      });
      req.on('end', () => {
        proxyReq.end();
      });
    });
  }

  private findRoute(scope: string, method: string): ScopeRoute | null {
    for (const provider of this.providers.values()) {
      for (const route of provider.routes) {
        if (this.matchesScope(scope, route.scope) && 
            route.method.toUpperCase() === method.toUpperCase()) {
          return route;
        }
      }
    }
    return null;
  }

  private matchesScope(tokenScope: string, routeScope: string): boolean {
    // Simple wildcard matching: openai:chat.* matches openai:chat.create
    const tokenParts = tokenScope.split(':');
    const routeParts = routeScope.split(':');
    
    if (tokenParts.length !== routeParts.length) return false;
    
    for (let i = 0; i < tokenParts.length; i++) {
      if (routeParts[i] !== '*' && routeParts[i] !== tokenParts[i]) {
        return false;
      }
    }
    return true;
  }

  private checkRateLimit(key: string, scope: string): boolean {
    const now = Date.now();
    const current = this.rateLimitStore.get(key);
    
    if (!current) {
      // Find rate limit config for this scope
      const route = this.findRoute(scope, 'GET');
      if (route?.rateLimit) {
        this.rateLimitStore.set(key, {
          remaining: route.rateLimit.requests - 1,
          reset: now + route.rateLimit.window * 1000,
          window: route.rateLimit.window
        });
        return true;
      }
      return true; // No rate limit configured
    }

    if (now > current.reset) {
      // Reset window
      const route = this.findRoute(scope, 'GET');
      if (route?.rateLimit) {
        this.rateLimitStore.set(key, {
          remaining: route.rateLimit.requests - 1,
          reset: now + route.rateLimit.window * 1000,
          window: route.rateLimit.window
        });
        return true;
      }
      return true;
    }

    if (current.remaining <= 0) {
      return false;
    }

    current.remaining--;
    return true;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async logAudit(entry: AuditLogEntry): Promise<void> {
    await this.auditLogger.log(entry);
  }

  private loadDefaultProviders(): void {
    // OpenAI provider
    this.providers.set('openai', {
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com',
      apiKey: process.env.OPENAI_API_KEY || '',
      routes: [
        {
          scope: 'openai:chat.*',
          method: 'POST',
          url: 'https://api.openai.com/v1/chat/completions',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
            'Content-Type': 'application/json'
          },
          rateLimit: { requests: 100, window: 60 }
        },
        {
          scope: 'openai:models.*',
          method: 'GET',
          url: 'https://api.openai.com/v1/models',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`
          },
          rateLimit: { requests: 50, window: 60 }
        }
      ]
    });

    // GitHub provider
    this.providers.set('github', {
      name: 'GitHub',
      baseUrl: 'https://api.github.com',
      apiKey: process.env.GITHUB_TOKEN || '',
      routes: [
        {
          scope: 'github:repos.read',
          method: 'GET',
          url: 'https://api.github.com/repos/{owner}/{repo}',
          headers: {
            'Authorization': `token ${process.env.GITHUB_TOKEN || ''}`,
            'Accept': 'application/vnd.github.v3+json'
          },
          rateLimit: { requests: 5000, window: 3600 }
        }
      ]
    });
  }

  // Public methods for management
  addProvider(provider: ProviderConfig): void {
    this.providers.set(provider.name.toLowerCase(), provider);
  }

  removeProvider(name: string): void {
    this.providers.delete(name.toLowerCase());
  }

  getProviders(): ProviderConfig[] {
    return Array.from(this.providers.values());
  }

  async revokeToken(jti: string): Promise<void> {
    await this.signer.revokeToken(jti);
  }

  async rotateKeys(): Promise<string> {
    return await this.signer.rotateKey();
  }
}


