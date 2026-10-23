'use strict';

// School board (CBSE / ICSE) for the learner. Load right after data/pilot-worksheets.js: it keeps only the chosen
// board's practice sets in window.__IGNITE_PILOT_CONTENT__.items, so every page shows one board's content.
// This is a convenience filter for what a learner sees, not access control: the sets are public files.
(function igniteBoard() {
  const STORAGE_KEY = 'ignite-board-v1';
  const BOARDS = Object.freeze([
    Object.freeze({ id: 'CBSE', label: 'CBSE', hint: 'NCERT books' }),
    Object.freeze({ id: 'ICSE', label: 'ICSE', hint: 'CISCE board' }),
  ]);
  const ids = BOARDS.map((board) => board.id);
  const content = window.__IGNITE_PILOT_CONTENT__;
  const all = Array.isArray(content?.items) ? [...content.items] : [];

  const store = {
    get() { try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; } },
    set(value) { try { window.localStorage.setItem(STORAGE_KEY, value); return true; } catch { return false; } },
  };
  let memory = { last: null, byLearner: {} };   // used when the browser blocks storage

  function read() {
    try {
      const saved = JSON.parse(store.get() || 'null');
      if (saved && typeof saved === 'object') {
        const byLearner = {};
        for (const [learner, board] of Object.entries(saved.byLearner && typeof saved.byLearner === 'object' ? saved.byLearner : {})) {
          if (ids.includes(board)) byLearner[learner] = board;
        }
        return { last: ids.includes(saved.last) ? saved.last : null, byLearner };
      }
    } catch { /* unreadable record: start again */ }
    return { last: null, byLearner: {} };
  }
  let state = read();
  const persist = () => { memory = state; store.set(JSON.stringify(state)); };

  // A set is shown when it belongs to the chosen board, or is marked as common to both boards.
  const allows = (set, board) => Boolean(board) && (set?.board === board || set?.board === 'common');
  function apply(board) {
    if (content) content.items = board ? all.filter((set) => allows(set, board)) : [];
  }
  const current = () => state.last;
  apply(current());

  function reload() { window.location.reload(); }

  // Called once the signed-in learner is known. Each learner keeps their own board; a learner with none yet starts
  // with this device's last choice and can change it.
  function bind(learnerId) {
    if (!learnerId) return;
    const own = state.byLearner[learnerId] || null;
    if (own && own !== state.last) { state.last = own; persist(); reload(); return; }
    if (!own && state.last) { state.byLearner[learnerId] = state.last; persist(); }
  }

  function choose(board, learnerId) {
    if (!ids.includes(board)) return;
    state = { last: board, byLearner: { ...state.byLearner, ...(learnerId ? { [learnerId]: board } : {}) } };
    persist();
    reload();
  }

  const make = (tag, props = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
  };

  function buttons(learnerId) {
    return BOARDS.map((board) => {
      const button = make('button', { type: 'button', className: 'board-choice' },
        make('strong', { textContent: board.label }), make('small', { textContent: board.hint }));
      button.setAttribute('aria-pressed', String(current() === board.id));
      button.addEventListener('click', () => { if (current() !== board.id) choose(board.id, learnerId()); });
      return button;
    });
  }

  const otherNote = () => make('p', { className: 'board-note',
    textContent: 'Studying under another board? We are starting with CBSE and ICSE and will add more. Tell us your board when you enquire.' });

  // A small "Your board" bar inside a page (landing demo, dashboard, game home).
  function mountBar(container, learnerId = () => null) {
    if (!container) return;
    const label = make('span', { className: 'board-label', textContent: 'Your board' });
    const group = make('div', { className: 'board-choices' }, ...buttons(learnerId));
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Choose your school board');
    container.classList.add('board-bar');
    container.replaceChildren(label, group);
    if (!current()) container.append(make('p', { className: 'board-prompt', textContent: 'Choose your board to see practice for it.' }));
    container.append(otherNote());
  }

  // A blocking question for pages that need a board before showing anything.
  function mountGate(learnerId = () => null) {
    if (current() || document.querySelector('.board-gate')) return;
    const title = make('h2', { id: 'boardGateTitle', textContent: 'Which board does your school follow?' });
    const choices = make('div', { className: 'board-choices is-large' }, ...buttons(learnerId));
    choices.setAttribute('role', 'group');
    const panel = make('div', { className: 'board-gate-panel' }, title,
      make('p', { textContent: 'We will show only practice made for your board. You can change this later.' }),
      choices, otherNote());
    const gate = make('div', { className: 'board-gate' }, panel);
    gate.setAttribute('role', 'dialog');
    gate.setAttribute('aria-modal', 'true');
    gate.setAttribute('aria-labelledby', 'boardGateTitle');
    document.body.append(gate);
    gate.querySelector('button')?.focus();
  }

  window.IgniteBoard = Object.freeze({ BOARDS, current, allows, apply, bind, choose, mountBar, mountGate,
    count: () => all.filter((set) => allows(set, current())).length, total: () => all.length });
}());
