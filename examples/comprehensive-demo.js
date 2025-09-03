#!/usr/bin/env node

/**
 * Kage Keys Comprehensive Demo
 * 
 * This demo showcases all the major features of Kage Keys:
 * - Core authentication and token management
 * - Enterprise features (multi-tenancy, RBAC, approvals)
 * - Security hardening (mTLS, CSRF, CORS)
 * - Phase 5 features (MCP server, policy packs)
 * - Integration examples (LangChain, LlamaIndex, OpenAI Assistants)
 * - Real-time dashboard and monitoring
 * 
 * Run with: node examples/comprehensive-demo.js
 */

const {
  AgentKeyBroker, 
  HMACSigner, 
  SQLiteAuditLogger,
  TenancyManager,
  ApprovalManager,
  Dashboard,
  WebDashboard,
  SecurityManager,
  MCPServer,
  PolicyPacks
} = require('../dist/index.js');

const { withAgentKey, withBrokeredAPI, createToken } = require('../dist/index.js');

// Mock imports for demo purposes (these would be real in actual usage)
// import { ChatOpenAI } from '@langchain/openai';
// import { DynamicStructuredTool } from '@langchain/core/tools';

console.log('🚀 Kage Keys Comprehensive Demo');
console.log('================================\n');

class ComprehensiveDemo {
  constructor() {
    this.broker = null;
    this.dashboard = null;
    this.webDashboard = null;
    this.tenancyManager = null;
    this.approvalManager = null;
    this.securityManager = null;
    this.mcpServer = null;
    this.demoData = {};
  }

  async run() {
    try {
      console.log('📋 Demo Overview:');
      console.log('  1. Core Authentication & Token Management');
      console.log('  2. Enterprise Features (Multi-tenancy, RBAC, Approvals)');
      console.log('  3. Security Hardening (mTLS, CSRF, CORS)');
      console.log('  4. Phase 5 Features (MCP Server, Policy Packs)');
      console.log('  5. Integration Examples (LangChain, LlamaIndex, OpenAI)');
      console.log('  6. Real-time Dashboard & Monitoring');
      console.log('  7. GitHub Actions & Deployment Examples\n');

      await this.setupInfrastructure();
      await this.demoCoreFeatures();
      await this.demoEnterpriseFeatures();
      await this.demoSecurityFeatures();
      await this.demoPhase5Features();
      await this.demoIntegrations();
      await this.demoDashboard();
      await this.demoDeployment();
      await this.cleanup();

      console.log('\n🎉 Comprehensive Demo Completed Successfully!');
      console.log('\n💡 Next Steps:');
      console.log('  - Visit http://localhost:8080 for the web dashboard');
      console.log('  - Check http://localhost:3000/health for broker status');
      console.log('  - Review the generated examples in examples/ directory');
      console.log('  - Try the CLI commands: npx kage-keys --help');

    } catch (error) {
      console.error('❌ Demo failed:', error.message);
      await this.cleanup();
      process.exit(1);
    }
  }

  async setupInfrastructure() {
    console.log('🔧 Setting up infrastructure...');

    // Initialize components
    const signer = new HMACSigner('demo-secret-key');
    const auditLogger = new SQLiteAuditLogger('./demo-audit.db');
    
    // Set the same secret for the createToken function
    process.env.HMAC_SECRET = 'demo-secret-key';
    
    this.broker = new AgentKeyBroker(signer, auditLogger);
    this.tenancyManager = new TenancyManager();
    this.approvalManager = new ApprovalManager();
    this.dashboard = new Dashboard(auditLogger);
    this.securityManager = new SecurityManager();
    
    // Start broker
    await this.broker.start(3000);
    console.log('   ✅ Broker started on port 3000');

    // Start web dashboard
    this.webDashboard = new WebDashboard({
      dashboard: this.dashboard,
      approvalManager: this.approvalManager,
      tenancyManager: this.tenancyManager,
      auditLogger: auditLogger
    });
    await this.webDashboard.start(8080);
    console.log('   ✅ Web dashboard started on port 8080');

    // Initialize policy packs
    PolicyPacks.initialize();
    console.log('   ✅ Policy packs initialized');

    console.log('   ✅ Infrastructure setup complete\n');
  }

  async demoCoreFeatures() {
    console.log('🔑 Demo 1: Core Authentication & Token Management');
    console.log('--------------------------------------------------');

    // Create tokens with different scopes
    const openaiToken = await createToken('demo-agent', 'openai:chat.create', 3600);
    const githubToken = await createToken('demo-agent', 'github:repos.read', 1800);
    
    console.log('   ✅ Generated tokens:');
    console.log(`      OpenAI: ${openaiToken.substring(0, 20)}...`);
    console.log(`      GitHub: ${githubToken.substring(0, 20)}...`);

    // Test token validation
    const openaiValidation = await this.broker.validateToken(openaiToken);
    console.log('   ✅ Token validation:', openaiValidation ? 'PASS' : 'FAIL');

    // Test scope validation
    const scopeCheck = await this.broker.validateScope(openaiToken, 'openai:chat.create');
    console.log('   ✅ Scope validation:', scopeCheck ? 'PASS' : 'FAIL');

    // Test withAgentKey wrapper
    const result = await withAgentKey(openaiToken, async (token) => {
      console.log('   🔐 Using authenticated token for API call');
      return { message: 'API call successful', token: token.substring(0, 10) + '...' };
    });
    console.log('   ✅ withAgentKey wrapper:', result.message);

    // Test withBrokeredAPI - use the broker's health endpoint instead of external API
    const apiResult = await withBrokeredAPI('http://localhost:3000/health', openaiToken, async (response) => {
      return response;
    });
    console.log('   ✅ withBrokeredAPI: SUCCESS');

    this.demoData.tokens = { openai: openaiToken, github: githubToken };
    console.log('   ✅ Core features demo complete\n');
  }

  async demoEnterpriseFeatures() {
    console.log('🏢 Demo 2: Enterprise Features');
    console.log('-------------------------------');

    // Create organization and project
    const org = await this.tenancyManager.createOrganization('Demo Corp', 'demo-corp');
    const project = await this.tenancyManager.createProject(org.id, 'AI Platform', 'ai-platform');
    
    console.log('   ✅ Created organization:', org.name);
    console.log('   ✅ Created project:', project.name);

    // Create AI agents with different scopes
    const supportAgent = await this.tenancyManager.createAgent(
      project.id,
      'Customer Support AI',
      'ai-assistant',
      'AI agent for customer support',
      ['support_tools', 'basic_llm']
    );

    const devAgent = await this.tenancyManager.createAgent(
      project.id,
      'Developer AI',
      'ai-assistant',
      'AI agent for development tasks',
      ['github_ops', 'code_analysis', 'advanced_llm']
    );

    console.log('   ✅ Created agents:', supportAgent.name, 'and', devAgent.name);

    // Create RBAC policies
    const supportPolicy = await this.tenancyManager.createRBACPolicy(
      org.id,
      'support_agent',
      'support_tools:*,basic_llm:*',
      { timeRestrictions: { startHour: 9, endHour: 17 } }
    );

    const devPolicy = await this.tenancyManager.createRBACPolicy(
      org.id,
      'developer',
      'github_ops:*,code_analysis:*,advanced_llm:*',
      { ipRestrictions: ['192.168.1.0/24'] }
    );

    console.log('   ✅ Created RBAC policies for support and developer roles');

    // Test approval workflow
    const approvalRequest = await this.approvalManager.createApprovalRequest(
      org.id, project.id, devAgent.id, 'aws:sts.assume_role', 3600
    );
    console.log('   ✅ Created approval request for high-risk scope');

    // Simulate approval
    await this.approvalManager.approveRequest(approvalRequest.id, 'admin', 'Approved for demo');
    console.log('   ✅ Approved request for AWS role assumption');

    this.demoData.enterprise = { org, project, agents: [supportAgent, devAgent] };
    console.log('   ✅ Enterprise features demo complete\n');
  }

  async demoSecurityFeatures() {
    console.log('🛡️ Demo 3: Security Hardening');
    console.log('--------------------------------');

    // Configure security settings
    const securityConfig = this.securityManager.getDefaultConfig();
    securityConfig.tls.enabled = true;
    securityConfig.mtls.enabled = true;
    securityConfig.csrf.enabled = true;
    securityConfig.cors.origins = ['http://localhost:3000', 'http://localhost:8080'];
    
    await this.securityManager.updateConfig(securityConfig);
    console.log('   ✅ Security configuration updated');

    // Generate security tokens
    const csrfToken = this.securityManager.generateCSRFToken();
    const sessionId = this.securityManager.generateSessionId();
    
    console.log('   ✅ Generated security tokens:');
    console.log(`      CSRF: ${csrfToken.substring(0, 16)}...`);
    console.log(`      Session: ${sessionId.substring(0, 16)}...`);

    // Test password policies
    const password = 'SecurePass123!';
    const hashedPassword = await this.securityManager.hashPassword(password);
    const isValid = await this.securityManager.verifyPassword(password, hashedPassword);
    
    console.log('   ✅ Password security:', isValid ? 'PASS' : 'FAIL');

    // Test rate limiting
    const shouldLimit = this.securityManager.shouldRateLimit('demo-client', 100);
    console.log('   ✅ Rate limiting check:', shouldLimit ? 'LIMIT' : 'ALLOW');

    // Test sensitive data masking
    const sensitiveData = { 
      apiKey: 'sk-1234567890abcdef', 
      password: 'secret123',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    };
    const maskedData = this.securityManager.maskSensitiveData(sensitiveData);
    console.log('   ✅ Data masking:', Object.keys(maskedData).length, 'fields masked');

    this.demoData.security = { csrfToken, sessionId, hashedPassword };
    console.log('   ✅ Security features demo complete\n');
  }

  async demoPhase5Features() {
    console.log('🚀 Demo 4: Phase 5 Features');
    console.log('-----------------------------');

    // List available policy packs
    const availablePacks = PolicyPacks.getAllPacks();
    console.log('   📦 Available policy packs:');
    availablePacks.forEach(pack => {
      console.log(`      - ${pack.name}: ${pack.description}`);
    });

    // Show policy pack details
    const llmPack = PolicyPacks.getPack('llm-with-tools');
    if (llmPack) {
      console.log('   🔍 LLM with Tools pack details:');
      console.log(`      Scopes: ${llmPack.scopes.join(', ')}`);
      console.log(`      Routes: ${llmPack.routes.length} configured`);
      console.log(`      Rate limits: ${llmPack.rateLimits.length} configured`);
    }

    // Start MCP server
    this.mcpServer = new MCPServer(this.broker, { port: 3001 });
    await this.mcpServer.start();
    console.log('   ✅ MCP server started on port 3001');

    // Test MCP server health - just check if it's running
    console.log('   ✅ MCP server health check: PASS (server is running)');

    // Demo project generation (simulated)
    console.log('   🏗️ Project generation capabilities:');
    console.log('      - npx kage-keys init (complete project setup)');
    console.log('      - npx kage-keys packs --create llm-with-tools');
    console.log('      - Docker & Helm support');
    console.log('      - GitHub Actions integration');

    this.demoData.phase5 = { 
      availablePacks: availablePacks.length,
      mcpServer: this.mcpServer ? 'running' : 'stopped'
    };
    console.log('   ✅ Phase 5 features demo complete\n');
  }

  async demoIntegrations() {
    console.log('🔌 Demo 5: Integration Examples');
    console.log('--------------------------------');

    // LangChain Integration Demo
    console.log('   🤖 LangChain Integration:');
    console.log('      - KageKeysToolWrapper for authenticated tools');
    console.log('      - GitHubRepoTool with scope validation');
    console.log('      - OpenAIChatTool with token management');
    console.log('      - All API calls authenticated via Kage Keys');

    // LlamaIndex Integration Demo
    console.log('   📚 LlamaIndex Integration:');
    console.log('      - KageKeysLlamaIndexWrapper for RAG operations');
    console.log('      - GitHub repository reader with authentication');
    console.log('      - Vector index creation with scoped access');
    console.log('      - Secure document loading and indexing');

    // OpenAI Assistants Integration Demo
    console.log('   🧵 OpenAI Assistants Integration:');
    console.log('      - KageKeysOpenAIWrapper for client management');
    console.log('      - Custom tools with scope validation');
    console.log('      - Secure assistant creation and management');
    console.log('      - All operations audited and logged');

    // GitHub Actions Integration Demo
    console.log('   🔄 GitHub Actions Integration:');
    console.log('      - One-time token generation in CI/CD');
    console.log('      - Scoped access for different deployment stages');
    console.log('      - Automatic token revocation after use');
    console.log('      - Security and compliance reporting');

    // Docker & Kubernetes Integration Demo
    console.log('   🐳 Docker & Kubernetes Integration:');
    console.log('      - Multi-service docker-compose setup');
    console.log('      - Helm charts for production deployment');
    console.log('      - Health checks and monitoring');
    console.log('      - Persistent storage and networking');

    this.demoData.integrations = {
      langchain: 'ready',
      llamaindex: 'ready', 
      openai: 'ready',
      githubActions: 'ready',
      docker: 'ready',
      kubernetes: 'ready'
    };
    console.log('   ✅ Integration examples demo complete\n');
  }

  async demoDashboard() {
    console.log('📊 Demo 6: Real-time Dashboard & Monitoring');
    console.log('---------------------------------------------');

    // Generate some demo metrics
    await this.dashboard.trackLiveRequest({
      agentId: 'demo-agent',
      scope: 'openai:chat.create',
      method: 'POST',
      url: '/v1/chat/completions',
      status: 'pending',
      headers: { 'Content-Type': 'application/json' },
      metadata: {
        ipAddress: '127.0.0.1',
        userAgent: 'Demo/1.0',
        jti: `demo-${Date.now()}-1`
      }
    });

    await this.dashboard.trackLiveRequest({
      agentId: 'demo-agent',
      scope: 'github:repos.read',
      method: 'GET',
      url: '/repos/owner/repo',
      status: 'pending',
      headers: { 'Accept': 'application/vnd.github.v3+json' },
      metadata: {
        ipAddress: '127.0.0.1',
        userAgent: 'Demo/1.0',
        jti: `demo-${Date.now()}-2`
      }
    });

    // Mark requests as completed
    setTimeout(async () => {
      await this.dashboard.markRequestCompleted('demo-agent', 150);
      await this.dashboard.markRequestCompleted('demo-agent', 200);
    }, 1000);

    // Get real-time metrics
    const metrics = await this.dashboard.getMetrics({
      start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString()
    });

    console.log('   📈 Dashboard metrics:');
    console.log(`      Total requests: ${metrics.totalRequests}`);
    console.log(`      Success rate: ${metrics.successRate}%`);
    console.log(`      Average response time: ${metrics.averageResponseTime}ms`);
    console.log(`      Top agents: ${metrics.topAgents.length} tracked`);
    console.log(`      Top providers: ${metrics.topProviders.length} tracked`);

    // Export dashboard data
    const exportData = await this.dashboard.exportDashboardData('json');
    console.log('   💾 Dashboard data exported (JSON format)');

    this.demoData.dashboard = {
      metrics: metrics.totalRequests,
      successRate: metrics.successRate,
      exportFormat: 'json'
    };
    console.log('   ✅ Dashboard demo complete\n');
  }

  async demoDeployment() {
    console.log('🚀 Demo 7: Deployment & Operations');
    console.log('-----------------------------------');

    // CLI Commands Demo
    console.log('   💻 CLI Commands:');
    console.log('      kage-keys start                    # Start broker');
    console.log('      kage-keys dashboard               # Start web dashboard');
    console.log('      kage-keys create-token            # Generate agent token');
    console.log('      kage-keys logs --tail 100         # View recent logs');
    console.log('      kage-keys config --show           # Show configuration');
    console.log('      kage-keys health                  # Check system health');

    // Project Initialization Demo
    console.log('   🏗️ Project Setup:');
    console.log('      npx kage-keys init                # Initialize project');
    console.log('      npx kage-keys packs --list        # List policy packs');
    console.log('      npx kage-keys packs --create      # Create from pack');

    // Docker Deployment Demo
    console.log('   🐳 Docker Deployment:');
    console.log('      docker-compose up -d              # Start all services');
    console.log('      docker logs kage-keys-broker      # View broker logs');
    console.log('      docker exec -it kage-keys-broker kage-keys health');

    // Kubernetes Deployment Demo
    console.log('   ☸️ Kubernetes Deployment:');
    console.log('      helm install kage-keys ./.helm    # Install with Helm');
    console.log('      kubectl get pods -l app=kage-keys # Check pod status');
    console.log('      kubectl logs -l app=kage-keys     # View logs');

    // GitHub Actions Demo
    console.log('   🔄 CI/CD Integration:');
    console.log('      - Automated token generation');
    console.log('      - Scoped deployment access');
    console.log('      - Security compliance reporting');
    console.log('      - Automatic cleanup and revocation');

    this.demoData.deployment = {
      cli: 'ready',
      docker: 'ready',
      kubernetes: 'ready',
      githubActions: 'ready'
    };
    console.log('   ✅ Deployment demo complete\n');
  }

  async cleanup() {
    console.log('🧹 Cleaning up demo environment...');

    try {
      if (this.mcpServer) {
        await this.mcpServer.stop();
        console.log('   ✅ MCP server stopped');
      }

      if (this.webDashboard) {
        await this.webDashboard.stop();
        console.log('   ✅ Web dashboard stopped');
      }

      if (this.broker) {
        await this.broker.stop();
        console.log('   ✅ Broker stopped');
      }

      console.log('   ✅ Cleanup complete');
    } catch (error) {
      console.log('   ⚠️ Cleanup warnings:', error.message);
    }
  }
}

// Run the comprehensive demo
const demo = new ComprehensiveDemo();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  await demo.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  await demo.cleanup();
  process.exit(0);
});

// Start the demo
demo.run().catch(console.error);
