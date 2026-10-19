'use strict';

// Assemble a short follow-up assessment from a separately authored question bank.
// Unknown diagnoses remain visible as coverage gaps. This does not invent questions.
(function exposeAssessmentEngine() {
  const adaptive = typeof module !== 'undefined' && module.exports
    ? require('./adaptive-engine.js') : window.IgniteAdaptive;
  const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
  const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

  function bankIssue(bank) {
    if (bank?.schemaVersion !== 'ignite-assessment-bank/0.1' || !nonempty(bank.id) || !nonempty(bank.version)) {
      return 'Assessment bank identity or schema is invalid.';
    }
    if (!['pending', 'approved'].includes(bank.reviewStatus)) return 'Assessment bank review status is missing.';
    if (!Array.isArray(bank.items)) return 'Assessment bank items are missing.';
    const ids = new Set();
    const prompts = new Set();
    for (const item of bank.items) {
      if (!item || !nonempty(item.id) || ids.has(item.id)) return 'Assessment item ids must be present and unique.';
      ids.add(item.id);
      if (!nonempty(item.skillId) || !Array.isArray(item.errorCodes) || !item.errorCodes.length
        || !item.errorCodes.every(nonempty)) return `Assessment ${item.id} has incomplete targeting metadata.`;
      if (!Number.isInteger(item.difficulty) || item.difficulty < 1 || item.difficulty > 3) return `Assessment ${item.id} has invalid difficulty.`;
      const issue = adaptive.activityIssue(item, `Assessment ${item.id}`);
      if (issue || item.type !== 'single_choice') return issue || `Assessment ${item.id} must be single_choice.`;
      const prompt = normalize(item.prompt);
      if (prompts.has(prompt)) return 'Assessment prompts must be distinct.';
      prompts.add(prompt);
    }
    return '';
  }

  function planFollowUpTest(content, answers, bank, settings = {}) {
    settings = settings && typeof settings === 'object' ? settings : {};
    const count = settings.maxQuestions === undefined ? 3 : settings.maxQuestions;
    const base = {
      schemaVersion: 'ignite-follow-up-test/0.1', status: 'unavailable',
      bankId: bank?.id || '', bankVersion: bank?.version || '', contentId: content?.id || '',
      requestedCount: count, questions: [], targets: [], unresolved: [], coverageGaps: [],
      notice: 'Practice check only; a successful short test does not establish lasting mastery.',
    };
    if (!Number.isInteger(count) || count < 1 || count > 10) return { ...base, reason: 'Request one to ten questions.' };
    if (!content || !['student', 'demo_sample'].includes(content.visibility) || !Array.isArray(content.questions)
      || !answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return { ...base, reason: 'A playable worksheet and its answer record are required.' };
    }
    const questionIds = new Set();
    for (const question of content.questions) {
      if (!question || !nonempty(question.id) || !nonempty(question.text) || questionIds.has(question.id)
        || !Array.isArray(question.options) || question.options.length < 3
        || !question.options.every(nonempty) || !Number.isInteger(question.answerIndex)
        || question.answerIndex < 0 || question.answerIndex >= question.options.length) {
        return { ...base, reason: 'The worksheet contains malformed or duplicate questions.' };
      }
      questionIds.add(question.id);
    }

    const groups = new Map();
    const excludedPrompts = new Set();
    for (const question of content.questions) {
      excludedPrompts.add(normalize(question.text));
      for (const mission of question.adaptive?.missions || []) {
        excludedPrompts.add(normalize(mission.challenge?.prompt));
        excludedPrompts.add(normalize(mission.retry?.prompt));
      }
      const selected = Object.hasOwn(answers, question.id) ? answers[question.id] : undefined;
      if (selected === undefined) continue; // Skipped is different from incorrect.
      const diagnosis = adaptive.diagnose(question, selected);
      if (diagnosis.status === 'correct') continue;
      if (diagnosis.status !== 'diagnosed') {
        base.unresolved.push({ questionId: question.id, status: diagnosis.status, reason: diagnosis.reason });
        continue;
      }
      const key = JSON.stringify([diagnosis.skill.id, diagnosis.errorCode]);
      if (!groups.has(key)) groups.set(key, {
        skillId: diagnosis.skill.id, skillLabel: diagnosis.skill.label, errorCode: diagnosis.errorCode,
        questionIds: [], mistakes: 0,
      });
      groups.get(key).mistakes += 1;
      groups.get(key).questionIds.push(question.id);
    }
    base.targets = [...groups.values()].sort((a, b) => b.mistakes - a.mistakes
      || a.skillId.localeCompare(b.skillId) || a.errorCode.localeCompare(b.errorCode));
    if (!base.targets.length) return { ...base, status: 'no_target', reason: 'No supported mistake diagnosis is available.' };
    const issue = bankIssue(bank);
    if (issue) return { ...base, reason: issue };
    if (bank.reviewStatus !== 'approved' && !(content.visibility === 'demo_sample' && settings.allowUnreviewedDemo === true)) {
      return { ...base, status: 'review_required', reason: 'The follow-up question bank needs academic approval.' };
    }
    if (bank.reviewStatus !== 'approved') base.notice = 'SIMULATION SAMPLE: follow-up questions await teacher review. ' + base.notice;

    const seen = new Set(Array.isArray(settings.seenItemIds) ? settings.seenItemIds : []);
    const candidates = base.targets.map((target) => bank.items.filter((item) => item.skillId === target.skillId
      && item.errorCodes.includes(target.errorCode) && !seen.has(item.id)
      && !excludedPrompts.has(normalize(item.prompt)))
      .sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id)));
    const picked = new Set();
    const selectedPrompts = new Set();
    // Round-robin across error groups before adding more questions to one group.
    while (base.questions.length < count) {
      let added = false;
      for (let index = 0; index < candidates.length && base.questions.length < count; index += 1) {
        const target = base.targets[index];
        const item = candidates[index].find((candidate) => !picked.has(candidate.id)
          && !selectedPrompts.has(normalize(candidate.prompt)));
        if (!item) continue;
        picked.add(item.id); selectedPrompts.add(normalize(item.prompt));
        base.questions.push({
          id: item.id, type: item.type, prompt: item.prompt, options: [...item.options],
          answerIndex: item.answerIndex, explanation: item.explanation, difficulty: item.difficulty,
          skillId: item.skillId, targetErrorCode: target.errorCode, sourceQuestionIds: [...target.questionIds],
        });
        added = true;
      }
      if (!added) break;
    }
    base.coverageGaps = base.targets.filter((target) => !base.questions.some((item) =>
      item.skillId === target.skillId && item.targetErrorCode === target.errorCode));
    const status = !base.questions.length ? 'insufficient' : base.questions.length < count
      || base.coverageGaps.length || base.unresolved.length ? 'partial' : 'ready';
    return { ...base, status, reason: base.questions.length < count ? 'The available bank cannot fill the requested test without reuse.' : '' };
  }

  function gradeFollowUpTest(plan, responses) {
    if (!Array.isArray(plan?.questions) || !['ready', 'partial'].includes(plan.status) || !plan.questions.length
      || !responses || typeof responses !== 'object' || Array.isArray(responses)) {
      return { status: 'invalid', reason: 'A prepared follow-up test and response record are required.' };
    }
    let correct = 0, answered = 0;
    const results = [];
    const skills = new Map();
    for (const question of plan.questions) {
      const response = Object.hasOwn(responses, question.id) ? responses[question.id] : undefined;
      const grade = adaptive.gradeActivity(question, response);
      answered += grade.valid ? 1 : 0;
      correct += grade.correct ? 1 : 0;
      results.push({ questionId: question.id, skillId: question.skillId,
        status: grade.valid ? grade.correct ? 'correct' : 'incorrect' : 'unanswered' });
      if (!skills.has(question.skillId)) skills.set(question.skillId, { skillId: question.skillId, correct: 0, answered: 0, total: 0 });
      const skill = skills.get(question.skillId);
      skill.total += 1; skill.answered += grade.valid ? 1 : 0; skill.correct += grade.correct ? 1 : 0;
    }
    return {
      status: answered === plan.questions.length ? 'complete' : 'incomplete',
      correct, answered, total: plan.questions.length, results,
      skills: [...skills.values()].map((skill) => ({ ...skill, status: skill.answered < skill.total ? 'INCOMPLETE'
        : skill.correct === skill.total ? 'FOLLOW_UP_PASSED' : 'NEEDS_REVIEW' })),
      unresolved: plan.unresolved, coverageGaps: plan.coverageGaps,
    };
  }

  const api = Object.freeze({ bankIssue, planFollowUpTest, gradeFollowUpTest });
  if (typeof window !== 'undefined') window.IgniteAssessment = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}());
