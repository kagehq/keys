import { HMACSigner } from '../src/signer';
import { ScopeCatalog } from '../src/scope';
import { SQLiteAuditLogger } from '../src/audit';
import { ApprovalManager } from '../src/approval';
import { Dashboard } from '../src/dashboard';
import { SecurityManager } from '../src/security';
import { PolicyPacks } from '../src/policy-packs';
import { TEST_CONSTANTS, createTestToken } from './setup';
import * as fs from 'fs';

describe('Comprehensive API Tests', () => {
  const testDbPath = './test-comprehensive-audit.db';
  const approvalDataDir = './test-approval-data';

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(approvalDataDir)) {
      fs.rmSync(approvalDataDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(approvalDataDir)) {
      fs.rmSync(approvalDataDir, { recursive: true, force: true });
    }
  });

  describe('Audit Logger API', () => {
    let auditLogger: SQLiteAuditLogger;

    beforeEach(() => {
      auditLogger = new SQLiteAuditLogger(testDbPath);
    });

    afterEach(() => {
      auditLogger.close();
    });

    it('should support getLogs method', async () => {
      // Log some test data
      await auditLogger.log({
        timestamp: new Date().toISOString(),
        agent: 'test-agent',
        scope: 'test:resource.action',
        duration: 100,
        status: 'success',
        route: '/api/test',
        jti: 'test-token',
        tokenHash: 'hash123'
      });

      const logs = await auditLogger.getLogs({ limit: 10 });
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should support getRateLimitLogs method', async () => {
      await auditLogger.logRateLimit('test-agent', 'test:scope', 5, new Date().toISOString());

      const rateLimitLogs = await auditLogger.getRateLimitLogs({ limit: 10 });
      expect(Array.isArray(rateLimitLogs)).toBe(true);
    });

    it('should support cleanup method', async () => {
      const deletedCount = await auditLogger.cleanup(30);
      expect(typeof deletedCount).toBe('number');
      expect(deletedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Approval Manager API', () => {
    let approvalManager: ApprovalManager;

    beforeEach(() => {
      approvalManager = new ApprovalManager({ dataDir: approvalDataDir });
    });

    it('should support createRequest method', async () => {
      const request = {
        id: 'test-request-123',
        orgId: 'test-org',
        projectId: 'test-project',
        agentId: 'test-agent',
        scope: 'test:resource.action',
        expiresIn: 3600,
        requestedAt: new Date().toISOString(),
        status: 'pending' as const,
        approvers: [],
        metadata: { context: 'Test request' }
      };

      const result = await approvalManager.createRequest(request);
      expect(result).toBeDefined();
      expect(result.id).toBe('test-request-123');
    });

    it('should support getRequest method', async () => {
      const request = await approvalManager.getRequest('non-existent-request');
      expect(request).toBeNull();
    });

    it('should support getRequests method', async () => {
      const requests = await approvalManager.getRequests({ limit: 10 });
      expect(Array.isArray(requests)).toBe(true);
    });

    it('should support getPendingRequests method', async () => {
      const pendingRequests = await approvalManager.getPendingRequests();
      expect(Array.isArray(pendingRequests)).toBe(true);
    });

    it('should support expireRequests method', async () => {
      const expiredCount = await approvalManager.expireRequests();
      expect(typeof expiredCount).toBe('number');
      expect(expiredCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Dashboard API', () => {
    let dashboard: Dashboard;
    let auditLogger: SQLiteAuditLogger;

    beforeEach(() => {
      auditLogger = new SQLiteAuditLogger(testDbPath);
      dashboard = new Dashboard({ 
        auditLogger,
        enableLiveStreaming: false,
        updateIntervalMs: 0 // Disable automatic updates
      });
    });

    afterEach(() => {
      dashboard.stop();
      auditLogger.close();
    });

    it('should support getTimeSeriesData method', async () => {
      const timeRange = {
        start: new Date(Date.now() - 3600000).toISOString(),
        end: new Date().toISOString()
      };

      const timeSeries = await dashboard.getTimeSeriesData('requests', timeRange);
      expect(Array.isArray(timeSeries)).toBe(true);
    });

    it('should support getTopAgents method', async () => {
      const topAgents = await dashboard.getTopAgents('requests', 5);
      expect(Array.isArray(topAgents)).toBe(true);
    });

    it('should support getTopProviders method', async () => {
      const topProviders = await dashboard.getTopProviders('requests', 5);
      expect(Array.isArray(topProviders)).toBe(true);
    });

    it('should support getSlowEndpoints method', async () => {
      const slowEndpoints = await dashboard.getSlowEndpoints(5);
      expect(Array.isArray(slowEndpoints)).toBe(true);
    });

    it('should support stop method', () => {
      expect(() => dashboard.stop()).not.toThrow();
    });
  });

  describe('Security Manager API', () => {
    let securityManager: SecurityManager;

    beforeEach(() => {
      securityManager = new SecurityManager();
    });

    it('should support getConfig method', () => {
      const config = securityManager.getConfig();
      expect(config).toBeDefined();
      expect(config.tls).toBeDefined();
      expect(config.cors).toBeDefined();
    });

    it('should support sanitizeInput method', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const sanitized = securityManager.sanitizeInput(maliciousInput);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
    });

    it('should support encryptSensitiveData and decryptSensitiveData methods', () => {
      const sensitiveData = 'secret-password-123';
      const encrypted = securityManager.encryptSensitiveData(sensitiveData);
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(sensitiveData);

      const decrypted = securityManager.decryptSensitiveData(encrypted);
      expect(decrypted).toBe(sensitiveData);
    });

    it('should support checkRateLimit method', () => {
      const result = securityManager.checkRateLimit('test-client');
      expect(result).toBeDefined();
      expect(typeof result.allowed).toBe('boolean');
      expect(typeof result.remaining).toBe('number');
      expect(typeof result.resetTime).toBe('number');
    });
  });

  describe('Policy Packs API', () => {
    beforeEach(() => {
      PolicyPacks.initialize();
    });

    it('should support getPackScopes method', () => {
      const scopes = PolicyPacks.getPackScopes('llm-with-tools');
      expect(Array.isArray(scopes)).toBe(true);
      expect(scopes.length).toBeGreaterThan(0);
    });

    it('should support getPackRoutes method', () => {
      const routes = PolicyPacks.getPackRoutes('llm-with-tools');
      expect(Array.isArray(routes)).toBe(true);
    });

    it('should support getPackDependencies method', () => {
      const dependencies = PolicyPacks.getPackDependencies('llm-with-tools');
      expect(Array.isArray(dependencies)).toBe(true);
    });

    it('should support searchPacks method', () => {
      const searchResults = PolicyPacks.searchPacks('openai');
      expect(Array.isArray(searchResults)).toBe(true);
    });
  });

  describe('Scope Catalog API', () => {
    beforeEach(() => {
      ScopeCatalog.initialize();
    });

    it('should support registerProvider method', () => {
      expect(() => {
        ScopeCatalog.registerProvider({
          name: 'TestProvider',
          baseUrl: 'https://api.test.com',
          scopes: ['test:resource.action']
        });
      }).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('should work with all components together', async () => {
      const signer = new HMACSigner(TEST_CONSTANTS.TEST_SECRET);
      const approvalManager = new ApprovalManager({ dataDir: approvalDataDir });
      const securityManager = new SecurityManager();

      try {
        // Create and validate token
        const token = await createTestToken(signer);
        const validation = await signer.verify(token);
        expect(validation.valid).toBe(true);

        // Test security features
        const sanitized = securityManager.sanitizeInput('<script>alert("test")</script>');
        expect(sanitized).not.toContain('<script>');

        // Test encryption/decryption
        const sensitiveData = 'secret-data';
        const encrypted = securityManager.encryptSensitiveData(sensitiveData);
        const decrypted = securityManager.decryptSensitiveData(encrypted);
        expect(decrypted).toBe(sensitiveData);

        // Test rate limiting
        const rateLimitResult = securityManager.checkRateLimit('test-client');
        expect(rateLimitResult).toBeDefined();
        expect(typeof rateLimitResult.allowed).toBe('boolean');

        // Create approval request
        const request = {
          id: 'integration-test-request',
          orgId: 'test-org',
          projectId: 'test-project',
          agentId: 'test-agent',
          scope: 'test:resource.action',
          expiresIn: 3600,
          requestedAt: new Date().toISOString(),
          status: 'pending' as const,
          approvers: [],
          metadata: { context: 'Integration test' }
        };
        await approvalManager.createRequest(request);


        // Verify approval requests
        const requests = await approvalManager.getRequests({ limit: 10 });
        expect(requests.length).toBeGreaterThan(0);

      } finally {
        // Clean up approval data
        if (fs.existsSync(approvalDataDir)) {
          fs.rmSync(approvalDataDir, { recursive: true, force: true });
        }
      }
    });
  });
});
