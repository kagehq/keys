export interface AgentToken {
  iss: string;        // Issuer (e.g., "kage-keys")
  sub: string;        // Subject (agent identifier)
  aud: string;        // Audience (service identifier)
  scope: string;      // Scope (e.g., "openai:chat.create")
  nbf: number;        // Not before (timestamp)
  exp: number;        // Expiration (timestamp)
  jti: string;        // JWT ID (unique identifier)
  kid?: string;       // Key ID (for key rotation)
}

export interface TokenPayload {
  iss: string;
  sub: string;
  aud: string;
  scope: string;
  nbf: number;
  exp: number;
  jti: string;
  kid?: string;
}

export interface TokenValidationResult {
  valid: boolean;
  token?: AgentToken;
  error?: string;
  reason?: 'expired' | 'not_yet_valid' | 'invalid_signature' | 'invalid_format' | 'revoked';
}

export interface SignerOptions {
  algorithm?: 'HS256' | 'HS384' | 'HS512' | 'ES256' | 'ES384' | 'ES512';
  keyId?: string;
}

export interface Signer {
  sign(payload: TokenPayload, options?: SignerOptions): Promise<string>;
  verify(token: string): Promise<TokenValidationResult>;
  rotateKey(): Promise<string>; // Returns new key ID
  revokeToken(jti: string): Promise<void>;
  isTokenRevoked(jti: string): Promise<boolean>;
}

export interface ScopeRoute {
  scope: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  rateLimit?: {
    requests: number;
    window: number; // seconds
  };
}

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  routes: ScopeRoute[];
}

export interface AuditLogEntry {
  timestamp: string;
  agent: string;
  scope: string;
  duration: number; // milliseconds
  status: 'success' | 'error' | 'rate_limited' | 'unauthorized';
  route: string;
  method?: string;
  providerLatency?: number;
  jti: string;
  tokenHash: string; // hash(token) for security
  error?: string;
}

export interface RateLimitInfo {
  remaining: number;
  reset: number; // timestamp
  window: number; // seconds
}
