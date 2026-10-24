'use strict';

// Shared, allowlisted diagrams for the landing demo and Ignite Play visual challenges.
// The source worksheet bank is never mutated and content cannot supply SVG markup or URLs.
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
  function coordinatePoint(x, y) {
    const px = 110 + x * 12, py = 75 - y * 12;
    const grid = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5].map((value) =>
      `${line(110 + value * 12,15,110 + value * 12,135)}${line(50,75 - value * 12,170,75 - value * 12)}`).join('');
    return `<g class="diagram-grid">${grid}</g><g class="diagram-axis">${line(45,75,178,75)}${line(110,140,110,10)}</g>
      <circle class="diagram-point" cx="${px}" cy="${py}" r="6"/><text x="${px + 9}" y="${py - 8}">(${x}, ${y})</text>`;
  }
  function linePair(kind) {
    const paths = {
      perpendicular: ['M50 120L170 30', 'M75 25L150 125'],
      intersecting: ['M45 118L175 43', 'M45 55L175 103'],
      coincident: ['M45 118L175 43', 'M45 118L175 43'],
      parallel: ['M45 112L175 42', 'M45 132L175 62'],
    }[kind];
    return `<g class="diagram-grid">${line(50,25,50,130)}${line(85,25,85,130)}${line(120,25,120,130)}${line(155,25,155,130)}
      ${line(35,45,185,45)}${line(35,80,185,80)}${line(35,115,185,115)}</g>
      <path class="diagram-curve" d="${paths[0]}"/><path class="diagram-secondary" d="${paths[1]}"/>`;
  }
  function circuit(kind) {
    const wire = (d) => `<path class="diagram-wire" d="${d}"/>`;
    const meter = (x, y) => `<circle class="diagram-device" cx="${x}" cy="${y}" r="15"/><text x="${x}" y="${y + 5}" text-anchor="middle">A</text>`;
    const bulb = '<circle class="diagram-device" cx="145" cy="45" r="15"/><path d="M136 36l18 18M154 36l-18 18"/>';
    const battery = `${line(95,119,95,137)}${line(104,114,104,142)}<text x="86" y="145">battery</text>`;
    const frame = `${wire('M35 45H130M160 45H185V125H104M95 125H35V45')}${bulb}${battery}`;
    if (kind === 'series') return `${meter(80,45)}${wire('M35 45H65M95 45H130')}${frame.replace('M35 45H130','M95 45H130')}`;
    if (kind === 'parallel') return `${frame}${wire('M35 80H65M95 80H185')}${meter(80,80)}`;
    if (kind === 'bulb') return `${frame}${wire('M120 45V86H130M160 86H170V45')}${meter(145,86)}`;
    return `${frame}${wire('M78 125V92H107M137 92H150V125')}${meter(122,92)}`;
  }
  function solenoidField(kind) {
    const coil = Array.from({ length: 7 }, (_, i) => `<ellipse cx="${62 + i * 16}" cy="75" rx="11" ry="45"/>`).join('');
    const patterns = {
      circles: '<circle cx="110" cy="75" r="12"/><circle cx="110" cy="75" r="25"/><circle cx="110" cy="75" r="38"/>',
      crossing: `${line(62,42,158,108)}${line(62,108,158,42)}`,
      parallel: `${line(62,58,158,58)}${line(62,75,158,75)}${line(62,92,158,92)}`,
      none: '<text x="110" y="81" text-anchor="middle">no field</text>',
    }[kind];
    return `<g class="diagram-coil">${coil}</g><g class="diagram-field">${patterns}</g>`;
  }
  function reaction(kind) {
    const atom = (x, y, label) => `<circle class="diagram-particle" cx="${x}" cy="${y}" r="17"/><text x="${x}" y="${y + 5}" text-anchor="middle">${label}</text>`;
    const arrow = '<path class="diagram-arrow" d="M92 75h38m-8-8 8 8-8 8"/>';
    if (kind === 'combination') return `${atom(34,75,'A')}${atom(73,75,'B')}${arrow}${atom(151,75,'A')}${atom(181,75,'B')}${line(168,75,164,75)}`;
    if (kind === 'decomposition') return `${atom(39,75,'A')}${atom(69,75,'B')}${line(56,75,52,75)}${arrow}${atom(151,75,'A')}${atom(190,75,'B')}`;
    if (kind === 'displacement') return `${atom(25,75,'A')}${atom(60,75,'B')}${atom(86,75,'C')}${arrow}${atom(151,75,'A')}${atom(177,75,'C')}${atom(207,75,'B')}`;
    if (kind === 'neutralisation') return `${atom(35,75,'H+')}${atom(76,75,'OH−')}${arrow}<text class="diagram-product" x="171" y="82" text-anchor="middle">H₂O</text>`;
    return `${atom(40,75,'AB')}${arrow}${atom(165,75,'AB')}<text x="110" y="35" text-anchor="middle">energy in</text>`;
  }
  function heart(chamber) {
    const cells = [['RA',65,38],['LA',125,38],['RV',65,82],['LV',125,82]];
    return `<path class="diagram-heart" d="M110 132C35 95 35 43 67 30c20-8 35 4 43 19 8-15 23-27 43-19 32 13 32 65-43 102Z"/>
      ${cells.map(([name,x,y]) => `<rect class="${name === chamber ? 'diagram-highlight' : 'diagram-chamber'}" x="${x}" y="${y}" width="45" height="38" rx="8"/><text x="${x + 22.5}" y="${y + 24}" text-anchor="middle">${name}</text>`).join('')}`;
  }
  function genotypeRatio(values) {
    const columns = [['TT',55],['Tt',110],['tt',165]];
    return `<g class="diagram-punnett">${columns.map(([label, x], index) => `<text x="${x}" y="38" text-anchor="middle">${label}</text>
      ${Array.from({ length: values[index] }, (_, dot) => `<circle class="diagram-counter" cx="${x}" cy="${62 + dot * 22}" r="7"/>`).join('')}`).join('')}</g>`;
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
    'coordinate-1': coordinatePoint(5,-2), 'coordinate-2': coordinatePoint(-5,-2),
    'coordinate-3': coordinatePoint(5,2), 'coordinate-4': coordinatePoint(-5,2),
    'line-pair-1': linePair('perpendicular'), 'line-pair-2': linePair('intersecting'),
    'line-pair-3': linePair('coincident'), 'line-pair-4': linePair('parallel'),
    'ammeter-1': circuit('parallel'), 'ammeter-2': circuit('bulb'),
    'ammeter-3': circuit('battery'), 'ammeter-4': circuit('series'),
    'solenoid-1': solenoidField('circles'), 'solenoid-2': solenoidField('crossing'),
    'solenoid-3': solenoidField('parallel'), 'solenoid-4': solenoidField('none'),
    'combine-1': reaction('decomposition'), 'combine-2': reaction('endothermic'),
    'combine-3': reaction('combination'), 'combine-4': reaction('displacement'),
    'decompose-1': reaction('neutralisation'), 'decompose-2': reaction('displacement'),
    'decompose-3': reaction('combination'), 'decompose-4': reaction('decomposition'),
    'heart-1': heart('LA'), 'heart-2': heart('LV'), 'heart-3': heart('RV'), 'heart-4': heart('RA'),
    'punnett-1': genotypeRatio([1,1,1]), 'punnett-2': genotypeRatio([3,1,1]),
    'punnett-3': genotypeRatio([1,2,1]), 'punnett-4': genotypeRatio([2,1,2]),
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
    // Published trail questions keep their reviewed wording, choices, answer and explanation.
    // Only the allowlisted visual choices are layered on at runtime.
    'QB-49fe6f500fc9': { diagramOptions: ['coordinate-1', 'coordinate-2', 'coordinate-3', 'coordinate-4'] },
    'QB-4c2fc7824564': { diagramOptions: ['line-pair-1', 'line-pair-2', 'line-pair-3', 'line-pair-4'] },
    'QB-fb259fdbb95c': { diagramOptions: ['ammeter-1', 'ammeter-2', 'ammeter-3', 'ammeter-4'] },
    'QB-a9d9e278f4cb': { diagramOptions: ['solenoid-1', 'solenoid-2', 'solenoid-3', 'solenoid-4'] },
    'QB-f59e89cc8343': { diagramOptions: ['combine-1', 'combine-2', 'combine-3', 'combine-4'] },
    'QB-3e1bc48655bb': { diagramOptions: ['decompose-1', 'decompose-2', 'decompose-3', 'decompose-4'] },
    'QB-615824cd8572': { diagramOptions: ['heart-1', 'heart-2', 'heart-3', 'heart-4'] },
    'QB-e2776c4549e0': { diagramOptions: ['punnett-1', 'punnett-2', 'punnett-3', 'punnett-4'] },
  };
  Object.values(questions).forEach((question) => {
    if (question.options) Object.freeze(question.options);
    Object.freeze(question.diagramOptions); Object.freeze(question);
  });
  Object.freeze(questions);
  function adapt(item) {
    if (!item.questions.some((question) => Object.hasOwn(questions, question.id))) return item;
    return { ...item, questions: item.questions.map((question) => {
      const visual = questions[question.id];
      return visual ? { ...question, ...visual } : question;
    }) };
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
