'use strict';

// Browser-local sample sessions. Keys isolate learners; this is not server access control.
(function exposeAssessmentSessions() {
  const assessment = typeof module !== 'undefined' && module.exports
    ? require('./assessment-engine.js') : window.IgniteAssessment;
  const adaptive = typeof module !== 'undefined' && module.exports
    ? require('./adaptive-engine.js') : window.IgniteAdaptive;
  const text = (value) => typeof value === 'string' && value.trim().length > 0;

  function key(learnerId, bankId) {
    return `ignite-follow-up-v1:${encodeURIComponent(learnerId)}:${encodeURIComponent(bankId)}`;
  }

  function restoreRecord(raw, bankId) {
    const empty = () => ({ schemaVersion: '1.0.0', bankId, seenItemIds: [], latest: null });
    try {
      const parsed = JSON.parse(raw || 'null');
      if (parsed?.schemaVersion !== '1.0.0' || parsed.bankId !== bankId || !Array.isArray(parsed.seenItemIds)) return empty();
      const record = { ...empty(), seenItemIds: [...new Set(parsed.seenItemIds.filter(text))] };
      const latest = parsed.latest;
      if (latest && text(latest.id) && text(latest.signature)
        && Array.isArray(latest.questionIds) && latest.questionIds.length > 0 && latest.questionIds.length <= 10
        && latest.questionIds.every(text) && new Set(latest.questionIds).size === latest.questionIds.length) {
        const answers = Object.create(null);
        for (const id of latest.questionIds) {
          const value = latest.answers?.[id];
          if (Number.isInteger(value) && value >= 0 && value < 4) answers[id] = value;
        }
        record.latest = { id: latest.id, signature: latest.signature, questionIds: [...latest.questionIds], answers };
      }
      return record;
    } catch { return empty(); }
  }

  function signature(content, answers, bank, attemptId) {
    return JSON.stringify([attemptId, content.id, content.visibility, content.questions,
      content.questions.map((question) => [question.id, answers[question.id] ?? null]), bank]);
  }

  function prepareTest(content, answers, bank, record, settings) {
    const currentSignature = signature(content, answers, bank, settings.attemptId);
    const latest = record.latest?.signature === currentSignature ? record.latest : null;
    const seenItemIds = record.seenItemIds.filter((id) => !latest?.questionIds.includes(id));
    let plan = assessment.planFollowUpTest(content, answers, bank, { ...settings, seenItemIds });
    const matches = latest && JSON.stringify(latest.questionIds) === JSON.stringify(plan.questions.map((question) => question.id));
    if (latest && !matches) plan = assessment.planFollowUpTest(content, answers, bank, { ...settings, seenItemIds: record.seenItemIds });
    // Revalidate restored answers against the current bank before resuming.
    const restoredAnswers = {};
    if (matches) for (const question of plan.questions) {
      if (!adaptive.gradeActivity(question, latest.answers[question.id]).valid) break;
      restoredAnswers[question.id] = latest.answers[question.id];
    }
    const session = matches ? {
      ...latest, answers: restoredAnswers,
    } : null;
    return { plan, signature: currentSignature, session };
  }

  function begin(record, prepared, sessionId) {
    if (!['ready', 'partial'].includes(prepared.plan.status) || !prepared.plan.questions.length || !text(sessionId)) return record;
    return { ...record, latest: prepared.session || {
      id: sessionId, signature: prepared.signature, questionIds: prepared.plan.questions.map((question) => question.id), answers: {},
    } };
  }

  function markSeen(record, sessionId, questionId) {
    if (record.latest?.id !== sessionId || !record.latest.questionIds.includes(questionId)) return record;
    return { ...record, seenItemIds: [...new Set([...record.seenItemIds, questionId])] };
  }

  function recordAnswer(record, sessionId, plan, questionId, response) {
    const latest = record.latest;
    if (!latest || latest.id !== sessionId || Object.hasOwn(latest.answers, questionId)
      || JSON.stringify(latest.questionIds) !== JSON.stringify(plan.questions.map((question) => question.id))) return record;
    const question = plan.questions.find((item) => item.id === questionId);
    if (!question || !adaptive.gradeActivity(question, response).valid) return record;
    return { ...record, latest: { ...latest, answers: { ...latest.answers, [questionId]: response } } };
  }

  const api = Object.freeze({ key, restoreRecord, prepareTest, begin, markSeen, recordAnswer });
  if (typeof window !== 'undefined') window.IgniteAssessmentSession = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}());
