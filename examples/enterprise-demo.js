const { 
  ApprovalManager, 
  TenancyManager, 
  Dashboard, 
  WebDashboard,
  SQLiteAuditLogger,
  AgentKeyBroker,
  HMACSigner
} = require("../dist/index");

async function phase3Demo() {
  console.log('🚀 Kage Keys - Phase 3 Enterprise Demo\n');
  console.log('This demo showcases the enterprise-grade permissions layer:\n');
  console.log('1. 🏢 Multi-Tenancy (Orgs → Projects → Agents)');
  console.log('2. 🔐 Approval Workflows (Slack/Email/CLI/Webhook)');
  console.log('3. 📊 Real-Time Dashboard & Metrics');
  console.log('4. 🔒 RBAC Policies & Scope Management');
  console.log('5. 🌐 Web Dashboard Interface\n');

  // Initialize components
  console.log('🔧 Initializing Phase 3 components...');
  
  const auditLogger = new SQLiteAuditLogger('phase3-demo.db');
  const signer = new HMACSigner();
  const broker = new AgentKeyBroker(signer, 'phase3-demo.db');
  
  const approvalManager = new ApprovalManager({
    enableCLI: true,
    enableSlack: false,
    enableEmail: false,
    enableWebhook: false
  });

  const tenancyManager = new TenancyManager({
    enableRBAC: true,
    defaultOrgSettings: {
      requireApproval: true,
      defaultTokenExpiry: 3600
    }
  });

  const dashboard = new Dashboard({
    auditLogger,
    enableLiveStreaming: true,
    updateIntervalMs: 5000
  });

  const webDashboard = new WebDashboard({
    dashboard,
    approvalManager,
    tenancyManager,
    auditLogger,
    port: 8080
  });

  console.log('✅ All components initialized\n');

  // 1. Multi-Tenancy Demo
  console.log('🏢 1. Multi-Tenancy Demo');
  console.log('   Creating organization and project structure...\n');

  try {
    // Create organization
    const org = await tenancyManager.createOrganization('Acme Corp', 'acme-corp');
    console.log(`   ✅ Created organization: ${org.name} (${org.slug})`);

    // Create project
    const project = await tenancyManager.createProject(
      org.id,
      'AI Assistant Platform',
      'ai-platform',
      'Platform for managing AI assistants with scoped access'
    );
    console.log(`   ✅ Created project: ${project.name}`);

    // Create agents
    const aiAgent = await tenancyManager.createAgent(
      project.id,
      'Customer Support AI',
      'ai-assistant',
      'AI agent for customer support',
      ['ai_assistant', 'team_collaborator']
    );
    console.log(`   ✅ Created agent: ${aiAgent.name} (${aiAgent.type})`);

    const codeAgent = await tenancyManager.createAgent(
      project.id,
      'Code Review Bot',
      'code-reviewer',
      'AI agent for automated code reviews',
      ['code_reviewer']
    );
    console.log(`   ✅ Created agent: ${codeAgent.name} (${codeAgent.type})`);

    // Create RBAC policy
    const rbacPolicy = await tenancyManager.createRBACPolicy(
      org.id,
      'Developer Access Policy',
      'Policy for developers to manage AI agents',
      [
        {
          id: '1',
          effect: 'allow',
          resources: ['ai_assistant:*', 'code_reviewer:*'],
          actions: ['create', 'read', 'update'],
          conditions: {
            timeRestrictions: {
              startTime: '09:00',
              endTime: '17:00',
              daysOfWeek: [1, 2, 3, 4, 5] // Monday-Friday
            }
          }
        }
      ]
    );
    console.log(`   ✅ Created RBAC policy: ${rbacPolicy.name}`);

    // Show tenancy stats
    const stats = await tenancyManager.getTenancyStats(org.id);
    console.log(`   📊 Organization stats: ${stats.projects} projects, ${stats.agents} agents (${stats.activeAgents} active)`);

  } catch (error) {
    console.log(`   ❌ Error in multi-tenancy demo: ${error.message}`);
  }

  console.log('');

  // 2. Approval Workflows Demo
  console.log('🔐 2. Approval Workflows Demo');
  console.log('   Testing approval system for high-risk scopes...\n');

  try {
    // Create approval request
    const approvalRequest = await approvalManager.createApprovalRequest(
      'acme-corp',
      'ai-platform',
      'customer-support-ai',
      'slack:chat.post',
      3600,
      {
        userAgent: 'Phase3-Demo/1.0',
        ipAddress: '127.0.0.1',
        context: 'Customer support automation'
      }
    );

    console.log(`   ✅ Created approval request: ${approvalRequest.id}`);
    console.log(`   📋 Scope: ${approvalRequest.scope}`);
    console.log(`   🤖 Agent: ${approvalRequest.agentId}`);
    console.log(`   ⏰ Expires in: ${approvalRequest.expiresIn} seconds`);
    console.log('   ⏳ Waiting for approval (auto-approves in 5 seconds)...\n');

    // Wait for approval
    await new Promise(resolve => setTimeout(resolve, 6000));

    // Check approval status
    const updatedRequest = await approvalManager.getApprovalRequest(approvalRequest.id);
    console.log(`   📊 Approval status: ${updatedRequest?.status}`);
    
    if (updatedRequest?.approvers.length > 0) {
      const decision = updatedRequest.approvers[0];
      console.log(`   ✅ Decision: ${decision.decision} by ${decision.approverId}`);
      console.log(`   💬 Reason: ${decision.reason}`);
    }

  } catch (error) {
    console.log(`   ❌ Error in approval demo: ${error.message}`);
  }

  console.log('');

  // 3. Dashboard & Metrics Demo
  console.log('📊 3. Dashboard & Metrics Demo');
  console.log('   Setting up real-time metrics and dashboard...\n');

  try {
    // Start broker to generate some audit data
    await broker.start(3001);
    console.log('   ✅ Broker started on port 3001');

    // Simulate some requests to generate metrics
    console.log('   🔄 Simulating requests to generate metrics...');
    
    for (let i = 0; i < 5; i++) {
      const requestId = dashboard.trackLiveRequest({
        agentId: 'demo-agent',
        scope: 'openai:chat.create',
        method: 'POST',
        url: '/v1/chat/completions',
        status: 'pending',
        headers: { 'Authorization': 'Bearer demo-token' },
        metadata: {
          ipAddress: '127.0.0.1',
          userAgent: 'Phase3-Demo/1.0',
          jti: `demo-${Date.now()}-${i}`,
          sessionId: 'demo-session'
        }
      });

      // Simulate request completion
      setTimeout(() => {
        dashboard.markRequestCompleted(requestId, { status: 'success', response: 'AI response' });
      }, 1000 + i * 500);
    }

    // Wait for metrics to be generated
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get metrics
    const timeRange = {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString()
    };

    const metrics = await dashboard.getMetrics(timeRange);
    console.log(`   📈 Metrics generated:`);
    console.log(`      • Total requests: ${metrics.totalRequests}`);
    console.log(`      • Success rate: ${metrics.successRate}%`);
    console.log(`      • Average response time: ${metrics.averageResponseTime}ms`);
    console.log(`      • Top agents: ${metrics.topAgents.length}`);
    console.log(`      • Top providers: ${metrics.topProviders.length}`);

    // Get real-time metrics
    const realtime = await dashboard.getRealTimeMetrics(5 * 60 * 1000); // 5 minutes
    console.log(`   ⚡ Real-time metrics (5min window):`);
    console.log(`      • Requests/min: ${realtime.requestsPerMinute}`);
    console.log(`      • Success rate: ${realtime.successRate}%`);
    console.log(`      • Active agents: ${realtime.activeAgents}`);

  } catch (error) {
    console.log(`   ❌ Error in dashboard demo: ${error.message}`);
  }

  console.log('');

  // 4. Web Dashboard Demo
  console.log('🌐 4. Web Dashboard Demo');
  console.log('   Starting web dashboard interface...\n');

  try {
    await webDashboard.start(8080);
    console.log('   ✅ Web dashboard started on http://localhost:8080');
    console.log('   📱 Open your browser to view the dashboard');
    console.log('   🔄 Dashboard auto-refreshes every 10 seconds');
    console.log('   📊 Features available:');
    console.log('      • Real-time metrics overview');
    console.log('      • Live request monitoring');
    console.log('      • Top agents and providers');
    console.log('      • Pending approvals management');
    console.log('      • Audit log browsing');

  } catch (error) {
    console.log(`   ❌ Error starting web dashboard: ${error.message}`);
  }

  console.log('');

  // 5. Integration Demo
  console.log('🔗 5. Integration Demo');
  console.log('   Testing the complete Phase 3 workflow...\n');

  try {
    // Check if scope requires approval
    const requiresApproval = await approvalManager.requiresApproval(
      'acme-corp',
      'ai-platform',
      'aws:sts.assume_role'
    );

    console.log(`   🔍 Scope 'aws:sts.assume_role' requires approval: ${requiresApproval}`);

    // Check RBAC permissions
    const hasPermission = await tenancyManager.checkPermission(
      'acme-corp',
      'developer-user',
      'create',
      'ai_assistant:chat.create'
    );

    console.log(`   🔐 User 'developer-user' can create 'ai_assistant:chat.create': ${hasPermission}`);

    // Export dashboard data
    const csvData = await dashboard.exportDashboardData(
      { start: new Date(Date.now() - 60 * 60 * 1000).toISOString(), end: new Date().toISOString() },
      'csv'
    );
    console.log(`   📊 Dashboard data exported to CSV (${csvData.split('\n').length} lines)`);

  } catch (error) {
    console.log(`   ❌ Error in integration demo: ${error.message}`);
  }

  console.log('\n🎯 Phase 3 Demo Complete!');
  console.log('\n🚀 Key Benefits Achieved:');
  console.log('   ✅ Enterprise-grade multi-tenancy');
  console.log('   ✅ Automated approval workflows');
  console.log('   ✅ Real-time monitoring & metrics');
  console.log('   ✅ Web-based management interface');
  console.log('   ✅ RBAC policies & access control');
  console.log('   ✅ Comprehensive audit logging');
  console.log('   ✅ Production-ready architecture');
  
  console.log('\n📋 Next Steps:');
  console.log('   1. Open http://localhost:8080 in your browser');
  console.log('   2. Explore the dashboard interface');
  console.log('   3. Test approval workflows');
  console.log('   4. Monitor real-time metrics');
  console.log('   5. Manage organizations and agents');
  
  console.log('\n💡 This is now a production-ready permissions layer');
  console.log('   that teams can adopt in a day! 🎉');

  // Keep the demo running
  console.log('\n⏸️  Demo is running. Press Ctrl+C to stop.');
  console.log('   Web dashboard: http://localhost:8080');
  console.log('   Broker: http://localhost:3001');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down Phase 3 demo...');
  process.exit(0);
});

// Run the demo
phase3Demo().catch(console.error);
