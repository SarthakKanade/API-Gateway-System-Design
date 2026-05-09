/**
 * ═══════════════════════════════════════════════════════════════
 * Request Transformer Middleware — API Gateway
 * ═══════════════════════════════════════════════════════════════
 */

const { getClientIp } = require('../utils/helpers');

function requestTransformer(req, res, next) {
  req.headers['x-request-id'] = req.requestId;
  req.headers['x-forwarded-for'] = getClientIp(req);
  req.headers['x-forwarded-host'] = req.hostname;
  req.headers['x-gateway-timestamp'] = new Date().toISOString();

  if (req.user) {
    req.headers['x-user-id'] = req.user.id;
    req.headers['x-user-role'] = req.user.role;
    req.headers['x-user-name'] = req.user.username;
  }

  delete req.headers['x-api-key'];
  next();
}

module.exports = { requestTransformer };
