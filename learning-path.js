'use strict';

// One routing policy for both page adapters. Recall is not a diagnosis or a new test.
(function exposeLearningPath() {
  const adaptive = typeof module !== 'undefined' && module.exports
    ? require('./adaptive-engine.js') : window.IgniteAdaptive;

  function recoveryFor(question, selectedIndex, visibility = 'demo_sample') {
    if (!adaptive || !question || adaptive.activityIssue({
      type: 'single_choice', prompt: question.text, options: question.options,
      answerIndex: question.answerIndex, explanation: question.explanation,
    }, 'Question')) return { kind: 'unavailable', reason: 'This question needs a valid answer and explanation.' };
    const diagnosis = adaptive.diagnose(question, selectedIndex);
    if (diagnosis.status === 'correct') return { kind: 'correct' };
    if (diagnosis.status === 'invalid') return { kind: 'invalid', reason: diagnosis.reason };
    const approved = visibility === 'demo_sample' || (visibility === 'student' && question.adaptive?.reviewStatus === 'approved');
    const mission = approved ? adaptive.missionFor(question, diagnosis) : null;
    if (mission) return { kind: 'targeted', question, diagnosis, mission };
    return {
      kind: 'recall', question,
      reason: 'No targeted activity is available for this answer. Review the explanation, then recall the same question.',
      // Change option position, not the facts. Never advertise this as an unseen question.
      activity: {
        type: 'single_choice', prompt: question.text,
        options: [...question.options.slice(1), question.options[0]],
        answerIndex: (question.answerIndex + question.options.length - 1) % question.options.length,
        explanation: question.explanation,
      },
    };
  }

  function analyse(content, answers = {}) {
    const routes = (Array.isArray(content?.questions) ? content.questions : [])
      .filter((question) => question && Object.hasOwn(answers || {}, question.id))
      .map((question) => ({ questionId: question.id, ...recoveryFor(question, answers[question.id], content.visibility) }));
    return {
      routes,
      targeted: routes.filter((route) => route.kind === 'targeted'),
      recall: routes.filter((route) => route.kind === 'recall'),
      unavailable: routes.filter((route) => ['invalid', 'unavailable'].includes(route.kind)),
    };
  }

  const api = Object.freeze({ recoveryFor, analyse });
  if (typeof window !== 'undefined') window.IgniteLearningPath = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}());
