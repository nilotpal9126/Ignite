'use strict';

// Shared fallback: explain, hide the answer, then recall the SAME question.
(function exposeLearningReview() {
  function mount(root, route, settings = {}) {
    let cancelled = false, view = 0;
    const make = (tag, className, text) => {
      const element = Object.assign(document.createElement(tag), { className, textContent: text || '' });
      window.IgniteScienceText?.render(element, text || '', { chemistry: settings.subject === 'Chemistry' });
      return element;
    };
    const active = () => !cancelled && settings.isActive?.() !== false;
    const action = (text, name, handler) => {
      const button = make('button', 'learning-button', text);
      const token = view;
      button.type = 'button'; button.dataset.action = name;
      button.addEventListener('click', () => { if (active() && token === view) handler(); });
      return button;
    };
    const screen = (title, step) => {
      view += 1; root.hidden = false; root.replaceChildren();
      root.append(make('p', 'learning-kicker', `Review & recall · ${step}`));
      const heading = make('h3', '', title); heading.tabIndex = -1;
      root.append(heading, make('p', 'learning-note', route.reason));
      root.append(make('p', 'learning-note', settings.notice || 'This repeats the original question. It is not a new test and does not establish mastery.'));
      return heading;
    };
    const back = () => settings.onReturn?.();
    function recall() {
      const heading = screen('Can you recall the idea?', '2 of 2');
      const field = make('fieldset', 'learning-question');
      field.append(make('legend', '', route.activity.prompt));
      const options = make('div', 'rescue-options'); field.append(options); root.append(field);
      window.IgniteActivityView.mount(options, route.activity, {
        subject: settings.subject,
        isActive: () => active() && root.hidden !== true,
        onAnswer(result) {
          const feedback = make('p', 'learning-feedback', `${result.correct ? 'Recalled correctly.' : `Answer: ${route.activity.options[route.activity.answerIndex]}.`} ${route.activity.explanation}`);
          feedback.setAttribute('role', 'status'); root.append(feedback);
          root.append(make('p', 'learning-note', 'Your original score is unchanged. A later, different question is needed to check transfer.'));
          root.append(action('Finish review', 'finish-review', () => { view += 1; settings.onFinish?.({ questionId: route.question.id, correct: result.correct, kind: 'recall' }); back(); }));
        },
      });
      root.append(action('Return to results', 'cancel-review', back)); heading.focus();
    }
    if (route?.kind !== 'recall' || !window.IgniteActivityView) {
      root.replaceChildren(make('p', '', 'Review is unavailable. Please use the worksheet explanation.'));
      return { cancel() { cancelled = true; } };
    }
    const heading = screen('Understand the answer first', '1 of 2');
    root.append(make('p', 'learning-source-question', route.question.text));
    root.append(make('p', 'learning-feedback', `Answer: ${route.question.options[route.question.answerIndex]}. ${route.question.explanation}`));
    root.append(action('Hide the explanation & try recall', 'start-recall', recall), action('Return to results', 'cancel-review', back));
    heading.focus();
    return { cancel() { cancelled = true; view += 1; } };
  }
  window.IgniteLearningReview = Object.freeze({ mount });
}());
