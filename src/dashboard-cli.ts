#!/usr/bin/env node

import { WebDashboard, Dashboard, SQLiteAuditLogger, ApprovalManager, TenancyManager } from './index';

async function startDashboard() {
  try {
    console.log('🚀 Starting Kage Keys Web Dashboard...');
    
    // Create required dependencies
    const auditLogger = new SQLiteAuditLogger('audit.db');
    const dashboard = new Dashboard({ auditLogger });
    const approvalManager = new ApprovalManager();
    const tenancyManager = new TenancyManager();
    
    // Create web dashboard instance
    const webDashboard = new WebDashboard({
      dashboard,
      approvalManager,
      tenancyManager,
      auditLogger,
      port: 8080,
      enableHTTPS: false
    });
    
    // Start the server
    await webDashboard.start(8080);
    console.log('✅ Web Dashboard started successfully on http://localhost:8080');
    console.log('Press Ctrl+C to stop');
    
    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down dashboard...');
      webDashboard.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start dashboard:', error);
    process.exit(1);
  }
}

startDashboard();
