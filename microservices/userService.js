/**
 * ═══════════════════════════════════════════════════════════════
 * Mock User Service — Port 4001
 * ═══════════════════════════════════════════════════════════════
 * CRUD operations for users with simulated latency.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const app = express();
app.use(express.json());

// In-memory user store
const users = [
  { id: '1', name: 'Alice Johnson', email: 'alice@example.com', department: 'Engineering', status: 'active' },
  { id: '2', name: 'Bob Smith', email: 'bob@example.com', department: 'Marketing', status: 'active' },
  { id: '3', name: 'Charlie Brown', email: 'charlie@example.com', department: 'Sales', status: 'inactive' },
  { id: '4', name: 'Diana Prince', email: 'diana@example.com', department: 'Engineering', status: 'active' },
  { id: '5', name: 'Eve Wilson', email: 'eve@example.com', department: 'HR', status: 'active' },
];

// Simulate latency (50-200ms)
const delay = () => new Promise(r => setTimeout(r, 50 + Math.random() * 150));

app.get('/', async (req, res) => {
  await delay();
  res.json({ service: 'user-service', data: users, total: users.length, requestedBy: req.headers['x-user-name'] || 'unknown' });
});

app.get('/:id', async (req, res) => {
  await delay();
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ service: 'user-service', data: user });
});

app.post('/', async (req, res) => {
  await delay();
  const user = { id: uuidv4(), ...req.body, status: 'active', createdAt: new Date().toISOString() };
  users.push(user);
  res.status(201).json({ service: 'user-service', data: user, message: 'User created' });
});

app.put('/:id', async (req, res) => {
  await delay();
  const idx = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  users[idx] = { ...users[idx], ...req.body };
  res.json({ service: 'user-service', data: users[idx], message: 'User updated' });
});

app.delete('/:id', async (req, res) => {
  await delay();
  const idx = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  const deleted = users.splice(idx, 1);
  res.json({ service: 'user-service', data: deleted[0], message: 'User deleted' });
});

const PORT = 4001;
app.listen(PORT, () => console.log(`  👤 User Service running on port ${PORT}`));
module.exports = app;
