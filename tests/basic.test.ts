import { HMACSigner } from '../src/signer';
import { ScopeParser } from '../src/scope';
import { SQLiteAuditLogger } from '../src/audit';
import { TEST_CONSTANTS, createTestToken } from './setup';
import * as fs from 'fs';

describe('Basic Functionality Tests', () => {
  const testDbPath = './test-basic-audit.db';

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

  describe('HMACSigner', () => {
    let signer: HMACSigner;

    beforeEach(() => {
      signer = new HMACSigner(TEST_CONSTANTS.TEST_SECRET);
    });

    it('should create and verify tokens', async () => {
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

      const validation = await signer.verify(token);
      expect(validation.valid).toBe(true);
      expect(validation.token?.sub).toBe(TEST_CONSTANTS.TEST_AGENT);
    });

    it('should reject expired tokens', async () => {
      const expiredPayload = {
        iss: 'kage-keys',
        sub: TEST_CONSTANTS.TEST_AGENT,
        aud: 'api',
        scope: TEST_CONSTANTS.TEST_SCOPE,
        nbf: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600,
        jti: 'expired-token-123'
      };

      const token = await signer.sign(expiredPayload);
      const validation = await signer.verify(token);
      
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('expired');
    });

    it('should reject invalid tokens', async () => {
      const validation = await signer.verify('invalid-token');
      
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('invalid_format');
    });
  });

  describe('ScopeParser', () => {
    it('should parse valid scope strings', () => {
      const scope = 'openai:chat.create';
      const parsed = ScopeParser.parse(scope);
      
      expect(parsed.service).toBe('openai');
      expect(parsed.resource).toBe('chat');
      expect(parsed.action).toBe('create');
      expect(parsed.isWildcard).toBe(false);
    });

    it('should parse wildcard scopes', () => {
      const scope = 'github:repos.*';
      const parsed = ScopeParser.parse(scope);
      
      expect(parsed.service).toBe('github');
      expect(parsed.resource).toBe('repos');
      expect(parsed.action).toBe('*');
      expect(parsed.isWildcard).toBe(true);
    });

    it('should match scopes correctly', () => {
      expect(ScopeParser.matches('openai:chat.create', 'openai:chat.create')).toBe(true);
      expect(ScopeParser.matches('openai:chat.*', 'openai:chat.create')).toBe(true);
      expect(ScopeParser.matches('openai:chat.create', 'github:repos.read')).toBe(false);
    });

    it('should throw error for invalid scope format', () => {
      expect(() => ScopeParser.parse('invalid-scope')).toThrow('Invalid scope format');
    });
  });

  describe('SQLiteAuditLogger', () => {
    let auditLogger: SQLiteAuditLogger;

    beforeEach(() => {
      const uniqueDbPath = `${testDbPath}-${Date.now()}-${Math.random()}`;
      auditLogger = new SQLiteAuditLogger(uniqueDbPath);
    });

    afterEach(() => {
      auditLogger.close();
    });

    it('should log audit entries', async () => {
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

      await expect(auditLogger.log(logEntry)).resolves.not.toThrow();
    });

    it('should log rate limit events', async () => {
      await expect(auditLogger.logRateLimit(
        TEST_CONSTANTS.TEST_AGENT,
        TEST_CONSTANTS.TEST_SCOPE,
        0,
        new Date(Date.now() + 3600000).toISOString()
      )).resolves.not.toThrow();
    });

    it('should query logs', async () => {
      // First log an entry
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

      // Then query it
      const logs = await auditLogger.queryLogs({
        limit: 10
      });

      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should get statistics', async () => {
      // Log some test data
      const logs = [
        {
          timestamp: new Date().toISOString(),
          agent: 'agent1',
          scope: 'openai:chat.create',
          duration: 100,
          status: 'success' as const,
          route: '/api/chat',
          jti: 'token1',
          tokenHash: 'hash1'
        },
        {
          timestamp: new Date().toISOString(),
          agent: 'agent2',
          scope: 'github:repos.read',
          duration: 200,
          status: 'error' as const,
          route: '/api/repos',
          jti: 'token2',
          tokenHash: 'hash2',
          error: 'Unauthorized'
        }
      ];

      for (const log of logs) {
        await auditLogger.log(log);
      }

      const stats = await auditLogger.getStats({
        startTime: new Date(Date.now() - 3600000).toISOString(),
        endTime: new Date().toISOString()
      });

      expect(stats.totalRequests).toBe(2);
      expect(stats.successCount).toBe(1);
      expect(stats.errorCount).toBe(1);
    });
  });

  describe('Integration Test', () => {
    it('should work with token creation and validation', async () => {
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
      } finally {
        auditLogger.close();
      }
    });
  });
});
