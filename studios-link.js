'use strict';
(function(){
  window.IgniteStudios=Object.freeze({mountTrail(container,track){
    if(!container)return;
    const studio=window.IgniteStudioRegistry.forTrack(track,window.IgniteBoard?.current());container.replaceChildren();container.hidden=!studio;
    if(!studio)return;
    const text=document.createElement('p');text.textContent='Try the idea before your next round.';const a=document.createElement('a');a.href='./'+studio.path;a.textContent='Explore '+studio.title+' ↗';container.append(text,a);
  }});
})();
