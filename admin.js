'use strict';

const OWNER_KEY = 'ignite-owner-v1';
const OWNER_SESSION_KEY = 'ignite-owner-session-v1';
const STUDENT_KEY = 'ignite-pilot-student-v1';
const STUDENT_PROGRESS_KEY = 'ignite-demo-progress';
const MAX_LOGIN_FAILURES = 5;
const LOGIN_COOLDOWN_MS = 30_000;

const $ = (selector) => document.querySelector(selector);
const cleanText = (value, maxLength) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
const normalizeEmail = (value) => cleanText(value, 120).toLowerCase();

let loginFailures = 0;
let loginLockedUntil = 0;

const storage = {
  getLocal(key) {
    try { return window.localStorage.getItem(key); }
    catch { return null; }
  },
  setLocal(key, value) {
    try { window.localStorage.setItem(key, value); return true; }
    catch { return false; }
  },
  getSession(key) {
    try { return window.sessionStorage.getItem(key); }
    catch { return null; }
  },
  setSession(key, value) {
    try { window.sessionStorage.setItem(key, value); return true; }
    catch { return false; }
  },
  removeSession(key) {
    try { window.sessionStorage.removeItem(key); }
    catch { /* logging out still updates the screen */ }
  },
};

function parseStoredObject(key) {
  try {
    const value = JSON.parse(storage.getLocal(key) || 'null');
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function loadOwner() {
  const owner = parseStoredObject(OWNER_KEY);
  if (!owner?.ownerId || !owner?.name || !owner?.email || !owner?.passwordHash || !owner?.passwordSalt) return null;
  return owner;
}

function loadStudent() {
  const student = parseStoredObject(STUDENT_KEY);
  if (!student?.admissionId || !student?.studentName || !student?.studentClass) return null;
  return student;
}

function loadProgress() {
  const progress = parseStoredObject(STUDENT_PROGRESS_KEY) || {};
  const safeNumber = (value, maximum) => Math.min(maximum, Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0));
  return {
    completed: Math.round(safeNumber(progress.completed, 100000)),
    minutes: Math.round(safeNumber(progress.minutes, 10000000)),
    mastery: Math.round(safeNumber(progress.mastery, 100)),
  };
}

function randomHex(byteLength = 16) {
  const values = new Uint8Array(byteLength);
  window.crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(email, password, salt) {
  if (!window.crypto?.subtle || !window.TextEncoder) throw new Error('Secure browser cryptography is unavailable.');
  const payload = new TextEncoder().encode(`${salt}:${normalizeEmail(email)}:${password}`);
  const digest = await window.crypto.subtle.digest('SHA-256', payload);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

function createOwnerId() {
  try { return `OWN-${randomHex(5).toUpperCase()}`; }
  catch { return `OWN-${Date.now().toString(36).toUpperCase()}`; }
}

function isOwnerSession(owner) {
  return Boolean(owner?.ownerId && storage.getSession(OWNER_SESSION_KEY) === owner.ownerId);
}

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = String(value);
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

function bindFieldCleanup(form) {
  form.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', () => field.removeAttribute('aria-invalid'));
    field.addEventListener('change', () => field.removeAttribute('aria-invalid'));
  });
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
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

function getCatalogMetrics() {
  const catalog = window.__IGNITE_CATALOG__;
  const worksheets = Array.isArray(catalog?.worksheets) ? catalog.worksheets : [];
  const published = worksheets.filter((item) => item?.publication?.studentVisible === true).length;
  return { indexed: worksheets.length, published, pending: Math.max(0, worksheets.length - published) };
}

function openStudentProfile(student, progress) {
  setText('#profileStudent', student.studentName);
  setText('#profileClass', `Class ${student.studentClass}`);
  setText('#profileGuardian', student.guardianName || 'Not provided');
  setText('#profileEmail', maskEmail(student.guardianEmail));
  setText('#profilePhone', maskPhone(student.guardianPhone));
  setText('#profileAdmissionId', student.admissionId);
  setText('#profileLogin', student.loginId || 'Login setup pending');
  setText('#profileDate', formatDate(student.admittedAt));
  setText('#profileMissions', progress.completed);
  setText('#profileMinutes', progress.minutes);
  setText('#profileMastery', `${progress.mastery}%`);

  const dialog = $('#studentProfileDialog');
  if (dialog.open) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function closeStudentProfile() {
  const dialog = $('#studentProfileDialog');
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

function appendCell(row, value) {
  const cell = document.createElement('td');
  cell.textContent = value;
  row.append(cell);
  return cell;
}

function renderStudents(student, progress) {
  const tableBody = $('#studentTableBody');
  tableBody.replaceChildren();
  $('#studentEmpty').hidden = Boolean(student);
  setText('#studentCountBadge', `${student ? 1 : 0} record${student ? '' : 's'}`);

  if (!student) return;

  const row = document.createElement('tr');
  const studentCell = appendCell(row, student.studentName);
  studentCell.dataset.label = 'Student';
  appendCell(row, `Class ${student.studentClass}`).dataset.label = 'Class';
  appendCell(row, student.admissionId).dataset.label = 'Admission ID';
  appendCell(row, formatDate(student.admittedAt)).dataset.label = 'Enrolled';

  const statusCell = document.createElement('td');
  statusCell.dataset.label = 'Status';
  const status = document.createElement('span');
  status.className = 'status-chip';
  status.textContent = 'Active';
  statusCell.append(status);
  row.append(statusCell);

  const actionCell = document.createElement('td');
  actionCell.dataset.label = 'Action';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'table-button';
  button.textContent = 'View profile';
  button.addEventListener('click', () => openStudentProfile(student, progress));
  actionCell.append(button);
  row.append(actionCell);
  tableBody.append(row);
}

function renderDashboard(owner) {
  const student = loadStudent();
  const progress = loadProgress();
  const content = getCatalogMetrics();

  setText('#ownerDisplayName', owner.name);
  setText('#ownerAvatar', owner.name.split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'OW');
  setText('#ownerScope', student ? `Reviewing ${student.studentName}'s local pilot profile.` : 'Reviewing data saved on this device.');
  setText('#metricStudents', student ? 1 : 0);
  setText('#metricMissions', progress.completed);
  setText('#metricMinutes', progress.minutes);
  setText('#metricMastery', `${progress.mastery}%`);
  setText('#contentIndexed', content.indexed);
  setText('#contentPublished', content.published);
  setText('#contentPending', content.pending);
  renderStudents(student, progress);
}

function showAuthentication(owner) {
  $('#ownerApp').hidden = true;
  $('#authView').hidden = false;
  $('#setupPanel').hidden = Boolean(owner);
  $('#loginPanel').hidden = !owner;
  if (owner) {
    $('#ownerLoginEmail').value = owner.email;
    window.setTimeout(() => $('#ownerLoginPassword').focus(), 0);
  } else {
    window.setTimeout(() => $('#ownerName').focus(), 0);
  }
}

function showOwnerApp(owner) {
  $('#authView').hidden = true;
  $('#ownerApp').hidden = false;
  renderDashboard(owner);
  document.title = `${owner.name}'s Owner Dashboard | Project Ignite`;
}

function bindSetup() {
  const form = $('#ownerSetupForm');
  const status = $('#setupStatus');
  bindFieldCleanup(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = '';

    if (!form.checkValidity()) {
      markInvalidFields(form);
      status.textContent = 'Please complete all owner account fields.';
      return;
    }

    const password = $('#ownerPassword').value;
    if (password !== $('#ownerPasswordConfirm').value) {
      $('#ownerPasswordConfirm').setAttribute('aria-invalid', 'true');
      $('#ownerPasswordConfirm').focus();
      status.textContent = 'The two password entries do not match.';
      return;
    }

    if (loadOwner()) {
      showAuthentication(loadOwner());
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      const email = normalizeEmail($('#ownerEmail').value);
      const passwordSalt = randomHex();
      const owner = {
        version: 1,
        ownerId: createOwnerId(),
        name: cleanText($('#ownerName').value, 80),
        email,
        role: 'owner',
        passwordSalt,
        passwordHash: await hashPassword(email, password, passwordSalt),
        createdAt: new Date().toISOString(),
      };

      if (!storage.setLocal(OWNER_KEY, JSON.stringify(owner)) || !storage.setSession(OWNER_SESSION_KEY, owner.ownerId)) {
        throw new Error('Browser storage is unavailable.');
      }
      form.reset();
      showOwnerApp(owner);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Owner setup could not be completed.';
    } finally {
      submitButton.disabled = false;
    }
  });
}

function bindLogin() {
  const form = $('#ownerLoginForm');
  const status = $('#loginStatus');
  bindFieldCleanup(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = '';

    const now = Date.now();
    if (now < loginLockedUntil) {
      status.textContent = `Please wait ${Math.ceil((loginLockedUntil - now) / 1000)} seconds before trying again.`;
      return;
    }
    if (!form.checkValidity()) {
      markInvalidFields(form);
      status.textContent = 'Enter the owner email and password.';
      return;
    }

    const owner = loadOwner();
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      const attemptedHash = owner
        ? await hashPassword(owner.email, $('#ownerLoginPassword').value, owner.passwordSalt)
        : '';
      const valid = Boolean(owner)
        && normalizeEmail($('#ownerLoginEmail').value) === owner.email
        && attemptedHash === owner.passwordHash;

      if (!valid) {
        loginFailures += 1;
        if (loginFailures >= MAX_LOGIN_FAILURES) {
          loginLockedUntil = Date.now() + LOGIN_COOLDOWN_MS;
          loginFailures = 0;
          status.textContent = 'Too many attempts. Please wait 30 seconds before trying again.';
        } else {
          status.textContent = 'The owner email or password is incorrect.';
        }
        return;
      }

      loginFailures = 0;
      storage.setSession(OWNER_SESSION_KEY, owner.ownerId);
      form.reset();
      showOwnerApp(owner);
    } catch {
      status.textContent = 'Owner sign-in is unavailable in this browser.';
    } finally {
      submitButton.disabled = false;
    }
  });
}

function bindDashboardActions() {
  $('#ownerLogout').addEventListener('click', () => {
    storage.removeSession(OWNER_SESSION_KEY);
    document.title = 'Owner Portal | Project Ignite';
    showAuthentication(loadOwner());
  });
  $('#closeStudentProfile').addEventListener('click', closeStudentProfile);
  $('#studentProfileDialog').addEventListener('click', (event) => {
    if (event.target === $('#studentProfileDialog')) closeStudentProfile();
  });
}

function init() {
  bindSetup();
  bindLogin();
  bindDashboardActions();

  const owner = loadOwner();
  if (owner && isOwnerSession(owner)) showOwnerApp(owner);
  else showAuthentication(owner);
}

init();
