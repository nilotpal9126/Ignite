'use strict';
(function(){
  const own=document.currentScript,site=new URL('./',own.src),hub=new URL('labs.html',site),board=window.IgniteBoard?.current(),studio=own.dataset.studio,worlds=studio==='worlds';
  if(!board){hub.searchParams.set('return',studio);location.replace(hub.href);return;}
  if(!worlds&&board!=='ICSE'){hub.searchParams.set('unavailable','icse');location.replace(hub.href);return;}
  if(worlds){
    const choice=document.querySelector(`[data-board="${board}"]`);if(choice?.getAttribute('aria-pressed')!=='true')choice?.click();
    const controls=document.querySelector('.catalogue-controls>.board-buttons');if(controls)controls.hidden=true;
  }
  window.__igniteEnvironmentContext = {taskMode:'lab',subject:null};
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('environments.css?v=env-flow-20261024',site);document.head.append(css);
  const assets=document.createElement('script');assets.src=new URL('environment-assets.js?v=env-flow-20261024',site);
  assets.onload=()=>{const runtime=document.createElement('script');runtime.src=new URL('environments.js?v=env-flow-20261024',site);document.head.append(runtime);};document.head.append(assets);
  const nav=document.createElement('nav');nav.className='ignite-lab-context';nav.setAttribute('aria-label','Project Ignite navigation');
  for(const [path,text]of [['labs.html','← Interactive labs'],['play.html','Play levels'],['dashboard.html','Dashboard']]){const a=document.createElement('a');a.href=new URL(path,site).href;a.textContent=text;nav.append(a);}
  const note=document.createElement('span');note.textContent=worlds?`${board} · Class 10 concept activities`:`${board} · Class 10 · session practice`;nav.append(note);document.body.prepend(nav);document.documentElement.removeAttribute('data-ignite-context-pending');
})();
