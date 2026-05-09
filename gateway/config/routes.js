/**
 * ═══════════════════════════════════════════════════════════════
 * Route Definitions — API Gateway
 * ═══════════════════════════════════════════════════════════════
 * Maps incoming request paths to backend microservices.
 * Each route can specify auth requirements, rate limit overrides,
 * and allowed HTTP methods.
 */

const settings = require('./settings');

const routes = [
  // ── User Service ─────────────────────────────────
  {
    prefix: '/api/users',
    target: settings.services.user,
    serviceName: 'user-service',
    pathRewrite: { '^/api/users': '' },
    auth: {
      required: true,
      roles: ['admin', 'user'],
    },
    rateLimit: null, // use default
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    timeout: 5000,
  },

  // ── Order Service ────────────────────────────────
  {
    prefix: '/api/orders',
    target: settings.services.order,
    serviceName: 'order-service',
    pathRewrite: { '^/api/orders': '' },
    auth: {
      required: true,
      roles: ['admin', 'user'],
    },
    rateLimit: {
      maxRequests: 50,
      windowMs: 900000,
    },
    methods: ['GET', 'POST', 'PUT'],
    timeout: 5000,
  },

  // ── Payment Service ──────────────────────────────
  {
    prefix: '/api/payments',
    target: settings.services.payment,
    serviceName: 'payment-service',
    pathRewrite: { '^/api/payments': '' },
    auth: {
      required: true,
      roles: ['admin', 'user'],
    },
    rateLimit: {
      maxRequests: 20,
      windowMs: 900000,
    },
    methods: ['GET', 'POST'],
    timeout: 10000, // payments need longer timeout
  },
];

// ── Public Routes (no auth needed) ─────────────────
const publicPaths = [
  '/auth/register',
  '/auth/login',
  '/auth/refresh',
  '/health',
  '/gateway/metrics',
  '/gateway/logs',
  '/gateway/services',
  '/dashboard',
];

/**
 * Find the matching route config for a given request path.
 * @param {string} path - The incoming request path
 * @returns {object|null} The matched route config or null
 */
function matchRoute(path) {
  return routes.find((route) => path.startsWith(route.prefix)) || null;
}

/**
 * Check if a path is public (no auth required).
 * @param {string} path - The incoming request path
 * @returns {boolean}
 */
function isPublicPath(path) {
  return publicPaths.some((pp) => path.startsWith(pp));
}

module.exports = { routes, publicPaths, matchRoute, isPublicPath };
