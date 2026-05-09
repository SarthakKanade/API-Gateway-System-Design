/**
 * ═══════════════════════════════════════════════════════════════
 * Mock Order Service — Port 4002
 * ═══════════════════════════════════════════════════════════════
 * Order management with random failure simulation for circuit breaker testing.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const app = express();
app.use(express.json());

const orders = [
  { id: 'ORD-001', userId: '1', items: ['Widget A', 'Widget B'], total: 59.99, status: 'delivered', createdAt: '2026-05-01T10:00:00Z' },
  { id: 'ORD-002', userId: '2', items: ['Gadget X'], total: 129.99, status: 'shipped', createdAt: '2026-05-03T14:30:00Z' },
  { id: 'ORD-003', userId: '1', items: ['Part Z', 'Part Y', 'Part W'], total: 249.50, status: 'processing', createdAt: '2026-05-05T09:15:00Z' },
  { id: 'ORD-004', userId: '4', items: ['Premium Kit'], total: 499.00, status: 'pending', createdAt: '2026-05-08T16:45:00Z' },
];

const delay = () => new Promise(r => setTimeout(r, 50 + Math.random() * 150));

// 10% random failure for circuit breaker testing
const mayFail = (req, res, next) => {
  if (Math.random() < 0.1) {
    return res.status(500).json({ error: 'Internal server error (simulated failure)' });
  }
  next();
};

app.get('/', mayFail, async (req, res) => {
  await delay();
  res.json({ service: 'order-service', data: orders, total: orders.length });
});

app.get('/:id', mayFail, async (req, res) => {
  await delay();
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ service: 'order-service', data: order });
});

app.post('/', mayFail, async (req, res) => {
  await delay();
  const order = {
    id: `ORD-${String(orders.length + 1).padStart(3, '0')}`,
    userId: req.headers['x-user-id'] || 'unknown',
    ...req.body,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  orders.push(order);
  res.status(201).json({ service: 'order-service', data: order, message: 'Order created' });
});

app.put('/:id/status', async (req, res) => {
  await delay();
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  order.status = req.body.status || order.status;
  res.json({ service: 'order-service', data: order, message: 'Order status updated' });
});

const PORT = 4002;
app.listen(PORT, () => console.log(`  📦 Order Service running on port ${PORT}`));
module.exports = app;
