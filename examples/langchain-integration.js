/**
 * LangChain Integration Example
 * 
 * This example shows how to integrate Kage Keys with LangChain agents
 * to provide scoped, authenticated access to external APIs.
 */

const { withAgentKey } = require('../dist/index.js');

// Mock LangChain imports (these would be real in actual usage)
// import { ChatOpenAI } from '@langchain/openai';
// import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
// import { DynamicStructuredTool } from '@langchain/core/tools';
// import { ChatPromptTemplate } from '@langchain/core/prompts';

/**
 * Kage Keys Wrapper for LangChain Tools
 * 
 * This wrapper ensures that all external API calls made by LangChain tools
 * are properly authenticated and scoped using Kage Keys.
 */
class KageKeysToolWrapper {
  constructor(agentKey, scope) {
    this.agentKey = agentKey;
    this.scope = scope;
  }

  /**
   * Wrap a function with Kage Keys authentication
   */
  async executeWithAuth(fn) {
    return await withAgentKey(this.agentKey, async (token) => {
      // The function receives the authenticated token
      return await fn(token);
    });
  }
}

/**
 * GitHub Repository Tool
 * 
 * Example tool that uses Kage Keys to access GitHub API
 * with proper scope validation.
 */
class GitHubRepoTool {
  constructor(agentKey) {
    this.kageWrapper = new KageKeysToolWrapper(agentKey, 'github:repos.read');
  }

  async getRepoInfo(owner, repo) {
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
        url: data.html_url
      };
    });
  }

  async listIssues(owner, repo) {
    return await this.kageWrapper.executeWithAuth(async (token) => {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=5`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const issues = await response.json();
      return issues.map(issue => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        url: issue.html_url
      }));
    });
  }
}

/**
 * OpenAI Chat Tool
 * 
 * Example tool that uses Kage Keys to access OpenAI API
 * with proper scope validation.
 */
class OpenAIChatTool {
  constructor(agentKey) {
    this.kageWrapper = new KageKeysToolWrapper(agentKey, 'openai:chat.create');
  }

  async chat(message, model = 'gpt-3.5-turbo') {
    return await this.kageWrapper.executeWithAuth(async (token) => {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: message }],
          max_tokens: 150
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || 'No response';
    });
  }
}

/**
 * Main Integration Example
 */
async function main() {
  console.log('🚀 LangChain + Kage Keys Integration Example\n');

  // In a real application, you would get this from your Kage Keys broker
  const agentKey = 'your-agent-key-here';
  
  try {
    // Create tools with Kage Keys authentication
    const githubTool = new GitHubRepoTool(agentKey);
    const openaiTool = new OpenAIChatTool(agentKey);

    console.log('✅ Tools created with Kage Keys authentication');
    console.log('📋 Available tools:');
    console.log(`   - GitHub Repository Tool (scope: github:repos.read)`);
    console.log(`   - OpenAI Chat Tool (scope: openai:chat.create)\n`);

    // Example: Test GitHub tool
    console.log('🔍 Testing GitHub Repository Tool...');
    const repoInfo = await githubTool.getRepoInfo('kagehq', 'keys');
    console.log('📊 Repository Info:', repoInfo);

    // Example: Test OpenAI tool
    console.log('\n🤖 Testing OpenAI Chat Tool...');
    const chatResponse = await openaiTool.chat('Explain what Kage Keys is in one sentence.');
    console.log('💬 OpenAI Response:', chatResponse);

    console.log('\n✅ Integration example completed successfully!');
    console.log('\n💡 Key Benefits:');
    console.log('   - All external API calls are authenticated via Kage Keys');
    console.log('   - Scope validation happens automatically');
    console.log('   - Audit logging for compliance');
    console.log('   - Token expiration and rotation handled automatically');

  } catch (error) {
    console.error('❌ Error in integration example:', error.message);
    console.log('\n💡 To run this example:');
    console.log('   1. Start your Kage Keys broker: npm start');
    console.log('   2. Generate an agent key: kage-keys create-token --agent "langchain-demo" --scope "github:repos.read,openai:chat.create"');
    console.log('   3. Update the agentKey variable with your actual key');
    console.log('   4. Install LangChain: npm install langchain @langchain/openai');
  }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  KageKeysToolWrapper,
  GitHubRepoTool,
  OpenAIChatTool
};
