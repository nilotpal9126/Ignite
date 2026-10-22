'use strict';

// Firebase's SDK owns tokens and refresh; this adapter exposes account state.
(function (root) {
  function createIdentity(config, loadSdk) {
    const enabled = config.provider === 'firebase' && config.enabled !== false;
    const configured = Boolean(enabled && config.apiKey && config.projectId && config.authDomain && config.appId);
    const listeners = new Set();
    let sdk;
    let starting;
    let persistence = 'session';
    function fail(code, message) { const error = new Error(message); error.code = code; return error; }
    function current() {
      const user = sdk?.auth.currentUser;
      return user ? Object.freeze({ uid: user.uid, email: user.email || '',
        emailVerified: user.emailVerified === true, displayName: user.displayName || '' }) : null;
    }
    function session() { const user = current(); return user?.emailVerified ? user : null; }
    function notify() { for (const listener of listeners) { try { listener(current()); } catch { /* isolate observers */ } } }
    async function ready() {
      if (!configured) throw fail('auth/not-configured', 'Account sign-in is not configured yet. You can still try the free quiz.');
      if (!starting) starting = (async () => {
        sdk = await loadSdk();
        try { await sdk.authSdk.setPersistence(sdk.auth, sdk.authSdk.browserSessionPersistence); }
        catch { throw fail('auth/storage-unavailable', 'Enable browser storage to sign in across Ignite pages. The free quiz is still available.'); }
        await new Promise((resolve, reject) => {
          sdk.authSdk.onAuthStateChanged(sdk.auth, () => { notify(); resolve(); }, reject);
        });
        return current();
      })().catch((error) => { starting = undefined; sdk = undefined; throw readable(error); });
      await starting;
      return current();
    }
    function readable(error) {
      const messages = {
        'auth/invalid-credential': 'The email or password is incorrect.',
        'auth/invalid-login-credentials': 'The email or password is incorrect.',
        'auth/wrong-password': 'The email or password is incorrect.',
        'auth/user-not-found': 'The email or password is incorrect.',
        'auth/email-already-in-use': 'An account already uses this email. Sign in or reset its password.',
        'auth/invalid-email': 'Enter a valid email address.',
        'auth/weak-password': 'Use a stronger password of at least eight characters.',
        'auth/password-does-not-meet-requirements': 'Choose a password that meets the account password requirements.',
        'auth/too-many-requests': 'Too many attempts. Please wait before trying again.',
        'auth/user-disabled': 'This account is currently disabled. Contact the Ignite team.',
        'auth/operation-not-allowed': 'Email/password sign-in has not been enabled for Ignite yet.',
        'auth/unauthorized-domain': 'This website address needs to be authorized in Firebase.',
        'auth/invalid-api-key': 'The Firebase configuration needs to be updated by the Ignite team.',
        'auth/network-request-failed': 'Please check your connection and try again.',
      };
      if (error?.code && !messages[error.code]) return error;
      return fail(error?.code || 'auth/unavailable', messages[error?.code] || 'Sign-in could not load. Check your connection and try again.');
    }
    async function run(action) { try { await ready(); return await action(sdk); } catch (error) { throw readable(error); } }
    const email = value => String(value || '').trim().toLowerCase();
    async function signIn(address, password) {
      return run(async ({ auth, authSdk }) => {
        const result = await authSdk.signInWithEmailAndPassword(auth, email(address), password);
        await authSdk.reload(result.user);
        notify();
        if (!result.user.emailVerified) throw fail('auth/email-not-verified', 'Verify your email before opening your account.');
        await result.user.getIdToken(true);
        return session();
      });
    }
    async function signUp(address, password) {
      return run(async ({ auth, authSdk }) => {
        const result = await authSdk.createUserWithEmailAndPassword(auth, email(address), password);
        try { await authSdk.sendEmailVerification(result.user); }
        catch { throw fail('auth/verification-send-failed', 'Your account was created, but the verification email could not be sent. Use Resend verification below.'); }
        notify();
        return current();
      });
    }
    async function resendVerification() {
      return run(async ({ auth, authSdk }) => {
        if (!auth.currentUser) throw fail('auth/sign-in-required', 'Sign in before requesting a verification email.');
        if (!auth.currentUser.emailVerified) await authSdk.sendEmailVerification(auth.currentUser);
      });
    }
    async function refreshVerification() {
      return run(async ({ auth, authSdk }) => {
        if (!auth.currentUser) return null;
        await authSdk.reload(auth.currentUser);
        if (auth.currentUser.emailVerified) await auth.currentUser.getIdToken(true);
        notify();
        return session();
      });
    }
    async function resetPassword(address) {
      return run(async ({ auth, authSdk }) => {
        try { await authSdk.sendPasswordResetEmail(auth, email(address)); }
        catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
      });
    }
    async function signOut() { return run(async ({ auth, authSdk }) => { await authSdk.signOut(auth); notify(); }); }
    async function token(forceRefresh = false) {
      return run(async ({ auth }) => {
        if (!session()) throw fail('auth/sign-in-required', 'Sign in with a verified email first.');
        return auth.currentUser.getIdToken(forceRefresh);
      });
    }
    function learner() {
      const user = session();
      return user ? Object.freeze({ id: `firebase:${user.uid}`, studentName: user.displayName || 'Learner', classLevel: null }) : null;
    }
    function onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }
    return Object.freeze({ enabled, configured, projectId: config.projectId, ready, current, session,
      signIn, signUp, signOut, resetPassword, resendVerification, refreshVerification,
      token, getToken: token, learner, onChange, get persistence() { return persistence; } });
  }
  root.IgniteFirebaseSession = Object.freeze({ createIdentity });
  if (typeof module !== 'undefined' && module.exports) module.exports = root.IgniteFirebaseSession;
})(globalThis);
