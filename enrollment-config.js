'use strict';

// Public settings only. Keep Sheet credentials and service secrets on the server.
window.__IGNITE_ENROLLMENT__ = Object.freeze({
  endpointUrl: '', // Deployed enrollment Worker URL, ending in /enrollments.
  turnstileSiteKey: '',
  whatsappChannelUrl: '', // Official https://whatsapp.com/channel/... invite URL.
});
