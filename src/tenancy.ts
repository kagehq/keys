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

  constructor(options: TenancyManagerOptions = {}) {
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

  async getRBACPoliciesByOrg(orgId: string): Promise<RBACPolicy[]> {
    return Array.from(this.rbacPolicies.values())
      .filter(p => p.orgId === orgId && p.isActive);
  }




  // Utility Methods

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

  // Additional methods for test compatibility

  async getOrganizations(): Promise<Organization[]> {
    return Array.from(this.organizations.values());
  }

  async getProjects(options?: { organizationId?: string }): Promise<Project[]> {
    let projects = Array.from(this.projects.values());
    
    if (options?.organizationId) {
      projects = projects.filter(p => p.orgId === options.organizationId);
    }
    
    return projects;
  }

  async getAgents(options?: { organizationId?: string; projectId?: string; type?: AgentType }): Promise<Agent[]> {
    let agents = Array.from(this.agents.values());
    
    if (options?.organizationId) {
      agents = agents.filter(a => a.orgId === options.organizationId);
    }
    
    if (options?.projectId) {
      agents = agents.filter(a => a.projectId === options.projectId);
    }
    
    if (options?.type) {
      agents = agents.filter(a => a.type === options.type);
    }
    
    return agents;
  }

  async getRBACPolicy(policyId: string): Promise<RBACPolicy | null> {
    return this.rbacPolicies.get(policyId) || null;
  }

  async getRBACPolicies(): Promise<RBACPolicy[]> {
    return Array.from(this.rbacPolicies.values());
  }

  async getTenancyStats(options?: { organizationId?: string } | string): Promise<{
    totalOrganizations: number;
    totalProjects: number;
    totalAgents: number;
    totalRBACPolicies: number;
    projects: number;
    agents: number;
    activeAgents: number;
    suspendedAgents: number;
  }> {
    const orgId = typeof options === 'string' ? options : options?.organizationId;
    
    let projects = Array.from(this.projects.values());
    let agents = Array.from(this.agents.values());
    
    if (orgId) {
      projects = projects.filter(p => p.orgId === orgId);
      agents = agents.filter(a => a.orgId === orgId);
    }
    
    const activeAgents = agents.filter(a => a.status === 'active').length;
    const suspendedAgents = agents.filter(a => a.status === 'suspended').length;
    
    return {
      totalOrganizations: orgId ? 1 : this.organizations.size,
      totalProjects: projects.length,
      totalAgents: agents.length,
      totalRBACPolicies: this.rbacPolicies.size,
      projects: projects.length,
      agents: agents.length,
      activeAgents,
      suspendedAgents
    };
  }

  // Overloaded createOrganization method for test compatibility
  async createOrganization(organization: Organization): Promise<Organization>;
  async createOrganization(name: string, slug: string): Promise<Organization>;
  async createOrganization(nameOrOrg: string | Organization, slug?: string): Promise<Organization> {
    if (typeof nameOrOrg === 'string') {
      // Original signature
      return this.createOrganizationOriginal(nameOrOrg, slug!);
    } else {
      // New signature for test compatibility
      const org = nameOrOrg;
      const newOrg: Organization = {
        id: org.id || uuidv4(),
        name: org.name,
        slug: org.slug || org.name.toLowerCase().replace(/\s+/g, '-'),
        description: org.description,
        settings: {
          requireApproval: org.settings?.requireApproval ?? false,
          approvalChannels: org.settings?.approvalChannels ?? [],
          defaultTokenExpiry: org.settings?.defaultTokenExpiry ?? 3600,
          maxAgentsPerProject: org.settings?.maxAgentsPerProject ?? 10,
          maxAgents: org.settings?.maxAgents
        },
        createdAt: org.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      this.organizations.set(newOrg.id, newOrg);
      this.saveOrganizations();
      console.log(`🏢 Created organization: ${newOrg.name}`);
      return newOrg;
    }
  }

  private async createOrganizationOriginal(name: string, slug: string): Promise<Organization> {
    const org: Organization = {
      id: uuidv4(),
      name,
      slug,
      description: '',
      settings: {
        requireApproval: false,
        approvalChannels: [],
        defaultTokenExpiry: 3600,
        maxAgentsPerProject: 10
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.organizations.set(org.id, org);
    this.saveOrganizations();
    console.log(`🏢 Created organization: ${org.name}`);
    return org;
  }

  // Overloaded createProject method for test compatibility
  async createProject(project: Project): Promise<Project>;
  async createProject(orgId: string, name: string, description?: string): Promise<Project>;
  async createProject(orgIdOrProject: string | Project, name?: string, description?: string): Promise<Project> {
    if (typeof orgIdOrProject === 'string') {
      // Original signature
      return this.createProjectOriginal(orgIdOrProject, name!, description);
    } else {
      // New signature for test compatibility
      const project = orgIdOrProject;
      const newProject: Project = {
        id: project.id || uuidv4(),
        orgId: project.orgId,
        name: project.name,
        slug: project.slug || project.name.toLowerCase().replace(/\s+/g, '-'),
        description: project.description,
        settings: {
          allowedScopes: project.settings?.allowedScopes ?? [],
          blockedScopes: project.settings?.blockedScopes ?? [],
          requireApproval: project.settings?.requireApproval ?? false,
          approvalWorkflow: project.settings?.approvalWorkflow ?? {
            id: uuidv4(),
            name: 'Default Workflow',
            type: 'single',
            config: {},
            approvers: [],
            autoApproveScopes: [],
            requireAllApprovers: false
          },
          maxAgents: project.settings?.maxAgents
        },
        createdAt: project.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      this.projects.set(newProject.id, newProject);
      this.saveProjects();
      console.log(`📁 Created project: ${newProject.name}`);
      return newProject;
    }
  }

  private async createProjectOriginal(orgId: string, name: string, description?: string): Promise<Project> {
    const project: Project = {
      id: uuidv4(),
      orgId,
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      description: description || '',
      settings: {
        allowedScopes: [],
        blockedScopes: [],
        requireApproval: false,
        approvalWorkflow: {
          id: uuidv4(),
          name: 'Default Workflow',
          type: 'single',
          config: {},
          approvers: [],
          autoApproveScopes: [],
          requireAllApprovers: false
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.projects.set(project.id, project);
    this.saveProjects();
    console.log(`📁 Created project: ${project.name}`);
    return project;
  }

  // Overloaded createAgent method for test compatibility
  async createAgent(agent: Agent): Promise<Agent>;
  async createAgent(orgId: string, projectId: string, name: string, type: AgentType, description?: string): Promise<Agent>;
  async createAgent(orgIdOrAgent: string | Agent, projectId?: string, name?: string, type?: AgentType, description?: string): Promise<Agent> {
    if (typeof orgIdOrAgent === 'string') {
      // Original signature
      return this.createAgentOriginal(orgIdOrAgent, projectId!, name!, type!, description);
    } else {
      // New signature for test compatibility
      const agent = orgIdOrAgent;
      const newAgent: Agent = {
        id: agent.id || uuidv4(),
        orgId: agent.orgId,
        projectId: agent.projectId,
        name: agent.name,
        type: agent.type,
        description: agent.description,
        status: agent.status || 'active',
        scopeBundles: agent.scopeBundles || [],
        metadata: agent.metadata || {},
        createdAt: agent.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      this.agents.set(newAgent.id, newAgent);
      this.saveAgents();
      console.log(`🤖 Created agent: ${newAgent.name}`);
      return newAgent;
    }
  }

  private async createAgentOriginal(orgId: string, projectId: string, name: string, type: AgentType, description?: string): Promise<Agent> {
    const agent: Agent = {
      id: uuidv4(),
      orgId,
      projectId,
      name,
      type,
      description: description || '',
      status: 'active',
      scopeBundles: [],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.agents.set(agent.id, agent);
    this.saveAgents();
    console.log(`🤖 Created agent: ${agent.name}`);
    return agent;
  }

  // Overloaded createRBACPolicy method for test compatibility
  async createRBACPolicy(policy: RBACPolicy): Promise<RBACPolicy>;
  async createRBACPolicy(orgId: string, name: string, description: string, rules: RBACRule[]): Promise<RBACPolicy>;
  async createRBACPolicy(orgIdOrPolicy: string | RBACPolicy, name?: string, description?: string, rules?: RBACRule[]): Promise<RBACPolicy> {
    if (typeof orgIdOrPolicy === 'string') {
      // Original signature
      return this.createRBACPolicyOriginal(orgIdOrPolicy, name!, description!, rules!);
    } else {
      // New signature for test compatibility
      const policy = orgIdOrPolicy;
      const newPolicy: RBACPolicy = {
        id: policy.id || uuidv4(),
        orgId: policy.orgId,
        name: policy.name,
        description: policy.description,
        rules: policy.rules,
        createdAt: policy.createdAt || new Date().toISOString(),
        isActive: policy.isActive !== undefined ? policy.isActive : true
      };
      
      this.rbacPolicies.set(newPolicy.id, newPolicy);
      this.saveRBACPolicies();
      console.log(`🔐 Created RBAC policy: ${newPolicy.name}`);
      return newPolicy;
    }
  }

  private async createRBACPolicyOriginal(orgId: string, name: string, description: string, rules: RBACRule[]): Promise<RBACPolicy> {
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
    console.log(`🔐 Created RBAC policy: ${policy.name}`);
    return policy;
  }

  // Overloaded checkPermission method for test compatibility
  async checkPermission(userId: string, resource: string, action: string, orgId?: string): Promise<boolean>;
  async checkPermission(_userId: string, resource: string, action: string, orgId: string): Promise<boolean> {
    // Find policies for the organization
    const policies = Array.from(this.rbacPolicies.values())
      .filter(policy => policy.isActive && policy.orgId === orgId);
    
    // Check each policy
    for (const policy of policies) {
      for (const rule of policy.rules) {
        // Check if rule applies to this resource and action
        const resourceMatches = rule.resources.some(r => r === '*' || r === resource);
        const actionMatches = rule.actions.some(a => a === '*' || a === action);
        
        if (resourceMatches && actionMatches) {
          return rule.effect === 'allow';
        }
      }
    }
    
    // Default deny
    return false;
  }
}
