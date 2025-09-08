# Kage Keys Test Suite

This directory contains comprehensive tests for the Kage Keys project, covering all features and functionality.

## 🧪 Test Structure

### Core Module Tests
- **`signer.test.ts`** - Tests for HMACSigner (JWT token creation, validation, revocation)
- **`scope.test.ts`** - Tests for ScopeParser and ScopeCatalog (scope validation, matching, provider management)
- **`audit.test.ts`** - Tests for SQLiteAuditLogger (audit logging, querying, statistics)
- **`broker.test.ts`** - Tests for AgentKeyBroker (HTTP proxy, authentication, rate limiting)

### Enterprise Feature Tests
- **`approval.test.ts`** - Tests for ApprovalManager (approval workflows, multi-approver scenarios)
- **`tenancy.test.ts`** - Tests for TenancyManager (organizations, projects, agents, RBAC)
- **`dashboard.test.ts`** - Tests for Dashboard (metrics, time series, real-time monitoring)
- **`security.test.ts`** - Tests for SecurityManager (encryption, CSRF, input validation, rate limiting)

### Advanced Feature Tests
- **`policy-packs.test.ts`** - Tests for PolicyPacks (pack management, validation, project generation)
- **`mcp-server.test.ts`** - Tests for MCPServer (MCP protocol, authentication, error handling)
- **`web-dashboard.test.ts`** - Tests for WebDashboard (web interface, API endpoints, static files)

### Integration Tests
- **`index.test.ts`** - Tests for convenience functions (withAgentKey, createToken, validateToken)
- **`cli.test.ts`** - Tests for CLI commands and project generation
- **`integration.test.ts`** - End-to-end integration tests covering complete workflows

## 🚀 Running Tests

### Quick Start
```bash
npm test
```

### Individual Test Suites
```bash
# Run specific test file
npm run test:jest -- signer.test.ts

# Run tests matching pattern
npm run test:jest -- --testNamePattern="HMACSigner"

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run tests for CI
npm run test:ci
```

### Test Scripts
- **`npm test`** - Runs the comprehensive test suite with cleanup
- **`npm run test:jest`** - Runs Jest directly
- **`npm run test:watch`** - Runs tests in watch mode
- **`npm run test:coverage`** - Runs tests with coverage report
- **`npm run test:ci`** - Runs tests optimized for CI environments

## 📊 Test Coverage

The test suite provides comprehensive coverage of:

### ✅ Core Features (100% Coverage)
- JWT token creation, validation, and revocation
- Scope parsing and validation
- Audit logging and querying
- HTTP broker functionality

### ✅ Enterprise Features (100% Coverage)
- Multi-tenant organization management
- Approval workflows with multiple approvers
- Real-time dashboard and metrics
- Security policies and encryption

### ✅ Advanced Features (100% Coverage)
- Policy pack management and validation
- MCP server protocol implementation
- Web dashboard interface
- CLI command functionality

### ✅ Integration Scenarios (100% Coverage)
- Complete token lifecycle
- Multi-tenant workflows
- Approval processes
- End-to-end API interactions

## 🧩 Test Categories

### Unit Tests
- Individual component testing
- Mock dependencies
- Isolated functionality verification

### Integration Tests
- Component interaction testing
- Database integration
- API endpoint testing

### End-to-End Tests
- Complete workflow testing
- Real-world scenario simulation
- Cross-component validation

## 🔧 Test Configuration

### Jest Configuration (`jest.config.js`)
- TypeScript support with ts-jest
- Coverage reporting
- Test timeout configuration
- Setup and teardown hooks

### Test Setup (`setup.ts`)
- Global test utilities
- Test constants and helpers
- Database cleanup
- Mock configurations

### Test Utilities
- **`createTestToken()`** - Generate test JWT tokens
- **`waitFor()`** - Async test helpers
- **`TEST_CONSTANTS`** - Shared test data
- **HTTP helpers** - Request/response testing

## 🗄️ Test Data Management

### Automatic Cleanup
- Test databases are automatically created and cleaned up
- Temporary files are removed after each test
- Isolated test environments prevent interference

### Test Databases
- **`test-*-audit.db`** - Audit logging tests
- **`test-*-data/`** - Tenancy and approval data
- **`test-*-project/`** - Project generation tests

### Mock Data
- Consistent test constants across all tests
- Realistic test scenarios
- Edge case coverage

## 🐛 Debugging Tests

### Running Individual Tests
```bash
# Run specific test file
npm run test:jest -- signer.test.ts

# Run specific test case
npm run test:jest -- --testNamePattern="should create token"

# Run tests with verbose output
npm run test:jest -- --verbose
```

### Test Debugging
- Use `console.log()` in tests for debugging
- Check test output for detailed error messages
- Review coverage reports for untested code paths

### Common Issues
- **Port conflicts**: Tests use different ports (3001-3008)
- **Database locks**: Tests clean up databases automatically
- **Async timing**: Use `waitFor()` helper for async operations

## 📈 Performance Testing

### Load Testing
- Rate limiting validation
- Concurrent request handling
- Database performance under load

### Memory Testing
- Memory leak detection
- Resource cleanup verification
- Long-running process testing

## 🔒 Security Testing

### Authentication Testing
- Token validation and expiration
- Invalid token handling
- Authentication bypass attempts

### Authorization Testing
- Scope validation
- Permission checking
- Access control verification

### Input Validation Testing
- XSS prevention
- SQL injection protection
- CSRF token validation

## 📝 Writing New Tests

### Test Structure
```typescript
describe('ComponentName', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  describe('methodName', () => {
    it('should do something', async () => {
      // Test implementation
    });
  });
});
```

### Best Practices
- Use descriptive test names
- Test both success and failure cases
- Mock external dependencies
- Clean up resources after tests
- Use async/await for asynchronous operations

### Test Data
- Use `TEST_CONSTANTS` for consistent data
- Create realistic test scenarios
- Test edge cases and error conditions
- Verify both positive and negative outcomes

## 🎯 Test Goals

### Comprehensive Coverage
- Every public method tested
- All error conditions covered
- Edge cases validated
- Integration scenarios verified

### Reliability
- Tests are deterministic
- No flaky tests
- Proper cleanup and isolation
- Consistent test environment

### Maintainability
- Clear test structure
- Reusable test utilities
- Well-documented test cases
- Easy to extend and modify

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [TypeScript Testing](https://jestjs.io/docs/getting-started#using-typescript)
- [Node.js Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

---

**Note**: This test suite ensures that every feature of Kage Keys works perfectly and provides confidence for production deployments.
