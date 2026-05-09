/**
 * ═══════════════════════════════════════════════════════════════
 *    ___   ___  ___    ___   ___  _____ ___ _ _ _  ___  _  _
 *   / _ \ | _ \|_ _|  / __| / _ \|_   _| __| | | |/ _ \| \| |
 *  | (_) ||  _/ | |  | (_ || (_) | | | | _|| V V | (_) | .` |
 *   \___/ |_|  |___|  \___| \___/  |_| |___|\_/\_/ \___/|_|\_|
 *
 *  API Gateway — Problem Statement 26
 *  Microservices Architecture & Backend Infrastructure
 * ═══════════════════════════════════════════════════════════════
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const settings = require('./config/settings');
const { routes, matchRoute, isPublicPath } = require('./config/routes');

// ── Middleware ──────────────────────────────────────
const { loggerMiddleware, getMetrics, getLogs } = require('./middleware/logger');
const { authenticate } = require('./middleware/authenticate');
const { rateLimiter } = require('./middleware/rateLimiter');
const { requestValidator } = require('./middleware/requestValidator');
const { requestTransformer } = require('./middleware/requestTransformer');
const { circuitBreakerMiddleware, getCircuitStates } = require('./middleware/circuitBreaker');

// ── Services ───────────────────────────────────────
const authService = require('./services/authService');
const { getServiceRoutes } = require('./services/routingEngine');
const { createProxies } = require('./services/proxyService');

// ── Boot Microservices (for single-command startup) ─
require('../microservices/userService');
require('../microservices/orderService');
require('../microservices/paymentService');

// ════════════════════════════════════════════════════
// Express Application
// ════════════════════════════════════════════════════
const app = express();

// ── Global Middleware ──────────────────────────────
app.use(cors());
app.use(express.json({ limit: settings.request.maxBodySize }));
app.use(express.urlencoded({ extended: true }));

// Serve monitoring dashboard static files
app.use('/dashboard', express.static(path.join(__dirname, '..', 'dashboard')));

// ── Logging (first in pipeline) ────────────────────
app.use(loggerMiddleware);

// ════════════════════════════════════════════════════
// Gateway Endpoints (no auth required)
// ════════════════════════════════════════════════════

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: getServiceRoutes().map(s => s.serviceName),
  });
});

// Metrics endpoint (for dashboard)
app.get('/gateway/metrics', (req, res) => {
  res.json(getMetrics());
});

// Recent logs endpoint (for dashboard)
app.get('/gateway/logs', (req, res) => {
  const count = parseInt(req.query.count) || 50;
  res.json(getLogs(count));
});

// Service routes info
app.get('/gateway/services', (req, res) => {
  res.json({
    routes: getServiceRoutes(),
    circuitBreakers: getCircuitStates(),
  });
});

// ════════════════════════════════════════════════════
// Authentication Endpoints
// ════════════════════════════════════════════════════

app.post('/auth/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Username and password are required.' } });
    }
    const user = await authService.registerUser(username, password, role);
    res.status(201).json({ message: 'User registered successfully', data: user });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: { message: err.message } });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Username and password are required.' } });
    }
    const result = await authService.loginUser(username, password);
    res.json({ message: 'Login successful', data: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: { message: err.message } });
  }
});

app.post('/auth/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Refresh token is required.' } });
    }
    const result = authService.refreshAccessToken(refreshToken);
    res.json({ message: 'Token refreshed', data: result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: { message: err.message } });
  }
});

// ════════════════════════════════════════════════════
// API Proxy Routes (auth + rate limit + circuit breaker)
// ════════════════════════════════════════════════════

// Create proxy instances for all backend services
const proxies = createProxies();

// Apply middleware pipeline for all /api/* routes
app.use('/api/*', authenticate, rateLimiter, requestValidator, requestTransformer);

// Attach target service info and circuit breaker before proxy
for (const route of routes) {
  app.use(route.prefix, (req, res, next) => {
    req.targetService = route.serviceName;
    next();
  }, circuitBreakerMiddleware, proxies.get(route.prefix));
}

// ════════════════════════════════════════════════════
// Error Handling
// ════════════════════════════════════════════════════

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found. Check /gateway/services for available routes.`,
    },
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(`\x1b[31m  ✗ Error: ${err.message}\x1b[0m`);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An unexpected error occurred.',
    },
  });
});

// ════════════════════════════════════════════════════
// Start Server
// ════════════════════════════════════════════════════

const PORT = settings.gateway.port;

app.listen(PORT, () => {
  console.log('\n');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║                                                      ║');
  console.log('  ║          🚀  API GATEWAY — System Design 26          ║');
  console.log('  ║                                                      ║');
  console.log('  ╠══════════════════════════════════════════════════════╣');
  console.log(`  ║  Gateway:     http://localhost:${PORT}                  ║`);
  console.log(`  ║  Dashboard:   http://localhost:${PORT}/dashboard        ║`);
  console.log(`  ║  Health:      http://localhost:${PORT}/health           ║`);
  console.log('  ║                                                      ║');
  console.log('  ║  Services:                                           ║');
  console.log('  ║    👤 Users    → /api/users    → :4001               ║');
  console.log('  ║    📦 Orders   → /api/orders   → :4002               ║');
  console.log('  ║    💳 Payments → /api/payments → :4003               ║');
  console.log('  ║                                                      ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log('\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n  ⏹  Shutting down API Gateway...');
  process.exit(0);
});

module.exports = app;
