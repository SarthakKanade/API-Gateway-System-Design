/**
 * ═══════════════════════════════════════════════════════════════
 * Centralized Logger & Metrics — API Gateway
 * ═══════════════════════════════════════════════════════════════
 * Structured JSON logging for every request/response.
 * Aggregates real-time metrics for the monitoring dashboard.
 */

const { generateRequestId, getClientIp, now } = require('../utils/helpers');
const settings = require('../config/settings');

// ── In-Memory Stores ───────────────────────────────
const requestLogs = [];
const metrics = {
  totalRequests: 0,
  totalSuccess: 0,
  totalErrors: 0,
  totalLatency: 0,
  statusCodes: {},
  pathHits: {},
  requestsPerSecond: [],    // rolling 60-second window
  activeRequests: 0,
  startTime: Date.now(),
  serviceHealth: {},
};

// Track requests-per-second in a rolling 60s window
setInterval(() => {
  const entry = {
    timestamp: Date.now(),
    count: metrics.totalRequests,
  };
  metrics.requestsPerSecond.push(entry);
  // Keep only last 120 entries (~2 min of data)
  if (metrics.requestsPerSecond.length > 120) {
    metrics.requestsPerSecond.shift();
  }
}, 1000);

/**
 * Express middleware — attaches request ID, logs request + response.
 */
function loggerMiddleware(req, res, next) {
  // Attach unique request ID
  req.requestId = req.headers['x-request-id'] || generateRequestId();
  req.startTime = now();

  metrics.activeRequests++;

  // Capture response finish
  const originalEnd = res.end;
  res.end = function (chunk, encoding) {
    res.end = originalEnd;
    res.end(chunk, encoding);

    const latency = now() - req.startTime;
    metrics.activeRequests--;
    metrics.totalRequests++;
    metrics.totalLatency += latency;

    if (res.statusCode >= 200 && res.statusCode < 400) {
      metrics.totalSuccess++;
    } else {
      metrics.totalErrors++;
    }

    // Track status codes
    const code = res.statusCode.toString();
    metrics.statusCodes[code] = (metrics.statusCodes[code] || 0) + 1;

    // Track path hits
    const basePath = req.originalUrl.split('?')[0];
    metrics.pathHits[basePath] = (metrics.pathHits[basePath] || 0) + 1;

    // Build log entry
    const logEntry = {
      id: req.requestId,
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      latency,
      ip: getClientIp(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      user: req.user ? req.user.username : 'anonymous',
      service: req.targetService || 'gateway',
      contentLength: res.getHeader('content-length') || 0,
    };

    requestLogs.unshift(logEntry);

    // Cap log buffer
    if (requestLogs.length > settings.logging.maxEntries) {
      requestLogs.pop();
    }

    // Console output (colored)
    const color = res.statusCode >= 500 ? '\x1b[31m' :
                  res.statusCode >= 400 ? '\x1b[33m' :
                  res.statusCode >= 300 ? '\x1b[36m' : '\x1b[32m';
    const reset = '\x1b[0m';

    console.log(
      `${color}${req.method.padEnd(7)}${reset} ${req.originalUrl.padEnd(40)} ` +
      `${color}${res.statusCode}${reset}  ${latency}ms  ${logEntry.user}`
    );
  };

  // Set request ID in response headers
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

/**
 * Get aggregated metrics for the dashboard.
 */
function getMetrics() {
  const uptime = Date.now() - metrics.startTime;
  const avgLatency = metrics.totalRequests > 0
    ? Math.round(metrics.totalLatency / metrics.totalRequests)
    : 0;
  const successRate = metrics.totalRequests > 0
    ? ((metrics.totalSuccess / metrics.totalRequests) * 100).toFixed(1)
    : '100.0';

  // Calculate current RPS from the rolling window
  const recentEntries = metrics.requestsPerSecond.slice(-5);
  let currentRps = 0;
  if (recentEntries.length >= 2) {
    const first = recentEntries[0];
    const last = recentEntries[recentEntries.length - 1];
    const timeDiff = (last.timestamp - first.timestamp) / 1000;
    const countDiff = last.count - first.count;
    currentRps = timeDiff > 0 ? (countDiff / timeDiff).toFixed(1) : 0;
  }

  // Build throughput chart data (requests in each second)
  const throughput = [];
  for (let i = 1; i < metrics.requestsPerSecond.length; i++) {
    throughput.push({
      time: metrics.requestsPerSecond[i].timestamp,
      count: metrics.requestsPerSecond[i].count - metrics.requestsPerSecond[i - 1].count,
    });
  }

  return {
    uptime,
    totalRequests: metrics.totalRequests,
    totalSuccess: metrics.totalSuccess,
    totalErrors: metrics.totalErrors,
    avgLatency,
    successRate: parseFloat(successRate),
    currentRps: parseFloat(currentRps),
    statusCodes: { ...metrics.statusCodes },
    topPaths: Object.entries(metrics.pathHits)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => ({ path, count })),
    activeRequests: metrics.activeRequests,
    serviceHealth: { ...metrics.serviceHealth },
    throughput: throughput.slice(-60), // last 60 data points
  };
}

/**
 * Get recent log entries.
 */
function getLogs(count = 50) {
  return requestLogs.slice(0, count);
}

/**
 * Update service health status.
 */
function updateServiceHealth(serviceName, status) {
  metrics.serviceHealth[serviceName] = {
    status,
    lastCheck: Date.now(),
  };
}

module.exports = {
  loggerMiddleware,
  getMetrics,
  getLogs,
  updateServiceHealth,
  metrics,
};
