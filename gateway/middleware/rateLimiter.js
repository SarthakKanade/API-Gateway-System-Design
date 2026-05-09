/**
 * ═══════════════════════════════════════════════════════════════
 * Rate Limiter Middleware — API Gateway
 * ═══════════════════════════════════════════════════════════════
 * Sliding window rate limiting with tiered limits per user role.
 * Tracks by user ID (authenticated) or IP (anonymous).
 * Returns standard rate-limit headers.
 */

const settings = require('../config/settings');
const { getClientIp } = require('../utils/helpers');
const { matchRoute } = require('../config/routes');

// ── In-Memory Sliding Window Store ─────────────────
const requestStore = new Map();

// Cleanup expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of requestStore.entries()) {
    // Remove entries with no recent requests
    data.timestamps = data.timestamps.filter((t) => now - t < data.windowMs);
    if (data.timestamps.length === 0) {
      requestStore.delete(key);
    }
  }
}, 60000);

/**
 * Rate limiting middleware.
 * Uses sliding window algorithm with tiered limits.
 */
function rateLimiter(req, res, next) {
  // Skip rate limiting for certain paths
  const skipPaths = ['/health', '/dashboard', '/gateway/metrics', '/gateway/logs', '/gateway/services'];
  if (skipPaths.some((p) => req.path.startsWith(p))) {
    return next();
  }

  const now = Date.now();

  // Determine the client identifier
  const clientId = req.user
    ? `user:${req.user.id}`
    : `ip:${getClientIp(req)}`;

  // Determine rate limit based on user role and route config
  const role = req.user ? req.user.role : 'anonymous';
  const route = matchRoute(req.path);

  let maxRequests = settings.rateLimit.tiers[role] || settings.rateLimit.maxRequests;
  let windowMs = settings.rateLimit.windowMs;

  // Per-route override
  if (route && route.rateLimit) {
    maxRequests = route.rateLimit.maxRequests || maxRequests;
    windowMs = route.rateLimit.windowMs || windowMs;
  }

  // Get or create the client's request record
  if (!requestStore.has(clientId)) {
    requestStore.set(clientId, {
      timestamps: [],
      windowMs,
    });
  }

  const record = requestStore.get(clientId);
  record.windowMs = windowMs;

  // Remove timestamps outside the window
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

  // Check the limit
  const remaining = maxRequests - record.timestamps.length;
  const resetTime = record.timestamps.length > 0
    ? new Date(record.timestamps[0] + windowMs)
    : new Date(now + windowMs);

  // Set rate limit headers on every response
  res.setHeader('X-RateLimit-Limit', maxRequests);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining - 1));
  res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime.getTime() / 1000));

  if (remaining <= 0) {
    const retryAfter = Math.ceil((record.timestamps[0] + windowMs - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        retryAfter,
        limit: maxRequests,
        windowMs,
      },
    });
  }

  // Record this request
  record.timestamps.push(now);

  next();
}

/**
 * Get rate limit status for a specific client.
 * @param {string} clientId
 * @returns {object}
 */
function getRateLimitStatus(clientId) {
  const record = requestStore.get(clientId);
  if (!record) {
    return { used: 0, remaining: 'unlimited', window: 0 };
  }
  const now = Date.now();
  const validTimestamps = record.timestamps.filter((t) => now - t < record.windowMs);
  return {
    used: validTimestamps.length,
    windowMs: record.windowMs,
    oldestRequest: validTimestamps[0] || null,
  };
}

/**
 * Get all active rate limit entries (for monitoring).
 * @returns {Array}
 */
function getAllRateLimits() {
  const now = Date.now();
  const entries = [];
  for (const [key, data] of requestStore.entries()) {
    const valid = data.timestamps.filter((t) => now - t < data.windowMs);
    if (valid.length > 0) {
      entries.push({
        clientId: key,
        requestCount: valid.length,
        windowMs: data.windowMs,
      });
    }
  }
  return entries;
}

module.exports = { rateLimiter, getRateLimitStatus, getAllRateLimits };
