/**
 * ═══════════════════════════════════════════════════════════════
 * Authentication Service — API Gateway
 * ═══════════════════════════════════════════════════════════════
 * Handles user registration, login, JWT generation, and API keys.
 * Uses an in-memory user store (simulates a database).
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const settings = require('../config/settings');

// ── In-Memory User Store (simulates DB) ────────────
const users = new Map();
const apiKeys = new Map();

// Pre-seed an admin user
(async () => {
  const hash = await bcrypt.hash('admin123', 10);
  const adminUser = {
    id: uuidv4(),
    username: 'admin',
    password: hash,
    role: 'admin',
    apiKey: `gw_${uuidv4().replace(/-/g, '')}`,
    createdAt: new Date().toISOString(),
  };
  users.set(adminUser.username, adminUser);
  apiKeys.set(adminUser.apiKey, adminUser);
  console.log(`  🔐 Admin API Key: ${adminUser.apiKey}`);
})();

/**
 * Register a new user.
 * @param {string} username
 * @param {string} password
 * @param {string} role - 'admin' | 'user'
 * @returns {object} The created user (sans password)
 */
async function registerUser(username, password, role = 'user') {
  if (users.has(username)) {
    const err = new Error('Username already exists');
    err.statusCode = 409;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = {
    id: uuidv4(),
    username,
    password: hashedPassword,
    role,
    apiKey: `gw_${uuidv4().replace(/-/g, '')}`,
    createdAt: new Date().toISOString(),
  };

  users.set(username, user);
  apiKeys.set(user.apiKey, user);

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    apiKey: user.apiKey,
    createdAt: user.createdAt,
  };
}

/**
 * Authenticate user and return JWT tokens.
 * @param {string} username
 * @param {string} password
 * @returns {object} { accessToken, refreshToken, user }
 */
async function loginUser(username, password) {
  const user = users.get(username);
  if (!user) {
    const err = new Error('Invalid credentials');
    err.statusCode = 401;
    throw err;
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    const err = new Error('Invalid credentials');
    err.statusCode = 401;
    throw err;
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return {
    accessToken,
    refreshToken,
    expiresIn: settings.jwt.expiry,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  };
}

/**
 * Refresh an expired access token.
 * @param {string} refreshToken
 * @returns {object} { accessToken, expiresIn }
 */
function refreshAccessToken(refreshToken) {
  try {
    const decoded = jwt.verify(refreshToken, settings.jwt.refreshSecret);
    const user = users.get(decoded.username);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 401;
      throw err;
    }

    const accessToken = generateAccessToken(user);
    return { accessToken, expiresIn: settings.jwt.expiry };
  } catch (err) {
    if (err.statusCode) throw err;
    const error = new Error('Invalid or expired refresh token');
    error.statusCode = 401;
    throw error;
  }
}

/**
 * Verify a JWT access token.
 * @param {string} token
 * @returns {object} Decoded token payload
 */
function verifyAccessToken(token) {
  return jwt.verify(token, settings.jwt.secret);
}

/**
 * Verify an API key.
 * @param {string} key
 * @returns {object|null} User associated with the key
 */
function verifyApiKey(key) {
  return apiKeys.get(key) || null;
}

// ── Internal Token Generators ──────────────────────

function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    settings.jwt.secret,
    { expiresIn: settings.jwt.expiry }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
    },
    settings.jwt.refreshSecret,
    { expiresIn: settings.jwt.refreshExpiry }
  );
}

module.exports = {
  registerUser,
  loginUser,
  refreshAccessToken,
  verifyAccessToken,
  verifyApiKey,
};
