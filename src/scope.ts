import { ProviderConfig } from './types';

export interface ScopeBundle {
  name: string;
  description: string;
  scopes: string[];
}

export interface ScopePattern {
  service: string;
  resource: string;
  action: string;
  isWildcard: boolean;
}

export class ScopeParser {
  /**
   * Parse a scope string into its components
   * Format: service:resource.action
   * Examples: openai:chat.create, github:repos.*, aws:s3.read
   */
  static parse(scope: string): ScopePattern {
    const [service, resourceAction] = scope.split(':');
    if (!resourceAction) {
      throw new Error(`Invalid scope format: ${scope}. Expected format: service:resource.action`);
    }

    const lastDotIndex = resourceAction.lastIndexOf('.');
    if (lastDotIndex === -1) {
      throw new Error(`Invalid scope format: ${scope}. Expected format: service:resource.action`);
    }

    const resource = resourceAction.substring(0, lastDotIndex);
    const action = resourceAction.substring(lastDotIndex + 1);

    return {
      service,
      resource,
      action,
      isWildcard: action === '*' || resource === '*'
    };
  }

  /**
   * Check if a token scope matches a route scope
   * Supports wildcards: openai:chat.* matches openai:chat.create
   */
  static matches(tokenScope: string, routeScope: string): boolean {
    try {
      const token = this.parse(tokenScope);
      const route = this.parse(routeScope);

      // Service must match exactly
      if (token.service !== route.service) return false;

      // Resource matching with wildcard support
      if (route.resource !== '*' && token.resource !== '*' && route.resource !== token.resource) {
        return false;
      }

      // Action matching with wildcard support
      if (route.action !== '*' && token.action !== '*' && route.action !== token.action) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate scope format
   */
  static validate(scope: string): boolean {
    try {
      this.parse(scope);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Expand wildcard scopes into specific scopes
   */
  static expandWildcards(scope: string, availableScopes: string[]): string[] {
    try {
      const pattern = this.parse(scope);
      if (!pattern.isWildcard) {
        return [scope];
      }

      return availableScopes.filter(available => this.matches(available, scope));
    } catch {
      return [];
    }
  }
}

export class ScopeCatalog {
  private static readonly CATALOGS: Map<string, ProviderConfig> = new Map();

  static initialize(): void {
    this.loadOpenAICatalog();
    this.loadGitHubCatalog();
    this.loadSlackCatalog();
    this.loadNotionCatalog();
    this.loadAWSCatalog();
  }

  static getCatalog(service: string): ProviderConfig | undefined {
    return this.CATALOGS.get(service.toLowerCase());
  }

  static getAllCatalogs(): ProviderConfig[] {
    return Array.from(this.CATALOGS.values());
  }

  static addCatalog(provider: ProviderConfig): void {
    this.CATALOGS.set(provider.name.toLowerCase(), provider);
  }

  private static loadOpenAICatalog(): void {
    const openaiConfig: ProviderConfig = {
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com',
      apiKey: process.env.OPENAI_API_KEY || '',
      routes: [
        {
          scope: 'openai:chat.create',
          method: 'POST',
          url: 'https://api.openai.com/v1/chat/completions',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
            'Content-Type': 'application/json'
          },
          rateLimit: { requests: 100, window: 60 }
        },
        {
          scope: 'openai:chat.create_stream',
          method: 'POST',
          url: 'https://api.openai.com/v1/chat/completions',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
            'Content-Type': 'application/json'
          },
          rateLimit: { requests: 100, window: 60 }
        },
        {
          scope: 'openai:models.list',
          method: 'GET',
          url: 'https://api.openai.com/v1/models',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`
          },
          rateLimit: { requests: 50, window: 60 }
        },
        {
          scope: 'openai:embeddings.create',
          method: 'POST',
          url: 'https://api.openai.com/v1/embeddings',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
            'Content-Type': 'application/json'
          },
          rateLimit: { requests: 200, window: 60 }
        },
        {
          scope: 'openai:files.list',
          method: 'GET',
          url: 'https://api.openai.com/v1/files',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`
          },
          rateLimit: { requests: 50, window: 60 }
        }
      ]
    };

    this.CATALOGS.set('openai', openaiConfig);
  }

  private static loadGitHubCatalog(): void {
    const githubConfig: ProviderConfig = {
      name: 'GitHub',
      baseUrl: 'https://api.github.com',
      apiKey: process.env.GITHUB_TOKEN || '',
      routes: [
        {
          scope: 'github:repos.read',
          method: 'GET',
          url: 'https://api.github.com/repos/{owner}/{repo}',
          headers: {
            'Authorization': `token ${process.env.GITHUB_TOKEN || ''}`,
            'Accept': 'application/vnd.github.v3+json'
          },
          rateLimit: { requests: 5000, window: 3600 }
        },
        {
          scope: 'github:repos.list',
          method: 'GET',
          url: 'https://api.github.com/user/repos',
          headers: {
            'Authorization': `token ${process.env.GITHUB_TOKEN || ''}`,
            'Accept': 'application/vnd.github.v3+json'
          },
          rateLimit: { requests: 5000, window: 3600 }
        },
        {
          scope: 'github:issues.read',
          method: 'GET',
          url: 'https://api.github.com/repos/{owner}/{repo}/issues',
          headers: {
            'Authorization': `token ${process.env.GITHUB_TOKEN || ''}`,
            'Accept': 'application/vnd.github.v3+json'
          },
          rateLimit: { requests: 5000, window: 3600 }
        },
        {
          scope: 'github:issues.create',
          method: 'POST',
          url: 'https://api.github.com/repos/{owner}/{repo}/issues',
          headers: {
            'Authorization': `token ${process.env.GITHUB_TOKEN || ''}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          rateLimit: { requests: 1000, window: 3600 }
        }
      ]
    };

    this.CATALOGS.set('github', githubConfig);
  }

  private static loadSlackCatalog(): void {
    const slackConfig: ProviderConfig = {
      name: 'Slack',
      baseUrl: 'https://slack.com/api',
      apiKey: process.env.SLACK_BOT_TOKEN || '',
      routes: [
        {
          scope: 'slack:chat.post',
          method: 'POST',
          url: 'https://slack.com/api/chat.postMessage',
          headers: {
            'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN || ''}`,
            'Content-Type': 'application/json'
          },
          rateLimit: { requests: 50, window: 60 }
        },
        {
          scope: 'slack:channels.list',
          method: 'GET',
          url: 'https://slack.com/api/conversations.list',
          headers: {
            'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN || ''}`
          },
          rateLimit: { requests: 100, window: 60 }
        },
        {
          scope: 'slack:users.list',
          method: 'GET',
          url: 'https://slack.com/api/users.list',
          headers: {
            'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN || ''}`
          },
          rateLimit: { requests: 100, window: 60 }
        }
      ]
    };

    this.CATALOGS.set('slack', slackConfig);
  }

  private static loadNotionCatalog(): void {
    const notionConfig: ProviderConfig = {
      name: 'Notion',
      baseUrl: 'https://api.notion.com',
      apiKey: process.env.NOTION_API_KEY || '',
      routes: [
        {
          scope: 'notion:pages.read',
          method: 'GET',
          url: 'https://api.notion.com/v1/pages/{page_id}',
          headers: {
            'Authorization': `Bearer ${process.env.NOTION_API_KEY || ''}`,
            'Notion-Version': '2022-06-28'
          },
          rateLimit: { requests: 100, window: 60 }
        },
        {
          scope: 'notion:databases.read',
          method: 'GET',
          url: 'https://api.notion.com/v1/databases/{database_id}',
          headers: {
            'Authorization': `Bearer ${process.env.NOTION_API_KEY || ''}`,
            'Notion-Version': '2022-06-28'
          },
          rateLimit: { requests: 100, window: 60 }
        },
        {
          scope: 'notion:databases.query',
          method: 'POST',
          url: 'https://api.notion.com/v1/databases/{database_id}/query',
          headers: {
            'Authorization': `Bearer ${process.env.NOTION_API_KEY || ''}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          rateLimit: { requests: 100, window: 60 }
        }
      ]
    };

    this.CATALOGS.set('notion', notionConfig);
  }

  private static loadAWSCatalog(): void {
    const awsConfig: ProviderConfig = {
      name: 'AWS',
      baseUrl: 'https://sts.amazonaws.com',
      apiKey: process.env.AWS_ACCESS_KEY_ID || '',
      routes: [
        {
          scope: 'aws:sts.assume_role',
          method: 'POST',
          url: 'https://sts.amazonaws.com/',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          rateLimit: { requests: 100, window: 60 }
        },
        {
          scope: 'aws:s3.list_buckets',
          method: 'GET',
          url: 'https://s3.amazonaws.com/',
          headers: {
            'Authorization': `AWS4-HMAC-SHA256 Credential=${process.env.AWS_ACCESS_KEY_ID || ''}`
          },
          rateLimit: { requests: 100, window: 60 }
        }
      ]
    };

    this.CATALOGS.set('aws', awsConfig);
  }
}

// Predefined scope bundles for common use cases
export const SCOPE_BUNDLES: ScopeBundle[] = [
  {
    name: 'ai_assistant',
    description: 'Basic AI assistant capabilities',
    scopes: [
      'openai:chat.create',
      'openai:chat.create_stream',
      'openai:embeddings.create'
    ]
  },
  {
    name: 'code_reviewer',
    description: 'GitHub code review and repository access',
    scopes: [
      'github:repos.read',
      'github:issues.read',
      'github:issues.create'
    ]
  },
  {
    name: 'team_collaborator',
    description: 'Slack team communication',
    scopes: [
      'slack:chat.post',
      'slack:channels.list',
      'slack:users.list'
    ]
  },
  {
    name: 'knowledge_manager',
    description: 'Notion knowledge base access',
    scopes: [
      'notion:pages.read',
      'notion:databases.read',
      'notion:databases.query'
    ]
  },
  {
    name: 'cloud_operator',
    description: 'AWS cloud operations',
    scopes: [
      'aws:sts.assume_role',
      'aws:s3.list_buckets'
    ]
  }
];
