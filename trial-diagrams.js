'use strict';

// Four teacher-review-pending trial questions. The full worksheet bank is not mutated.
// Only locally authored, allowlisted SVG is rendered; content cannot supply markup or URLs.
(function () {
  const line = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  function graph(kind) {
    const points = Array.from({ length: 41 }, (_, i) => {
      const x = (i - 20) / 10;
      const y = kind === 'line' ? x : (kind === 'down' ? -x * x : x * x + (kind === 'shift' ? 1 : 0));
      return `${110 + x * 30},${75 - y * 14}`;
    }).join(' ');
    return `<g class="diagram-axis">${line(26,75,194,75)}${line(110,140,110,6)}
      <path d="M188 71l6 4-6 4M106 12l4-6 4 6"/><text x="199" y="80">x</text><text x="119" y="14">y</text><text x="99" y="90">0</text>
      ${line(140,72,140,78)}<text x="137" y="91">1</text>${line(107,61,113,61)}<text x="95" y="64">1</text></g>
      <polyline class="diagram-curve" points="${points}"/>`;
  }
  function venn(kind) {
    const fill = kind === 'intersection'
      ? '<path d="M110 45.606 A42 42 0 0 1 110 104.394 A42 42 0 0 1 110 45.606"/>'
      : kind === 'union' ? '<circle cx="80" cy="75" r="42"/><circle cx="140" cy="75" r="42"/>'
        : kind === 'left' ? '<circle cx="80" cy="75" r="42"/><circle cx="140" cy="75" r="42" fill="white"/>'
          : '<circle cx="140" cy="75" r="42"/><circle cx="80" cy="75" r="42" fill="white"/>';
    return `<rect x="15" y="15" width="190" height="120" rx="6" fill="white" stroke="#bbc6d8"/>
      <g class="diagram-shade">${fill}</g><g class="diagram-outline"><circle cx="80" cy="75" r="42"/><circle cx="140" cy="75" r="42"/></g>
      <text x="60" y="28">A</text><text x="154" y="28">B</text>`;
  }
  function molecule(groups, doubleBond = false) {
    const gap = groups.length === 4 ? 53 : 66;
    const start = 110 - (groups.length - 1) * gap / 2;
    return groups.map((group, i) => {
      const x = start + i * gap;
      return `<text class="diagram-atom" x="${x}" y="82" text-anchor="middle">${group}</text>`
        + (i < groups.length - 1 ? line(x + 20, 76, x + gap - 20, 76)
          + (doubleBond && i === 0 ? line(x + 20, 70, x + gap - 20, 70) : '') : '');
    }).join('');
  }
  const pictures = Object.freeze({
    'plot-1': graph('up'), 'plot-2': graph('down'), 'plot-3': graph('shift'), 'plot-4': graph('line'),
    'sets-1': venn('union'), 'sets-2': venn('left'), 'sets-3': venn('intersection'), 'sets-4': venn('right'),
    'lens-1': '<path class="diagram-glass" d="M110 20 Q155 75 110 130 Q65 75 110 20Z"/>',
    'lens-2': '<path class="diagram-glass" d="M85 20 Q115 75 85 130 L135 130 Q105 75 135 20Z"/>',
    'lens-3': '<path class="diagram-glass" d="M95 20 Q155 75 95 130Z"/>',
    'lens-4': '<rect class="diagram-glass" x="90" y="20" width="40" height="110"/>',
    'chain-1': molecule(['CH₃', 'CH₃']), 'chain-2': molecule(['CH₂', 'CH', 'CH₃'], true),
    'chain-3': molecule(['CH₃', 'CH₂', 'CH₃']), 'chain-4': molecule(['CH₃', 'CH₂', 'CH₂', 'CH₃']),
  });
  const questions = {
    'IG-M10-S1-Q01': {
      id: 'TRIAL-M10-D01', no: 1,
      text: 'Which sketch represents y = x^2? All four sketches use the same axis scale.',
      options: ['Upward curve with its vertex at (0, 0)', 'Downward curve with its vertex at (0, 0)', 'Upward curve with its vertex at (0, 1)', 'Straight line through (0, 0) and (1, 1)'],
      diagramOptions: ['plot-1', 'plot-2', 'plot-3', 'plot-4'], answerIndex: 0,
      explanation: 'For y = x^2, the graph opens upward, is symmetric about the y-axis, and has its vertex at the origin. It also passes through (1, 1).',
    },
    'IG-M11-S1-Q01': {
      id: 'TRIAL-M11-D01', no: 1,
      text: 'Which Venn diagram shades exactly A ∩ B? The coloured region is the selected set.',
      options: ['Both circles, including their overlap, are shaded', 'Only the part of A outside B is shaded', 'Only the overlap of A and B is shaded', 'Only the part of B outside A is shaded'],
      diagramOptions: ['sets-1', 'sets-2', 'sets-3', 'sets-4'], answerIndex: 2,
      explanation: 'The intersection A ∩ B contains only elements belonging to both sets, so only the overlapping lens-shaped region is shaded.',
    },
    'IG-P10-S1-Q05': {
      id: 'TRIAL-P10-D01', no: 5,
      text: 'Which cross-section shows a lens used to correct myopia (short-sightedness)? Assume glass in air.',
      options: ['Curved on both sides, thicker at the centre', 'Curved on both sides, thinner at the centre', 'One flat side and one outward-curved side', 'Two flat parallel sides of uniform thickness'],
      diagramOptions: ['lens-1', 'lens-2', 'lens-3', 'lens-4'], answerIndex: 1,
      explanation: 'A concave (diverging) lens is thinner at the centre than at its edges. It diverges incident rays so a myopic eye can focus distant objects on the retina.',
    },
    'IG-C10-S1-Q04': {
      id: 'TRIAL-C10-D01', no: 4,
      text: 'Which displayed carbon-chain structure represents propane? Each line represents a bond.',
      options: ['CH3–CH3: two carbons with a single bond', 'CH2=CH–CH3: three carbons, including a double bond', 'CH3–CH2–CH3: three carbons with single bonds', 'CH3–CH2–CH2–CH3: four carbons with single bonds'],
      diagramOptions: ['chain-1', 'chain-2', 'chain-3', 'chain-4'], answerIndex: 2,
      explanation: 'Propane is a saturated three-carbon alkane, CH3–CH2–CH3 (C3H8). Its carbon-carbon bonds are all single bonds.',
    },
  };
  Object.values(questions).forEach((question) => {
    Object.freeze(question.options); Object.freeze(question.diagramOptions); Object.freeze(question);
  });
  Object.freeze(questions);
  function adapt(item) {
    if (!item.questions.some((question) => Object.hasOwn(questions, question.id))) return item;
    return { ...item, questions: item.questions.map((question) => questions[question.id] || question) };
  }
  function render(id) {
    if (typeof id !== 'string' || !Object.hasOwn(pictures, id)) return null;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 220 150');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('demo-option-diagram');
    svg.innerHTML = pictures[id]; // Trusted constants only. Never insert question text or user values here.
    return svg;
  }
  window.IgniteTrialDiagrams = Object.freeze({ adapt, render });
}());
