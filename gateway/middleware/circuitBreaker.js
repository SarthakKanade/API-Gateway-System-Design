/**
 * ═══════════════════════════════════════════════════════════════
 * Circuit Breaker Middleware — API Gateway
 * ═══════════════════════════════════════════════════════════════
 * States: CLOSED → OPEN → HALF_OPEN
 * Prevents cascading failures to backend services.
 */

const settings = require('../config/settings');
const { updateServiceHealth } = require('./logger');

const STATES = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };

// Per-service circuit breaker state
const circuits = new Map();

function getCircuit(serviceName) {
  if (!circuits.has(serviceName)) {
    circuits.set(serviceName, {
      state: STATES.CLOSED,
      failures: 0,
      lastFailure: null,
      nextRetry: null,
    });
  }
  return circuits.get(serviceName);
}

function circuitBreakerMiddleware(req, res, next) {
  if (!req.targetService) return next();

  const circuit = getCircuit(req.targetService);
  const now = Date.now();

  if (circuit.state === STATES.OPEN) {
    if (now >= circuit.nextRetry) {
      circuit.state = STATES.HALF_OPEN;
      updateServiceHealth(req.targetService, 'half_open');
      return next(); // Allow one probe request
    }
    updateServiceHealth(req.targetService, 'down');
    return res.status(503).json({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: `Service "${req.targetService}" is temporarily unavailable.`,
        retryAfter: Math.ceil((circuit.nextRetry - now) / 1000),
      },
    });
  }

  next();
}

function recordSuccess(serviceName) {
  const circuit = getCircuit(serviceName);
  circuit.failures = 0;
  circuit.state = STATES.CLOSED;
  updateServiceHealth(serviceName, 'healthy');
}

function recordFailure(serviceName) {
  const circuit = getCircuit(serviceName);
  circuit.failures++;
  circuit.lastFailure = Date.now();

  if (circuit.failures >= settings.circuitBreaker.failureThreshold) {
    circuit.state = STATES.OPEN;
    circuit.nextRetry = Date.now() + settings.circuitBreaker.resetTimeoutMs;
    updateServiceHealth(serviceName, 'down');
    console.log(`\x1b[31m  ⚡ Circuit OPEN for ${serviceName} (${circuit.failures} failures)\x1b[0m`);
  }
}

function getCircuitStates() {
  const result = {};
  for (const [name, circuit] of circuits.entries()) {
    result[name] = { ...circuit };
  }
  return result;
}

module.exports = { circuitBreakerMiddleware, recordSuccess, recordFailure, getCircuitStates, STATES };
