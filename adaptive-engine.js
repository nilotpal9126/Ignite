'use strict';

// Deterministic adaptive-learning core. It never infers a misconception from
// an untagged answer and keeps browser-local progress separate from exam marks.
(function exposeAdaptiveEngine() {
  const CONTENT_SCHEMA = '0.1.0';
  const PROGRESS_SCHEMA = '1.0.0';

  const text = (value) => typeof value === 'string' && value.trim().length > 0;
  const uniqueOptions = (options) => Array.isArray(options)
    && options.length >= 3 && options.length <= 4
    && options.every(text)
    && new Set(options.map((option) => option.trim().toLowerCase())).size === options.length;

  function activityIssue(choice, label) {
    if (!choice || !['single_choice', 'ordered_steps'].includes(choice.type)) return `${label} has an unsupported activity type`;
    if (!text(choice.prompt)) return `${label} needs a prompt`;
    if (!text(choice.explanation)) return `${label} needs an explanation`;
    if (choice.type === 'ordered_steps') {
      if (!Array.isArray(choice.steps) || choice.steps.length < 3 || choice.steps.length > 6
        || !choice.steps.every(text)
        || new Set(choice.steps.map((step) => step.trim().toLowerCase())).size !== choice.steps.length) {
        return `${label} needs three to six distinct steps in correct order`;
      }
      return '';
    }
    if (!uniqueOptions(choice.options)) return `${label} needs three or four distinct options`;
    if (!Number.isInteger(choice.answerIndex) || choice.answerIndex < 0 || choice.answerIndex >= choice.options.length) {
      return `${label} needs a valid answerIndex`;
    }
    return '';
  }

  function contentIssue(question) {
    const adaptive = question?.adaptive;
    if (!adaptive) return 'adaptive metadata is missing';
    if (!text(question.id) || !text(question.text) || !uniqueOptions(question.options)
      || !Number.isInteger(question.answerIndex) || question.answerIndex < 0 || question.answerIndex >= question.options.length) {
      return 'the parent question is invalid';
    }
    if (adaptive.schemaVersion !== CONTENT_SCHEMA) return 'adaptive schema version is unsupported';
    if (!adaptive.skill || !text(adaptive.skill.id) || !text(adaptive.skill.label)) return 'skill metadata is incomplete';
    if (!adaptive.optionDiagnostics || typeof adaptive.optionDiagnostics !== 'object' || Array.isArray(adaptive.optionDiagnostics)) {
      return 'option diagnostics are missing';
    }
    if (!Array.isArray(adaptive.missions) || !adaptive.missions.length) return 'remediation missions are missing';

    const missionIds = new Set();
    for (const mission of adaptive.missions) {
      if (!mission || !text(mission.id) || missionIds.has(mission.id)) return 'mission ids must be present and unique';
      missionIds.add(mission.id);
      if (!text(mission.title) || !text(mission.goal) || !text(mission.hint)) return `mission ${mission.id} is incomplete`;
      const challengeIssue = activityIssue(mission.challenge, `mission ${mission.id} challenge`);
      if (challengeIssue) return challengeIssue;
      const retryIssue = activityIssue(mission.retry, `mission ${mission.id} retry`);
      if (retryIssue) return retryIssue;
      if (mission.retry.type !== 'single_choice') return `mission ${mission.id} retry must be single_choice`;
    }

    for (const [rawIndex, diagnostic] of Object.entries(adaptive.optionDiagnostics)) {
      const index = Number(rawIndex);
      if (!Number.isInteger(index) || String(index) !== rawIndex || index < 0 || index >= question.options.length) return `diagnostic option ${rawIndex} is invalid`;
      if (index === question.answerIndex) return 'the correct option cannot carry a mistake diagnosis';
      if (!diagnostic || !text(diagnostic.code) || !text(diagnostic.feedback) || !text(diagnostic.missionId)) {
        return `diagnostic option ${rawIndex} is incomplete`;
      }
      if (!missionIds.has(diagnostic.missionId)) return `diagnostic option ${rawIndex} references an unknown mission`;
      if (diagnostic.confidence !== undefined && !['high', 'medium'].includes(diagnostic.confidence)) return `diagnostic option ${rawIndex} has invalid confidence`;
    }
    return '';
  }

  function diagnose(question, selectedIndex) {
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= (question?.options?.length || 0)) {
      return { status: 'invalid', reason: 'The submitted choice is invalid.' };
    }
    if (selectedIndex === question.answerIndex) return { status: 'correct' };
    const issue = contentIssue(question);
    if (issue) return { status: 'unknown', reason: issue };
    const tagged = question.adaptive.optionDiagnostics[String(selectedIndex)];
    if (!tagged) return { status: 'unknown', reason: 'This answer is not mapped to a specific misconception.' };
    return {
      status: 'diagnosed',
      skill: { id: question.adaptive.skill.id, label: question.adaptive.skill.label },
      errorCode: tagged.code,
      feedback: tagged.feedback,
      confidence: tagged.confidence || 'medium',
      missionId: tagged.missionId,
      source: 'tagged_distractor',
    };
  }

  function missionFor(question, diagnosis) {
    if (diagnosis?.status !== 'diagnosed' || contentIssue(question)) return null;
    if (diagnosis.skill?.id !== question.adaptive.skill.id) return null;
    return question.adaptive.missions.find((mission) => mission.id === diagnosis.missionId) || null;
  }

  // Stable shuffled order for a mission; never display the answer already sorted.
  function shuffledSteps(activity) {
    if (activityIssue(activity, 'activity') || activity.type !== 'ordered_steps') return [];
    const indices = activity.steps.map((_, index) => index);
    let seed = 2166136261;
    for (const char of activity.prompt) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
    for (let index = indices.length - 1; index > 0; index -= 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const other = seed % (index + 1);
      [indices[index], indices[other]] = [indices[other], indices[index]];
    }
    if (indices.every((value, index) => value === index)) indices.push(indices.shift());
    return indices;
  }

  function gradeActivity(activity, response) {
    if (activityIssue(activity, 'activity')) return { valid: false, correct: false };
    if (activity.type === 'ordered_steps') {
      const valid = Array.isArray(response) && response.length === activity.steps.length
        && new Set(response).size === response.length
        && response.every((index) => Number.isInteger(index) && index >= 0 && index < activity.steps.length);
      return { valid, correct: valid && response.every((value, index) => value === index) };
    }
    const valid = Number.isInteger(response) && response >= 0 && response < activity.options.length;
    return { valid, correct: valid && response === activity.answerIndex };
  }

  function progressKey(learnerId) {
    return `ignite-adaptive-v1:${encodeURIComponent(String(learnerId || 'anonymous'))}`;
  }

  function restoreProgress(raw) {
    try {
      const parsed = JSON.parse(raw || 'null');
      if (parsed?.schemaVersion !== PROGRESS_SCHEMA || !parsed.skills || typeof parsed.skills !== 'object' || Array.isArray(parsed.skills)) throw new Error('invalid');
      const skills = Object.create(null);
      const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;
      for (const [skillId, state] of Object.entries(parsed.skills)) {
        if (!text(skillId) || !state || typeof state !== 'object') continue;
        skills[skillId] = {
          label: text(state.label) ? state.label : skillId,
          rescueAttempts: count(state.rescueAttempts),
          recoveries: Math.min(count(state.recoveries), count(state.rescueAttempts)),
          hintsUsed: Math.min(count(state.hintsUsed), count(state.rescueAttempts)),
          status: ['RECOVERED_THIS_SESSION', 'NEEDS_REVIEW'].includes(state.status) ? state.status : 'NEEDS_REVIEW',
          updatedAt: text(state.updatedAt) ? state.updatedAt : '',
        };
      }
      const sessionIds = Array.isArray(parsed.sessionIds) ? [...new Set(parsed.sessionIds.filter(text))] : [];
      return { schemaVersion: PROGRESS_SCHEMA, skills, sessionIds };
    } catch {
      return { schemaVersion: PROGRESS_SCHEMA, skills: Object.create(null), sessionIds: [] };
    }
  }

  function updateProgress(current, diagnosis, outcome) {
    const progress = restoreProgress(JSON.stringify(current || null));
    if (diagnosis?.status !== 'diagnosed' || !text(diagnosis.skill?.id) || !text(diagnosis.skill?.label)
      || outcome?.completed !== true || typeof outcome.retryCorrect !== 'boolean'
      || typeof outcome.hintUsed !== 'boolean' || !text(outcome.sessionId)
      || progress.sessionIds.includes(outcome.sessionId)) return progress;
    progress.sessionIds.push(outcome.sessionId);
    const prior = progress.skills[diagnosis.skill.id] || {
      label: diagnosis.skill.label, rescueAttempts: 0, recoveries: 0, hintsUsed: 0,
      status: 'NEEDS_REVIEW', updatedAt: '',
    };
    progress.skills[diagnosis.skill.id] = {
      label: diagnosis.skill.label,
      rescueAttempts: prior.rescueAttempts + 1,
      recoveries: prior.recoveries + (outcome.retryCorrect ? 1 : 0),
      hintsUsed: prior.hintsUsed + (outcome.hintUsed ? 1 : 0),
      status: outcome.retryCorrect ? 'RECOVERED_THIS_SESSION' : 'NEEDS_REVIEW',
      updatedAt: text(outcome.occurredAt) ? outcome.occurredAt : new Date().toISOString(),
    };
    return progress;
  }

  function summary(progress) {
    const skills = Object.values(restoreProgress(JSON.stringify(progress || null)).skills);
    return {
      skillsPractised: skills.length,
      rescuesCompleted: skills.reduce((total, skill) => total + skill.rescueAttempts, 0),
      recoveries: skills.reduce((total, skill) => total + skill.recoveries, 0),
      needsReview: skills.filter((skill) => skill.status === 'NEEDS_REVIEW').length,
    };
  }

  const api = Object.freeze({
    CONTENT_SCHEMA, contentIssue, activityIssue, diagnose, missionFor, shuffledSteps, gradeActivity,
    progressKey, restoreProgress, updateProgress, summary,
  });
  if (typeof window !== 'undefined') window.IgniteAdaptive = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}());
