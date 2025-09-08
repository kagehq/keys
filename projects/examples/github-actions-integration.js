import { withAgentKey } from '@kagehq/keys';
import { Octokit } from '@octokit/rest';

async function githubOpsWithAuth() {
  const agentKey = process.env.KAGE_AGENT_KEY;
  
  try {
    const result = await withAgentKey(agentKey, async (token) => {
      const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
      });
      
      // List repositories with authenticated access
      const { data: repos } = await octokit.repos.listForAuthenticatedUser({
        per_page: 10,
      });
      
      return repos.map(repo => ({
        name: repo.name,
        description: repo.description,
        url: repo.html_url
      }));
    });
    
    console.log('Repositories:', result);
  } catch (error) {
    console.error('Authentication failed:', error);
  }
}

githubOpsWithAuth();
