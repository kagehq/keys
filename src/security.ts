import * as fs from 'fs';
import * as crypto from 'crypto';

export interface SecurityConfig {
  // TLS/SSL Configuration
  tls: {
    enabled: boolean;
    minVersion: string;
    maxVersion: string;
    ciphers: string[];
    honorCipherOrder: boolean;
    requestCert: boolean;
    rejectUnauthorized: boolean;
  };

  // mTLS Configuration
  mtls: {
    enabled: boolean;
    caCertPath?: string;
    clientCertPath?: string;
    clientKeyPath?: string;
    verifyClient: boolean;
  };

  // CORS Configuration
  cors: {
    enabled: boolean;
    origins: string[];
    methods: string[];
    allowedHeaders: string[];
    credentials: boolean;
    maxAge: number;
  };

  // CSRF Protection
  csrf: {
    enabled: boolean;
    secret: string;
    tokenLength: number;
    expiresIn: number;
  };

  // Session Management
  session: {
    enabled: boolean;
    secret: string;
    maxAge: number;
    secure: boolean;
    httpOnly: boolean;
    sameSite: 'strict' | 'lax' | 'none';
  };

  // Rate Limiting
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
  };

  // Security Headers
  headers: {
    xContentTypeOptions: boolean;
    xFrameOptions: boolean;
    xXSSProtection: boolean;
    referrerPolicy: boolean;
    contentSecurityPolicy: boolean;
    strictTransportSecurity: boolean;
    permissionsPolicy: boolean;
  };

  // Authentication
  auth: {
    enabled: boolean;
    method: 'session' | 'jwt' | 'oauth2';
    jwtSecret?: string;
    jwtExpiresIn: number;
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
    };
  };

  // Audit & Logging
  audit: {
    enabled: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    sensitiveFields: string[];
    maskPatterns: RegExp[];
  };
}

export class SecurityManager {
  private config: SecurityConfig;
  private certificates: Map<string, Buffer> = new Map();

  constructor(config?: Partial<SecurityConfig>) {
    this.config = this.getDefaultConfig();
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.loadCertificates();
  }

  /**
   * Get default security configuration
   */
  private getDefaultConfig(): SecurityConfig {
    return {
      tls: {
        enabled: false,
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3',
        ciphers: [
          'ECDHE-RSA-AES256-GCM-SHA384',
          'ECDHE-RSA-AES128-GCM-SHA256',
          'ECDHE-RSA-AES256-SHA384',
          'ECDHE-RSA-AES128-SHA256',
          'ECDHE-RSA-CHACHA20-POLY1305'
        ],
        honorCipherOrder: true,
        requestCert: false,
        rejectUnauthorized: false
      },

      mtls: {
        enabled: false,
        verifyClient: true
      },

      cors: {
        enabled: true,
        origins: ['http://localhost:3000', 'http://localhost:8080'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-Agent-Key',
          'X-Request-ID',
          'X-CSRF-Token'
        ],
        credentials: true,
        maxAge: 86400
      },

      csrf: {
        enabled: true,
        secret: crypto.randomBytes(32).toString('hex'),
        tokenLength: 32,
        expiresIn: 24 * 60 * 60 * 1000 // 24 hours
      },

      session: {
        enabled: true,
        secret: crypto.randomBytes(32).toString('hex'),
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secure: false,
        httpOnly: true,
        sameSite: 'strict'
      },

      rateLimit: {
        enabled: true,
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100,
        skipSuccessfulRequests: false,
        skipFailedRequests: false
      },

      headers: {
        xContentTypeOptions: true,
        xFrameOptions: true,
        xXSSProtection: true,
        referrerPolicy: true,
        contentSecurityPolicy: true,
        strictTransportSecurity: false,
        permissionsPolicy: true
      },

      auth: {
        enabled: true,
        method: 'session',
        jwtExpiresIn: 24 * 60 * 60, // 24 hours
        passwordPolicy: {
          minLength: 12,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true
        }
      },

      audit: {
        enabled: true,
        logLevel: 'info',
        sensitiveFields: ['password', 'token', 'apiKey', 'secret'],
        maskPatterns: [
          /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/g,
          /token\s+[a-zA-Z0-9\-._~+/]+=*/g,
          /api[_-]?key\s*[:=]\s*[a-zA-Z0-9\-._~+/]+=*/gi
        ]
      }
    };
  }

  /**
   * Load SSL/TLS certificates
   */
  private loadCertificates(): void {
    if (this.config.mtls.enabled) {
      this.loadCertificate('ca', this.config.mtls.caCertPath);
      this.loadCertificate('client', this.config.mtls.clientCertPath);
      this.loadCertificate('clientKey', this.config.mtls.clientKeyPath);
    }
  }

  /**
   * Load a certificate from file
   */
  private loadCertificate(type: string, certPath?: string): void {
    if (!certPath) return;

    try {
      const cert = fs.readFileSync(certPath);
      this.certificates.set(type, cert);
      console.log(`✅ Loaded ${type} certificate from ${certPath}`);
    } catch (error) {
      console.error(`❌ Failed to load ${type} certificate from ${certPath}:`, error);
    }
  }

  /**
   * Get TLS options for HTTPS server
   */
  getTLSOptions(): any {
    if (!this.config.tls.enabled) {
      throw new Error('TLS is not enabled in security configuration');
    }

    const options: any = {
      minVersion: this.config.tls.minVersion,
      maxVersion: this.config.tls.maxVersion,
      ciphers: this.config.tls.ciphers.join(':'),
      honorCipherOrder: this.config.tls.honorCipherOrder
    };

    if (this.config.mtls.enabled) {
      options.requestCert = this.config.tls.requestCert;
      options.rejectUnauthorized = this.config.tls.rejectUnauthorized;
      
      if (this.certificates.has('ca')) {
        options.ca = this.certificates.get('ca');
      }
    }

    return options;
  }

  /**
   * Get CORS headers
   */
  getCORSHeaders(origin?: string): Record<string, string> {
    if (!this.config.cors.enabled) {
      return {};
    }

    const headers: Record<string, string> = {};

    // Check if origin is allowed
    if (origin && this.config.cors.origins.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
    }

    headers['Access-Control-Allow-Methods'] = this.config.cors.methods.join(', ');
    headers['Access-Control-Allow-Headers'] = this.config.cors.allowedHeaders.join(', ');
    headers['Access-Control-Allow-Credentials'] = this.config.cors.credentials.toString();
    headers['Access-Control-Max-Age'] = this.config.cors.maxAge.toString();

    return headers;
  }

  /**
   * Get security headers
   */
  getSecurityHeaders(enableHTTPS: boolean = false): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.config.headers.xContentTypeOptions) {
      headers['X-Content-Type-Options'] = 'nosniff';
    }

    if (this.config.headers.xFrameOptions) {
      headers['X-Frame-Options'] = 'DENY';
    }

    if (this.config.headers.xXSSProtection) {
      headers['X-XSS-Protection'] = '1; mode=block';
    }

    if (this.config.headers.referrerPolicy) {
      headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
    }

    if (this.config.headers.contentSecurityPolicy) {
      headers['Content-Security-Policy'] = this.getCSPPolicy();
    }

    if (this.config.headers.strictTransportSecurity && enableHTTPS) {
      headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
    }

    if (this.config.headers.permissionsPolicy) {
      headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()';
    }

    return headers;
  }

  /**
   * Get Content Security Policy
   */
  private getCSPPolicy(): string {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self' ws: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ');
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken(): string {
    if (!this.config.csrf.enabled) {
      throw new Error('CSRF protection is not enabled');
    }

    return crypto.randomBytes(this.config.csrf.tokenLength).toString('hex');
  }

  /**
   * Validate CSRF token
   */
  validateCSRFToken(token: string, storedToken: string): boolean {
    if (!this.config.csrf.enabled) {
      return true;
    }

    return token === storedToken && token.length === this.config.csrf.tokenLength * 2;
  }

  /**
   * Generate session ID
   */
  generateSessionId(): string {
    if (!this.config.session.enabled) {
      throw new Error('Session management is not enabled');
    }

    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate password strength
   */
  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const policy = this.config.auth.passwordPolicy;

    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`);
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Hash password securely
   */
  hashPassword(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(16).toString('hex');
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) reject(err);
        resolve(salt + ':' + derivedKey.toString('hex'));
      });
    });
  }

  /**
   * Verify password hash
   */
  verifyPassword(password: string, hash: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const [salt, key] = hash.split(':');
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) reject(err);
        resolve(key === derivedKey.toString('hex'));
      });
    });
  }

  /**
   * Mask sensitive data in logs
   */
  maskSensitiveData(data: string): string {
    if (!this.config.audit.enabled) {
      return data;
    }

    let masked = data;

    // Apply pattern masks
    this.config.audit.maskPatterns.forEach(pattern => {
      masked = masked.replace(pattern, '[REDACTED]');
    });

    // Mask sensitive fields
    this.config.audit.sensitiveFields.forEach(field => {
      const regex = new RegExp(`"${field}"\\s*:\\s*"[^"]*"`, 'gi');
      masked = masked.replace(regex, `"${field}": "[REDACTED]"`);
    });

    return masked;
  }

  /**
   * Check if request should be rate limited
   */
  shouldRateLimit(_clientId: string, currentCount: number): boolean {
    if (!this.config.rateLimit.enabled) {
      return false;
    }

    return currentCount >= this.config.rateLimit.maxRequests;
  }

  /**
   * Get rate limit window
   */
  getRateLimitWindow(): number {
    return this.config.rateLimit.windowMs;
  }

  /**
   * Generate secure random string
   */
  generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate secure cookie options
   */
  getCookieOptions(secure: boolean = false): any {
    return {
      httpOnly: this.config.session.httpOnly,
      secure: secure || this.config.session.secure,
      sameSite: this.config.session.sameSite,
      path: '/',
      maxAge: this.config.session.maxAge
    };
  }

  /**
   * Validate certificate chain
   */
  validateCertificateChain(cert: Buffer, caCert: Buffer): boolean {
    try {
      // In production, use proper certificate validation libraries
      // This is a simplified example
      return cert.length > 0 && caCert.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get security configuration summary
   */
  getSecuritySummary(): Record<string, any> {
    return {
      tls: this.config.tls.enabled,
      mtls: this.config.mtls.enabled,
      cors: this.config.cors.enabled,
      csrf: this.config.csrf.enabled,
      session: this.config.session.enabled,
      rateLimit: this.config.rateLimit.enabled,
      auth: this.config.auth.enabled,
      audit: this.config.audit.enabled,
      certificates: Array.from(this.certificates.keys())
    };
  }

  /**
   * Update security configuration
   */
  updateConfig(updates: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...updates };
    this.loadCertificates();
  }

  /**
   * Export security configuration (without secrets)
   */
  exportConfig(): Partial<SecurityConfig> {
    const { session, auth, csrf, ...exportable } = this.config;
    return {
      ...exportable,
      session: { ...session, secret: '[REDACTED]' },
      auth: { ...auth, jwtSecret: '[REDACTED]' },
      csrf: { ...csrf, secret: '[REDACTED]' }
    };
  }
}
