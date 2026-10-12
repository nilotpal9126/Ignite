'use strict';

(function exposeIgniteIdentity() {
  const config = window.__IGNITE_PLATFORM__?.identity || {};
  const apiKey = String(config.apiKey || '').trim();
  const projectId = String(config.projectId || '').trim();
  const authDomain = String(config.authDomain || (projectId ? `${projectId}.firebaseapp.com` : '')).trim();
  const appId = String(config.appId || '').trim();
  const storageBucket = String(config.storageBucket || '').trim();
  const messagingSenderId = String(config.messagingSenderId || '').trim();
  const measurementId = String(config.measurementId || '').trim();
  const SESSION_KEY = 'ignite-firebase-session-v1';
  let firebaseSdkPromise;

  function firebaseError(code) {
    const messages = {
      EMAIL_EXISTS: 'An account already exists for this email. Sign in instead.',
      EMAIL_NOT_FOUND: 'The email or password is incorrect.',
      INVALID_LOGIN_CREDENTIALS: 'The email or password is incorrect.',
      INVALID_PASSWORD: 'The email or password is incorrect.',
      INVALID_EMAIL: 'Enter a valid adult email address.',
      WEAK_PASSWORD: 'Use a stronger password with at least eight characters.',
      TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts. Please wait before trying again.',
      USER_DISABLED: 'This account is currently disabled.',
    };
    return messages[code] || 'Guardian sign-in could not be completed.';
  }

  async function call(path, payload) {
    if (!apiKey || !projectId) throw new Error('Firebase identity is not configured yet.');
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = String(body?.error?.message || '').split(' : ')[0];
      const error = new Error(firebaseError(code));
      error.code = code || 'FIREBASE_ERROR';
      throw error;
    }
    return body;
  }

  function saveSession(response, user) {
    const session = {
      token: response.idToken,
      email: String(user?.email || response.email || '').toLowerCase(),
      expiresAt: Date.now() + Math.max(60, Number(response.expiresIn || 3600) - 60) * 1000,
    };
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  async function loadFirebaseSdk() {
    if (!apiKey || !projectId || !authDomain) throw new Error('Firebase web app configuration is incomplete.');
    if (!firebaseSdkPromise) {
      firebaseSdkPromise = Promise.all([
        import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js'),
      ]).then(async ([appSdk, authSdk]) => {
        const firebaseConfig = { apiKey, authDomain, projectId };
        if (appId) firebaseConfig.appId = appId;
        if (storageBucket) firebaseConfig.storageBucket = storageBucket;
        if (messagingSenderId) firebaseConfig.messagingSenderId = messagingSenderId;
        if (measurementId) firebaseConfig.measurementId = measurementId;
        const app = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(firebaseConfig);
        const auth = authSdk.getAuth(app);
        await authSdk.setPersistence(auth, authSdk.browserSessionPersistence);
        return { auth, authSdk };
      });
    }
    return firebaseSdkPromise;
  }

  async function saveFirebaseUser(user) {
    const tokenResult = await user.getIdTokenResult(true);
    const expiresAt = Date.parse(tokenResult.expirationTime);
    const expiresIn = Number.isFinite(expiresAt) ? Math.max(60, Math.floor((expiresAt - Date.now()) / 1000)) : 3600;
    return saveSession({ idToken: tokenResult.token, expiresIn, email: user.email }, user);
  }

  function githubError(error) {
    const messages = {
      'auth/account-exists-with-different-credential': 'An account already uses this email. Sign in with its original method first.',
      'auth/cancelled-popup-request': 'The GitHub sign-in window was replaced by another request.',
      'auth/operation-not-allowed': 'GitHub sign-in is not enabled in Firebase yet.',
      'auth/popup-blocked': 'Allow pop-ups for this site, then try GitHub sign-in again.',
      'auth/popup-closed-by-user': 'GitHub sign-in was closed before it finished.',
      'auth/unauthorized-domain': 'This website domain is not authorized in Firebase Authentication.',
    };
    return messages[error?.code] || 'GitHub sign-in could not be completed.';
  }

  async function signInWithGitHub() {
    try {
      const { auth, authSdk } = await loadFirebaseSdk();
      const provider = new authSdk.GithubAuthProvider();
      const result = await authSdk.signInWithPopup(auth, provider);
      return saveFirebaseUser(result.user);
    } catch (error) {
      const wrapped = new Error(githubError(error));
      wrapped.code = error?.code || 'GITHUB_SIGN_IN_FAILED';
      throw wrapped;
    }
  }

  function session() {
    try {
      const value = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) || 'null');
      if (!value?.token || !value?.expiresAt || value.expiresAt <= Date.now()) {
        window.sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return value;
    } catch {
      return null;
    }
  }

  async function signUp(email, password) {
    const result = await call('accounts:signUp', { email, password, returnSecureToken: true });
    await call('accounts:sendOobCode', { requestType: 'VERIFY_EMAIL', idToken: result.idToken });
    return { email: result.email };
  }

  async function signIn(email, password) {
    const result = await call('accounts:signInWithPassword', { email, password, returnSecureToken: true });
    const lookup = await call('accounts:lookup', { idToken: result.idToken });
    const user = lookup.users?.[0];
    if (!user?.emailVerified) {
      const error = new Error('Verify the adult email address using the Firebase email, then sign in again.');
      error.code = 'EMAIL_NOT_VERIFIED';
      throw error;
    }
    return saveSession(result, user);
  }

  function signOut() {
    try { window.sessionStorage.removeItem(SESSION_KEY); }
    catch { /* the page will still return to the signed-out view */ }
  }

  window.IgniteIdentity = Object.freeze({
    configured: Boolean(apiKey && projectId && config.provider === 'firebase'),
    projectId,
    session,
    token: () => session()?.token || '',
    signUp,
    signIn,
    signInWithGitHub,
    signOut,
  });
}());

