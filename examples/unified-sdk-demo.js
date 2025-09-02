const { 
  withAgentKey, 
  withBrokeredAPI, 
  createBroker
} = require('../dist/index');

async function unifiedSDKDemo() {
  console.log('🚀 Kage Keys - Unified SDK Demo\n');
  console.log('This demo shows how the SDK works in both modes:\n');
  console.log('1. Standalone Mode: Simple scoped keys (original behavior)');
  console.log('2. Broker Mode: Enhanced security via HTTP broker');
  console.log('3. Brokered API: Direct API calls through broker\n');

  // 1. Standalone Mode (Original SDK behavior)
  console.log('📦 1. Standalone Mode (Original SDK)');
  console.log('   - Generates local tokens');
  console.log('   - Logs to local files');
  console.log('   - No external dependencies\n');

  try {
    await withAgentKey("github:repos.read", async (token) => {
      console.log(`   ✅ Generated token: ${token.substring(0, 20)}...`);
      console.log('   🔍 Simulating GitHub API call...');
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('   📊 Repository data retrieved successfully');
      return { repos: ['repo1', 'repo2', 'repo3'] };
    }, { expiresIn: 30 });

    console.log('   📝 Logged to local file: kage-keys.log\n');
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // 2. Broker Mode (Enhanced security)
  console.log('🔐 2. Broker Mode (Enhanced Security)');
  console.log('   - Uses real JWT tokens');
  console.log('   - Routes through HTTP broker');
  console.log('   - Enhanced audit logging\n');

  try {
    await withAgentKey("openai:chat.create", async (token) => {
      console.log(`   ✅ Generated broker token: ${token.substring(0, 20)}...`);
      console.log('   🔍 Token is a real JWT with HMAC signature');
      console.log('   📡 Would route through broker for OpenAI API calls');
      
      // Simulate broker routing
      await new Promise(resolve => setTimeout(resolve, 150));
      
      console.log('   🤖 AI response generated successfully');
      return { response: "Hello! I'm an AI assistant." };
    }, { 
      expiresIn: 3600,
      broker: {
        url: 'http://localhost:3000',
        useBroker: true
      }
    });

    console.log('   📝 Enhanced logging with broker integration\n');
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // 3. Brokered API (Direct API calls)
  console.log('🌐 3. Brokered API (Direct API Calls)');
  console.log('   - Makes actual HTTP requests through broker');
  console.log('   - Real API integration');
  console.log('   - Automatic scope enforcement\n');

  try {
    const result = await withBrokeredAPI("slack:chat.post", async (token) => {
      console.log(`   ✅ Using broker token: ${token.substring(0, 20)}...`);
      console.log('   📡 Making HTTP request to broker...');
      
      // Simulate HTTP request to broker
      const response = await simulateBrokerRequest(token, 'slack:chat.post');
      
      console.log('   💬 Slack message posted successfully');
      return response;
    }, {
      brokerUrl: 'http://localhost:3000',
      expiresIn: 1800,
      provider: 'slack'
    });

    console.log(`   📊 API Response: ${JSON.stringify(result)}\n`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // 4. Show logs
  console.log('📊 4. Viewing Logs');
  console.log('   📝 Logs are now stored in SQLite database via broker');
  console.log('   🔍 Use: npx kage-keys logs to view audit logs');

  console.log('\n🎯 Key Benefits of Unified SDK:');
  console.log('   ✅ Simple interface that works both ways');
  console.log('   ✅ Start simple, enhance when needed');
  console.log('   ✅ Backward compatibility maintained');
  console.log('   ✅ Choose your security level');
  console.log('   ✅ Same API, different capabilities');

  console.log('\n🚀 Getting Started:');
  console.log('   📦 Install: npm install @kagehq/keys');
  console.log('   🔑 Basic: withAgentKey("scope", fn)');
  console.log('   🔐 Enhanced: withAgentKey("scope", fn, { broker: { useBroker: true } })');
  console.log('   🌐 Full API: withBrokeredAPI("scope", apiCall, { brokerUrl: "..." })');
}

// Helper function to simulate broker requests
async function simulateBrokerRequest(token, scope) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Simulate different responses based on scope
  if (scope.includes('slack')) {
    return { ok: true, channel: 'general', message: 'Hello from Kage Keys!' };
  } else if (scope.includes('openai')) {
    return { id: 'chatcmpl-123', choices: [{ message: { content: 'AI response' } }] };
  } else {
    return { success: true, data: 'API response' };
  }
}

// Run demo
unifiedSDKDemo().catch(console.error);
