const { 
  createBroker, 
  createSigner, 
  ScopeCatalog, 
  SCOPE_BUNDLES,
  ScopeParser 
} = require('../dist/index');

async function demo() {
  console.log('🚀 Agent Key Broker Demo - Phase 2\n');

  // 1. Initialize scope catalogs
  console.log('1. Loading service catalogs...');
  ScopeCatalog.initialize();
  const catalogs = ScopeCatalog.getAllCatalogs();
  console.log(`   Loaded ${catalogs.length} service catalogs:`, catalogs.map(c => c.name));
  
  // 2. Show available scope bundles
  console.log('\n2. Available scope bundles:');
  SCOPE_BUNDLES.forEach(bundle => {
    console.log(`   ${bundle.name}: ${bundle.description}`);
    console.log(`     Scopes: ${bundle.scopes.join(', ')}`);
  });

  // 3. Test scope parsing
  console.log('\n3. Testing scope parsing:');
  const testScopes = [
    'openai:chat.create',
    'github:repos.*',
    'slack:chat.*',
    'invalid:scope'
  ];
  
  testScopes.forEach(scope => {
    try {
      const parsed = ScopeParser.parse(scope);
      console.log(`   ${scope} -> Service: ${parsed.service}, Resource: ${parsed.resource}, Action: ${parsed.action}, Wildcard: ${parsed.isWildcard}`);
    } catch (error) {
      console.log(`   ${scope} -> Error: ${error.message}`);
    }
  });

  // 4. Test scope matching
  console.log('\n4. Testing scope matching:');
  const tokenScope = 'openai:chat.create';
  const routeScopes = ['openai:chat.*', 'openai:models.*', 'github:repos.read'];
  
  routeScopes.forEach(routeScope => {
    const matches = ScopeParser.matches(tokenScope, routeScope);
    console.log(`   ${tokenScope} matches ${routeScope}: ${matches}`);
  });

  // 5. Create and start broker
  console.log('\n5. Starting broker server...');
  try {
    const broker = await createBroker(3000, 'demo-audit.db');
    console.log('   Broker started on port 3000');
    console.log('   Audit database: demo-audit.db');
    
    // 6. Show broker info
    console.log('\n6. Broker configuration:');
    const providers = broker.getProviders();
    providers.forEach(provider => {
      console.log(`   ${provider.name}: ${provider.routes.length} routes`);
      provider.routes.forEach(route => {
        console.log(`     ${route.scope} -> ${route.method} ${route.url}`);
      });
    });

    // 7. Demo token operations
    console.log('\n7. Testing token operations...');
    const signer = await createSigner();
    
    // Create a test token
    const tokenPayload = {
      iss: 'kage-keys',
      sub: 'demo-agent',
      aud: 'openai',
      scope: 'openai:chat.create',
      nbf: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      jti: 'demo-token-123'
    };
    
    const token = await signer.sign(tokenPayload);
    console.log(`   Created token: ${token.substring(0, 50)}...`);
    
    // Verify token
    const validation = await signer.verify(token);
    console.log(`   Token valid: ${validation.valid}`);
    if (validation.token) {
      console.log(`   Token scope: ${validation.token.scope}`);
      console.log(`   Token agent: ${validation.token.sub}`);
    }

    // 8. Show usage instructions
    console.log('\n8. Usage instructions:');
    console.log('   To test the broker, send a request with:');
    console.log(`   curl -H "X-Agent-Key: ${token}" http://localhost:3000/v1/chat/completions`);
    console.log('\n   Or use the demo client below...');

    // 9. Demo client
    console.log('\n9. Demo client (simulating agent request):');
    await demoClient(token);

    // Keep broker running for demo
    console.log('\n✅ Broker is running! Press Ctrl+C to stop.');
    console.log('   Check demo-audit.db for audit logs');
    
  } catch (error) {
    console.error('Failed to start broker:', error);
  }
}

async function demoClient(token) {
  const https = require('https');
  
  // Simulate an agent making a request through the broker
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'X-Agent-Key': token,
      'Content-Type': 'application/json'
    }
  };

  const requestData = JSON.stringify({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: 'Hello, this is a test message from the demo agent!' }
    ],
    max_tokens: 50
  });

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('   ✅ Request successful!');
          console.log('   Response status:', res.statusCode);
        } else {
          console.log('   ❌ Request failed:', res.statusCode);
          console.log('   Response:', data);
        }
        resolve();
      });
    });

    req.on('error', (error) => {
      console.log('   ⚠️  Request error (expected if OpenAI API key not set):', error.message);
      resolve();
    });

    req.write(requestData);
    req.end();
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down broker...');
  process.exit(0);
});

// Run demo
demo().catch(console.error);
