

export interface PolicyPack {
  name: string;
  description: string;
  scopes: string[];
  routes: PolicyRoute[];
  rateLimits: PolicyRateLimit;
  exampleCode: string;
  dependencies: string[];
  setupInstructions: string;
}

export interface PolicyRoute {
  scope: string;
  method: string;
  path: string;
  description: string;
  rateLimit?: number;
}

export interface PolicyRateLimit {
  requestsPerMinute: number;
  requestsPerHour: number;
  burstLimit: number;
}

export class PolicyPacks {
  private static packs: Map<string, PolicyPack> = new Map();

  static initialize(): void {
    this.registerDefaultPacks();
  }

  static registerPack(pack: PolicyPack): void {
    this.packs.set(pack.name, pack);
  }

  static getPack(name: string): PolicyPack | undefined {
    return this.packs.get(name);
  }

  static getAllPacks(): PolicyPack[] {
    return Array.from(this.packs.values());
  }

  static getPackNames(): string[] {
    return Array.from(this.packs.keys());
  }

  private static registerDefaultPacks(): void {
    // LLM with Tools Policy Pack
    this.registerPack({
      name: 'llm-with-tools',
      description: 'AI agent with access to LLM APIs and basic tool usage',
      scopes: [
        'openai:chat.create',
        'openai:chat.completions.create',
        'openai:models.list',
        'openai:embeddings.create',
        'anthropic:messages.create',
        'anthropic:models.list',
        'google:models.generateContent',
        'google:models.list'
      ],
      routes: [
        {
          scope: 'openai:chat.create',
          method: 'POST',
          path: '/v1/chat/completions',
          description: 'Create chat completion with OpenAI',
          rateLimit: 60
        },
        {
          scope: 'openai:embeddings.create',
          method: 'POST',
          path: '/v1/embeddings',
          description: 'Create embeddings with OpenAI',
          rateLimit: 100
        },
        {
          scope: 'anthropic:messages.create',
          method: 'POST',
          path: '/v1/messages',
          description: 'Create message with Anthropic Claude',
          rateLimit: 60
        }
      ],
      rateLimits: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        burstLimit: 10
      },
      dependencies: [
        '@kagehq/keys',
        'openai',
        'anthropic',
        '@google/generative-ai'
      ],
      setupInstructions: `1. Install dependencies: npm install ${this.getDependenciesString([
        '@kagehq/keys',
        'openai',
        'anthropic',
        '@google/generative-ai'
      ])}
2. Set environment variables for API keys
3. Use withAgentKey wrapper for authenticated API calls`,
      exampleCode: `import { withAgentKey } from '@kagehq/keys';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

async function llmWithTools(agentKey: string) {
  try {
    const result = await withAgentKey(agentKey, async (token) => {
      // OpenAI Chat
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      const chatResponse = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello!' }],
      });
      
      // Anthropic Claude
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      
      const claudeResponse = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Hello!' }],
      });
      
      return {
        openai: chatResponse.choices[0].message.content,
        claude: claudeResponse.content[0].text
      };
    });
    
    console.log('LLM responses:', result);
  } catch (error) {
    console.error('Authentication failed:', error);
  }
}`
    });

    // RAG Bot Policy Pack
    this.registerPack({
      name: 'rag-bot',
      description: 'Retrieval-Augmented Generation bot with document access and vector search',
      scopes: [
        'openai:chat.create',
        'openai:embeddings.create',
        'pinecone:index.query',
        'pinecone:index.upsert',
        'weaviate:objects.get',
        'weaviate:graphql.get',
        'qdrant:collections.search',
        'qdrant:collections.upsert'
      ],
      routes: [
        {
          scope: 'openai:embeddings.create',
          method: 'POST',
          path: '/v1/embeddings',
          description: 'Generate embeddings for documents',
          rateLimit: 100
        },
        {
          scope: 'pinecone:index.query',
          method: 'POST',
          path: '/query',
          description: 'Query Pinecone vector database',
          rateLimit: 200
        },
        {
          scope: 'weaviate:graphql.get',
          method: 'POST',
          path: '/v1/graphql',
          description: 'Query Weaviate vector database',
          rateLimit: 150
        }
      ],
      rateLimits: {
        requestsPerMinute: 100,
        requestsPerHour: 2000,
        burstLimit: 20
      },
      dependencies: [
        '@kagehq/keys',
        'openai',
        '@pinecone-database/pinecone',
        'weaviate-ts-client',
        'qdrant'
      ],
      setupInstructions: `1. Install dependencies: npm install ${this.getDependenciesString([
        '@kagehq/keys',
        'openai',
        '@pinecone-database/pinecone',
        'weaviate-ts-client',
        'qdrant'
      ])}
2. Set up vector database connections
3. Configure document processing pipeline`,
      exampleCode: `import { withAgentKey } from '@kagehq/keys';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

async function ragBot(agentKey: string, query: string) {
  try {
    const result = await withAgentKey(agentKey, async (token) => {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      // Generate query embedding
      const queryEmbedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
      });
      
      // Search vector database
      const pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
      });
      
      const index = pinecone.index('documents');
      const searchResults = await index.query({
        vector: queryEmbedding.data[0].embedding,
        topK: 5,
        includeMetadata: true,
      });
      
      // Generate response with context
      const context = searchResults.matches.map(match => match.metadata?.text).join('\\n');
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Use the provided context to answer questions.' },
          { role: 'user', content: \`Context: \${context}\\n\\nQuestion: \${query}\` }
        ],
      });
      
      return {
        answer: response.choices[0].message.content,
        sources: searchResults.matches.map(match => match.metadata?.source)
      };
    });
    
    console.log('RAG response:', result);
  } catch (error) {
    console.error('RAG bot failed:', error);
  }
}`
    });

    // GitHub Ops Bot Policy Pack
    this.registerPack({
      name: 'github-ops-bot',
      description: 'GitHub operations bot for repository management, issue tracking, and CI/CD',
      scopes: [
        'github:repos.read',
        'github:repos.write',
        'github:issues.read',
        'github:issues.write',
        'github:pulls.read',
        'github:pulls.write',
        'github:actions.read',
        'github:actions.write',
        'github:contents.read',
        'github:contents.write'
      ],
      routes: [
        {
          scope: 'github:repos.read',
          method: 'GET',
          path: '/repos/{owner}/{repo}',
          description: 'Get repository information',
          rateLimit: 100
        },
        {
          scope: 'github:issues.write',
          method: 'POST',
          path: '/repos/{owner}/{repo}/issues',
          description: 'Create or update issues',
          rateLimit: 30
        },
        {
          scope: 'github:actions.read',
          method: 'GET',
          path: '/repos/{owner}/{repo}/actions/runs',
          description: 'Get workflow runs',
          rateLimit: 100
        }
      ],
      rateLimits: {
        requestsPerMinute: 100,
        requestsPerHour: 5000,
        burstLimit: 15
      },
      dependencies: [
        '@kagehq/keys',
        '@octokit/rest',
        '@octokit/graphql'
      ],
      setupInstructions: `1. Install dependencies: npm install ${this.getDependenciesString([
        '@kagehq/keys',
        '@octokit/rest',
        '@octokit/graphql'
      ])}
2. Set GITHUB_TOKEN environment variable
3. Configure repository access permissions`,
      exampleCode: `import { withAgentKey } from '@kagehq/keys';
import { Octokit } from '@octokit/rest';

async function githubOpsBot(agentKey: string) {
  try {
    const result = await withAgentKey(agentKey, async (token) => {
      const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
      });
      
      // List repositories
      const { data: repos } = await octokit.repos.listForAuthenticatedUser({
        per_page: 10,
        sort: 'updated',
      });
      
      // Create an issue
      const { data: issue } = await octokit.issues.create({
        owner: 'owner',
        repo: 'repo',
        title: 'Automated issue from bot',
        body: 'This issue was created by the GitHub ops bot.',
        labels: ['bot', 'automation'],
      });
      
      // Get workflow runs
      const { data: runs } = await octokit.actions.listWorkflowRunsForRepo({
        owner: 'owner',
        repo: 'repo',
        per_page: 5,
      });
      
      return {
        repositories: repos.map(repo => ({ name: repo.name, url: repo.html_url })),
        issueCreated: { number: issue.number, url: issue.html_url },
        recentRuns: runs.workflow_runs.map(run => ({ 
          id: run.id, 
          status: run.status, 
          conclusion: run.conclusion 
        }))
      };
    });
    
    console.log('GitHub operations completed:', result);
  } catch (error) {
    console.error('GitHub ops failed:', error);
  }
}`
    });

    // Support Triage Bot Policy Pack
    this.registerPack({
      name: 'support-triage-bot',
      description: 'Customer support triage bot with ticket management and knowledge base access',
      scopes: [
        'zendesk:tickets.read',
        'zendesk:tickets.write',
        'zendesk:users.read',
        'zendesk:organizations.read',
        'intercom:conversations.read',
        'intercom:conversations.write',
        'intercom:contacts.read',
        'slack:chat.write',
        'slack:channels.read',
        'notion:pages.read',
        'notion:databases.read'
      ],
      routes: [
        {
          scope: 'zendesk:tickets.read',
          method: 'GET',
          path: '/api/v2/tickets',
          description: 'Read Zendesk tickets',
          rateLimit: 100
        },
        {
          scope: 'intercom:conversations.read',
          method: 'GET',
          path: '/conversations',
          description: 'Read Intercom conversations',
          rateLimit: 60
        },
        {
          scope: 'slack:chat.write',
          method: 'POST',
          path: '/chat.postMessage',
          description: 'Send Slack messages',
          rateLimit: 50
        }
      ],
      rateLimits: {
        requestsPerMinute: 80,
        requestsPerHour: 1500,
        burstLimit: 12
      },
      dependencies: [
        '@kagehq/keys',
        'zendesk-node-v2',
        'intercom-client',
        '@slack/web-api',
        '@notionhq/client'
      ],
      setupInstructions: `1. Install dependencies: npm install ${this.getDependenciesString([
        '@kagehq/keys',
        'zendesk-node-v2',
        'intercom-client',
        '@slack/web-api',
        '@notionhq/client'
      ])}
2. Configure API keys for all services
3. Set up webhook endpoints for real-time updates`,
      exampleCode: `import { withAgentKey } from '@kagehq/keys';
import Zendesk from 'zendesk-node-v2';
import { WebClient } from '@slack/web-api';
import { Client } from '@notionhq/client';

async function supportTriageBot(agentKey: string) {
  try {
    const result = await withAgentKey(agentKey, async (token) => {
      // Zendesk tickets
      const zendesk = new Zendesk({
        subdomain: process.env.ZENDESK_SUBDOMAIN,
        email: process.env.ZENDESK_EMAIL,
        token: process.env.ZENDESK_TOKEN,
      });
      
      const tickets = await zendesk.tickets.list();
      const urgentTickets = tickets.filter(ticket => 
        ticket.priority === 'urgent' || ticket.status === 'open'
      );
      
      // Slack notifications
      const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
      if (urgentTickets.length > 0) {
        await slack.chat.postMessage({
          channel: '#support-alerts',
          text: \`🚨 \${urgentTickets.length} urgent tickets need attention!\`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: \`*Urgent Tickets:* \${urgentTickets.length}\`
              }
            }
          ]
        });
      }
      
      // Notion knowledge base
      const notion = new Client({ auth: process.env.NOTION_TOKEN });
      const database = await notion.databases.query({
        database_id: process.env.NOTION_KB_DATABASE_ID,
        filter: { property: 'Status', select: { equals: 'Published' } }
      });
      
      return {
        urgentTickets: urgentTickets.length,
        slackNotificationSent: urgentTickets.length > 0,
        knowledgeBaseArticles: database.results.length
      };
    });
    
    console.log('Support triage completed:', result);
  } catch (error) {
    console.error('Support triage failed:', error);
  }
}`
    });
  }

  private static getDependenciesString(dependencies: string[]): string {
    return dependencies.join(' ');
  }

  static generateProjectFiles(packName: string, projectDir: string): void {
    const pack = this.getPack(packName);
    if (!pack) {
      throw new Error(`Policy pack '${packName}' not found`);
    }

    // Generate package.json with dependencies
    const packageJson = {
      name: `kage-keys-${packName}`,
      version: "1.0.0",
      description: `Kage Keys project using ${pack.name} policy pack`,
      main: "index.js",
      scripts: {
        "start": "node index.js",
        "dev": "node --watch index.js",
        "test": "echo \"No tests specified\" && exit 0"
      },
      dependencies: {
        "@kagehq/keys": "^0.4.1",
        ...pack.dependencies.reduce((acc, dep) => {
          acc[dep] = "latest";
          return acc;
        }, {} as Record<string, string>)
      },
      keywords: [
        "ai",
        "agents",
        "authentication",
        "kage-keys",
        packName
      ],
      author: "Your Name",
      license: "MIT"
    };

    // Generate README
    const readme = `# Kage Keys ${pack.name} Project

This project uses the **${pack.name}** policy pack from Kage Keys.

## 📋 Policy Pack Details

**${pack.description}**

### Scopes
${pack.scopes.map(scope => `- \`${scope}\``).join('\n')}

### Rate Limits
- **Per Minute:** ${pack.rateLimits.requestsPerMinute} requests
- **Per Hour:** ${pack.rateLimits.requestsPerHour} requests
- **Burst Limit:** ${pack.rateLimits.burstLimit} requests

## 🚀 Quick Start

1. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Set environment variables:**
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your API keys
   \`\`\`

3. **Run the bot:**
   \`\`\`bash
   npm start
   \`\`\`

## 🔧 Setup Instructions

${pack.setupInstructions}

## 📚 Example Code

\`\`\`javascript
${pack.exampleCode}
\`\`\`

## 📖 Documentation

- [Kage Keys GitHub](https://github.com/kagehq/keys)
- [Policy Pack: ${pack.name}](https://github.com/kagehq/keys#policy-packs)
`;

    // Generate .env.example
    const envExample = `# Environment variables for ${pack.name} policy pack

# Kage Keys Configuration
KAGE_AGENT_KEY=your-agent-key-here
KAGE_BROKER_URL=http://localhost:3000

# API Keys (configure based on your scopes)
${this.generateEnvVarsForPack(pack)}

# Rate Limiting
RATE_LIMIT_PER_MINUTE=${pack.rateLimits.requestsPerMinute}
RATE_LIMIT_PER_HOUR=${pack.rateLimits.requestsPerHour}
RATE_LIMIT_BURST=${pack.rateLimits.burstLimit}
`;

    // Generate main index.js
    const indexJs = `// Kage Keys ${pack.name} Bot
import { withAgentKey } from '@kagehq/keys';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Main bot function
async function main() {
  const agentKey = process.env.KAGE_AGENT_KEY;
  
  if (!agentKey) {
    console.error('KAGE_AGENT_KEY environment variable is required');
    process.exit(1);
  }
  
  console.log('🤖 Starting ${pack.name} bot...');
  
  try {
    // Your bot logic here
    console.log('✅ Bot started successfully');
  } catch (error) {
    console.error('❌ Bot failed to start:', error);
    process.exit(1);
  }
}

// Run the bot
main().catch(console.error);
`;

    // Write files
    const fs = require('fs');
    const path = require('path');

    fs.writeFileSync(
      path.join(projectDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    fs.writeFileSync(
      path.join(projectDir, 'README.md'),
      readme
    );

    fs.writeFileSync(
      path.join(projectDir, '.env.example'),
      envExample
    );

    fs.writeFileSync(
      path.join(projectDir, 'index.js'),
      indexJs
    );

    // Create examples directory with the example code
    const examplesDir = path.join(projectDir, 'examples');
    if (!fs.existsSync(examplesDir)) {
      fs.mkdirSync(examplesDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(examplesDir, `${packName}-example.js`),
      pack.exampleCode
    );
  }

  private static generateEnvVarsForPack(pack: PolicyPack): string {
    const envVars: string[] = [];
    
    if (pack.scopes.some(scope => scope.includes('openai'))) {
      envVars.push('OPENAI_API_KEY=your-openai-api-key-here');
    }
    
    if (pack.scopes.some(scope => scope.includes('anthropic'))) {
      envVars.push('ANTHROPIC_API_KEY=your-anthropic-api-key-here');
    }
    
    if (pack.scopes.some(scope => scope.includes('github'))) {
      envVars.push('GITHUB_TOKEN=your-github-token-here');
    }
    
    if (pack.scopes.some(scope => scope.includes('slack'))) {
      envVars.push('SLACK_BOT_TOKEN=your-slack-bot-token-here');
    }
    
    if (pack.scopes.some(scope => scope.includes('zendesk'))) {
      envVars.push('ZENDESK_SUBDOMAIN=your-subdomain');
      envVars.push('ZENDESK_EMAIL=your-email@example.com');
      envVars.push('ZENDESK_TOKEN=your-zendesk-token-here');
    }
    
    if (pack.scopes.some(scope => scope.includes('intercom'))) {
      envVars.push('INTERCOM_ACCESS_TOKEN=your-intercom-token-here');
    }
    
    if (pack.scopes.some(scope => scope.includes('notion'))) {
      envVars.push('NOTION_TOKEN=your-notion-token-here');
      envVars.push('NOTION_KB_DATABASE_ID=your-database-id-here');
    }
    
    if (pack.scopes.some(scope => scope.includes('pinecone'))) {
      envVars.push('PINECONE_API_KEY=your-pinecone-api-key-here');
      envVars.push('PINECONE_ENVIRONMENT=your-environment-here');
    }
    
    return envVars.join('\n');
  }

  // Additional methods for compatibility with tests
  static getPackScopes(packName: string): string[] {
    const pack = this.getPack(packName);
    return pack ? pack.scopes : [];
  }

  static getPackRoutes(packName: string): PolicyRoute[] {
    const pack = this.getPack(packName);
    return pack ? pack.routes : [];
  }

  static getPackDependencies(packName: string): string[] {
    const pack = this.getPack(packName);
    return pack ? pack.dependencies : [];
  }

  static searchPacks(query: string): PolicyPack[] {
    const allPacks = this.getAllPacks();
    const lowerQuery = query.toLowerCase();
    
    return allPacks.filter(pack => 
      pack.name.toLowerCase().includes(lowerQuery) ||
      pack.description.toLowerCase().includes(lowerQuery) ||
      pack.scopes.some(scope => scope.toLowerCase().includes(lowerQuery))
    );
  }
}
