'use strict';

const PROGRESS_KEY = 'ignite-demo-progress';
const FOCUS_KEY = 'ignite-focus-mode';
const STUDENT_KEY = 'ignite-pilot-student-v1';
const SESSION_KEY = 'ignite-pilot-session-v1';

/* ---------- safe storage: never let a blocked/corrupt store break the app ---------- */
const storage = {
  get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { window.localStorage.setItem(key, value); } catch { /* private mode / quota: progress simply won't persist */ } },
  getSession(key) { try { return window.sessionStorage.getItem(key); } catch { return null; } },
  removeSession(key) { try { window.sessionStorage.removeItem(key); } catch { /* redirect still completes */ } },
};

const clampNumber = (value, min, max) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};

function loadAdmittedStudent() {
  try {
    const student = JSON.parse(storage.get(STUDENT_KEY) || 'null');
    if (!student || typeof student !== 'object') return null;
    if (!student.studentName || !student.studentClass || !student.admissionId) return null;
    return student;
  } catch {
    return null;
  }
}

function applyStudentProfile(student) {
  const name = String(student.studentName).trim();
  const firstName = name.split(/\s+/)[0] || 'Student';
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'ST';
  setText('.profile-copy strong', firstName);
  setText('.profile-copy small', `Class ${student.studentClass}`);
  setText('.avatar', initials);
  $('.profile-button')?.setAttribute('aria-label', `Student profile: ${name}, Class ${student.studentClass}`);
  document.title = `${firstName}'s Dashboard | Project Ignite`;
}

function logOut() {
  storage.removeSession(SESSION_KEY);
  window.location.assign('./index.html#login');
}

function loadProgress() {
  const fallback = { completed: 0, minutes: 0, mastery: 0 };
  try {
    const raw = JSON.parse(storage.get(PROGRESS_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return fallback;
    return {
      completed: Math.round(clampNumber(raw.completed, 0, 100000)),
      minutes: Math.round(clampNumber(raw.minutes, 0, 1000000)),
      mastery: Math.round(clampNumber(raw.mastery, 0, 100)),
    };
  } catch {
    return fallback;
  }
}

const state = {
  catalog: null,
  items: [],
  query: '',
  subject: 'all',
  grade: 'all',
  kind: 'all',
  page: 1,
  pageSize: 9,
  missionStep: 1,
  progress: loadProgress(),
};

const subjectVisuals = {
  Mathematics: [`<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2m4 0h2M8 15h2m4 0h2M8 18h2m4 0h2"/>`, '#dff04f'],
  Biology: [`<path d="M20 4c-7 0-12 3.5-12 9a5 5 0 0 0 5 5c5.5 0 7-7 7-14Z"/><path d="M4 20c2.5-5 6.5-8 12-10"/>`, '#bfe6d3'],
  Chemistry: [`<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3M7.5 16h9"/><circle cx="10" cy="18" r=".6"/><circle cx="14" cy="18.5" r=".6"/>`, '#a9d8f1'],
  Physics: [`<ellipse cx="12" cy="12" rx="9" ry="3.8"/><ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(120 12 12)"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>`, '#ffe08a'],
  English: [`<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11a3 3 0 0 1 3 3v15a3 3 0 0 0-3-3H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H14v18a3 3 0 0 1 3-3h.5a2.5 2.5 0 0 1 2.5 2.5z"/>`, '#ffb59d'],
  'Science (General)': [`<path d="M9 3h6M10 3v5l-3 3M8 11l5 5M14 8l-3 3M13 16l3 3M6 21h12"/><circle cx="8" cy="11" r="2"/><path d="M16 19a5 5 0 0 1-7 0"/>`, '#c8d4ff'],
  'Social Studies': [`<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>`, '#f2c6df'],
  'Mixed & Assessments': [`<path d="M9 5h6M9 3h6v4H9z"/><path d="M7 5H5v16h14V5h-2"/><path d="m8 14 2.5 2.5L16 11"/>`, '#d8dedc'],
};

const defaultSubjectVisual = [`<path d="M4 7h6l2 2h8v11H4z"/><path d="M4 7V5h6l2 2"/>`, '#d8dedc'];

const subjectLabels = {
  biology: 'Biology', chemistry: 'Chemistry', english: 'English', mathematics: 'Mathematics',
  physics: 'Physics', science_general: 'Science (General)', social_studies: 'Social Studies',
  mixed: 'Mixed & Assessments', unknown: 'Unclassified',
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const formatSize = (bytes) => {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return 'size unknown';
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
};
const gradeLabel = (grades) => (grades.length ? `Class ${grades.join(' / ')}` : 'Class to review');

function kindOf(documentKind) {
  if (['answer_key', 'marking_scheme'].includes(documentKind)) return 'answer-key';
  if (['assessment', 'revision'].includes(documentKind)) return 'assessment';
  return 'practice';
}

/* ---------- normalise catalog entries once so rendering/filtering can't crash on gaps ---------- */
function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const classification = raw.classification || {};
  const title = String(raw.content?.title || '').trim() || 'Untitled worksheet';
  const subject = subjectLabels[classification.subject] || 'Unclassified';
  const grades = (Array.isArray(classification.grades) ? classification.grades : [])
    .map(Number).filter(Number.isFinite);
  const documentKind = String(classification.documentKind || 'worksheet');
  const content = pilotContentFor(raw.sourceFile?.originalFilename);
  return {
    title,
    subject,
    grades,
    documentKind,
    kind: kindOf(documentKind),
    format: raw.sourceFile?.mediaType === 'application/pdf' ? 'PDF' : 'DOCX',
    byteSize: raw.sourceFile?.byteSize,
    content,
    search: `${title} ${subject} ${content ? `${content.title} ${content.chapter}` : ''}`.toLowerCase(),
  };
}

/* ---------- worksheet content (drafts are staff-preview only; answers never ship to the browser) ---------- */
function pilotContentFor(originalFilename) {
  const items = window.__IGNITE_PILOT_CONTENT__?.items;
  if (!originalFilename || !Array.isArray(items)) return null;
  const match = items.find((entry) => entry?.catalog?.originalFilename === originalFilename && Array.isArray(entry.questions) && entry.questions.length);
  return match || null;
}

function setText(selector, text) {
  const el = $(selector);
  if (el) el.textContent = text;
}

function showDialog(dialog) {
  if (!dialog || dialog.open) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}
function closeDialog(dialog) {
  if (!dialog || !dialog.open) return;
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

/* ---------- progress ---------- */
function renderProgress() {
  setText('#completedCount', state.progress.completed);
  setText('#focusMinutes', state.progress.minutes);
  setText('#masteryScore', `${state.progress.mastery}%`);
  const percent = Math.min(100, state.progress.completed * 25);
  setText('#missionPercent', `${percent}%`);
  document.documentElement.style.setProperty('--mission-progress', `${percent}%`);
}

function saveProgress() {
  storage.set(PROGRESS_KEY, JSON.stringify(state.progress));
  renderProgress();
}

/* ---------- subjects ---------- */
function renderSubjects() {
  const grid = $('#subjectGrid');
  grid.replaceChildren();
  const counts = new Map();
  for (const item of state.items) counts.set(item.subject, (counts.get(item.subject) || 0) + 1);

  [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .forEach(([subject, count]) => {
      const [icon, color] = subjectVisuals[subject] || defaultSubjectVisual;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'subject-card';
      button.style.setProperty('--subject-color', color);
      const iconEl = Object.assign(document.createElement('span'), { className: 'subject-icon' });
      iconEl.innerHTML = `<svg viewBox="0 0 24 24" focusable="false">${icon}</svg>`;
      iconEl.setAttribute('aria-hidden', 'true');
      const nameEl = Object.assign(document.createElement('strong'), { textContent: subject });
      const countEl = Object.assign(document.createElement('small'), { textContent: `${count} source file${count === 1 ? '' : 's'}` });
      button.append(iconEl, nameEl, countEl);
      button.addEventListener('click', () => {
        leaveFocusMode();
        state.subject = subject;
        state.page = 1;
        $('#subjectFilter').value = subject;
        renderWorksheets();
        $('#library').scrollIntoView();
      });
      grid.append(button);
    });
}

/* ---------- worksheets ---------- */
function filteredWorksheets() {
  const query = state.query.trim().toLowerCase();
  const grade = state.grade === 'all' ? null : Number(state.grade);
  return state.items.filter((item) =>
    (!query || item.search.includes(query))
    && (state.subject === 'all' || item.subject === state.subject)
    && (grade === null || item.grades.includes(grade))
    && (state.kind === 'all' || item.kind === state.kind));
}

function emptyCard(title, message, withClear) {
  const card = document.createElement('article');
  card.className = 'worksheet-card is-empty';
  const h3 = Object.assign(document.createElement('h3'), { textContent: title });
  const p = Object.assign(document.createElement('p'), { className: 'worksheet-meta', textContent: message });
  card.append(h3, p);
  if (withClear) {
    const clear = Object.assign(document.createElement('button'), { type: 'button', className: 'text-button', textContent: 'Clear filters' });
    clear.addEventListener('click', clearFilters);
    card.append(clear);
  }
  return card;
}

function renderWorksheets() {
  const filtered = filteredWorksheets();
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  state.page = Math.min(Math.max(1, state.page), totalPages);
  const start = (state.page - 1) * state.pageSize;
  const grid = $('#worksheetGrid');
  const template = $('#worksheetTemplate');
  grid.replaceChildren();

  for (const item of filtered.slice(start, start + state.pageSize)) {
    const fragment = template.content.cloneNode(true);
    fragment.querySelector('.subject-pill').textContent = item.subject;
    fragment.querySelector('.format-pill').textContent = item.format;
    const heading = fragment.querySelector('h3');
    heading.textContent = item.title;
    heading.title = item.title;
    const kindText = item.documentKind.replaceAll('_', ' ');
    fragment.querySelector('.worksheet-meta').textContent =
      `${gradeLabel(item.grades)} · ${kindText.charAt(0).toUpperCase()}${kindText.slice(1)} · ${formatSize(item.byteSize)}`;
    const button = fragment.querySelector('.worksheet-footer button');
    if (item.content) {
      fragment.querySelector('.review-state').textContent = item.content.visibility === 'student' ? 'Published' : 'Draft · staff preview';
      button.textContent = 'Open worksheet';
      button.setAttribute('aria-label', `Open worksheet: ${item.title}`);
      button.addEventListener('click', () => openWorksheet(item));
    } else {
      button.setAttribute('aria-label', `Preview journey for ${item.title}`);
      button.addEventListener('click', () => openMission(item));
    }
    grid.append(fragment);
  }

  if (!filtered.length) {
    grid.append(emptyCard('No worksheets match yet.', 'Try a shorter search, or clear one or more filters.', true));
  }
  setText('#resultCount', `${filtered.length} inventory candidate${filtered.length === 1 ? '' : 's'} found · 0 published`);
  setText('#pageStatus', `Page ${state.page} of ${totalPages}`);
  $('#previousPage').disabled = state.page <= 1;
  $('#nextPage').disabled = state.page >= totalPages;
}

function clearFilters() {
  state.query = ''; state.subject = 'all'; state.grade = 'all'; state.kind = 'all'; state.page = 1;
  $('#searchInput').value = '';
  $('#subjectFilter').value = 'all';
  $('#gradeFilter').value = 'all';
  $('#kindFilter').value = 'all';
  renderWorksheets();
}

/* ---------- mission ---------- */
function resetMission() {
  state.missionStep = 1;
  setText('#missionDialogTitle', 'Linear equations');
  setText('#missionInstruction', 'Step 1 of 3 · Take a breath and solve this warm-up mentally.');
  setText('#missionQuestion', 'If 3x + 5 = 20, what is x?');
  setText('#missionStepStatus', 'Step 1 of 3');
  setText('#nextMissionStep', 'Continue');
  $('#nextMissionStep').disabled = true;
  setText('#answerFeedback', '');
  $('#answerOptions').hidden = false;
  $$('#answerOptions button').forEach((button) => button.classList.remove('selected', 'is-wrong'));
}

function openMission(item) {
  resetMission();
  if (item) {
    setText('#missionDialogTitle', item.title);
    setText('#missionInstruction', `${gradeLabel(item.grades)} · ${item.subject} · Staff-only journey preview`);
  }
  showDialog($('#missionDialog'));
}

function openWorksheet(item) {
  const content = item.content;
  if (!content) return;
  const isDraft = content.visibility !== 'student';
  setText('#worksheetEyebrow', isDraft ? 'DRAFT · STAFF PREVIEW' : 'WORKSHEET');
  setText('#worksheetDialogTitle', content.title || item.title);
  setText('#worksheetMeta', [`Class ${content.classLevel}`, content.subject, content.chapter].filter(Boolean).join(' · '));
  const notice = $('#worksheetNotice');
  notice.textContent = content.notice || '';
  notice.hidden = !(isDraft && content.notice);
  const list = $('#worksheetQuestions');
  list.replaceChildren();
  for (const question of content.questions) {
    const entry = document.createElement('li');
    entry.value = question.no;
    entry.textContent = question.text;
    list.append(entry);
  }
  setText('#worksheetCount', `${content.questions.length} questions`);
  showDialog($('#worksheetDialog'));
}

function nextMissionStep() {
  state.missionStep += 1;
  const next = $('#nextMissionStep');
  if (state.missionStep === 2) {
    setText('#missionInstruction', 'Step 2 of 3 · Work through the source worksheet for eight focused minutes.');
    setText('#missionQuestion', 'The full source file is ready for academic review and ingestion. For this UX prototype, mark the focused practice step complete.');
    $('#answerOptions').hidden = true;
    setText('#answerFeedback', 'No file is published to students yet.');
    next.disabled = false;
    next.textContent = 'Mark practice done';
  } else if (state.missionStep === 3) {
    setText('#missionInstruction', 'Step 3 of 3 · Capture one thing you understand better now.');
    setText('#missionQuestion', 'Review complete. You can end the session here—there is no endless feed.');
    $('#answerOptions').hidden = true;
    setText('#answerFeedback', 'A short finish is a successful finish.');
    next.disabled = false;
    next.textContent = 'Finish mission';
  } else {
    state.progress.completed += 1;
    state.progress.minutes += 12;
    state.progress.mastery = Math.min(100, state.progress.mastery + 8);
    saveProgress();
    closeDialog($('#missionDialog'));
    return;
  }
  setText('#missionStepStatus', `Step ${state.missionStep} of 3`);
}

/* ---------- focus mode ---------- */
function setFocusMode(active) {
  document.body.classList.toggle('focus-mode', active);
  $('#focusToggle').setAttribute('aria-pressed', String(active));
  storage.set(FOCUS_KEY, active ? '1' : '0');
}
function leaveFocusMode() {
  if (document.body.classList.contains('focus-mode')) setFocusMode(false);
}

/* ---------- navigation highlight follows the section in view ---------- */
function trackActiveSection() {
  const links = $$('.sidebar a.nav-item, .mobile-nav a');
  const sections = ['home', 'library', 'progress'].map((id) => document.getElementById(id)).filter(Boolean);
  if (!links.length || !('IntersectionObserver' in window)) return;
  const setActive = (id) => links.forEach((link) => {
    const on = link.getAttribute('href') === `#${id}`;
    link.classList.toggle('active', on);
    if (on) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current');
  });
  const visible = new Map();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
    const best = [...visible.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] > 0) setActive(best[0]);
  }, { rootMargin: '-72px 0px -45% 0px', threshold: [0, 0.15, 0.4, 0.7] });
  sections.forEach((section) => observer.observe(section));
}

/* ---------- controls: bound before data loads, so the shell is always alive ---------- */
function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

function goToPage(delta) {
  state.page += delta;
  renderWorksheets();
  $('#library').scrollIntoView();
}

function bindControls() {
  const ready = (fn) => (...args) => { if (state.catalog) fn(...args); };

  $('#searchInput').addEventListener('input', debounce(ready((event) => {
    state.query = event.target.value; state.page = 1; renderWorksheets();
  }), 120));
  $('#gradeFilter').addEventListener('change', ready((event) => { state.grade = event.target.value; state.page = 1; renderWorksheets(); }));
  $('#subjectFilter').addEventListener('change', ready((event) => { state.subject = event.target.value; state.page = 1; renderWorksheets(); }));
  $('#kindFilter').addEventListener('change', ready((event) => { state.kind = event.target.value; state.page = 1; renderWorksheets(); }));
  $('#previousPage').addEventListener('click', ready(() => goToPage(-1)));
  $('#nextPage').addEventListener('click', ready(() => goToPage(1)));
  $('#clearFilters').addEventListener('click', ready(clearFilters));

  $('#focusToggle').addEventListener('click', () => setFocusMode(!document.body.classList.contains('focus-mode')));

  ['#startMission', '#missionNav', '#mobileMission'].forEach((selector) => {
    $(selector).addEventListener('click', () => openMission());
  });
  $('#changeMission').addEventListener('click', () => {
    leaveFocusMode();
    $('#library').scrollIntoView();
  });
  ['#openDoubt', '#doubtNav'].forEach((selector) => {
    $(selector).addEventListener('click', () => showDialog($('#doubtDialog')));
  });
  ['#logoutNav', '#mobileLogout'].forEach((selector) => {
    $(selector).addEventListener('click', logOut);
  });

  $('#nextMissionStep').addEventListener('click', nextMissionStep);
  $$('#answerOptions button').forEach((button) => button.addEventListener('click', () => {
    const correct = button.dataset.answer === '5';
    $$('#answerOptions button').forEach((item) => {
      item.classList.toggle('selected', item === button && correct);
      item.classList.toggle('is-wrong', item === button && !correct);
    });
    setText('#answerFeedback', correct ? 'Correct. 3x = 15, so x = 5.' : 'Not quite. Subtract 5 first, then divide by 3.');
    $('#nextMissionStep').disabled = !correct;
  }));

  // Click on the dimmed backdrop closes a dialog; the doubt form is cleared so nothing lingers.
  $$('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => { if (event.target === dialog) closeDialog(dialog); });
  });
  $('#doubtDialog').addEventListener('close', () => $('#doubtDialog form').reset());
}

/* ---------- catalog loading ---------- */
async function loadCatalog() {
  if (window.__IGNITE_CATALOG__) return window.__IGNITE_CATALOG__;
  const response = await fetch('./data/catalog.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
  return response.json();
}

function showLoadError(error) {
  setText('#resultCount', 'The worksheet catalog could not be loaded.');
  setText('#sourceTitle', 'Source library unavailable');
  setText('#sourceCount', 'Catalog not loaded');
  $('.sidebar-note')?.classList.add('is-error');
  const grid = $('#worksheetGrid');
  grid.replaceChildren();
  const card = document.createElement('article');
  card.className = 'worksheet-card is-empty';
  const hint = window.location.protocol === 'file:'
    ? 'Open this page from the full dist folder, or serve it with a local static server.'
    : 'Check your connection and try again.';
  card.append(
    Object.assign(document.createElement('h3'), { textContent: 'Catalog unavailable' }),
    Object.assign(document.createElement('p'), { className: 'worksheet-meta', textContent: `${error?.message || 'Unknown error'}. ${hint}` }),
  );
  const retry = Object.assign(document.createElement('button'), { type: 'button', className: 'text-button', textContent: 'Try again' });
  retry.addEventListener('click', () => { grid.replaceChildren(); loadAndRender(); });
  card.append(retry);
  grid.append(card);
  setText('#pageStatus', 'Page 1');
  $('#previousPage').disabled = true;
  $('#nextPage').disabled = true;
}

async function loadAndRender() {
  setText('#resultCount', 'Loading worksheets…');
  try {
    const catalog = await loadCatalog();
    if (!catalog || !Array.isArray(catalog.worksheets)) throw new Error('Catalog is missing its worksheet list');
    state.items = catalog.worksheets.map(normalizeItem).filter(Boolean);
    state.catalog = catalog;

    const count = Number.isFinite(Number(catalog.inventory?.documentCount)) ? Number(catalog.inventory.documentCount) : state.items.length;
    setText('#sourceTitle', 'Source library ready');
    setText('#sourceCount', `${count} candidates indexed · 0 published`);
    $('.sidebar-note')?.classList.remove('is-error');

    const subjectSelect = $('#subjectFilter');
    const gradeSelect = $('#gradeFilter');
    subjectSelect.length = 1;
    gradeSelect.length = 1;
    [...new Set(state.items.map((item) => item.subject))].sort().forEach((s) => subjectSelect.add(new Option(s, s)));
    for (let grade = 4; grade <= 12; grade += 1) gradeSelect.add(new Option(`Class ${grade}`, String(grade)));

    renderSubjects();
    renderWorksheets();
  } catch (error) {
    console.error(error);
    showLoadError(error);
  }
}

function init() {
  const admittedStudent = loadAdmittedStudent();
  if (!admittedStudent || storage.getSession(SESSION_KEY) !== admittedStudent.admissionId) {
    window.location.replace(admittedStudent ? './index.html#login' : './index.html#admission');
    return;
  }
  applyStudentProfile(admittedStudent);
  renderProgress();
  bindControls();
  trackActiveSection();
  if (storage.get(FOCUS_KEY) === '1') setFocusMode(true);
  loadAndRender();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
