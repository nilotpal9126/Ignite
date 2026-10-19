'use strict';

// Public demonstration: no identity dependency, network calls or stored results.
(function publicPracticeDemo() {
  function initDemo() {
    const get = (id) => document.getElementById(id);
    const practice = window.IgnitePractice;
    const items = (window.__IGNITE_PILOT_CONTENT__?.items || []).filter((item) =>
      item.visibility === 'demo_sample' && practice?.playable(item)
      && [10, 11].includes(item.classLevel)
      && ['Biology', 'Chemistry', 'Physics'].includes(item.subject));
    let active = null;
    let step = 0;
    let answers = Object.create(null);
    let generation = 0;
    const write = (element, text) => {
      if (window.IgniteScienceText) window.IgniteScienceText.render(element, text, { chemistry: active?.subject === 'Chemistry' });
      else element.textContent = text;
    };
    const recoveryRoot = get('demoRecoveryHub');
    const recovery = recoveryRoot && window.IgniteDemoRecovery?.create(recoveryRoot, {
      onStageChange(stage) {
        // The answer key must not remain visible below a recall/check activity.
        const practising = ['recall', 'recovery', 'assessment'].includes(stage);
        get('demoMistakes').hidden = practising;
        get('demoRecommendation').hidden = practising;
      },
    });

    function selected() {
      return items.find((item) => item.classLevel === Number(get('demoClass').value)
        && item.subject === get('demoSubject').value);
    }

    function resetSelection() {
      generation += 1;
      recovery?.reset();
      get('demoPreviewNotice').hidden = true;
      active = null;
      step = 0;
      answers = Object.create(null);
      get('demoSession').hidden = true;
      get('demoResult').hidden = true;
      const item = selected();
      get('demoStart').disabled = !item;
      get('demoStart').textContent = 'Start free sample';
      get('demoNotice').textContent = item?.notice || 'No playable sample is available for this selection.';
      get('demoStatus').textContent = item
        ? `${item.title} · ${item.questions.length} questions. Ready when you are.`
        : 'Sample practice is unavailable. Please try another selection or reload later.';
    }

    function showQuestion() {
      const question = active.questions[step];
      const sessionContent = active, questionStep = step, token = generation;
      get('demoStep').textContent = `Question ${step + 1} of ${active.questions.length}`;
      write(get('demoQuestionText'), question.text);
      get('demoFeedback').textContent = '';
      delete get('demoFeedback').dataset.correct;
      get('demoNext').disabled = true;
      get('demoNext').textContent = step + 1 === active.questions.length ? 'See my practice snapshot' : 'Next question';
      const buttons = question.options.map((option, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'demo-option';
        const label = document.createElement('span'); label.className = 'demo-choice-letter'; label.textContent = 'ABCD'[index];
        const value = document.createElement('span'); value.className = 'demo-choice-value'; write(value, option);
        button.append(label, value);
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => {
          if (generation !== token || active !== sessionContent || step !== questionStep || Object.hasOwn(answers, question.id)) return;
          answers[question.id] = index;
          buttons.forEach((choice, choiceIndex) => {
            choice.disabled = true;
            choice.setAttribute('aria-pressed', String(choiceIndex === index));
            if (choiceIndex === question.answerIndex) choice.classList.add('correct');
            else if (choiceIndex === index) choice.classList.add('incorrect');
          });
          const correct = index === question.answerIndex;
          get('demoFeedback').dataset.correct = String(correct);
          write(get('demoFeedback'), `${correct ? 'Correct against the sample key.' : `The sample key gives: ${question.options[question.answerIndex]}.`} ${question.explanation}`);
          get('demoProgress').value = Object.keys(answers).length;
          get('demoProgress').setAttribute('aria-valuetext', `${Object.keys(answers).length} of ${active.questions.length} questions answered`);
          get('demoNext').disabled = false;
        });
        return button;
      });
      get('demoOptions').replaceChildren(...buttons);
      get('demoQuestionText').focus();
    }

    function start() {
      generation += 1;
      recovery?.reset();
      get('demoPreviewNotice').hidden = true;
      const item = selected();
      if (!item) { resetSelection(); return; }
      active = item;
      step = 0;
      answers = Object.create(null);
      get('demoResult').hidden = true;
      get('demoSession').hidden = false;
      get('demoSetTitle').textContent = item.title;
      get('demoStart').textContent = 'Restart selected sample';
      get('demoNotice').textContent = item.notice;
      get('demoStatus').textContent = 'Sample started. Choose one answer, read the explanation, then continue. Changing class or subject clears this demo.';
      get('demoProgress').max = item.questions.length;
      get('demoProgress').value = 0;
      get('demoProgress').setAttribute('aria-valuetext', `0 of ${item.questions.length} questions answered`);
      showQuestion();
    }

    function finish() {
      const tally = practice.score(active.questions, answers);
      get('demoNext').disabled = true;
      get('demoSession').hidden = true;
      get('demoResult').hidden = false;
      get('demoStatus').textContent = 'Sample finished. You can stop here or choose another set.';
      get('demoScore').textContent = `${tally.correct}/${tally.total} correct (${Math.round(tally.correct / tally.total * 100)}%) against the sample answer key.`;
      const route = window.IgniteLearningPath?.analyse(active, answers);
      get('demoRecommendation').textContent = tally.mistakes.length
        ? route?.targeted.length ? 'Next step: choose a short recovery challenge below. Other answers have a review-and-recall option.'
          : `Next step: review and recall these ${tally.mistakes.length} answers below. Targeted games and fresh checks are not available for these concepts yet.`
        : 'You answered every question correctly against this sample key. You can stop here or explore another subject; this does not establish mastery.';
      const review = active.questions.filter((question) => tally.mistakes.includes(question.id)).map((question) => {
        const li = document.createElement('li');
        const text = document.createElement('strong');
        write(text, question.text);
        const explanation = document.createElement('p');
        write(explanation, `Sample answer: ${question.options[question.answerIndex]}. ${question.explanation}`);
        li.append(text, explanation);
        return li;
      });
      get('demoMistakes').replaceChildren(...review);
      recovery?.show(active, answers);
      get('demoResultTitle').focus();
    }

    get('demoClass').addEventListener('change', () => { resetSelection(); syncSubjects(); });
    get('demoSubject').addEventListener('change', resetSelection);
    const subjectButtons = ['Biology', 'Chemistry', 'Physics'].map(subject => {
      const button = get(`choose${subject}`); if (button) button.dataset.subject = subject; return button;
    }).filter(Boolean);
    function syncSubjects() {
      for (const button of subjectButtons) {
        button.setAttribute('aria-pressed', String(button.dataset.subject === get('demoSubject').value));
        button.disabled = !items.some(item => item.subject === button.dataset.subject && item.classLevel === Number(get('demoClass').value));
      }
    }
    for (const button of subjectButtons) button.addEventListener('click', () => {
      if (!items.some(item => item.subject === button.dataset.subject && item.classLevel === Number(get('demoClass').value))) return;
      get('demoSubject').value = button.dataset.subject;
      resetSelection(); syncSubjects(); start();
      get('free-demo')?.scrollIntoView?.({ block: 'start' });
    });
    get('demoSubject').addEventListener('change', syncSubjects);
    get('demoStart').addEventListener('click', start);
    get('demoRestart').addEventListener('click', start);
    get('demoFinish').addEventListener('click', () => {
      resetSelection();
      get('demoStatus').textContent = 'Session finished. Your anonymous answers have been cleared. You can return when you want to practise again.';
      get('demoStart').focus();
    });
    get('demoNext').addEventListener('click', () => {
      if (!active || step >= active.questions.length || !Object.hasOwn(answers, active.questions[step].id)) return;
      step += 1;
      if (step === active.questions.length) finish();
      else showQuestion();
    });
    resetSelection();
    syncSubjects();
    if (window.location?.search && new URLSearchParams(window.location.search).get('preview') === 'recovery') {
      const example = items.find((item) => item.classLevel === 10 && item.subject === 'Biology');
      if (example) {
        get('demoClass').value = '10'; get('demoSubject').value = 'Biology';
        active = example; step = example.questions.length;
        const illustrativeMistakes = { 'IG-B10-S1-Q01': 0, 'IG-B10-S1-Q02': 0, 'IG-B10-S1-Q03': 3, 'IG-B10-S1-Q06': 0 };
        answers = Object.fromEntries(example.questions.map((question) => [question.id,
          Object.hasOwn(illustrativeMistakes, question.id) ? illustrativeMistakes[question.id] : question.answerIndex]));
        get('demoNotice').textContent = example.notice;
        finish();
        get('demoPreviewNotice').hidden = false;
        get('demoStatus').textContent = 'Example attempt loaded. Start the recovery mission below, or restart to answer the worksheet yourself.';
        recoveryRoot?.scrollIntoView?.({ block: 'start' });
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDemo);
  else initDemo();
}());
