'use strict';

// Ignite Play: chapter trails, boss rounds, Fix-it rounds and the Daily Spark. Rules live in game/core.js;
// this file draws the screens. Progress stays in this browser under the admission ID (no names are stored).
(async function ignitePlay() {
  const core = window.IgniteGameCore;
  const STUDENT_KEY = 'ignite-pilot-student-v1';
  const SESSION_KEY = 'ignite-levels-session-v1';
  const BREAK_EVERY = 3;
  const LETTERS = 'ABCDEFGH';
  const TROPHY_ICON = { bronze: '🥉', silver: '🥈', gold: '🥇' };
  const SUBJECT_ICON = {
    Mathematics: ['∑', '#dff04f'], Biology: ['❦', '#bfe6d3'], Chemistry: ['⚗', '#a9d8f1'], Physics: ['⚛', '#ffe08a'],
    English: ['✎', '#ffb59d'], 'Science (General)': ['✺', '#c8d4ff'], 'Social Studies': ['◍', '#f2c6df'],
  };

  const $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children.filter((c) => c !== null && c !== undefined));
    return node;
  };
  const store = {
    get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { window.localStorage.setItem(key, value); return true; } catch { return false; } },
    getSession(key) { try { return window.sessionStorage.getItem(key); } catch { return null; } },
    setSession(key, value) { try { window.sessionStorage.setItem(key, value); } catch { /* reminder only */ } },
  };
  const reduceMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; } };
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  /* ---------- learner and progress ---------- */
  const firebaseMode = window.__IGNITE_PLATFORM__?.identity?.enabled === true;
  let identityUnavailable = false;
  if (firebaseMode) {
    try { await window.IgniteIdentity.ready(); }
    catch { identityUnavailable = true; }
  }
  function learner() {
    if (firebaseMode) {
      const account = window.IgniteIdentity?.learner();
      return account ? { id: account.id, classLevel: Number(account.classLevel) || NaN } : { id: 'guest', classLevel: NaN };
    }
    try {
      const student = JSON.parse(store.get(STUDENT_KEY) || 'null');
      if (student?.admissionId) return { id: String(student.admissionId), classLevel: Number(student.studentClass) };
    } catch { /* guest */ }
    return { id: 'guest', classLevel: NaN };
  }
  const me = learner();
  window.IgniteBoard?.bind(me.id);
  window.IgniteBoard?.mountGate(() => me.id);
  window.IgniteBoard?.mountBar(document.getElementById('boardBar'), () => me.id);
  const ROUND_SESSION_KEY = `${SESSION_KEY}:${encodeURIComponent(me.id)}`;
  const accountLink = $('gameAccountLink');
  if (accountLink) accountLink.textContent = firebaseMode && window.IgniteIdentity?.session() ? 'Account' : 'Sign in';
  if (firebaseMode && !identityUnavailable) {
    const uid = window.IgniteIdentity.session()?.uid || null;
    window.IgniteIdentity.onChange(value => {
      const nextUid = value?.emailVerified ? value.uid : null;
      if (nextUid !== uid) window.location.reload();
    });
  }
  const KEY = `ignite-levels-v2:${encodeURIComponent(me.id)}`;
  const OLD_KEY = `ignite-levels-v1:${encodeURIComponent(me.id)}`;

  function load() {
    for (const key of [KEY, OLD_KEY]) {
      try {
        const raw = JSON.parse(store.get(key) || 'null');
        if (raw && typeof raw === 'object') return core.migrate(raw);
      } catch { /* unreadable: try the next record, then start fresh */ }
    }
    return core.freshProgress();
  }
  const progress = load();
  function save() {
    if (identityUnavailable) {
      $('saveStatus').hidden = false;
      $('saveStatus').textContent = 'Account sign-in could not load. You can play, but this session cannot save progress. Check your connection and sign in again.';
      return;
    }
    const failed = !store.set(KEY, JSON.stringify(progress));
    $('saveStatus').hidden = !failed;
    $('saveStatus').textContent = failed ? 'This browser could not save progress. You can keep playing in this tab.' : '';
  }

  // The free-trial sets are for visitors before sign-in; signed-in learners play the chapter levels.
  const trailSets = (window.__IGNITE_PILOT_CONTENT__?.items || []).filter((set) => !set.trial)
    .map((set) => window.IgniteTrialDiagrams?.adapt(set) || set);
  const tracks = core.buildTracks(trailSets, window.IgnitePractice?.playable);
  const byQuestion = core.questionIndex(tracks);
  const trackById = (id) => tracks.find((t) => t.id === id) || null;
  const today = () => core.todayKey();

  /* ---------- views ---------- */
  const VIEWS = ['homeView', 'trailView', 'playView', 'resultView', 'trophyView'];
  let view = 'homeView';
  function show(id, focusId = null) {
    view = id;
    for (const name of VIEWS) $(name).hidden = name !== id;
    document.body.classList.toggle('is-playing', id === 'playView');
    window.scrollTo?.(0, 0);
    if (focusId) window.requestAnimationFrame(() => $(focusId)?.focus());
  }

  function renderPlayer() {
    const rank = core.rankFor(progress.xp);
    $('rankIcon').textContent = rank.icon;
    $('rankName').textContent = rank.name.toUpperCase();
    $('xpFill').style.width = `${rank.percent}%`;
    $('xpBar').setAttribute('aria-valuenow', String(rank.percent));
    $('xpText').textContent = rank.next ? `${progress.xp} XP · ${rank.next.xp - progress.xp} XP to ${rank.next.name}` : `${progress.xp} XP · top rank`;
    $('starTotal').textContent = String(core.totalStars(progress));
    $('trophyTotal').textContent = String(Object.keys(progress.trophies).length);
    const alive = progress.streak.lastDay && core.daysBetween(progress.streak.lastDay, today()) <= 1;
    $('streakDays').textContent = String(alive ? progress.streak.days : 0);
    $('streakChip').classList.toggle('is-lit', Boolean(alive && progress.streak.lastDay === today()));
  }

  /* ---------- home ---------- */
  function chips(container, values, current, label, onPick) {
    container.replaceChildren(...values.map((value) => {
      const chip = el('button', { type: 'button', className: 'chip', textContent: label(value) });
      chip.setAttribute('aria-pressed', String(value === current));
      chip.addEventListener('click', () => onPick(value));
      return chip;
    }));
  }

  const trackStars = (track) => track.levels.reduce((n, l) => n + (progress.levels[l.id]?.stars || 0), 0);
  function nextStop(track) {
    const total = track.levels.length + (track.hasBoss ? 1 : 0);
    for (let i = 0; i < total; i += 1) {
      if (!core.unlocked(track, i, progress)) return null;
      const done = i < track.levels.length ? progress.levels[track.levels[i].id] : progress.bosses[track.id];
      if (!done) return i;
    }
    return null;
  }
  const stopName = (track, i) => (i >= track.levels.length ? 'Boss round' : `Level ${i + 1}`);

  function renderHome(shouldFocus = false) {
    show('homeView', shouldFocus ? 'homeTitle' : null);
    renderPlayer();
    const doneToday = progress.daily.lastDay === today();
    $('dailyCard').classList.toggle('is-done', doneToday);
    $('dailyStatus').textContent = doneToday ? 'Done for today ✓ · play again for practice' : '5 quick questions · about 2 minutes · +20 XP';

    const last = trackById(progress.lastTrack);
    const stop = last ? nextStop(last) : null;
    $('continueCard').hidden = !last;
    if (last) {
      $('continueTitle').textContent = last.title;
      $('continueMeta').textContent = stop === null ? 'Trail complete · replay for more stars' : `Next: ${stopName(last, stop)}`;
    }

    const classes = [...new Set(tracks.map((t) => t.classLevel))].sort((a, b) => a - b);
    if (!classes.length) { $('trackList').replaceChildren(el('p', { textContent: 'No chapters are available yet.' })); return; }
    const noLearnerClass = Number.isFinite(me.classLevel)
      && !classes.includes(me.classLevel)
      && progress.classLevel === null;
    if (noLearnerClass) {
      chips($('classChips'), classes, null, (c) => `Class ${c}`, (c) => {
        progress.classLevel = c;
        save();
        renderHome();
      });
      $('subjectChips').replaceChildren();
      $('availabilityNotice').hidden = false;
      $('availabilityNotice').textContent = `Class ${me.classLevel} levels are not available yet. Choose an available class to explore sample levels.`;
      $('trackList').replaceChildren();
      $('dailyCard').disabled = true;
      $('dailyStatus').textContent = 'Choose an available class to start';
      return;
    }
    $('availabilityNotice').hidden = true;
    $('dailyCard').disabled = false;
    if (!classes.includes(progress.classLevel)) progress.classLevel = classes.includes(me.classLevel) ? me.classLevel : classes[0];
    const inClass = tracks.filter((t) => t.classLevel === progress.classLevel);
    const subjects = [...new Set(inClass.map((t) => t.subject))].sort();
    if (!subjects.includes(progress.subject)) progress.subject = subjects[0];
    chips($('classChips'), classes, progress.classLevel, (c) => `Class ${c}`, (c) => { progress.classLevel = c; save(); renderHome(); });
    chips($('subjectChips'), subjects, progress.subject, (s) => s, (s) => { progress.subject = s; save(); renderHome(); });
    $('trackList').replaceChildren(...inClass.filter((t) => t.subject === progress.subject).map(chapterTile));
  }

  function chapterTile(track) {
    const [icon, colour] = SUBJECT_ICON[track.subject] || ['✧', '#d8dedc'];
    const max = track.levels.length * 3;
    const stars = trackStars(track);
    const trophy = progress.trophies[track.id];
    const tile = el('button', { type: 'button', className: 'chapter-tile' },
      el('span', { className: 'tile-icon', textContent: icon }),
      el('span', { className: 'tile-copy' },
        el('strong', { textContent: track.title }),
        el('small', { textContent: `${plural(track.levels.length, 'level')}${track.hasBoss ? ' + boss' : ''} · ${track.questionCount} questions` }),
        el('span', { className: 'tile-bar' }, el('span', { style: `width:${Math.round(100 * stars / max)}%` }))),
      el('span', { className: 'tile-end', textContent: trophy ? TROPHY_ICON[trophy] : `${stars}/${max} ★` }));
    tile.style.setProperty('--tile-colour', colour);
    tile.dataset.subject = track.subject;
    tile.setAttribute('aria-label', `${track.title}: ${stars} of ${max} stars${trophy ? `, ${trophy} trophy` : ''}`);
    tile.addEventListener('click', () => openTrail(track));
    return tile;
  }

  /* ---------- trail ---------- */
  let openTrack = null;
  const OFFSETS = [50, 74, 50, 26]; // zig-zag x positions in percent

  function openTrail(track) {
    openTrack = track;
    show('trailView', 'trailTitle');
    $('trailEyebrow').textContent = `CLASS ${track.classLevel} · ${track.subject.toUpperCase()}`;
    $('trailTitle').textContent = track.title;
    const trophy = progress.trophies[track.id];
    $('trailMeta').textContent = `${trackStars(track)}/${track.levels.length * 3} stars${trophy ? ` · ${TROPHY_ICON[trophy]} ${trophy} trophy` : ''}`;
    window.IgniteStudios?.mountTrail($('chapterStudio'),track);
    const stops = track.levels.length + (track.hasBoss ? 1 : 0);
    const next = nextStop(track);
    const ROW = 118;
    const points = [];
    const nodes = [];
    for (let i = 0; i < stops; i += 1) {
      const boss = i >= track.levels.length;
      const open = core.unlocked(track, i, progress);
      const record = boss ? null : progress.levels[track.levels[i].id];
      const x = OFFSETS[i % OFFSETS.length];
      const y = 48 + i * ROW;
      points.push([x, y]);
      const stars = record?.stars || 0;
      const label = boss ? (progress.trophies[track.id] && progress.bosses[track.id] ? `${TROPHY_ICON[progress.trophies[track.id]]} Boss` : 'Boss')
        : record ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : `Level ${i + 1}`;
      const node = el('button', { type: 'button', className: `trail-node${boss ? ' is-boss' : ''}`, disabled: !open },
        el('span', { className: 'node-face', textContent: !open ? '🔒' : boss ? '♛' : record ? String(i + 1) : String(i + 1) }));
      if (record && stars) node.classList.add('is-done');
      if (i === next) node.classList.add('is-next');
      node.setAttribute('aria-label', `${stopName(track, i)}${open ? '' : ', locked'}${record ? `, ${stars} of 3 stars` : ''}`);
      node.addEventListener('click', () => (boss ? startBoss(track) : startLevel(track, track.levels[i], Boolean(record))));
      nodes.push(el('div', { className: 'trail-stop', style: `left:${x}%;top:${y}px` }, node,
        el('span', { className: 'stop-label', textContent: label })));
    }
    const height = 48 + (stops - 1) * ROW + 70;
    let d = '';
    points.forEach(([x, y], i) => {
      if (!i) { d = `M${x} ${y}`; return; }
      const [px, py] = points[i - 1];
      d += ` C${px} ${py + ROW / 2} ${x} ${y - ROW / 2} ${x} ${y}`;
    });
    const svg = document.createElementNS?.('http://www.w3.org/2000/svg', 'svg');
    const children = [...nodes];
    if (svg) {
      svg.setAttribute('class', 'trail-path');
      svg.setAttribute('viewBox', `0 0 100 ${height}`);
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.append(path);
      children.unshift(svg);
    }
    $('trailNodes').style.height = `${height}px`;
    $('trailNodes').replaceChildren(...children);
    $('trailHint').textContent = track.hasBoss
      ? 'Get 60% to open the next stop. Clear every level to face the chapter boss and win a trophy.'
      : 'Get 60% to clear the level. Your stars here decide this chapter’s trophy.';
  }

  /* ---------- rounds ---------- */
  let round = null;

  function noticeFor(questions) {
    const notices = new Set(questions.map((q) => byQuestion.get(q.id)?.level.notice).filter(Boolean));
    if (notices.size === 1) return [...notices][0];
    if ([...notices].every((text) => /^Reviewed by the Project Ignite team/.test(text))) return 'Reviewed by the Project Ignite team and subject teachers. Tell us if anything looks wrong.';
    return 'This round mixes chapters. Some questions are original samples that have not been reviewed yet.';
  }
  function summaryFor(notice) {
    if (/^Reviewed by the Project Ignite team/.test(notice)) return 'Reviewed by the Project Ignite team and subject teachers';
    return 'Sample questions · not yet teacher-checked';
  }

  function begin(kind, questions, extra) {
    if (!questions.length) return;
    round = core.newRound(kind, questions, extra);
    round.notice = noticeFor(questions);
    const titles = { level: `${extra.track?.title} · Level ${extra.level?.number}`, boss: `${extra.track?.title} · Boss round`,
      daily: 'Daily Spark', repair: 'Fix-it round' };
    $('playMeta').textContent = titles[kind];
    $('playNotice').textContent = round.notice;
    $('noticeSummary').textContent = summaryFor(round.notice);
    $('bossBar').hidden = kind !== 'boss';
    show('playView');
    renderQuestion();
  }

  function startLevel(track, level, replay) {
    if (!core.unlocked(track, level.number - 1, progress)) return;
    begin('level', replay ? core.shuffle(level.questions) : [...level.questions], { track, level });
  }
  function startBoss(track) {
    if (!core.unlocked(track, track.levels.length, progress)) return;
    begin('boss', core.bossPool(track, progress), { track });
  }
  function startDaily() {
    const picks = core.dailyPicks(tracks, progress, today(), progress.classLevel ?? me.classLevel);
    begin('daily', picks.map((p) => p.q), {});
  }
  function startRepair(from) {
    const wrong = from.answers.filter((a) => !a.correct).map((a) => from.questions.find((q) => q.id === a.id));
    begin('repair', wrong, { track: from.track, level: from.level, from });
  }

  function renderQuestion() {
    const q = round.questions[round.index];
    const active = round;
    const diagramOptions = Array.isArray(q.diagramOptions) && q.diagramOptions.length === q.options.length
      ? q.diagramOptions : null;
    $('playCount').textContent = `${diagramOptions ? 'VISUAL CHALLENGE · ' : ''}QUESTION ${round.index + 1} OF ${round.questions.length}`;
    $('playTitle').textContent = q.text;
    $('levelFill').style.width = `${Math.round(100 * round.index / round.questions.length)}%`;
    $('streak').textContent = round.streak >= 2 ? `🔥 ${round.streak}` : '';
    if (round.kind === 'boss') renderBoss();
    $('answerSheet').hidden = true;
    const hidden = round.clueOn === q.id ? round.hidden : [];
    $('playOptions').classList.toggle('has-diagrams', Boolean(diagramOptions));
    $('playOptions').replaceChildren(...q.options.map((option, index) => {
      const value = el('span', { className: 'option-value' });
      const diagram = diagramOptions ? window.IgniteTrialDiagrams?.render(diagramOptions[index]) : null;
      if (diagram) value.append(diagram, el('span', { className: 'diagram-caption', textContent: option }));
      else value.textContent = option;
      const button = el('button', { type: 'button', className: `play-option${diagram ? ' has-diagram' : ''}` },
        el('span', { className: 'letter', textContent: LETTERS[index] }), value);
      button.dataset.index = String(index);
      if (hidden.includes(index)) { button.disabled = true; button.classList.add('is-cleared'); }
      button.addEventListener('click', () => choose(index, active, q, button));
      return button;
    }));
    $('clueButton').hidden = round.kind === 'repair';
    $('clueButton').disabled = round.clueUsed;
    $('clueButton').textContent = round.clueUsed ? '50:50 used' : '50:50 clue';
    $('playTitle').focus?.();
  }

  function renderBoss() {
    const hits = round.answers.filter((a) => a.correct).length;
    const left = Math.max(0, round.questions.length - hits);
    const percent = Math.round(100 * left / round.questions.length);
    $('bossFill').style.width = `${percent}%`;
    $('bossHp').setAttribute('aria-valuenow', String(percent));
    $('bossLabel').textContent = `Chapter boss · ${left} energy left`;
  }

  function useClue() {
    if (!round || view !== 'playView' || round.answers.length > round.index) return;
    if (core.clue(round)) { save(); renderQuestion(); }
  }

  function choose(index, active, q, button) {
    // Ignore taps from an old screen: another round, another question, or an answered one.
    if (!round || active !== round || view !== 'playView' || q !== round.questions[round.index]
        || round.answers.length > round.index) return;
    const { correct, xp } = core.answer(progress, round, index, today());
    save();
    for (const option of $('playOptions').children) {
      const i = Number(option.dataset.index);
      option.disabled = true;
      if (i === q.answerIndex) option.classList.add('is-correct');
      else if (i === index) option.classList.add('is-wrong');
    }
    const cheers = round.kind === 'boss' ? ['Direct hit!', 'Boss shaken!', 'Strong hit!'] : ['Correct!', 'Nice!', 'Spot on!', 'Great thinking!'];
    $('sheetTitle').textContent = correct
      ? `${cheers[round.answers.length % cheers.length]}${xp ? ` +${xp} XP` : ''}`
      : round.kind === 'boss' ? 'The boss dodged that one.' : 'Not quite — now you know.';
    $('playFeedback').textContent = correct ? q.explanation
      : `The answer is ${LETTERS[q.answerIndex]}: ${q.options[q.answerIndex]}. ${q.explanation}`;
    $('answerSheet').classList.toggle('is-correct', correct);
    $('answerSheet').hidden = false;
    $('nextQuestion').textContent = round.index === round.questions.length - 1 ? 'See results' : 'Continue';
    $('streak').textContent = round.streak >= 2 ? `🔥 ${round.streak}` : '';
    if (round.kind === 'boss') renderBoss();
    if (correct) burst(button, xp ? `+${xp}` : '✓');
    $('nextQuestion').focus?.();
    renderPlayer();
  }

  function nextQuestion() {
    if (!round || view !== 'playView' || round.answers.length <= round.index) return;
    if (round.index === round.questions.length - 1) finish();
    else { round.index += 1; renderQuestion(); }
  }

  /* ---------- results ---------- */
  function finish() {
    const done = round;
    const result = core.settle(progress, done, tracks, today());
    done.result = result;
    save();
    const played = done.kind === 'repair' ? Number(store.getSession(ROUND_SESSION_KEY) || 0)
      : Number(store.getSession(ROUND_SESSION_KEY) || 0) + 1;
    store.setSession(ROUND_SESSION_KEY, String(played));

    const { correct, total, stars } = result;
    const where = done.kind === 'daily' ? 'DAILY SPARK' : done.kind === 'repair' ? 'FIX-IT ROUND'
      : `${done.track.title.toUpperCase()} · ${done.kind === 'boss' ? 'BOSS ROUND' : `LEVEL ${done.level.number}`}`;
    $('resultLevel').textContent = where;
    let title; let emblem; let text;
    if (done.kind === 'level') {
      title = ['Keep going!', 'Level cleared!', 'Great work!', 'Perfect!'][stars];
      emblem = el('span', { className: 'stars' }, ...[0, 1, 2].map((i) => el('span', { className: i < stars ? 'on' : '', textContent: '★' })));
      text = `${correct} of ${total} correct · ${plural(stars, 'star')}.`
        + (stars ? '' : ` Get ${Math.ceil(total * 0.6)} right to clear this level.`)
        + (result.oldStars > stars ? ` Your best stays at ${plural(result.oldStars, 'star')}.` : '')
        + (stars === 2 && correct === total ? ' The clue keeps this round at 2 stars.' : '');
    } else if (done.kind === 'boss') {
      title = result.trophy ? `Boss defeated: ${result.trophy}!` : 'The boss got away this time';
      emblem = el('span', { className: 'trophy', textContent: result.trophy ? TROPHY_ICON[result.trophy] : '♛' });
      text = `${correct} of ${total} hits.` + (result.trophy ? '' : ` Land ${Math.ceil(total * 0.6)} hits to win a trophy.`);
    } else if (done.kind === 'daily') {
      title = 'Daily Spark done!';
      emblem = el('span', { className: 'trophy', textContent: '⚡' });
      text = `${correct} of ${total} correct. Mistakes come back in a later Daily Spark until you know them.`;
    } else {
      title = correct === total ? 'All fixed!' : 'Getting there';
      emblem = el('span', { className: 'trophy', textContent: '🔧' });
      text = `${correct} of ${total} fixed.`;
    }
    $('resultTitle').textContent = title;
    $('resultEmblem').replaceChildren(emblem);
    $('resultText').textContent = text + ($('saveStatus').hidden ? '' : ' This browser could not save your progress.');
    $('resultNotice').textContent = done.notice;
    $('rewardList').replaceChildren(...result.rewards.map((r) => el('li', { className: `reward is-${r.type}` },
      el('strong', { textContent: r.text }), r.detail ? el('small', { textContent: r.detail }) : null)));

    $('fixMistakes').hidden = !result.mistakes.length;
    $('fixMistakes').textContent = done.kind === 'repair' ? 'Try these again' : `Fix my ${plural(result.mistakes.length, 'mistake')}`;
    const nextIndex = done.kind === 'level' ? done.level.number : -1;
    const hasNext = done.kind === 'level' && nextIndex < done.track.levels.length + (done.track.hasBoss ? 1 : 0)
      && core.unlocked(done.track, nextIndex, progress);
    $('nextLevel').hidden = !hasNext;
    $('nextLevel').textContent = hasNext ? `Next: ${stopName(done.track, nextIndex)}` : 'Next stop';
    $('replayLevel').hidden = done.kind === 'repair';
    $('replayLevel').textContent = done.kind === 'daily' ? 'Five more' : 'Replay';
    $('backToMap').textContent = done.track ? 'Back to the trail' : 'Back to chapters';
    $('breakCard').hidden = done.kind === 'repair' || played % BREAK_EVERY !== 0;
    $('reviewSection').hidden = !result.mistakes.length;
    $('reviewList').replaceChildren(...done.answers.filter((a) => !a.correct).map((a) => {
      const q = done.questions.find((x) => x.id === a.id);
      return el('li', {},
        el('p', { textContent: q.text }),
        el('p', { className: 'yours', textContent: `Your answer: ${LETTERS[a.choice]}. ${q.options[a.choice]}` }),
        el('p', { className: 'right', textContent: `Right answer: ${LETTERS[q.answerIndex]}. ${q.options[q.answerIndex]}` }),
        el('p', { textContent: q.explanation }));
    }));
    renderPlayer();
    show('resultView', 'resultTitle');
    if (stars === 3 || result.trophy === 'gold' || (done.kind === 'repair' && correct === total)) confetti();
  }

  function afterRound() {
    const done = round;
    round = null;
    if (done?.track) openTrail(trackById(done.track.id));
    else renderHome(true);
  }

  /* ---------- trophies ---------- */
  function renderTrophies() {
    show('trophyView', 'trophyTitle');
    const classLevel = progress.classLevel;
    const inClass = tracks.filter((t) => t.classLevel === classLevel);
    const won = inClass.filter((t) => progress.trophies[t.id]).length;
    $('trophyMeta').textContent = `Class ${classLevel}: ${won} of ${inClass.length} chapter trophies · ${core.totalStars(progress)} stars in all`;
    const subjects = [...new Set(inClass.map((t) => t.subject))].sort();
    $('trophyShelf').replaceChildren(...subjects.map((subject) => el('section', { className: 'shelf-row' },
      el('h2', { textContent: subject }),
      el('ul', {}, ...inClass.filter((t) => t.subject === subject).map((t) => {
        const trophy = progress.trophies[t.id];
        const item = el('li', { className: trophy ? 'is-won' : '' },
          el('span', { className: 'cup', textContent: trophy ? TROPHY_ICON[trophy] : '○' }),
          el('span', { textContent: t.title }));
        item.setAttribute('aria-label', `${t.title}: ${trophy ? `${trophy} trophy` : 'no trophy yet'}`);
        return item;
      })))));
    $('badgeList').replaceChildren(...core.BADGES.map(([id, name, how]) => {
      const earned = Boolean(progress.badges[id]);
      const item = el('li', {}, el('strong', { textContent: name }),
        el('small', { textContent: how }),
        el('span', { className: 'badge-state', textContent: earned ? 'Earned' : 'Locked' }));
      item.setAttribute('aria-label', `${name}, ${earned ? 'earned' : 'locked'}. ${how}`);
      if (earned) item.classList.add('earned');
      return item;
    }));
  }

  /* ---------- small celebrations ---------- */
  function burst(anchor, text) {
    if (reduceMotion() || !anchor?.getBoundingClientRect) return;
    const box = anchor.getBoundingClientRect();
    const pop = el('span', { className: 'pop', textContent: text });
    pop.style.left = `${box.right - 56}px`;
    pop.style.top = `${box.top + 4}px`;
    $('burst').append(pop);
    setTimeout(() => pop.remove(), 900);
  }
  function confetti() {
    if (reduceMotion()) return;
    const colours = ['#dff04f', '#a9d8f1', '#ffb59d', '#bfe6d3', '#ffe08a', '#174b72'];
    for (let i = 0; i < 28; i += 1) {
      const bit = el('span', { className: 'confetti' });
      bit.style.left = `${5 + Math.random() * 90}%`;
      bit.style.background = colours[i % colours.length];
      bit.style.animationDelay = `${Math.random() * 0.25}s`;
      bit.style.setProperty('--drift', `${Math.round(Math.random() * 120 - 60)}px`);
      $('burst').append(bit);
      setTimeout(() => bit.remove(), 1800);
    }
  }

  /* ---------- controls ---------- */
  function bind() {
    $('dailyCard').addEventListener('click', startDaily);
    $('continueCard').addEventListener('click', () => { const t = trackById(progress.lastTrack); if (t) openTrail(t); });
    $('openTrophies').addEventListener('click', renderTrophies);
    $('trophyBack').addEventListener('click', () => renderHome(true));
    $('trailBack').addEventListener('click', () => renderHome(true));
    $('quitLevel').addEventListener('click', afterRound);
    $('clueButton').addEventListener('click', useClue);
    $('nextQuestion').addEventListener('click', nextQuestion);
    $('backToMap').addEventListener('click', afterRound);
    $('fixMistakes').addEventListener('click', () => { if (round?.result) startRepair(round); });
    $('replayLevel').addEventListener('click', () => {
      const done = round;
      if (!done) return;
      if (done.kind === 'level') startLevel(done.track, done.level, true);
      else if (done.kind === 'boss') startBoss(done.track);
      else if (done.kind === 'daily') startDaily();
    });
    $('nextLevel').addEventListener('click', () => {
      const done = round;
      if (!done || done.kind !== 'level') return;
      const i = done.level.number;
      if (i >= done.track.levels.length) startBoss(done.track);
      else startLevel(done.track, done.track.levels[i], Boolean(progress.levels[done.track.levels[i].id]));
    });
    document.addEventListener('keydown', (event) => {
      if (view !== 'playView' || !round || event.altKey || event.ctrlKey || event.metaKey) return;
      const key = event.key.toLowerCase();
      const index = '1234'.includes(key) ? Number(key) - 1 : 'abcd'.indexOf(key);
      if (index < 0 || round.answers.length > round.index) return;
      const button = [...$('playOptions').children][index];
      if (button && !button.disabled) button.click();
    });
  }

  bind();
  save();
  renderHome();
}());
