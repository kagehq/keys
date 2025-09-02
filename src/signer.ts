import * as crypto from 'crypto';
import { Signer, TokenPayload, TokenValidationResult, AgentToken } from './types';

export class HMACSigner implements Signer {
  private secret: string;
  private keyId: string;
  private revokedTokens: Set<string> = new Set();
  private readonly ISSUER = 'kage-keys';

  constructor(secret?: string) {
    this.secret = secret || this.generateSecret();
    this.keyId = this.generateKeyId();
  }

  async sign(payload: TokenPayload, options?: { algorithm?: string; keyId?: string }): Promise<string> {
    const algorithm = options?.algorithm || 'HS256';
    const keyId = options?.keyId || this.keyId;

    // Create header
    const header = {
      alg: algorithm,
      typ: 'JWT',
      kid: keyId
    };

    // Create payload with issuer if not provided
    const finalPayload = {
      ...payload,
      iss: payload.iss || this.ISSUER,
      kid: keyId
    };

    // Encode header and payload
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(finalPayload));

    // Create signature
    const data = `${encodedHeader}.${encodedPayload}`;
    const signature = this.createSignature(data, algorithm);

    return `${data}.${signature}`;
  }

  async verify(token: string): Promise<TokenValidationResult> {
    try {
      // Check if token is revoked
      const jti = this.extractJTI(token);
      if (jti && await this.isTokenRevoked(jti)) {
        return {
          valid: false,
          reason: 'revoked',
          error: 'Token has been revoked'
        };
      }

      // Parse token parts
      const parts = token.split('.');
      if (parts.length !== 3) {
        return {
          valid: false,
          reason: 'invalid_format',
          error: 'Invalid token format'
        };
      }

      const [encodedHeader, encodedPayload, signature] = parts;

      // Decode header and payload
      const header = JSON.parse(this.base64UrlDecode(encodedHeader));
      const payload = JSON.parse(this.base64UrlDecode(encodedPayload));

      // Verify signature
      const data = `${encodedHeader}.${encodedPayload}`;
      const expectedSignature = this.createSignature(data, header.alg);
      
      if (signature !== expectedSignature) {
        return {
          valid: false,
          reason: 'invalid_signature',
          error: 'Invalid signature'
        };
      }

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return {
          valid: false,
          reason: 'expired',
          error: 'Token has expired'
        };
      }

      // Check not before
      if (payload.nbf && payload.nbf > now) {
        return {
          valid: false,
          reason: 'not_yet_valid',
          error: 'Token is not yet valid'
        };
      }

      // Validate required fields
      if (!payload.sub || !payload.aud || !payload.scope || !payload.jti) {
        return {
          valid: false,
          reason: 'invalid_format',
          error: 'Missing required fields'
        };
      }

      return {
        valid: true,
        token: payload as AgentToken
      };
    } catch (error) {
      return {
        valid: false,
        reason: 'invalid_format',
        error: `Token validation failed: ${error}`
      };
    }
  }

  async rotateKey(): Promise<string> {
    this.secret = this.generateSecret();
    this.keyId = this.generateKeyId();
    return this.keyId;
  }

  async revokeToken(jti: string): Promise<void> {
    this.revokedTokens.add(jti);
  }

  async isTokenRevoked(jti: string): Promise<boolean> {
    return this.revokedTokens.has(jti);
  }

  private createSignature(data: string, algorithm: string): string {
    const hmac = crypto.createHmac(algorithm.replace('HS', 'sha'), this.secret);
    hmac.update(data);
    return this.base64UrlEncode(hmac.digest());
  }

  private base64UrlEncode(data: string | Buffer): string {
    const base64 = Buffer.isBuffer(data) ? data.toString('base64') : Buffer.from(data).toString('base64');
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private base64UrlDecode(str: string): string {
    str += '='.repeat((4 - str.length % 4) % 4);
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(str, 'base64').toString();
  }

  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateKeyId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  private extractJTI(token: string): string | null {
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(this.base64UrlDecode(parts[1]));
        return payload.jti || null;
      }
    } catch {
      // Ignore parsing errors
    }
    return null;
  }
}
