/**
 * ═══════════════════════════════════════════════════════════════
 * Routing Engine — API Gateway
 * ═══════════════════════════════════════════════════════════════
 * Dynamic path matching, path rewriting, service health checks.
 */

const { matchRoute, routes } = require('../config/routes');

/**
 * Resolve a request path to its target backend service.
 * @param {string} path
 * @returns {object|null} { target, serviceName, rewrittenPath, timeout }
 */
function resolveRoute(path) {
  const route = matchRoute(path);
  if (!route) return null;

  // Apply path rewriting
  let rewrittenPath = path;
  if (route.pathRewrite) {
    for (const [pattern, replacement] of Object.entries(route.pathRewrite)) {
      rewrittenPath = rewrittenPath.replace(new RegExp(pattern), replacement);
    }
  }

  return {
    target: route.target,
    serviceName: route.serviceName,
    rewrittenPath,
    timeout: route.timeout || 5000,
    methods: route.methods,
  };
}

/**
 * Get all registered service routes (for dashboard).
 * @returns {Array}
 */
function getServiceRoutes() {
  return routes.map((r) => ({
    prefix: r.prefix,
    target: r.target,
    serviceName: r.serviceName,
    authRequired: r.auth?.required || false,
    methods: r.methods,
    rateLimit: r.rateLimit,
  }));
}

module.exports = { resolveRoute, getServiceRoutes };
