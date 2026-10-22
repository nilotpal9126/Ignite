import test from 'node:test';
import assert from 'node:assert/strict';
import factory from '../../firebase-session.js';

const config = { enabled: true, provider: 'firebase', apiKey: 'synthetic-key',
  projectId: 'synthetic-project', authDomain: 'synthetic-project.firebaseapp.com', appId: 'synthetic-app' };
function fixture({ storageBlocked = false, verificationFailure = false } = {}) {
  const records = new Map([
    ['alpha@example.invalid', { uid: 'uid-alpha', verified: true }],
    ['beta@example.invalid', { uid: 'uid-beta', verified: true }],
    ['unverified@example.invalid', { uid: 'uid-unverified', verified: false }],
  ]);
  const events = [];
  const auth = { currentUser: null };
  let observer;
  let failMail = verificationFailure;
  const userFor = email => {
    const record = records.get(email);
    return { uid: record.uid, email, emailVerified: record.verified, displayName: '',
      async getIdToken(force) { events.push(['token', force]); return `synthetic-token-for-${record.uid}`; } };
  };
  const emit = () => observer?.(auth.currentUser);
  const authSdk = {
    browserSessionPersistence: 'SESSION',
    async setPersistence(_, value) { events.push(['persistence', value]); if (storageBlocked) throw new Error('blocked'); },
    onAuthStateChanged(_, callback) { observer = callback; queueMicrotask(emit); return () => { observer = null; }; },
    async signInWithEmailAndPassword(_, email, password) {
      events.push(['signin', email, password]);
      if (!records.has(email) || password !== ' Test password 123! ') throw Object.assign(new Error('invalid'), { code: 'auth/invalid-credential' });
      auth.currentUser = userFor(email); emit(); return { user: auth.currentUser };
    },
    async createUserWithEmailAndPassword(_, email) {
      if (records.has(email)) throw Object.assign(new Error('exists'), { code: 'auth/email-already-in-use' });
      records.set(email, { uid: 'uid-created', verified: false });
      auth.currentUser = userFor(email); emit(); return { user: auth.currentUser };
    },
    async sendEmailVerification(user) { events.push(['verification', user.uid]); if (failMail) throw new Error('mail failure'); },
    async reload(user) { user.emailVerified = records.get(user.email).verified; },
    async sendPasswordResetEmail(_, email) {
      events.push(['reset', email]);
      if (!records.has(email)) throw Object.assign(new Error('unknown'), { code: 'auth/user-not-found' });
    },
    async signOut() { events.push(['signout']); auth.currentUser = null; emit(); },
  };
  const identity = factory.createIdentity(config, async () => ({ auth, authSdk }));
  return { identity, records, events, auth, authSdk, allowMail: () => { failMail = false; } };
}

test('sign-in uses session persistence, normalizes email and preserves the complete password', async () => {
  const f = fixture();
  await f.identity.signIn(' ALPHA@EXAMPLE.INVALID ', ' Test password 123! ');
  assert.deepEqual(f.events[0], ['persistence', 'SESSION']);
  assert.equal(f.identity.session().uid, 'uid-alpha');
  assert.equal(f.identity.learner().id, 'firebase:uid-alpha');
  assert.equal('token' in f.identity.session(), false);
  assert.equal('password' in f.identity.session(), false);
  assert.equal(await f.identity.getToken(), 'synthetic-token-for-uid-alpha');
});

test('separate account instances remain independent and their practice keys never overlap', async () => {
  const a = fixture(); const b = fixture();
  await Promise.all([a.identity.signIn('alpha@example.invalid', ' Test password 123! '), b.identity.signIn('beta@example.invalid', ' Test password 123! ')]);
  assert.notEqual(a.identity.learner().id, b.identity.learner().id);
  await a.identity.signOut();
  assert.equal(a.identity.session(), null);
  assert.equal(b.identity.session().uid, 'uid-beta');
  await a.identity.signIn('beta@example.invalid', ' Test password 123! ');
  assert.equal(a.identity.learner().id, b.identity.learner().id, 'same Firebase account has stable learner identity');
});

test('unverified accounts cannot get learner identities or authorized API tokens', async () => {
  const f = fixture();
  await assert.rejects(f.identity.signIn('unverified@example.invalid', ' Test password 123! '), { code: 'auth/email-not-verified' });
  assert.equal(f.identity.session(), null);
  assert.equal(f.identity.learner(), null);
  await assert.rejects(f.identity.getToken(), { code: 'auth/sign-in-required' });
  await f.identity.resendVerification();
  assert.equal(await f.identity.refreshVerification(), null);
  f.records.get('unverified@example.invalid').verified = true;
  assert.equal((await f.identity.refreshVerification()).uid, 'uid-unverified');
  assert.ok(f.events.some(event => event[0] === 'token' && event[1] === true));
});

test('new accounts receive verification; retries after failed mail do not recreate the account', async () => {
  const f = fixture({ verificationFailure: true });
  await assert.rejects(f.identity.signUp('new@example.invalid', 'synthetic-password'), { code: 'auth/verification-send-failed' });
  assert.equal(f.identity.current().emailVerified, false);
  assert.equal(f.identity.session(), null);
  assert.equal(f.records.size, 4);
  f.allowMail();
  await f.identity.resendVerification();
  assert.equal(f.records.size, 4);
  await assert.rejects(f.identity.signUp('new@example.invalid', 'synthetic-password'), { code: 'auth/email-already-in-use' });
});

test('password resets give the same successful result for known and unknown addresses', async () => {
  const f = fixture();
  assert.equal(await f.identity.resetPassword('alpha@example.invalid'), undefined);
  assert.equal(await f.identity.resetPassword('unknown@example.invalid'), undefined);
});

test('sign-out invokes Firebase and notifies consumers so an old dashboard cannot remain active', async () => {
  const f = fixture();
  await f.identity.signIn('alpha@example.invalid', ' Test password 123! ');
  const changes = [];
  f.identity.onChange(user => changes.push(user?.uid || null));
  await f.identity.signOut();
  assert.equal(f.identity.learner(), null);
  assert.ok(changes.includes(null));
  assert.ok(f.events.some(event => event[0] === 'signout'));
});

test('blocked storage and absent configuration fail without silently falling back to a legacy profile', async () => {
  const blocked = fixture({ storageBlocked: true });
  await assert.rejects(blocked.identity.ready(), { code: 'auth/storage-unavailable' });
  assert.equal(blocked.identity.session(), null);
  let loads = 0;
  const absent = factory.createIdentity({ ...config, apiKey: '' }, async () => { loads++; });
  await assert.rejects(absent.ready(), { code: 'auth/not-configured' });
  assert.equal(loads, 0);
});

test('failed SDK loading can be retried and invalid credentials never create a session', async () => {
  const f = fixture();
  let attempts = 0;
  const identity = factory.createIdentity(config, async () => {
    if (++attempts === 1) throw new Error('synthetic network error');
    return { auth: f.auth, authSdk: f.authSdk };
  });
  await assert.rejects(identity.ready());
  await identity.ready();
  assert.equal(attempts, 2);
  await assert.rejects(identity.signIn('alpha@example.invalid', 'wrong'), { code: 'auth/invalid-credential' });
  assert.equal(identity.session(), null);
});
