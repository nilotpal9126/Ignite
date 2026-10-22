'use strict';

(function () {
  function init() {
    const identity = window.IgniteIdentity;
    const dialog = document.querySelector('#loginDialog');
    if (!identity?.enabled || !dialog) return;
    dialog.classList.add('firebase-account-dialog');
    dialog.innerHTML = `<section class="login-card firebase-account-card">
      <button class="dialog-close" id="closeLogin" type="button" aria-label="Close account sign-in">×</button>
      <p class="eyebrow">PROJECT IGNITE · YOUR ACCOUNT</p><h2 id="loginTitle" tabindex="-1">Welcome back.</h2>
      <p class="auth-intro">Sign in to keep your practice separate on this device.</p>
      <div class="auth-tabs" role="group" aria-label="Account options"><button type="button" data-auth-mode="signin" aria-pressed="true">Sign in</button><button type="button" data-auth-mode="signup" aria-pressed="false">Create account</button></div>
      <div id="authForms">
        <form id="firebaseSignIn" novalidate>
          <label>Email<input name="email" type="email" autocomplete="username" maxlength="120" required /></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" maxlength="128" required /></label>
          <button class="admit-button" type="submit">Sign in →</button>
          <button class="auth-text-button" type="button" data-auth-mode="reset">Forgot password?</button>
        </form>
        <form id="firebaseSignUp" hidden novalidate>
          <label>Student / guardian email<input name="email" type="email" autocomplete="username" maxlength="120" required /></label>
          <label>Create password<input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required /><small class="auth-hint">At least 8 characters. Use a password you do not use elsewhere.</small></label>
          <label>Confirm password<input name="confirm" type="password" autocomplete="new-password" minlength="8" maxlength="128" required /></label>
          <label class="auth-consent"><input name="permission" type="checkbox" required /><span>I am a parent/guardian creating this learning account, or I have their permission.</span></label>
          <button class="admit-button" type="submit">Create account →</button>
          <p class="auth-hint">An account lets you sign in. Submit the enrolment form separately to contact our admissions team.</p>
        </form>
        <form id="firebaseReset" hidden novalidate>
          <label>Account email<input name="email" type="email" autocomplete="email" maxlength="120" required /></label>
          <button class="admit-button" type="submit">Send reset instructions</button>
          <button class="auth-text-button" type="button" data-auth-mode="signin">Back to sign in</button>
        </form>
      </div>
      <section id="authVerify" hidden aria-labelledby="authVerifyTitle"><h3 id="authVerifyTitle">Check your email.</h3><p>Open the verification link sent to <strong class="auth-email"></strong>, then return here.</p><div class="auth-stack"><button class="admit-button" type="button" id="authVerified">I’ve verified my email →</button><button class="auth-secondary" type="button" id="authResend">Resend verification</button><button class="auth-text-button" type="button" data-auth-signout>Use another account</button></div></section>
      <section id="authSignedIn" hidden aria-labelledby="authSignedTitle"><h3 id="authSignedTitle">You’re signed in.</h3><p class="auth-email"></p><a class="primary-link" id="authContinue" href="./dashboard.html">Open my dashboard →</a><button class="auth-text-button" type="button" data-auth-signout>Sign out</button></section>
      <p class="form-status" id="firebaseAccountStatus" role="status" aria-live="polite"></p>
      <p class="login-help">New to Ignite? <a href="#enroll" data-open-enroll>Enroll Now!</a></p>
    </section>`;
    const status = dialog.querySelector('#firebaseAccountStatus');
    const modes = { signin: dialog.querySelector('#firebaseSignIn'), signup: dialog.querySelector('#firebaseSignUp'), reset: dialog.querySelector('#firebaseReset') };
    const next = new URLSearchParams(window.location.search).get('next') === 'play' ? './play.html' : './dashboard.html';
    dialog.querySelector('#authContinue').href = next;
    let mode = 'signin';
    let busy = false;
    let opener;
    function setBusy(value) {
      busy = value;
      dialog.querySelectorAll('button:not(.dialog-close), input').forEach(element => { element.disabled = value; });
      dialog.setAttribute('aria-busy', String(value));
    }
    function render() {
      const user = identity.current();
      dialog.querySelector('#authForms').hidden = Boolean(user);
      dialog.querySelector('.auth-tabs').hidden = Boolean(user);
      dialog.querySelector('#authVerify').hidden = !user || user.emailVerified;
      dialog.querySelector('#authSignedIn').hidden = !user?.emailVerified;
      dialog.querySelectorAll('.auth-email').forEach(element => { element.textContent = user?.email || ''; });
      for (const [name, form] of Object.entries(modes)) form.hidden = name !== mode;
      dialog.querySelectorAll('[data-auth-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.authMode === mode)));
      document.querySelectorAll('.open-login').forEach(button => { button.textContent = user?.emailVerified ? 'Account' : 'Login'; });
      dialog.querySelector('#loginTitle').textContent = user ? 'Your Ignite account.' : mode === 'signup' ? 'Let’s get started.' : mode === 'reset' ? 'Reset your password.' : 'Welcome back.';
    }
    async function action(task) {
      if (busy) return;
      setBusy(true);
      status.dataset.state = 'pending';
      status.textContent = 'Please wait…';
      try { await task(); }
      catch (error) { status.dataset.state = 'error'; status.textContent = error.message || 'Please try again.'; }
      finally { setBusy(false); render(); }
    }
    async function open(trigger) {
      opener = trigger;
      if (!dialog.open) dialog.showModal();
      dialog.querySelector('#loginTitle').focus();
      render();
      if (!busy) await action(async () => {
        await identity.ready();
        status.textContent = identity.persistence === 'memory' ? 'This browser cannot retain your sign-in. Keep this tab open while practising.' : '';
      });
    }
    document.querySelectorAll('.open-login').forEach(button => button.addEventListener('click', () => open(button)));
    dialog.querySelector('#closeLogin').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      dialog.querySelectorAll('input[type="password"]').forEach(input => { input.value = ''; });
      opener?.focus();
    });
    dialog.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => {
      mode = button.dataset.authMode;
      status.textContent = '';
      render();
      modes[mode].querySelector('input')?.focus();
    }));
    for (const [name, form] of Object.entries(modes)) form.addEventListener('submit', event => {
      event.preventDefault();
      if (busy || !form.reportValidity()) return;
      if (name === 'signup' && form.elements.password.value !== form.elements.confirm.value) {
        status.dataset.state = 'error';
        status.textContent = 'The two passwords do not match.';
        form.elements.confirm.focus();
        return;
      }
      const address = form.elements.email.value.trim();
      const password = form.elements.password?.value;
      action(async () => {
        if (name === 'signin') {
          await identity.signIn(address, password);
          form.reset();
          window.location.assign(next);
        } else if (name === 'signup') {
          await identity.signUp(address, password);
          form.reset();
          status.textContent = 'Verification email sent. Check your inbox and spam folder.';
        } else {
          await identity.resetPassword(address);
          form.reset();
          status.textContent = 'If an account exists for that email, password reset instructions have been sent.';
        }
      });
    });
    dialog.querySelector('#authResend').addEventListener('click', () => action(async () => {
      await identity.resendVerification();
      status.textContent = 'Verification email sent. Check your inbox and spam folder.';
    }));
    dialog.querySelector('#authVerified').addEventListener('click', () => action(async () => {
      const user = await identity.refreshVerification();
      if (user) window.location.assign(next);
      else status.textContent = 'Your email is not verified yet. Open the verification link, then try again.';
    }));
    dialog.querySelectorAll('[data-auth-signout]').forEach(button => button.addEventListener('click', () => action(async () => {
      await identity.signOut();
      Object.values(modes).forEach(form => form.reset());
      mode = 'signin';
      status.textContent = 'You’re signed out.';
    })));
    identity.onChange(render);
    if (window.location.hash === '#login') open(document.querySelector('.open-login'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
