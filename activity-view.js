'use strict';

// Shared interaction component. Page adapters own feedback, stages and persistence.
(function exposeActivityView() {
  function mount(root, activity, settings = {}) {
    const engine = window.IgniteAdaptive;
    root.replaceChildren();
    let locked = false;
    const active = () => !locked && settings.isActive?.() !== false;
    const make = (tag, className, text) => Object.assign(document.createElement(tag), { className, textContent: text || '' });
    const button = (text, action, handler, className = settings.optionClass || 'rescue-option') => {
      const element = make('button', className, text);
      element.type = 'button'; element.dataset.action = action;
      element.addEventListener('click', () => { if (active()) handler(); });
      return element;
    };
    const submit = (response) => {
      if (!active()) return false;
      const result = engine.gradeActivity(activity, response);
      if (!result.valid) return false;
      locked = true;
      settings.onAnswer?.(result, response);
      return true;
    };
    if (!engine || engine.activityIssue(activity, 'Activity')) {
      root.append(make('p', '', 'This activity is unavailable. Return to the worksheet explanation.'));
      return { cancel() { locked = true; } };
    }
    if (activity.type === 'ordered_steps') {
      const selected = [];
      const order = make('p', settings.orderClass || 'rescue-order', 'Choose the steps in the order they happen.');
      order.setAttribute('role', 'status');
      const tiles = engine.shuffledSteps(activity).map((index) => {
        const tile = button(activity.steps[index], 'order-step', () => {
          if (selected.includes(index)) return;
          selected.push(index); tile.disabled = true;
          order.textContent = selected.map((value, position) => `${position + 1}. ${activity.steps[value]}`).join(' → ');
          check.disabled = selected.length !== activity.steps.length;
        });
        return tile;
      });
      const reset = button('Reset order', 'reset-order', () => {
        selected.length = 0; tiles.forEach((tile) => { tile.disabled = false; });
        order.textContent = 'Choose the steps in the order they happen.'; check.disabled = true;
      }, settings.actionClass || 'text-button');
      const check = button('Check my order', 'check-order', () => {
        if (submit([...selected])) { tiles.forEach((tile) => { tile.disabled = true; }); reset.disabled = true; check.disabled = true; }
      }, settings.actionClass || 'secondary-button');
      check.disabled = true;
      root.append(order, ...tiles, reset, check);
    } else {
      const buttons = activity.options.map((option, index) => {
        const choice = button(settings.letters ? `${'ABCD'[index]}. ${option}` : option, 'choose-answer', () => {
          if (!submit(index)) return;
          buttons.forEach((other, optionIndex) => {
            other.disabled = true;
            other.setAttribute('aria-pressed', String(optionIndex === index));
            // Test mode can defer correctness and explanations until completion.
            if (settings.deferFeedback) return;
            if (optionIndex === activity.answerIndex) other.classList.add(settings.correctClass || 'is-correct');
            else if (optionIndex === index) other.classList.add(settings.incorrectClass || 'is-wrong');
          });
        });
        choice.setAttribute('aria-pressed', 'false');
        return choice;
      });
      root.append(...buttons);
    }
    return { cancel() { locked = true; } };
  }
  window.IgniteActivityView = Object.freeze({ mount });
}());
