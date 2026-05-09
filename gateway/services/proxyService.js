/**
 * ═══════════════════════════════════════════════════════════════
 * Proxy Service — API Gateway
 * ═══════════════════════════════════════════════════════════════
 * Forwards requests to backend microservices using http-proxy-middleware.
 */

const { createProxyMiddleware } = require('http-proxy-middleware');
const { routes } = require('../config/routes');
const { recordSuccess, recordFailure } = require('../middleware/circuitBreaker');

/**
 * Create proxy middleware instances for all registered routes.
 * @returns {Map<string, Function>} Map of prefix → proxy middleware
 */
function createProxies() {
  const proxies = new Map();

  for (const route of routes) {
    const proxy = createProxyMiddleware({
      target: route.target,
      changeOrigin: true,
      pathRewrite: route.pathRewrite || {},
      timeout: route.timeout || 5000,
      proxyTimeout: route.timeout || 5000,

      on: {
        proxyReq: (proxyReq, req) => {
          // If body was parsed by express.json(), re-stream it
          if (req.body && Object.keys(req.body).length > 0) {
            const bodyData = JSON.stringify(req.body);
            proxyReq.setHeader('Content-Type', 'application/json');
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
            proxyReq.write(bodyData);
          }
        },
        proxyRes: (proxyRes, req) => {
          recordSuccess(route.serviceName);
        },
        error: (err, req, res) => {
          recordFailure(route.serviceName);
          console.error(`\x1b[31m  ✗ Proxy error [${route.serviceName}]: ${err.message}\x1b[0m`);

          if (!res.headersSent) {
            res.status(502).json({
              error: {
                code: 'BAD_GATEWAY',
                message: `Failed to reach ${route.serviceName}: ${err.message}`,
                service: route.serviceName,
              },
            });
          }
        },
      },
    });

    proxies.set(route.prefix, proxy);
  }

  return proxies;
}

module.exports = { createProxies };
