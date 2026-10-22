// Deploy separately from the static site. All credentials are Worker secrets.
import '../../enrollment-validation.js';

const rules = globalThis.IgniteEnrollmentRules;
const MAX_BYTES = 16384;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowedOrigin = env.ALLOWED_ORIGIN;
    const headers = {
      'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff',
      ...(origin === allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
    };
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (request.method === 'GET' && new URL(request.url).pathname === '/health') {
      const configured = Boolean(allowedOrigin && env.SHEETS_WEB_APP_URL && env.SHEETS_AUTH_SECRET && env.TURNSTILE_SECRET_KEY);
      return reply({ service: 'ignite-enrollment', status: configured ? 'configured' : 'not_configured',
        storage: 'google-sheets', studentAuthentication: false }, configured ? 200 : 503);
    }
    if (!allowedOrigin || origin !== allowedOrigin) return reply({ ok: false, code: 'origin_denied' }, 403);
    if (new URL(request.url).pathname !== '/enrollments') return reply({ ok: false, code: 'not_found' }, 404);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
      ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600',
    } });
    if (request.method !== 'POST') return reply({ ok: false, code: 'method_not_allowed' }, 405);
    if (!env.SHEETS_WEB_APP_URL || !env.SHEETS_AUTH_SECRET || !env.TURNSTILE_SECRET_KEY) {
      return reply({ ok: false, code: 'not_configured' }, 503);
    }
    if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '')) {
      return reply({ ok: false, code: 'invalid_content_type' }, 415);
    }
    // Bound the actual streamed bytes, including chunked requests.
    let input;
    try {
      const reader = request.body?.getReader();
      if (!reader) return reply({ ok: false, code: 'invalid_json' }, 400);
      let count = 0;
      const chunks = [];
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        count += part.value.byteLength;
        if (count > MAX_BYTES) { await reader.cancel(); return reply({ ok: false, code: 'too_large' }, 413); }
        chunks.push(part.value);
      }
      const bytes = new Uint8Array(count);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      input = JSON.parse(new TextDecoder().decode(bytes));
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid input');
    } catch { return reply({ ok: false, code: 'invalid_json' }, 400); }
    if (input.website) return reply({ ok: false, code: 'invalid_request' }, 400);
    const result = rules.validate(input);
    if (!result.valid) return reply({ ok: false, code: 'invalid_fields', errors: result.errors }, 422);
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.requestId || '')) {
      return reply({ ok: false, code: 'invalid_request_id' }, 400);
    }
    if (typeof input.turnstileToken !== 'string' || input.turnstileToken.length > 2048 || !input.turnstileToken) {
      return reply({ ok: false, code: 'verification_failed' }, 403);
    }
    try {
      const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: input.turnstileToken,
          remoteip: request.headers.get('CF-Connecting-IP') || undefined }),
        signal: AbortSignal.timeout(10000),
      });
      const check = await verification.json();
      if (!verification.ok || check.success !== true || check.action !== 'enrollment' || check.hostname !== new URL(allowedOrigin).hostname) {
        return reply({ ok: false, code: 'verification_failed' }, 403);
      }
      const url = new URL(env.SHEETS_WEB_APP_URL);
      if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)) {
        return reply({ ok: false, code: 'not_configured' }, 503);
      }
      const response = await fetch(url, {
        method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: env.SHEETS_AUTH_SECRET,
          data: { ...result.data, requestId: input.requestId } }),
        signal: AbortSignal.timeout(15000),
      });
      const receipt = await response.json();
      if (!response.ok || receipt.ok !== true || !/^IGN-[A-F0-9]{12}$/.test(receipt.reference || '')) {
        return reply({ ok: false, code: 'save_unconfirmed' }, 503);
      }
      return reply({ ok: true, reference: receipt.reference, duplicate: receipt.duplicate === true });
    } catch {
      // Do not log contact details, request bodies, tokens or upstream errors.
      return reply({ ok: false, code: 'save_unconfirmed' }, 503);
    }
  },
};
