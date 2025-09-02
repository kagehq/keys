#!/usr/bin/env node

import { Command } from 'commander';
import { AgentKeyBroker, HMACSigner, SQLiteAuditLogger, ScopeCatalog } from './index';
import { StartOptions, LogsOptions, StatsOptions, TokenCreateOptions, TokenVerifyOptions, TokenRevokeOptions, DatabaseOptions, DatabaseCleanupOptions } from './cli-types';

const program = new Command();

program
  .name('kage-keys')
  .description('Agent Key Broker - Scoped, expiring keys for AI agents')
  .version('0.2.0');

// Start broker server
program
  .command('start')
  .description('Start the broker server')
  .option('-p, --port <number>', 'Port to listen on', '3000')
  .option('-d, --db <path>', 'Audit database path', 'audit.db')
  .option('--secret <secret>', 'HMAC secret for signing tokens')
  .action(async (options: StartOptions) => {
    try {
      console.log(`🚀 Starting Agent Key Broker on port ${options.port}...`);
      
      const signer = options.secret ? new HMACSigner(options.secret) : undefined;
      const broker = new AgentKeyBroker(signer, options.db);
      
      // Initialize scope catalogs
      ScopeCatalog.initialize();
      
      await broker.start(parseInt(options.port));
      
      console.log(`✅ Broker running on http://localhost:${options.port}`);
      console.log(`📊 Audit database: ${options.db}`);
      console.log('Press Ctrl+C to stop');
      
    } catch (error) {
      console.error('Failed to start broker:', error);
      process.exit(1);
    }
  });

// View audit logs
program
  .command('logs')
  .description('View audit logs')
  .option('-d, --db <path>', 'Audit database path', 'audit.db')
  .option('-l, --limit <number>', 'Number of logs to show', '50')
  .option('-a, --agent <agent>', 'Filter by agent')
  .option('-s, --scope <scope>', 'Filter by scope')
  .option('--status <status>', 'Filter by status')
  .option('--start <date>', 'Start date (ISO format)')
  .option('--end <date>', 'End date (ISO format)')
  .option('--format <format>', 'Output format (table, json, csv)', 'table')
  .option('--export <path>', 'Export to file')
  .action(async (options: LogsOptions) => {
    try {
      const logger = new SQLiteAuditLogger(options.db);
      
      const logs = await logger.queryLogs({
        startTime: options.start,
        endTime: options.end,
        agent: options.agent,
        scope: options.scope,
        status: options.status,
        limit: parseInt(options.limit)
      });

      if (options.export) {
        if (options.format === 'csv') {
          await logger.exportToCSV(options.export, {
            startTime: options.start,
            endTime: options.end,
            agent: options.agent,
            scope: options.scope
          });
          console.log(`✅ Exported ${logs.length} logs to ${options.export}`);
        } else {
          await logger.exportToJSONL(options.export, {
            startTime: options.start,
            endTime: options.end,
            agent: options.agent,
            scope: options.scope
          });
          console.log(`✅ Exported ${logs.length} logs to ${options.export}`);
        }
        return;
      }

      if (options.format === 'json') {
        console.log(JSON.stringify(logs, null, 2));
      } else if (options.format === 'csv') {
        console.log('timestamp,agent,scope,duration,status,route,jti,token_hash,error');
        logs.forEach(log => {
          console.log(`${log.timestamp},"${log.agent}","${log.scope}",${log.duration},${log.status},"${log.route}",${log.jti},${log.tokenHash},"${log.error || ''}"`);
        });
      } else {
        // Table format
        console.log(`\n📊 Audit Logs (${logs.length} entries)\n`);
        console.log('Timestamp           | Agent         | Scope                | Status    | Duration | Route');
        console.log('-------------------|---------------|----------------------|-----------|----------|------------------');
        
        logs.forEach(log => {
          const timestamp = new Date(log.timestamp).toLocaleString();
          const agent = log.agent.padEnd(13);
          const scope = log.scope.padEnd(20);
          const status = log.status.padEnd(9);
          const duration = `${log.duration}ms`.padEnd(9);
          const route = log.route.substring(0, 16);
          
          console.log(`${timestamp} | ${agent} | ${scope} | ${status} | ${duration} | ${route}`);
        });
      }

      await logger.close();
      
    } catch (error) {
      console.error('Failed to view logs:', error);
      process.exit(1);
    }
  });

// Show statistics
program
  .command('stats')
  .description('Show broker statistics')
  .option('-d, --db <path>', 'Audit database path', 'audit.db')
  .option('--start <date>', 'Start date (ISO format)')
  .option('--end <date>', 'End date (ISO format)')
  .option('-a, --agent <agent>', 'Filter by agent')
  .action(async (options: StatsOptions) => {
    try {
      const logger = new SQLiteAuditLogger(options.db);
      
      const stats = await logger.getStats({
        startTime: options.start,
        endTime: options.end,
        agent: options.agent
      });

      console.log('\n📊 Broker Statistics\n');
      console.log(`Total Requests:     ${stats.totalRequests}`);
      console.log(`Successful:         ${stats.successCount}`);
      console.log(`Errors:             ${stats.errorCount}`);
      console.log(`Rate Limited:       ${stats.rateLimitedCount}`);
      console.log(`Unauthorized:       ${stats.unauthorizedCount}`);
      console.log(`Average Duration:   ${Math.round(stats.averageDuration)}ms`);
      console.log(`Avg Provider Latency: ${Math.round(stats.averageProviderLatency || 0)}ms`);

      if (stats.topScopes.length > 0) {
        console.log('\nTop Scopes:');
        stats.topScopes.forEach((scope, i) => {
          console.log(`  ${i + 1}. ${scope.scope}: ${scope.count} requests`);
        });
      }

      if (stats.topAgents.length > 0) {
        console.log('\nTop Agents:');
        stats.topAgents.forEach((agent, i) => {
          console.log(`  ${i + 1}. ${agent.agent}: ${agent.count} requests`);
        });
      }

      await logger.close();
      
    } catch (error) {
      console.error('Failed to get statistics:', error);
      process.exit(1);
    }
  });

// Token management
program
  .command('token')
  .description('Token management operations')
  .option('--secret <secret>', 'HMAC secret for signing tokens')
  .addCommand(
    new Command('create')
      .description('Create a new token')
      .requiredOption('-s, --scope <scope>', 'Token scope')
      .requiredOption('-a, --agent <agent>', 'Agent identifier')
      .requiredOption('-t, --target <target>', 'Target service')
      .option('-e, --expires <seconds>', 'Expiration time in seconds', '3600')
      .option('-j, --jti <jti>', 'JWT ID (optional)')
      .action(async (options: TokenCreateOptions) => {
        try {
          const signer = new HMACSigner(options.secret);
          
          const now = Math.floor(Date.now() / 1000);
          const tokenPayload = {
            iss: 'kage-keys',
            sub: options.agent,
            aud: options.target,
            scope: options.scope,
            nbf: now,
            exp: now + parseInt(options.expires),
            jti: options.jti || `token-${Date.now()}`
          };

          const token = await signer.sign(tokenPayload);
          
          console.log('\n🔑 New Token Created\n');
          console.log(`Scope:     ${options.scope}`);
          console.log(`Agent:     ${options.agent}`);
          console.log(`Target:    ${options.target}`);
          console.log(`Expires:   ${new Date(tokenPayload.exp * 1000).toISOString()}`);
          console.log(`JTI:       ${tokenPayload.jti}`);
          console.log('\nToken:');
          console.log(token);
          
        } catch (error) {
          console.error('Failed to create token:', error);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('verify')
      .description('Verify a token')
      .requiredOption('-t, --token <token>', 'Token to verify')
      .option('--secret <secret>', 'HMAC secret for verifying tokens')
      .action(async (options: TokenVerifyOptions) => {
        try {
          const signer = new HMACSigner(options.secret);
          const result = await signer.verify(options.token);
          
          console.log('\n🔍 Token Verification\n');
          console.log(`Valid:     ${result.valid}`);
          
          if (result.token) {
            console.log(`Issuer:    ${result.token.iss}`);
            console.log(`Subject:   ${result.token.sub}`);
            console.log(`Audience:  ${result.token.aud}`);
            console.log(`Scope:     ${result.token.scope}`);
            console.log(`Not Before: ${new Date(result.token.nbf * 1000).toISOString()}`);
            console.log(`Expires:   ${new Date(result.token.exp * 1000).toISOString()}`);
            console.log(`JTI:       ${result.token.jti}`);
          } else {
            console.log(`Reason:    ${result.reason}`);
            console.log(`Error:     ${result.error}`);
          }
          
        } catch (error) {
          console.error('Failed to verify token:', error);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('revoke')
      .description('Revoke a token')
      .requiredOption('-j, --jti <jti>', 'JWT ID to revoke')
      .option('--secret <secret>', 'HMAC secret')
      .option('--reason <reason>', 'Reason for revocation')
      .action(async (options: TokenRevokeOptions) => {
        try {
          const signer = new HMACSigner(options.secret);
          await signer.revokeToken(options.jti);
          
          console.log(`✅ Token ${options.jti} has been revoked`);
          if (options.reason) {
            console.log(`Reason: ${options.reason}`);
          }
          
        } catch (error) {
          console.error('Failed to revoke token:', error);
          process.exit(1);
        }
      })
  );

// Show available scopes
program
  .command('scopes')
  .description('Show available scopes and bundles')
  .action(async () => {
    try {
      ScopeCatalog.initialize();
      const catalogs = ScopeCatalog.getAllCatalogs();
      
      console.log('\n🔧 Available Service Catalogs\n');
      catalogs.forEach(catalog => {
        console.log(`${catalog.name}:`);
        catalog.routes.forEach(route => {
          console.log(`  ${route.scope} -> ${route.method} ${route.url}`);
        });
        console.log('');
      });

      console.log('📦 Predefined Scope Bundles\n');
      const { SCOPE_BUNDLES } = await import('./scope');
      SCOPE_BUNDLES.forEach(bundle => {
        console.log(`${bundle.name}: ${bundle.description}`);
        console.log(`  Scopes: ${bundle.scopes.join(', ')}`);
        console.log('');
      });
      
    } catch (error) {
      console.error('Failed to show scopes:', error);
      process.exit(1);
    }
  });

// Database management
program
  .command('db')
  .description('Database management operations')
  .option('-d, --db <path>', 'Audit database path', 'audit.db')
  .addCommand(
    new Command('cleanup')
      .description('Clean up old audit logs')
      .option('-d, --days <number>', 'Remove logs older than N days', '90')
      .action(async (options: DatabaseCleanupOptions) => {
        try {
          const logger = new SQLiteAuditLogger(options.db);
          const removed = await logger.cleanupOldLogs(parseInt(options.days));
          
          console.log(`✅ Removed ${removed} old audit log entries`);
          await logger.close();
          
        } catch (error) {
          console.error('Failed to cleanup database:', error);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('info')
      .description('Show database information')
      .action(async (options: DatabaseOptions) => {
        try {
          const logger = new SQLiteAuditLogger(options.db);
          const size = logger.getDatabaseSize();
          const path = logger.getDatabasePath();
          
          console.log('\n💾 Database Information\n');
          console.log(`Path: ${path}`);
          console.log(`Size: ${(size / 1024 / 1024).toFixed(2)} MB`);
          
          await logger.close();
          
        } catch (error) {
          console.error('Failed to get database info:', error);
          process.exit(1);
        }
      })
  );

program.parse();
