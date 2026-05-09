/**
 * ═══════════════════════════════════════════════════════════════
 * Centralized Configuration — API Gateway
 * ═══════════════════════════════════════════════════════════════
 * All settings derived from environment variables with defaults.
 */

require('dotenv').config();

const settings = {
  // ── Gateway ──────────────────────────────────────
  gateway: {
    port: parseInt(process.env.GATEWAY_PORT, 10) || 3000,
    env: process.env.NODE_ENV || 'development',
  },

  // ── JWT ──────────────────────────────────────────
  jwt: {
    secret: process.env.JWT_SECRET || 'default_jwt_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default_refresh_secret',
    expiry: process.env.JWT_EXPIRY || '1h',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  // ── Rate Limiting ────────────────────────────────
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 min
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    store: process.env.RATE_LIMIT_STORE || 'memory', // 'memory' | 'redis'
    tiers: {
      admin: 500,
      user: 100,
      anonymous: 30,
    },
  },

  // ── Redis ────────────────────────────────────────
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  },

  // ── Backend Services ─────────────────────────────
  services: {
    user: process.env.USER_SERVICE_URL || 'http://localhost:4001',
    order: process.env.ORDER_SERVICE_URL || 'http://localhost:4002',
    payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:4003',
  },

  // ── Logging ──────────────────────────────────────
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    maxEntries: parseInt(process.env.LOG_MAX_ENTRIES, 10) || 1000,
  },

  // ── Circuit Breaker ──────────────────────────────
  circuitBreaker: {
    failureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD, 10) || 5,
    resetTimeoutMs: parseInt(process.env.CB_RESET_TIMEOUT_MS, 10) || 30000,
  },

  // ── Request Limits ───────────────────────────────
  request: {
    maxBodySize: '1mb',
    timeoutMs: 5000,
  },
};

module.exports = settings;
