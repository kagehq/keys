import * as sqlite3 from 'sqlite3';
import * as fs from 'fs';
import { AuditLogEntry } from './types';

export class SQLiteAuditLogger {
  private db: sqlite3.Database;
  private dbPath: string;
  private readonly DB_VERSION = 1;

  constructor(dbPath: string = 'audit.db') {
    this.dbPath = dbPath;
    this.db = new sqlite3.Database(dbPath);
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    this.db.serialize(() => {
      // Create audit_logs table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          agent TEXT NOT NULL,
          scope TEXT NOT NULL,
          duration INTEGER NOT NULL,
          status TEXT NOT NULL,
          route TEXT NOT NULL,
          provider_latency INTEGER,
          jti TEXT NOT NULL,
          token_hash TEXT NOT NULL,
          error TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for better query performance
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_audit_agent ON audit_logs(agent)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_audit_scope ON audit_logs(scope)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_audit_status ON audit_logs(status)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_audit_jti ON audit_logs(jti)`);

      // Create rate_limit_logs table for tracking rate limit events
      this.db.run(`
        CREATE TABLE IF NOT EXISTS rate_limit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agent TEXT NOT NULL,
          scope TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          remaining INTEGER NOT NULL,
          reset_time TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create token_revocations table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS token_revocations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          jti TEXT UNIQUE NOT NULL,
          revoked_at TEXT NOT NULL,
          reason TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create database version table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS db_version (
          version INTEGER PRIMARY KEY,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert or update version
      this.db.run(`
        INSERT OR REPLACE INTO db_version (version) VALUES (?)
      `, [this.DB_VERSION]);
    });
  }

  async log(entry: AuditLogEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO audit_logs (
          timestamp, agent, scope, duration, status, route, 
          provider_latency, jti, token_hash, error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        entry.timestamp,
        entry.agent,
        entry.scope,
        entry.duration,
        entry.status,
        entry.route,
        entry.providerLatency || null,
        entry.jti,
        entry.tokenHash,
        entry.error || null
      ], (err: Error | null) => {
        if (err) {
          console.error('Failed to log audit entry:', err);
          reject(err);
        } else {
          resolve();
        }
      });

      stmt.finalize();
    });
  }

  async logRateLimit(agent: string, scope: string, remaining: number, resetTime: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO rate_limit_logs (agent, scope, timestamp, remaining, reset_time)
        VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run([
        agent,
        scope,
        new Date().toISOString(),
        remaining,
        resetTime
      ], (err: Error | null) => {
        if (err) {
          console.error('Failed to log rate limit:', err);
          reject(err);
        } else {
          resolve();
        }
      });

      stmt.finalize();
    });
  }

  async logTokenRevocation(jti: string, reason?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO token_revocations (jti, revoked_at, reason)
        VALUES (?, ?, ?)
      `);

      stmt.run([
        jti,
        new Date().toISOString(),
        reason || null
      ], (err: Error | null) => {
        if (err) {
          console.error('Failed to log token revocation:', err);
          reject(err);
        } else {
          resolve();
        }
      });

      stmt.finalize();
    });
  }

  async queryLogs(options: {
    startTime?: string;
    endTime?: string;
    agent?: string;
    scope?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<AuditLogEntry[]> {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM audit_logs WHERE 1=1';
      const params: any[] = [];

      if (options.startTime) {
        query += ' AND timestamp >= ?';
        params.push(options.startTime);
      }

      if (options.endTime) {
        query += ' AND timestamp <= ?';
        params.push(options.endTime);
      }

      if (options.agent) {
        query += ' AND agent = ?';
        params.push(options.agent);
      }

      if (options.scope) {
        query += ' AND scope = ?';
        params.push(options.scope);
      }

      if (options.status) {
        query += ' AND status = ?';
        params.push(options.status);
      }

      query += ' ORDER BY timestamp DESC';

      if (options.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);
      }

      if (options.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }

      this.db.all(query, params, (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => ({
            timestamp: row.timestamp,
            agent: row.agent,
            scope: row.scope,
            duration: row.duration,
            status: row.status,
            route: row.route,
            providerLatency: row.provider_latency,
            jti: row.jti,
            tokenHash: row.token_hash,
            error: row.error
          })));
        }
      });
    });
  }

  async getStats(options: {
    startTime?: string;
    endTime?: string;
    agent?: string;
  } = {}): Promise<{
    totalRequests: number;
    successCount: number;
    errorCount: number;
    rateLimitedCount: number;
    unauthorizedCount: number;
    averageDuration: number;
    averageProviderLatency: number;
    topScopes: Array<{ scope: string; count: number }>;
    topAgents: Array<{ agent: string; count: number }>;
  }> {
    return new Promise((resolve, reject) => {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (options.startTime) {
        whereClause += ' AND timestamp >= ?';
        params.push(options.startTime);
      }

      if (options.endTime) {
        whereClause += ' AND timestamp <= ?';
        params.push(options.endTime);
      }

      if (options.agent) {
        whereClause += ' AND agent = ?';
        params.push(options.agent);
      }

      const queries = [
        `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
        `SELECT COUNT(*) as count FROM audit_logs ${whereClause} AND status = 'success'`,
        `SELECT COUNT(*) as count FROM audit_logs ${whereClause} AND status = 'error'`,
        `SELECT COUNT(*) as count FROM audit_logs ${whereClause} AND status = 'rate_limited'`,
        `SELECT COUNT(*) as count FROM audit_logs ${whereClause} AND status = 'unauthorized'`,
        `SELECT AVG(duration) as avg FROM audit_logs ${whereClause}`,
        `SELECT AVG(provider_latency) as avg FROM audit_logs ${whereClause} AND provider_latency IS NOT NULL`,
        `SELECT scope, COUNT(*) as count FROM audit_logs ${whereClause} GROUP BY scope ORDER BY count DESC LIMIT 10`,
        `SELECT agent, COUNT(*) as count FROM audit_logs ${whereClause} GROUP BY agent ORDER BY count DESC LIMIT 10`
      ];

      let completedQueries = 0;
      const results: any[] = [];

      queries.forEach((query, index) => {
        this.db.get(query, params, (err: Error | null, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          results[index] = row;
          completedQueries++;

          if (completedQueries === queries.length) {
            resolve({
              totalRequests: results[0]?.total || 0,
              successCount: results[1]?.count || 0,
              errorCount: results[2]?.count || 0,
              rateLimitedCount: results[3]?.count || 0,
              unauthorizedCount: results[4]?.count || 0,
              averageDuration: results[5]?.avg || 0,
              averageProviderLatency: results[6]?.avg || 0,
              topScopes: results[7] || [],
              topAgents: results[8] || []
            });
          }
        });
      });
    });
  }

  async exportToJSONL(outputPath: string, options: {
    startTime?: string;
    endTime?: string;
    agent?: string;
    scope?: string;
  } = {}): Promise<void> {
    const logs = await this.queryLogs(options);
    const stream = fs.createWriteStream(outputPath);

    return new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('finish', resolve);

      logs.forEach(log => {
        stream.write(JSON.stringify(log) + '\n');
      });

      stream.end();
    });
  }

  async exportToCSV(outputPath: string, options: {
    startTime?: string;
    endTime?: string;
    agent?: string;
    scope?: string;
  } = {}): Promise<void> {
    const logs = await this.queryLogs(options);
    const stream = fs.createWriteStream(outputPath);

    return new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('finish', resolve);

      // Write CSV header
      stream.write('timestamp,agent,scope,duration,status,route,provider_latency,jti,token_hash,error\n');

      // Write data rows
      logs.forEach(log => {
        const row = [
          log.timestamp,
          `"${log.agent}"`,
          `"${log.scope}"`,
          log.duration,
          log.status,
          `"${log.route}"`,
          log.providerLatency || '',
          log.jti,
          log.tokenHash,
          log.error ? `"${log.error}"` : ''
        ].join(',');
        stream.write(row + '\n');
      });

      stream.end();
    });
  }

  async cleanupOldLogs(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffISO = cutoffDate.toISOString();

    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM audit_logs WHERE timestamp < ?',
        [cutoffISO],
        function(this: sqlite3.RunResult, err: Error | null) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        }
      );
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Get database size for monitoring
  getDatabaseSize(): number {
    try {
      const stats = fs.statSync(this.dbPath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  // Get database path
  getDatabasePath(): string {
    return this.dbPath;
  }
}
