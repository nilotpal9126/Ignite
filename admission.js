'use strict';

const STUDENT_KEY = 'ignite-pilot-student-v1';
const SESSION_KEY = 'ignite-pilot-session-v1';
const MAX_LOGIN_FAILURES = 5;
const LOGIN_COOLDOWN_MS = 30_000;
const CLOUD_CONSENT_POLICY = 'ignite-preview-2026-10-12';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const cleanText = (value, maxLength) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
const normalizeLogin = (value) => cleanText(value, 24).toLowerCase();

let loginFailures = 0;
let loginLockedUntil = 0;

const cloudIdentityMode = () => Boolean(window.IgniteIdentity?.configured && window.IgniteApi?.configured);
// Public early access is a product gate, not a substitute for server authorization.
const admissionPreviewMode = () => document.body.dataset.admissions === 'preview';

function pauseNewAdmissions(form) {
  form.hidden = true;
  form.querySelector('button[type="submit"]').disabled = true;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    $('#admissionStatus').textContent = 'New student admissions are paused. Try the free demo without entering personal details.';
  });
}

const storage = {
  getStudent() {
    try { return window.localStorage.getItem(STUDENT_KEY); }
    catch { return null; }
  },
  setStudent(value) {
    try { window.localStorage.setItem(STUDENT_KEY, value); return true; }
    catch { return false; }
  },
  setSession(admissionId) {
    try { window.sessionStorage.setItem(SESSION_KEY, admissionId); return true; }
    catch { return false; }
  },
};

function loadStudent() {
  try {
    const student = JSON.parse(storage.getStudent() || 'null');
    if (!student || typeof student !== 'object') return null;
    if (!student.studentName || !student.studentClass || !student.guardianName || !student.admissionId) return null;
    return student;
  } catch {
    return null;
  }
}

function randomHex(byteLength = 16) {
  const values = new Uint8Array(byteLength);
  window.crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('');
}

async function hashPin(loginId, pin, salt) {
  if (!window.crypto?.subtle || !window.TextEncoder) throw new Error('Secure browser cryptography is unavailable.');
  const payload = new TextEncoder().encode(`${salt}:${normalizeLogin(loginId)}:${pin}`);
  const digest = await window.crypto.subtle.digest('SHA-256', payload);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

function createAdmissionId() {
  let suffix = Date.now().toString(36).slice(-5).toUpperCase();
  try { suffix = randomHex(4).slice(0, 7).toUpperCase(); }
  catch { /* timestamp fallback is sufficient for this single-device pilot */ }
  return `IGN-${new Date().getFullYear()}-${suffix}`;
}

function hasLogin(student) {
  return Boolean(student?.loginId && student?.pinHash && student?.pinSalt);
}

function updateEnrollmentControls(student) {
  const enrolled = Boolean(student);
  $('#viewEnrollmentNav').hidden = !enrolled;
  $('#viewEnrollmentFooter').hidden = !enrolled;
  $('#enrollNav').hidden = enrolled && !admissionPreviewMode();
  const status = $('.admissions-open');
  if (enrolled && !admissionPreviewMode()) status.innerHTML = '<i aria-hidden="true"></i>1 student enrolled';
}

function showAdmission(student) {
  $('#admissionForm').hidden = true;
  $('#admittedCard').hidden = false;
  $('#admittedName').textContent = `${student.studentName} is enrolled.`;
  $('#admittedDetails').textContent = `Class ${student.studentClass} · Parent/guardian: ${student.guardianName}`;
  $('#admissionId').textContent = student.admissionId;

  const ready = hasLogin(student);
  $('#studentLoginSummary').hidden = !ready;
  $('#admittedLoginButton').hidden = !ready;
  $('#loginSetupForm').hidden = ready;
  if (ready) $('#admittedLogin').textContent = student.loginId;
  updateEnrollmentControls(student);
}

function maskEmail(value) {
  const [name, domain] = String(value || '').split('@');
  if (!domain) return 'Not provided';
  return `${name.slice(0, 1) || '*'}${'*'.repeat(Math.min(5, Math.max(2, name.length - 1)))}@${domain}`;
}

function maskPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return 'Not provided';
  return `${'•'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

function showEnrollmentRecord() {
  const student = loadStudent();
  if (!student) {
    window.location.hash = 'admission';
    $('#admission').scrollIntoView({ behavior: 'smooth' });
    return;
  }

  $('#recordStudent').textContent = student.studentName;
  $('#recordClass').textContent = `Class ${student.studentClass}`;
  $('#recordGuardian').textContent = student.guardianName;
  $('#recordEmail').textContent = maskEmail(student.guardianEmail);
  $('#recordPhone').textContent = maskPhone(student.guardianPhone);
  $('#recordAdmissionId').textContent = student.admissionId;
  $('#recordLogin').textContent = student.loginId || 'Login setup pending';
  const admittedDate = student.admittedAt ? new Date(student.admittedAt) : null;
  $('#recordDate').textContent = admittedDate && Number.isFinite(admittedDate.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(admittedDate)
    : 'Date unavailable';

  const dialog = $('#enrollmentDialog');
  if (dialog.open) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function closeEnrollmentRecord() {
  const dialog = $('#enrollmentDialog');
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

function markInvalidFields(form) {
  const fields = Array.from(form.querySelectorAll('input, select'));
  fields.forEach((field) => field.toggleAttribute('aria-invalid', !field.validity.valid));
  const firstInvalid = fields.find((field) => !field.validity.valid);
  if (firstInvalid) {
    firstInvalid.focus();
    firstInvalid.reportValidity();
  }
}

function pinsMatch(pinSelector, confirmSelector, statusElement) {
  const pin = $(pinSelector).value;
  const confirmation = $(confirmSelector).value;
  if (pin === confirmation) return true;
  $(confirmSelector).setAttribute('aria-invalid', 'true');
  statusElement.textContent = 'The two PIN entries do not match.';
  $(confirmSelector).focus();
  return false;
}

function showLogin() {
  const dialog = $('#loginDialog');
  $('#loginStatus').textContent = '';
  if (dialog.open) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  window.setTimeout(() => $('#loginId').focus(), 0);
}

function closeLogin() {
  const dialog = $('#loginDialog');
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

function bindDialog() {
  if (cloudIdentityMode()) {
    $$('.open-login').forEach((button) => button.addEventListener('click', () => {
      $('#admission').scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => $('#guardianSigninEmail')?.focus(), 350);
    }));
    return;
  }
  $$('.open-login').forEach((button) => button.addEventListener('click', showLogin));
  $('#closeLogin').addEventListener('click', closeLogin);
  $('#loginToEnroll').addEventListener('click', closeLogin);
  $('#loginDialog').addEventListener('click', (event) => { if (event.target === $('#loginDialog')) closeLogin(); });
  if (window.location.hash === '#login') showLogin();
}

function showCloudAdmission(student) {
  $('#guardianGate').hidden = true;
  $('#admissionForm').hidden = true;
  $('#admittedCard').hidden = false;
  $('#admittedName').textContent = `${student.studentName} is enrolled.`;
  $('#admittedDetails').textContent = `Class ${student.classLevel} · Guardian-managed cloud pilot`;
  $('#admissionId').textContent = student.admissionId;
  $('#studentLoginSummary').hidden = true;
  $('#admittedLoginButton').hidden = true;
  $('#admittedRecordButton').hidden = true;
  $('#loginSetupForm').hidden = true;
  $('#enrollNav').hidden = !admissionPreviewMode();
  $('#viewEnrollmentNav').hidden = true;
  $('#viewEnrollmentFooter').hidden = true;
  if (!admissionPreviewMode()) $('.admissions-open').innerHTML = '<i aria-hidden="true"></i>1 student enrolled';
}

function showCloudSignedOut() {
  $('#guardianGate').hidden = false;
  $('#guardianSession').hidden = true;
  $('#admissionForm').hidden = true;
  $('#admittedCard').hidden = true;
}

async function syncCloudSession() {
  const identitySession = window.IgniteIdentity.session();
  if (!identitySession) {
    showCloudSignedOut();
    return;
  }

  $('#guardianSessionEmail').textContent = identitySession.email;
  $('#guardianSession').hidden = false;
  $('#guardianGate').hidden = true;
  $('#guardianEmail').value = identitySession.email;
  $('#guardianEmail').readOnly = true;

  try {
    const session = await window.IgniteApi.session(identitySession.token);
    const student = session.students?.[0];
    if (student) showCloudAdmission(student);
    else {
      $('#admittedCard').hidden = true;
      $('#admissionForm').hidden = admissionPreviewMode();
    }
  } catch (error) {
    if (['authentication_required', 'expired_token', 'invalid_token'].includes(error.code)) {
      window.IgniteIdentity.signOut();
      showCloudSignedOut();
      $('#guardianSigninStatus').textContent = 'Your secure session ended. Sign in again.';
      return;
    }
    $('#guardianSigninStatus').textContent = error.message || 'The guardian session could not be loaded.';
    showCloudSignedOut();
  }
}

function bindCloudIdentity() {
  if (!admissionPreviewMode()) $('#admissionPrivacy').innerHTML = '<strong>Cloud preview:</strong> student information is sent only after verified guardian sign-in and is stored in the protected Project Ignite preview database.';
  document.querySelectorAll('[data-local-admission]').forEach((element) => {
    element.hidden = true;
    element.querySelectorAll('input').forEach((input) => { input.required = false; });
  });

  const signupForm = $('#guardianSignupForm');
  signupForm.hidden = admissionPreviewMode();
  const signinForm = $('#guardianSigninForm');
  const githubButton = $('#guardianGithubSignin');
  const githubStatus = $('#guardianGithubStatus');
  bindFieldCleanup(signupForm);
  bindFieldCleanup(signinForm);

  githubButton.addEventListener('click', async () => {
    githubStatus.textContent = '';
    githubButton.disabled = true;
    try {
      const session = await window.IgniteIdentity.signInWithGitHub();
      if (session) await syncCloudSession();
    } catch (error) {
      githubStatus.textContent = error.message || 'GitHub sign-in failed.';
      githubButton.disabled = false;
    }
  });

  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (admissionPreviewMode()) return;
    const status = $('#guardianSignupStatus');
    status.textContent = '';
    if (!signupForm.checkValidity()) {
      markInvalidFields(signupForm);
      status.textContent = 'Enter a valid adult email and a password of at least eight characters.';
      return;
    }
    if ($('#guardianSignupPassword').value !== $('#guardianSignupConfirm').value) {
      $('#guardianSignupConfirm').setAttribute('aria-invalid', 'true');
      $('#guardianSignupConfirm').focus();
      status.textContent = 'The two password entries do not match.';
      return;
    }
    const button = signupForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const result = await window.IgniteIdentity.signUp($('#guardianSignupEmail').value.trim().toLowerCase(), $('#guardianSignupPassword').value);
      signupForm.reset();
      $('#guardianSigninEmail').value = result.email || '';
      status.textContent = 'Verification email sent. Open it, verify the address, then use Guardian sign in.';
      $('#guardianSigninPassword').focus();
    } catch (error) {
      status.textContent = error.message || 'The guardian account could not be created.';
    } finally {
      button.disabled = false;
    }
  });

  signinForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = $('#guardianSigninStatus');
    status.textContent = '';
    if (!signinForm.checkValidity()) {
      markInvalidFields(signinForm);
      status.textContent = 'Enter the verified guardian email and password.';
      return;
    }
    const button = signinForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await window.IgniteIdentity.signIn($('#guardianSigninEmail').value.trim().toLowerCase(), $('#guardianSigninPassword').value);
      signinForm.reset();
      await syncCloudSession();
    } catch (error) {
      status.textContent = error.message || 'Guardian sign-in failed.';
    } finally {
      button.disabled = false;
    }
  });

  $('#guardianSignout').addEventListener('click', () => {
    window.IgniteIdentity.signOut();
    $('#admissionForm').reset();
    $('#guardianEmail').readOnly = false;
    showCloudSignedOut();
  });

  syncCloudSession();
}

function bindCloudEnrollment() {
  const form = $('#admissionForm');
  if (admissionPreviewMode()) { pauseNewAdmissions(form); return; }
  const status = $('#admissionStatus');
  bindFieldCleanup(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = '';
    if (!form.checkValidity()) {
      markInvalidFields(form);
      status.textContent = 'Complete the required student and guardian fields and confirm consent.';
      return;
    }
    const token = window.IgniteIdentity.token();
    if (!token) {
      status.textContent = 'The guardian session ended. Sign in again before admitting a student.';
      showCloudSignedOut();
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const result = await window.IgniteApi.createAdmission(token, {
        studentName: cleanText($('#studentName').value, 80),
        classLevel: Number($('#studentClass').value),
        guardianName: cleanText($('#guardianName').value, 80),
        guardianPhone: cleanText($('#guardianPhone').value, 20),
        relationshipLabel: 'Parent or guardian',
        consent: { accepted: $('#guardianConsent').checked, policyVersion: CLOUD_CONSENT_POLICY },
      });
      form.reset();
      showCloudAdmission(result.admission);
      $('#admittedCard').focus();
    } catch (error) {
      status.textContent = error.message || 'The cloud admission could not be completed.';
      button.disabled = false;
    }
  });
}

function bindEnrollmentRecord() {
  $$('.open-enrollment').forEach((button) => button.addEventListener('click', showEnrollmentRecord));
  $('#closeEnrollment').addEventListener('click', closeEnrollmentRecord);
  $('#enrollmentDialog').addEventListener('click', (event) => {
    if (event.target === $('#enrollmentDialog')) closeEnrollmentRecord();
  });
  $('#recordLoginButton').addEventListener('click', () => {
    closeEnrollmentRecord();
    showLogin();
  });
}

function parsePastedAdmission(rawText) {
  const result = {};
  const aliases = {
    student: 'studentName', name: 'studentName', 'student name': 'studentName',
    class: 'studentClass', grade: 'studentClass',
    guardian: 'guardianName', parent: 'guardianName', 'guardian name': 'guardianName', 'parent name': 'guardianName',
    email: 'guardianEmail', 'guardian email': 'guardianEmail', 'parent email': 'guardianEmail',
    phone: 'guardianPhone', contact: 'guardianPhone', mobile: 'guardianPhone',
    login: 'studentLogin', username: 'studentLogin', 'login id': 'studentLogin',
  };
  const lines = String(rawText || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^([^:=\t]+)\s*[:=\t]\s*(.+)$/);
    if (!match) continue;
    const key = aliases[match[1].trim().toLowerCase()];
    if (key) result[key] = match[2].trim();
  }

  if (!Object.keys(result).length && lines.length >= 4) {
    const fields = ['studentName', 'studentClass', 'guardianName', 'guardianEmail', 'guardianPhone', 'studentLogin'];
    lines.slice(0, fields.length).forEach((value, index) => { result[fields[index]] = value; });
  }
  if (result.studentClass) result.studentClass = String(result.studentClass).match(/(?:class|grade)?\s*(1[0-2]|[1-9])/i)?.[1] || '';
  return result;
}

function fillEnrollmentFromPaste() {
  const status = $('#pasteStatus');
  const values = parsePastedAdmission($('#admissionPaste').value);
  const allowedFields = ['studentName', 'studentClass', 'guardianName', 'guardianEmail', 'guardianPhone', 'studentLogin'];
  const fieldLimits = { studentName: 80, studentClass: 2, guardianName: 80, guardianEmail: 120, guardianPhone: 20, studentLogin: 24 };
  let filled = 0;
  for (const fieldId of allowedFields) {
    if (!values[fieldId] || !document.getElementById(fieldId)) continue;
    document.getElementById(fieldId).value = cleanText(values[fieldId], fieldLimits[fieldId]);
    document.getElementById(fieldId).removeAttribute('aria-invalid');
    filled += 1;
  }
  status.textContent = filled
    ? `${filled} enrollment field${filled === 1 ? '' : 's'} filled. Please review them and create the PIN manually.`
    : 'No labeled details were recognized. Use the example format shown in the box.';
}

function bindQuickPaste() {
  $('#fillFromPaste').addEventListener('click', fillEnrollmentFromPaste);
  $('#admissionPaste').addEventListener('paste', () => window.setTimeout(fillEnrollmentFromPaste, 0));
  $('#pasteFromClipboard').addEventListener('click', async () => {
    const status = $('#pasteStatus');
    if (!navigator.clipboard?.readText) {
      status.textContent = 'Clipboard access is unavailable. Click inside the box and press Ctrl+V or Paste.';
      $('#admissionPaste').focus();
      return;
    }
    try {
      $('#admissionPaste').value = await navigator.clipboard.readText();
      fillEnrollmentFromPaste();
    } catch {
      status.textContent = 'Clipboard permission was not granted. Click inside the box and press Ctrl+V or Paste.';
      $('#admissionPaste').focus();
    }
  });
}

function bindFieldCleanup(form) {
  form.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', () => field.removeAttribute('aria-invalid'));
    field.addEventListener('change', () => field.removeAttribute('aria-invalid'));
  });
}

function bindEnrollment() {
  const existingStudent = loadStudent();
  if (existingStudent) showAdmission(existingStudent);

  const form = $('#admissionForm');
  if (admissionPreviewMode()) { pauseNewAdmissions(form); return; }
  const status = $('#admissionStatus');
  bindFieldCleanup(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = '';

    if (!form.checkValidity()) {
      markInvalidFields(form);
      status.textContent = 'Please complete every required field and confirm guardian consent.';
      return;
    }
    if (!pinsMatch('#studentPin', '#confirmPin', status)) return;

    const savedStudent = loadStudent();
    if (savedStudent) {
      showAdmission(savedStudent);
      return;
    }

    const studentClass = Number($('#studentClass').value);
    if (!Number.isInteger(studentClass) || studentClass < 1 || studentClass > 12) {
      $('#studentClass').setAttribute('aria-invalid', 'true');
      status.textContent = 'Please select a valid class.';
      return;
    }

    const loginId = normalizeLogin($('#studentLogin').value);
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
      const pinSalt = randomHex();
      const student = {
        version: 2,
        admissionId: createAdmissionId(),
        studentName: cleanText($('#studentName').value, 80),
        studentClass,
        guardianName: cleanText($('#guardianName').value, 80),
        guardianEmail: cleanText($('#guardianEmail').value, 120).toLowerCase(),
        guardianPhone: cleanText($('#guardianPhone').value, 20),
        guardianConsent: true,
        loginId,
        pinSalt,
        pinHash: await hashPin(loginId, $('#studentPin').value, pinSalt),
        admittedAt: new Date().toISOString(),
      };

      if (!storage.setStudent(JSON.stringify(student))) throw new Error('Browser storage is unavailable.');
      form.reset();
      showAdmission(student);
      $('#admittedCard').focus();
    } catch (error) {
      submitButton.disabled = false;
      status.textContent = `${error.message || 'Admission could not be saved'} Please use a modern browser with storage enabled.`;
    }
  });
}

function bindLegacyLoginSetup() {
  const form = $('#loginSetupForm');
  const status = $('#setupStatus');
  bindFieldCleanup(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = '';
    if (!form.checkValidity()) {
      markInvalidFields(form);
      status.textContent = 'Please create a valid login ID and PIN.';
      return;
    }
    if (!pinsMatch('#setupPin', '#setupConfirmPin', status)) return;

    const student = loadStudent();
    if (!student) {
      status.textContent = 'The pilot admission could not be found.';
      return;
    }

    try {
      const loginId = normalizeLogin($('#setupLogin').value);
      const pinSalt = randomHex();
      const upgradedStudent = {
        ...student,
        version: 2,
        loginId,
        pinSalt,
        pinHash: await hashPin(loginId, $('#setupPin').value, pinSalt),
      };
      if (!storage.setStudent(JSON.stringify(upgradedStudent))) throw new Error('Browser storage is unavailable.');
      form.reset();
      showAdmission(upgradedStudent);
    } catch (error) {
      status.textContent = error.message || 'The login could not be saved.';
    }
  });
}

function bindLogin() {
  const form = $('#loginForm');
  const status = $('#loginStatus');
  bindFieldCleanup(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = '';

    if (Date.now() < loginLockedUntil) {
      status.textContent = 'Too many attempts. Please wait 30 seconds before trying again.';
      return;
    }
    if (!form.checkValidity()) {
      markInvalidFields(form);
      status.textContent = 'Enter the student login ID and 4–6 digit PIN.';
      return;
    }

    const student = loadStudent();
    if (!student) {
      status.textContent = 'No enrolled student was found on this device. Complete enrollment first.';
      return;
    }
    if (!hasLogin(student)) {
      closeLogin();
      showAdmission(student);
      $('#loginSetupForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const loginId = normalizeLogin($('#loginId').value);
    let valid = false;
    try {
      const suppliedHash = await hashPin(loginId, $('#loginPin').value, student.pinSalt);
      valid = loginId === student.loginId && suppliedHash === student.pinHash;
    } catch (error) {
      status.textContent = error.message || 'Secure login is unavailable in this browser.';
      return;
    }

    if (!valid) {
      loginFailures += 1;
      if (loginFailures >= MAX_LOGIN_FAILURES) {
        loginLockedUntil = Date.now() + LOGIN_COOLDOWN_MS;
        loginFailures = 0;
        status.textContent = 'Too many attempts. Login is paused for 30 seconds.';
      } else {
        status.textContent = 'The login ID or PIN is incorrect.';
      }
      return;
    }

    loginFailures = 0;
    if (!storage.setSession(student.admissionId)) {
      status.textContent = 'The login session could not be created. Enable browser storage and try again.';
      return;
    }
    window.location.assign('./dashboard.html');
  });
}

function init() {
  if (window.__IGNITE_PLATFORM__?.identity?.enabled) {
    // Firebase account UI owns login. The separate enquiry form owns Sheets intake.
    pauseNewAdmissions($('#admissionForm'));
    return;
  }
  bindDialog();
  bindEnrollmentRecord();
  bindQuickPaste();
  if (cloudIdentityMode()) {
    bindCloudIdentity();
    bindCloudEnrollment();
  } else {
    bindEnrollment();
    bindLegacyLoginSetup();
    bindLogin();
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
