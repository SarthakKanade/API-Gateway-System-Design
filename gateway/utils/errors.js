/**
 * ═══════════════════════════════════════════════════════════════
 * Custom Error Classes — API Gateway
 * ═══════════════════════════════════════════════════════════════
 */

class GatewayError extends Error {
  constructor(message, statusCode = 500, code = 'GATEWAY_ERROR') {
    super(message);
    this.name = 'GatewayError';
    this.statusCode = statusCode;
    this.code = code;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        timestamp: this.timestamp,
      },
    };
  }
}

class AuthenticationError extends GatewayError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTH_REQUIRED');
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends GatewayError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'AuthorizationError';
  }
}

class RateLimitError extends GatewayError {
  constructor(retryAfter = 60) {
    super('Rate limit exceeded. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

class ServiceUnavailableError extends GatewayError {
  constructor(serviceName = 'backend') {
    super(`Service "${serviceName}" is currently unavailable`, 503, 'SERVICE_UNAVAILABLE');
    this.name = 'ServiceUnavailableError';
    this.serviceName = serviceName;
  }
}

class ValidationError extends GatewayError {
  constructor(message = 'Invalid request', details = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.details = details;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: this.timestamp,
      },
    };
  }
}

class RouteNotFoundError extends GatewayError {
  constructor(path) {
    super(`No service found for path: ${path}`, 404, 'ROUTE_NOT_FOUND');
    this.name = 'RouteNotFoundError';
  }
}

module.exports = {
  GatewayError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  ServiceUnavailableError,
  ValidationError,
  RouteNotFoundError,
};
