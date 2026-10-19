'use strict';

// Presentation only: never rewrite stored questions, answer keys or attempt versions.
// Plain text becomes safe DOM nodes; input is never interpreted as HTML.
(function exposeScienceText() {
  const elements = new Set(('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn '
    + 'Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd '
    + 'Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr').split(' '));

  function tokens(value, settings = {}) {
    let text = String(value ?? '');
    text = text.replace(/(\d|\))\s+x\s+(?=[+\-]?\d)/g, '$1 × ').replace(/\s->\s/g, ' → ');
    if (settings.chemistry) {
      text = text.replace(/\bCnH\(2n\+2\)/g, 'C_{n}H_{2n+2}')
        .replace(/\b(d?sp)([23])\b/g, '$1^$2')
        .replace(/\[(H|OH|Na|K|Cl|NH4|HCO3)([+\-])\]/g, '[$1^{$2}]');
      text = text.replace(/\b\d*(?:[A-Z][a-z]?\d*)+\b/g, formula => {
        if (!/\d/.test(formula)) return formula;
        const parts = [...formula.matchAll(/([A-Z][a-z]?)(\d*)/g)];
        if (!parts.every(part => elements.has(part[1]))) return formula;
        return (formula.match(/^\d+/)?.[0] || '') + parts.map(([, element, count]) => element + (count ? `_{${count}}` : '')).join('');
      });
    }
    const result = [];
    const pattern = /([\^_])(?:\{([^{}\r\n]{1,40})\}|\(([+\-−]?\d+(?:[+\-])?)\)|([+\-−]?\d+(?:[+\-])?))/g;
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index > cursor) result.push({ type: 'text', text: text.slice(cursor, match.index) });
      result.push({ type: match[1] === '^' ? 'sup' : 'sub', text: (match[2] ?? match[3] ?? match[4]).replace(/-/g, '−') });
      cursor = match.index + match[0].length;
    }
    if (cursor < text.length) result.push({ type: 'text', text: text.slice(cursor) });
    return result;
  }

  function render(element, value, settings = {}) {
    if (!element) return;
    const parts = tokens(value, settings);
    if (parts.every(part => part.type === 'text')) {
      element.textContent = parts.map(part => part.text).join(''); return;
    }
    element.replaceChildren(...parts.map(part => {
      const node = document.createElement(part.type === 'text' ? 'span' : part.type);
      node.textContent = part.text;
      if (part.type !== 'text') node.className = 'science-script';
      return node;
    }));
  }
  const api = Object.freeze({ tokens, render });
  if (typeof window !== 'undefined') window.IgniteScienceText = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}());
