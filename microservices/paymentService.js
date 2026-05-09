/**
 * ═══════════════════════════════════════════════════════════════
 * Mock Payment Service — Port 4003
 * ═══════════════════════════════════════════════════════════════
 * Payment processing with simulated delays (200-500ms).
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const app = express();
app.use(express.json());

const payments = [
  { id: 'PAY-001', orderId: 'ORD-001', amount: 59.99, currency: 'USD', status: 'completed', method: 'credit_card' },
  { id: 'PAY-002', orderId: 'ORD-002', amount: 129.99, currency: 'USD', status: 'completed', method: 'paypal' },
  { id: 'PAY-003', orderId: 'ORD-003', amount: 249.50, currency: 'USD', status: 'pending', method: 'credit_card' },
];

// Payment processing takes longer (200-500ms)
const delay = () => new Promise(r => setTimeout(r, 200 + Math.random() * 300));

app.post('/process', async (req, res) => {
  await delay();
  const payment = {
    id: `PAY-${String(payments.length + 1).padStart(3, '0')}`,
    orderId: req.body.orderId,
    amount: req.body.amount,
    currency: req.body.currency || 'USD',
    method: req.body.method || 'credit_card',
    status: 'completed',
    processedAt: new Date().toISOString(),
  };
  payments.push(payment);
  res.status(201).json({ service: 'payment-service', data: payment, message: 'Payment processed successfully' });
});

app.get('/:id', async (req, res) => {
  await delay();
  const payment = payments.find(p => p.id === req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  res.json({ service: 'payment-service', data: payment });
});

app.post('/refund', async (req, res) => {
  await delay();
  const payment = payments.find(p => p.id === req.body.paymentId);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  payment.status = 'refunded';
  payment.refundedAt = new Date().toISOString();
  res.json({ service: 'payment-service', data: payment, message: 'Payment refunded' });
});

const PORT = 4003;
app.listen(PORT, () => console.log(`  💳 Payment Service running on port ${PORT}`));
module.exports = app;
