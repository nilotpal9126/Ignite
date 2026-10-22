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

test('four diagram questions stay playable without changing source worksheets or recovery question IDs', () => {
  const before = JSON.stringify(content);
  const adapted = content.items.map(diagrams.adapt);
  const questions = adapted.flatMap(item => item.questions.filter(question => question.diagramOptions));
  assert.equal(questions.length, 4);
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

test('diagram renderer rejects prototype keys, arbitrary URLs, paths and markup', () => {
  for (const id of [null, undefined, {}, '__proto__', 'constructor', '../secret.svg', 'https://example.com/x.svg', '<script>alert(1)</script>']) {
    assert.equal(diagrams.render(id), null);
  }
});
