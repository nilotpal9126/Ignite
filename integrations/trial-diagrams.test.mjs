import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = vm.createContext({ window: {}, document: {
  createElementNS(namespace, name) {
    return { namespace, name, attrs: {}, classes: [], setAttribute(key, value) { this.attrs[key] = value; },
      classList: { add() {} }, innerHTML: '' };
  },
} });
for (const file of ['practice.js', 'data/pilot-worksheets.js', 'trial-diagrams.js']) {
  vm.runInContext(readFileSync(path.join(root, file), 'utf8'), context, { timeout: 1000 });
}
const { IgniteTrialDiagrams: diagrams, IgnitePractice: practice, __IGNITE_PILOT_CONTENT__: content } = context.window;

test('shared diagrams stay playable without changing source worksheets or recovery question IDs', () => {
  const before = JSON.stringify(content);
  const adapted = content.items.map(diagrams.adapt);
  const questions = adapted.flatMap(item => item.questions.filter(question => question.diagramOptions));
  assert.equal(questions.length, 12);
  for (const item of adapted) assert.ok(practice.playable(item), item.id);
  assert.equal(JSON.stringify(content), before);
  assert.equal(adapted[0].questions[0].id, content.items[0].questions[0].id);
  for (const question of questions) {
    assert.equal(question.diagramOptions.length, 4);
    assert.equal(new Set(question.diagramOptions).size, 4);
    assert.equal(practice.score([question], { [question.id]: question.answerIndex }).correct, 1);
    assert.equal(practice.score([question], { [question.id]: (question.answerIndex + 1) % 4 }).correct, 0);
    for (const id of question.diagramOptions) {
      const svg = diagrams.render(id);
      assert.equal(svg.namespace, 'http://www.w3.org/2000/svg');
      assert.equal(svg.attrs['aria-hidden'], 'true', 'visible text caption supplies the accessible description');
      assert.equal(svg.attrs.viewBox, '0 0 220 150');
      assert.doesNotMatch(svg.innerHTML, /<script|<foreignObject|\bon\w+=|https?:|href=/i);
    }
  }
});

test('Ignite Play receives two visual challenges in each core subject', () => {
  const adapted = content.items.map(diagrams.adapt);
  const counts = new Map();
  for (const item of adapted.filter(item => item.board === 'CBSE' && !item.trial)) {
    const challengeCount = item.questions.filter(question => question.diagramOptions).length;
    if (challengeCount) counts.set(item.subject, (counts.get(item.subject) || 0) + challengeCount);
  }
  assert.deepEqual(Object.fromEntries(counts), {
    Mathematics: 2, Chemistry: 2, Biology: 2, Physics: 2,
  });
  const play = readFileSync(path.join(root, 'play.html'), 'utf8');
  const game = readFileSync(path.join(root, 'game.js'), 'utf8');
  const css = readFileSync(path.join(root, 'game.css'), 'utf8');
  assert.match(play, /trial-diagrams\.js[^]*game\/core\.js[^]*game\.js/);
  assert.match(game, /IgniteTrialDiagrams\?\.adapt/);
  assert.match(game, /IgniteTrialDiagrams\?\.render/);
  assert.match(css, /\.play-options\.has-diagrams/);
});

test('diagram renderer rejects prototype keys, arbitrary URLs, paths and markup', () => {
  for (const id of [null, undefined, {}, '__proto__', 'constructor', '../secret.svg', 'https://example.com/x.svg', '<script>alert(1)</script>']) {
    assert.equal(diagrams.render(id), null);
  }
});
