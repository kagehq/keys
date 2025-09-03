// Core SDK exports
export { HMACSigner } from './signer';
export { ScopeParser, ScopeCatalog } from './scope';

// Broker and Audit
export { AgentKeyBroker } from './broker';
export { SQLiteAuditLogger } from './audit';

// CLI is available via command line: npx kage-keys

// Export Phase 3 Enterprise Features
export * from './enterprise-types';
export { ApprovalManager } from './approval';
export { TenancyManager } from './tenancy';
export { Dashboard } from './dashboard';
export { WebDashboard } from './web-dashboard';

// Security Hardening Features
export { SecurityManager, SecurityConfig } from './security';

// Import types for convenience functions
import { HMACSigner } from './signer';
import { ScopeParser } from './scope';
import { AgentKeyBroker } from './broker';
import { SQLiteAuditLogger } from './audit';

// Core convenience functions
export async function withAgentKey<T>(
  agentKey: string,
  callback: (token: any) => Promise<T>
): Promise<T> {
  const signer = new HMACSigner();
  const validation = await signer.verify(agentKey);
  
  if (!validation.valid || !validation.token) {
    throw new Error(`Invalid agent key: ${validation.reason || 'Unknown error'}`);
  }

  return await callback(validation.token);
}

export async function withBrokeredAPI<T>(
  brokerUrl: string,
  agentKey: string,
  callback: (response: any) => Promise<T>
): Promise<T> {
  const response = await fetch(brokerUrl, {
    headers: {
      'X-Agent-Key': agentKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Broker request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return await callback(data);
}

// Broker management functions
export async function startBroker(
  port: number = 3000,
  auditDbPath?: string
): Promise<AgentKeyBroker> {
  const signer = new HMACSigner();
  const auditLogger = new SQLiteAuditLogger(auditDbPath);
  const broker = new AgentKeyBroker(signer, auditLogger);
  
  await broker.start(port);
  return broker;
}

export async function createToken(
  agent: string,
  scope: string,
  expiresIn: number = 3600,
  auditDbPath?: string
): Promise<string> {
  const signer = new HMACSigner();
  const auditLogger = new SQLiteAuditLogger(auditDbPath);
  
  const token = await signer.sign({
    iss: 'kage-keys',
    sub: agent,
    aud: 'api',
    scope: scope,
    nbf: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresIn,
    jti: `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  });

  // Log token creation
  await auditLogger.log({
    timestamp: new Date().toISOString(),
    agent: agent,
    scope: scope,
    duration: 0,
    status: 'success',
    route: 'token-creation',
    jti: token,
    tokenHash: Buffer.from(token).toString('base64').substr(0, 16)
  });

  return token;
}

export async function validateScope(
  tokenScope: string,
  requiredScope: string
): Promise<boolean> {
  return ScopeParser.matches(tokenScope, requiredScope);
}

export async function parseScope(scope: string): Promise<any> {
  return ScopeParser.parse(scope);
}

export async function expandScopeBundle(bundleName: string): Promise<string[]> {
  // This would load from a predefined bundle configuration
  const bundles: Record<string, string[]> = {
    'openai-basic': ['openai:chat.create', 'openai:models.list'],
    'github-read': ['github:repos.read', 'github:issues.read'],
    'slack-basic': ['slack:channels.read', 'slack:users.read']
  };

  return bundles[bundleName] || [];
}
