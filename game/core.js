'use strict';

// Ignite game rules: pure functions over content and a progress record. No DOM, no storage, so the same rules
// run in the game, the dashboard and Node tests. Scores are practice rewards saved on the device, never exam marks.
(function exposeCore(root) {
  const XP = Object.freeze({ answer: 10, clue: 5, star: 5, repair: 5, daily: 20, boss: 30 });
  const BOX_DAYS = [0, 1, 2, 4, 7, 14]; // Leitner box 1..5 -> days until the question is due again
  const BOSS_SIZE = 10;
  const DAILY_SIZE = 5;
  const RANKS = Object.freeze([[0, 'Spark', '✦'], [100, 'Flame', '✺'], [300, 'Blaze', '✹'], [600, 'Comet', '☄'],
    [1000, 'Star', '★'], [1600, 'Supernova', '✷']]);
  const BADGES = Object.freeze([
    ['first', 'First steps', 'Finish your first round'],
    ['perfect', 'Perfect round', '3 stars on a level'],
    ['streak', 'Hot streak', '5 right answers in a row'],
    ['comeback', 'Comeback', 'Replay a level and earn more stars'],
    ['fixer', 'Fixer', 'Fix every mistake in a Fix-it round'],
    ['giant', 'Boss beater', 'Win a chapter trophy in a boss round'],
    ['explorer', 'Explorer', 'Play 3 different chapters'],
    ['steady', 'Steady spark', 'Play 3 days in a row'],
    ['champion', 'Chapter champion', '3 stars on every level of a chapter'],
    ['collector', 'Star collector', 'Collect 25 stars'],
  ]);
  const TROPHY_RANK = { bronze: 1, silver: 2, gold: 3 };

  /* ---------- days (local calendar, YYYY-MM-DD) ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  function todayKey(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  const keyToUtc = (key) => { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  function addDays(key, days) {
    const date = new Date(keyToUtc(key) + days * 86400000);
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }
  const daysBetween = (from, to) => Math.round((keyToUtc(to) - keyToUtc(from)) / 86400000);
  const isDay = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

  /* ---------- randomness (seedable for tests) ---------- */
  function seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(list, random = Math.random) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /* ---------- content ---------- */
  // Playable sets grouped into chapter tracks. A set without `series` is a one-level track of its own.
  function buildTracks(items, playable) {
    const tracks = new Map();
    for (const set of Array.isArray(items) ? items : []) {
      if (typeof playable === 'function' && !playable(set)) continue;
      const series = set.series && typeof set.series.id === 'string'
        ? set.series : { id: set.id, title: set.chapter || set.title, level: 1 };
      if (!tracks.has(series.id)) {
        tracks.set(series.id, { id: series.id, title: String(series.title || set.chapter || set.title),
          classLevel: Number(set.classLevel), subject: String(set.subject || 'General'), levels: [] });
      }
      tracks.get(series.id).levels.push({ set, order: Number(series.level) || 1 });
    }
    const out = [];
    for (const track of tracks.values()) {
      if (!Number.isFinite(track.classLevel)) continue;
      track.levels = track.levels.sort((a, b) => a.order - b.order).map(({ set }, index) => ({
        id: set.id, number: index + 1, set, track, questions: set.questions, notice: set.notice || '' }));
      track.hasBoss = track.levels.length >= 2;
      track.questionCount = track.levels.reduce((n, level) => n + level.questions.length, 0);
      out.push(track);
    }
    return out.sort((a, b) => a.classLevel - b.classLevel || a.subject.localeCompare(b.subject)
      || a.title.localeCompare(b.title));
  }

  // Every question with the level it belongs to (ids are unique across the content file).
  function questionIndex(tracks) {
    const index = new Map();
    for (const track of tracks) for (const level of track.levels) {
      for (const q of level.questions) if (!index.has(q.id)) index.set(q.id, { q, level, track });
    }
    return index;
  }

  /* ---------- progress ---------- */
  function freshProgress() {
    return { v: 2, xp: 0, levels: {}, solved: {}, repaired: {}, boxes: {}, badges: {}, trophies: {}, bosses: {},
      streak: { days: 0, best: 0, lastDay: null }, daily: { lastDay: null, count: 0 },
      classLevel: null, subject: null, lastTrack: null };
  }

  const plainObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
  const count = (value, max = 1e7) => (Number.isFinite(value) ? Math.min(max, Math.max(0, Math.round(value))) : 0);

  // Any stored record (v2, or a v1 Levels record) becomes a safe v2 record; anything unreadable starts fresh.
  function migrate(raw) {
    const out = freshProgress();
    const src = plainObject(raw);
    out.xp = count(src.xp);
    for (const [id, rec] of Object.entries(plainObject(src.levels))) {
      const r = plainObject(rec);
      out.levels[id] = { stars: count(r.stars, 3), best: count(r.best, 100), total: count(r.total, 100),
        plays: count(r.plays) };
    }
    for (const key of ['solved', 'repaired', 'badges', 'bosses']) {
      for (const [id, value] of Object.entries(plainObject(src[key]))) if (value) out[key][id] = value;
    }
    for (const [id, value] of Object.entries(plainObject(src.trophies))) if (TROPHY_RANK[value]) out.trophies[id] = value;
    for (const [id, box] of Object.entries(plainObject(src.boxes))) {
      const b = plainObject(box);
      if (isDay(b.due)) out.boxes[id] = { b: Math.min(5, Math.max(1, count(b.b, 5) || 1)), due: b.due };
    }
    const streak = plainObject(src.streak);
    out.streak = { days: count(streak.days), best: count(streak.best), lastDay: isDay(streak.lastDay) ? streak.lastDay : null };
    const daily = plainObject(src.daily);
    out.daily = { lastDay: isDay(daily.lastDay) ? daily.lastDay : null, count: count(daily.count) };
    out.classLevel = Number.isFinite(src.classLevel) ? src.classLevel : null;
    out.subject = typeof src.subject === 'string' ? src.subject : null;
    out.lastTrack = typeof src.lastTrack === 'string' ? src.lastTrack : null;
    return out;
  }

  /* ---------- rules ---------- */
  function starsFor(correct, total) {
    const ratio = total ? correct / total : 0;
    return ratio >= 1 ? 3 : ratio >= 0.8 ? 2 : ratio >= 0.6 ? 1 : 0;
  }
  function trophyFor(correct, total) {
    const stars = starsFor(correct, total);
    return stars === 3 ? 'gold' : stars === 2 ? 'silver' : stars === 1 ? 'bronze' : null;
  }
  const betterTrophy = (a, b) => ((TROPHY_RANK[b] || 0) > (TROPHY_RANK[a] || 0) ? b : a || null);
  const starsOf = (progress, levelId) => progress.levels[levelId]?.stars || 0;

  // Level n opens when level n-1 has a star; the boss (index === levels.length) opens when every level has one.
  function unlocked(track, index, progress) {
    if (index === 0) return true;
    if (index >= track.levels.length) return track.hasBoss && track.levels.every((l) => starsOf(progress, l.id) >= 1);
    return starsOf(progress, track.levels[index - 1].id) >= 1;
  }

  function rankFor(xp) {
    let index = 0;
    while (index + 1 < RANKS.length && xp >= RANKS[index + 1][0]) index += 1;
    const [floor, name, icon] = RANKS[index];
    const next = RANKS[index + 1] || null;
    return { name, icon, floor, next: next ? { name: next[1], xp: next[0] } : null,
      percent: next ? Math.round(100 * (xp - floor) / (next[0] - floor)) : 100 };
  }

  const totalStars = (progress) => Object.values(progress.levels).reduce((n, r) => n + (r.stars || 0), 0);

  // Leitner update after any answer: wrong goes back to box 1 (due tomorrow), right moves up a box.
  function review(progress, qid, correct, today) {
    const box = progress.boxes[qid]?.b || 0;
    const b = correct ? Math.min(5, box + 1) : 1;
    progress.boxes[qid] = { b, due: addDays(today, BOX_DAYS[b]) };
  }

  // Boss: up to 10 questions from the whole chapter, the student's weakest first, in a shuffled order.
  function bossPool(track, progress, random = Math.random) {
    const all = track.levels.flatMap((level) => level.questions);
    const weak = shuffle(all.filter((q) => (progress.boxes[q.id]?.b || 0) === 1), random);
    const rest = shuffle(all.filter((q) => (progress.boxes[q.id]?.b || 0) !== 1), random);
    return shuffle([...weak, ...rest].slice(0, BOSS_SIZE), random);
  }

  // Daily Spark: due mistakes first, then unseen questions from chapters already played, then new ones from the
  // student's class, then anything. Five questions, each once.
  function dailyPicks(tracks, progress, today, classLevel, random = Math.random) {
    const index = questionIndex(tracks);
    const picked = [];
    const take = (ids) => { for (const id of ids) if (picked.length < DAILY_SIZE && !picked.includes(id)) picked.push(id); };
    const due = Object.entries(progress.boxes).filter(([id, box]) => index.has(id) && box.due <= today)
      .sort((a, b) => a[1].b - b[1].b || a[1].due.localeCompare(b[1].due)).map(([id]) => id);
    take(due);
    const played = tracks.filter((t) => t.levels.some((l) => progress.levels[l.id]));
    const unseen = (list) => list.flatMap((t) => t.levels.flatMap((l) => l.questions.map((q) => q.id)))
      .filter((id) => !progress.boxes[id]);
    take(shuffle(unseen(played), random));
    take(shuffle(unseen(tracks.filter((t) => t.classLevel === classLevel)), random));
    take(shuffle([...index.keys()], random));
    return picked.map((id) => index.get(id));
  }

  function markDay(progress, today) {
    const s = progress.streak;
    if (s.lastDay === today) return false;
    s.days = s.lastDay && daysBetween(s.lastDay, today) === 1 ? s.days + 1 : 1;
    s.lastDay = today;
    s.best = Math.max(s.best, s.days);
    return true;
  }

  /* ---------- a round ---------- */
  // kind: 'level' | 'boss' | 'daily' | 'repair'. One 50:50 clue per round, never in Fix-it.
  function newRound(kind, questions, extra = {}) {
    return { kind, questions, index: 0, answers: [], clueUsed: false, clueOn: null, hidden: [], streak: 0,
      bestStreak: 0, xp: 0, ...extra };
  }

  // Two wrong options to hide for the current question.
  function clue(round, random = Math.random) {
    if (round.kind === 'repair' || round.clueUsed) return null;
    const q = round.questions[round.index];
    const wrong = q.options.map((_, i) => i).filter((i) => i !== q.answerIndex);
    round.clueUsed = true;
    round.clueOn = q.id;
    round.hidden = shuffle(wrong, random).slice(0, Math.max(0, q.options.length - 2));
    return round.hidden;
  }

  // Records one answer and its XP. Returns {correct, xp}.
  function answer(progress, round, choice, today) {
    const q = round.questions[round.index];
    const correct = choice === q.answerIndex;
    const assisted = round.clueOn === q.id;
    round.answers.push({ id: q.id, choice, correct, assisted });
    round.streak = correct ? round.streak + 1 : 0;
    round.bestStreak = Math.max(round.bestStreak, round.streak);
    let xp = 0;
    if (correct && round.kind === 'repair') {
      if (!progress.repaired[q.id]) { progress.repaired[q.id] = 1; xp = XP.repair; }
    } else if (correct && !progress.solved[q.id]) {
      progress.solved[q.id] = 1;
      xp = assisted ? XP.clue : XP.answer;
    }
    progress.xp += xp;
    round.xp += xp;
    review(progress, q.id, correct, today);
    return { correct, xp };
  }

  function award(progress, id, rewards, today) {
    if (progress.badges[id]) return;
    progress.badges[id] = today;
    const badge = BADGES.find(([key]) => key === id);
    rewards.push({ type: 'badge', text: `New badge: ${badge[1]}`, detail: badge[2] });
  }

  // Applies the round's result to progress. Returns what the results screen shows.
  function settle(progress, round, tracks, today) {
    const total = round.questions.length;
    const correct = round.answers.filter((a) => a.correct).length;
    const rewards = [];
    const result = { kind: round.kind, correct, total, stars: 0, trophy: null, bestStars: 0, oldStars: 0,
      unlockedNext: false, rewards, mistakes: round.answers.filter((a) => !a.correct).map((a) => a.id) };
    const xpBefore = progress.xp - round.xp;
    const track = round.track || null;

    if (round.kind === 'level') {
      const level = round.level;
      const before = progress.levels[level.id];
      const nextIndex = level.number; // index of the following level (or the boss)
      const nextWasOpen = track && unlocked(track, nextIndex, progress);
      let stars = starsFor(correct, total);
      if (stars === 3 && round.answers.some((a) => a.assisted)) stars = 2; // a clue caps the round at 2 stars
      const oldStars = before?.stars || 0;
      if (stars > oldStars) progress.xp += (stars - oldStars) * XP.star;
      progress.levels[level.id] = { stars: Math.max(stars, oldStars), best: Math.max(correct, before?.best || 0),
        total, plays: (before?.plays || 0) + 1 };
      Object.assign(result, { stars, oldStars, bestStars: Math.max(stars, oldStars) });
      if (track && !nextWasOpen && nextIndex <= track.levels.length && unlocked(track, nextIndex, progress)) {
        result.unlockedNext = true;
        rewards.push({ type: 'unlock', text: nextIndex === track.levels.length ? 'Boss round unlocked' : `Level ${nextIndex + 1} unlocked` });
      }
      if (before && stars > oldStars) {
        rewards.push({ type: 'note', text: `Improved from ${oldStars} to ${stars} stars` });
        award(progress, 'comeback', rewards, today);
      }
      if (stars === 3) award(progress, 'perfect', rewards, today);
      if (track && track.levels.length === 1) { // a one-level chapter has no boss; its level earns the trophy
        const trophy = [null, 'bronze', 'silver', 'gold'][stars];
        const best = betterTrophy(progress.trophies[track.id], trophy);
        if (best) progress.trophies[track.id] = best;
        result.trophy = trophy;
      }
      if (track && track.levels.every((l) => starsOf(progress, l.id) === 3)) award(progress, 'champion', rewards, today);
    } else if (round.kind === 'boss') {
      const trophy = trophyFor(correct, total);
      result.trophy = trophy;
      result.stars = starsFor(correct, total);
      if (trophy) {
        const old = progress.trophies[track.id];
        progress.trophies[track.id] = betterTrophy(old, trophy);
        if (!progress.bosses[track.id]) {
          progress.bosses[track.id] = today;
          progress.xp += XP.boss;
        }
        if (trophy !== old && betterTrophy(old, trophy) === trophy) rewards.push({ type: 'trophy', text: `${trophy[0].toUpperCase()}${trophy.slice(1)} trophy` });
        award(progress, 'giant', rewards, today);
      }
    } else if (round.kind === 'daily') {
      if (progress.daily.lastDay !== today) {
        progress.daily.lastDay = today;
        progress.daily.count += 1;
        progress.xp += XP.daily;
        rewards.push({ type: 'note', text: 'Daily Spark done for today' });
      }
    } else if (round.kind === 'repair') {
      if (total && correct === total) award(progress, 'fixer', rewards, today);
    }

    if (round.bestStreak >= 5) award(progress, 'streak', rewards, today);
    award(progress, 'first', rewards, today);
    if (markDay(progress, today) && progress.streak.days > 1) {
      rewards.push({ type: 'streak', text: `${progress.streak.days}-day streak` });
    }
    if (progress.streak.days >= 3) award(progress, 'steady', rewards, today);
    const chapters = tracks.filter((t) => t.levels.some((l) => progress.levels[l.id]) || progress.bosses[t.id]);
    if (chapters.length >= 3) award(progress, 'explorer', rewards, today);
    if (totalStars(progress) >= 25) award(progress, 'collector', rewards, today);
    if (track) progress.lastTrack = track.id;
    result.xp = progress.xp - xpBefore;
    if (result.xp) rewards.unshift({ type: 'xp', text: `+${result.xp} XP` });
    return result;
  }

  root.IgniteGameCore = Object.freeze({
    XP, BADGES, RANKS, BOSS_SIZE, DAILY_SIZE, todayKey, addDays, daysBetween, seeded, shuffle, buildTracks,
    questionIndex, freshProgress, migrate, starsFor, trophyFor, unlocked, rankFor, totalStars, review, bossPool,
    dailyPicks, markDay, newRound, clue, answer, settle,
  });
}(typeof window !== 'undefined' ? window : globalThis));
