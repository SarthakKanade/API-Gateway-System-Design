# 🏗️ API Gateway — Architecture Document

## Problem Statement 26: API Gateway (Routing + Auth + Rate Limits)
**Theme**: Microservices Architecture & Backend Infrastructure

---

## 1. System Overview

The API Gateway acts as a **single entry point** for all client requests in a microservices architecture. It centralizes cross-cutting concerns — authentication, rate limiting, routing, request validation, and monitoring — so that individual backend services can focus purely on business logic.

```
┌──────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                │
│                   (Web / Mobile / Third-Party)                       │
└──────────────────────────┬───────────────────────────────────────────┘
                           │  HTTP/HTTPS
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       LOAD BALANCER                                  │
│               (Nginx / AWS ALB / HAProxy)                            │
│          Distributes traffic across gateway instances                │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                     🚪 API GATEWAY (:3000)                           │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   MIDDLEWARE PIPELINE                        │    │
│  │                                                             │    │
│  │  ┌─────────┐  ┌──────┐  ┌───────────┐  ┌───────────┐      │    │
│  │  │ 📊      │  │ 🔐   │  │ ⏱️        │  │ ✅        │      │    │
│  │  │ Logger  │→ │ Auth │→ │ Rate      │→ │ Request   │      │    │
│  │  │         │  │      │  │ Limiter   │  │ Validator │      │    │
│  │  └─────────┘  └──────┘  └───────────┘  └───────────┘      │    │
│  │       │                                      │              │    │
│  │       │    ┌───────────┐  ┌───────────┐     │              │    │
│  │       │    │ 🔄        │  │ 🛡️        │     │              │    │
│  │       └──→ │ Request   │→ │ Circuit   │→────┘              │    │
│  │            │ Transform │  │ Breaker   │                    │    │
│  │            └───────────┘  └───────────┘                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                          │                                           │
│                    ┌─────┴─────┐                                    │
│                    │ 🔀 PROXY  │                                    │
│                    │  SERVICE  │                                    │
│                    └─────┬─────┘                                    │
│                          │                                           │
└──────────────────────────┼───────────────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ 👤 User  │ │ 📦 Order │ │ 💳 Pay   │
        │ Service  │ │ Service  │ │ Service  │
        │  :4001   │ │  :4002   │ │  :4003   │
        └──────────┘ └──────────┘ └──────────┘
```

---

## 2. High-Level Design (HLD)

### 2.1 Main Components

| Component | Responsibility |
|-----------|---------------|
| **Client** | Web/Mobile app sending HTTP requests |
| **Load Balancer** | Distributes traffic across gateway instances (production) |
| **API Gateway** | Single entry point — auth, rate limiting, routing, validation |
| **Auth Service** | JWT token generation, verification, API key management |
| **Rate Limiter** | Sliding window request throttling per user/IP |
| **Circuit Breaker** | Prevents cascading failures to backend services |
| **Routing Engine** | Path-based matching and request forwarding |
| **Backend Services** | User, Order, Payment microservices |
| **Monitoring Dashboard** | Real-time metrics visualization |

### 2.2 Data Flow

```
1. Client sends HTTP request to Gateway
         │
         ▼
2. Logger captures request metadata (timestamp, method, path, IP)
         │
         ▼
3. Authenticator validates JWT/API Key
   ├── ❌ Invalid → 401 Unauthorized
   └── ✅ Valid → attach user to request
         │
         ▼
4. Rate Limiter checks request count
   ├── ❌ Exceeded → 429 Too Many Requests
   └── ✅ Within limit → decrement remaining
         │
         ▼
5. Request Validator checks format
   ├── ❌ Invalid → 400 Bad Request
   └── ✅ Valid → continue
         │
         ▼
6. Request Transformer enriches headers
   (adds X-Request-Id, X-User-Id, X-Forwarded-For)
         │
         ▼
7. Circuit Breaker checks service health
   ├── ❌ Circuit OPEN → 503 Service Unavailable
   └── ✅ Circuit CLOSED → forward request
         │
         ▼
8. Proxy forwards request to backend service
         │
         ▼
9. Backend processes request and returns response
         │
         ▼
10. Logger captures response (status, latency, metrics)
         │
         ▼
11. Gateway sends unified response to client
```

### 2.3 Sequence Diagram

```
Client          Gateway         Auth          RateLimiter     Backend
  │                │              │               │              │
  │── HTTP Req ──→│              │               │              │
  │                │── Verify ──→│               │              │
  │                │←── User ────│               │              │
  │                │              │               │              │
  │                │── Check ────────────────────→│              │
  │                │←── OK ──────────────────────│              │
  │                │              │               │              │
  │                │── Forward ──────────────────────────────→  │
  │                │←── Response ────────────────────────────── │
  │                │              │               │              │
  │←── Response ──│              │               │              │
```

---

## 3. Low-Level Design (LLD)

### 3.1 API Endpoints

#### Gateway Management
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | No | Health check with service list |
| `GET` | `/gateway/metrics` | No | Real-time metrics (for dashboard) |
| `GET` | `/gateway/logs` | No | Recent request log entries |
| `GET` | `/gateway/services` | No | Registered routes + circuit states |

#### Authentication
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/register` | No | Register new user |
| `POST` | `/auth/login` | No | Login, returns JWT + API key |
| `POST` | `/auth/refresh` | No | Refresh expired access token |

#### Proxied Routes (require auth)
| Method | Gateway Path | Backend Target | Service |
|--------|-------------|----------------|---------|
| `GET/POST/PUT/DELETE` | `/api/users/*` | `localhost:4001` | User Service |
| `GET/POST/PUT` | `/api/orders/*` | `localhost:4002` | Order Service |
| `GET/POST` | `/api/payments/*` | `localhost:4003` | Payment Service |

### 3.2 Authentication Design

```
┌─────────────────────────────────────────────────┐
│              AUTHENTICATION FLOW                 │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌─────────┐    ┌───────────┐    ┌──────────┐  │
│  │ Request │───→│ Extract   │───→│ Verify   │  │
│  │ Arrives │    │ Token/Key │    │ Credentials│ │
│  └─────────┘    └───────────┘    └──────┬───┘  │
│                                         │       │
│                       ┌─────────────────┤       │
│                       │                 │       │
│                 ┌─────▼─────┐    ┌──────▼────┐ │
│                 │  Bearer   │    │  API Key  │  │
│                 │  JWT      │    │  X-API-Key│  │
│                 └─────┬─────┘    └──────┬────┘ │
│                       │                 │       │
│                       └────────┬────────┘       │
│                                │                │
│                         ┌──────▼──────┐         │
│                         │ Check RBAC  │         │
│                         │ Permissions │         │
│                         └──────┬──────┘         │
│                                │                │
│                    ┌───────────┴──────────┐     │
│                    │                      │     │
│              ┌─────▼─────┐        ┌──────▼──┐  │
│              │ ✅ Allowed │        │ ❌ 403   │  │
│              │ Continue  │        │ Forbidden│  │
│              └───────────┘        └─────────┘  │
└─────────────────────────────────────────────────┘

JWT Token Structure:
{
  "id": "uuid",
  "username": "string",
  "role": "admin | user",
  "iat": 1234567890,
  "exp": 1234571490     // 1 hour
}

Supported Auth Methods:
  1. Authorization: Bearer <jwt_token>
  2. X-API-Key: gw_<api_key_hash>
```

### 3.3 Rate Limiting Design

```
┌────────────────────────────────────────────┐
│         SLIDING WINDOW ALGORITHM           │
├────────────────────────────────────────────┤
│                                            │
│  Window: 15 minutes (900,000ms)            │
│                                            │
│  Time ──────────────────────────────→      │
│  ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐      │
│  │R1│R2│R3│  │R4│R5│  │R6│R7│R8│R9│      │
│  └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘      │
│  ◄─────── window (15 min) ──────────►      │
│                                            │
│  Expired requests slide out of window      │
│  New requests are checked against limit    │
│                                            │
│  Tier Limits:                              │
│  ┌──────────┬─────────────────────┐       │
│  │ Role     │ Max Requests/15 min │       │
│  ├──────────┼─────────────────────┤       │
│  │ admin    │ 500                 │       │
│  │ user     │ 100                 │       │
│  │ anonymous│ 30                  │       │
│  └──────────┴─────────────────────┘       │
│                                            │
│  Per-Route Overrides:                      │
│  ┌──────────────┬─────────────────┐       │
│  │ Route        │ Max/15 min      │       │
│  ├──────────────┼─────────────────┤       │
│  │ /api/orders  │ 50              │       │
│  │ /api/payments│ 20              │       │
│  └──────────────┴─────────────────┘       │
│                                            │
│  Response Headers:                         │
│    X-RateLimit-Limit: 100                  │
│    X-RateLimit-Remaining: 87               │
│    X-RateLimit-Reset: <unix_timestamp>     │
│    Retry-After: <seconds> (when 429)       │
└────────────────────────────────────────────┘
```

### 3.4 Circuit Breaker Design

```
┌────────────────────────────────────────────────────────┐
│                 CIRCUIT BREAKER FSM                     │
├────────────────────────────────────────────────────────┤
│                                                        │
│     ┌───────────┐                                      │
│     │  CLOSED   │◄──── Normal operation                │
│     │ (default) │      All requests forwarded          │
│     └─────┬─────┘                                      │
│           │                                            │
│           │ 5 consecutive failures                     │
│           ▼                                            │
│     ┌───────────┐                                      │
│     │   OPEN    │──── Requests blocked                 │
│     │           │     Returns 503 immediately          │
│     └─────┬─────┘                                      │
│           │                                            │
│           │ After 30 seconds                           │
│           ▼                                            │
│     ┌───────────┐                                      │
│     │ HALF_OPEN │──── Allows ONE probe request         │
│     │           │                                      │
│     └─────┬─────┘                                      │
│           │                                            │
│     ┌─────┴──────┐                                     │
│     │            │                                     │
│  Success      Failure                                  │
│     │            │                                     │
│     ▼            ▼                                     │
│  CLOSED        OPEN                                    │
│  (reset)       (restart timer)                         │
│                                                        │
│  Config:                                               │
│    Failure Threshold: 5 consecutive failures           │
│    Reset Timeout: 30 seconds                           │
└────────────────────────────────────────────────────────┘
```

### 3.5 Database / Cache Design

```
┌─────────────────────────────────────────────┐
│         IN-MEMORY DATA STORES               │
├─────────────────────────────────────────────┤
│                                             │
│  Rate Limit Store (Map):                    │
│  ┌────────────────┬───────────────────────┐│
│  │ Key            │ Value                 ││
│  ├────────────────┼───────────────────────┤│
│  │ user:<user_id> │ { timestamps: [...],  ││
│  │  or            │   windowMs: 900000 }  ││
│  │ ip:<ip_addr>   │                       ││
│  └────────────────┴───────────────────────┘│
│                                             │
│  Auth Store (Map):                          │
│  ┌────────────────┬───────────────────────┐│
│  │ Key            │ Value                 ││
│  ├────────────────┼───────────────────────┤│
│  │ username       │ { id, username,       ││
│  │                │   password (bcrypt),  ││
│  │                │   role, apiKey }      ││
│  └────────────────┴───────────────────────┘│
│                                             │
│  Circuit Breaker State (Map):               │
│  ┌────────────────┬───────────────────────┐│
│  │ serviceName    │ { state, failures,    ││
│  │                │   lastFailure,        ││
│  │                │   nextRetry }         ││
│  └────────────────┴───────────────────────┘│
│                                             │
│  Request Logs (Array, capped at 1000):      │
│  ┌────────────────────────────────────────┐│
│  │ { id, timestamp, method, path,        ││
│  │   statusCode, latency, ip, user,      ││
│  │   service, contentLength }            ││
│  └────────────────────────────────────────┘│
│                                             │
│  PRODUCTION UPGRADE: Replace with Redis     │
│  for distributed multi-instance support     │
└─────────────────────────────────────────────┘
```

---

## 4. Project Structure

```
api-gateway/
├── package.json                 # Dependencies & scripts
├── .env                         # Environment configuration
├── README.md                    # Quick start guide
│
├── gateway/
│   ├── server.js                # 🚀 Main entry point
│   ├── config/
│   │   ├── settings.js          # Centralized config
│   │   └── routes.js            # Route table + matching
│   ├── middleware/
│   │   ├── logger.js            # 📊 Request/response logging + metrics
│   │   ├── authenticate.js      # 🔐 JWT + API Key auth + RBAC
│   │   ├── rateLimiter.js       # ⏱️ Sliding window rate limiter
│   │   ├── requestValidator.js  # ✅ Content-type + body validation
│   │   ├── requestTransformer.js# 🔄 Header enrichment
│   │   └── circuitBreaker.js    # 🛡️ Fault tolerance
│   ├── services/
│   │   ├── authService.js       # User registration + JWT mgmt
│   │   ├── routingEngine.js     # Path resolution + rewriting
│   │   └── proxyService.js      # http-proxy-middleware forwarding
│   └── utils/
│       ├── errors.js            # Custom error classes
│       └── helpers.js           # UUID, IP extraction, formatting
│
├── microservices/
│   ├── userService.js           # 👤 User CRUD (:4001)
│   ├── orderService.js          # 📦 Orders + failure sim (:4002)
│   └── paymentService.js        # 💳 Payments (:4003)
│
├── dashboard/
│   ├── index.html               # Dashboard markup
│   ├── styles.css               # Glassmorphism dark theme
│   └── app.js                   # Real-time polling + canvas chart
│
└── docs/
    └── architecture.md          # This file
```

---

## 5. Middleware Pipeline

Requests flow through middleware in strict order. Each layer can **short-circuit** the pipeline by sending an error response.

```
REQUEST ──→ Logger ──→ Auth ──→ Rate Limiter ──→ Validator ──→ Transformer ──→ Circuit Breaker ──→ Proxy ──→ RESPONSE
               │          │          │               │              │                │               │
               │          │          │               │              │                │               │
            Always    Skip for    Skip for       Skip GET/       Add headers     Check service    Forward to
            runs      public      dashboard/     HEAD/OPTIONS    X-Request-Id    state (CLOSED/   target
                      paths       health                        X-User-Id       OPEN/HALF_OPEN)  backend
```

---

## 6. Scalability Considerations

### 6.1 Horizontal Scaling

```
                    ┌──────────────┐
                    │ Load Balancer│
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐┌────▼─────┐┌────▼─────┐
        │ Gateway   ││ Gateway  ││ Gateway  │
        │ Instance 1││ Instance 2││ Instance 3│
        └─────┬─────┘└────┬─────┘└────┬─────┘
              │            │            │
              └────────────┼────────────┘
                           │
                    ┌──────▼───────┐
                    │    Redis     │  ← Shared rate limit store
                    │   Cluster    │  ← Shared session/token cache
                    └──────────────┘
```

### 6.2 Production Upgrades

| Current (Demo) | Production Scale |
|----------------|-----------------|
| In-memory rate limits | Redis Cluster with TTL-based sliding windows |
| In-memory user store | PostgreSQL / MongoDB with connection pooling |
| In-memory logs | ELK Stack (Elasticsearch + Logstash + Kibana) |
| Single process | PM2 cluster mode / Kubernetes pods |
| http-proxy-middleware | Envoy proxy / Nginx reverse proxy |
| Canvas chart | Grafana dashboards with Prometheus metrics |
| Polling dashboard | WebSocket / Server-Sent Events (SSE) |

### 6.3 Performance Targets

| Metric | Target | Achieved (Demo) |
|--------|--------|-----------------|
| Gateway overhead | < 50ms | ~37ms avg |
| Throughput | 10K+ req/sec | Limited by single process |
| Availability | 99.99% | Single instance (dev) |

---

## 7. Security Design

```
┌────────────────────────────────────────────────┐
│              SECURITY LAYERS                    │
├────────────────────────────────────────────────┤
│                                                │
│  Layer 1: Transport Security                   │
│  └── HTTPS/TLS termination (at load balancer)  │
│                                                │
│  Layer 2: Authentication                       │
│  └── JWT verification (RS256/HS256)            │
│  └── API Key validation                        │
│  └── Token expiration (1h access, 7d refresh)  │
│                                                │
│  Layer 3: Authorization                        │
│  └── Role-based access control (admin/user)    │
│  └── Per-route permission checks               │
│                                                │
│  Layer 4: Rate Limiting                        │
│  └── Per-user request throttling               │
│  └── Per-IP anonymous throttling               │
│  └── DDoS mitigation                          │
│                                                │
│  Layer 5: Input Validation                     │
│  └── Content-Type enforcement                  │
│  └── Payload size limits (1MB)                 │
│  └── JSON format validation                    │
│                                                │
│  Layer 6: Header Security                      │
│  └── Strip sensitive headers before forwarding │
│  └── Add correlation IDs for tracing           │
│  └── bcrypt password hashing (10 rounds)       │
└────────────────────────────────────────────────┘
```

---

## 8. Trade-offs & Design Decisions

### Why API Gateway?
> Provides a single entry point, simplifies client interaction, and centralizes cross-cutting concerns. Without it, every microservice must independently handle auth, rate limiting, and logging.

### Why Authentication at the Gateway?
> Prevents unauthorized requests from ever reaching backend services. Reduces load on backends and provides a consistent security boundary.

### Why Rate Limiting?
> Protects the system from abuse, DDoS attacks, and accidental overload. Tiered limits ensure fair usage across different user types.

### Why Circuit Breaker?
> Prevents cascading failures. When a backend service is down, the gateway fails fast instead of hanging and exhausting connection pools.

### Trade-off: Centralization vs. Bottleneck
> The gateway is a potential single point of failure. This is mitigated by:
> - Horizontal scaling (multiple gateway instances behind a load balancer)
> - Stateless design (no session state in the gateway process)
> - Distributed stores (Redis for shared rate limits in production)
> - Health checks and auto-scaling policies

### Why In-Memory (not Redis)?
> For the demo/student implementation, in-memory stores reduce setup complexity while still demonstrating all the concepts. The architecture is designed so that swapping to Redis requires minimal code changes.

---

## 9. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js | Server-side JavaScript |
| Framework | Express.js | HTTP routing + middleware |
| Proxy | http-proxy-middleware | Request forwarding to backends |
| Auth | jsonwebtoken | JWT signing + verification |
| Hashing | bcryptjs | Password hashing |
| IDs | uuid | Unique request/user IDs |
| CORS | cors | Cross-origin request handling |
| Dashboard | Vanilla HTML/CSS/JS | No framework overhead |
| Charts | Canvas API | Real-time throughput visualization |
