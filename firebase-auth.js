'use strict';

(function exposeIgniteIdentity() {
  const config = window.__IGNITE_PLATFORM__?.identity || {};
  let loading;
  async function loadSdk() {
    if (!loading) loading = (async () => {
      let timer;
      let modules;
      try {
        modules = await Promise.race([
          Promise.all([
            import('https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js'),
            import('https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js'),
          ]),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Sign-in is taking too long to load. Check your connection and try again.')), 15000); }),
        ]);
      } finally { clearTimeout(timer); }
      const [appSdk, authSdk] = modules;
      const name = 'ignite-public';
      const app = appSdk.getApps().find(value => value.name === name)
        || appSdk.initializeApp({ apiKey: config.apiKey, authDomain: config.authDomain,
          projectId: config.projectId, appId: config.appId }, name);
      return { auth: authSdk.getAuth(app), authSdk };
    })().catch(error => { loading = undefined; throw error; });
    return loading;
  }
  // Retire the manually cached JWT. Firebase manages its own persisted session.
  try { window.sessionStorage.removeItem('ignite-firebase-session-v1'); } catch {}
  window.IgniteIdentity = window.IgniteFirebaseSession.createIdentity(config, loadSdk);
})();
