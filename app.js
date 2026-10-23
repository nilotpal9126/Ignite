'use strict';

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
  const classLevel = Number(student.studentClass);
  state.studentClass = classLevel >= 1 && classLevel <= 12 ? classLevel : null;
  const name = String(student.studentName).trim();
  const firstName = name.split(/\s+/)[0] || 'Student';
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'ST';
  setText('.profile-copy strong', firstName);
  setText('.profile-copy small', state.studentClass ? `Class ${state.studentClass}` : 'Practice account');
  setText('.avatar', initials);
  $('.profile-button')?.setAttribute('aria-label', `Student profile: ${name}${state.studentClass ? `, Class ${state.studentClass}` : ''}`);
  document.title = `${firstName}'s Dashboard | Project Ignite`;
}

async function logOut() {
  if (window.__IGNITE_PLATFORM__?.identity?.enabled) {
    try { await window.IgniteIdentity.signOut(); }
    catch {
      const warning = document.querySelector('#accountSignoutStatus') || Object.assign(document.createElement('p'), {
        id: 'accountSignoutStatus', className: 'account-load-status',
      });
      warning.setAttribute('role', 'status');
      warning.textContent = 'Sign-out could not finish. Check your connection and try again.';
      document.querySelector('.app-shell').before(warning);
      return;
    }
  }
  storage.removeSession(SESSION_KEY);
  window.location.assign('./index.html#login');
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
  studentClass: null,
  learnerId: '',
  activePractice: null,
  activeRescue: null,
  activeFollowUp: null,
  followUpMemory: new Map(),
  activeReview: null,
  questionIndex: 0,
  returnFocus: null,
};

function newAttemptId() {
  return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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

function writeScience(element, text) {
  if (window.IgniteScienceText) window.IgniteScienceText.render(element, text, { chemistry: state.activePractice?.content.subject === 'Chemistry' });
  else if (element) element.textContent = text;
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
  const item = recommendedPractice();
  if (!item) {
    setText('#recommendedTitle', 'Choose a practice set');
    setText('#recommendedMeta', 'No playable set is available yet.');
    $('#startMission').disabled = true;
    return;
  }
  const content = item.content;
  const answers = window.IgnitePractice.restore(content, storage.get(window.IgnitePractice.key(state.learnerId, content.id)));
  const result = window.IgnitePractice.score(content.questions, answers);
  setText('#recommendedTitle', content.title);
  setText('#recommendedMeta', `Class ${content.classLevel} · ${content.subject} · ${content.questions.length} questions · ${content.visibility === 'student' ? 'Reviewed' : 'Sample, teacher review pending'}`);
  setText('#startMission', result.complete ? 'Review my practice' : result.answered ? 'Continue practice' : 'Start practice');
  $('#startMission').disabled = false;
  const percent = Math.round(100 * result.answered / result.total);
  setText('#missionPercent', `${percent}%`);
  document.documentElement.style.setProperty('--mission-progress', `${percent}%`);
}

function recommendedPractice() {
  const items = (state.items.length ? state.items : standaloneItems()).filter(isOpenToStudents);
  const suitable = items.filter((item) => !state.studentClass || item.content.classLevel === state.studentClass);
  const choices = suitable.length ? suitable : items;
  return choices.find((item) => {
    const content = item.content;
    const result = window.IgnitePractice.score(content.questions, window.IgnitePractice.restore(content,
      storage.get(window.IgnitePractice.key(state.learnerId, content.id))));
    return result.answered > 0 && !result.complete;
  }) || choices[0] || null;
}

function renderLevelsProgress() {
  const fallback = { xp: 0, levels: {}, badges: {} };
  let saved = fallback;
  try {
    const learner = encodeURIComponent(state.learnerId || 'guest');
    for (const key of [`ignite-levels-v2:${learner}`, `ignite-levels-v1:${learner}`]) {
      const candidate = JSON.parse(storage.get(key) || 'null');
      if (candidate && typeof candidate === 'object') { saved = candidate; break; }
    }
  } catch { /* A corrupt game record displays as fresh progress. */ }
  const levels = saved.levels && typeof saved.levels === 'object' ? Object.values(saved.levels) : [];
  const badges = saved.badges && typeof saved.badges === 'object' ? Object.keys(saved.badges) : [];
  const stars = levels.reduce((sum, level) => sum + (Number.isFinite(level?.stars) ? Math.max(0, level.stars) : 0), 0);
  const xp = Number.isFinite(saved.xp) ? Math.max(0, saved.xp) : 0;
  setText('#levelsXpCount', xp);
  setText('#levelsStarCount', stars);
  setText('#levelsBadgeCount', badges.length);
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
      button.dataset.subject = subject;
      button.setAttribute('aria-pressed', String(state.subject === subject));
      button.style.setProperty('--subject-color', color);
      const iconEl = Object.assign(document.createElement('span'), { className: 'subject-icon' });
      iconEl.innerHTML = `<svg viewBox="0 0 24 24" focusable="false">${icon}</svg>`;
      iconEl.setAttribute('aria-hidden', 'true');
      const nameEl = Object.assign(document.createElement('strong'), { textContent: subject });
      const available = state.items.filter((item) => item.subject === subject && isOpenToStudents(item)).length;
      const countEl = Object.assign(document.createElement('small'), { textContent: `${available} practice set${available === 1 ? '' : 's'}` });
      button.append(iconEl, nameEl, countEl);
      button.addEventListener('click', () => selectSubject(subject));
      grid.append(button);
    });
}

function selectSubject(subject) {
  leaveFocusMode();
  state.subject = subject; state.page = 1;
  // A previous query/class/type must not silently hide the newly selected subject.
  state.query = ''; state.grade = 'all'; state.kind = 'all';
  $('#searchInput').value = ''; $('#gradeFilter').value = 'all'; $('#kindFilter').value = 'all';
  $('#subjectFilter').value = subject;
  renderWorksheets(); renderSubjects();
  $('#library').scrollIntoView({ block: 'start' }); $('#libraryTitle').focus();
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
      const aiReviewed = item.content.review?.answerKey === 'ai_reviewed'
        && item.content.review?.independentCheck === 'second_model_agreed';
      const teamReviewed = item.content.review?.ownerReviewed === true;
      fragment.querySelector('.review-state').textContent = tier === 'student' ? 'Published'
        : tier === 'demo_sample' ? teamReviewed ? 'Reviewed by the Project Ignite team' : aiReviewed ? 'AI-reviewed · teacher review pending' : 'Sample · unreviewed'
        : 'Draft · staff preview';
      const answers = window.IgnitePractice.restore(item.content, storage.get(window.IgnitePractice.key(state.learnerId, item.content.id)));
      const savedScore = window.IgnitePractice.score(item.content.questions, answers);
      button.textContent = savedScore.complete ? 'Review results' : savedScore.answered ? 'Resume practice' : 'Start practice';
      button.setAttribute('aria-label', `${button.textContent}: ${item.title}`);
      button.addEventListener('click', () => openWorksheet(item));
    } else {
      button.textContent = 'Not available for practice';
      button.disabled = true;
    }
    grid.append(fragment);
  }

  if (!filtered.length) {
    grid.append(emptyCard('No worksheets match yet.', 'Try a shorter search, or clear one or more filters.', true));
  }
  const openSets = filtered.filter(isOpenToStudents).length;
  setText('#resultCount', `${openSets} practice set${openSets === 1 ? '' : 's'} available`);
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
function openMission() {
  const item = recommendedPractice();
  if (item) openWorksheet(item);
}

function openWorksheet(item) {
  if (state.activePractice) closeLearningWorkspace(false);
  const content = item.content;
  if (!window.IgnitePractice.playable(content)) return;
  const key = window.IgnitePractice.key(state.learnerId, content.id);
  let previous = null;
  try { previous = JSON.parse(storage.get(key) || 'null'); } catch { /* Start a fresh attempt. */ }
  state.activePractice = {
    item, key, content, mode: 'full',
    attemptId: previous?.version === window.IgnitePractice.version(content) && typeof previous.attemptId === 'string' && previous.attemptId.trim()
      ? previous.attemptId : newAttemptId(),
    answers: window.IgnitePractice.restore(content, storage.get(key)),
    retryAnswers: Object.create(null), questions: content.questions,
  };
  if (previous?.version === window.IgnitePractice.version(content) && previous.attemptId !== state.activePractice.attemptId) {
    storage.set(key, JSON.stringify({ version: window.IgnitePractice.version(content), attemptId: state.activePractice.attemptId, answers: state.activePractice.answers }));
  }
  state.activeRescue = null;
  state.activeFollowUp = null;
  state.questionIndex = Math.max(0, content.questions.findIndex((question) => !Object.hasOwn(state.activePractice.answers, question.id)));
  state.returnFocus = document.activeElement;
  state.activeReview?.cancel(); state.activeReview = null;
  $('#answerReview').hidden = true;
  $('#conceptRescue').hidden = true;
  $('#followUpTest').hidden = true;
  $('#worksheetQuestions').hidden = false;
  $('#worksheetCount').hidden = false;
  const isDraft = content.visibility !== 'student';
  const aiReviewed = content.review?.answerKey === 'ai_reviewed'
    && content.review?.independentCheck === 'second_model_agreed';
  setText('#worksheetEyebrow', content.visibility === 'demo_sample'
    ? content.review?.ownerReviewed === true ? 'PRACTICE · REVIEWED BY THE PROJECT IGNITE TEAM'
      : aiReviewed ? 'AI-REVIEWED PRACTICE · TEACHER REVIEW PENDING' : 'SAMPLE PRACTICE · UNREVIEWED'
    : isDraft ? 'DRAFT · STAFF PREVIEW' : 'WORKSHEET');
  setText('#worksheetDialogTitle', content.title || item.title);
  setText('#worksheetMeta', [`Class ${content.classLevel}`, content.subject, content.chapter].filter(Boolean).join(' · '));
  const notice = $('#worksheetNotice');
  notice.textContent = content.notice || '';
  notice.hidden = !(isDraft && content.notice);
  setText('#practiceSaveStatus', 'Your answers are saved on this device so you can return later.');
  renderPracticeQuestions();
  $('#worksheetWorkspace').hidden = false;
  document.body.classList.add('learning-open');
  $('#worksheetDialogTitle').focus();
  $('#worksheetWorkspace').scrollIntoView({ block: 'start' });
}

function closeLearningWorkspace(restoreFocus = true) {
  state.activeReview?.cancel(); state.activeReview = null;
  state.activePractice = null; state.activeRescue = null; state.activeFollowUp = null;
  $('#worksheetWorkspace').hidden = true;
  $('#answerReview').hidden = true; $('#conceptRescue').hidden = true; $('#followUpTest').hidden = true;
  document.body.classList.remove('learning-open');
  renderProgress(); renderPracticeProgress(); renderAdaptiveProgress();
  if (state.catalog) renderWorksheets();
  if (restoreFocus) (state.returnFocus?.isConnected !== false ? state.returnFocus || $('#startMission') : $('#startMission'))?.focus();
}

function renderQuestionNavigation() {
  const attempt = state.activePractice;
  if (!attempt) return;
  state.questionIndex = Math.min(Math.max(0, state.questionIndex), attempt.questions.length - 1);
  [...$('#worksheetQuestions').children].forEach((entry, index) => { entry.hidden = index !== state.questionIndex; });
  const answers = attempt.mode === 'retry' ? attempt.retryAnswers : attempt.answers;
  const complete = window.IgnitePractice.score(attempt.questions, answers).complete;
  setText('#practiceQuestionStep', `Question ${state.questionIndex + 1} of ${attempt.questions.length}`);
  $('#previousPracticeQuestion').disabled = state.questionIndex === 0;
  $('#nextPracticeQuestion').disabled = !Object.hasOwn(answers, attempt.questions[state.questionIndex].id);
  setText('#nextPracticeQuestion', state.questionIndex + 1 === attempt.questions.length ? 'Review my results' : 'Next question');
  $('#worksheetNavigation').hidden = $('#worksheetQuestions').hidden;
  $('#practiceResultsHint').hidden = !complete;
}

function returnToWorksheet() {
  state.activeReview?.cancel(); state.activeReview = null;
  state.activeRescue = null; state.activeFollowUp = null;
  $('#answerReview').hidden = true; $('#conceptRescue').hidden = true; $('#followUpTest').hidden = true;
  $('#worksheetQuestions').hidden = false; $('#worksheetCount').hidden = false;
  updatePracticeSummary();
  $('#worksheetQuestions').children[state.questionIndex]?.querySelector?.('button')?.focus();
}

function openAnswerReview(question, selectedIndex) {
  const attempt = state.activePractice;
  if (!attempt || !window.IgniteLearningPath || !window.IgniteLearningReview) return;
  const route = window.IgniteLearningPath.recoveryFor(question, selectedIndex, attempt.content.visibility);
  if (route.kind !== 'recall') return;
  state.activeReview?.cancel();
  $('#worksheetQuestions').hidden = true; $('#worksheetNavigation').hidden = true;
  $('#conceptRescue').hidden = true; $('#followUpTest').hidden = true; $('#practiceSummary').hidden = true;
  state.activeReview = window.IgniteLearningReview.mount($('#answerReview'), route, {
    subject: attempt.content.subject,
    isActive: () => state.activePractice === attempt,
    notice: attempt.content.notice,
    onReturn: returnToWorksheet,
  });
}

function renderPracticeQuestions() {
  const attempt = state.activePractice;
  if (!attempt) return;
  const list = $('#worksheetQuestions');
  list.replaceChildren();
  for (const question of attempt.questions) {
    const entry = document.createElement('li');
    entry.value = question.no;
    const prompt = Object.assign(document.createElement('p'), { className: 'q-text' });
    writeScience(prompt, question.text); entry.append(prompt);
    entry.append(buildOptions(question, attempt));
    list.append(entry);
  }
  updatePracticeSummary();
  renderQuestionNavigation();
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
  renderFollowUpAvailability();
  renderQuestionNavigation();
}

/* ---------- targeted follow-up tests ---------- */
function prepareCurrentFollowUp() {
  const attempt = state.activePractice;
  if (!attempt || !window.IgniteAssessmentSession || !window.IgniteAssessment) return null;
  if (!window.IgnitePractice.score(attempt.content.questions, attempt.answers).complete) return null;
  const skills = new Set(attempt.content.questions.map((question) => question.adaptive?.skill?.id).filter(Boolean));
  const banks = window.__IGNITE_ASSESSMENT_BANKS__?.banks || [];
  const bank = banks.find((candidate) => !window.IgniteAssessment.bankIssue(candidate)
    && candidate.items.some((item) => skills.has(item.skillId)));
  if (!bank) return null;
  const key = window.IgniteAssessmentSession.key(state.learnerId, bank.id);
  const raw = state.followUpMemory.get(key) || storage.get(key);
  const record = window.IgniteAssessmentSession.restoreRecord(raw, bank.id);
  const prepared = window.IgniteAssessmentSession.prepareTest(attempt.content, attempt.answers, bank, record, {
    attemptId: attempt.attemptId, maxQuestions: 3,
    allowUnreviewedDemo: attempt.content.visibility === 'demo_sample'
      && window.__IGNITE_ASSESSMENT_BANKS__?.includesSamples === true,
  });
  return { ...prepared, key, record, bank };
}

function renderFollowUpAvailability() {
  const button = $('#startFollowUpTest');
  const rescueButton = $('#startRescueFollowUp');
  button.hidden = true;
  rescueButton.hidden = true;
  const attempt = state.activePractice;
  if (!attempt || attempt.mode !== 'full') { setText('#followUpAvailability', ''); return; }
  const result = window.IgnitePractice.score(attempt.content.questions, attempt.answers);
  if (!result.complete) { setText('#followUpAvailability', ''); return; }
  if (!result.mistakes.length) { setText('#followUpAvailability', 'No follow-up is needed for this attempt.'); return; }
  if (!window.IgniteActivityView) { setText('#followUpAvailability', 'Interactive checks are unavailable. Your worksheet explanations are still available.'); return; }
  const prepared = prepareCurrentFollowUp();
  if (!prepared) { setText('#followUpAvailability', 'Follow-up questions are not available for this worksheet yet.'); return; }
  const { plan, session } = prepared;
  if (!['ready', 'partial'].includes(plan.status) || !plan.questions.length) {
    setText('#followUpAvailability', plan.status === 'review_required'
      ? 'These follow-up questions are awaiting teacher review.'
      : plan.status === 'no_target' ? 'These mistakes need a teacher’s review before a targeted follow-up can be prepared.'
        : 'You have seen all available questions for these mistakes. New questions are needed for another check.');
    return;
  }
  const completed = session && window.IgniteAssessment.gradeFollowUpTest(plan, session.answers).status === 'complete';
  const label = completed ? 'Review follow-up result' : session ? 'Resume follow-up'
    : prepared.bank.reviewStatus === 'pending' ? 'Try sample follow-up' : 'Take a short follow-up';
  setText('#startFollowUpTest', label);
  setText('#startRescueFollowUp', label);
  button.hidden = false;
  rescueButton.hidden = !state.activeRescue?.completed;
  const unresolved = plan.unresolved.length;
  setText('#followUpAvailability', `${plan.questions.length}-question check focused on the mistakes we can map.${unresolved ? ` ${unresolved} other mistake${unresolved === 1 ? '' : 's'} still need review.` : ''}${prepared.bank.reviewStatus === 'pending' ? ' Sample questions await teacher review.' : ''}`);
}

function persistFollowUp(active) {
  const raw = JSON.stringify(active.record);
  state.followUpMemory.set(active.key, raw);
  active.saved = storage.set(active.key, raw);
  setText('#followUpSaveStatus', active.saved
    ? 'Follow-up answers saved on this device.'
    : 'This browser could not save the follow-up. Keep this page open to retain it.');
}

function openFollowUpTest() {
  if (!window.IgniteActivityView) return;
  const prepared = prepareCurrentFollowUp();
  if (!prepared || state.activePractice?.mode !== 'full' || !['ready', 'partial'].includes(prepared.plan.status)) return;
  const record = window.IgniteAssessmentSession.begin(prepared.record, prepared, newAttemptId());
  if (!record.latest) return;
  const firstUnanswered = prepared.plan.questions.findIndex((question) => !Object.hasOwn(record.latest.answers, question.id));
  state.activeFollowUp = { ...prepared, record, index: firstUnanswered === -1 ? prepared.plan.questions.length : firstUnanswered };
  $('#conceptRescue').hidden = true;
  $('#practiceSummary').hidden = true;
  $('#worksheetQuestions').hidden = true;
  $('#worksheetNavigation').hidden = true;
  $('#answerReview').hidden = true;
  $('#worksheetCount').hidden = true;
  $('#followUpTest').hidden = false;
  $('#followUpTest').scrollIntoView({ block: 'nearest' });
  setText('#followUpNotice', prepared.bank.reviewStatus === 'pending'
    ? 'Sample follow-up questions. Teacher review is pending, so answers may contain errors.'
    : 'Reviewed follow-up questions. Your original worksheet score stays unchanged.');
  renderFollowUpQuestion();
}

function renderFollowUpQuestion() {
  const active = state.activeFollowUp;
  if (!active) return;
  const { plan } = active;
  const result = window.IgniteAssessment.gradeFollowUpTest(plan, active.record.latest.answers);
  $('#followUpSummary').hidden = true;
  $('#followUpQuestion').hidden = false;
  $('#nextFollowUpQuestion').hidden = false;
  $('#followUpFeedback').hidden = true;
  setText('#followUpCoverage', `${plan.unresolved.length ? `${plan.unresolved.length} original worksheet mistake${plan.unresolved.length === 1 ? '' : 's'} still need separate review. ` : ''}${plan.coverageGaps.length ? 'Some identified learning gaps are not covered by this test. ' : ''}${plan.questions.length < plan.requestedCount ? `Only ${plan.questions.length} suitable unseen questions were available. ` : ''}This check covers only the selected concepts.`);
  if (result.status === 'complete') {
    persistFollowUp(active);
    setText('#followUpStep', 'Complete');
    setText('#followUpResultTitle', result.correct === result.total ? 'Follow-up check passed' : 'More practice would help');
    setText('#followUpResultText', `${result.correct}/${result.total} correct against the answer key. ${result.correct === result.total ? 'You applied these ideas correctly in this check. Revisit them in a later session.' : 'Review the explanations below and revisit the concepts you missed.'}`);
    const review = $('#followUpReview');
    review.replaceChildren();
    for (const question of plan.questions) {
      if (active.record.latest.answers[question.id] === question.answerIndex) continue;
      const entry = document.createElement('li');
      const prompt = document.createElement('strong'), explanation = document.createElement('p');
      writeScience(prompt, question.prompt);
      writeScience(explanation, `Answer: ${question.options[question.answerIndex]}. ${question.explanation}`);
      entry.append(prompt, explanation);
      review.append(entry);
    }
    $('#followUpProgress').value = plan.questions.length;
    $('#followUpProgress').max = plan.questions.length;
    $('#followUpQuestion').hidden = true;
    $('#nextFollowUpQuestion').hidden = true;
    $('#followUpSummary').hidden = false;
    $('#followUpResultTitle').focus();
    return;
  }
  const question = plan.questions[active.index];
  if (!question) return;
  const questionIndex = active.index;
  active.record = window.IgniteAssessmentSession.markSeen(active.record, active.record.latest.id, question.id);
  persistFollowUp(active);
  setText('#followUpStep', `Question ${questionIndex + 1} of ${plan.questions.length}`);
  writeScience($('#followUpPrompt'), question.prompt);
  $('#followUpProgress').max = plan.questions.length;
  $('#followUpProgress').value = result.answered;
  $('#nextFollowUpQuestion').disabled = true;
  setText('#nextFollowUpQuestion', questionIndex + 1 === plan.questions.length ? 'See my result' : 'Next question');
  const options = $('#followUpOptions');
  options.replaceChildren();
  window.IgniteActivityView.mount(options, question, {
    subject: state.activePractice.content.subject,
    letters: true, deferFeedback: true,
    isActive: () => state.activeFollowUp === active && active.index === questionIndex,
    onAnswer(_result, index) {
      active.record = window.IgniteAssessmentSession.recordAnswer(active.record, active.record.latest.id, plan, question.id, index);
      setText('#followUpFeedback', 'Answer recorded. Feedback will appear after the whole check.');
      $('#followUpFeedback').hidden = false;
      $('#followUpProgress').value = window.IgniteAssessment.gradeFollowUpTest(plan, active.record.latest.answers).answered;
      $('#nextFollowUpQuestion').disabled = false;
      persistFollowUp(active);
    },
  });
  $('#followUpPrompt').focus();
}

function returnFromFollowUp() {
  state.activeFollowUp = null;
  $('#followUpTest').hidden = true;
  $('#worksheetQuestions').hidden = false;
  $('#worksheetCount').hidden = false;
  updatePracticeSummary();
  const target = $('#startFollowUpTest');
  if (!target.hidden) target.focus();
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

function loadAdaptiveProgress() {
  if (!window.IgniteAdaptive) return null;
  return window.IgniteAdaptive.restoreProgress(storage.get(window.IgniteAdaptive.progressKey(state.learnerId)));
}

function renderAdaptiveProgress() {
  if (!window.IgniteAdaptive) { setText('#recoveryCount', 0); return; }
  setText('#recoveryCount', window.IgniteAdaptive.summary(loadAdaptiveProgress()).rescuesCompleted);
}

function saveRescueOutcome(rescue) {
  const current = loadAdaptiveProgress();
  const progress = window.IgniteAdaptive.updateProgress(current, rescue.diagnosis, {
    completed: true,
    sessionId: rescue.sessionId,
    retryCorrect: rescue.answers[1] === true,
    hintUsed: rescue.hintUsed,
    occurredAt: new Date().toISOString(),
  });
  const saved = storage.set(window.IgniteAdaptive.progressKey(state.learnerId), JSON.stringify(progress));
  renderAdaptiveProgress();
  return saved;
}

function renderConceptRescueStep() {
  const rescue = state.activeRescue;
  if (!rescue) return;
  const step = rescue.step === 0 ? rescue.mission.challenge : rescue.mission.retry;
  const panel = $('#conceptRescue');
  panel.hidden = false;
  $('#worksheetQuestions').hidden = true;
  $('#worksheetNavigation').hidden = true;
  $('#practiceSummary').hidden = true;
  $('#answerReview').hidden = true;
  $('#rescueChallenge').hidden = false;
  $('#showRescueHint').hidden = false;
  $('#nextRescueStep').hidden = false;
  $('#nextRescueStep').disabled = true;
  setText('#rescueTitle', rescue.mission.title);
  setText('#rescueStep', `${rescue.step + 1} of 2`);
  setText('#rescueDiagnosis', rescue.step === 0 ? `Learning clue: ${rescue.diagnosis.feedback}` : 'Now use the same idea in a fresh situation.');
  setText('#rescueGoal', rescue.mission.goal);
  setText('#rescueReviewNotice', rescue.question.adaptive.reviewStatus === 'approved'
    ? 'Reviewed learning activity.' : 'Sample recovery activity. Teacher review is still pending.');
  writeScience($('#rescuePrompt'), step.prompt);
  setText('#rescueHint', rescue.mission.hint);
  $('#rescueHint').hidden = true;
  $('#rescueFeedback').hidden = true;
  $('#startRescueFollowUp').hidden = true;
  $('#rescueFeedback').classList.remove('is-correct');
  $('#rescueTrackFill').style.setProperty('width', rescue.step === 0 ? '50%' : '100%');
  setText('#nextRescueStep', rescue.step === 0 ? 'Try a related question' : 'Finish rescue');

  const options = $('#rescueOptions');
  options.replaceChildren();
  const stepIndex = rescue.step;
  const showResult = (response) => {
    if (state.activeRescue !== rescue || rescue.completed || rescue.step !== stepIndex
      || rescue.answers[stepIndex] !== undefined) return;
    const result = window.IgniteAdaptive.gradeActivity(step, response);
    if (!result.valid) return;
    rescue.answers[stepIndex] = result.correct;
    const correction = step.type === 'ordered_steps'
      ? step.steps.map((value, index) => `${index + 1}. ${value}`).join(' → ')
      : `The best answer is ${'ABCD'[step.answerIndex]}.`;
    writeScience($('#rescueFeedback'), `${result.correct ? 'Challenge complete.' : correction} ${step.explanation}`);
    $('#rescueFeedback').classList.toggle('is-correct', result.correct);
    $('#rescueFeedback').hidden = false;
    $('#nextRescueStep').disabled = false;
  };
  window.IgniteActivityView.mount(options, step, {
    subject: state.activePractice.content.subject,
    letters: true,
    isActive: () => state.activeRescue === rescue && !rescue.completed && rescue.step === stepIndex,
    onAnswer: (_result, response) => showResult(response),
  });
  panel.scrollIntoView({ block: 'nearest' });
  $('#rescueTitle').focus();
}

function openConceptRescue(question, diagnosis) {
  const route = window.IgniteLearningPath?.recoveryFor(question, state.activePractice?.answers[question.id], state.activePractice?.content.visibility);
  const mission = route?.kind === 'targeted' ? route.mission : null;
  if (!mission || !state.activePractice || !window.IgniteActivityView) return;
  state.activeRescue = {
    question, diagnosis, mission, step: 0, answers: [], hintUsed: false, completed: false,
    sessionId: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
  renderConceptRescueStep();
}

function finishConceptRescue() {
  const rescue = state.activeRescue;
  if (!rescue || rescue.completed || rescue.answers.length !== 2
    || !rescue.answers.every((answer) => typeof answer === 'boolean')) return;
  rescue.completed = true;
  const recovered = rescue.answers[1] === true;
  const saved = saveRescueOutcome(rescue);
  setText('#rescueTitle', recovered ? 'Concept recovered for this session' : 'Concept marked for review');
  setText('#rescueStep', 'Complete');
  setText('#rescueDiagnosis', recovered
    ? '★ Recovery star earned. You used the idea correctly in a new situation.'
    : 'This concept still needs review. That is useful information—not a penalty.');
  setText('#rescueGoal', saved ? 'Your latest retry result is saved on this device. Revisit the idea in a later session.' : 'This browser could not save the result.');
  $('#rescueTrackFill').style.setProperty('width', '100%');
  $('#rescueChallenge').hidden = true;
  $('#showRescueHint').hidden = true;
  $('#rescueHint').hidden = true;
  $('#rescueFeedback').hidden = true;
  $('#nextRescueStep').hidden = true;
  setText('#dismissRescue', 'Return to worksheet');
  renderFollowUpAvailability();
  $('#rescueTitle').focus();
}

/* Each question locks on its first choice; reopening restores that choice. */
function buildOptions(question, attempt) {
  const wrap = document.createElement('div');
  wrap.className = 'q-options';
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', `Choices for question ${question.no}`);
  const feedbackBox = Object.assign(document.createElement('div'), { className: 'q-feedback' });
  const feedback = document.createElement('p');
  feedback.setAttribute('role', 'status');
  const rescueOffer = Object.assign(document.createElement('div'), { className: 'rescue-offer' });
  const rescueClue = document.createElement('strong');
  const rescueButton = Object.assign(document.createElement('button'), {
    type: 'button', className: 'secondary-button', textContent: 'Start Concept Rescue',
  });
  let offeredRoute = null;
  rescueButton.addEventListener('click', () => {
    if (state.activePractice !== attempt || answers !== (attempt.mode === 'retry' ? attempt.retryAnswers : attempt.answers)) return;
    if (offeredRoute?.kind === 'targeted') openConceptRescue(question, offeredRoute.diagnosis);
    else if (offeredRoute?.kind === 'recall') openAnswerReview(question, answers[question.id]);
  });
  rescueOffer.append(rescueClue, rescueButton);
  rescueOffer.hidden = true;
  feedbackBox.append(feedback, rescueOffer);
  feedbackBox.hidden = true;
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
    writeScience(feedback, correct
      ? `Correct. ${question.explanation}`
      : `Not quite. The answer is ${letters[question.answerIndex]}. ${question.explanation}`);
    feedbackBox.classList.toggle('is-correct', correct);
    offeredRoute = !correct && attempt.mode === 'full'
      ? window.IgniteLearningPath?.recoveryFor(question, index, attempt.content.visibility) : null;
    rescueOffer.hidden = !window.IgniteActivityView || !['targeted', 'recall'].includes(offeredRoute?.kind)
      || (offeredRoute?.kind === 'recall' && !window.IgniteLearningReview);
    if (!rescueOffer.hidden) {
      rescueClue.textContent = offeredRoute.kind === 'targeted' ? `Learning clue: ${offeredRoute.diagnosis.feedback}` : offeredRoute.reason;
      rescueButton.textContent = offeredRoute.kind === 'targeted' ? 'Start Concept Rescue' : 'Review & recall';
    }
    feedbackBox.hidden = false;
  };
  const buttons = question.options.map((option, index) => {
    const button = Object.assign(document.createElement('button'), {
      type: 'button',
      className: 'q-option',
      textContent: `${letters[index]}. ${option}`,
    });
    writeScience(button, `${letters[index]}. ${option}`);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      if (state.activePractice !== attempt || answers !== (attempt.mode === 'retry' ? attempt.retryAnswers : attempt.answers)
        || Number.isInteger(answers[question.id])) return;
      answers[question.id] = index;
      paintFeedback(index);
      if (attempt.mode === 'full') {
        const saved = storage.set(attempt.key, JSON.stringify({ version: window.IgnitePractice.version(attempt.content), attemptId: attempt.attemptId, answers: attempt.answers }));
        setText('#practiceSaveStatus', saved ? 'Answers saved on this device.' : 'This browser could not save your answers. Keep this page open to retain them.');
        renderPracticeProgress();
      }
      updatePracticeSummary();
    });
    return button;
  });
  wrap.append(...buttons, feedbackBox);
  if (Number.isInteger(answers[question.id])) paintFeedback(answers[question.id]);
  return wrap;
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
  $$('.sidebar a[href^="#"], .mobile-nav a[href^="#"]').forEach((link) => link.addEventListener('click', () => {
    if (state.activePractice) closeLearningWorkspace(false);
  }));

  ['#startMission', '#missionNav', '#mobileMission'].forEach((selector) => {
    $(selector).addEventListener('click', () => openMission());
  });
  $('#changeMission').addEventListener('click', () => {
    if (state.activePractice) closeLearningWorkspace(false);
    leaveFocusMode();
    $('#library').scrollIntoView();
  });
  ['#openDoubt', '#doubtNav'].forEach((selector) => {
    $(selector).addEventListener('click', () => showDialog($('#doubtDialog')));
  });
  ['#logoutNav', '#mobileLogout'].forEach((selector) => {
    $(selector).addEventListener('click', logOut);
  });

  ['#saveExitPractice', '#finishPractice'].forEach((selector) => $(selector).addEventListener('click', () => closeLearningWorkspace()));
  $('#previousPracticeQuestion').addEventListener('click', () => {
    if (!state.activePractice || state.questionIndex === 0) return;
    state.questionIndex -= 1; renderQuestionNavigation();
    $('#worksheetQuestions').children[state.questionIndex]?.querySelector?.('button')?.focus();
  });
  $('#nextPracticeQuestion').addEventListener('click', () => {
    const attempt = state.activePractice;
    if (!attempt || $('#nextPracticeQuestion').disabled) return;
    if (state.questionIndex + 1 < attempt.questions.length) {
      state.questionIndex += 1; renderQuestionNavigation();
      $('#worksheetQuestions').children[state.questionIndex]?.querySelector?.('button')?.focus();
    } else {
      $('#practiceSummaryTitle').focus();
      $('#practiceSummary').scrollIntoView({ block: 'start' });
    }
  });
  $('#startFollowUpTest').addEventListener('click', openFollowUpTest);
  $('#startRescueFollowUp').addEventListener('click', openFollowUpTest);
  $('#returnFromFollowUp').addEventListener('click', returnFromFollowUp);
  $('#nextFollowUpQuestion').addEventListener('click', () => {
    const active = state.activeFollowUp;
    if (!active) return;
    const question = active.plan.questions[active.index];
    if (!question || !Object.hasOwn(active.record.latest.answers, question.id)) return;
    active.index += 1;
    renderFollowUpQuestion();
  });
  $('#showRescueHint').addEventListener('click', () => {
    const rescue = state.activeRescue;
    if (!rescue || rescue.completed) return;
    rescue.hintUsed = true;
    $('#rescueHint').hidden = false;
    $('#showRescueHint').hidden = true;
  });
  $('#nextRescueStep').addEventListener('click', () => {
    const rescue = state.activeRescue;
    if (!rescue || rescue.completed || rescue.answers[rescue.step] === undefined) return;
    if (rescue.step === 0) {
      rescue.step = 1;
      renderConceptRescueStep();
    } else finishConceptRescue();
  });
  $('#dismissRescue').addEventListener('click', returnToWorksheet);
  $('#retryMistakes').addEventListener('click', () => {
    const attempt = state.activePractice;
    if (!attempt) return;
    const result = window.IgnitePractice.score(attempt.content.questions, attempt.answers);
    if (!result.complete || !result.mistakes.length) return;
    state.activeReview?.cancel(); state.activeReview = null; $('#answerReview').hidden = true;
    state.questionIndex = 0;
    state.activeRescue = null;
    state.activeFollowUp = null;
    $('#conceptRescue').hidden = true;
    $('#followUpTest').hidden = true;
    $('#worksheetQuestions').hidden = false;
    $('#worksheetCount').hidden = false;
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
    state.activeReview?.cancel(); state.activeReview = null; $('#answerReview').hidden = true;
    state.questionIndex = 0;
    state.activeRescue = null;
    state.activeFollowUp = null;
    $('#conceptRescue').hidden = true;
    $('#followUpTest').hidden = true;
    $('#worksheetQuestions').hidden = false;
    $('#worksheetCount').hidden = false;
    attempt.mode = 'full';
    attempt.questions = attempt.content.questions;
    attempt.answers = Object.create(null);
    attempt.attemptId = newAttemptId();
    const saved = storage.set(attempt.key, JSON.stringify({ version: window.IgnitePractice.version(attempt.content), attemptId: attempt.attemptId, answers: attempt.answers }));
    setText('#practiceSaveStatus', saved ? 'New attempt started. Your previous attempt has been replaced on this device.' : 'This attempt cannot be saved in this browser.');
    renderPracticeQuestions();
    renderPracticeProgress();
    $('#worksheetQuestions button')?.focus();
  });

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
    let catalog;
    try { catalog = await loadCatalog(); }
    catch (error) {
      if (!standaloneItems().length) throw error;
      catalog = { worksheets: [] };
    }
    if (!catalog || !Array.isArray(catalog.worksheets)) throw new Error('Catalog is missing its worksheet list');
    state.items = learnerLibrary(catalog);
    state.catalog = catalog;

    const openCount = state.items.filter(isOpenToStudents).length;
    setText('#sourceTitle', 'Practice library');
    setText('#sourceCount', `${openCount} playable set${openCount === 1 ? '' : 's'} · review status on each card`);
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
    renderAdaptiveProgress();
    renderProgress();
  } catch (error) {
    console.error(error);
    showLoadError(error);
  }
}

function learnerLibrary(catalog) {
  const items = [...standaloneItems(), ...(catalog?.worksheets || []).map(normalizeItem).filter((item) => item && isOpenToStudents(item))];
  return items.filter((item, index) => items.findIndex((other) => other.content.id === item.content.id) === index);
}

async function init() {
  let admittedStudent;
  if (window.__IGNITE_PLATFORM__?.identity?.enabled) {
    document.body.classList.add('account-checking');
    const loading = Object.assign(document.createElement('p'), {
      className: 'account-load-status', textContent: 'Loading your account…',
    });
    loading.setAttribute('role', 'status');
    document.querySelector('.app-shell').before(loading);
    try {
      if (!window.IgniteIdentity) throw new Error('Account sign-in could not load.');
      await window.IgniteIdentity.ready();
      const user = window.IgniteIdentity.session();
      const learner = window.IgniteIdentity.learner();
      if (!user || !learner) { window.location.replace('./index.html#login'); return; }
      admittedStudent = { studentName: learner.studentName, studentClass: learner.classLevel, admissionId: learner.id };
      window.IgniteIdentity.onChange(value => {
        if (!value?.emailVerified || value.uid !== user.uid) window.location.replace('./index.html#login');
      });
      loading.remove();
      document.body.classList.remove('account-checking');
    } catch (error) {
      loading.textContent = `${error.message || 'Account sign-in could not load.'} `;
      const retry = Object.assign(document.createElement('a'), { href: './index.html#login', textContent: 'Return to sign in' });
      loading.append(retry);
      return;
    }
  } else {
    admittedStudent = loadAdmittedStudent();
    if (!admittedStudent || storage.getSession(SESSION_KEY) !== admittedStudent.admissionId) {
      window.location.replace(admittedStudent ? './index.html#login' : './index.html#admission');
      return;
    }
  }
  applyStudentProfile(admittedStudent);
  window.IgniteBoard?.bind(admittedStudent.admissionId);
  window.IgniteBoard?.mountGate(() => admittedStudent.admissionId);
  window.IgniteBoard?.mountBar(document.getElementById('boardBar'), () => admittedStudent.admissionId);
  state.learnerId = admittedStudent.admissionId;
  renderProgress();
  renderAdaptiveProgress();
  renderLevelsProgress();
  bindControls();
  trackActiveSection();
  if (storage.get(FOCUS_KEY) === '1') setFocusMode(true);
  loadAndRender();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
