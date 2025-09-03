/**
 * LlamaIndex + Kage Keys Integration Example
 * 
 * This example shows how to integrate Kage Keys with LlamaIndex
 * to provide scoped, authenticated access to external APIs for RAG operations.
 */

const { withAgentKey } = require('../dist/index.js');

// Mock LlamaIndex imports (these would be real in actual usage)
// import { VectorStoreIndex, SimpleDirectoryReader } from 'llamaindex';
// import { OpenAIEmbedding, OpenAI } from 'llamaindex/llms/openai';

/**
 * Kage Keys LlamaIndex Wrapper
 * 
 * This wrapper ensures that all external API calls made by LlamaIndex
 * are properly authenticated and scoped using Kage Keys.
 */
class KageKeysLlamaIndexWrapper {
  constructor(agentKey) {
    this.agentKey = agentKey;
  }

  /**
   * Execute a function with Kage Keys authentication
   */
  async executeWithAuth(fn) {
    return await withAgentKey(this.agentKey, async (token) => {
      return await fn(token);
    });
  }

  /**
   * Create an authenticated embedding instance
   */
  async createEmbedding() {
    return await this.executeWithAuth(async (token) => {
      // In a real implementation, this would create an OpenAIEmbedding instance
      // with the authenticated token
      return {
        apiKey: token,
        model: 'text-embedding-ada-002',
        dimensions: 1536
      };
    });
  }

  /**
   * Create an authenticated LLM instance
   */
  async createLLM() {
    return await this.executeWithAuth(async (token) => {
      // In a real implementation, this would create an OpenAI instance
      // with the authenticated token
      return {
        apiKey: token,
        model: 'gpt-3.5-turbo',
        temperature: 0.1,
        maxTokens: 512
      };
    });
  }
}

/**
 * Kage Keys GitHub Reader for LlamaIndex
 * 
 * This reader can load documents from GitHub repositories
 * with proper authentication through Kage Keys.
 */
class KageKeysGithubReader {
  constructor(agentKey) {
    this.kageWrapper = new KageKeysLlamaIndexWrapper(agentKey);
  }

  /**
   * Load repository README and documentation
   */
  async loadRepoDocs(owner, repo, paths = ['README.md', 'docs/']) {
    return await this.kageWrapper.executeWithAuth(async (token) => {
      const documents = [];

      for (const path of paths) {
        try {
          const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          });

          if (response.ok) {
            const content = await response.json();
            
            if (Array.isArray(content)) {
              // Directory listing
              for (const item of content) {
                if (item.type === 'file' && item.name.endsWith('.md')) {
                  const fileContent = await this.loadFileContent(owner, repo, item.path, token);
                  documents.push({
                    text: fileContent,
                    metadata: {
                      source: `github://${owner}/${repo}/${item.path}`,
                      type: 'markdown',
                      size: item.size
                    }
                  });
                }
              }
            } else {
              // Single file
              const fileContent = await this.loadFileContent(owner, repo, path, token);
              documents.push({
                text: fileContent,
                metadata: {
                  source: `github://${owner}/${repo}/${path}`,
                  type: 'markdown',
                  size: content.size
                }
              });
            }
          }
        } catch (error) {
          console.warn(`Failed to load ${path}:`, error.message);
        }
      }

      return documents;
    });
  }

  /**
   * Load file content from GitHub
   */
  async loadFileContent(owner, repo, path, token) {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to load file: ${response.status}`);
    }

    const content = await response.json();
    return Buffer.from(content.content, 'base64').toString('utf-8');
  }
}

/**
 * Kage Keys Vector Index for LlamaIndex
 * 
 * This index can create and query vector embeddings
 * with proper authentication through Kage Keys.
 */
class KageKeysVectorIndex {
  constructor(agentKey) {
    this.kageWrapper = new KageKeysLlamaIndexWrapper(agentKey);
  }

  /**
   * Create a vector index from documents
   */
  async createIndex(documents) {
    return await this.kageWrapper.executeWithAuth(async (token) => {
      // In a real implementation, this would use LlamaIndex's VectorStoreIndex
      // with the authenticated embedding model
      
      console.log(`🔍 Creating vector index from ${documents.length} documents...`);
      
      // Mock index creation process
      const index = {
        id: 'idx_' + Math.random().toString(36).substr(2, 9),
        documentCount: documents.length,
        embeddingModel: 'text-embedding-ada-002',
        dimensions: 1536,
        created_at: new Date().toISOString()
      };

      // Simulate embedding generation
      for (const doc of documents) {
        doc.embedding = Array.from({ length: 1536 }, () => Math.random() - 0.5);
      }

      console.log('✅ Vector index created successfully');
      return index;
    });
  }

  /**
   * Query the vector index
   */
  async queryIndex(index, query, topK = 3) {
    return await this.kageWrapper.executeWithAuth(async (token) => {
      // In a real implementation, this would use LlamaIndex's query engine
      // with the authenticated LLM model
      
      console.log(`🔍 Querying index: "${query}"`);
      
      // Mock query processing
      const results = index.documents
        .slice(0, topK)
        .map((doc, i) => ({
          rank: i + 1,
          score: 0.95 - (i * 0.1),
          document: doc,
          snippet: doc.text.substring(0, 200) + '...'
        }));

      console.log(`✅ Found ${results.length} relevant documents`);
      return results;
    });
  }

  /**
   * Generate a response using the LLM
   */
  async generateResponse(query, context) {
    return await this.kageWrapper.executeWithAuth(async (token) => {
      // In a real implementation, this would use LlamaIndex's response generator
      // with the authenticated LLM model
      
      console.log('🤖 Generating response with LLM...');
      
      // Mock LLM response
      const response = `Based on the context provided, here's what I found about "${query}":\n\n` +
        context.map((result, i) => 
          `${i + 1}. **${result.document.metadata.source}**\n   ${result.snippet}\n`
        ).join('\n') +
        `\nThis information was retrieved using authenticated access through Kage Keys, ensuring secure and audited access to external APIs.`;
      
      console.log('✅ Response generated successfully');
      return response;
    });
  }
}

/**
 * Main Integration Example
 */
async function main() {
  console.log('🚀 LlamaIndex + Kage Keys Integration Example\n');

  // In a real application, you would get this from your Kage Keys broker
  const agentKey = 'your-agent-key-here';
  
  try {
    // Create LlamaIndex components with Kage Keys authentication
    const githubReader = new KageKeysGithubReader(agentKey);
    const vectorIndex = new KageKeysVectorIndex(agentKey);

    console.log('✅ LlamaIndex components created with Kage Keys authentication');
    console.log('📋 Available components:');
    console.log(`   - GitHub Reader (scope: github:repos.read)`);
    console.log(`   - Vector Index (scope: openai:embeddings.create,openai:chat.create)`);
    console.log(`   - LLM Integration (scope: openai:chat.create)\n`);

    // Example: Load documents from GitHub
    console.log('📚 Loading documents from GitHub...');
    const documents = await githubReader.loadRepoDocs('kagehq', 'keys', ['README.md']);
    console.log(`✅ Loaded ${documents.length} documents`);

    // Example: Create vector index
    console.log('\n🔍 Creating vector index...');
    const index = await vectorIndex.createIndex(documents);
    console.log('✅ Index created:', index.id);

    // Example: Query the index
    console.log('\n🔍 Querying the index...');
    const query = 'What is Kage Keys and how does it work?';
    const results = await vectorIndex.queryIndex(index, query, 2);
    console.log('📊 Query results:', results.length, 'documents found');

    // Example: Generate LLM response
    console.log('\n🤖 Generating LLM response...');
    const response = await vectorIndex.generateResponse(query, results);
    console.log('💬 LLM Response:');
    console.log(response);

    console.log('\n✅ Integration example completed successfully!');
    console.log('\n💡 Key Benefits:');
    console.log('   - RAG operations with secure API access');
    console.log('   - All external API calls are authenticated via Kage Keys');
    console.log('   - Scope validation happens automatically');
    console.log('   - Audit logging for compliance');
    console.log('   - Token expiration and rotation handled automatically');

  } catch (error) {
    console.error('❌ Error in integration example:', error.message);
    console.log('\n💡 To run this example:');
    console.log('   1. Start your Kage Keys broker: npm start');
    console.log('   2. Generate an agent key: kage-keys create-token --agent "llamaindex-demo" --scope "github:repos.read,openai:embeddings.create,openai:chat.create"');
    console.log('   3. Update the agentKey variable with your actual key');
    console.log('   4. Install LlamaIndex: npm install llamaindex');
  }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  KageKeysLlamaIndexWrapper,
  KageKeysGithubReader,
  KageKeysVectorIndex
};
