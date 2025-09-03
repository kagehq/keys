import { AgentKeyBroker } from './index';
import { ScopeCatalog } from './scope';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';

export interface MCPServerOptions {
  port?: number;
  host?: string;
  enableHTTPS?: boolean;
  enableMTLS?: boolean;
  certPath?: string;
  keyPath?: string;
  caPath?: string;
  cors?: {
    origins: string[];
    credentials: boolean;
  };
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
}

export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class MCPServer {
  private broker: AgentKeyBroker;
  private server!: http.Server | https.Server;
  private options: MCPServerOptions;
  private rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(broker: AgentKeyBroker, options: MCPServerOptions = {}) {
    this.broker = broker;
    this.options = {
      port: 3001,
      host: 'localhost',
      enableHTTPS: false,
      enableMTLS: false,
      cors: {
        origins: ['*'],
        credentials: false
      },
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100
      },
      ...options
    };
  }

  async start(): Promise<void> {
    console.log(`🚀 Starting MCP Server on ${this.options.host}:${this.options.port}...`);
    
    if (this.options.enableHTTPS) {
      this.server = this.createHTTPSServer();
    } else {
      this.server = this.createHTTPServer();
    }

    this.server.on('request', this.handleRequest.bind(this));
    this.server.on('error', this.handleError.bind(this));

    return new Promise((resolve, reject) => {
      this.server.listen(this.options.port, this.options.host, () => {
        console.log(`✅ MCP Server running on ${this.options.enableHTTPS ? 'https' : 'http'}://${this.options.host}:${this.options.port}`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('🛑 MCP Server stopped');
          resolve();
        });
      });
    }
  }

  private createHTTPServer(): http.Server {
    return http.createServer();
  }

  private createHTTPSServer(): https.Server {
    if (!this.options.certPath || !this.options.keyPath) {
      throw new Error('Certificate and key paths required for HTTPS');
    }

    const options: https.ServerOptions = {
      cert: fs.readFileSync(this.options.certPath),
      key: fs.readFileSync(this.options.keyPath),
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.3'
    };

    if (this.options.enableMTLS && this.options.caPath) {
      options.ca = fs.readFileSync(this.options.caPath);
      options.requestCert = true;
      options.rejectUnauthorized = true;
    }

    return https.createServer(options);
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Set CORS headers
    this.setCORSHeaders(req, res);

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Rate limiting
    if (!this.checkRateLimit(req)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32000,
          message: 'Rate limit exceeded'
        }
      }));
      return;
    }

    // Parse JSON-RPC request
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const request: MCPRequest = JSON.parse(body);
        const response = await this.handleMCPRequest(request);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: 'Parse error',
            data: error instanceof Error ? error.message : String(error)
          }
        }));
      }
    });
  }

  private async handleMCPRequest(request: MCPRequest): Promise<MCPResponse> {
    const { method, params, id } = request;

    try {
      switch (method) {
        case 'initialize':
          return this.handleInitialize(params, id);
        
        case 'tools/list':
          return this.handleToolsList(params, id);
        
        case 'tools/call':
          return this.handleToolsCall(params, id);
        
        case 'auth/validate':
          return this.handleAuthValidate(params, id);
        
        case 'auth/scope':
          return this.handleAuthScope(params, id);
        
        case 'broker/health':
          return this.handleBrokerHealth(params, id);
        
        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: 'Method not found'
            }
          };
      }
            } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  private handleInitialize(_params: any, id: string | number): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        },
        serverInfo: {
          name: 'Kage Keys MCP Server',
          version: '0.4.1'
        }
      }
    };
  }

  private handleToolsList(_params: any, id: string | number): MCPResponse {
    const tools = [
      {
        name: 'validate_agent_key',
        description: 'Validate an agent key and return scope information',
        inputSchema: {
          type: 'object',
          properties: {
            agent_key: {
              type: 'string',
              description: 'The agent key to validate'
            }
          },
          required: ['agent_key']
        }
      },
      {
        name: 'get_available_scopes',
        description: 'Get list of available scopes for the current agent',
        inputSchema: {
          type: 'object',
          properties: {
            agent_key: {
              type: 'string',
              description: 'The agent key to check scopes for'
            }
          },
          required: ['agent_key']
        }
      },
      {
        name: 'check_scope_permission',
        description: 'Check if an agent has permission for a specific scope',
        inputSchema: {
          type: 'object',
          properties: {
            agent_key: {
              type: 'string',
              description: 'The agent key to check'
            },
            scope: {
              type: 'string',
              description: 'The scope to check permission for'
            }
          },
          required: ['agent_key', 'scope']
        }
      }
    ];

    return {
      jsonrpc: '2.0',
      id,
      result: { tools }
    };
  }

  private async handleToolsCall(params: any, id: string | number): Promise<MCPResponse> {
    const { name, arguments: args } = params;

    try {
      switch (name) {
        case 'validate_agent_key':
          return await this.validateAgentKey(args, id);
        
        case 'get_available_scopes':
          return await this.getAvailableScopes(args, id);
        
        case 'check_scope_permission':
          return await this.checkScopePermission(args, id);
        
        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: 'Tool not found'
            }
          };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: 'Tool execution failed',
          data: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  private async validateAgentKey(args: any, id: string | number): Promise<MCPResponse> {
    const { agent_key } = args;
    
    try {
      // Validate the agent key using the broker
      const validationResult = await this.broker.validateToken(agent_key);
      
      if (validationResult) {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            valid: true,
            agent: validationResult.agent,
            scopes: validationResult.scope,
            jti: validationResult.jti
          }
        };
      } else {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            valid: false,
            error: 'Invalid token'
          }
        };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: 'Token validation failed',
          data: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  private async getAvailableScopes(args: any, id: string | number): Promise<MCPResponse> {
    const { agent_key } = args;
    
    try {
      // Validate the agent key first
      const validationResult = await this.broker.validateToken(agent_key);
      
      if (!validationResult) {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            scopes: [],
            error: 'Invalid agent key'
          }
        };
      }

      // Get available scopes from the scope catalog
      const availableScopes = ScopeCatalog.getAllCatalogs();
      
      return {
        jsonrpc: '2.0',
        id,
        result: {
          scopes: availableScopes,
          agent: validationResult.agent
        }
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: 'Failed to get available scopes',
          data: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  private async checkScopePermission(args: any, id: string | number): Promise<MCPResponse> {
    const { agent_key, scope } = args;
    
    try {
      // Validate the agent key first
      const validationResult = await this.broker.validateToken(agent_key);
      
      if (!validationResult) {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            has_permission: false,
            error: 'Invalid agent key'
          }
        };
      }

      // Check if the agent has permission for the requested scope
              const agentScopes = Array.isArray(validationResult.scope) ? validationResult.scope : [validationResult.scope];
      const hasPermission = this.checkScopeMatch(agentScopes, scope);
      
      return {
        jsonrpc: '2.0',
        id,
        result: {
          has_permission: hasPermission,
          requested_scope: scope,
          agent_scopes: agentScopes
        }
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: 'Failed to check scope permission',
          data: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  private async handleAuthValidate(params: any, id: string | number): Promise<MCPResponse> {
    // Direct auth validation endpoint
    return await this.handleToolsCall({
      name: 'validate_agent_key',
      arguments: params
    }, id);
  }

  private async handleAuthScope(params: any, id: string | number): Promise<MCPResponse> {
    // Direct scope checking endpoint
    return await this.handleToolsCall({
      name: 'check_scope_permission',
      arguments: params
    }, id);
  }

  private handleBrokerHealth(_params: any, id: string | number): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '0.4.1'
      }
    };
  }

  private checkScopeMatch(agentScopes: string[], requestedScope: string): boolean {
    // Simple scope matching - can be enhanced with wildcard support
    return agentScopes.includes(requestedScope);
  }

  private setCORSHeaders(req: http.IncomingMessage, res: http.ServerResponse): void {
    const origin = req.headers.origin;
    
    if (this.options.cors?.origins?.includes('*') || (origin && this.options.cors?.origins?.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (this.options.cors?.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }

  private checkRateLimit(req: http.IncomingMessage): boolean {
    const clientId = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const windowMs = this.options.rateLimit?.windowMs || 15 * 60 * 1000;
    const maxRequests = this.options.rateLimit?.maxRequests || 100;

    const clientLimit = this.rateLimitMap.get(clientId);
    
    if (!clientLimit || now > clientLimit.resetTime) {
      this.rateLimitMap.set(clientId, {
        count: 1,
        resetTime: now + windowMs
      });
      return true;
    }

    if (clientLimit.count >= maxRequests) {
      return false;
    }

    clientLimit.count++;
    return true;
  }

  private handleError(error: Error): void {
    console.error('MCP Server error:', error);
  }
}

// Convenience function to start MCP server with broker
export async function startMCPServer(
  broker: AgentKeyBroker,
  options: MCPServerOptions = {}
): Promise<MCPServer> {
  const mcpServer = new MCPServer(broker, options);
  await mcpServer.start();
  return mcpServer;
}
