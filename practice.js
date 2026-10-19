'use strict';

// Practice results are browser-local demo data, never authoritative exam marks.
(function exposePractice() {
  function playable(content) {
    if (!content || !['demo_sample', 'student'].includes(content.visibility)) return false;
    if (!Array.isArray(content.questions) || !content.questions.length) return false;
    const ids = new Set();
    return content.questions.every((q) => {
      if (!q || typeof q.id !== 'string' || !q.id.trim() || ids.has(q.id)) return false;
      ids.add(q.id);
      return typeof q.text === 'string' && q.text.trim()
        && Array.isArray(q.options) && q.options.length === 4
        && q.options.every((o) => typeof o === 'string' && o.trim())
        && new Set(q.options.map((o) => o.trim().toLowerCase())).size === 4
        && Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex < 4
        && typeof q.explanation === 'string' && q.explanation.trim();
    });
  }

  function version(content) {
    return JSON.stringify(content.questions.map((q) => [q.id, q.text, q.options, q.answerIndex, q.explanation, q.adaptive || null]));
  }

  function restore(content, raw) {
    const answers = Object.create(null);
    try {
      const saved = JSON.parse(raw || 'null');
      if (saved?.version !== version(content)) return answers;
      for (const q of content.questions) {
        const index = saved.answers?.[q.id];
        if (Number.isInteger(index) && index >= 0 && index < q.options.length) answers[q.id] = index;
      }
    } catch { /* A corrupt or outdated record starts a fresh attempt. */ }
    return answers;
  }

  function score(questions, answers) {
    let answered = 0;
    let correct = 0;
    const mistakes = [];
    for (const q of questions) {
      const index = answers[q.id];
      if (!Number.isInteger(index) || index < 0 || index >= q.options.length) continue;
      answered += 1;
      if (index === q.answerIndex) correct += 1;
      else mistakes.push(q.id);
    }
    return { answered, correct, total: questions.length, mistakes, complete: answered === questions.length };
  }

  function key(learnerId, contentId) {
    return `ignite-practice-v1:${encodeURIComponent(learnerId)}:${encodeURIComponent(contentId)}`;
  }

  window.IgnitePractice = Object.freeze({ playable, version, restore, score, key });
}());
