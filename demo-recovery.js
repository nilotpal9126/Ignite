'use strict';

// Anonymous recovery games share the actual analyser and grader with the dashboard.
// All answers, stars and exposure history are held in page memory only.
(function exposeDemoRecovery() {
  function create(root, settings = {}) {
    let content = null, answers = {}, current = null, generation = 0, view = 0;
    let recallView = null;
    const stars = new Set();
    const seen = new Set();
    const completed = new Set();
    const make = (tag, className, value) => Object.assign(document.createElement(tag), {
      className: className || '', textContent: value || '',
    });
    const action = (label, name, handler) => {
      const button = make('button', 'demo-game-button', label);
      button.type = 'button'; button.dataset.action = name;
      const token = generation;
      const screen = view;
      button.addEventListener('click', () => { if (token === generation && screen === view) handler(); });
      return button;
    };

    function diagnoses() {
      return window.IgniteLearningPath?.analyse(content, answers).targeted || [];
    }

    function board(title, subtitle) {
      view += 1;
      root.hidden = false; root.replaceChildren();
      const header = make('div', 'demo-game-header');
      const copy = make('div');
      copy.append(make('p', 'demo-game-eyebrow', 'TURN A MISTAKE INTO A MISSION'));
      const heading = make('h4', 'demo-game-title', title);
      heading.tabIndex = -1;
      copy.append(heading, make('p', 'demo-game-subtitle', subtitle));
      const counter = make('div', 'demo-game-stars', `★ ${stars.size}`);
      counter.dataset.role = 'stars'; counter.setAttribute('aria-label', `${stars.size} recovery stars earned this session`);
      header.append(copy, counter); root.append(header);
      root.append(make('p', 'demo-game-notice', 'Sample recovery activities · teacher review pending.'));
      return heading;
    }

    function followUpPlan() {
      if (!window.IgniteAssessment || !content) return null;
      const skillIds = new Set(diagnoses().filter((item) => item.mission).map((item) => item.diagnosis.skill.id));
      const bank = (window.__IGNITE_ASSESSMENT_BANKS__?.banks || []).find((candidate) =>
        !window.IgniteAssessment.bankIssue(candidate) && candidate.items.some((item) => skillIds.has(item.skillId)));
      if (!bank) return null;
      return window.IgniteAssessment.planFollowUpTest(content, answers, bank, {
        maxQuestions: 3, seenItemIds: [...seen],
        allowUnreviewedDemo: window.__IGNITE_ASSESSMENT_BANKS__?.includesSamples === true,
      });
    }

    function offerFollowUp() {
      const plan = followUpPlan();
      if (!plan || !['ready', 'partial'].includes(plan.status) || !plan.questions.length) {
        root.append(make('p', 'demo-game-coverage', plan?.status === 'insufficient'
          ? 'You have seen the available follow-up questions. New reviewed questions are needed for another check.'
          : 'A separate follow-up check is not available for these mistakes. You can review the explanations or finish here.'));
        return;
      }
      root.append(action(`Try a ${plan.questions.length}-question follow-up`, 'start-follow-up', () => {
        current = { phase: 'assessment', plan, index: 0, responses: {} };
        renderFollowUp();
      }));
    }

    function renderHub(focusHeading = true) {
      recallView?.cancel(); recallView = null;
      current = null;
      settings.onStageChange?.('results');
      if (!window.IgniteActivityView || !window.IgniteLearningReview) {
        const heading = board('Interactive recovery is unavailable', 'Your original result is preserved. Use the answer explanations below, or finish for now.');
        if (focusHeading) heading.focus();
        return;
      }
      const available = diagnoses().filter((item) => item.mission);
      const recalls = window.IgniteLearningPath?.analyse(content, answers).recall || [];
      const unknown = recalls.length;
      if (!available.length && !recalls.length) { root.hidden = true; root.replaceChildren(); return; }
      const heading = board(available.length ? 'Your recovery mission is ready' : 'Review your answers', available.length
        ? 'Use a learning clue, try a short challenge, then check the idea.'
        : 'Read an explanation, hide it, and recall the same question. No targeted diagnosis is available for these answers.');
      const cards = make('div', 'demo-game-cards');
      for (const item of available) {
        const card = make('article', 'demo-game-card');
        card.append(make('p', 'demo-game-kicker', `QUESTION ${item.question.no} · ${completed.has(item.question.id) ? 'MISSION COMPLETED' : '2 SHORT CHALLENGES'}`),
          make('h5', '', item.mission.title), make('p', '', item.mission.goal));
        const route = make('div', 'demo-game-route');
        route.setAttribute('aria-hidden', 'true');
        ['1 · Fix the idea', '→', '2 · Try again', '→', '★'].forEach((label) => route.append(make('span', '', label)));
        card.append(route, action(completed.has(item.question.id) ? 'Replay rescue' : 'Start rescue', 'start-rescue', () => {
          current = { phase: 'mission', item, index: 0, responses: [], hintUsed: false };
          renderMission();
        }));
        cards.append(card);
      }
      root.append(cards);
      if (unknown) root.append(make('p', 'demo-game-coverage', `${unknown} ${available.length ? 'other ' : ''}mistake${unknown === 1 ? ' has' : 's have'} a review-and-recall option. Targeted games for those concepts are still being prepared.`));
      const additional = make('details', 'learning-more-reviews');
      additional.append(make('summary', '', `More answers to review (${Math.max(0, recalls.length - 1)})`));
      for (const [index, route] of recalls.entries()) {
        const card = make('article', 'demo-game-card learning-recall-card');
        card.append(make('p', 'demo-game-kicker', `Question ${route.question.no} · Review & recall`),
          make('h5', '', route.question.text), make('p', '', 'Read the explanation, then try the same question with the answer hidden. This is not a fresh test.'));
        card.append(action('Review & recall', 'start-review', () => {
          const session = { phase: 'recall' }; current = session; view += 1;
          settings.onStageChange?.('recall');
          recallView = window.IgniteLearningReview.mount(root, route, {
            isActive: () => current === session,
            notice: content.notice,
            onReturn: renderHub,
          });
        }));
        if (index === 0) root.append(card); else additional.append(card);
      }
      if (recalls.length > 1) root.append(additional);
      root.append(make('p', 'demo-game-footnote', 'Stars belong to this session. Your sample score stays unchanged.'));
      if (focusHeading) heading.focus();
    }

    function activity(activity, session, onGraded) {
      const field = make('fieldset', 'demo-game-question');
      const prompt = make('legend', '', activity.prompt); prompt.tabIndex = -1;
      const choices = make('div', 'demo-game-options');
      const feedback = make('p', 'demo-game-feedback');
      feedback.setAttribute('role', 'status'); feedback.hidden = true;
      const token = generation, screen = view;
      const deferred = session.phase === 'assessment';
      window.IgniteActivityView.mount(choices, activity, {
        optionClass: 'demo-game-option', actionClass: 'demo-game-button', orderClass: 'demo-game-order',
        correctClass: 'correct', incorrectClass: 'incorrect', deferFeedback: deferred,
        isActive: () => current === session && token === generation && screen === view,
        onAnswer(result, response) {
          if (!deferred) {
            const key = session.item.question.id + ':' + session.index;
            if (result.correct) stars.add(key);
            const counter = root.querySelector('[data-role="stars"]');
            if (counter) { counter.textContent = '\u2605 ' + stars.size; counter.setAttribute('aria-label', stars.size + ' recovery stars earned this session'); }
          }
          feedback.textContent = deferred ? 'Answer recorded. Feedback will appear after the whole check.'
            : (result.correct ? 'Challenge cleared! ' : 'Let us review this idea. ') + activity.explanation;
          if (!deferred && !result.correct && activity.type === 'ordered_steps') feedback.textContent += ' Correct route: ' + activity.steps.join(' → ') + '.';
          if (!deferred && !result.correct && activity.type === 'single_choice') feedback.textContent += ' Answer: ' + activity.options[activity.answerIndex] + '.';
          feedback.hidden = false;
          onGraded(result, response);
        },
      });
      field.append(prompt, choices); root.append(field, feedback);
      return prompt;
    }

    function renderMission() {
      const session = current;
      if (!session || session.phase !== 'mission') return;
      settings.onStageChange?.('recovery');
      const { mission } = session.item;
      board(mission.title, session.index === 0 ? session.item.diagnosis.feedback : 'Use the idea in a fresh situation.');
      const path = make('ol', 'demo-game-stages');
      ['Fix the idea', 'Try again'].forEach((label, index) => {
        const stage = make('li', index === session.index ? 'active' : '', `${index < session.index ? '✓' : index + 1} · ${label}`);
        if (index === session.index) stage.setAttribute('aria-current', 'step');
        path.append(stage);
      }); root.append(path);
      const progress = make('progress'); progress.max = 2; progress.value = session.index;
      progress.setAttribute('aria-label', 'Recovery challenges completed'); root.append(progress);
      const next = action(session.index === 0 ? 'Unlock the next challenge' : 'Collect my result', 'next-mission', () => {
        if (current !== session || session.responses[session.index] === undefined) return;
        session.index += 1;
        if (session.index === 2) finishMission(session); else renderMission();
      }); next.disabled = true;
      const prompt = activity(session.index === 0 ? mission.challenge : mission.retry, session, (result) => {
        session.responses[session.index] = result.correct; progress.value = session.index + 1; next.disabled = false;
      });
      const hint = make('p', 'demo-game-hint', mission.hint); hint.hidden = true;
      const hintButton = action('Need a hint?', 'hint', () => {
        if (current !== session) return;
        session.hintUsed = true; hint.hidden = false; hintButton.hidden = true;
      }); hintButton.className = 'demo-game-link';
      root.append(hintButton, hint);
      const actions = make('div', 'demo-game-actions');
      const back = action('Back to missions', 'back-to-missions', renderHub); back.className = 'demo-game-link';
      actions.append(back, next); root.append(actions);
      prompt.focus();
    }

    function finishMission(session) {
      if (current !== session) return;
      settings.onStageChange?.('results');
      completed.add(session.item.question.id);
      current = null;
      const passed = session.responses[1] === true;
      const heading = board(passed ? 'Recovery mission complete!' : 'Mission finished. Keep practising.',
        passed ? 'You used the concept correctly on the retry.' : 'Review the explanation and give this concept another try.');
      root.append(make('div', 'demo-game-celebration', passed ? '★  MISSION COMPLETE  ★' : '✓  PRACTICE COMPLETED'),
        make('p', 'demo-game-footnote', 'Your original sample score is preserved. This result covers this practice session only.'));
      offerFollowUp(); root.append(action('Back to missions', 'back-to-missions', renderHub));
      heading.focus();
    }

    function renderFollowUp() {
      const session = current;
      if (!session || session.phase !== 'assessment') return;
      settings.onStageChange?.('assessment');
      const question = session.plan.questions[session.index];
      if (!question) {
        const result = window.IgniteAssessment.gradeFollowUpTest(session.plan, session.responses);
        current = null;
        settings.onStageChange?.('results');
        const heading = board('Your follow-up result', `${result.correct}/${result.total} correct against the sample answer key.`);
        root.append(make('p', 'demo-game-coverage', `${session.plan.unresolved.length ? `${session.plan.unresolved.length} original mistakes still need separate review. ` : ''}${result.correct === result.total ? 'You passed this short check. Revisit the idea later.' : 'Review the explanations for the questions you missed.'}`));
        for (const item of session.plan.questions) {
          if (session.responses[item.id] === item.answerIndex) continue;
          const review = make('div', 'demo-game-card');
          review.append(make('strong', '', item.prompt), make('p', '', item.explanation)); root.append(review);
        }
        root.append(action('Back to missions', 'back-to-missions', renderHub)); heading.focus(); return;
      }
      board('Fresh challenge', `Follow-up ${session.index + 1} of ${session.plan.questions.length}`);
      seen.add(question.id);
      const progress = make('progress'); progress.max = session.plan.questions.length; progress.value = session.index;
      progress.setAttribute('aria-label', 'Follow-up questions completed'); root.append(progress);
      const next = action(session.index + 1 === session.plan.questions.length ? 'See my result' : 'Next challenge', 'next-follow-up', () => {
        if (current !== session || !Object.hasOwn(session.responses, question.id)) return;
        session.index += 1; renderFollowUp();
      }); next.disabled = true;
      const prompt = activity(question, session, (_result, response) => {
        session.responses[question.id] = response; progress.value = session.index + 1; next.disabled = false;
      });
      root.append(next); prompt.focus();
    }

    function reset() {
      recallView?.cancel(); recallView = null;
      generation += 1; content = null; answers = {}; current = null;
      stars.clear(); seen.clear(); completed.clear(); root.hidden = true; root.replaceChildren();
      settings.onStageChange?.('results');
    }

    return Object.freeze({ reset, show(nextContent, nextAnswers) {
      reset(); content = nextContent; answers = { ...nextAnswers }; renderHub(false);
    } });
  }
  window.IgniteDemoRecovery = Object.freeze({ create });
}());
