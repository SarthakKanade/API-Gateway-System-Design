# 🚀 API Gateway — System Design Problem 26

> **Microservices Architecture & Backend Infrastructure**
> A production-grade API Gateway with routing, JWT authentication, rate limiting, circuit breakers, and a real-time monitoring dashboard.

## Architecture

```
Client → API Gateway (:3000) → Auth + Rate Limiter → Backend Services
                                                      ├── User Service    (:4001)
                                                      ├── Order Service   (:4002)
                                                      └── Payment Service (:4003)
```

## Quick Start

```bash
# Install dependencies
npm install

# Start everything (gateway + all microservices)
npm start

# Open dashboard
open http://localhost:3000/dashboard
```

## Features

| Feature | Description |
|---------|-------------|
| **Request Routing** | Dynamic path-based routing to backend microservices |
| **JWT Authentication** | Bearer token + API Key support with RBAC |
| **Rate Limiting** | Sliding window, tiered per role (admin/user/anonymous) |
| **Circuit Breaker** | CLOSED → OPEN → HALF_OPEN pattern for fault tolerance |
| **Request Validation** | Content-type, payload size, JSON format validation |
| **Request Transformation** | Correlation IDs, user context injection |
| **Centralized Logging** | Structured JSON logging with metrics aggregation |
| **Monitoring Dashboard** | Real-time dark-mode UI with charts & live logs |

## API Reference

### Authentication
```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"pass123","role":"user"}'

# Login (returns JWT)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"pass123"}'

# Use the admin account (pre-seeded)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Protected Routes
```bash
# List users
curl http://localhost:3000/api/users \
  -H "Authorization: Bearer <token>"

# List orders
curl http://localhost:3000/api/orders \
  -H "Authorization: Bearer <token>"

# Process payment
curl -X POST http://localhost:3000/api/payments/process \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"ORD-001","amount":59.99}'
```

### Gateway Endpoints
```bash
# Health check
curl http://localhost:3000/health

# View metrics
curl http://localhost:3000/gateway/metrics

# View recent logs
curl http://localhost:3000/gateway/logs

# View service routes
curl http://localhost:3000/gateway/services
```

## Rate Limit Tiers

| Role | Requests / 15 min |
|------|-------------------|
| Admin | 500 |
| User | 100 |
| Anonymous | 30 |

## Middleware Pipeline

```
Request → Logger → Auth → Rate Limiter → Validator → Transformer → Circuit Breaker → Proxy → Response
```

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Proxy**: http-proxy-middleware
- **Auth**: jsonwebtoken + bcryptjs
- **IDs**: uuid
- **Dashboard**: Vanilla HTML/CSS/JS (Canvas API for charts)
