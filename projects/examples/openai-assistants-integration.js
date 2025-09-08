import { withAgentKey } from '@kagehq/keys';
import OpenAI from 'openai';

async function assistantWithAuth() {
  const agentKey = 'your-agent-key-here';
  
  try {
    const result = await withAgentKey(agentKey, async (token) => {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      const assistant = await openai.beta.assistants.create({
        name: "Kage Keys Assistant",
        instructions: "I'm an AI assistant with authenticated access to tools.",
        model: "gpt-4-turbo-preview",
        tools: [{ type: "code_interpreter" }],
      });
      
      return { assistantId: assistant.id, name: assistant.name };
    });
    
    console.log('Assistant created:', result);
  } catch (error) {
    console.error('Authentication failed:', error);
  }
}

assistantWithAuth();
