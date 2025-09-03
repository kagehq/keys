/**
 * OpenAI Assistants + Kage Keys Integration Example
 * 
 * This example shows how to integrate Kage Keys with OpenAI Assistants
 * to provide scoped, authenticated access to external APIs.
 */

const { withAgentKey } = require('../dist/index.js');

// Mock OpenAI imports (these would be real in actual usage)
// import OpenAI from 'openai';

/**
 * Kage Keys OpenAI Wrapper
 * 
 * This wrapper ensures that all external API calls made by OpenAI Assistants
 * are properly authenticated and scoped using Kage Keys.
 */
class KageKeysOpenAIWrapper {
  constructor(agentKey, openaiApiKey) {
    this.agentKey = agentKey;
    this.openaiApiKey = openaiApiKey;
  }

  /**
   * Create an authenticated OpenAI client
   */
  async createClient() {
    return await withAgentKey(this.agentKey, async (token) => {
      // Return OpenAI client with authenticated token
      return {
        apiKey: token, // Use Kage Keys token instead of raw API key
        baseURL: 'https://api.openai.com/v1',
        // Add any other OpenAI client configuration
      };
    });
  }

  /**
   * Execute a function with Kage Keys authentication
   */
  async executeWithAuth(fn) {
    return await withAgentKey(this.agentKey, async (token) => {
      return await fn(token);
    });
  }
}

/**
 * Custom Tool for OpenAI Assistants
 * 
 * This tool can be used by OpenAI Assistants to access external APIs
 * with proper scope validation through Kage Keys.
 */
class KageKeysCustomTool {
  constructor(agentKey, scope) {
    this.kageWrapper = new KageKeysOpenAIWrapper(agentKey, null);
    this.scope = scope;
  }

  /**
   * GitHub Repository Information Tool
   */
  async getGitHubRepoInfo(owner, repo) {
    return await this.kageWrapper.executeWithAuth(async (token) => {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        name: data.name,
        description: data.description,
        stars: data.stargazers_count,
        language: data.language,
        url: data.html_url,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    });
  }

  /**
   * Weather Information Tool
   */
  async getWeatherInfo(city) {
    return await this.kageWrapper.executeWithAuth(async (token) => {
      // This would use a weather API service
      // For demo purposes, returning mock data
      return {
        city: city,
        temperature: '22°C',
        condition: 'Sunny',
        humidity: '65%',
        wind_speed: '12 km/h'
      };
    });
  }

  /**
   * File System Tool (with scope validation)
   */
  async readFile(path) {
    return await this.kageWrapper.executeWithAuth(async (token) => {
      // This would validate the path against allowed directories
      // based on the scope (e.g., 'filesystem:read:/allowed/path/*')
      if (!path.startsWith('/allowed/')) {
        throw new Error('Access denied: Path not in allowed scope');
      }
      
      // Mock file reading
      return {
        path: path,
        content: 'This is the content of the file',
        size: '1.2 KB',
        last_modified: new Date().toISOString()
      };
    });
  }
}

/**
 * OpenAI Assistant with Kage Keys Integration
 */
class KageKeysOpenAIAssistant {
  constructor(agentKey, openaiApiKey) {
    this.kageWrapper = new KageKeysOpenAIWrapper(agentKey, openaiApiKey);
    this.customTools = new KageKeysCustomTool(agentKey, 'openai:assistants.create');
  }

  /**
   * Create an assistant with custom tools
   */
  async createAssistant(name, instructions) {
    return await this.kageWrapper.executeWithAuth(async (token) => {
      // In a real implementation, this would create an OpenAI Assistant
      // with the custom tools that use Kage Keys for authentication
      
      const assistant = {
        id: 'asst_' + Math.random().toString(36).substr(2, 9),
        name: name,
        instructions: instructions,
        tools: [
          {
            type: 'function',
            function: {
              name: 'getGitHubRepoInfo',
              description: 'Get information about a GitHub repository',
              parameters: {
                type: 'object',
                properties: {
                  owner: { type: 'string', description: 'Repository owner' },
                  repo: { type: 'string', description: 'Repository name' }
                },
                required: ['owner', 'repo']
              }
            }
          },
          {
            type: 'function',
            function: {
              name: 'getWeatherInfo',
              description: 'Get weather information for a city',
              parameters: {
                type: 'object',
                properties: {
                  city: { type: 'string', description: 'City name' }
                },
                required: ['city']
              }
            }
          }
        ],
        created_at: new Date().toISOString()
      };

      return assistant;
    });
  }

  /**
   * Execute a tool call with proper authentication
   */
  async executeToolCall(toolName, arguments) {
    switch (toolName) {
      case 'getGitHubRepoInfo':
        const { owner, repo } = arguments;
        return await this.customTools.getGitHubRepoInfo(owner, repo);
      
      case 'getWeatherInfo':
        const { city } = arguments;
        return await this.customTools.getWeatherInfo(city);
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}

/**
 * Main Integration Example
 */
async function main() {
  console.log('🚀 OpenAI Assistants + Kage Keys Integration Example\n');

  // In a real application, you would get these from your Kage Keys broker
  const agentKey = 'your-agent-key-here';
  const openaiApiKey = 'your-openai-api-key-here';
  
  try {
    // Create OpenAI Assistant with Kage Keys integration
    const assistant = new KageKeysOpenAIAssistant(agentKey, openaiApiKey);

    console.log('✅ OpenAI Assistant created with Kage Keys integration');
    console.log('📋 Available tools:');
    console.log(`   - GitHub Repository Info (scope: github:repos.read)`);
    console.log(`   - Weather Information (scope: weather:read)`);
    console.log(`   - File System Access (scope: filesystem:read)\n`);

    // Example: Create an assistant
    console.log('🤖 Creating OpenAI Assistant...');
    const newAssistant = await assistant.createAssistant(
      'Kage Keys Assistant',
      'I can help you access GitHub repositories, weather information, and files with proper authentication.'
    );
    console.log('✅ Assistant created:', newAssistant.name);

    // Example: Execute tool calls
    console.log('\n🔧 Testing tool execution...');
    
    const repoInfo = await assistant.executeToolCall('getGitHubRepoInfo', {
      owner: 'kagehq',
      repo: 'keys'
    });
    console.log('📊 GitHub Repo Info:', repoInfo);

    const weatherInfo = await assistant.executeToolCall('getWeatherInfo', {
      city: 'San Francisco'
    });
    console.log('🌤️ Weather Info:', weatherInfo);

    console.log('\n✅ Integration example completed successfully!');
    console.log('\n💡 Key Benefits:');
    console.log('   - OpenAI Assistants can use external APIs securely');
    console.log('   - All API calls are authenticated via Kage Keys');
    console.log('   - Scope validation happens automatically');
    console.log('   - Audit logging for compliance');
    console.log('   - Token expiration and rotation handled automatically');

  } catch (error) {
    console.error('❌ Error in integration example:', error.message);
    console.log('\n💡 To run this example:');
    console.log('   1. Start your Kage Keys broker: npm start');
    console.log('   2. Generate an agent key: kage-keys create-token --agent "openai-assistant" --scope "github:repos.read,weather:read,filesystem:read"');
    console.log('   3. Update the agentKey variable with your actual key');
    console.log('   4. Install OpenAI: npm install openai');
  }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  KageKeysOpenAIWrapper,
  KageKeysCustomTool,
  KageKeysOpenAIAssistant
};
