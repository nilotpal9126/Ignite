'use strict';

// Presentation only. Identity contributes only a verified-session boolean;
// no identifier, question, answer, attempt or score data enters this layer.
(function exposeEnvironments(root) {
  const SVG = 'http://www.w3.org/2000/svg';
  const LAYERS = ['macro', 'mid', 'micro'];
  const MODE = new Set(['browse', 'question', 'test', 'lab', 'focus']);
  const SCENE_KEY = 'ignite-surroundings-scene-v1';
  const DASHBOARD_SCENE_KEY = 'ignite-dashboard-surroundings-v1';
  const STATIC_KEY = 'ignite-surroundings-static-v1';
  const assetBase = typeof document === 'undefined' ? null : new URL('./', document.currentScript?.src || root.location.href);
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
  const dominant = value => value < .28 ? 'macro' : value < .75 ? 'mid' : 'micro';
  function cameraAt(scene, depth) {
    const t=clamp(depth), first=t<=.55, a=scene.cameras[first?0:1], b=scene.cameras[first?1:2];
    const q=first?t/.55:(t-.55)/.45, u=q*q*(3-2*q);
    const width=a[2]*Math.exp(Math.log(b[2]/a[2])*u),height=a[3]*Math.exp(Math.log(b[3]/a[3])*u);
    const cx=a[0]+a[2]/2+(b[0]+b[2]/2-a[0]-a[2]/2)*u;
    const cy=a[1]+a[3]/2+(b[1]+b[3]/2-a[1]-a[3]/2)*u;
    return [cx-width/2,cy-height/2,width,height];
  }
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
    static cameraAt(scene,depth){return cameraAt(scene,depth);}
    constructor({ assets = root.IgniteEnvironmentAssets, autoMount = true } = {}) {
      this.assets = assets || {};
      this.id = `ignite-env-${++instanceCount}`;
      this.activeEnv = null; this.currentSubject = null; this.taskMode = 'browse';
      this.userStatic = storage('localStorage', STATIC_KEY) === 'true';
      this.media = root.matchMedia?.('(prefers-reduced-motion: reduce)');
      this.contrastMedia = root.matchMedia?.('(forced-colors: active)');
      this.reducedMotion = Boolean(this.media?.matches);
      this.frame = 0; this.exploreDepth = .15; this.isExploreMode = false;
      this.signedIn=false; this.grainFrame=0; this.cameraDepth=null;
      this.grainFlow={velocity:0,offset:0,phase:0};this.grainScrollY=root.scrollY||0;
      this.grainRipples=[];this.motionPreference='system';
      this.listeners = []; this.mounted = false;
      if (autoMount) this.mount();
    }
    get isStatic() { return this.userStatic || (this.reducedMotion&&this.motionPreference!=='animate'); }
    setMotionPreference(value='system') {
      // Explicit, non-persistent preview/app choice; OS settings are unchanged.
      this.motionPreference=value==='animate'?'animate':'system';
      this.refreshControls();this.render();
    }
    pool() {
      const scenes=Object.values(this.assets);
      if(this.landing)return [];
      if(this.dashboard)return scenes;
      const preferred=scenes.filter(scene => !this.currentSubject || scene.subjects.includes(this.currentSubject));
      // Remaining scenery is also available on Maths/Biology pages, without
      // representing it as a diagram of those subjects.
      return preferred.length ? preferred : ['mathematics','biology'].includes(this.currentSubject) ? scenes : [];
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
      this.grain = element('canvas', 'ignite-env-grain'); this.stage.append(this.grain);
      this.grain.setAttribute('aria-hidden','true');
      try { this.grainContext=this.grain.getContext('2d'); } catch { this.grainContext=null; }
      this.world=this.makeSvg(`${this.id}-world`);this.layers={macro:this.world};this.stage.append(this.world);
      document.body.prepend(this.stage);
      this.mountControls(); this.mountExplorer();
      document.body.classList.add('ignite-env-ready');
      document.body.classList.toggle('ignite-env-dashboard', Boolean(document.querySelector('.mobile-nav')));
      this.landing=Boolean(document.querySelector('.landing-hero'));
      this.dashboard=Boolean(document.querySelector('.app-shell #worksheetGrid'));
      document.body.classList.toggle('ignite-env-landing',this.landing);
      document.body.classList.toggle('ignite-env-flow-ready',this.landing&&Boolean(this.grainContext));
      this.mountDashboardPicker();
      this.resizeGrain();
      const identity=root.IgniteIdentity;
      const appearance=user=>this.setSignedIn(Boolean(user?.emailVerified));
      if(identity?.onChange)this.listeners.push(identity.onChange(appearance));
      try{appearance(identity?.session?.());}catch{appearance(null);}
      this.on(root, 'scroll', () => {
        const delta=root.scrollY-this.grainScrollY;this.grainScrollY=root.scrollY;
        if(this.landing&&!this.isStatic&&!this.isExploreMode&&!this.otherDialog&&!document.hidden){
          // Actual scroll displacement covers wheel, touch and keyboard input.
          // The native page scroll is never prevented or replaced.
          this.grainFlow.velocity=Math.max(-22,Math.min(22,this.grainFlow.velocity*.45+delta*.1));
          if(Math.abs(delta)>1){
            const now=root.performance.now(),last=this.grainRipples.at(-1);
            if(last&&now-last.born<110)last.strength=Math.min(16,last.strength+Math.abs(delta)*.035);
            else{
              this.grainRipples.push({x:this.grainOrigin?.x??root.innerWidth*.5,y:this.grainOrigin?.y??root.innerHeight*.48,born:now,strength:Math.min(16,4+Math.abs(delta)*.06)});
              if(this.grainRipples.length>3)this.grainRipples.shift();
            }
          }
        }
        this.schedule();
      }, { passive: true });
      this.on(root,'pointermove',event=>{if(this.landing)this.grainOrigin={x:event.clientX,y:event.clientY};},{passive:true});
      this.on(root, 'resize', () => { this.resizeGrain();this.schedule(); if (this.isExploreMode) this.renderInspection(); }, { passive: true });
      this.on(document, 'visibilitychange', () => {
        if (document.hidden && this.frame) { root.cancelAnimationFrame(this.frame); this.frame = 0; }
        if(document.hidden)this.stopGrain();
        if (!document.hidden) this.schedule();
      });
      const mediaChanged = event => { this.reducedMotion = event.matches; this.refreshControls(); this.render(); if (this.isExploreMode) this.renderInspection(); };
      if (this.media?.addEventListener) this.on(this.media, 'change', mediaChanged);
      else if (this.media?.addListener) { this.media.addListener(mediaChanged); this.listeners.push(() => this.media.removeListener(mediaChanged)); }
      if(this.contrastMedia?.addEventListener)this.on(this.contrastMedia,'change',()=>this.schedule());
      this.on(document, 'click', event => { if (!this.toolbar.contains(event.target)) this.toolbar.open = false; });
      this.observer = new MutationObserver(() => {
        this.otherDialog = Boolean(document.querySelector('dialog[open]:not(.ignite-env-explorer)'));
        if (this.otherDialog) this.toolbar.open = false;
        this.schedule();
      });
      this.observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
      return this;
    }
    setSignedIn(value) {
      this.signedIn=Boolean(value);
      // Studios keep their independent, established visual design.
      document.body.dataset.envAppearance=this.signedIn&&this.taskMode!=='lab'?'studio':'visitor';
      this.schedule();
    }
    resizeGrain() {
      if(!this.grainContext)return;
      const ratio=Math.min(root.devicePixelRatio||1,1.5);
      this.grain.width=Math.round(root.innerWidth*ratio);this.grain.height=Math.round(root.innerHeight*ratio);
      this.grainContext.setTransform(ratio,0,0,ratio,0,0);this.drawGrain(0);
    }
    drawGrain(time) {
      const ctx=this.grainContext;if(!ctx)return;
      const w=root.innerWidth,h=root.innerHeight;
      const flow=this.isStatic?{velocity:0,offset:0,phase:0}:this.grainFlow;
      const t=time*.00022+flow.phase,wrap=(v,size)=>((v%size)+size)%size;
      ctx.clearRect(0,0,w,h);ctx.fillStyle=this.signedIn?'#779396a0':'#958a73a6';ctx.beginPath();
      for(let y=-44;y<h+44;y+=22)for(let x=-44;x<w+44;x+=22){
        const seed=(Math.sin(x*12.9898+y*78.233)*43758.5453)%1;
        const depth=.55+Math.abs(seed)*.45,radius=.5+Math.abs(seed)*.28;
        let dx=seed*4+8*Math.sin(t+y*.013)+4*Math.cos(t*.63+x*.017)+Math.sin(y*.023+x*.006+t*1.3)*flow.velocity*2.1;
        let dy=seed*3+6*Math.cos(t*.87+x*.012)+3*Math.sin(t*.51+y*.017)-flow.offset*depth+Math.cos(x*.019-y*.007+t)*flow.velocity;
        if(!this.isStatic)for(const ripple of this.grainRipples){
          const age=Math.max(0,time-ripple.born),rx=x-ripple.x,ry=y-ripple.y,distance=Math.max(1,Math.hypot(rx,ry));
          const wave=(distance-age*.22)/125;
          const push=Math.sin((distance-age*.22)*.04)*ripple.strength*Math.exp(-wave*wave-age/950);
          dx+=rx/distance*push;dy+=ry/distance*push;
        }
        const px=wrap(x+dx+44,w+88)-44,py=wrap(y+dy+44,h+88)-44;
        ctx.moveTo(px+radius,py);ctx.arc(px,py,radius,0,Math.PI*2);
      }
      ctx.fill();this.lastGrainTime=time;
    }
    stopGrain(){if(this.grainFrame)root.cancelAnimationFrame(this.grainFrame);this.grainFrame=0;this.grainFlow.velocity=0;this.grainRipples=[];this.lastGrainTime=0;}
    updateGrain() {
      const moving=this.landing&&!this.isStatic&&!this.contrastMedia?.matches&&this.taskMode==='browse'&&!this.otherDialog&&!this.isExploreMode&&!document.hidden;
      this.grain.style.opacity=this.userStatic||!this.landing?'0':'1';
      if(!moving){this.stopGrain();if(!this.userStatic)this.drawGrain(0);return;}
      if(this.grainFrame||!this.grainContext)return;
      const tick=time=>{
        this.grainFrame=0;
        const elapsed=time-(this.lastGrainTime||time-33);
        if(elapsed>=32){
          const dt=Math.min(elapsed,64),flow=this.grainFlow;
          this.grainRipples=this.grainRipples.filter(ripple=>time-ripple.born<2400);
          flow.offset+=flow.velocity*dt/33;flow.phase+=flow.velocity*dt*.00035;
          flow.velocity*=Math.exp(-dt/420);
          if(Math.abs(flow.velocity)<.001)flow.velocity=0;
          this.drawGrain(time);
        }
        this.grainFrame=root.requestAnimationFrame(tick);
      };
      this.grainFrame=root.requestAnimationFrame(tick);
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
        .replace(/url\(#([A-Za-z0-9_-]+)\)/g, (_,id) => `url(#${prefix}-${id})`)
        .replace(/href="\.\/assets\/([A-Za-z0-9_./-]+)"/g,(_,file)=>`href="${new URL('assets/'+file,assetBase).href}"`);
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
    mountDashboardPicker() {
      const host=document.querySelector('#boardBar');
      if(!this.dashboard||!host)return;
      this.dashboardPicker=element('div','ignite-env-dashboard-picker');
      this.dashboardPicker.setAttribute('role','group');this.dashboardPicker.setAttribute('aria-label','Dashboard surroundings');
      this.dashboardPicker.append(element('span','','Your surroundings'));
      for(const [id,title] of [['lunar_surface','Moon'],['molecular_lattice','Molecule']]){
        if(!Object.hasOwn(this.assets,id))continue;
        const choice=button('',title,()=>this.applyEnvironment(id));choice.dataset.scene=id;
        choice.setAttribute('aria-pressed','false');this.dashboardPicker.append(choice);
      }
      host.after(this.dashboardPicker);
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
        this.exploreDepth = [0,.55,1][index]; this.depth.value = String(this.exploreDepth*100); this.renderInspection();
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
      this.setSignedIn(this.signedIn);
      document.body.dataset.envMode = this.taskMode;
      if (this.taskMode !== 'browse' && this.isExploreMode) this.toggleExploreMode(false);
      const pool = this.pool();
      const saved = storage('sessionStorage', this.dashboard?DASHBOARD_SCENE_KEY:SCENE_KEY);
      const chosen = pool.find(scene => scene.id === this.activeEnv?.id) || pool.find(scene => scene.id === saved)
        || (this.dashboard?pool.find(scene=>scene.id==='lunar_surface'):null) || pool[Math.floor(Math.random()*pool.length)];
      this.applyEnvironment(chosen?.id || null);
      return this;
    }
    applyEnvironment(id) {
      const scene = !this.landing&&Object.hasOwn(this.assets, id) ? this.assets[id] : null;
      document.body.dataset.environment = scene?.id || 'paper';
      if (this.activeEnv?.id === scene?.id && this.activeEnv === scene) { this.refreshControls(); this.render(); return; }
      this.activeEnv = scene;
      this.setArtwork(this.world,scene?.artwork);
      this.cameraDepth=null;
      if (scene) storage('sessionStorage', this.dashboard?DASHBOARD_SCENE_KEY:SCENE_KEY, scene.id);
      this.refreshControls(); this.render();
      if (this.isExploreMode) this.renderInspection();
    }
    refreshControls() {
      const restricted = this.taskMode !== 'browse';
      this.toolbar.hidden = restricted;
      if (restricted) this.toolbar.open = false;
      if(this.dashboardPicker){
        this.dashboardPicker.hidden=restricted;
        this.dashboardPicker.querySelectorAll('button').forEach(choice=>choice.setAttribute('aria-pressed',String(choice.dataset.scene===this.activeEnv?.id)));
      }
      this.caption.textContent = this.activeEnv?.caption || (this.landing?'Floating grains · scroll to stir the current':'Paper surroundings · more subjects can be added');
      this.exploreButton.disabled = !this.activeEnv || typeof this.dialog.showModal !== 'function';
      this.cycleButton.disabled = this.pool().length < 2;
      this.staticButton.setAttribute('aria-pressed', String(this.userStatic));
      this.motionNote.textContent = this.reducedMotion&&this.motionPreference!=='animate' ? 'Your device’s reduced-motion setting is active.' : 'Your study progress is unaffected.';
      document.body.dataset.envStatic = String(this.isStatic);
      document.body.dataset.envPaper = String(this.userStatic);
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
      const intro=this.landing?(document.querySelector('.landing-hero')?.offsetHeight||0)*.75:0;
      return clamp((root.scrollY-intro)/Math.max(1,document.documentElement.scrollHeight-root.innerHeight-intro));
    }
    schedule() {
      if (this.frame || document.hidden) return;
      this.frame = root.requestAnimationFrame(() => { this.frame = 0; this.render(); });
    }
    render() {
      if (!this.mounted) return;
      const still=this.isStatic||this.taskMode!=='browse'||this.otherDialog||this.isExploreMode;
      const target=still ? .55 : this.progress();
      if(this.cameraDepth===null||still)this.cameraDepth=target;
      else this.cameraDepth+= (target-this.cameraDepth)*.2;
      if(this.activeEnv&&Math.abs(target-this.cameraDepth)>.0004&&!still)this.schedule();else this.cameraDepth=target;
      const hero=this.landing?clamp((root.scrollY-root.innerHeight*.35)/(root.innerHeight*.55)):1;
      const amplitude=this.taskMode==='browse' ? (this.signedIn ? .35 : .24)*hero : this.taskMode==='question' ? .018 : 0;
      this.world.style.opacity=String(this.userStatic||!this.activeEnv?0:amplitude);
      if(this.activeEnv){
        this.world.setAttribute('viewBox',cameraAt(this.activeEnv,this.cameraDepth).map(n=>n.toFixed(4)).join(' '));
        this.world.dataset.depth=this.cameraDepth.toFixed(4);
      }
      document.body.dataset.envStatic=String(this.isStatic);this.updateGrain();
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
      this.stopGrain();
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
      if(this.inspectSvg.dataset.scene!==scene.id){this.setArtwork(this.inspectSvg,scene.artwork);this.inspectSvg.dataset.scene=scene.id;}
      // Inspection may crop into a detail, while ambient art keeps its full canvas.
      // Pins use this same coordinate transform, not viewport percentages.
      const view = cameraAt(scene,this.exploreDepth);
      this.inspectSvg.setAttribute('viewBox', view.join(' '));
      this.inspectSvg.dataset.layer = layer;
      this.reference.href = scene.referenceUrl; this.reference.textContent = scene.referenceLabel + ' ↗';
      this.pins.replaceChildren(); this.annotationList.replaceChildren();
      const leaders=document.createElementNS(SVG,'svg');leaders.classList.add('ignite-env-leaders');this.pins.append(leaders);
      const placed=[];
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
        const px=x=>(width-vw*scale)/2+(x-vx)*scale,py=y=>(height-vh*scale)/2+(y-vy)*scale;
        const ax=px(label.x),ay=py(label.y);
        if(ax<0||ax>width||ay<0||ay>height)return;
        let mx=Math.max(24,Math.min(width-24,px(label.pinX??label.x))),my=Math.max(24,Math.min(height-24,py(label.pinY??label.y)));
        for(let tries=0;tries<8&&placed.some(p=>Math.abs(mx-p[0])<46&&Math.abs(my-p[1])<46);tries++)my=Math.max(24,Math.min(height-24,my+(my<height/2?48:-48)));
        placed.push([mx,my]);marker.style.left=`${mx}px`;marker.style.top=`${my}px`;
        const line=document.createElementNS(SVG,'line');line.setAttribute('x1',ax);line.setAttribute('y1',ay);line.setAttribute('x2',mx);line.setAttribute('y2',my);leaders.append(line);
        this.pins.append(marker);
      });
    }
    destroy() {
      if (this.dialog) this.toggleExploreMode(false); this.observer?.disconnect();
      this.listeners.splice(0).forEach(remove=>remove());
      if (this.frame) root.cancelAnimationFrame(this.frame);
      this.stopGrain();
      this.stage?.remove(); this.toolbar?.remove(); this.dialog?.remove();
      this.dashboardPicker?.remove();
      document.body.classList.remove('ignite-env-ready','ignite-env-dashboard','ignite-env-landing','ignite-env-flow-ready');
      ['envMode','envStatic','envPaper','environment','exploreMode','envAppearance'].forEach(key=>delete document.body.dataset[key]);
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
    // Deferred scripts can run while readyState is already interactive, before
    // the later identity script exists. Wait for all deferred page dependencies.
    if (document.readyState !== 'complete') {
      const ready=()=>{document.removeEventListener('DOMContentLoaded',ready);root.removeEventListener('load',ready);boot();};
      document.addEventListener('DOMContentLoaded',ready,{once:true});
      root.addEventListener('load',ready,{once:true});
    }
    else boot();
  }
})(typeof window === 'undefined' ? globalThis : window);
