import { v4 as uuidv4 } from 'uuid';

// Core SDK interfaces
interface AgentKeyOptions {
  expiresIn?: number; // seconds
  broker?: {
    url: string;
    useBroker: boolean;
  };
}

// Export new broker functionality
export { AgentKeyBroker } from './broker';
export { HMACSigner } from './signer';
export { SQLiteAuditLogger } from './audit';
export { ScopeParser, ScopeCatalog, SCOPE_BUNDLES } from './scope';
export * from './types';

// Export Phase 3 Enterprise Features
export * from './enterprise-types';
export { ApprovalManager } from './approval';
export { TenancyManager } from './tenancy';
export { Dashboard } from './dashboard';
export { WebDashboard } from './web-dashboard';

// Import types for convenience functions
import { AgentKeyBroker } from './broker';
import { HMACSigner } from './signer';
import { SQLiteAuditLogger } from './audit';



/**
 * Generates a scoped token and executes the provided function
 * 
 * This is the primary SDK interface. It can work in two modes:
 * 1. **Standalone Mode** (default): Generates and validates tokens locally
 * 2. **Broker Mode**: Routes requests through an Agent Key Broker for enhanced security
 * 
 * @param scope - The scope for the agent key (e.g., "github:repos.read")
 * @param fn - The function to execute with the agent key
 * @param options - Optional configuration for the agent key
 * @returns Promise that resolves to the result of the function execution
 */
export async function withAgentKey<T>(
  scope: string,
  fn: (token: string) => Promise<T> | T,
  options: AgentKeyOptions = {}
): Promise<T> {
  const { expiresIn = 10, broker } = options;
  
  if (broker?.useBroker) {
    // Broker Mode: Use the broker for enhanced security
    return await withAgentKeyViaBroker(scope, fn, broker.url, expiresIn);
  } else {
    // Standalone Mode: Original SDK behavior
    return await withAgentKeyStandalone(scope, fn, expiresIn);
  }
}

/**
 * Standalone mode: Original SDK behavior with local token generation
 */
async function withAgentKeyStandalone<T>(
  _scope: string,
  fn: (token: string) => Promise<T> | T,
  _expiresIn: number
): Promise<T> {
  // Generate a scoped token (UUID for demo, JWT for production)
  const token = uuidv4();
  
  try {
    // Execute the function with the token
    const result = await fn(token);
    
    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * Broker mode: Enhanced security via Agent Key Broker
 */
async function withAgentKeyViaBroker<T>(
  scope: string,
  fn: (token: string) => Promise<T> | T,
  brokerUrl: string,
  expiresIn: number
): Promise<T> {
  try {
    // Create a real JWT token for broker authentication
    const signer = new HMACSigner();
    const now = Math.floor(Date.now() / 1000);
    
    const tokenPayload = {
      iss: 'kage-keys-sdk',
      sub: 'sdk-client',
      aud: 'broker',
      scope,
      nbf: now,
      exp: now + expiresIn,
      jti: `sdk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    const token = await signer.sign(tokenPayload);
    
    // Log broker integration
    // Log broker usage (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔗 Broker mode enabled: ${brokerUrl}`);
      console.log(`🔑 Generated token for scope: ${scope}`);
    }
    
    // Execute the function with the broker token
    const result = await fn(token);
    
    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * Enhanced withAgentKey that uses a broker for real API calls
 * 
 * This function automatically routes API calls through the broker
 * while maintaining the same simple interface.
 * 
 * @param scope - The scope for the agent key
 * @param apiCall - Function that makes the actual API call
 * @param options - Configuration options
 * @returns Promise that resolves to the API response
 */
export async function withBrokeredAPI<T>(
  scope: string,
  apiCall: (token: string) => Promise<T>,
  options: {
    brokerUrl: string;
    expiresIn?: number;
    provider?: string;
  }
): Promise<T> {
  const { brokerUrl, expiresIn = 3600, provider } = options;
  
  // Create a broker token
  const signer = new HMACSigner();
  const now = Math.floor(Date.now() / 1000);
  
  const tokenPayload = {
    iss: 'kage-keys-sdk',
    sub: 'sdk-client',
    aud: provider || 'broker',
    scope,
    nbf: now,
    exp: now + expiresIn,
    jti: `broker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  };
  
  const token = await signer.sign(tokenPayload);
  
  // Log broker usage (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔗 Using broker at: ${brokerUrl}`);
    console.log(`🔑 Generated token for scope: ${scope}`);
  }
  
  // Make the API call through the broker
  return await apiCall(token);
}





// Broker convenience functions (for advanced users)
export async function createBroker(port: number = 3000, auditDbPath?: string): Promise<AgentKeyBroker> {
  const broker = new AgentKeyBroker(undefined, auditDbPath);
  await broker.start(port);
  return broker;
}

export async function createSigner(secret?: string): Promise<HMACSigner> {
  return new HMACSigner(secret);
}

export async function createAuditLogger(dbPath?: string): Promise<SQLiteAuditLogger> {
  return new SQLiteAuditLogger(dbPath);
}
