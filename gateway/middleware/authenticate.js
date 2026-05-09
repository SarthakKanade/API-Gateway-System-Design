/**
 * ═══════════════════════════════════════════════════════════════
 * Authentication Middleware — API Gateway
 * ═══════════════════════════════════════════════════════════════
 * Validates JWT Bearer tokens and API keys.
 * Supports role-based access control (RBAC).
 * Skips auth for whitelisted public routes.
 */

const { isPublicPath, matchRoute } = require('../config/routes');
const authService = require('../services/authService');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');

/**
 * Authentication middleware.
 * Checks for JWT token or API key and validates permissions.
 */
function authenticate(req, res, next) {
  try {
    // Skip auth for public paths
    if (isPublicPath(req.path)) {
      return next();
    }

    // Try JWT Bearer Token first
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = authService.verifyAccessToken(token);
        req.user = decoded;
        return checkPermissions(req, res, next);
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({
            error: {
              code: 'TOKEN_EXPIRED',
              message: 'Access token has expired. Use /auth/refresh to get a new one.',
            },
          });
        }
        return res.status(401).json({
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or malformed access token.',
          },
        });
      }
    }

    // Try API Key
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
      const user = authService.verifyApiKey(apiKey);
      if (user) {
        req.user = {
          id: user.id,
          username: user.username,
          role: user.role,
        };
        return checkPermissions(req, res, next);
      }
      return res.status(401).json({
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid API key.',
        },
      });
    }

    // No credentials provided
    return res.status(401).json({
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication required. Provide a Bearer token or X-API-Key header.',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Check if the authenticated user has permission for this route.
 */
function checkPermissions(req, res, next) {
  const route = matchRoute(req.path);

  // If route has role requirements, check them
  if (route && route.auth && route.auth.roles) {
    const userRole = req.user.role;
    if (!route.auth.roles.includes(userRole)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Role "${userRole}" does not have access to this resource.`,
          requiredRoles: route.auth.roles,
        },
      });
    }
  }

  next();
}

module.exports = { authenticate };
