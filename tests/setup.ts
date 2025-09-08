import * as fs from 'fs';

// Global test setup
beforeAll(() => {
  // Create test data directories
  const testDirs = [
    './test-data',
    './test-data/approval-data',
    './test-data/tenancy-data'
  ];
  
  testDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
});

afterAll(() => {
  // Clean up test databases and files
  const testFiles = [
    './test-audit.db',
    './test-dashboard-audit.db',
    './test-approval.db',
    './test-tenancy.db',
    './test-security.db'
  ];
  
  testFiles.forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });
  
  // Clean up test directories
  const testDirs = [
    './test-data',
    './test-approval-data',
    './test-tenancy-data'
  ];
  
  testDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };
beforeEach(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
});

// Global test utilities
export const TEST_CONSTANTS = {
  TEST_SECRET: 'test-secret-key-for-testing-only',
  TEST_AGENT: 'test-agent',
  TEST_SCOPE: 'test:resource.action',
  TEST_ORG_ID: 'test-org-123',
  TEST_PROJECT_ID: 'test-project-456',
  TEST_AGENT_ID: 'test-agent-789'
};

export const createTestToken = async (signer: any, payload: any = {}) => {
  const defaultPayload = {
    iss: 'kage-keys',
    sub: TEST_CONSTANTS.TEST_AGENT,
    aud: 'api',
    scope: TEST_CONSTANTS.TEST_SCOPE,
    nbf: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    jti: `test-token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...payload
  };
  
  return await signer.sign(defaultPayload);
};

export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
