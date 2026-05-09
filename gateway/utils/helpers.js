/**
 * ═══════════════════════════════════════════════════════════════
 * Utility Helpers — API Gateway
 * ═══════════════════════════════════════════════════════════════
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Generate a unique request ID for tracing.
 * @returns {string} UUID v4
 */
function generateRequestId() {
  return uuidv4();
}

/**
 * Extract the client IP from the request.
 * Handles proxied requests (X-Forwarded-For).
 * @param {import('express').Request} req
 * @returns {string}
 */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Get the current high-resolution timestamp in milliseconds.
 * @returns {number}
 */
function now() {
  return Date.now();
}

/**
 * Format bytes to a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format milliseconds to a human-readable duration.
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Mask sensitive data in objects for logging.
 * @param {object} obj - The object to mask
 * @param {string[]} keys - Keys to mask
 * @returns {object}
 */
function maskSensitiveData(obj, keys = ['password', 'token', 'secret', 'apiKey']) {
  if (!obj || typeof obj !== 'object') return obj;
  const masked = { ...obj };
  for (const key of Object.keys(masked)) {
    if (keys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      masked[key] = '***REDACTED***';
    } else if (typeof masked[key] === 'object') {
      masked[key] = maskSensitiveData(masked[key], keys);
    }
  }
  return masked;
}

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  generateRequestId,
  getClientIp,
  now,
  formatBytes,
  formatDuration,
  maskSensitiveData,
  sleep,
};
