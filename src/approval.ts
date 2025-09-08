import { 
  ApprovalRequest, 
  ApprovalDecision
} from './enterprise-types';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export interface ApprovalManagerOptions {
  dataDir?: string;
  enableSlack?: boolean;
  enableEmail?: boolean;
  enableCLI?: boolean;
  enableWebhook?: boolean;
}

export class ApprovalManager {
  private dataDir: string;
  private approvalRequests: Map<string, ApprovalRequest> = new Map();
  private options: ApprovalManagerOptions;

  constructor(options: ApprovalManagerOptions = {}) {
    this.options = options;
    this.dataDir = options.dataDir || './approval-data';
    this.ensureDataDir();
    this.loadApprovalRequests();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private getApprovalRequestsPath(): string {
    return path.join(this.dataDir, 'approval-requests.json');
  }



  private loadApprovalRequests(): void {
    const filePath = this.getApprovalRequestsPath();
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        this.approvalRequests = new Map(Object.entries(data));
      } catch (error) {
        console.error('Failed to load approval requests:', error);
      }
    }
  }


  /**
   * Create a new approval request for a high-risk scope
   */
  async createApprovalRequest(
    orgId: string,
    projectId: string,
    agentId: string,
    scope: string,
    expiresIn: number,
    metadata?: Record<string, any>,
    id?: string
  ): Promise<ApprovalRequest> {
    const request: ApprovalRequest = {
      id: id || uuidv4(),
      orgId,
      projectId,
      agentId,
      scope,
      expiresIn,
      requestedAt: new Date().toISOString(),
      status: 'pending',
      approvers: [],
      metadata: {
        userAgent: metadata?.userAgent,
        ipAddress: metadata?.ipAddress,
        context: metadata?.context
      }
    };

    this.approvalRequests.set(request.id, request);
    this.saveApprovalRequests();

    // Trigger approval workflow
    await this.triggerApprovalWorkflow(request);

    return request;
  }

  /**
   * Trigger the appropriate approval workflow based on project settings
   */
  private async triggerApprovalWorkflow(request: ApprovalRequest): Promise<void> {
    // TODO: Load project and workflow from database
    // For now, use default CLI approval
    if (this.options.enableCLI) {
      await this.triggerCLIApproval(request);
    }
  }

  /**
   * Trigger CLI approval workflow
   */
  private async triggerCLIApproval(request: ApprovalRequest): Promise<void> {
    console.log('\n🔐 APPROVAL REQUIRED');
    console.log(`Agent: ${request.agentId}`);
    console.log(`Scope: ${request.scope}`);
    console.log(`Project: ${request.projectId}`);
    console.log(`Expires in: ${request.expiresIn} seconds`);
    console.log('\nApprove? (y/n): ');

    // In a real implementation, this would be interactive
    // For now, simulate approval after 5 seconds
    setTimeout(() => {
      this.approveRequest(request.id, 'cli-approver', 'Auto-approved for demo');
    }, 5000);
  }



  /**
   * Approve a request
   */
  async approveRequest(requestId: string, approverId: string, reason?: string): Promise<ApprovalRequest> {
    const request = this.approvalRequests.get(requestId);
    if (!request) {
      throw new Error('Approval request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('Request is not pending approval');
    }

    const decision: ApprovalDecision = {
      approverId,
      decision: 'approve',
      reason,
      timestamp: new Date().toISOString()
    };

    request.approvers.push(decision);
    
    // Check if this was the final approval needed
    // For now, assume single approval is sufficient
    // In a real implementation, you'd check against required approvers
    request.status = 'approved';
    
    this.approvalRequests.set(requestId, request);
    this.saveApprovalRequests();

    console.log(`✅ Request ${requestId} approved by ${approverId}`);
    return request;
  }

  /**
   * Deny a request
   */
  async denyRequest(requestId: string, approverId: string, reason?: string): Promise<ApprovalRequest> {
    const request = this.approvalRequests.get(requestId);
    if (!request) {
      throw new Error('Approval request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('Request is not pending approval');
    }

    const decision: ApprovalDecision = {
      approverId,
      decision: 'deny',
      reason,
      timestamp: new Date().toISOString()
    };

    request.approvers.push(decision);
    request.status = 'denied';
    
    this.approvalRequests.set(requestId, request);
    this.saveApprovalRequests();

    console.log(`❌ Request ${requestId} denied by ${approverId}: ${reason}`);
    return request;
  }

  /**
   * Get approval request by ID
   */
  async getApprovalRequest(requestId: string): Promise<ApprovalRequest | null> {
    return this.approvalRequests.get(requestId) || null;
  }

  /**
   * Get pending approval requests for an organization
   */
  async getPendingApprovals(orgId: string): Promise<ApprovalRequest[]> {
    return Array.from(this.approvalRequests.values())
      .filter(req => req.orgId === orgId && req.status === 'pending');
  }

  /**
   * Check if a scope requires approval
   */
  async requiresApproval(_orgId: string, _projectId: string, scope: string): Promise<boolean> {
    // TODO: Check project settings and RBAC policies
    // For now, require approval for high-risk scopes
    const highRiskScopes = [
      'slack:chat.post',
      'github:repos.write',
      'aws:sts.assume_role',
      'openai:chat.create'
    ];

    return highRiskScopes.some(riskScope => scope.includes(riskScope));
  }

  /**
   * Get approval statistics
   */
  async getApprovalStats(orgId: string, timeRange?: { start: string; end: string }): Promise<{
    total: number;
    pending: number;
    approved: number;
    denied: number;
    expired: number;
  }> {
    const requests = Array.from(this.approvalRequests.values())
      .filter(req => req.orgId === orgId);

    if (timeRange) {
      const start = new Date(timeRange.start);
      const end = new Date(timeRange.end);
      requests.filter(req => {
        const requestedAt = new Date(req.requestedAt);
        return requestedAt >= start && requestedAt <= end;
      });
    }

    return {
      total: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      approved: requests.filter(r => r.status === 'approved').length,
      denied: requests.filter(r => r.status === 'denied').length,
      expired: requests.filter(r => r.status === 'expired').length
    };
  }

  // Additional methods for compatibility with tests
  async createRequest(request: ApprovalRequest): Promise<ApprovalRequest> {
    return this.createApprovalRequest(
      request.orgId,
      request.projectId,
      request.agentId,
      request.scope,
      request.expiresIn,
      request.metadata,
      request.id
    );
  }

  async getRequest(requestId: string): Promise<ApprovalRequest | null> {
    return this.getApprovalRequest(requestId);
  }

  async getRequests(options: {
    organizationId?: string;
    projectId?: string;
    agentId?: string;
    status?: string;
    limit?: number;
  } = {}): Promise<ApprovalRequest[]> {
    let requests = Array.from(this.approvalRequests.values());

    if (options.organizationId) {
      requests = requests.filter(r => r.orgId === options.organizationId);
    }

    if (options.projectId) {
      requests = requests.filter(r => r.projectId === options.projectId);
    }

    if (options.agentId) {
      requests = requests.filter(r => r.agentId === options.agentId);
    }

    if (options.status) {
      requests = requests.filter(r => r.status === options.status);
    }

    if (options.limit) {
      requests = requests.slice(0, options.limit);
    }

    return requests.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  }

  async getPendingRequests(options: {
    organizationId?: string;
    projectId?: string;
    agentId?: string;
  } = {}): Promise<ApprovalRequest[]> {
    return this.getRequests({ ...options, status: 'pending' });
  }

  async expireRequests(): Promise<number> {
    const now = new Date();
    let expiredCount = 0;

    for (const [, request] of this.approvalRequests) {
      const expiresAt = new Date(request.requestedAt);
      expiresAt.setSeconds(expiresAt.getSeconds() + request.expiresIn);
      
      if (request.status === 'pending' && expiresAt < now) {
        request.status = 'expired';
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.saveApprovalRequests();
    }

    return expiredCount;
  }

  private saveApprovalRequests(): void {
    const filePath = this.getApprovalRequestsPath();
    const data = Object.fromEntries(this.approvalRequests);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
}
