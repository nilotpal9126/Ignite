'use strict';

(function () {
  const rules = window.IgniteEnrollmentRules;
  if (!rules || !window.HTMLDialogElement) return;
  const config = window.__IGNITE_ENROLLMENT__ || {};
  let endpoint = '';
  try {
    const url = new URL(config.endpointUrl);
    if (url.protocol === 'https:') endpoint = url.href;
  } catch { /* The component remains in preview until a real endpoint is set. */ }
  const connected = Boolean(endpoint && config.turnstileSiteKey);
  const dialog = document.createElement('dialog');
  dialog.className = 'enroll-dialog';
  dialog.id = 'igniteEnroll';
  dialog.setAttribute('aria-labelledby', 'enrollTitle');
  const options = (values, label) => `<option value="">${label}</option>${values.map((value) => `<option>${value}</option>`).join('')}`;
  function field(name, label, attrs, wide = false, hint = '') {
    return `<label class="enroll-field${wide ? ' enroll-wide' : ''}">${label} *
      <input name="${name}" id="enroll-${name}" ${attrs} required aria-describedby="enroll-${name}-error${hint ? ` enroll-${name}-hint` : ''}" />
      ${hint ? `<small class="enroll-hint" id="enroll-${name}-hint">${hint}</small>` : ''}
      <span class="enroll-error" id="enroll-${name}-error"></span></label>`;
  }
  function select(name, label, items) {
    return `<label class="enroll-field">${label} *<select name="${name}" id="enroll-${name}" required aria-describedby="enroll-${name}-error">${items}</select><span class="enroll-error" id="enroll-${name}-error"></span></label>`;
  }
  dialog.innerHTML = `<div class="enroll-shell">
    <div class="enroll-heading"><div><p class="eyebrow">PROJECT IGNITE · YOUR NEXT STEP</p><h2 id="enrollTitle" tabindex="-1">Enroll Now!</h2></div><button class="enroll-close" type="button" aria-label="Close enrolment">×</button></div>
    <p class="enroll-lead">Tell us a little about the student and where you would like to learn. Our team will contact the parent or guardian.</p>
    <ol class="enroll-steps" aria-label="Enrolment steps"><li aria-current="step"><button type="button" data-enroll-goto="0" aria-current="step"><span>1</span>Student</button></li><li><button type="button" data-enroll-goto="1"><span>2</span>Location</button></li><li><button type="button" data-enroll-goto="2"><span>3</span>Contact</button></li></ol>
    <form id="igniteEnquiryForm" novalidate>
      <fieldset data-enroll-step="0"><legend>Let’s start with the student.</legend><p class="enroll-step-copy">All fields marked * are required.</p><div class="enroll-grid">
        ${field('studentName', 'Student name', 'type="text" autocomplete="name" minlength="2" maxlength="80"', true)}
        ${select('studentClass', 'Class', options(Array.from({ length: 12 }, (_, i) => String(i + 1)), 'Choose class'))}
        ${select('board', 'School board', options(rules.boards, 'Choose board'))}
        <div class="enroll-wide" id="enroll-other-board" hidden>${field('otherBoard', 'Board name', 'type="text" minlength="2" maxlength="80"')}</div>
        ${field('school', 'School', 'type="text" autocomplete="organization" minlength="3" maxlength="120"', true, 'Use the school’s full name, including its branch if applicable.')}
      </div></fieldset>
      <fieldset data-enroll-step="1" hidden><legend>Where would you like to learn?</legend><p class="enroll-step-copy">Share your preferred area. The team will confirm centre availability.</p><div class="enroll-grid">
        ${select('state', 'State / union territory', options(rules.states, 'Choose state / UT'))}
        ${field('district', 'District', 'type="text" minlength="2" maxlength="80" disabled')}
        ${field('city', 'City / town', 'type="text" autocomplete="address-level2" minlength="2" maxlength="80" disabled')}
        <div id="enroll-preferred-area" hidden>${field('preferredLocation', 'Preferred area in Siliguri', 'type="text" minlength="2" maxlength="100" disabled', false, 'For Siliguri only. Enter a neighbourhood, not your full home address.')}</div>
      </div></fieldset>
      <fieldset data-enroll-step="2" hidden><legend>How can we reach you?</legend><p class="enroll-step-copy">Use the parent or guardian’s contact details.</p><p class="enroll-summary" id="enroll-summary"></p><div class="enroll-grid">
        ${field('guardianName', 'Parent / guardian name', 'type="text" autocomplete="section-guardian name" minlength="2" maxlength="80"', true)}
        ${field('phone', 'Mobile number', 'type="tel" inputmode="tel" autocomplete="section-guardian tel" maxlength="18" placeholder="+91"', true)}
        <label class="enroll-check enroll-wide"><input type="checkbox" name="sameWhatsapp" checked /><span>Use this number for WhatsApp too.</span></label>
        <div class="enroll-wide" id="enroll-whatsapp-field" hidden>${field('whatsapp', 'WhatsApp number', 'type="tel" inputmode="tel" maxlength="18" placeholder="+91"')}</div>
        ${field('email', 'Guardian email', 'type="email" autocomplete="section-guardian email" maxlength="120"', true)}
        <div class="enroll-wide"><label class="enroll-check"><input type="checkbox" name="consent" required aria-describedby="enroll-consent-error" /><span>I am the student’s parent or guardian and agree that Ignite may use these details to respond to this enrolment enquiry. *</span></label><span class="enroll-error" id="enroll-consent-error"></span></div>
        <label class="enroll-check enroll-wide"><input type="checkbox" name="whatsappOptIn" /><span>I would also like enrolment updates on WhatsApp. (Optional)</span></label>
      </div><div id="enroll-verification"></div></fieldset>
      <label class="enroll-trap" aria-hidden="true" inert>Leave this empty<input name="website" type="text" tabindex="-1" autocomplete="off" /></label>
      <div class="enroll-actions"><button type="button" class="enroll-back" hidden>Back</button><button type="button" class="enroll-trigger enroll-next">Continue →</button><button type="submit" class="enroll-trigger enroll-submit" hidden>Enroll Now!</button></div>
      <p class="enroll-status" role="status" aria-live="polite"></p>
      <p class="enroll-note">${connected ? 'Your details are shared with the Ignite admissions team. Submitting an enquiry does not create a student login.' : 'Enrolment submissions will open shortly. You can explore the form and continue with the free quiz in the meantime.'}</p>
    </form>
    <section class="enroll-success" hidden aria-labelledby="enroll-success-title"><span class="enroll-success-mark" aria-hidden="true">✓</span><h3 id="enroll-success-title" tabindex="-1">We’ve received your enquiry.</h3><p id="enroll-success-copy"></p><div class="enroll-reference"></div><p>Our admissions team will contact the parent or guardian about the next steps.</p><a class="enroll-trigger enroll-channel" target="_blank" rel="noopener noreferrer" hidden>Follow our WhatsApp Channel ↗</a></section>
  </div>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form');
  const steps = [...form.querySelectorAll('[data-enroll-step]')];
  const progress = [...dialog.querySelectorAll('.enroll-steps li')];
  const stepButtons = [...dialog.querySelectorAll('[data-enroll-goto]')];
  const back = form.querySelector('.enroll-back');
  const next = form.querySelector('.enroll-next');
  const submit = form.querySelector('.enroll-submit');
  const status = form.querySelector('.enroll-status');
  const close = dialog.querySelector('.enroll-close');
  const control = (name) => form.elements.namedItem(name);
  let step = 0;
  let pending = false;
  let completed = false;
  let widget;
  let turnstilePromise;
  let verificationToken = '';
  let requestId;
  let lastPayload;
  let opener;

  function collect() {
    return Object.fromEntries(rules.fields.map((key) => {
      const input = control(key);
      return [key, input.type === 'checkbox' ? input.checked : input.value];
    }));
  }
  function showErrors(errors, currentStepOnly = false) {
    let first;
    for (const key of rules.fields) {
      const input = control(key);
      if (currentStepOnly && !steps[step].contains(input)) continue;
      const error = errors[key] || '';
      const message = dialog.querySelector(`#enroll-${key}-error`);
      if (message) message.textContent = error;
      if (error) { input.setAttribute('aria-invalid', 'true'); first ||= input; }
      else input.removeAttribute('aria-invalid');
    }
    return first;
  }
  function validateStep() {
    const { errors } = rules.validate(collect());
    const first = showErrors(errors, true);
    if (first) first.focus();
    return !first;
  }
  function showStep(value, focus = true) {
    step = value;
    steps.forEach((section, i) => { section.hidden = i !== step; });
    progress.forEach((item, i) => {
      if (i === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
      if (i === step) stepButtons[i].setAttribute('aria-current', 'step');
      else stepButtons[i].removeAttribute('aria-current');
    });
    back.hidden = step === 0;
    next.hidden = step === 2;
    submit.hidden = step !== 2;
    submit.disabled = pending;
    submit.textContent = connected ? 'Enroll Now!' : 'Review enquiry';
    status.textContent = '';
    if (step === 2) {
      const data = collect();
      const board = rules.requiresBoardName(data.board) ? `${data.otherBoard} (${data.board})` : data.board;
      const location = [rules.isSiliguri(data.city) ? data.preferredLocation : '', data.city, data.state].filter(Boolean).join(', ');
      dialog.querySelector('#enroll-summary').textContent = `${data.studentName} · Class ${data.studentClass} · ${data.school} · ${board} | ${location}`;
      prepareVerification();
      if (!connected) status.textContent = 'You can review these details. Online submissions are not connected yet; nothing will be sent.';
    }
    if (focus) { steps[step].querySelector('legend').tabIndex = -1; steps[step].querySelector('legend').focus(); }
  }
  function prepareVerification() {
    if (!connected || completed) return;
    if (window.turnstile) { renderVerification(); return; }
    if (!turnstilePromise) {
      turnstilePromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
      }).catch(() => {
        turnstilePromise = null;
        status.textContent = 'The verification could not load. Check your connection, then use Back and Continue to retry.';
      });
    }
    turnstilePromise.then(() => { if (window.turnstile && step === 2 && dialog.open) renderVerification(); });
  }
  function renderVerification() {
    if (widget !== undefined) return;
    widget = window.turnstile.render(dialog.querySelector('#enroll-verification'), {
      sitekey: config.turnstileSiteKey, action: 'enrollment', size: 'flexible', theme: 'light',
      callback: (token) => { verificationToken = token; },
      'expired-callback': () => { verificationToken = ''; },
      'error-callback': () => { verificationToken = ''; status.textContent = 'Verification could not finish. Check your connection and try again.'; },
    });
  }
  function open(trigger) {
    if (dialog.open) return;
    // Close the student-login dialog before opening the enquiry dialog.
    const login = document.querySelector('#loginDialog');
    if (login?.open) login.close();
    opener = trigger;
    dialog.showModal();
    dialog.querySelector(completed ? '#enroll-success-title' : '#enrollTitle').focus();
    if (step === 2) prepareVerification();
  }
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-open-enroll]');
    if (!trigger) return;
    event.preventDefault();
    open(trigger);
  });
  close.addEventListener('click', () => { if (!pending) dialog.close(); });
  dialog.addEventListener('cancel', (event) => { if (pending) event.preventDefault(); });
  dialog.addEventListener('close', () => { opener?.focus(); });
  next.addEventListener('click', () => { if (validateStep()) showStep(step + 1); });
  back.addEventListener('click', () => showStep(step - 1));
  stepButtons.forEach((button, target) => button.addEventListener('click', () => {
    if (pending || completed) return;
    if (target > step) {
      const { errors } = rules.validate(collect());
      for (let i = 0; i < target; i++) {
        if (Object.keys(errors).some(key => steps[i].contains(control(key)))) {
          showStep(i, false);showErrors(errors, true)?.focus();return;
        }
      }
    }
    showStep(target);
  }));

  function locationFields() {
    control('district').disabled = !control('state').value;
    control('city').disabled = control('district').disabled || control('district').value.trim().length < 2;
    const showArea = !control('city').disabled && rules.isSiliguri(control('city').value);
    dialog.querySelector('#enroll-preferred-area').hidden = !showArea;
    control('preferredLocation').disabled = !showArea;
    control('preferredLocation').required = showArea;
    if (!showArea) {
      control('preferredLocation').value = '';
      control('preferredLocation').removeAttribute('aria-invalid');
      dialog.querySelector('#enroll-preferredLocation-error').textContent = '';
    }
  }
  form.addEventListener('input', (event) => {
    const input = event.target;
    input.removeAttribute('aria-invalid');
    const message = dialog.querySelector(`#enroll-${input.name}-error`);
    if (message) message.textContent = '';
    if (['district', 'city'].includes(input.name)) locationFields();
  });
  control('state').addEventListener('change', () => {
    ['district', 'city', 'preferredLocation'].forEach((name) => { control(name).value = ''; });
    locationFields();
  });
  control('district').addEventListener('change', () => {
    ['city', 'preferredLocation'].forEach((name) => { control(name).value = ''; });
    locationFields();
  });
  control('city').addEventListener('change', locationFields);
  function optionalFields() {
    const other = rules.requiresBoardName(control('board').value);
    dialog.querySelector('#enroll-other-board').hidden = !other;
    control('otherBoard').required = other;
    control('otherBoard').disabled = !other;
    const same = control('sameWhatsapp').checked;
    dialog.querySelector('#enroll-whatsapp-field').hidden = same;
    control('whatsapp').required = !same;
    control('whatsapp').disabled = same;
  }
  control('board').addEventListener('change', optionalFields);
  control('sameWhatsapp').addEventListener('change', optionalFields);
  optionalFields();
  locationFields();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (pending || completed) return;
    if (step < 2) { if (validateStep()) showStep(step + 1); return; }
    const result = rules.validate(collect());
    if (!result.valid) {
      const firstKey = Object.keys(result.errors)[0];
      showStep(steps.findIndex((section) => section.contains(control(firstKey))));
      showErrors(result.errors)?.focus();
      return;
    }
    if (!connected) { status.textContent = 'Your details are complete. Online enrolment submissions are not connected yet; nothing has been sent.'; return; }
    if (!verificationToken) { status.textContent = 'Please complete the verification before submitting.'; return; }
    const signature = JSON.stringify(result.data);
    if (!requestId || signature !== lastPayload) { requestId = crypto.randomUUID(); lastPayload = signature; }
    pending = true;
    close.disabled = back.disabled = submit.disabled = true;
    steps.forEach((section) => { section.disabled = true; });
    stepButtons.forEach(button => { button.disabled = true; });
    submit.textContent = 'Submitting…';
    status.textContent = 'Saving your enquiry. Please wait for confirmation.';
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 30000);
    let focusAfterSave;
    try {
      const response = await fetch(endpoint, {
        method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', signal: abort.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...result.data, requestId, turnstileToken: verificationToken, website: control('website').value }),
      });
      const body = await response.json();
      if (!response.ok || body.ok !== true || !/^IGN-[A-F0-9]{12}$/.test(body.reference || '')) {
        if (body.errors) {
          const key = Object.keys(body.errors).find((name) => rules.fields.includes(name));
          if (key) { showStep(steps.findIndex((section) => section.contains(control(key)))); focusAfterSave = showErrors(body.errors); }
        }
        throw new Error(body.code === 'verification_failed' ? 'Verification expired. Please complete it again and retry.' : 'We could not confirm your submission. Your entries are still here; please retry.');
      }
      completed = true;
      form.hidden = true;
      dialog.querySelector('.enroll-steps').hidden = true;
      dialog.querySelector('.enroll-lead').hidden = true;
      dialog.querySelector('.enroll-success').hidden = false;
      dialog.querySelector('#enroll-success-copy').textContent = body.duplicate
        ? 'An enquiry for these student details is already recorded. We have kept one entry.'
        : 'Your details have been saved successfully.';
      dialog.querySelector('.enroll-reference').textContent = `Enquiry reference: ${body.reference}`;
      try {
        const channel = new URL(config.whatsappChannelUrl);
        if (channel.protocol === 'https:' && ['whatsapp.com', 'www.whatsapp.com'].includes(channel.hostname) && channel.pathname.startsWith('/channel/')) {
          const link = dialog.querySelector('.enroll-channel');
          link.href = channel.href;
          link.hidden = false;
        }
      } catch { /* No channel link is shown until the real invite URL is supplied. */ }
      form.reset(); // Personal details are never persisted in browser storage.
      window.dispatchEvent(new Event('ignite:enrollment-saved'));
      dialog.querySelector('#enroll-success-title').focus();
    } catch (error) {
      status.textContent = error.name === 'AbortError'
        ? 'Confirmation is taking longer than expected. Your details are still here. Retry safely; we will check for an existing entry.'
        : (error instanceof TypeError ? 'Please check your connection and retry. Your entries are still here.' : error.message);
    } finally {
      clearTimeout(timeout);
      pending = false;
      close.disabled = back.disabled = false;
      submit.disabled = false;
      steps.forEach((section) => { section.disabled = false; });
      stepButtons.forEach(button => { button.disabled = false; });
      focusAfterSave?.focus();
      submit.textContent = 'Enroll Now!';
      verificationToken = '';
      if (widget !== undefined) window.turnstile.reset(widget);
    }
  });
  window.IgniteEnrollment = Object.freeze({
    open,
    canSubmit: connected,
    prefill(values = {}) {
      if (completed || pending) return false;
      for (const name of ['studentName','studentClass','board','phone','email']) {
        if (!Object.hasOwn(values, name)) continue;
        const input = control(name);
        const value = name === 'board' && values[name] === 'ICSE' ? 'CISCE' : rules.clean(String(values[name] ?? ''));
        if (!input.value && value) input.value = value;
      }
      optionalFields();locationFields();showStep(step, false);return true;
    },
  });
  if (window.location.hash === '#enroll') open(document.querySelector('[data-open-enroll]'));
})();
