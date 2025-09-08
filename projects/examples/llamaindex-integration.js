import { withAgentKey } from '@kagehq/keys';
import { OpenAI } from 'llamaindex/llms/openai';
import { Document } from 'llamaindex/schema/Document';

async function ragWithAuth() {
  const agentKey = 'your-agent-key-here';
  
  try {
    const result = await withAgentKey(agentKey, async (token) => {
      const llm = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        temperature: 0.1,
      });
      
      const document = new Document({
        text: "This is a sample document for RAG processing.",
        metadata: { source: "example" }
      });
      
      // Process document with authenticated access
      return { document, llm: llm.constructor.name };
    });
    
    console.log('RAG result:', result);
  } catch (error) {
    console.error('Authentication failed:', error);
  }
}

ragWithAuth();
