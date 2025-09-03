import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { Dashboard } from './dashboard';
import { ApprovalManager } from './approval';
import { TenancyManager } from './tenancy';
import { SQLiteAuditLogger } from './audit';

export interface WebDashboardOptions {
  port?: number;
  enableHTTPS?: boolean;
  sslCert?: string;
  sslKey?: string;
  dashboard: Dashboard;
  approvalManager: ApprovalManager;
  tenancyManager: TenancyManager;
  auditLogger: SQLiteAuditLogger;
}

export class WebDashboard {
  private server: http.Server | https.Server;
  private options: WebDashboardOptions;
  private dashboard: Dashboard;
  private approvalManager: ApprovalManager;
  private tenancyManager: TenancyManager;
  private auditLogger: SQLiteAuditLogger;

  constructor(options: WebDashboardOptions) {
    this.options = options;
    this.dashboard = options.dashboard;
    this.approvalManager = options.approvalManager;
    this.tenancyManager = options.tenancyManager;
    this.auditLogger = options.auditLogger;

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

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      // API Routes
      if (path.startsWith('/api/')) {
        await this.handleAPIRoute(path, method, req, res);
        return;
      }

      // Dashboard Routes
      if (path === '/' || path === '/dashboard') {
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
            res.writeHead(200);
            res.end(JSON.stringify(metrics));
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
            res.writeHead(200);
            res.end(JSON.stringify(approvals));
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
        this.init();
    }

    init() {
        this.loadMetrics();
        this.loadApprovals();
        this.startAutoRefresh();
        this.setupEventListeners();
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
                headers: { 'Content-Type': 'application/json' },
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
                headers: { 'Content-Type': 'application/json' },
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
