import { MCPServer } from '../src/mcp-server';
import { AgentKeyBroker } from '../src/broker';
import { HMACSigner } from '../src/signer';
import { SQLiteAuditLogger } from '../src/audit';
import { TEST_CONSTANTS, createTestToken, waitFor } from './setup';
import * as fs from 'fs';
import * as http from 'http';

describe('MCPServer', () => {
  let mcpServer: MCPServer;
  let broker: AgentKeyBroker;
  let signer: HMACSigner;
  let auditLogger: SQLiteAuditLogger;
  const testDbPath = './test-mcp-audit.db';
  const testPort = 3002;

  beforeEach(async () => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    signer = new HMACSigner(TEST_CONSTANTS.TEST_SECRET);
    auditLogger = new SQLiteAuditLogger(testDbPath);
    broker = new AgentKeyBroker(signer, auditLogger);
    
    mcpServer = new MCPServer(broker, {
      port: testPort,
      host: 'localhost'
    });
  });

  afterEach(async () => {
    if (mcpServer) {
      await mcpServer.stop();
    }
    if (broker) {
      await broker.stop();
    }
    if (auditLogger) {
      auditLogger.close();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('constructor', () => {
    it('should create MCP server with broker', () => {
      expect(mcpServer).toBeInstanceOf(MCPServer);
    });

    it('should create MCP server with custom options', () => {
      const customServer = new MCPServer(broker, {
        port: 3003,
        host: '127.0.0.1',
        enableHTTPS: false,
        cors: {
          origins: ['https://example.com'],
          credentials: true
        },
        rateLimit: {
          windowMs: 60000,
          maxRequests: 100
        }
      });
      
      expect(customServer).toBeInstanceOf(MCPServer);
    });
  });

  describe('start', () => {
    it('should start MCP server', async () => {
      await expect(mcpServer.start()).resolves.not.toThrow();
      
      // Verify server is running by making a request
      const response = await makeMCPRequest('ping', {});
      expect(response.jsonrpc).toBe('2.0');
    });
  });

  describe('stop', () => {
    it('should stop MCP server', async () => {
      await mcpServer.start();
      await expect(mcpServer.stop()).resolves.not.toThrow();
    });
  });

  describe('MCP Protocol Methods', () => {
    beforeEach(async () => {
      await mcpServer.start();
    });

    describe('ping', () => {
      it('should respond to ping request', async () => {
        const response = await makeMCPRequest('ping', {});
        
        expect(response.jsonrpc).toBe('2.0');
        expect(response.result).toBeDefined();
        expect(response.result.pong).toBe(true);
      });
    });

    describe('list_tools', () => {
      it('should list available tools', async () => {
        const response = await makeMCPRequest('list_tools', {});
        
        expect(response.jsonrpc).toBe('2.0');
        expect(response.result).toBeDefined();
        expect(response.result.tools).toBeDefined();
        expect(Array.isArray(response.result.tools)).toBe(true);
      });
    });

    describe('call_tool', () => {
      it('should call a tool with valid parameters', async () => {
        const response = await makeMCPRequest('call_tool', {
          name: 'create_token',
          arguments: {
            agent: TEST_CONSTANTS.TEST_AGENT,
            scope: TEST_CONSTANTS.TEST_SCOPE,
            expiresIn: 3600
          }
        });
        
        expect(response.jsonrpc).toBe('2.0');
        expect(response.result).toBeDefined();
      });

      it('should return error for invalid tool', async () => {
        const response = await makeMCPRequest('call_tool', {
          name: 'nonexistent_tool',
          arguments: {}
        });
        
        expect(response.jsonrpc).toBe('2.0');
        expect(response.error).toBeDefined();
        expect(response.error.code).toBe(-32601); // Method not found
      });

      it('should return error for invalid parameters', async () => {
        const response = await makeMCPRequest('call_tool', {
          name: 'create_token',
          arguments: {
            // Missing required parameters
          }
        });
        
        expect(response.jsonrpc).toBe('2.0');
        expect(response.error).toBeDefined();
        expect(response.error.code).toBe(-32602); // Invalid params
      });
    });

    describe('list_resources', () => {
      it('should list available resources', async () => {
        const response = await makeMCPRequest('list_resources', {});
        
        expect(response.jsonrpc).toBe('2.0');
        expect(response.result).toBeDefined();
        expect(response.result.resources).toBeDefined();
        expect(Array.isArray(response.result.resources)).toBe(true);
      });
    });

    describe('read_resource', () => {
      it('should read a resource', async () => {
        const response = await makeMCPRequest('read_resource', {
          uri: 'config://broker'
        });
        
        expect(response.jsonrpc).toBe('2.0');
        expect(response.result).toBeDefined();
      });

      it('should return error for invalid resource', async () => {
        const response = await makeMCPRequest('read_resource', {
          uri: 'invalid://resource'
        });
        
        expect(response.jsonrpc).toBe('2.0');
        expect(response.error).toBeDefined();
        expect(response.error.code).toBe(-32602); // Invalid params
      });
    });

    describe('list_prompts', () => {
      it('should list available prompts', async () => {
        const response = await makeMCPRequest('list_prompts', {});
        
        expect(response.jsonrpc).toBe('2.0');
        expect(response.result).toBeDefined();
        expect(response.result.prompts).toBeDefined();
        expect(Array.isArray(response.result.prompts)).toBe(true);
      });
    });

    describe('get_prompt', () => {
      it('should get a prompt', async () => {
        const response = await makeMCPRequest('get_prompt', {
          name: 'create_token_prompt',
          arguments: {
            agent: TEST_CONSTANTS.TEST_AGENT,
            scope: TEST_CONSTANTS.TEST_SCOPE
          }
        });
        
        expect(response.jsonrpc).toBe('2.0');
        expect(response.result).toBeDefined();
      });

      it('should return error for invalid prompt', async () => {
        const response = await makeMCPRequest('get_prompt', {
          name: 'nonexistent_prompt',
          arguments: {}
        });
        
        expect(response.jsonrpc).toBe('2.0');
        expect(response.error).toBeDefined();
        expect(response.error.code).toBe(-32601); // Method not found
      });
    });
  });

  describe('Authentication', () => {
    beforeEach(async () => {
      await mcpServer.start();
    });

    it('should authenticate with valid token', async () => {
      const token = await createTestToken(signer, {
        scope: 'mcp:tools.call'
      });

      const response = await makeMCPRequest('list_tools', {}, {
        'Authorization': `Bearer ${token}`
      });
      
      expect(response.jsonrpc).toBe('2.0');
      expect(response.result).toBeDefined();
    });

    it('should reject invalid token', async () => {
      const response = await makeMCPRequest('list_tools', {}, {
        'Authorization': 'Bearer invalid-token'
      });
      
      expect(response.jsonrpc).toBe('2.0');
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32001); // Unauthorized
    });

    it('should reject request without token', async () => {
      const response = await makeMCPRequest('list_tools', {});
      
      expect(response.jsonrpc).toBe('2.0');
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32001); // Unauthorized
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      await mcpServer.start();
    });

    it('should enforce rate limits', async () => {
      // Make many requests quickly
      const promises = Array(150).fill(null).map(() => 
        makeMCPRequest('ping', {})
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.error && r.error.code === -32002);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await mcpServer.start();
    });

    it('should handle malformed JSON', async () => {
      const response = await makeRawRequest('{"jsonrpc":"2.0","method":"ping","id":1}');
      expect(response.jsonrpc).toBe('2.0');
    });

    it('should handle invalid JSON-RPC version', async () => {
      const response = await makeMCPRequest('ping', {}, {}, '1.0');
      
      expect(response.jsonrpc).toBe('2.0');
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32600); // Invalid Request
    });

    it('should handle missing method', async () => {
      const response = await makeMCPRequest('', {});
      
      expect(response.jsonrpc).toBe('2.0');
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32600); // Invalid Request
    });

    it('should handle missing id', async () => {
      const response = await makeMCPRequest('ping', {}, {}, '2.0', null);
      
      expect(response.jsonrpc).toBe('2.0');
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32600); // Invalid Request
    });
  });

  describe('CORS', () => {
    beforeEach(async () => {
      await mcpServer.start();
    });

    it('should handle preflight requests', async () => {
      const response = await makeRawRequest('', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization'
        }
      });
      
      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Logging', () => {
    beforeEach(async () => {
      await mcpServer.start();
    });

    it('should log MCP requests', async () => {
      await makeMCPRequest('ping', {});
      
      // Wait for audit log to be written
      await waitFor(100);

      const logs = await auditLogger.getLogs();
      expect(logs.length).toBeGreaterThan(0);
      
      const lastLog = logs[0];
      expect(lastLog.route).toContain('mcp');
    });
  });
});

// Helper function to make MCP requests
function makeMCPRequest(method: string, params: any, headers: any = {}, jsonrpc: string = '2.0', id: string | number | null = 1): Promise<any> {
  const request = {
    jsonrpc,
    method,
    params,
    id
  };

  return makeRawRequest(JSON.stringify(request), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

// Helper function to make raw HTTP requests
function makeRawRequest(body: string, options: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      hostname: 'localhost',
      port: 3002,
      path: '/mcp',
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...options.headers
      }
    };

    const req = http.request(requestOptions, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = responseBody ? JSON.parse(responseBody) : {};
          resolve({
            ...parsed,
            statusCode: res.statusCode,
            headers: res.headers
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseBody
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(body);
    }

    req.end();
  });
}
