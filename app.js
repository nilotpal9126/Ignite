'use strict';

const PROGRESS_KEY = 'ignite-demo-progress';
const FOCUS_KEY = 'ignite-focus-mode';
const STUDENT_KEY = 'ignite-pilot-student-v1';
const SESSION_KEY = 'ignite-pilot-session-v1';

/* ---------- safe storage: never let a blocked/corrupt store break the app ---------- */
const storage = {
  get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { window.localStorage.setItem(key, value); return true; } catch { return false; } },
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
  learnerId: '',
  activePractice: null,
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

/* ---------- public practice content; staff drafts never enter the learner renderer ---------- */
function pilotContentFor(originalFilename) {
  const items = window.__IGNITE_PILOT_CONTENT__?.items;
  if (!originalFilename || !Array.isArray(items)) return null;
  const match = items.find((entry) => window.IgnitePractice.playable(entry) && entry.catalog?.originalFilename === originalFilename);
  return match || null;
}

/* Original practice sets have no source file in the library, so they become catalogue entries of their own. */
function standaloneItems() {
  const items = window.__IGNITE_PILOT_CONTENT__?.items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((entry) => window.IgnitePractice.playable(entry) && !entry.catalog?.originalFilename)
    .map((entry) => {
      const subject = String(entry.subject || 'Unclassified');
      const grade = Number(entry.classLevel);
      return {
        title: String(entry.title || 'Practice set'),
        subject,
        grades: Number.isFinite(grade) ? [grade] : [],
        documentKind: 'practice set',
        kind: 'practice',
        format: 'ONLINE',
        byteSize: null,
        content: entry,
        search: `${entry.title} ${subject} ${entry.chapter || ''}`.toLowerCase(),
      };
    });
}

const isOpenToStudents = (item) => window.IgnitePractice.playable(item.content);

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
      const available = state.items.filter((item) => item.subject === subject && isOpenToStudents(item)).length;
      const countEl = Object.assign(document.createElement('small'), { textContent: `${available} practice sets · ${count - available} source candidates` });
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
    const sizeText = item.byteSize ? formatSize(item.byteSize) : `${item.content?.questions?.length || 0} questions`;
    fragment.querySelector('.worksheet-meta').textContent =
      `${gradeLabel(item.grades)} · ${kindText.charAt(0).toUpperCase()}${kindText.slice(1)} · ${sizeText}`;
    const button = fragment.querySelector('.worksheet-footer button');
    if (isOpenToStudents(item)) {
      const tier = item.content.visibility;
      fragment.querySelector('.review-state').textContent = tier === 'student' ? 'Published' : tier === 'demo_sample' ? 'Sample · unreviewed' : 'Draft · staff preview';
      const answers = window.IgnitePractice.restore(item.content, storage.get(window.IgnitePractice.key(state.learnerId, item.content.id)));
      const savedScore = window.IgnitePractice.score(item.content.questions, answers);
      button.textContent = savedScore.complete ? 'Review results' : savedScore.answered ? 'Resume practice' : 'Start practice';
      button.setAttribute('aria-label', `${button.textContent}: ${item.title}`);
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
  const openSets = filtered.filter(isOpenToStudents).length;
  setText('#resultCount', `${filtered.length} inventory candidate${filtered.length === 1 ? '' : 's'} found · ${openSets} practice set${openSets === 1 ? '' : 's'} open`);
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
  if (!window.IgnitePractice.playable(content)) return;
  const key = window.IgnitePractice.key(state.learnerId, content.id);
  state.activePractice = {
    item, key, content, mode: 'full',
    answers: window.IgnitePractice.restore(content, storage.get(key)),
    retryAnswers: Object.create(null), questions: content.questions,
  };
  const isDraft = content.visibility !== 'student';
  setText('#worksheetEyebrow', content.visibility === 'demo_sample' ? 'SAMPLE PRACTICE · UNREVIEWED' : isDraft ? 'DRAFT · STAFF PREVIEW' : 'WORKSHEET');
  setText('#worksheetDialogTitle', content.title || item.title);
  setText('#worksheetMeta', [`Class ${content.classLevel}`, content.subject, content.chapter].filter(Boolean).join(' · '));
  const notice = $('#worksheetNotice');
  notice.textContent = content.notice || '';
  notice.hidden = !(isDraft && content.notice);
  setText('#practiceSaveStatus', 'Your answers are saved on this device so you can return later.');
  renderPracticeQuestions();
  showDialog($('#worksheetDialog'));
}

function renderPracticeQuestions() {
  const attempt = state.activePractice;
  if (!attempt) return;
  const list = $('#worksheetQuestions');
  list.replaceChildren();
  for (const question of attempt.questions) {
    const entry = document.createElement('li');
    entry.value = question.no;
    entry.append(Object.assign(document.createElement('p'), { className: 'q-text', textContent: question.text }));
    entry.append(buildOptions(question, attempt));
    list.append(entry);
  }
  updatePracticeSummary();
  list.scrollTop = 0;
}

function updatePracticeSummary() {
  const attempt = state.activePractice;
  const answers = attempt.mode === 'retry' ? attempt.retryAnswers : attempt.answers;
  const result = window.IgnitePractice.score(attempt.questions, answers);
  setText('#worksheetCount', `${attempt.mode === 'retry' ? 'Retry · ' : ''}${result.answered} of ${result.total} answered · ${result.correct} correct`);
  $('#practiceSummary').hidden = !result.complete;
  $('#retryMistakes').hidden = attempt.mode === 'retry' || !result.mistakes.length;
  if (result.complete) {
    setText('#practiceSummaryTitle', attempt.mode === 'retry' ? 'Mistake review complete' : 'Practice complete');
    const score = `${result.correct}/${result.total} correct (${Math.round(100 * result.correct / result.total)}%)`;
    setText('#practiceSummaryText', attempt.mode === 'retry'
      ? `${score} on this retry. Your original attempt score is preserved. You can finish here.`
      : `${score}. ${result.mistakes.length ? 'Review the explanations, then retry just the mistakes.' : 'Well done. You can finish here.'}`);
  }
}

function renderPracticeProgress() {
  let completed = 0;
  let correct = 0;
  let total = 0;
  for (const content of window.__IGNITE_PILOT_CONTENT__?.items || []) {
    if (!window.IgnitePractice.playable(content)) continue;
    const saved = storage.get(window.IgnitePractice.key(state.learnerId, content.id));
    const result = window.IgnitePractice.score(content.questions, window.IgnitePractice.restore(content, saved));
    if (!result.complete) continue;
    completed += 1; correct += result.correct; total += result.total;
  }
  setText('#practiceCompletedCount', completed);
  setText('#practiceAccuracy', total ? `${Math.round(100 * correct / total)}%` : '—');
}

/* Each question locks on its first choice; reopening restores that choice. */
function buildOptions(question, attempt) {
  const wrap = document.createElement('div');
  wrap.className = 'q-options';
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', `Choices for question ${question.no}`);
  const feedback = Object.assign(document.createElement('p'), { className: 'q-feedback' });
  feedback.setAttribute('role', 'status');
  feedback.hidden = true;
  const letters = 'ABCDEFGH';
  const answers = attempt.mode === 'retry' ? attempt.retryAnswers : attempt.answers;
  const paintFeedback = (index) => {
    const correct = index === question.answerIndex;
    buttons.forEach((other, otherIndex) => {
      other.disabled = true;
      other.setAttribute('aria-pressed', String(otherIndex === index));
      if (otherIndex === question.answerIndex) other.classList.add('is-correct');
      else if (otherIndex === index) other.classList.add('is-wrong');
    });
    feedback.textContent = correct
      ? `Correct. ${question.explanation}`
      : `Not quite. The answer is ${letters[question.answerIndex]}. ${question.explanation}`;
    feedback.classList.toggle('is-correct', correct);
    feedback.hidden = false;
  };
  const buttons = question.options.map((option, index) => {
    const button = Object.assign(document.createElement('button'), {
      type: 'button', // inside a dialog form: must never submit
      className: 'q-option',
      textContent: `${letters[index]}. ${option}`,
    });
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      if (Number.isInteger(answers[question.id])) return;
      answers[question.id] = index;
      paintFeedback(index);
      if (attempt.mode === 'full') {
        const saved = storage.set(attempt.key, JSON.stringify({ version: window.IgnitePractice.version(attempt.content), answers: attempt.answers }));
        setText('#practiceSaveStatus', saved ? 'Answers saved on this device.' : 'This browser could not save your answers. Keep this page open to retain them.');
        renderPracticeProgress();
      }
      updatePracticeSummary();
    });
    return button;
  });
  wrap.append(...buttons, feedback);
  if (Number.isInteger(answers[question.id])) paintFeedback(answers[question.id]);
  return wrap;
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
  $('#retryMistakes').addEventListener('click', () => {
    const attempt = state.activePractice;
    if (!attempt) return;
    const result = window.IgnitePractice.score(attempt.content.questions, attempt.answers);
    if (!result.complete || !result.mistakes.length) return;
    attempt.mode = 'retry';
    attempt.questions = attempt.content.questions.filter((q) => result.mistakes.includes(q.id));
    attempt.retryAnswers = Object.create(null);
    setText('#practiceSaveStatus', 'Retry your mistakes. Your original score stays saved; this retry lasts until you close the set.');
    renderPracticeQuestions();
    $('#worksheetQuestions button')?.focus();
  });
  $('#restartPractice').addEventListener('click', () => {
    const attempt = state.activePractice;
    if (!attempt) return;
    attempt.mode = 'full';
    attempt.questions = attempt.content.questions;
    attempt.answers = Object.create(null);
    const saved = storage.set(attempt.key, JSON.stringify({ version: window.IgnitePractice.version(attempt.content), answers: attempt.answers }));
    setText('#practiceSaveStatus', saved ? 'New attempt started. Your previous attempt has been replaced on this device.' : 'This attempt cannot be saved in this browser.');
    renderPracticeQuestions();
    renderPracticeProgress();
    $('#worksheetQuestions button')?.focus();
  });
  $('#worksheetDialog').addEventListener('close', () => {
    state.activePractice = null;
    if (state.catalog) renderWorksheets();
  });
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
    const practiceSets = standaloneItems();
    state.items = [...practiceSets, ...catalog.worksheets.map(normalizeItem).filter(Boolean)];
    state.catalog = catalog;

    const count = Number.isFinite(Number(catalog.inventory?.documentCount)) ? Number(catalog.inventory.documentCount) : state.items.length - practiceSets.length;
    const openCount = state.items.filter(isOpenToStudents).length;
    setText('#sourceTitle', 'Source library ready');
    setText('#sourceCount', `${count} candidates indexed · ${openCount} practice set${openCount === 1 ? '' : 's'} open`);
    $('.sidebar-note')?.classList.remove('is-error');

    const subjectSelect = $('#subjectFilter');
    const gradeSelect = $('#gradeFilter');
    subjectSelect.length = 1;
    gradeSelect.length = 1;
    [...new Set(state.items.map((item) => item.subject))].sort().forEach((s) => subjectSelect.add(new Option(s, s)));
    for (let grade = 4; grade <= 12; grade += 1) gradeSelect.add(new Option(`Class ${grade}`, String(grade)));

    renderSubjects();
    renderWorksheets();
    renderPracticeProgress();
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
  state.learnerId = admittedStudent.admissionId;
  renderProgress();
  bindControls();
  trackActiveSection();
  if (storage.get(FOCUS_KEY) === '1') setFocusMode(true);
  loadAndRender();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
