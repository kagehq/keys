// Enterprise Types for Phase 3: Production Permissions Layer

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  settings: {
    requireApproval: boolean;
    approvalChannels: ApprovalChannel[];
    defaultTokenExpiry: number; // seconds
    maxAgentsPerProject: number;
  };
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  settings: {
    allowedScopes: string[];
    blockedScopes: string[];
    requireApproval: boolean;
    approvalWorkflow: ApprovalWorkflow;
  };
}

export interface Agent {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  type: AgentType;
  status: 'active' | 'suspended' | 'deleted';
  createdAt: string;
  lastSeen?: string;
  metadata: Record<string, any>;
  scopeBundles: string[]; // Pre-configured scope bundles
}

export type AgentType = 
  | 'ai-assistant'
  | 'code-reviewer' 
  | 'team-collaborator'
  | 'knowledge-manager'
  | 'cloud-operator'
  | 'custom';

export interface ApprovalWorkflow {
  id: string;
  name: string;
  type: 'slack' | 'email' | 'cli' | 'webhook';
  config: SlackConfig | EmailConfig | CLIConfig | WebhookConfig;
  approvers: string[]; // User IDs or email addresses
  autoApproveScopes: string[]; // Scopes that don't need approval
  requireAllApprovers: boolean;
}

export interface SlackConfig {
  channel: string;
  webhookUrl?: string;
  botToken?: string;
  mentionUsers: string[];
}

export interface EmailConfig {
  from: string;
  to: string[];
  cc?: string[];
  subjectTemplate: string;
  bodyTemplate: string;
}

export interface CLIConfig {
  promptMessage: string;
  timeout: number; // seconds
  defaultAction: 'approve' | 'deny';
}

export interface WebhookConfig {
  url: string;
  method: 'POST' | 'PUT';
  headers: Record<string, string>;
  payloadTemplate: string;
}

export interface ApprovalRequest {
  id: string;
  orgId: string;
  projectId: string;
  agentId: string;
  scope: string;
  expiresIn: number;
  requestedAt: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  approvers: ApprovalDecision[];
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    context?: string;
  };
}

export interface ApprovalDecision {
  approverId: string;
  decision: 'approve' | 'deny';
  reason?: string;
  timestamp: string;
}

export interface ApprovalChannel {
  id: string;
  type: 'slack' | 'email' | 'cli' | 'webhook';
  config: SlackConfig | EmailConfig | CLIConfig | WebhookConfig;
  isActive: boolean;
}

export interface RevocationEntry {
  jti: string;
  sessionId?: string;
  reason: 'manual' | 'expired' | 'compromised' | 'policy';
  revokedBy: string;
  revokedAt: string;
  metadata?: Record<string, any>;
}

export interface RBACPolicy {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  rules: RBACRule[];
  createdAt: string;
  isActive: boolean;
}

export interface RBACRule {
  id: string;
  effect: 'allow' | 'deny';
  resources: string[]; // Scopes or scope patterns
  actions: string[]; // create, read, update, delete, approve
  conditions?: {
    timeRestrictions?: {
      startTime?: string; // HH:MM
      endTime?: string;   // HH:MM
      daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
    };
    ipRestrictions?: string[]; // IP addresses or CIDR blocks
    userAgentRestrictions?: string[]; // User agent patterns
  };
}

export interface DashboardMetrics {
  timeRange: {
    start: string;
    end: string;
  };
  scopesIssued: TimeSeriesPoint[];
  blockAllowRatio: TimeSeriesPoint[];
  topAgents: TopAgent[];
  topProviders: TopProvider[];
  slowEndpoints: SlowEndpoint[];
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
}

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  metadata?: Record<string, any>;
}

export interface TopAgent {
  agentId: string;
  agentName: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  averageResponseTime: number;
  totalResponseTime: number;
}

export interface TopProvider {
  provider: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  averageResponseTime: number;
  totalResponseTime: number;
  totalLatency: number;
}

export interface SlowEndpoint {
  route: string;
  method: string;
  averageResponseTime: number;
  requestCount: number;
  responseTimes: number[];
  p95ResponseTime: number;
  p99ResponseTime: number;
}

export interface LiveRequest {
  id: string;
  timestamp: string;
  agentId: string;
  scope: string;
  method: string;
  url: string;
  status: 'pending' | 'completed' | 'failed';
  duration?: number;
  headers: Record<string, string>;
  body?: string;
  response?: {
    statusCode: number;
    headers: Record<string, string>;
    body?: string;
  };
  metadata: {
    ipAddress: string;
    userAgent: string;
    jti: string;
    sessionId?: string;
  };
}
