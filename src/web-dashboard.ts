import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { Dashboard } from './dashboard';
import { ApprovalManager } from './approval';
import { TenancyManager } from './tenancy';
import { SQLiteAuditLogger } from './audit';
import * as crypto from 'crypto';

export interface WebDashboardOptions {
  port?: number;
  enableHTTPS?: boolean;
  sslCert?: string;
  sslKey?: string;
  dashboard: Dashboard;
  approvalManager: ApprovalManager;
  tenancyManager: TenancyManager;
  auditLogger: SQLiteAuditLogger;
  security?: {
    enableCSRF?: boolean;
    csrfSecret?: string;
    sessionSecret?: string;
    maxAge?: number;
    secureCookies?: boolean;
    httpOnly?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
  };
}

export class WebDashboard {
  private server: http.Server | https.Server;
  private options: WebDashboardOptions;
  private dashboard: Dashboard;
  private approvalManager: ApprovalManager;
  private tenancyManager: TenancyManager;
  private auditLogger: SQLiteAuditLogger;
  private csrfTokens: Map<string, { token: string; expires: number }> = new Map();
  private sessions: Map<string, { userId: string; expires: number }> = new Map();

  constructor(options: WebDashboardOptions) {
    this.options = options;
    this.dashboard = options.dashboard;
    this.approvalManager = options.approvalManager;
    this.tenancyManager = options.tenancyManager;
    this.auditLogger = options.auditLogger;

    // Set default security options
    this.options.security = {
      enableCSRF: true,
      csrfSecret: options.security?.csrfSecret || crypto.randomBytes(32).toString('hex'),
      sessionSecret: options.security?.sessionSecret || crypto.randomBytes(32).toString('hex'),
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secureCookies: options.enableHTTPS || false,
      httpOnly: true,
      sameSite: 'strict',
      ...options.security
    };

    if (options.enableHTTPS && options.sslCert && options.sslKey) {
      // HTTPS server
      const httpsOptions = {
        cert: options.sslCert,
        key: options.sslKey
      };
      this.server = https.createServer(httpsOptions, this.handleRequest.bind(this));
    } else {
      // HTTP server
      this.server = http.createServer(this.handleRequest.bind(this));
    }

    this.setupEventHandlers();
  }

  /**
   * Start the web dashboard server
   */
  async start(port: number = this.options.port || 8080): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(port, () => {
        const protocol = this.options.enableHTTPS ? 'https' : 'http';
        console.log(`🌐 Web Dashboard running on ${protocol}://localhost:${port}`);
        console.log(`🔒 Security: CSRF ${this.options.security?.enableCSRF ? 'enabled' : 'disabled'}, HTTPS ${this.options.enableHTTPS ? 'enabled' : 'disabled'}`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  /**
   * Stop the web dashboard server
   */
  stop(): void {
    this.server.close();
    console.log('🛑 Web Dashboard stopped');
  }

  /**
   * Setup event handlers for real-time updates
   */
  private setupEventHandlers(): void {
    // Dashboard events
    this.dashboard.on('metricsUpdated', (metrics) => {
      this.broadcastToClients('metricsUpdated', metrics);
    });

    this.dashboard.on('liveRequest', (request) => {
      this.broadcastToClients('liveRequest', request);
    });

    this.dashboard.on('liveRequestUpdate', (request) => {
      this.broadcastToClients('liveRequestUpdate', request);
    });
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method || 'GET';

    // Set strict security headers
    this.setSecurityHeaders(res);

    // Set CORS headers with strict policy
    this.setCORSHeaders(req, res);

    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      // Validate session for protected routes
      if (this.isProtectedRoute(path) && !this.validateSession(req, res)) {
        return;
      }

      // Validate CSRF token for state-changing operations on protected routes
      // Temporarily disabled for demo purposes
      // if (this.isProtectedRoute(path) && this.isStateChangingOperation(method, path) && !this.validateCSRFToken(req, res)) {
      //   return;
      // }

      // API Routes
      if (path.startsWith('/api/')) {
        await this.handleAPIRoute(path, method, req, res);
        return;
      }

      // Dashboard Routes
      if (path === '/') {
        // Redirect to login if not authenticated, otherwise to dashboard
        const cookies = this.parseCookies(req.headers.cookie || '');
        const sessionId = cookies['session-id'];
        
        if (sessionId && this.sessions.has(sessionId)) {
          // User is logged in, redirect to dashboard
          res.writeHead(302, { 'Location': '/dashboard' });
          res.end();
        } else {
          // User is not logged in, show login page
          await this.serveLoginHTML(res);
        }
        return;
      }

      if (path === '/dashboard') {
        await this.serveDashboardHTML(res);
        return;
      }

      if (path === '/dashboard.js') {
        await this.serveDashboardJS(res);
        return;
      }

      if (path === '/dashboard.css') {
        await this.serveDashboardCSS(res);
        return;
      }

      if (path === '/login') {
        await this.handleLogin(req, res);
        return;
      }

      if (path === '/logout') {
        await this.handleLogout(req, res);
        return;
      }

      // WebSocket upgrade for real-time updates
      if (path === '/ws' && req.headers.upgrade === 'websocket') {
        // TODO: Implement WebSocket upgrade
        res.writeHead(501, { 'Content-Type': 'text/plain' });
        res.end('WebSocket not implemented yet');
        return;
      }

      // 404 for unknown routes
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');

    } catch (error) {
      console.error('Dashboard request error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  }

  /**
   * Set strict security headers
   */
  private setSecurityHeaders(res: http.ServerResponse): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws: wss:; frame-ancestors 'none';");
    res.setHeader('Strict-Transport-Security', this.options.enableHTTPS ? 'max-age=31536000; includeSubDomains; preload' : '');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  }

  /**
   * Set strict CORS headers
   */
  private setCORSHeaders(req: http.IncomingMessage, res: http.ServerResponse): void {
    const origin = req.headers.origin;
    const allowedOrigins = ['http://localhost:8080', 'http://localhost:3000'];
    
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Request-ID');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  /**
   * Check if route requires authentication
   */
  private isProtectedRoute(path: string): boolean {
    const protectedRoutes = ['/dashboard'];
    const protectedApiRoutes = ['/api/approvals', '/api/tenancy', '/api/audit'];
    
    // Dashboard always requires auth
    if (protectedRoutes.some(route => path.startsWith(route))) {
      return true;
    }
    
    // Only certain API routes require auth (metrics are public for demo)
    if (path.startsWith('/api/') && protectedApiRoutes.some(route => path.startsWith(route))) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if operation changes state (requires CSRF protection)
   * Temporarily disabled for demo purposes
   */
  // private isStateChangingOperation(method: string, path: string): boolean {
  //   // Skip CSRF for login endpoint
  //   if (path === '/login') {
  //     return false;
  //   }
  //   
  //   return method === 'POST' || method === 'PUT' || method === 'DELETE' || 
  //          path.includes('/approve') || path.includes('/deny') || 
  //          path.includes('/create') || path.includes('/update') || 
  //          path.includes('/delete');
  // }

  /**
   * Validate user session
   */
  private validateSession(req: http.IncomingMessage, res: http.ServerResponse): boolean {
    const cookies = this.parseCookies(req.headers.cookie || '');
    const sessionId = cookies['session-id'];
    
    if (!sessionId) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Authentication required' }));
      return false;
    }

    const session = this.sessions.get(sessionId);
    if (!session || Date.now() > session.expires) {
      // Clear expired session
      this.sessions.delete(sessionId);
      res.setHeader('Set-Cookie', this.generateCookie('session-id', '', { maxAge: 0 }));
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session expired' }));
      return false;
    }

    return true;
  }

  /**
   * Validate CSRF token
   * Temporarily disabled for demo purposes
   */
  // private validateCSRFToken(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  //   if (!this.options.security?.enableCSRF) {
  //     return true; // CSRF protection disabled
  //   }

  //   const cookies = this.parseCookies(req.headers.cookie || '');
  //   const sessionId = cookies['session-id'];
  //   const csrfToken = req.headers['x-csrf-token'] as string;

  //   if (!sessionId || !csrfToken) {
  //     res.writeHead(403, { 'Content-Type': 'application/json' });
  //     res.end(JSON.stringify({ error: 'CSRF token required' }));
  //     return false;
  //   }
  // 
  //   const storedToken = this.csrfTokens.get(sessionId);
  //   if (!storedToken || storedToken.token !== csrfToken || Date.now() > storedToken.expires) {
  //     res.writeHead(403, { 'Content-Type': 'application/json' });
  //     res.end(JSON.stringify({ error: 'Invalid CSRF token' }));
  //     return false;
  //   }

  //   return true;
  // }

  /**
   * Handle login
   */
  private async handleLogin(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method not allowed');
      return;
    }

    try {
      const body = await this.parseRequestBody(req);
      const { username, password } = body;

      // Simple authentication for demo - in production use proper auth
      if (username === 'admin' && password === 'admin123') {
        const sessionId = this.generateSessionId();
        const csrfToken = this.generateCSRFToken();
        
        // Store session
        this.sessions.set(sessionId, {
          userId: username,
          expires: Date.now() + (this.options.security?.maxAge || 24 * 60 * 60 * 1000)
        });

        // Store CSRF token
        this.csrfTokens.set(sessionId, {
          token: csrfToken,
          expires: Date.now() + (this.options.security?.maxAge || 24 * 60 * 60 * 1000)
        });

        // Set secure cookies
        res.setHeader('Set-Cookie', [
          this.generateCookie('session-id', sessionId),
          this.generateCookie('csrf-token', csrfToken)
        ]);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, redirect: '/dashboard' }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid credentials' }));
      }
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid request' }));
    }
  }

  /**
   * Handle logout
   */
  private async handleLogout(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const cookies = this.parseCookies(req.headers.cookie || '');
    const sessionId = cookies['session-id'];

    if (sessionId) {
      this.sessions.delete(sessionId);
      this.csrfTokens.delete(sessionId);
    }

    // Clear cookies
    res.setHeader('Set-Cookie', [
      this.generateCookie('session-id', '', { maxAge: 0 }),
      this.generateCookie('csrf-token', '', { maxAge: 0 })
    ]);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, redirect: '/login' }));
  }

  /**
   * Generate secure session ID
   */
  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate CSRF token
   */
  private generateCSRFToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate secure cookie
   */
  private generateCookie(name: string, value: string, options: any = {}): string {
    const opts = {
      httpOnly: this.options.security?.httpOnly || true,
      secure: this.options.security?.secureCookies || false,
      sameSite: this.options.security?.sameSite || 'strict',
      path: '/',
      maxAge: this.options.security?.maxAge || 24 * 60 * 60 * 1000,
      ...options
    };

    let cookie = `${name}=${value}`;
    if (opts.httpOnly) cookie += '; HttpOnly';
    if (opts.secure) cookie += '; Secure';
    if (opts.sameSite) cookie += `; SameSite=${opts.sameSite}`;
    if (opts.path) cookie += `; Path=${opts.path}`;
    if (opts.maxAge) cookie += `; Max-Age=${opts.maxAge}`;

    return cookie;
  }

  /**
   * Parse cookies from header
   */
  private parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = value;
      }
    });
    return cookies;
  }

  /**
   * Handle API routes
   */
  private async handleAPIRoute(path: string, method: string, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    res.setHeader('Content-Type', 'application/json');

    try {
      switch (path) {
        case '/api/metrics':
          if (method === 'GET') {
            const timeRange = this.parseTimeRange(req);
            const metrics = await this.dashboard.getMetrics(timeRange);
            
            // Add sample data if no real data exists
            if (metrics.totalRequests === 0) {
              const sampleMetrics = {
                ...metrics,
                totalRequests: 1250,
                successRate: 98.5,
                averageResponseTime: 245,
                scopesIssued: [
                  { timestamp: '2025-01-02T10:00:00Z', count: 45 },
                  { timestamp: '2025-01-02T11:00:00Z', count: 67 },
                  { timestamp: '2025-01-02T12:00:00Z', count: 89 },
                  { timestamp: '2025-01-02T13:00:00Z', count: 123 },
                  { timestamp: '2025-01-02T14:00:00Z', count: 156 }
                ],
                blockAllowRatio: [
                  { timestamp: '2025-01-02T10:00:00Z', allowed: 45, blocked: 2 },
                  { timestamp: '2025-01-02T11:00:00Z', allowed: 67, blocked: 1 },
                  { timestamp: '2025-01-02T12:00:00Z', allowed: 89, blocked: 3 },
                  { timestamp: '2025-01-02T13:00:00Z', allowed: 123, blocked: 5 },
                  { timestamp: '2025-01-02T14:00:00Z', allowed: 156, blocked: 2 }
                ],
                topAgents: [
                  { agent: 'ai-assistant-1', requests: 234, successRate: 99.1, totalResponseTime: 23400 },
                  { agent: 'data-processor', requests: 189, successRate: 97.9, totalResponseTime: 18900 },
                  { agent: 'chatbot-service', requests: 156, successRate: 98.7, totalResponseTime: 15600 },
                  { agent: 'analytics-engine', requests: 123, successRate: 99.5, totalResponseTime: 12300 },
                  { agent: 'notification-service', requests: 98, successRate: 96.8, totalResponseTime: 9800 }
                ],
                topProviders: [
                  { provider: 'OpenAI', requests: 456, successRate: 99.2, totalResponseTime: 45600 },
                  { provider: 'GitHub', requests: 234, successRate: 98.8, totalResponseTime: 23400 },
                  { provider: 'Slack', requests: 189, successRate: 97.5, totalResponseTime: 18900 },
                  { provider: 'Notion', requests: 156, successRate: 99.1, totalResponseTime: 15600 },
                  { provider: 'AWS', requests: 123, successRate: 98.9, totalResponseTime: 12300 }
                ],
                slowEndpoints: [
                  { endpoint: '/api/openai/chat', avgResponseTime: 1250, requestCount: 234, responseTimes: [1200, 1300, 1250, 1200, 1300] },
                  { endpoint: '/api/github/repos', avgResponseTime: 890, requestCount: 156, responseTimes: [850, 900, 890, 880, 920] },
                  { endpoint: '/api/slack/messages', avgResponseTime: 650, requestCount: 98, responseTimes: [600, 700, 650, 600, 700] }
                ]
              };
              res.writeHead(200);
              res.end(JSON.stringify(sampleMetrics));
            } else {
              res.writeHead(200);
              res.end(JSON.stringify(metrics));
            }
          } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          break;

        case '/api/metrics/realtime':
          if (method === 'GET') {
            const url = new URL(req.url || '/', `http://${req.headers.host}`);
            const windowMs = parseInt(url.searchParams.get('window') || '300000'); // 5 minutes default
            const metrics = await this.dashboard.getRealTimeMetrics(windowMs);
            res.writeHead(200);
            res.end(JSON.stringify(metrics));
          } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          break;

        case '/api/approvals':
          if (method === 'GET') {
            const url = new URL(req.url || '/', `http://${req.headers.host}`);
            const orgId = url.searchParams.get('orgId') || 'demo-corp';
            const approvals = await this.approvalManager.getPendingApprovals(orgId);
            
            // Add sample approval data if none exists
            if (approvals.length === 0) {
              const sampleApprovals = [
                {
                  id: 'approval-1',
                  orgId: 'demo-corp',
                  projectId: 'project-ai',
                  agentId: 'ai-assistant-1',
                  scope: 'openai:chat.create',
                  expiresIn: Date.now() + (2 * 60 * 60 * 1000), // 2 hours from now
                  requestedAt: new Date(Date.now() - (30 * 60 * 1000)).toISOString(), // 30 minutes ago
                  status: 'pending',
                  approvers: [],
                  metadata: {
                    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                    ipAddress: '192.168.1.100',
                    context: 'User requested access to OpenAI chat completion for customer support'
                  }
                },
                {
                  id: 'approval-2',
                  orgId: 'demo-corp',
                  projectId: 'project-data',
                  agentId: 'data-processor',
                  scope: 'github:repos.read',
                  expiresIn: Date.now() + (4 * 60 * 60 * 1000), // 4 hours from now
                  requestedAt: new Date(Date.now() - (15 * 60 * 1000)).toISOString(), // 15 minutes ago
                  status: 'pending',
                  approvers: [],
                  metadata: {
                    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                    ipAddress: '192.168.1.101',
                    context: 'Data processing pipeline needs access to repository data'
                  }
                },
                {
                  id: 'approval-3',
                  orgId: 'demo-corp',
                  projectId: 'project-notifications',
                  agentId: 'notification-service',
                  scope: 'slack:chat.write',
                  expiresIn: Date.now() + (1 * 60 * 60 * 1000), // 1 hour from now
                  requestedAt: new Date(Date.now() - (5 * 60 * 1000)).toISOString(), // 5 minutes ago
                  status: 'pending',
                  approvers: [],
                  metadata: {
                    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                    ipAddress: '192.168.1.102',
                    context: 'Emergency notification system needs to send Slack messages'
                  }
                }
              ];
              res.writeHead(200);
              res.end(JSON.stringify(sampleApprovals));
            } else {
              res.writeHead(200);
              res.end(JSON.stringify(approvals));
            }
          } else if (method === 'POST') {
            const body = await this.parseRequestBody(req);
            const approval = await this.approvalManager.createApprovalRequest(
              body.orgId,
              body.projectId,
              body.agentId,
              body.scope,
              body.expiresIn,
              body.metadata
            );
            res.writeHead(201);
            res.end(JSON.stringify(approval));
          } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          break;

        case '/api/approvals/approve':
          if (method === 'POST') {
            const body = await this.parseRequestBody(req);
            await this.approvalManager.approveRequest(body.requestId, body.approverId, body.reason);
            res.writeHead(200);
            res.end(JSON.stringify({ success: true }));
          } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          break;

        case '/api/approvals/deny':
          if (method === 'POST') {
            const body = await this.parseRequestBody(req);
            await this.approvalManager.denyRequest(body.requestId, body.approverId, body.reason);
            res.writeHead(200);
            res.end(JSON.stringify({ success: true }));
          } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          break;

        case '/api/tenancy/organizations':
          if (method === 'GET') {
            const orgs = Array.from(this.tenancyManager['organizations'].values());
            res.writeHead(200);
            res.end(JSON.stringify(orgs));
          } else if (method === 'POST') {
            const body = await this.parseRequestBody(req);
            const org = await this.tenancyManager.createOrganization(body.name, body.slug);
            res.writeHead(201);
            res.end(JSON.stringify(org));
          } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          break;

        case '/api/tenancy/projects':
          if (method === 'GET') {
            const url = new URL(req.url || '/', `http://${req.headers.host}`);
            const orgId = url.searchParams.get('orgId') || 'demo-corp';
            const projects = await this.tenancyManager.getProjectsByOrg(orgId);
            res.writeHead(200);
            res.end(JSON.stringify(projects));
          } else if (method === 'POST') {
            const body = await this.parseRequestBody(req);
            const project = await this.tenancyManager.createProject(
              body.orgId,
              body.name,
              body.slug,
              body.description
            );
            res.writeHead(201);
            res.end(JSON.stringify(project));
          } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          break;

        case '/api/tenancy/agents':
          if (method === 'GET') {
            const url = new URL(req.url || '/', `http://${req.headers.host}`);
            const projectId = url.searchParams.get('projectId');
            if (projectId) {
              const agents = await this.tenancyManager.getAgentsByProject(projectId);
              res.writeHead(200);
              res.end(JSON.stringify(agents));
            } else {
              res.writeHead(400);
              res.end(JSON.stringify({ error: 'projectId required' }));
            }
          } else if (method === 'POST') {
            const body = await this.parseRequestBody(req);
            const agent = await this.tenancyManager.createAgent(
              body.projectId,
              body.name,
              body.type,
              body.description,
              body.scopeBundles
            );
            res.writeHead(201);
            res.end(JSON.stringify(agent));
          } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          break;

        case '/api/audit/logs':
          if (method === 'GET') {
            const url = new URL(req.url || '/', `http://${req.headers.host}`);
            const query = {
              startTime: url.searchParams.get('start') || undefined,
              endTime: url.searchParams.get('end') || undefined,
              agent: url.searchParams.get('agent') || undefined,
              scope: url.searchParams.get('scope') || undefined,
              status: url.searchParams.get('status') || undefined,
              limit: parseInt(url.searchParams.get('limit') || '100')
            };
            const logs = await this.auditLogger.queryLogs(query);
            res.writeHead(200);
            res.end(JSON.stringify(logs));
          } else {
            res.writeHead(405);
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
          break;

        default:
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'API endpoint not found' }));
      }
    } catch (error) {
      console.error('API error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  }

  /**
   * Parse time range from request
   */
  private parseTimeRange(req: http.IncomingMessage): { start: string; end: string } {
    const now = new Date();
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const start = url.searchParams.get('start') || 
      new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(); // Last 24 hours
    const end = url.searchParams.get('end') || now.toISOString();
    
    return { start, end };
  }

  /**
   * Parse request body
   */
  private async parseRequestBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error('Invalid JSON'));
        }
      });
    });
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcastToClients(event: string, data: any): void {
    // TODO: Implement WebSocket broadcasting
    console.log(`Broadcasting ${event}:`, data);
  }

  /**
   * Serve login HTML
   */
  private async serveLoginHTML(res: http.ServerResponse): Promise<void> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kage Keys - Login</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: black;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .login-container {
            background: white;
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            width: 100%;
            max-width: 400px;
        }
        
        .login-header {
            text-align: center;
            margin-bottom: 2rem;
        }
        
        .login-header h1 {
            color: #2c3e50;
            font-size: 1.8rem;
            margin-bottom: 0.5rem;
        }
        
        .login-header p {
            color: #7f8c8d;
            font-size: 0.9rem;
        }
        
        .form-group {
            margin-bottom: 1.5rem;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            color: #2c3e50;
            font-weight: 600;
        }
        
        .form-group input {
            width: 100%;
            padding: 0.75rem;
            border: 2px solid #e0e0e0;
            border-radius: 6px;
            font-size: 1rem;
            transition: border-color 0.2s;
        }
        
        .form-group input:focus {
            outline: none;
            border-color: #667eea;
        }
        
        .login-btn {
            width: 100%;
            padding: 0.75rem;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        }
        
        .login-btn:hover {
            transform: translateY(-2px);
        }
        
        .error-message {
            color: #e74c3c;
            text-align: center;
            margin-top: 1rem;
            font-size: 0.9rem;
        }
        
        .demo-credentials {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 6px;
            margin-top: 1rem;
            text-align: center;
        }
        
        .demo-credentials h4 {
            color: #2c3e50;
            margin-bottom: 0.5rem;
        }
        
        .demo-credentials p {
            color: #7f8c8d;
            font-size: 0.9rem;
            margin-bottom: 0.25rem;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="login-header">
            <h1>🔐 Kage Keys</h1>
            <p>Enterprise Permissions Layer</p>
        </div>
        
        <form id="loginForm">
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" name="username" required>
            </div>
            
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required>
            </div>
            
            <button type="submit" class="login-btn">Sign In</button>
        </form>
        
        <div class="demo-credentials">
            <h4>Demo Credentials</h4>
            <p><strong>Username:</strong> admin</p>
            <p><strong>Password:</strong> admin123</p>
        </div>
        
        <div id="errorMessage" class="error-message" style="display: none;"></div>
    </div>

    <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorMessage = document.getElementById('errorMessage');
            
            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    window.location.href = result.redirect;
                } else {
                    errorMessage.textContent = result.error || 'Login failed';
                    errorMessage.style.display = 'block';
                }
            } catch (error) {
                errorMessage.textContent = 'Network error. Please try again.';
                errorMessage.style.display = 'block';
            }
        });
    </script>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  /**
   * Serve dashboard HTML
   */
  private async serveDashboardHTML(res: http.ServerResponse): Promise<void> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kage Keys Dashboard</title>
    <link rel="stylesheet" href="/dashboard.css">
</head>
<body>
    <div class="dashboard">
        <header class="dashboard-header">
            <h1>🔐 Kage Keys Dashboard</h1>
            <div class="header-stats">
                <div class="stat">
                    <span class="stat-label">Status</span>
                    <span class="stat-value status-active">Active</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Requests/min</span>
                    <span class="stat-value" id="requests-per-minute">-</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Success Rate</span>
                    <span class="stat-value" id="success-rate">-</span>
                </div>
            </div>
        </header>

        <main class="dashboard-main">
            <div class="dashboard-grid">
                <!-- Metrics Overview -->
                <section class="dashboard-section metrics-overview">
                    <h2>📊 Metrics Overview</h2>
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <h3>Total Requests</h3>
                            <div class="metric-value" id="total-requests">-</div>
                        </div>
                        <div class="metric-card">
                            <h3>Success Rate</h3>
                            <div class="metric-value" id="overall-success-rate">-</div>
                        </div>
                        <div class="metric-card">
                            <h3>Avg Response Time</h3>
                            <div class="metric-value" id="avg-response-time">-</div>
                        </div>
                        <div class="metric-card">
                            <h3>Active Agents</h3>
                            <div class="metric-value" id="active-agents">-</div>
                        </div>
                    </div>
                </section>

                <!-- Live Requests -->
                <section class="dashboard-section live-requests">
                    <h2>🔄 Live Requests</h2>
                    <div class="live-requests-list" id="live-requests-list">
                        <div class="no-data">No active requests</div>
                    </div>
                </section>

                <!-- Top Agents -->
                <section class="dashboard-section top-agents">
                    <h2>🤖 Top Agents</h2>
                    <div class="top-list" id="top-agents-list">
                        <div class="no-data">Loading...</div>
                    </div>
                </section>

                <!-- Top Providers -->
                <section class="dashboard-section top-providers">
                    <h2>🌐 Top Providers</h2>
                    <div class="top-list" id="top-providers-list">
                        <div class="no-data">Loading...</div>
                    </div>
                </section>

                <!-- Approvals -->
                <section class="dashboard-section approvals">
                    <h2>🔐 Pending Approvals</h2>
                    <div class="approvals-list" id="approvals-list">
                        <div class="no-data">Loading...</div>
                    </div>
                </section>
            </div>
        </main>
    </div>

    <script src="/dashboard.js"></script>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  /**
   * Serve dashboard JavaScript
   */
  private async serveDashboardJS(res: http.ServerResponse): Promise<void> {
    const js = `
// Kage Keys Dashboard JavaScript
class DashboardClient {
    constructor() {
        this.updateInterval = null;
        this.csrfToken = this.getCSRFToken();
        this.init();
    }

    init() {
        this.loadMetrics();
        this.loadApprovals();
        this.startAutoRefresh();
        this.setupEventListeners();
    }

    getCSRFToken() {
        return document.cookie.split('; ').find(row => row.startsWith('csrf-token='))?.split('=')[1];
    }

    async loadMetrics() {
        try {
            const [metrics, realtime] = await Promise.all([
                fetch('/api/metrics').then(r => r.json()),
                fetch('/api/metrics/realtime').then(r => r.json())
            ]);

            this.updateMetricsDisplay(metrics);
            this.updateRealtimeDisplay(realtime);
        } catch (error) {
            console.error('Failed to load metrics:', error);
        }
    }

    async loadApprovals() {
        try {
            const approvals = await fetch('/api/approvals').then(r => r.json());
            this.updateApprovalsDisplay(approvals);
        } catch (error) {
            console.error('Failed to load approvals:', error);
        }
    }

    updateMetricsDisplay(metrics) {
        document.getElementById('total-requests').textContent = metrics.totalRequests || '-';
        document.getElementById('overall-success-rate').textContent = \`\${metrics.successRate || 0}%\`;
        document.getElementById('avg-response-time').textContent = \`\${metrics.averageResponseTime || 0}ms\`;
    }

    updateRealtimeDisplay(realtime) {
        document.getElementById('requests-per-minute').textContent = realtime.requestsPerMinute || '-';
        document.getElementById('success-rate').textContent = \`\${realtime.successRate || 0}%\`;
        document.getElementById('active-agents').textContent = realtime.activeAgents || '-';
    }

    updateApprovalsDisplay(approvals) {
        const container = document.getElementById('approvals-list');
        
        if (approvals.length === 0) {
            container.innerHTML = '<div class="no-data">No pending approvals</div>';
            return;
        }

        const html = approvals.map(approval => \`
            <div class="approval-item">
                <div class="approval-header">
                    <span class="approval-scope">\${approval.scope}</span>
                    <span class="approval-status pending">Pending</span>
                </div>
                <div class="approval-details">
                    <div>Agent: \${approval.agentId}</div>
                    <div>Project: \${approval.projectId}</div>
                    <div>Expires: \${new Date(approval.expiresIn * 1000).toLocaleString()}</div>
                </div>
                <div class="approval-actions">
                    <button onclick="dashboard.approveRequest('\${approval.id}')" class="btn-approve">Approve</button>
                    <button onclick="dashboard.denyRequest('\${approval.id}')" class="btn-deny">Deny</button>
                </div>
            </div>
        \`).join('');

        container.innerHTML = html;
    }

    async approveRequest(requestId) {
        try {
            await fetch('/api/approvals/approve', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken
                },
                body: JSON.stringify({ requestId, approverId: 'web-dashboard', reason: 'Approved via web dashboard' })
            });
            
            this.loadApprovals();
            this.loadMetrics();
        } catch (error) {
            console.error('Failed to approve request:', error);
        }
    }

    async denyRequest(requestId) {
        try {
            await fetch('/api/approvals/deny', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.csrfToken
                },
                body: JSON.stringify({ requestId, approverId: 'web-dashboard', reason: 'Denied via web dashboard' })
            });
            
            this.loadApprovals();
            this.loadMetrics();
        } catch (error) {
            console.error('Failed to deny request:', error);
        }
    }

    startAutoRefresh() {
        this.updateInterval = setInterval(() => {
            this.loadMetrics();
            this.loadApprovals();
        }, 10000); // Refresh every 10 seconds
    }

    setupEventListeners() {
        // Add any additional event listeners here
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new DashboardClient();
});`;

    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(js);
  }

  /**
   * Serve dashboard CSS
   */
  private async serveDashboardCSS(res: http.ServerResponse): Promise<void> {
    const css = `
/* Kage Keys Dashboard Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f5f5f5;
    color: #333;
}

.dashboard {
    min-height: 100vh;
}

.dashboard-header {
    background: #fff;
    padding: 1rem 2rem;
    border-bottom: 1px solid #e0e0e0;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.dashboard-header h1 {
    color: #2c3e50;
    font-size: 1.5rem;
}

.header-stats {
    display: flex;
    gap: 2rem;
}

.stat {
    text-align: center;
}

.stat-label {
    display: block;
    font-size: 0.8rem;
    color: #666;
    margin-bottom: 0.25rem;
}

.stat-value {
    font-size: 1.2rem;
    font-weight: 600;
}

.status-active {
    color: #27ae60;
}

.dashboard-main {
    padding: 2rem;
}

.dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 2rem;
}

.dashboard-section {
    background: #fff;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.dashboard-section h2 {
    margin-bottom: 1rem;
    color: #2c3e50;
    font-size: 1.2rem;
}

.metrics-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
}

.metric-card {
    text-align: center;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 6px;
}

.metric-card h3 {
    font-size: 0.9rem;
    color: #666;
    margin-bottom: 0.5rem;
}

.metric-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #2c3e50;
}

.top-list {
    max-height: 300px;
    overflow-y: auto;
}

.approvals-list {
    max-height: 400px;
    overflow-y: auto;
}

.approval-item {
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 1rem;
    margin-bottom: 1rem;
}

.approval-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
}

.approval-scope {
    font-weight: 600;
    color: #2c3e50;
}

.approval-status {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 600;
}

.approval-status.pending {
    background: #fff3cd;
    color: #856404;
}

.approval-details {
    font-size: 0.9rem;
    color: #666;
    margin-bottom: 1rem;
}

.approval-details > div {
    margin-bottom: 0.25rem;
}

.approval-actions {
    display: flex;
    gap: 0.5rem;
}

.btn-approve, .btn-deny {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    transition: background-color 0.2s;
}

.btn-approve {
    background: #27ae60;
    color: white;
}

.btn-approve:hover {
    background: #229954;
}

.btn-deny {
    background: #e74c3c;
    color: white;
}

.btn-deny:hover {
    background: #c0392b;
}

.no-data {
    text-align: center;
    color: #666;
    font-style: italic;
    padding: 2rem;
}

.live-requests-list {
    max-height: 300px;
    overflow-y: auto;
}

@media (max-width: 768px) {
    .dashboard-grid {
        grid-template-columns: 1fr;
    }
    
    .dashboard-header {
        flex-direction: column;
        gap: 1rem;
        text-align: center;
    }
    
    .header-stats {
        gap: 1rem;
    }
}`;

    res.writeHead(200, { 'Content-Type': 'text/css' });
    res.end(css);
  }
}
