export interface StartOptions {
  port: string;
  db: string;
  secret?: string;
}

export interface LogsOptions {
  db: string;
  limit: string;
  agent?: string;
  scope?: string;
  status?: string;
  start?: string;
  end?: string;
  format: string;
  export?: string;
}

export interface StatsOptions {
  db: string;
  start?: string;
  end?: string;
  agent?: string;
}

export interface TokenCreateOptions {
  scope: string;
  agent: string;
  target: string;
  expires: string;
  jti?: string;
  secret?: string;
}

export interface TokenVerifyOptions {
  token: string;
  secret?: string;
}

export interface TokenRevokeOptions {
  jti: string;
  secret?: string;
  reason?: string;
}

export interface DatabaseOptions {
  db: string;
}

export interface DatabaseCleanupOptions extends DatabaseOptions {
  days: string;
}
