import { withAgentKey } from '@kagehq/keys';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { HumanMessage } from 'langchain/schema';

async function chatWithAuth() {
  const agentKey = 'your-agent-key-here';
  
  try {
    const result = await withAgentKey(agentKey, async (token) => {
      const llm = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        temperature: 0.7,
      });
      
      const response = await llm.call([
        new HumanMessage("Hello! I'm an AI agent with authenticated access.")
      ]);
      
      return response;
    });
    
    console.log('Chat response:', result);
  } catch (error) {
    console.error('Authentication failed:', error);
  }
}

chatWithAuth();
