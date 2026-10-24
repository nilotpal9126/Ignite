'use strict';
(async function(){
  const $=id=>document.getElementById(id),registry=window.IgniteStudioRegistry,board=window.IgniteBoard;
  let learnerId=null;
  try{if(window.__IGNITE_PLATFORM__?.identity?.enabled){await Promise.race([window.IgniteIdentity.ready(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Identity timeout')),4000))]);learnerId=window.IgniteIdentity.learner()?.id||null;}}catch{/* Public labs remain available when sign-in is unavailable. */}
  if(learnerId)board.bind(learnerId);
  board.mountBar($('labsBoard'),()=>learnerId);
  const current=board.current();
  const pending=new URLSearchParams(location.search).get('return');
  const requested=registry.get(pending);
  if(requested&&requested.board===current){location.replace('./'+requested.path);return;}
  if(pending==='worlds'&&current){location.replace('./labs/ignite-subject-labs/Ignite-Subject-Worlds.html');return;}
  function render(){
    window.IgniteSurroundings?.setContext({subject:$('labsSubject').value,taskMode:'browse'});
    const subject=$('labsSubject').value,all=registry.forBoard(current),filtered=all.filter(s=>subject==='all'||s.subject===subject);
    $('labsCards').replaceChildren(...filtered.map(studio=>{
      const a=document.createElement('a');a.className='studio-card';a.href='./'+studio.path;a.dataset.studio=studio.id;a.dataset.subject=studio.subject;a.style.setProperty('--studio-colour',studio.colour);
      for(const [tag,text,cls]of [['small',`${studio.board} · CLASS ${studio.classLevel} · ${studio.subject.toUpperCase()}`,'studio-meta'],['span',studio.symbol,'studio-symbol'],['h2',studio.title,''],['p',studio.description,''],['small',studio.tag,'studio-tag'],['span','Open studio ↗','studio-open']]){const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;if(cls==='studio-symbol')n.setAttribute('aria-hidden','true');a.append(n);}return a;
    }));
    $('labsEmpty').hidden=filtered.length>0;
    $('labsEmpty').textContent=!current?'Choose your school board to see its labs.':all.length===0?'The four expanded studios currently follow ICSE Class 10. For CBSE, explore the board-matched concept activities below.':'There is no expanded studio for this subject yet. Try the concept activities below.';
    $('labsCount').textContent=current?`${current} · ${filtered.length} expanded ${filtered.length===1?'studio':'studios'}`:'Choose a board';
    $('worldsLink').hidden=!current;$('worldsLabel').textContent=current?`Explore ${current} concept activities`:'Explore concept activities';
    $('labsNotice').hidden=!(current==='CBSE'&&new URLSearchParams(location.search).has('unavailable'));
  }
  $('labsSubject').addEventListener('change',render);render();
})();
