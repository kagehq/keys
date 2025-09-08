import { HMACSigner } from '../src/signer';
import { ScopeParser } from '../src/scope';
import { SQLiteAuditLogger } from '../src/audit';
import { PolicyPacks } from '../src/policy-packs';
import { TEST_CONSTANTS, createTestToken } from './setup';
import * as fs from 'fs';

describe('Working Functionality Tests', () => {
  const testDbPath = './test-working-audit.db';

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Core Functionality', () => {
    it('should create and verify JWT tokens', async () => {
      const signer = new HMACSigner(TEST_CONSTANTS.TEST_SECRET);
      
      const payload = {
        iss: 'kage-keys',
        sub: TEST_CONSTANTS.TEST_AGENT,
        aud: 'api',
        scope: TEST_CONSTANTS.TEST_SCOPE,
        nbf: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        jti: 'test-token-123'
      };

      const token = await signer.sign(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format

      const validation = await signer.verify(token);
      expect(validation.valid).toBe(true);
      expect(validation.token?.sub).toBe(TEST_CONSTANTS.TEST_AGENT);
      expect(validation.token?.scope).toBe(TEST_CONSTANTS.TEST_SCOPE);
    });

    it('should handle scope parsing and matching', () => {
      // Parse scopes
      const scope1 = ScopeParser.parse('openai:chat.create');
      expect(scope1.service).toBe('openai');
      expect(scope1.resource).toBe('chat');
      expect(scope1.action).toBe('create');

      const scope2 = ScopeParser.parse('github:repos.*');
      expect(scope2.service).toBe('github');
      expect(scope2.resource).toBe('repos');
      expect(scope2.action).toBe('*');
      expect(scope2.isWildcard).toBe(true);

      // Match scopes
      expect(ScopeParser.matches('openai:chat.create', 'openai:chat.create')).toBe(true);
      expect(ScopeParser.matches('openai:chat.*', 'openai:chat.create')).toBe(true);
      expect(ScopeParser.matches('openai:chat.create', 'github:repos.read')).toBe(false);
    });

    it('should handle audit logging', async () => {
      const uniqueDbPath = `${testDbPath}-${Date.now()}-${Math.random()}`;
      const auditLogger = new SQLiteAuditLogger(uniqueDbPath);
      
      try {
        // Log an entry
        const logEntry = {
          timestamp: new Date().toISOString(),
          agent: TEST_CONSTANTS.TEST_AGENT,
          scope: TEST_CONSTANTS.TEST_SCOPE,
          duration: 150,
          status: 'success' as const,
          route: '/api/test',
          jti: 'test-token-123',
          tokenHash: 'hash123'
        };

        await auditLogger.log(logEntry);

        // Query logs
        const logs = await auditLogger.queryLogs({ limit: 10 });
        expect(Array.isArray(logs)).toBe(true);
        expect(logs.length).toBeGreaterThan(0);
        expect(logs[0].agent).toBe(TEST_CONSTANTS.TEST_AGENT);

        // Get stats
        const stats = await auditLogger.getStats({
          startTime: new Date(Date.now() - 3600000).toISOString(),
          endTime: new Date().toISOString()
        });
        expect(stats.totalRequests).toBe(1);
        expect(stats.successCount).toBe(1);
      } finally {
        auditLogger.close();
      }
    });
  });

  describe('Policy Packs', () => {
    it('should initialize and list policy packs', () => {
      PolicyPacks.initialize();
      
      const packs = PolicyPacks.getAllPacks();
      expect(Array.isArray(packs)).toBe(true);
      expect(packs.length).toBeGreaterThan(0);
      
      const packNames = PolicyPacks.getPackNames();
      expect(Array.isArray(packNames)).toBe(true);
      expect(packNames.length).toBeGreaterThan(0);
    });

    it('should get specific policy pack', () => {
      PolicyPacks.initialize();
      
      const pack = PolicyPacks.getPack('llm-with-tools');
      expect(pack).toBeDefined();
      expect(pack?.name).toBe('llm-with-tools');
      expect(pack?.description).toBeDefined();
      expect(pack?.scopes).toBeDefined();
      expect(pack?.routes).toBeDefined();
    });

    it('should generate project files from policy pack', () => {
      PolicyPacks.initialize();
      
      // Create test directory first
      if (!fs.existsSync('./test-project')) {
        fs.mkdirSync('./test-project', { recursive: true });
      }
      
      expect(() => {
        PolicyPacks.generateProjectFiles('llm-with-tools', './test-project');
      }).not.toThrow();
      
      // Clean up
      if (fs.existsSync('./test-project')) {
        fs.rmSync('./test-project', { recursive: true, force: true });
      }
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete token lifecycle', async () => {
      const signer = new HMACSigner(TEST_CONSTANTS.TEST_SECRET);
      const auditLogger = new SQLiteAuditLogger(testDbPath);
      
      try {
        // Create token
        const token = await createTestToken(signer);
        expect(token).toBeDefined();

        // Validate token
        const validation = await signer.verify(token);
        expect(validation.valid).toBe(true);

        // Log usage
        const logEntry = {
          timestamp: new Date().toISOString(),
          agent: TEST_CONSTANTS.TEST_AGENT,
          scope: TEST_CONSTANTS.TEST_SCOPE,
          duration: 100,
          status: 'success' as const,
          route: '/api/test',
          jti: 'test-token-123',
          tokenHash: 'hash123'
        };

        await auditLogger.log(logEntry);

        // Verify log was recorded
        const logs = await auditLogger.queryLogs({ limit: 10 });
        expect(logs.length).toBeGreaterThan(0);
        expect(logs[0].agent).toBe(TEST_CONSTANTS.TEST_AGENT);
      } finally {
        auditLogger.close();
      }
    });

    it('should handle scope validation workflow', () => {
      // Test various scope scenarios
      const testScopes = [
        'openai:chat.create',
        'openai:models.list',
        'github:repos.read',
        'github:issues.write',
        'aws:s3.read',
        'aws:s3.write'
      ];

      testScopes.forEach(scope => {
        const parsed = ScopeParser.parse(scope);
        expect(parsed.service).toBeDefined();
        expect(parsed.resource).toBeDefined();
        expect(parsed.action).toBeDefined();
      });

      // Test wildcard matching
      expect(ScopeParser.matches('openai:chat.*', 'openai:chat.create')).toBe(true);
      expect(ScopeParser.matches('openai:chat.*', 'openai:chat.complete')).toBe(true);
      expect(ScopeParser.matches('openai:chat.*', 'openai:models.list')).toBe(false);
    });

    it('should handle error scenarios gracefully', async () => {
      const signer = new HMACSigner(TEST_CONSTANTS.TEST_SECRET);

      // Test invalid token
      const validation = await signer.verify('invalid-token');
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('invalid_format');

      // Test expired token
      const expiredToken = await createTestToken(signer, {
        exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      });
      const expiredValidation = await signer.verify(expiredToken);
      expect(expiredValidation.valid).toBe(false);
      expect(expiredValidation.reason).toBe('expired');

      // Test invalid scope format
      expect(() => ScopeParser.parse('invalid-scope')).toThrow('Invalid scope format');
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle multiple concurrent operations', async () => {
      const signer = new HMACSigner(TEST_CONSTANTS.TEST_SECRET);
      const auditLogger = new SQLiteAuditLogger(testDbPath);
      
      try {
        // Create multiple tokens concurrently
        const tokenPromises = Array(10).fill(null).map((_, i) => 
          createTestToken(signer, { jti: `concurrent-token-${i}` })
        );
        
        const tokens = await Promise.all(tokenPromises);
        expect(tokens).toHaveLength(10);
        
        // Verify all tokens
        const validationPromises = tokens.map(token => signer.verify(token));
        const validations = await Promise.all(validationPromises);
        
        validations.forEach(validation => {
          expect(validation.valid).toBe(true);
        });

        // Log multiple entries concurrently
        const logPromises = Array(5).fill(null).map((_, i) => 
          auditLogger.log({
            timestamp: new Date().toISOString(),
            agent: `agent-${i}`,
            scope: 'test:resource.action',
            duration: 100 + i * 10,
            status: 'success' as const,
            route: '/api/test',
            jti: `log-${i}`,
            tokenHash: `hash-${i}`
          })
        );
        
        await Promise.all(logPromises);
        
        // Verify logs were recorded
        const logs = await auditLogger.queryLogs({ limit: 20 });
        expect(logs.length).toBeGreaterThanOrEqual(5);
      } finally {
        auditLogger.close();
      }
    });

    it('should handle large amounts of data', async () => {
      const auditLogger = new SQLiteAuditLogger(testDbPath);
      
      try {
        // Log many entries
        const logPromises = Array(100).fill(null).map((_, i) => 
          auditLogger.log({
            timestamp: new Date().toISOString(),
            agent: `agent-${i % 10}`,
            scope: `test:resource.action${i % 5}`,
            duration: 100 + (i % 50),
            status: i % 10 === 0 ? 'error' : 'success',
            route: '/api/test',
            jti: `bulk-log-${i}`,
            tokenHash: `hash-${i}`
          })
        );
        
        await Promise.all(logPromises);
        
        // Query with different filters
        const allLogs = await auditLogger.queryLogs({ limit: 1000 });
        expect(allLogs.length).toBe(100);
        
        const agentLogs = await auditLogger.queryLogs({ 
          agent: 'agent-0',
          limit: 1000 
        });
        expect(agentLogs.length).toBe(10); // agent-0 appears 10 times
        
        const stats = await auditLogger.getStats({
          startTime: new Date(Date.now() - 3600000).toISOString(),
          endTime: new Date().toISOString()
        });
        expect(stats.totalRequests).toBe(100);
        expect(stats.successCount).toBe(90);
        expect(stats.errorCount).toBe(10);
      } finally {
        auditLogger.close();
      }
    });
  });
});
