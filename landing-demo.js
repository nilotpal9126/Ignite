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

    function selected() {
      return items.find((item) => item.classLevel === Number(get('demoClass').value)
        && item.subject === get('demoSubject').value);
    }

    function resetSelection() {
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
      get('demoStep').textContent = `Question ${step + 1} of ${active.questions.length}`;
      get('demoQuestionText').textContent = question.text;
      get('demoFeedback').textContent = '';
      get('demoNext').disabled = true;
      get('demoNext').textContent = step + 1 === active.questions.length ? 'See my practice snapshot' : 'Next question';
      const buttons = question.options.map((option, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'demo-option';
        button.textContent = option;
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => {
          if (Object.hasOwn(answers, question.id)) return;
          answers[question.id] = index;
          buttons.forEach((choice, choiceIndex) => {
            choice.disabled = true;
            choice.setAttribute('aria-pressed', String(choiceIndex === index));
            if (choiceIndex === question.answerIndex) choice.classList.add('correct');
            else if (choiceIndex === index) choice.classList.add('incorrect');
          });
          const correct = index === question.answerIndex;
          get('demoFeedback').textContent = `${correct ? 'Correct against the sample key.' : `The sample key gives: ${question.options[question.answerIndex]}.`} ${question.explanation}`;
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
      get('demoRecommendation').textContent = tally.mistakes.length
        ? `Next step: revisit the explanations for these ${tally.mistakes.length} questions before trying again.`
        : 'You answered every question correctly against this sample key. You can stop here or explore another subject; this does not establish mastery.';
      const review = active.questions.filter((question) => tally.mistakes.includes(question.id)).map((question) => {
        const li = document.createElement('li');
        const text = document.createElement('strong');
        text.textContent = question.text;
        const explanation = document.createElement('p');
        explanation.textContent = `Sample answer: ${question.options[question.answerIndex]}. ${question.explanation}`;
        li.append(text, explanation);
        return li;
      });
      get('demoMistakes').replaceChildren(...review);
      get('demoResultTitle').focus();
    }

    get('demoClass').addEventListener('change', resetSelection);
    get('demoSubject').addEventListener('change', resetSelection);
    get('demoStart').addEventListener('click', start);
    get('demoRestart').addEventListener('click', start);
    get('demoNext').addEventListener('click', () => {
      if (!active || step >= active.questions.length || !Object.hasOwn(answers, active.questions[step].id)) return;
      step += 1;
      if (step === active.questions.length) finish();
      else showQuestion();
    });
    resetSelection();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDemo);
  else initDemo();
}());
