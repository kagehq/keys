#!/usr/bin/env node

/**
 * Security Hardening Demo
 * 
 * This demo showcases the security features of Kage Keys:
 * - mTLS between client and broker
 * - CSRF protection for web UI
 * - Strict CORS policies
 * - Security headers
 * - Rate limiting
 * - Session management
 */

const { 
  SecurityManager, 
  AgentKeyBroker, 
  HMACSigner, 
  SQLiteAuditLogger,
  WebDashboard,
  Dashboard,
  ApprovalManager,
  TenancyManager
} = require('../dist');

const fs = require('fs');
const path = require('path');

async function runSecurityDemo() {
  console.log('🔒 Kage Keys Security Hardening Demo\n');

  try {
    // 1. Initialize Security Manager with production-ready settings
    console.log('1️⃣ Initializing Security Manager...');
    const securityManager = new SecurityManager({
      tls: {
        enabled: true,
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3',
        ciphers: [
          'ECDHE-RSA-AES256-GCM-SHA384',
          'ECDHE-RSA-AES128-GCM-SHA384',
          'ECDHE-RSA-CHACHA20-POLY1305'
        ],
        honorCipherOrder: true,
        requestCert: true,
        rejectUnauthorized: true
      },
      mtls: {
        enabled: true,
        verifyClient: true
      },
      cors: {
        enabled: true,
        origins: ['https://localhost:8080', 'https://localhost:3000'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-Agent-Key',
          'X-Request-ID',
          'X-CSRF-Token'
        ],
        credentials: true,
        maxAge: 86400
      },
      csrf: {
        enabled: true,
        tokenLength: 32,
        expiresIn: 24 * 60 * 60 * 1000
      },
      session: {
        enabled: true,
        maxAge: 24 * 60 * 60 * 1000,
        secure: true,
        httpOnly: true,
        sameSite: 'strict'
      },
      rateLimit: {
        enabled: true,
        windowMs: 15 * 60 * 1000,
        maxRequests: 100,
        skipSuccessfulRequests: false,
        skipFailedRequests: false
      },
      headers: {
        xContentTypeOptions: true,
        xFrameOptions: true,
        xXSSProtection: true,
        referrerPolicy: true,
        contentSecurityPolicy: true,
        strictTransportSecurity: true,
        permissionsPolicy: true
      },
      auth: {
        enabled: true,
        method: 'session',
        jwtExpiresIn: 24 * 60 * 60,
        passwordPolicy: {
          minLength: 12,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true
        }
      },
      audit: {
        enabled: true,
        logLevel: 'info',
        sensitiveFields: ['password', 'token', 'apiKey', 'secret', 'authorization'],
        maskPatterns: [
          /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/g,
          /token\s+[a-zA-Z0-9\-._~+/]+=*/g,
          /api[_-]?key\s*[:=]\s*[a-zA-Z0-9\-._~+/]+=*/gi
        ]
      }
    });

    console.log('✅ Security Manager initialized with production settings');
    console.log('📊 Security Summary:', securityManager.getSecuritySummary());

    // 2. Test password validation
    console.log('\n2️⃣ Testing Password Policy...');
    const testPasswords = [
      'weak',
      'password123',
      'StrongPass123!',
      'VeryStrongPassword123!@#'
    ];

    testPasswords.forEach(password => {
      const validation = securityManager.validatePassword(password);
      const status = validation.valid ? '✅' : '❌';
      console.log(`${status} "${password}": ${validation.valid ? 'Valid' : validation.errors.join(', ')}`);
    });

    // 3. Test CSRF token generation and validation
    console.log('\n3️⃣ Testing CSRF Protection...');
    const csrfToken = securityManager.generateCSRFToken();
    console.log(`🔑 Generated CSRF token: ${csrfToken.substring(0, 16)}...`);
    
    const isValid = securityManager.validateCSRFToken(csrfToken, csrfToken);
    console.log(`✅ CSRF token validation: ${isValid ? 'PASS' : 'FAIL'}`);

    // 4. Test session management
    console.log('\n4️⃣ Testing Session Management...');
    const sessionId = securityManager.generateSessionId();
    console.log(`🔐 Generated session ID: ${sessionId.substring(0, 16)}...`);
    
    const cookieOptions = securityManager.getCookieOptions(true);
    console.log(`🍪 Secure cookie options:`, cookieOptions);

    // 5. Test sensitive data masking
    console.log('\n5️⃣ Testing Sensitive Data Masking...');
    const sensitiveData = {
      user: 'john_doe',
      password: 'secret123',
      apiKey: 'sk-1234567890abcdef',
      token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      request: {
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          'X-API-Key': 'sk-1234567890abcdef'
        }
      }
    };

    const maskedData = securityManager.maskSensitiveData(JSON.stringify(sensitiveData, null, 2));
    console.log('🔒 Masked sensitive data:');
    console.log(maskedData);

    // 6. Test rate limiting
    console.log('\n6️⃣ Testing Rate Limiting...');
    const clientId = 'test-client-123';
    const maxRequests = 5;
    
    for (let i = 1; i <= maxRequests + 2; i++) {
      const shouldLimit = securityManager.shouldRateLimit(clientId, i);
      const status = shouldLimit ? '🚫 BLOCKED' : '✅ ALLOWED';
      console.log(`Request ${i}: ${status}`);
    }

    // 7. Initialize core components with security
    console.log('\n7️⃣ Initializing Secure Components...');
    
    const auditLogger = new SQLiteAuditLogger('security-demo.db');
    const signer = new HMACSigner();
    
    // Initialize enterprise components
    const approvalManager = new ApprovalManager({ enableCLI: true });
    const tenancyManager = new TenancyManager({ enableRBAC: true });
    const dashboard = new Dashboard({ 
      auditLogger, 
      enableLiveStreaming: true, 
      updateIntervalMs: 5000 
    });

    // 8. Test web dashboard with security
    console.log('\n8️⃣ Testing Secure Web Dashboard...');
    
    const webDashboard = new WebDashboard({
      dashboard,
      approvalManager,
      tenancyManager,
      auditLogger,
      port: 8080,
      enableHTTPS: false, // Set to true in production with real certificates
      security: {
        enableCSRF: true,
        secureCookies: false, // Set to true in production
        sameSite: 'strict'
      }
    });

    // Start the dashboard
    await webDashboard.start(8080);
    console.log('🌐 Secure web dashboard started on http://localhost:8080');
    console.log('🔐 Login credentials: admin / admin123');

    // 9. Security recommendations
    console.log('\n9️⃣ Security Recommendations for Production:');
    console.log('   • Enable HTTPS with valid SSL certificates');
    console.log('   • Use mTLS for client-broker communication');
    console.log('   • Implement proper authentication (OAuth2, SAML)');
    console.log('   • Use secure session storage (Redis, database)');
    console.log('   • Enable HSTS headers');
    console.log('   • Implement IP whitelisting');
    console.log('   • Use environment variables for secrets');
    console.log('   • Regular security audits and penetration testing');
    console.log('   • Monitor and log all security events');

    // 10. Demo completion
    console.log('\n🎉 Security Hardening Demo Complete!');
    console.log('\n📋 What to test:');
    console.log('   • Visit http://localhost:8080');
    console.log('   • Login with admin/admin123');
    console.log('   • Check browser dev tools for security headers');
    console.log('   • Try accessing protected routes without authentication');
    console.log('   • Test CSRF protection on form submissions');

    // Keep the demo running
    console.log('\n⏳ Demo running... Press Ctrl+C to stop');
    
  } catch (error) {
    console.error('❌ Security demo error:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down security demo...');
  process.exit(0);
});

// Run the demo
if (require.main === module) {
  runSecurityDemo().catch(console.error);
}

module.exports = { runSecurityDemo };
