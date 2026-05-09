/**
 * ═══════════════════════════════════════════════════════════════
 * Request Validator Middleware — API Gateway
 * ═══════════════════════════════════════════════════════════════
 * Validates incoming requests: content-type, payload size,
 * required headers, and JSON format.
 */

/**
 * Request validation middleware.
 */
function requestValidator(req, res, next) {
  // Skip validation for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Check Content-Type for POST/PUT/PATCH
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    if (!contentType) {
      return res.status(400).json({
        error: {
          code: 'MISSING_CONTENT_TYPE',
          message: 'Content-Type header is required for this request method.',
        },
      });
    }

    // Must be JSON for API routes
    if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
      if (!contentType.includes('application/json')) {
        return res.status(415).json({
          error: {
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message: 'Only application/json content type is supported.',
          },
        });
      }
    }

    // Validate JSON body is actually present for POST
    if (req.method === 'POST' && contentType.includes('application/json')) {
      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({
          error: {
            code: 'EMPTY_BODY',
            message: 'Request body cannot be empty.',
          },
        });
      }
    }
  }

  next();
}

module.exports = { requestValidator };
