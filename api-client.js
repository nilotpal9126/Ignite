'use strict';

(function exposeIgniteApi() {
  const config = window.__IGNITE_PLATFORM__ || {};
  const baseUrl = String(config.apiBaseUrl || '').replace(/\/$/, '');

  async function request(path, options = {}) {
    if (!baseUrl) throw new Error('The shared Project Ignite API is not configured yet.');
    const { token, ...fetchOptions } = options;
    const response = await fetch(`${baseUrl}${path}`, {
      ...fetchOptions,
      credentials: 'include',
      headers: {
        accept: 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(fetchOptions.headers || {}),
      },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(payload?.error?.message || `API request failed (${response.status}).`);
      error.code = payload?.error?.code || 'api_error';
      error.requestId = payload?.requestId || response.headers.get('x-request-id');
      throw error;
    }
    return payload;
  }

  window.IgniteApi = Object.freeze({
    configured: Boolean(baseUrl),
    health: () => request('/health'),
    meta: () => request('/v1/meta'),
    session: (token) => request('/v1/session', { token }),
    createAdmission: (token, admission) => request('/v1/admissions', {
      method: 'POST',
      token,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(admission),
    }),
    adminStudents: (token) => request('/v1/admin/students', { token }),
  });
}());
