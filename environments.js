'use strict';

// Ambient presentation only. No question, attempt, identity or score data is read.
(function exposeEnvironments(root) {
  const SVG = 'http://www.w3.org/2000/svg';
  const LAYERS = ['macro', 'mid', 'micro'];
  const MODE = new Set(['browse', 'question', 'test', 'lab', 'focus']);
  const SCENE_KEY = 'ignite-surroundings-scene-v1';
  const STATIC_KEY = 'ignite-surroundings-static-v1';
  const normalizeSubject = value => {
    const key = String(value || '').trim().toLowerCase().replace(/[_-]/g, ' ');
    if (['math', 'maths', 'mathematics'].includes(key)) return 'mathematics';
    if (['all', 'general', 'science (general)', 'science general', 'mixed & assessments', ''].includes(key)) return null;
    return key;
  };
  function storage(kind, key, value) {
    try {
      if (value === undefined) return root[kind].getItem(key);
      root[kind].setItem(key, value);
    } catch { /* Memory-only presentation remains available. */ }
    return null;
  }
  const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
  const tent = (value, a, b, c) => value <= a || value >= c ? 0 : value < b ? (value-a)/(b-a) : (c-value)/(c-b);
  const dominant = value => value < .32 ? 'macro' : value < .65 ? 'mid' : 'micro';
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(className, text, action) {
    const node = element('button', className, text); node.type = 'button';
    node.addEventListener('click', action); return node;
  }
  let instanceCount = 0;
  class IgniteEnvironmentSystem {
    constructor({ assets = root.IgniteEnvironmentAssets, autoMount = true } = {}) {
      this.assets = assets || {};
      this.id = `ignite-env-${++instanceCount}`;
      this.activeEnv = null; this.currentSubject = null; this.taskMode = 'browse';
      this.userStatic = storage('localStorage', STATIC_KEY) === 'true';
      this.media = root.matchMedia?.('(prefers-reduced-motion: reduce)');
      this.reducedMotion = Boolean(this.media?.matches);
      this.frame = 0; this.exploreDepth = .15; this.isExploreMode = false;
      this.listeners = []; this.mounted = false;
      if (autoMount) this.mount();
    }
    get isStatic() { return this.userStatic || this.reducedMotion; }
    pool() {
      return Object.values(this.assets).filter(scene => !this.currentSubject || scene.subjects.includes(this.currentSubject));
    }
    on(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      this.listeners.push(() => target.removeEventListener(type, handler, options));
    }
    mount() {
      if (this.mounted) return this;
      this.mounted = true;
      this.stage = element('div', 'ignite-env-stage');
      this.stage.setAttribute('aria-hidden', 'true');
      this.grain = element('div', 'ignite-env-grain'); this.stage.append(this.grain);
      this.layers = {};
      for (const layer of LAYERS) {
        const svg = this.makeSvg(`${this.id}-${layer}`);
        this.layers[layer] = svg; this.stage.append(svg);
      }
      document.body.prepend(this.stage);
      this.mountControls(); this.mountExplorer();
      document.body.classList.add('ignite-env-ready');
      document.body.classList.toggle('ignite-env-dashboard', Boolean(document.querySelector('.mobile-nav')));
      this.on(root, 'scroll', () => this.schedule(), { passive: true });
      this.on(root, 'resize', () => { this.schedule(); if (this.isExploreMode) this.renderInspection(); }, { passive: true });
      this.on(document, 'visibilitychange', () => {
        if (document.hidden && this.frame) { root.cancelAnimationFrame(this.frame); this.frame = 0; }
        if (!document.hidden) this.schedule();
      });
      const mediaChanged = event => { this.reducedMotion = event.matches; this.refreshControls(); this.render(); if (this.isExploreMode) this.renderInspection(); };
      if (this.media?.addEventListener) this.on(this.media, 'change', mediaChanged);
      else if (this.media?.addListener) { this.media.addListener(mediaChanged); this.listeners.push(() => this.media.removeListener(mediaChanged)); }
      this.on(document, 'click', event => { if (!this.toolbar.contains(event.target)) this.toolbar.open = false; });
      this.observer = new MutationObserver(() => {
        this.otherDialog = Boolean(document.querySelector('dialog[open]:not(.ignite-env-explorer)'));
        if (this.otherDialog) this.toolbar.open = false;
        this.schedule();
      });
      this.observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
      return this;
    }
    makeSvg(prefix) {
      const svg = document.createElementNS(SVG, 'svg');
      svg.setAttribute('viewBox', '0 0 1440 900');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svg.setAttribute('focusable', 'false'); svg.setAttribute('aria-hidden', 'true');
      svg.dataset.prefix = prefix; svg.classList.add('ignite-env-svg'); return svg;
    }
    setArtwork(svg, artwork) {
      // Only fixed, locally authored registry fragments enter SVG. Pattern ids are
      // unique across ambient layers and the separate inspection canvas.
      const prefix = svg.dataset.prefix;
      svg.innerHTML = String(artwork || '').replace(/id="([A-Za-z0-9_-]+)"/g, (_,id) => `id="${prefix}-${id}"`)
        .replace(/url\(#([A-Za-z0-9_-]+)\)/g, (_,id) => `url(#${prefix}-${id})`);
    }
    mountControls() {
      this.toolbar = element('details', 'ignite-env-toolbar');
      const summary = element('summary', '', 'Surroundings');
      this.panel = element('div', 'ignite-env-menu');
      this.caption = element('p', 'ignite-env-caption');
      this.exploreButton = button('', 'Explore surroundings', () => this.toggleExploreMode(true));
      this.cycleButton = button('', 'Change surroundings', () => this.cycleEnvironment());
      this.staticButton = button('', 'Static paper', () => this.toggleStaticMode());
      this.staticButton.setAttribute('aria-pressed', 'false');
      this.motionNote = element('small', 'ignite-env-motion-note');
      this.panel.append(this.caption, this.exploreButton, this.cycleButton, this.staticButton, this.motionNote);
      this.toolbar.append(summary, this.panel); document.body.append(this.toolbar);
    }
    mountExplorer() {
      this.dialog = element('dialog', 'ignite-env-explorer');
      this.dialog.setAttribute('aria-labelledby', `${this.id}-title`);
      const heading = element('header', 'ignite-env-explorer-heading');
      this.exploreTitle = element('h2', '', 'Explore surroundings'); this.exploreTitle.id = `${this.id}-title`;
      this.closeButton = button('ignite-env-close', 'Back to study · Esc', () => this.toggleExploreMode(false));
      heading.append(this.exploreTitle, this.closeButton);
      this.exploreCaption = element('p', 'ignite-env-inspection-caption');
      const controls = element('div', 'ignite-env-depth-controls');
      const depthLabel = element('label', '', 'Explore depth'); depthLabel.htmlFor = `${this.id}-depth`;
      this.depth = element('input'); this.depth.type = 'range'; this.depth.min = '0'; this.depth.max = '100'; this.depth.value = '15'; this.depth.id = depthLabel.htmlFor;
      this.on(this.depth, 'input', () => { this.exploreDepth = Number(this.depth.value)/100; this.renderInspection(); });
      this.depthName = element('span', 'ignite-env-depth-name'); this.depthName.setAttribute('role', 'status');
      const stages = element('div', 'ignite-env-depth-stages');
      LAYERS.forEach((layer,index) => stages.append(button('', ['Distant','Structure','Detail'][index], () => {
        this.exploreDepth = [.15,.48,.78][index]; this.depth.value = String(this.exploreDepth*100); this.renderInspection();
      })));
      controls.append(depthLabel, this.depth, this.depthName, stages);
      const grid = element('div', 'ignite-env-inspection-grid');
      this.art = element('div', 'ignite-env-inspection-art');
      this.inspectSvg = this.makeSvg(`${this.id}-inspection`);
      this.pins = element('div', 'ignite-env-pins');
      this.art.append(this.inspectSvg, this.pins);
      this.annotationList = element('div', 'ignite-env-labels');
      this.annotationList.setAttribute('aria-label', 'Features in this view');
      grid.append(this.art, this.annotationList);
      this.reference = element('a', 'ignite-env-reference'); this.reference.target = '_blank'; this.reference.rel = 'noopener noreferrer';
      const footer = element('footer', 'ignite-env-explorer-footer');
      footer.append(element('span', '', 'Illustration · not a measured image or assessment'), this.reference);
      this.dialog.append(heading, this.exploreCaption, controls, grid, footer);
      document.body.append(this.dialog);
      this.on(this.dialog, 'cancel', event => { event.preventDefault(); this.toggleExploreMode(false); });
      this.on(this.dialog, 'keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.toggleExploreMode(false); }
      });
      this.on(this.dialog, 'close', () => this.finishExplore());
    }
    setContext({ subject = null, taskMode = 'browse' } = {}) {
      this.currentSubject = normalizeSubject(subject);
      this.taskMode = MODE.has(taskMode) ? taskMode : 'browse';
      document.body.dataset.envMode = this.taskMode;
      if (this.taskMode !== 'browse' && this.isExploreMode) this.toggleExploreMode(false);
      const pool = this.pool();
      const saved = storage('sessionStorage', SCENE_KEY);
      const chosen = pool.find(scene => scene.id === this.activeEnv?.id) || pool.find(scene => scene.id === saved) || pool[Math.floor(Math.random()*pool.length)];
      this.applyEnvironment(chosen?.id || null);
      return this;
    }
    applyEnvironment(id) {
      const scene = Object.hasOwn(this.assets, id) ? this.assets[id] : null;
      document.body.dataset.environment = scene?.id || 'paper';
      if (this.activeEnv?.id === scene?.id && this.activeEnv === scene) { this.refreshControls(); this.render(); return; }
      this.activeEnv = scene;
      for (const layer of LAYERS) this.setArtwork(this.layers[layer], scene?.[layer]);
      if (scene) storage('sessionStorage', SCENE_KEY, scene.id);
      this.refreshControls(); this.render();
      if (this.isExploreMode) this.renderInspection();
    }
    refreshControls() {
      const restricted = this.taskMode !== 'browse';
      this.toolbar.hidden = restricted;
      if (restricted) this.toolbar.open = false;
      this.caption.textContent = this.activeEnv?.caption || 'Paper surroundings · more subjects can be added';
      this.exploreButton.disabled = !this.activeEnv || typeof this.dialog.showModal !== 'function';
      this.cycleButton.disabled = this.pool().length < 2;
      this.staticButton.setAttribute('aria-pressed', String(this.userStatic));
      this.motionNote.textContent = this.reducedMotion ? 'Your device’s reduced-motion setting is active.' : 'Your study progress is unaffected.';
      document.body.dataset.envStatic = String(this.isStatic);
    }
    cycleEnvironment() {
      const pool = this.pool();
      if (pool.length < 2) return false;
      const index = pool.findIndex(scene => scene.id === this.activeEnv?.id);
      this.applyEnvironment(pool[(index+1)%pool.length].id); return true;
    }
    toggleStaticMode() {
      this.userStatic = !this.userStatic;
      storage('localStorage', STATIC_KEY, String(this.userStatic));
      this.refreshControls(); this.render();
      if (this.isExploreMode) this.renderInspection();
    }
    progress() {
      return clamp(root.scrollY/Math.max(1,document.documentElement.scrollHeight-root.innerHeight));
    }
    schedule() {
      if (this.frame || document.hidden) return;
      this.frame = root.requestAnimationFrame(() => { this.frame = 0; this.render(); });
    }
    render() {
      if (!this.mounted) return;
      const still = this.isStatic || this.taskMode !== 'browse' || this.otherDialog;
      const progress = still ? .48 : this.progress();
      const amplitude = this.taskMode === 'browse' ? .42 : this.taskMode === 'question' ? .035 : 0;
      const paper = progress > .86 ? (1-progress)/.14 : 1;
      const alphas = [tent(progress,-.1,.16,.49),tent(progress,.14,.48,.8),tent(progress,.46,.77,1.01)];
      LAYERS.forEach((layer,index) => {
        const svg = this.layers[layer];
        svg.style.opacity = String(this.userStatic || !this.activeEnv ? 0 : alphas[index]*amplitude*paper);
        const scale = still ? 1 : [.96,.88,.82][index] + progress*[.2,.34,.44][index];
        svg.style.transform = `scale(${scale})`;
      });
      this.grain.style.transform = still ? 'translate3d(0,0,0)' : `translate3d(0,${-this.progress()*38}px,0)`;
      this.grain.style.opacity = this.userStatic ? '0' : this.taskMode === 'browse' ? '.3' : '0';
    }
    toggleExploreMode(force) {
      const open = typeof force === 'boolean' ? force : !this.isExploreMode;
      if (!open) { if (this.dialog.open) this.dialog.close(); else this.finishExplore(); return; }
      if (this.taskMode !== 'browse' || !this.activeEnv || this.otherDialog || typeof this.dialog.showModal !== 'function') return false;
      if (this.isExploreMode) return true;
      this.returnFocus = this.toolbar.contains(document.activeElement) || document.activeElement === document.body
        ? this.toolbar.querySelector('summary') : document.activeElement;
      this.returnScroll = { x:root.scrollX, y:root.scrollY };
      this.oldOverflow = document.documentElement.style.overflow;
      this.exploreDepth = this.isStatic ? .48 : this.progress();
      this.depth.value = String(Math.round(this.exploreDepth*100));
      this.toolbar.open = false;
      this.dialog.showModal(); this.isExploreMode = true;
      document.documentElement.style.overflow = 'hidden';
      document.body.dataset.exploreMode = 'true';
      this.renderInspection(); this.closeButton.focus({preventScroll:true}); return true;
    }
    finishExplore() {
      if (!this.isExploreMode) return;
      this.isExploreMode = false;
      document.body.dataset.exploreMode = 'false';
      document.documentElement.style.overflow = this.oldOverflow || '';
      if (this.returnScroll) root.scrollTo(this.returnScroll.x,this.returnScroll.y);
      if (this.returnFocus?.isConnected) this.returnFocus.focus({preventScroll:true});
      this.render();
    }
    renderInspection() {
      const scene = this.activeEnv; if (!scene || !this.isExploreMode) return;
      const layer = dominant(this.exploreDepth);
      this.exploreTitle.textContent = scene.title;
      this.exploreCaption.textContent = scene.caption;
      this.depthName.textContent = {macro:'Distant outline',mid:'Structure',micro:'Close detail'}[layer];
      this.depth.setAttribute('aria-valuetext', this.depthName.textContent);
      this.setArtwork(this.inspectSvg, scene[layer]);
      // Inspection may crop into a detail, while ambient art keeps its full canvas.
      // Pins use this same coordinate transform, not viewport percentages.
      const view = scene.inspectionViews?.[layer] || [0,0,1440,900];
      this.inspectSvg.setAttribute('viewBox', view.join(' '));
      this.inspectSvg.dataset.layer = layer;
      this.reference.href = scene.referenceUrl; this.reference.textContent = scene.referenceLabel + ' ↗';
      this.pins.replaceChildren(); this.annotationList.replaceChildren();
      const labels = scene.labels.filter(label => label.layer === layer);
      labels.forEach((label,index) => {
        const detailId = `${this.id}-label-${index}`;
        const row = element('div', 'ignite-env-label');
        const detail = element('p', 'ignite-env-label-detail', label.detail); detail.id = detailId; detail.hidden = true;
        const toggle = () => {
          const expanded = detail.hidden;
          this.annotationList.querySelectorAll('.ignite-env-label-detail').forEach(node => { node.hidden = true; });
          this.annotationList.querySelectorAll('button').forEach(node => node.setAttribute('aria-expanded','false'));
          this.pins.querySelectorAll('button').forEach(node => node.setAttribute('aria-expanded','false'));
          detail.hidden = !expanded; marker.setAttribute('aria-expanded',String(expanded)); title.setAttribute('aria-expanded',String(expanded));
        };
        const title = button('', `${index+1}. ${label.title}`, toggle);
        title.setAttribute('aria-expanded','false'); title.setAttribute('aria-controls',detailId);
        row.append(title,detail); this.annotationList.append(row);
        const marker = button('ignite-env-pin',String(index+1),toggle);
        marker.setAttribute('aria-label',label.title); marker.setAttribute('aria-controls',detailId); marker.setAttribute('aria-expanded','false');
        // Same viewBox and meet-fit as the SVG, including mobile letterboxing.
        const width=this.art.clientWidth,height=this.art.clientHeight;
        const [vx,vy,vw,vh]=view;
        const scale=Math.min(width/vw,height/vh);
        marker.style.left = `${(width-vw*scale)/2+(label.x-vx)*scale}px`;
        marker.style.top = `${(height-vh*scale)/2+(label.y-vy)*scale}px`;
        this.pins.append(marker);
      });
    }
    destroy() {
      if (this.dialog) this.toggleExploreMode(false); this.observer?.disconnect();
      this.listeners.splice(0).forEach(remove=>remove());
      if (this.frame) root.cancelAnimationFrame(this.frame);
      this.stage?.remove(); this.toolbar?.remove(); this.dialog?.remove();
      document.body.classList.remove('ignite-env-ready','ignite-env-dashboard');
      ['envMode','envStatic','environment','exploreMode'].forEach(key=>delete document.body.dataset[key]);
      this.mounted = false;
    }
  }
  root.IgniteEnvironmentSystem = IgniteEnvironmentSystem;
  root.IgniteSurroundings = {
    setContext(context = {}) {
      root.__igniteEnvironmentContext = {...context};
      try { root.igniteEnv?.setContext(context); }
      catch (error) {
        root.igniteEnv?.destroy(); root.igniteEnv = null;
        console.warn('Surroundings paused; study controls remain available.', error);
      }
    }
  };
  function boot() {
    if (root.igniteEnv || !root.IgniteEnvironmentAssets) return;
    try { root.igniteEnv = new IgniteEnvironmentSystem({autoMount:false}); root.igniteEnv.mount(); root.igniteEnv.setContext(root.__igniteEnvironmentContext || {}); }
    catch (error) { root.igniteEnv?.destroy(); root.igniteEnv = null; document.body.classList.remove('ignite-env-ready'); console.warn('Surroundings unavailable; the study page remains available.',error); }
  }
  if (typeof document !== 'undefined' && !root.__IGNITE_ENVIRONMENT_NO_BOOT__) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
    else boot();
  }
})(typeof window === 'undefined' ? globalThis : window);
