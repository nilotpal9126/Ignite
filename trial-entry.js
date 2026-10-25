'use strict';

// Optional trial details live in this page's forms only. No contact data is
// written to browser storage or transmitted before the existing enquiry submit.
(function trialEntry() {
  function init() {
    const rules=window.IgniteEnrollmentRules,trial=document.querySelector('#free-demo');
    if(!rules||!trial||!window.HTMLDialogElement)return;
    const SEEN='ignite-trial-entry-seen-v1';
    let seen=false,goToTrial=false,postTrialShown=false,returnFocus=null;
    try{seen=sessionStorage.getItem(SEEN)==='true';}catch{}
    const dialog=document.createElement('dialog');dialog.id='trialEntry';dialog.className='enroll-dialog trial-entry-dialog';
    dialog.setAttribute('aria-labelledby','trialEntryTitle');
    dialog.setAttribute('aria-describedby','trialEntryIntro');
    dialog.innerHTML=`<div class="enroll-shell">
      <div class="enroll-heading"><div><p class="eyebrow">PROJECT IGNITE · FREE TRIAL</p><h2 id="trialEntryTitle" tabindex="-1">A little about you.</h2></div><button class="enroll-close" type="button" aria-label="Close trial details">×</button></div>
      <p class="enroll-lead" id="trialEntryIntro">Add your details to prefill enrolment after the trial, or close this box and try without sharing them.</p>
      <form id="trialEntryForm" novalidate><div class="enroll-grid">
        <label class="enroll-field enroll-wide">Student name<input name="studentName" type="text" autocomplete="name" minlength="2" maxlength="80" required aria-describedby="trial-studentName-error"><span class="enroll-error" id="trial-studentName-error"></span></label>
        <label class="enroll-field enroll-wide">School board<select name="board" required aria-describedby="trial-board-error"><option value="">Choose board</option>${rules.boards.map(board=>`<option value="${board}">${board==='CISCE'?'ICSE / ISC (CISCE)':board}</option>`).join('')}</select><span class="enroll-error" id="trial-board-error"></span></label>
        <label class="enroll-field enroll-wide">Parent / guardian contact number<input name="phone" type="tel" inputmode="tel" autocomplete="section-trial tel" maxlength="18" required aria-describedby="trial-phone-error"><span class="enroll-error" id="trial-phone-error"></span></label>
        <label class="enroll-field enroll-wide">Parent / guardian email<input name="email" type="email" autocomplete="section-trial email" maxlength="120" required aria-describedby="trial-email-error"><span class="enroll-error" id="trial-email-error"></span></label>
      </div><p class="trial-entry-note">Optional for the trial. These details only prefill the enrolment form on this page; they have not been sent.</p>
      <div class="trial-entry-actions"><button class="enroll-back" id="skipTrialDetails" type="button">Skip for now</button><button class="enroll-trigger" type="submit">Continue to trial →</button></div>
      <p class="enroll-status" id="trialEntryStatus" role="status" aria-live="polite"></p></form>
    </div>`;
    document.body.append(dialog);
    const form=dialog.querySelector('form'),keys=['studentName','board','phone','email'];
    const markSeen=()=>{seen=true;try{sessionStorage.setItem(SEEN,'true');}catch{}};
    function open(trigger) {
      if(document.querySelector('dialog[open]'))return false;
      returnFocus=trigger||document.activeElement;goToTrial=false;dialog.showModal();markSeen();
      dialog.querySelector('#trialEntryTitle').focus();return true;
    }
    function close(startTrial=false){goToTrial=startTrial;dialog.close();}
    dialog.querySelector('.enroll-close').addEventListener('click',()=>close());
    dialog.querySelector('#skipTrialDetails').addEventListener('click',()=>close(true));
    dialog.addEventListener('cancel',()=>{goToTrial=false;});
    dialog.addEventListener('close',()=>{
      if(goToTrial){trial.scrollIntoView({block:'start'});document.querySelector('#demoClass')?.focus({preventScroll:true});}
      else if(returnFocus?.isConnected&&returnFocus!==document.body)returnFocus.focus({preventScroll:true});
    });
    form.addEventListener('input',event=>{
      event.target.removeAttribute('aria-invalid');const message=dialog.querySelector('#trial-'+event.target.name+'-error');if(message)message.textContent='';
    });
    form.addEventListener('submit',event=>{
      event.preventDefault();const raw=Object.fromEntries(keys.map(key=>[key,form.elements.namedItem(key).value]));
      const {data,errors}=rules.validate({...raw,sameWhatsapp:true});let first;
      for(const key of keys){const input=form.elements.namedItem(key),error=errors[key]||'';dialog.querySelector('#trial-'+key+'-error').textContent=error;
        if(error){input.setAttribute('aria-invalid','true');first||=input;}else input.removeAttribute('aria-invalid');}
      if(first){first.focus();return;}
      window.IgniteEnrollment?.prefill(Object.fromEntries(keys.map(key=>[key,data[key]])));
      const board=data.board==='CISCE'?'ICSE':data.board;
      if(['CBSE','ICSE'].includes(board))window.IgniteBoard?.choose(board,undefined,{reloadPage:false});
      close(true);
    });
    window.addEventListener('ignite:trial-complete',event=>{
      if(postTrialShown)return;
      postTrialShown=true;
      window.IgniteEnrollment?.prefill({studentClass:String(event.detail?.classLevel||'')});
      if(dialog.open)dialog.close();
      window.IgniteEnrollment?.open(document.querySelector('#demoResultTitle'));
    });
    window.addEventListener('ignite:enrollment-saved',()=>form.reset());
    window.IgniteTrialEntry=Object.freeze({open});
    if(!seen&&!['#enroll','#login'].includes(location.hash)&&!new URLSearchParams(location.search).has('preview'))requestAnimationFrame(()=>open());
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
