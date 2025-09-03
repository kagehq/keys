import { 
  Organization, 
  Project, 
  Agent, 
  RBACPolicy, 
  RBACRule,
  AgentType
} from './enterprise-types';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export interface TenancyManagerOptions {
  dataDir?: string;
  enableRBAC?: boolean;
  defaultOrgSettings?: Partial<Organization['settings']>;
}

export class TenancyManager {
  private dataDir: string;
  private organizations: Map<string, Organization> = new Map();
  private projects: Map<string, Project> = new Map();
  private agents: Map<string, Agent> = new Map();
  private rbacPolicies: Map<string, RBACPolicy> = new Map();
  private options: TenancyManagerOptions;

  constructor(options: TenancyManagerOptions = {}) {
    this.options = options;
    this.dataDir = options.dataDir || './tenancy-data';
    this.ensureDataDir();
    this.loadData();
    this.initializeDefaultData();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private getOrganizationsPath(): string {
    return path.join(this.dataDir, 'organizations.json');
  }

  private getProjectsPath(): string {
    return path.join(this.dataDir, 'projects.json');
  }

  private getAgentsPath(): string {
    return path.join(this.dataDir, 'agents.json');
  }

  private getRBACPoliciesPath(): string {
    return path.join(this.dataDir, 'rbac-policies.json');
  }

  private loadData(): void {
    this.loadOrganizations();
    this.loadProjects();
    this.loadAgents();
    this.loadRBACPolicies();
  }

  private loadOrganizations(): void {
    const filePath = this.getOrganizationsPath();
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        this.organizations = new Map(Object.entries(data));
      } catch (error) {
        console.error('Failed to load organizations:', error);
      }
    }
  }

  private saveOrganizations(): void {
    const filePath = this.getOrganizationsPath();
    const data = Object.fromEntries(this.organizations);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  private loadProjects(): void {
    const filePath = this.getProjectsPath();
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        this.projects = new Map(Object.entries(data));
      } catch (error) {
        console.error('Failed to load projects:', error);
      }
    }
  }

  private saveProjects(): void {
    const filePath = this.getProjectsPath();
    const data = Object.fromEntries(this.projects);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  private loadAgents(): void {
    const filePath = this.getAgentsPath();
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        this.agents = new Map(Object.entries(data));
      } catch (error) {
        console.error('Failed to load agents:', error);
      }
    }
  }

  private saveAgents(): void {
    const filePath = this.getAgentsPath();
    const data = Object.fromEntries(this.agents);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  private loadRBACPolicies(): void {
    const filePath = this.getRBACPoliciesPath();
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        this.rbacPolicies = new Map(Object.entries(data));
      } catch (error) {
        console.error('Failed to load RBAC policies:', error);
      }
    }
  }

  private saveRBACPolicies(): void {
    const filePath = this.getRBACPoliciesPath();
    const data = Object.fromEntries(this.rbacPolicies);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  private initializeDefaultData(): void {
    // Create demo organization if none exists
    if (this.organizations.size === 0) {
      this.createOrganization('Demo Corp', 'demo-corp');
    }
  }

  // Organization Management
  async createOrganization(name: string, slug: string): Promise<Organization> {
    const org: Organization = {
      id: uuidv4(),
      name,
      slug,
      createdAt: new Date().toISOString(),
      settings: {
        requireApproval: true,
        approvalChannels: [],
        defaultTokenExpiry: 3600,
        maxAgentsPerProject: 100,
        ...this.options.defaultOrgSettings
      }
    };

    this.organizations.set(org.id, org);
    this.saveOrganizations();

    console.log(`🏢 Created organization: ${name} (${slug})`);
    return org;
  }

  async getOrganization(orgId: string): Promise<Organization | null> {
    return this.organizations.get(orgId) || null;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    return Array.from(this.organizations.values()).find(org => org.slug === slug) || null;
  }

  async updateOrganization(orgId: string, updates: Partial<Organization>): Promise<Organization> {
    const org = this.organizations.get(orgId);
    if (!org) {
      throw new Error('Organization not found');
    }

    const updatedOrg = { ...org, ...updates };
    this.organizations.set(orgId, updatedOrg);
    this.saveOrganizations();

    return updatedOrg;
  }

  // Project Management
  async createProject(
    orgId: string,
    name: string,
    slug: string,
    description?: string
  ): Promise<Project> {
    const org = this.organizations.get(orgId);
    if (!org) {
      throw new Error('Organization not found');
    }

    const project: Project = {
      id: uuidv4(),
      orgId,
      name,
      slug,
      description,
      createdAt: new Date().toISOString(),
      settings: {
        allowedScopes: [],
        blockedScopes: [],
        requireApproval: org.settings.requireApproval,
        approvalWorkflow: {
          id: uuidv4(),
          name: 'Default CLI Approval',
          type: 'cli',
          config: {
            promptMessage: 'Approve this request? (y/n)',
            timeout: 300,
            defaultAction: 'deny'
          },
          approvers: [],
          autoApproveScopes: [],
          requireAllApprovers: false
        }
      }
    };

    this.projects.set(project.id, project);
    this.saveProjects();

    console.log(`📁 Created project: ${name} in ${org.name}`);
    return project;
  }

  async getProject(projectId: string): Promise<Project | null> {
    return this.projects.get(projectId) || null;
  }

  async getProjectsByOrg(orgId: string): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(p => p.orgId === orgId);
  }

  async updateProject(projectId: string, updates: Partial<Project>): Promise<Project> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const updatedProject = { ...project, ...updates };
    this.projects.set(projectId, updatedProject);
    this.saveProjects();

    return updatedProject;
  }

  // Agent Management
  async createAgent(
    projectId: string,
    name: string,
    type: AgentType,
    description?: string,
    scopeBundles: string[] = []
  ): Promise<Agent> {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const agent: Agent = {
      id: uuidv4(),
      projectId,
      name,
      description,
      type,
      status: 'active',
      createdAt: new Date().toISOString(),
      metadata: {},
      scopeBundles
    };

    this.agents.set(agent.id, agent);
    this.saveAgents();

    console.log(`🤖 Created agent: ${name} (${type}) in project ${project.name}`);
    return agent;
  }

  async getAgent(agentId: string): Promise<Agent | null> {
    return this.agents.get(agentId) || null;
  }

  async getAgentsByProject(projectId: string): Promise<Agent[]> {
    return Array.from(this.agents.values()).filter(a => a.projectId === projectId);
  }

  async updateAgent(agentId: string, updates: Partial<Agent>): Promise<Agent> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    const updatedAgent = { ...agent, ...updates };
    this.agents.set(agentId, updatedAgent);
    this.saveAgents();

    return updatedAgent;
  }

  async suspendAgent(agentId: string): Promise<void> {
    await this.updateAgent(agentId, { status: 'suspended' });
    console.log(`⏸️  Suspended agent: ${agentId}`);
  }

  async activateAgent(agentId: string): Promise<void> {
    await this.updateAgent(agentId, { status: 'active' });
    console.log(`▶️  Activated agent: ${agentId}`);
  }

  // RBAC Management
  async createRBACPolicy(
    orgId: string,
    name: string,
    description: string,
    rules: RBACRule[]
  ): Promise<RBACPolicy> {
    const policy: RBACPolicy = {
      id: uuidv4(),
      orgId,
      name,
      description,
      rules,
      createdAt: new Date().toISOString(),
      isActive: true
    };

    this.rbacPolicies.set(policy.id, policy);
    this.saveRBACPolicies();

    console.log(`🔐 Created RBAC policy: ${name}`);
    return policy;
  }

  async getRBACPoliciesByOrg(orgId: string): Promise<RBACPolicy[]> {
    return Array.from(this.rbacPolicies.values())
      .filter(p => p.orgId === orgId && p.isActive);
  }

  async checkPermission(
    orgId: string,
    _userId: string,
    action: string,
    resource: string
  ): Promise<boolean> {
    if (!this.options.enableRBAC) {
      return true; // RBAC disabled
    }

    const policies = await this.getRBACPoliciesByOrg(orgId);
    
    for (const policy of policies) {
      for (const rule of policy.rules) {
        if (this.matchesRule(rule, action, resource)) {
          return rule.effect === 'allow';
        }
      }
    }

    return false; // Default deny
  }

  private matchesRule(rule: RBACRule, action: string, resource: string): boolean {
    // Check if action matches
    if (!rule.actions.includes(action) && !rule.actions.includes('*')) {
      return false;
    }

    // Check if resource matches
    const resourceMatches = rule.resources.some(pattern => {
      if (pattern === '*') return true;
      if (pattern === resource) return true;
      
      // Simple wildcard matching
      const patternParts = pattern.split(':');
      const resourceParts = resource.split(':');
      
      if (patternParts.length !== resourceParts.length) return false;
      
      for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i] !== '*' && patternParts[i] !== resourceParts[i]) {
          return false;
        }
      }
      
      return true;
    });

    if (!resourceMatches) return false;

    // Check conditions
    if (rule.conditions) {
      return this.checkConditions(rule.conditions);
    }

    return true;
  }

  private checkConditions(conditions: RBACRule['conditions']): boolean {
    if (conditions?.timeRestrictions) {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const currentDay = now.getDay();

      if (conditions.timeRestrictions.startTime) {
        const [startHour, startMin] = conditions.timeRestrictions.startTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        if (currentTime < startMinutes) return false;
      }

      if (conditions.timeRestrictions.endTime) {
        const [endHour, endMin] = conditions.timeRestrictions.endTime.split(':').map(Number);
        const endMinutes = endHour * 60 + endMin;
        if (currentTime > endMinutes) return false;
      }

      if (conditions.timeRestrictions.daysOfWeek) {
        if (!conditions.timeRestrictions.daysOfWeek.includes(currentDay)) return false;
      }
    }

    return true;
  }

  // Utility Methods
  async getTenancyStats(orgId: string): Promise<{
    projects: number;
    agents: number;
    activeAgents: number;
    suspendedAgents: number;
  }> {
    const orgProjects = await this.getProjectsByOrg(orgId);
    const orgAgents = orgProjects.flatMap(p => 
      Array.from(this.agents.values()).filter(a => a.projectId === p.id)
    );

    return {
      projects: orgProjects.length,
      agents: orgAgents.length,
      activeAgents: orgAgents.filter(a => a.status === 'active').length,
      suspendedAgents: orgAgents.filter(a => a.status === 'suspended').length
    };
  }

  async getAgentScopeBundles(agentId: string): Promise<string[]> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    return agent.scopeBundles;
  }

  async assignScopeBundle(agentId: string, bundleName: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    if (!agent.scopeBundles.includes(bundleName)) {
      agent.scopeBundles.push(bundleName);
      this.saveAgents();
      console.log(`📦 Assigned scope bundle '${bundleName}' to agent ${agent.name}`);
    }
  }

  async removeScopeBundle(agentId: string, bundleName: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    const index = agent.scopeBundles.indexOf(bundleName);
    if (index > -1) {
      agent.scopeBundles.splice(index, 1);
      this.saveAgents();
      console.log(`📦 Removed scope bundle '${bundleName}' from agent ${agent.name}`);
    }
  }
}
