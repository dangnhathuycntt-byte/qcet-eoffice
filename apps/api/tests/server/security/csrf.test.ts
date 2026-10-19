import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCsrf,
  assertCsrfProtection,
  getSecurityHeaders,
  applySecurityHeaders,
  isSafeMethod,
  hasBearerAuth,
  hasWebhookHeader,
  getAllowedOrigins,
} from '@/server/security/csrf';
import { ForbiddenError, ApiError } from '@/server/api/errors';

describe('CSRF Protection & Security Headers Engine', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXTAUTH_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('isSafeMethod & HTTP Method Classification', () => {
    it('treats GET, HEAD, OPTIONS, and TRACE as safe methods', () => {
      assert.strictEqual(isSafeMethod('GET'), true);
      assert.strictEqual(isSafeMethod('get'), true);
      assert.strictEqual(isSafeMethod('HEAD'), true);
      assert.strictEqual(isSafeMethod('head'), true);
      assert.strictEqual(isSafeMethod('OPTIONS'), true);
      assert.strictEqual(isSafeMethod('options'), true);
      assert.strictEqual(isSafeMethod('TRACE'), true);
      assert.strictEqual(isSafeMethod('trace'), true);
    });

    it('treats state-changing methods (POST, PUT, PATCH, DELETE) as non-safe', () => {
      assert.strictEqual(isSafeMethod('POST'), false);
      assert.strictEqual(isSafeMethod('put'), false);
      assert.strictEqual(isSafeMethod('PATCH'), false);
      assert.strictEqual(isSafeMethod('delete'), false);
    });
  });

  describe('Safe HTTP Methods Bypass CSRF Validation', () => {
    it('allows GET requests even with cross-site metadata and mismatched origin', () => {
      const request = new Request('http://localhost:3000/api/tasks', {
        method: 'GET',
        headers: {
          'sec-fetch-site': 'cross-site',
          origin: 'http://evil.com',
          cookie: 'session=authenticated',
        },
      });

      const result = validateCsrf(request);
      assert.strictEqual(result.isValid, true);
      assert.doesNotThrow(() => assertCsrfProtection(request));
    });

    it('allows HEAD, OPTIONS, and TRACE requests unconditionally', () => {
      for (const method of ['HEAD', 'OPTIONS']) {
        const req = new Request('http://localhost:3000/api/tasks', {
          method,
          headers: {
            'sec-fetch-site': 'cross-site',
            origin: 'http://evil.com',
          },
        });
        const result = validateCsrf(req);
        assert.strictEqual(result.isValid, true);
        assert.doesNotThrow(() => assertCsrfProtection(req));
      }

      // TRACE method is tested via Request-compatible interface (undici blocks new Request('...', { method: 'TRACE' }))
      const traceReq = {
        method: 'TRACE',
        headers: new Headers({
          'sec-fetch-site': 'cross-site',
          origin: 'http://evil.com',
        }),
        url: 'http://localhost:3000/api/tasks',
      } as unknown as Request;
      assert.strictEqual(validateCsrf(traceReq).isValid, true);
      assert.doesNotThrow(() => assertCsrfProtection(traceReq));
    });
  });

  describe('Bearer & Webhook Non-Ambient Credentials Bypass', () => {
    it('bypasses CSRF for requests carrying Authorization: Bearer token', () => {
      const request = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          authorization: 'Bearer secret_jwt_token_123',
          'sec-fetch-site': 'cross-site',
          origin: 'http://evil.com',
          cookie: 'session=user_cookie',
        },
      });

      assert.strictEqual(hasBearerAuth(request), true);
      const result = validateCsrf(request);
      assert.strictEqual(result.isValid, true);
      assert.doesNotThrow(() => assertCsrfProtection(request));
    });

    it('handles lowercase and mixed-case bearer scheme', () => {
      const request = new Request('http://localhost:3000/api/tasks', {
        method: 'PUT',
        headers: {
          authorization: 'bearer token_xyz',
          origin: 'http://evil.com',
        },
      });

      assert.strictEqual(hasBearerAuth(request), true);
      assert.strictEqual(validateCsrf(request).isValid, true);
    });

    it('bypasses CSRF for webhook signature headers', () => {
      const webhookHeaders = [
        ['x-webhook-signature', 'sha256=abcdef'],
        ['x-webhook-secret', 'webhook_secret_key'],
        ['x-hub-signature-256', 'sha256=123456'],
        ['x-hub-signature', 'sha1=123456'],
        ['x-qcet-webhook-token', 'token_internal'],
      ];

      for (const [header, val] of webhookHeaders) {
        const request = new Request('http://localhost:3000/api/webhooks', {
          method: 'POST',
          headers: {
            [header]: val,
            'sec-fetch-site': 'cross-site',
          },
        });

        assert.strictEqual(hasWebhookHeader(request), true);
        assert.strictEqual(validateCsrf(request).isValid, true);
        assert.doesNotThrow(() => assertCsrfProtection(request));
      }
    });
  });

  describe('Sec-Fetch-Site (Fetch Metadata) Policy', () => {
    it('allows same-origin, same-site, and none Sec-Fetch-Site values', () => {
      for (const siteValue of ['same-origin', 'same-site', 'none']) {
        const request = new Request('http://localhost:3000/api/tasks', {
          method: 'POST',
          headers: {
            'sec-fetch-site': siteValue,
            host: 'localhost:3000',
            origin: 'http://localhost:3000',
            cookie: 'session=123',
          },
        });

        const result = validateCsrf(request);
        assert.strictEqual(result.isValid, true);
        assert.doesNotThrow(() => assertCsrfProtection(request));
      }
    });

    it('rejects cross-site Sec-Fetch-Site for state-changing methods', () => {
      const methods = ['POST', 'PUT', 'PATCH', 'DELETE'];

      for (const method of methods) {
        const request = new Request('http://localhost:3000/api/tasks', {
          method,
          headers: {
            'sec-fetch-site': 'cross-site',
            origin: 'http://localhost:3000',
            cookie: 'session=123',
          },
        });

        const result = validateCsrf(request);
        assert.strictEqual(result.isValid, false);
        assert.match(result.reason || '', /cross-site/i);

        assert.throws(
          () => assertCsrfProtection(request),
          (err: unknown) => {
            assert.ok(err instanceof ForbiddenError);
            assert.ok(err instanceof ApiError);
            const forbiddenErr = err as ForbiddenError;
            assert.strictEqual(forbiddenErr.statusCode, 403);
            assert.strictEqual(forbiddenErr.code, 'CSRF_VALIDATION_FAILED');
            assert.match(forbiddenErr.message, /cross-site/i);
            return true;
          }
        );
      }
    });

    it('rejects invalid or unrecognized Sec-Fetch-Site values', () => {
      const request = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          'sec-fetch-site': 'unrecognized-value',
        },
      });

      const result = validateCsrf(request);
      assert.strictEqual(result.isValid, false);
      assert.match(result.reason || '', /invalid sec-fetch-site/i);
    });

    it('rejects same-origin Sec-Fetch-Site if Origin explicitly contradicts it', () => {
      const request = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          'sec-fetch-site': 'same-origin',
          origin: 'http://attacker.com',
        },
      });

      const result = validateCsrf(request);
      assert.strictEqual(result.isValid, false);
      assert.match(result.reason || '', /origin.*does not match/i);
    });
  });

  describe('Origin & Referer Validation', () => {
    it('allows state-changing requests when Origin matches request URL origin', () => {
      const request = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          origin: 'http://localhost:3000',
          cookie: 'session=abc',
        },
      });

      const result = validateCsrf(request);
      assert.strictEqual(result.isValid, true);
      assert.doesNotThrow(() => assertCsrfProtection(request));
    });

    it('allows state-changing requests when Origin matches Host header', () => {
      const request = new Request('http://localhost:3000/api/tasks', {
        method: 'PUT',
        headers: {
          host: 'eoffice.cdktcnqn.edu.vn',
          origin: 'http://eoffice.cdktcnqn.edu.vn',
        },
      });

      const result = validateCsrf(request);
      assert.strictEqual(result.isValid, true);
    });

    it('allows state-changing requests when Origin matches X-Forwarded-Host and X-Forwarded-Proto', () => {
      const request = new Request('http://internal-ip:3000/api/tasks', {
        method: 'POST',
        headers: {
          'x-forwarded-host': 'eoffice.cdktcnqn.edu.vn',
          'x-forwarded-proto': 'https',
          origin: 'https://eoffice.cdktcnqn.edu.vn',
        },
      });

      const result = validateCsrf(request);
      assert.strictEqual(result.isValid, true);
    });

    it('allows state-changing requests when Origin matches configured APP_URL', () => {
      process.env.APP_URL = 'https://eoffice.cdktcnqn.edu.vn';

      const request = new Request('http://internal:3000/api/tasks', {
        method: 'POST',
        headers: {
          origin: 'https://eoffice.cdktcnqn.edu.vn',
        },
      });

      const result = validateCsrf(request);
      assert.strictEqual(result.isValid, true);
    });

    it('allows state-changing requests when Origin matches configured NEXT_PUBLIC_APP_URL', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.cdktcnqn.edu.vn';

      const request = new Request('http://internal:3000/api/tasks', {
        method: 'POST',
        headers: {
          origin: 'https://app.cdktcnqn.edu.vn',
        },
      });

      const result = validateCsrf(request);
      assert.strictEqual(result.isValid, true);
    });

    it('allows state-changing requests when Origin matches custom allowedOrigins option', () => {
      const request = new Request('http://internal:3000/api/tasks', {
        method: 'POST',
        headers: {
          origin: 'https://admin-portal.cdktcnqn.edu.vn',
        },
      });

      const result = validateCsrf(request, {
        allowedOrigins: ['https://admin-portal.cdktcnqn.edu.vn'],
      });
      assert.strictEqual(result.isValid, true);
    });

    it('rejects state-changing requests when Origin does not match', () => {
      const request = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          origin: 'http://evil-attacker.com',
          cookie: 'session=active',
        },
      });

      const result = validateCsrf(request);
      assert.strictEqual(result.isValid, false);
      assert.match(result.reason || '', /does not match allowed origins/i);

      assert.throws(
        () => assertCsrfProtection(request),
        (err: unknown) => {
          assert.ok(err instanceof ForbiddenError);
          assert.strictEqual((err as ForbiddenError).statusCode, 403);
          assert.strictEqual((err as ForbiddenError).code, 'CSRF_VALIDATION_FAILED');
          return true;
        }
      );
    });

    it('rejects state-changing requests when Origin scheme mismatches (http vs https)', () => {
      const request = new Request('https://eoffice.cdktcnqn.edu.vn/api/tasks', {
        method: 'POST',
        headers: {
          host: 'eoffice.cdktcnqn.edu.vn',
          'x-forwarded-proto': 'https',
          origin: 'http://eoffice.cdktcnqn.edu.vn',
        },
      });

      const result = validateCsrf(request);
      assert.strictEqual(result.isValid, false);
    });

    it('falls back to Referer when Origin header is absent and matches origin', () => {
      const request = new Request('http://localhost:3000/api/tasks', {
        method: 'PATCH',
        headers: {
          referer: 'http://localhost:3000/tasks/form?id=99',
          cookie: 'session=active',
        },
      });

      const result = validateCsrf(request);
      assert.strictEqual(result.isValid, true);
    });

    it('rejects when Referer origin does not match allowed origins', () => {
      const request = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          referer: 'http://phishing-portal.com/tasks',
          cookie: 'session=active',
        },
      });

      const result = validateCsrf(request);
      assert.strictEqual(result.isValid, false);
      assert.match(result.reason || '', /referer origin/i);

      assert.throws(() => assertCsrfProtection(request), ForbiddenError);
    });

    it('rejects when Referer header is malformed', () => {
      const request = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          referer: 'not_a_valid_url_string',
          cookie: 'session=active',
        },
      });

      const result = validateCsrf(request);
      assert.strictEqual(result.isValid, false);
      assert.match(result.reason || '', /malformed referer/i);
    });
  });

  describe('Ambient Credential Boundary', () => {
    it('rejects state-changing requests with cookies when both Origin and Referer are missing', () => {
      const request = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          cookie: 'session=user_logged_in_token',
        },
      });

      const result = validateCsrf(request);
      assert.strictEqual(result.isValid, false);
      assert.match(result.reason || '', /missing origin and referer/i);

      assert.throws(() => assertCsrfProtection(request), ForbiddenError);
    });

    it('allows state-changing requests without cookies or metadata (direct CLI / server-to-server)', () => {
      const request = new Request('http://localhost:3000/api/tasks', {
        method: 'POST',
      });

      const result = validateCsrf(request);
      assert.strictEqual(result.isValid, true);
      assert.doesNotThrow(() => assertCsrfProtection(request));
    });
  });

  describe('Security Headers Engine', () => {
    it('getSecurityHeaders returns comprehensive hardening headers', () => {
      const headers = getSecurityHeaders();

      assert.strictEqual(headers['X-Content-Type-Options'], 'nosniff');
      assert.strictEqual(headers['X-Frame-Options'], 'DENY');
      assert.strictEqual(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
      assert.ok(headers['Permissions-Policy'].includes('camera=()'));
      assert.ok(headers['Permissions-Policy'].includes('microphone=()'));
      assert.ok(headers['Permissions-Policy'].includes('geolocation=()'));
      assert.strictEqual(headers['X-XSS-Protection'], '0');
      assert.strictEqual(headers['X-DNS-Prefetch-Control'], 'off');
    });

    it('applySecurityHeaders appends hardening headers to Response', () => {
      const originalResponse = new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'preserve-me',
        },
      });

      const securedResponse = applySecurityHeaders(originalResponse);

      assert.strictEqual(securedResponse.headers.get('content-type'), 'application/json');
      assert.strictEqual(securedResponse.headers.get('x-custom-header'), 'preserve-me');
      assert.strictEqual(securedResponse.headers.get('x-content-type-options'), 'nosniff');
      assert.strictEqual(securedResponse.headers.get('x-frame-options'), 'DENY');
      assert.strictEqual(securedResponse.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
      assert.strictEqual(
        securedResponse.headers.get('permissions-policy'),
        'camera=(), microphone=(), geolocation=()'
      );
      assert.strictEqual(securedResponse.headers.get('x-xss-protection'), '0');
      assert.strictEqual(securedResponse.headers.get('x-dns-prefetch-control'), 'off');
    });
  });
});
