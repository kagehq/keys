import * as http from 'http';
import * as https from 'https';
import { readFileSync } from 'fs';
import { HMACSigner } from './signer';
import { SQLiteAuditLogger } from './audit';
import { ScopeParser } from './scope';

export interface BrokerOptions {
  port?: number;
  enableHTTPS?: boolean;
  enableMTLS?: boolean;
  sslCert?: string;
  sslKey?: string;
  caCert?: string; // CA certificate for client verification
  clientCert?: string; // Client certificate for mutual auth
  clientKey?: string; // Client private key for mutual auth
  cors?: {
    origin: string | string[];
    methods: string[];
    allowedHeaders: string[];
    credentials: boolean;
  };
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
}

export interface BrokerRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  agent: string;
  scope: string;
  jti: string;
}

export interface BrokerResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  duration: number;
  providerLatency?: number;
}

export class AgentKeyBroker {
  private server: http.Server | https.Server;
  private signer: HMACSigner;
  private auditLogger: SQLiteAuditLogger;

  private options: BrokerOptions;
  private rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(signer: HMACSigner, auditLogger: SQLiteAuditLogger, options: BrokerOptions = {}) {
    this.signer = signer;
    this.auditLogger = auditLogger;
    this.options = {
      port: 3000,
      enableHTTPS: false,
      enableMTLS: false,
      cors: {
        origin: ['http://localhost:3000', 'http://localhost:8080'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Agent-Key', 'X-Request-ID'],
        credentials: true
      },
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100
      },
      ...options
    };

    if (this.options.enableHTTPS && this.options.enableMTLS) {
      this.server = this.createMTLSServer();
    } else if (this.options.enableHTTPS) {
      this.server = this.createHTTPSServer();
    } else {
      this.server = this.createHTTPServer();
    }
  }

  /**
   * Create mTLS-enabled HTTPS server
   */
  private createMTLSServer(): https.Server {
    if (!this.options.sslCert || !this.options.sslKey || !this.options.caCert) {
      throw new Error('mTLS requires sslCert, sslKey, and caCert to be provided');
    }

    const httpsOptions: https.ServerOptions = {
      cert: readFileSync(this.options.sslCert),
      key: readFileSync(this.options.sslKey),
      ca: readFileSync(this.options.caCert), // CA certificate for client verification
      requestCert: true, // Require client certificate
      rejectUnauthorized: true, // Reject unauthorized clients
      minVersion: 'TLSv1.2', // Enforce minimum TLS version
      maxVersion: 'TLSv1.3', // Use latest TLS version
      ciphers: [
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES256-SHA384',
        'ECDHE-RSA-AES128-SHA256'
      ].join(':'),
      honorCipherOrder: true
    };

    return https.createServer(httpsOptions, this.handleRequest.bind(this));
  }

  /**
   * Create regular HTTPS server
   */
  private createHTTPSServer(): https.Server {
    if (!this.options.sslCert || !this.options.sslKey) {
      throw new Error('HTTPS requires sslCert and sslKey to be provided');
    }

    const httpsOptions: https.ServerOptions = {
      cert: readFileSync(this.options.sslCert),
      key: readFileSync(this.options.sslKey),
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.3'
    };

    return https.createServer(httpsOptions, this.handleRequest.bind(this));
  }

  /**
   * Create HTTP server
   */
  private createHTTPServer(): http.Server {
    return http.createServer(this.handleRequest.bind(this));
  }

  /**
   * Start the broker server
   */
  async start(port: number = this.options.port || 3000): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(port, () => {
        const protocol = this.options.enableHTTPS ? 'https' : 'http';
        const mTLS = this.options.enableMTLS ? ' with mTLS' : '';
        console.log(`🚀 Broker running on ${protocol}://localhost:${port}${mTLS}`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  /**
   * Stop the broker server
   */
  stop(): void {
    this.server.close();
    console.log('🛑 Broker stopped');
  }

  /**
   * Handle incoming requests
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Apply CORS headers
      this.applyCORSHeaders(req, res);

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Rate limiting
      if (!this.checkRateLimit(req)) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
        return;
      }

      // Validate mTLS client certificate if enabled
      if (this.options.enableMTLS && !this.validateClientCertificate(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid client certificate' }));
        return;
      }

      // Extract and validate agent key
      const agentKey = req.headers['x-agent-key'] as string;
      if (!agentKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'X-Agent-Key header required' }));
        return;
      }

      // Validate token and extract scope
      const tokenData = await this.validateToken(agentKey);
      if (!tokenData) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid or expired token' }));
        return;
      }

      // Parse and validate scope
      const scope = tokenData.scope;
      if (!ScopeParser.validate(scope)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid scope format' }));
        return;
      }

      // Check if scope is allowed for the requested route
      const route = `${req.method} ${req.url}`;
      if (!ScopeParser.matches(scope, route)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Insufficient scope' }));
        return;
      }

      // Forward request to provider
      const response = await this.forwardRequest(req, tokenData);
      const duration = Date.now() - startTime;

      // Log the request
      await this.auditLogger.log({
        timestamp: new Date().toISOString(),
        agent: tokenData.agent,
        scope: scope,
        duration: duration,
        status: response.statusCode < 400 ? 'success' : 'error',
        route: route,
        providerLatency: response.providerLatency,
        jti: tokenData.jti,
        tokenHash: this.hashToken(agentKey),
        error: response.statusCode >= 400 ? 'Request failed' : undefined
      });

      // Send response
      res.writeHead(response.statusCode, response.headers);
      res.end(response.body);

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('Broker error:', error);

      // Log error
      await this.auditLogger.log({
        timestamp: new Date().toISOString(),
        agent: 'unknown',
        scope: 'unknown',
        duration: duration,
        status: 'error',
        route: `${req.method} ${req.url}`,
        jti: requestId,
        tokenHash: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  /**
   * Apply CORS headers based on configuration
   */
  private applyCORSHeaders(req: http.IncomingMessage, res: http.ServerResponse): void {
    const origin = req.headers.origin;
    const cors = this.options.cors!;

    if (origin) {
      if (Array.isArray(cors.origin)) {
        if (cors.origin.includes(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        }
      } else if (cors.origin === '*' || cors.origin === origin) {
        res.setHeader('Access-Control-Allow-Origin', cors.origin);
      }
    }

    res.setHeader('Access-Control-Allow-Methods', cors.methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', cors.allowedHeaders.join(', '));
    res.setHeader('Access-Control-Allow-Credentials', cors.credentials.toString());
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(req: http.IncomingMessage): boolean {
    const clientId = this.getClientId(req);
    const now = Date.now();
    const rateLimit = this.options.rateLimit!;

    const clientData = this.rateLimitMap.get(clientId);
    if (!clientData || now > clientData.resetTime) {
      this.rateLimitMap.set(clientId, { count: 1, resetTime: now + rateLimit.windowMs });
      return true;
    }

    if (clientData.count >= rateLimit.maxRequests) {
      return false;
    }

    clientData.count++;
    return true;
  }

  /**
   * Get client identifier for rate limiting
   */
  private getClientId(req: http.IncomingMessage): string {
    // For mTLS, use client certificate fingerprint
    if (this.options.enableMTLS && (req as any).socket?.getPeerCertificate) {
      const cert = (req as any).socket.getPeerCertificate();
      if (cert && cert.fingerprint) {
        return `cert-${cert.fingerprint}`;
      }
    }

    // Fallback to IP address
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? forwarded.toString().split(',')[0] : req.socket.remoteAddress;
    return `ip-${ip}`;
  }

  /**
   * Validate client certificate for mTLS
   */
  private validateClientCertificate(req: http.IncomingMessage): boolean {
    try {
      const socket = (req as any).socket;
      if (!socket || !socket.getPeerCertificate) {
        return false;
      }

      const cert = socket.getPeerCertificate();
      if (!cert || !cert.raw) {
        return false;
      }

      // Check certificate validity
      const now = new Date();
      const notBefore = new Date(cert.valid_from);
      const notAfter = new Date(cert.valid_to);

      if (now < notBefore || now > notAfter) {
        return false;
      }

      // Check certificate subject (optional - can be customized)
      if (cert.subject && cert.subject.CN) {
        // You can add additional validation here
        // e.g., check if CN matches expected pattern
      }

      return true;
    } catch (error) {
      console.error('Certificate validation error:', error);
      return false;
    }
  }

  /**
   * Validate JWT token and extract data
   */
  private async validateToken(token: string): Promise<{ agent: string; scope: string; jti: string } | null> {
    try {
      // Verify token signature
      const payload = await this.signer.verify(token);
      if (!payload || !payload.valid) {
        return null;
      }

      const tokenData = payload.token;
      if (!tokenData) {
        return null;
      }

      // Check expiration
      if (tokenData.exp && Date.now() >= tokenData.exp * 1000) {
        return null;
      }

      // Check not-before
      if (tokenData.nbf && Date.now() < tokenData.nbf * 1000) {
        return null;
      }

      return {
        agent: tokenData.sub || 'unknown',
        scope: tokenData.scope || '',
        jti: tokenData.jti || ''
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Forward request to actual provider
   */
  private async forwardRequest(_req: http.IncomingMessage, tokenData: { agent: string; scope: string; jti: string }): Promise<BrokerResponse> {
    // For demo purposes, we'll simulate a provider response
    // In production, this would route to actual API providers
    const startTime = Date.now();
    
    // Simulate provider latency
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    
    const providerLatency = Date.now() - startTime;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: 'Request processed successfully',
        scope: tokenData.scope,
        agent: tokenData.agent
      }),
      duration: Date.now() - startTime,
      providerLatency: providerLatency
    };
  }



  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Hash token for audit logging
   */
  private hashToken(token: string): string {
    // Simple hash for demo - in production use crypto.createHash('sha256')
    return Buffer.from(token).toString('base64').substr(0, 16);
  }
}


