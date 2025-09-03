import { 
  DashboardMetrics, 
  TimeSeriesPoint, 
  TopAgent, 
  TopProvider, 
  SlowEndpoint,
  LiveRequest
} from './enterprise-types';
import { SQLiteAuditLogger } from './audit';
import { EventEmitter } from 'events';

export interface DashboardOptions {
  auditLogger: SQLiteAuditLogger;
  enableLiveStreaming?: boolean;
  metricsRetentionDays?: number;
  updateIntervalMs?: number;
}

export class Dashboard extends EventEmitter {
  private auditLogger: SQLiteAuditLogger;
  private options: DashboardOptions;
  private liveRequests: Map<string, LiveRequest> = new Map();
  private metricsCache: Map<string, DashboardMetrics> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(options: DashboardOptions) {
    super();
    this.auditLogger = options.auditLogger;
    this.options = {
      enableLiveStreaming: true,
      metricsRetentionDays: 30,
      updateIntervalMs: 5000,
      ...options
    };

    if (this.options.enableLiveStreaming) {
      this.startLiveStreaming();
    }

    if (this.options.updateIntervalMs) {
      this.startMetricsUpdates();
    }
  }

  /**
   * Start live request streaming
   */
  private startLiveStreaming(): void {
    // Emit live request events
    this.on('newRequest', (request: LiveRequest) => {
      this.liveRequests.set(request.id, request);
      this.emit('liveRequest', request);
    });

    this.on('requestCompleted', (requestId: string, response: any) => {
      const request = this.liveRequests.get(requestId);
      if (request) {
        request.status = 'completed';
        request.response = response;
        request.duration = Date.now() - new Date(request.timestamp).getTime();
        this.emit('liveRequestUpdate', request);
      }
    });

    this.on('requestFailed', (requestId: string, _error: any) => {
      const request = this.liveRequests.get(requestId);
      if (request) {
        request.status = 'failed';
        this.emit('liveRequestUpdate', request);
      }
    });
  }

  /**
   * Start periodic metrics updates
   */
  private startMetricsUpdates(): void {
    this.updateInterval = setInterval(async () => {
      try {
        await this.updateMetricsCache();
      } catch (error) {
        console.error('Failed to update metrics cache:', error);
      }
    }, this.options.updateIntervalMs);
  }

  /**
   * Stop metrics updates
   */
  stopMetricsUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Update metrics cache with fresh data
   */
  private async updateMetricsCache(): Promise<void> {
    const now = new Date();
    const timeRange = {
      start: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
      end: now.toISOString()
    };

    const metrics = await this.getMetrics(timeRange);
    this.metricsCache.set('24h', metrics);
    this.emit('metricsUpdated', metrics);
  }

  /**
   * Get comprehensive dashboard metrics
   */
  async getMetrics(timeRange: { start: string; end: string }): Promise<DashboardMetrics> {
    const [scopesIssued, blockAllowRatio, topAgents, topProviders, slowEndpoints, overallStats] = await Promise.all([
      this.getScopesIssuedMetrics(timeRange),
      this.getBlockAllowRatioMetrics(timeRange),
      this.getTopAgentsMetrics(timeRange),
      this.getTopProvidersMetrics(timeRange),
      this.getSlowEndpointsMetrics(timeRange),
      this.getOverallStats(timeRange)
    ]);

    return {
      timeRange,
      scopesIssued,
      blockAllowRatio,
      topAgents,
      topProviders,
      slowEndpoints,
      ...overallStats
    };
  }

  /**
   * Get scopes issued over time
   */
  private async getScopesIssuedMetrics(timeRange: { start: string; end: string }): Promise<TimeSeriesPoint[]> {
    const logs = await this.auditLogger.queryLogs({
      startTime: timeRange.start,
      endTime: timeRange.end,
      limit: 1000
    });

    // Group by hour and count scopes issued
    const hourlyCounts = new Map<string, number>();
    
    logs.forEach(log => {
      const hour = new Date(log.timestamp).toISOString().substring(0, 13) + ':00:00.000Z';
      hourlyCounts.set(hour, (hourlyCounts.get(hour) || 0) + 1);
    });

    return Array.from(hourlyCounts.entries())
      .map(([timestamp, value]) => ({ timestamp, value }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Get block/allow ratio over time
   */
  private async getBlockAllowRatioMetrics(timeRange: { start: string; end: string }): Promise<TimeSeriesPoint[]> {
    const logs = await this.auditLogger.queryLogs({
      startTime: timeRange.start,
      endTime: timeRange.end,
      limit: 1000
    });

    // Group by hour and calculate success rate
    const hourlyStats = new Map<string, { success: number; total: number }>();
    
    logs.forEach(log => {
      const hour = new Date(log.timestamp).toISOString().substring(0, 13) + ':00:00.000Z';
      const stats = hourlyStats.get(hour) || { success: 0, total: 0 };
      stats.total++;
      if (log.status === 'success') stats.success++;
      hourlyStats.set(hour, stats);
    });

    return Array.from(hourlyStats.entries())
      .map(([timestamp, stats]) => ({ 
        timestamp, 
        value: stats.total > 0 ? (stats.success / stats.total) * 100 : 0 
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Get top agents by request count
   */
  private async getTopAgentsMetrics(timeRange: { start: string; end: string }): Promise<TopAgent[]> {
    const logs = await this.auditLogger.queryLogs({
      startTime: timeRange.start,
      endTime: timeRange.end,
      limit: 1000
    });

    const agentStats = new Map<string, TopAgent>();
    
    logs.forEach(log => {
      const existing = agentStats.get(log.agent) || {
        agentId: log.agent,
        agentName: log.agent,
        requestCount: 0,
        successCount: 0,
        errorCount: 0,
        averageResponseTime: 0,
        totalResponseTime: 0
      };

      existing.requestCount++;
      if (log.status === 'success') {
        existing.successCount++;
      } else {
        existing.errorCount++;
      }

      if (log.duration) {
        existing.totalResponseTime += log.duration;
        existing.averageResponseTime = existing.totalResponseTime / existing.requestCount;
      }

      agentStats.set(log.agent, existing);
    });

    return Array.from(agentStats.values())
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 10)
      .map(agent => ({
        agentId: agent.agentId,
        agentName: agent.agentName,
        requestCount: agent.requestCount,
        successCount: agent.successCount,
        errorCount: agent.errorCount,
        averageResponseTime: Math.round(agent.averageResponseTime),
        totalResponseTime: agent.totalResponseTime
      }));
  }

  /**
   * Get top providers by request count
   */
  private async getTopProvidersMetrics(timeRange: { start: string; end: string }): Promise<TopProvider[]> {
    const logs = await this.auditLogger.queryLogs({
      startTime: timeRange.start,
      endTime: timeRange.end,
      limit: 1000
    });

    const providerStats = new Map<string, TopProvider>();
    
    logs.forEach(log => {
      // Extract provider from route
      const provider = this.extractProviderFromRoute(log.route);
      if (!provider) return;

      const existing = providerStats.get(provider) || {
        provider,
        requestCount: 0,
        successCount: 0,
        errorCount: 0,
        averageResponseTime: 0,
        totalResponseTime: 0,
        totalLatency: 0
      };

      existing.requestCount++;
      if (log.status === 'success') {
        existing.successCount++;
      } else {
        existing.errorCount++;
      }

      if (log.duration) {
        existing.totalResponseTime += log.duration;
        existing.averageResponseTime = existing.totalResponseTime / existing.requestCount;
      }

      if (log.providerLatency) {
        existing.totalLatency += log.providerLatency;
      }

      providerStats.set(provider, existing);
    });

    return Array.from(providerStats.values())
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 10)
      .map(provider => ({
        provider: provider.provider,
        requestCount: provider.requestCount,
        successCount: provider.successCount,
        errorCount: provider.errorCount,
        averageResponseTime: Math.round(provider.averageResponseTime),
        totalResponseTime: provider.totalResponseTime,
        totalLatency: provider.totalLatency
      }));
  }

  /**
   * Get slow endpoints
   */
  private async getSlowEndpointsMetrics(timeRange: { start: string; end: string }): Promise<SlowEndpoint[]> {
    const logs = await this.auditLogger.queryLogs({
      startTime: timeRange.start,
      endTime: timeRange.end,
      limit: 1000
    });

    const endpointStats = new Map<string, SlowEndpoint>();
    
    logs.forEach(log => {
      const key = `${log.route}:${log.method || 'GET'}`;
      const existing = endpointStats.get(key) || {
        route: log.route,
        method: log.method || 'GET',
        averageResponseTime: 0,
        requestCount: 0,
        responseTimes: [],
        p95ResponseTime: 0,
        p99ResponseTime: 0
      };

      existing.requestCount++;
      if (log.duration) {
        existing.responseTimes.push(log.duration);
        existing.averageResponseTime = existing.responseTimes.reduce((a, b) => a + b, 0) / existing.responseTimes.length;
        
        // Calculate percentiles
        const sorted = [...existing.responseTimes].sort((a, b) => a - b);
        existing.p95ResponseTime = sorted[Math.floor(sorted.length * 0.95)] || 0;
        existing.p99ResponseTime = sorted[Math.floor(sorted.length * 0.99)] || 0;
      }

      endpointStats.set(key, existing);
    });

    return Array.from(endpointStats.values())
      .sort((a, b) => b.averageResponseTime - a.averageResponseTime)
      .slice(0, 10)
      .map(endpoint => ({
        route: endpoint.route,
        method: endpoint.method,
        averageResponseTime: Math.round(endpoint.averageResponseTime),
        requestCount: endpoint.requestCount,
        responseTimes: endpoint.responseTimes,
        p95ResponseTime: Math.round(endpoint.p95ResponseTime),
        p99ResponseTime: Math.round(endpoint.p99ResponseTime)
      }));
  }

  /**
   * Get overall statistics
   */
  private async getOverallStats(timeRange: { start: string; end: string }): Promise<{
    totalRequests: number;
    successRate: number;
    averageResponseTime: number;
  }> {
    const logs = await this.auditLogger.queryLogs({
      startTime: timeRange.start,
      endTime: timeRange.end,
      limit: 1000
    });

    const totalRequests = logs.length;
    const successCount = logs.filter(log => log.status === 'success').length;
    const successRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 0;
    
    const responseTimes = logs
      .filter(log => log.duration)
      .map(log => log.duration);
    
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;

    return {
      totalRequests,
      successRate: Math.round(successRate * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime)
    };
  }

  /**
   * Extract provider name from route
   */
  private extractProviderFromRoute(route: string): string | null {
    // Simple extraction - could be enhanced
    if (route.includes('openai')) return 'OpenAI';
    if (route.includes('github')) return 'GitHub';
    if (route.includes('slack')) return 'Slack';
    if (route.includes('notion')) return 'Notion';
    if (route.includes('aws')) return 'AWS';
    return null;
  }

  /**
   * Track a new live request
   */
  trackLiveRequest(request: Omit<LiveRequest, 'id' | 'timestamp'>): string {
    const liveRequest: LiveRequest = {
      ...request,
      id: request.metadata.jti || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    };

    this.emit('newRequest', liveRequest);
    return liveRequest.id;
  }

  /**
   * Mark a request as completed
   */
  markRequestCompleted(requestId: string, response: any): void {
    this.emit('requestCompleted', requestId, response);
  }

  /**
   * Mark a request as failed
   */
  markRequestFailed(requestId: string, error: any): void {
    this.emit('requestFailed', requestId, error);
  }

  /**
   * Get live requests
   */
  getLiveRequests(): LiveRequest[] {
    return Array.from(this.liveRequests.values());
  }

  /**
   * Get cached metrics
   */
  getCachedMetrics(timeRange: string = '24h'): DashboardMetrics | null {
    return this.metricsCache.get(timeRange) || null;
  }

  /**
   * Clear old live requests
   */
  cleanupOldRequests(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    const cutoff = now - maxAgeMs;

    for (const [id, request] of this.liveRequests.entries()) {
      const requestTime = new Date(request.timestamp).getTime();
      if (requestTime < cutoff) {
        this.liveRequests.delete(id);
      }
    }
  }

  /**
   * Get real-time metrics for a specific time window
   */
  async getRealTimeMetrics(windowMs: number = 5 * 60 * 1000): Promise<{
    requestsPerMinute: number;
    successRate: number;
    averageResponseTime: number;
    activeAgents: number;
  }> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);
    
    const logs = await this.auditLogger.queryLogs({
      startTime: windowStart.toISOString(),
      endTime: now.toISOString(),
      limit: 1000
    });

    const requestsPerMinute = (logs.length / (windowMs / (60 * 1000)));
    const successCount = logs.filter(log => log.status === 'success').length;
    const successRate = logs.length > 0 ? (successCount / logs.length) * 100 : 0;
    
    const responseTimes = logs
      .filter(log => log.duration)
      .map(log => log.duration);
    
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;

    const activeAgents = new Set(logs.map(log => log.agent)).size;

    return {
      requestsPerMinute: Math.round(requestsPerMinute * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime),
      activeAgents
    };
  }

  /**
   * Export dashboard data
   */
  async exportDashboardData(timeRange: { start: string; end: string }, format: 'json' | 'csv'): Promise<string> {
    const metrics = await this.getMetrics(timeRange);
    
    if (format === 'csv') {
      return this.metricsToCSV(metrics);
    } else {
      return JSON.stringify(metrics, null, 2);
    }
  }

  /**
   * Convert metrics to CSV format
   */
  private metricsToCSV(metrics: DashboardMetrics): string {
    const lines = [
      'Metric,Timestamp,Value',
      `Total Requests,${metrics.timeRange.end},${metrics.totalRequests}`,
      `Success Rate,${metrics.timeRange.end},${metrics.successRate}%`,
      `Average Response Time,${metrics.timeRange.end},${metrics.averageResponseTime}ms`
    ];

    // Add time series data
    metrics.scopesIssued.forEach(point => {
      lines.push(`Scopes Issued,${point.timestamp},${point.value}`);
    });

    metrics.blockAllowRatio.forEach(point => {
      lines.push(`Success Rate,${point.timestamp},${point.value}%`);
    });

    // Add top agents
    metrics.topAgents.forEach((agent, index) => {
      lines.push(`Top Agent ${index + 1},${metrics.timeRange.end},${agent.agentName} (${agent.requestCount} requests)`);
    });

    return lines.join('\n');
  }
}
