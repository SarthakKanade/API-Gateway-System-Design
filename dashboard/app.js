/**
 * ═══════════════════════════════════════════════════════════════
 * API Gateway — Dashboard Application Logic
 * ═══════════════════════════════════════════════════════════════
 * Real-time metrics polling, canvas chart rendering, and log table updates.
 */

const API_BASE = window.location.origin;
const POLL_INTERVAL = 2000;

// ── State ──────────────────────────────────────────
let currentFilter = 'all';
let throughputData = [];
let lastLogTimestamp = null;

// ── DOM Elements ───────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {
  totalRequests: $('#totalRequests'),
  successRate: $('#successRate'),
  avgLatency: $('#avgLatency'),
  currentRps: $('#currentRps'),
  uptimeBadge: $('#uptimeBadge'),
  servicesList: $('#servicesList'),
  circuitList: $('#circuitList'),
  serviceCount: $('#serviceCount'),
  statusBars: $('#statusBars'),
  topPaths: $('#topPaths'),
  logTableBody: $('#logTableBody'),
  connectionStatus: $('#connectionStatus'),
};

// ══════════════════════════════════════════════════
// Canvas Chart — Request Throughput
// ══════════════════════════════════════════════════

const canvas = $('#throughputChart');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function drawChart(data) {
  const w = canvas.width / window.devicePixelRatio;
  const h = canvas.height / window.devicePixelRatio;
  const padding = { top: 10, right: 10, bottom: 25, left: 40 };

  ctx.clearRect(0, 0, w, h);

  if (data.length < 2) {
    ctx.fillStyle = '#64748b';
    ctx.font = '13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Waiting for data...', w / 2, h / 2);
    return;
  }

  const values = data.map((d) => d.count);
  const maxVal = Math.max(...values, 5);
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  const stepX = chartW / (data.length - 1);

  // Grid lines
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();

    // Y-axis labels
    const val = Math.round(maxVal - (maxVal / 4) * i);
    ctx.fillStyle = '#64748b';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(val, padding.left - 6, y + 3);
  }

  // Gradient fill
  const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
  gradient.addColorStop(0, 'rgba(99, 102, 241, 0.25)');
  gradient.addColorStop(1, 'rgba(99, 102, 241, 0.01)');

  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top + chartH);
  for (let i = 0; i < data.length; i++) {
    const x = padding.left + i * stepX;
    const y = padding.top + chartH - (values[i] / maxVal) * chartH;
    if (i === 0) ctx.lineTo(x, y);
    else {
      const prevX = padding.left + (i - 1) * stepX;
      const prevY = padding.top + chartH - (values[i - 1] / maxVal) * chartH;
      const cpX = (prevX + x) / 2;
      ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
    }
  }
  ctx.lineTo(padding.left + (data.length - 1) * stepX, padding.top + chartH);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Line
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = padding.left + i * stepX;
    const y = padding.top + chartH - (values[i] / maxVal) * chartH;
    if (i === 0) ctx.moveTo(x, y);
    else {
      const prevX = padding.left + (i - 1) * stepX;
      const prevY = padding.top + chartH - (values[i - 1] / maxVal) * chartH;
      const cpX = (prevX + x) / 2;
      ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
    }
  }
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Latest point glow
  if (data.length > 0) {
    const lastX = padding.left + (data.length - 1) * stepX;
    const lastY = padding.top + chartH - (values[values.length - 1] / maxVal) * chartH;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#6366f1';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lastX, lastY, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
    ctx.fill();
  }
}

// ══════════════════════════════════════════════════
// Data Fetching & Rendering
// ══════════════════════════════════════════════════

async function fetchMetrics() {
  try {
    const res = await fetch(`${API_BASE}/gateway/metrics`);
    const data = await res.json();
    renderMetrics(data);
    renderStatusCodes(data.statusCodes);
    renderTopPaths(data.topPaths);
    renderServiceHealth(data.serviceHealth);

    // Update throughput chart
    if (data.throughput) {
      throughputData = data.throughput;
      drawChart(throughputData);
    }
  } catch (err) {
    els.connectionStatus.querySelector('span:last-child').textContent = 'Disconnected';
    els.connectionStatus.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    els.connectionStatus.style.background = 'rgba(239, 68, 68, 0.1)';
    els.connectionStatus.querySelector('.pulse').style.background = '#ef4444';
  }
}

async function fetchLogs() {
  try {
    const res = await fetch(`${API_BASE}/gateway/logs?count=30`);
    const logs = await res.json();
    renderLogs(logs);
  } catch (err) { /* handled by metrics connection check */ }
}

async function fetchServices() {
  try {
    const res = await fetch(`${API_BASE}/gateway/services`);
    const data = await res.json();
    renderCircuitBreakers(data.circuitBreakers);
    els.serviceCount.textContent = `${data.routes.length} services`;
  } catch (err) { /* skip */ }
}

function renderMetrics(data) {
  animateValue(els.totalRequests, data.totalRequests);
  els.successRate.textContent = `${data.successRate}%`;
  els.avgLatency.textContent = `${data.avgLatency}ms`;
  els.currentRps.textContent = data.currentRps;

  // Uptime
  const secs = Math.floor(data.uptime / 1000);
  const mins = Math.floor(secs / 60);
  const hrs = Math.floor(mins / 60);
  els.uptimeBadge.textContent = `Uptime: ${hrs}h ${mins % 60}m ${secs % 60}s`;

  // Color-code success rate
  const rate = data.successRate;
  els.successRate.style.color = rate >= 95 ? 'var(--green)' : rate >= 80 ? 'var(--amber)' : 'var(--red)';

  // Color-code latency
  const lat = data.avgLatency;
  els.avgLatency.className = `metric-value ${lat < 100 ? 'latency-good' : lat < 300 ? 'latency-warn' : 'latency-bad'}`;
}

function renderStatusCodes(codes) {
  const groups = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
  for (const [code, count] of Object.entries(codes)) {
    const group = code[0] + 'xx';
    if (groups[group] !== undefined) groups[group] += count;
  }

  const total = Object.values(groups).reduce((a, b) => a + b, 0) || 1;
  let html = '';
  for (const [group, count] of Object.entries(groups)) {
    const pct = ((count / total) * 100).toFixed(1);
    html += `
      <div class="status-bar-item">
        <span class="status-code-label code-${group}">${group}</span>
        <div class="status-bar-track">
          <div class="status-bar-fill fill-${group}" style="width: ${Math.max(pct, 2)}%">${count}</div>
        </div>
      </div>`;
  }
  els.statusBars.innerHTML = html;
}

function renderTopPaths(paths) {
  if (!paths || paths.length === 0) {
    els.topPaths.innerHTML = '<div class="path-item" style="color:var(--text-muted)">No data yet</div>';
    return;
  }
  els.topPaths.innerHTML = paths.map((p) => `
    <div class="path-item">
      <span class="path-name">${p.path}</span>
      <span class="path-count">${p.count} hits</span>
    </div>
  `).join('');
}

function renderServiceHealth(health) {
  const services = [
    { name: 'user-service', icon: '👤', url: ':4001' },
    { name: 'order-service', icon: '📦', url: ':4002' },
    { name: 'payment-service', icon: '💳', url: ':4003' },
  ];

  els.servicesList.innerHTML = services.map((s) => {
    const status = health[s.name]?.status || 'healthy';
    return `
      <div class="service-item">
        <span class="service-name">
          <span class="service-dot ${status}"></span>
          ${s.icon} ${s.name}
        </span>
        <span class="service-url">${s.url}</span>
      </div>`;
  }).join('');
}

function renderCircuitBreakers(circuits) {
  if (!circuits || Object.keys(circuits).length === 0) {
    els.circuitList.innerHTML = '<div class="service-item" style="color:var(--text-muted);font-size:0.78rem">No circuit data</div>';
    return;
  }
  els.circuitList.innerHTML = Object.entries(circuits).map(([name, cb]) => `
    <div class="service-item">
      <span class="service-name">${name}</span>
      <span class="circuit-state circuit-${cb.state}">${cb.state} (${cb.failures} failures)</span>
    </div>
  `).join('');
}

function renderLogs(logs) {
  const filtered = logs.filter((log) => {
    if (currentFilter === 'all') return true;
    if (currentFilter === 'success') return log.statusCode >= 200 && log.statusCode < 300;
    if (currentFilter === 'client-error') return log.statusCode >= 400 && log.statusCode < 500;
    if (currentFilter === 'server-error') return log.statusCode >= 500;
    return true;
  });

  els.logTableBody.innerHTML = filtered.slice(0, 25).map((log) => {
    const statusClass = `status-${Math.floor(log.statusCode / 100)}xx`;
    const latencyClass = log.latency < 100 ? 'latency-good' : log.latency < 300 ? 'latency-warn' : 'latency-bad';
    const time = new Date(log.timestamp).toLocaleTimeString();

    return `
      <tr class="fade-in">
        <td>${time}</td>
        <td><span class="method-badge method-${log.method}">${log.method}</span></td>
        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${log.path}</td>
        <td><span class="status-pill ${statusClass}">${log.statusCode}</span></td>
        <td class="${latencyClass}">${log.latency}ms</td>
        <td>${log.user}</td>
        <td>${log.service}</td>
      </tr>`;
  }).join('');
}

// ── Animate counter ────────────────────────────────
function animateValue(el, target) {
  const current = parseInt(el.textContent.replace(/,/g, '')) || 0;
  if (current === target) return;
  el.textContent = target.toLocaleString();
}

// ── Log filter buttons ─────────────────────────────
$$('.log-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.log-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    fetchLogs();
  });
});

// ══════════════════════════════════════════════════
// Polling Loop
// ══════════════════════════════════════════════════

async function poll() {
  await Promise.all([fetchMetrics(), fetchLogs(), fetchServices()]);
}

// Initial load
poll();

// Poll every 2 seconds
setInterval(poll, POLL_INTERVAL);

// Handle window resize for chart
window.addEventListener('resize', () => {
  resizeCanvas();
  drawChart(throughputData);
});
