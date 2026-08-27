import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

/**
 * Shortify Load Test
 *
 * Tests the redirect endpoint (GET /:shortCode) under load.
 *
 * Prerequisites:
 * 1. Start the application: docker compose up --build
 * 2. Create a test user and URL via the API
 * 3. Set the SHORT_CODE environment variable
 *
 * Usage:
 *   k6 run --env BASE_URL=http://localhost:8080 --env SHORT_CODE=aB82xQ7 k6/load-test.js
 *
 * Stages:
 * - Ramp up to 50 VUs over 30s
 * - Hold 50 VUs for 1 minute
 * - Ramp up to 100 VUs for 30s
 * - Hold 100 VUs for 1 minute
 * - Ramp down over 30s
 */

const errorRate = new Rate('errors');
const redirectLatency = new Trend('redirect_latency', true);

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const SHORT_CODE = __ENV.SHORT_CODE || 'test';

export default function () {
  const res = http.get(`${BASE_URL}/${SHORT_CODE}`, {
    redirects: 0, // Don't follow redirects — we want to measure server response time
  });

  redirectLatency.add(res.timings.duration);

  const success = check(res, {
    'is redirect (302)': (r) => r.status === 302,
    'has location header': (r) => r.headers['Location'] !== undefined,
    'latency < 100ms': (r) => r.timings.duration < 100,
    'has request id': (r) => r.headers['X-Request-Id'] !== undefined,
  });

  if (!success) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }

  sleep(0.1); // 100ms between requests per VU
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, opts) {
  // k6 built-in text summary
  return JSON.stringify(data, null, 2);
}
