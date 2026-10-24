import {MODES,total,challengeNumber} from './engine.js?v=8fbacc9628';
import {challengeReadingChoices} from './challenge-selection.js?v=39ce38f0ff';

const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function splitPermissions(s,seat,{role=null,connected=true,botPlayer=null,verdict=null,resigning=null,networkPaused=false,reviewMove=null}={}){
 const human=seat!==botPlayer&&(role===null||(connected&&role===seat)),live=s.started&&!s.ended&&!s.startCountdown&&!networkPaused&&reviewMove===null;
 return {
  canMove:human&&live&&!s.paused&&!verdict&&resigning===null&&s.turn===seat,
  canResign:human&&live&&!s.paused&&!verdict&&(s.turn===seat||botPlayer===s.turn),
  canQuit:human&&live&&s.turn===seat&&!!s.challengeAttempt&&(!s.paused||!!verdict?.retry),
  canPause:live&&!verdict&&(role===null||connected)
 };
}
export function splitPanelHTML(s,o){
 const {seat,display=s,tile,formatTime,action='single',digit=3,pending=[],ends=[],lineChoices=[],challengeAxis='row',readingReverse=null,rotation=0,factor='',verdict=null,resigning=null,reviewMove=null,historyOpen=false,inventoryOpen=false,panelOpen=false,lineLabel=line=>line.axis==='column'?'Column':'Row',result=''}=o;
 const permissions=splitPermissions(s,seat,o),{canMove,canResign,canQuit,canPause}=permissions,pile=display.piles[seat].slice();
 if(reviewMove===null&&s.turn===seat)for(const move of pending)pile[move.digit]--;
 const button=(command,label,disabled=false,extra='')=>`<button type="button" class="${command==='line'?'challenge-line':'outline-button'}" data-split-command="${command}" ${disabled?'disabled':''} ${extra}>${label}</button>`;
 const clocks=s.names.map((name,player)=>`<div class="split-clock-card ${!s.ended&&s.turn===player?'active':''}"><span>${escape(name)}</span><b class="split-clock" data-player="${player}">${display.clocks?formatTime(display.clocks[player]):'—'}</b></div>`).join('');
 const status=s.ended?(reviewMove!==null?'Review Game':'Game Over'):s.startCountdown?'Starting game':s.paused?(verdict?(verdict.retry?'Attempt Fails':verdict.success?'Challenge Success':'Challenge Failed'):'Game is Paused'):!s.started?'New game':s.turn===seat?(seat===o.botPlayer?'Bot’s turn':'Your turn'):'Their turn';
 const heading=`<header class="split-seat-heading"><div><span class="split-seat-label">PLAYER ${seat+1}</span><h2>${escape(s.names[seat])}</h2></div><span class="split-turn-status ${canMove?'active':''}">${status}</span><b class="split-clock split-phone-clock" data-player="${seat}">${display.clocks?formatTime(display.clocks[seat]):'—'}</b><button class="split-panel-toggle" data-split-command="panel" aria-expanded="${panelOpen}" aria-controls="split-body-${seat}" aria-label="${panelOpen?'Close':'Open'} controls for ${escape(s.names[seat])}">${panelOpen?'Close':'Moves'}<span aria-hidden="true">${panelOpen?'−':'+'}</span></button></header>`;
 const mode=MODES[s.mode],session=`<div class="split-session-tools">${button('new','New Game')}${button('pause',s.paused?'Resume':'Pause',!canPause)}${button('rules','How to Play')}</div>`;
 let controls='';
 if(s.ended){
  controls=`<div class="split-message"><h3>${reviewMove===null?escape(result):'Review Game'}</h3>${reviewMove!==null?`<p>${reviewMove===0?'Starting position':'After move '+reviewMove} · ${s.history.length} moves</p><div class="split-review-nav">${button('review-first','|←',reviewMove===0,'aria-label="Starting position"')}${button('review-previous','←',reviewMove===0,'aria-label="Previous move"')}${button('review-next','→',reviewMove===s.history.length,'aria-label="Next move"')}${button('review-last','→|',reviewMove===s.history.length,'aria-label="Final position"')}</div>${button('result','Game Result')}`:button('review','Review Game')}</div>`;
 }else if(verdict){
  controls=`<div class="split-message ${verdict.success?'':'failed'}" role="status"><h3>${verdict.retry?'Attempt Fails':verdict.success?'Challenge Success':'Challenge Failed'}</h3><p data-split-countdown></p>${verdict.retry&&s.turn===seat?button('quit','Quit Challenge',!canQuit):''}</div>`;
 }else if(s.paused&&s.started){
  controls=`<div class="split-message"><h3>Game is Paused</h3><div class="pause-actions">${button('pause','Resume',!canPause)}${button('new','New Game')}</div></div>`;
 }else if(resigning===seat){
  controls=`<div class="split-message"><h3>Are you sure you want to resign?</h3><p>${escape(s.names[1-seat])} will win the game.</p><div class="pause-actions">${button('cancel-resign','Keep playing')}${button('confirm-resign','Resign',!canResign)}</div></div>`;
 }else{
  const selected=s.turn===seat;
  controls=`<div class="split-move-heading"><h3>Your Move</h3><span>${selected?'':'Waiting for '+escape(s.names[s.turn])}</span></div><div class="action-tabs" role="group" aria-label="Choose move for ${escape(s.names[seat])}">${[['single','Single<br>Drop'],['double','Double<br>Down'],['challenge','Challenge']].map(([value,label])=>`<button class="action-tab ${selected&&action===value?'selected':''}" data-split-command="action" data-value="${value}" aria-pressed="${selected&&action===value}" ${!canMove||s.challengeAttempt?'disabled':''}><strong>${label}</strong></button>`).join('')}<button class="action-tab resign-option" data-split-command="resign" ${canResign?'':'disabled'}><strong>Resign</strong></button></div>`;
  if(selected&&action==='challenge'){
   let choices=[];try{choices=challengeReadingChoices(s,ends,(rotation+seat*2)%4);}catch{}
   const reading=choices[0],selectedReverse=s.challengeAttempt?.reverse??readingReverse;
   const readings=reading?`<div class="reading-options">${selectedReverse===null?'<p class="reading-prompt">Choose a reading direction.</p>':''}${choices.map(choice=>`<button type="button" class="reading-choice ${choice.reverse===selectedReverse?'selected':''}" data-split-command="reading" data-value="${choice.reverse}" aria-pressed="${choice.reverse===selectedReverse}" ${!canMove||s.challengeAttempt?'disabled':''}><strong>${escape(choice.digits)}</strong><small>${choice.label}</small></button>`).join('')}</div><div class="split-attempts">Attempt ${(s.challengeAttempt?.attempts.length||0)+1} of ${reading.attemptLimit}${s.challengeAttempt?button('quit','Quit Challenge',!canQuit):''}</div>`:'';
   controls+=`<div class="split-challenge">${lineChoices.length>1?`<div class="challenge-lines">${lineChoices.map(line=>button('line',`${lineLabel(line)}<span>${escape(challengeNumber(s,line.cells[0],line.cells.at(-1)).digits)}</span>`,!canMove,`data-value="${line.axis}" aria-pressed="${line.axis===challengeAxis}"`)).join('')}</div>`:''}${readings}<div class="rack-heading">YOUR PROPOSED FACTOR</div><div class="factor-display-row"><output class="factor-display ${factor?'':'empty'}" aria-label="Your proposed factor">${factor||'—'}</output>${button('delete','⌫',!canMove||!factor,'aria-label="Delete last factor digit"')}</div><div class="factor-keypad" role="group" aria-label="Factor digits">${Array.from({length:10},(_,d)=>`<button class="factor-digit" style="--tile-color:var(--digit-${d})" data-split-command="factor" data-value="${d}" aria-label="Factor digit ${d}" ${canMove?'':'disabled'}>${d}</button>`).join('')}</div></div>`;
  }else{
   controls+=`<div class="rack-heading"><span>YOUR TILES</span><span>${total(pile)} remaining</span></div><div class="tile-rack">${pile.map((count,d)=>`<button class="rack-button ${selected&&digit===d?'selected':''}" data-split-command="digit" data-value="${d}" aria-label="Digit ${d}, ${count} remaining" aria-pressed="${selected&&digit===d}" ${canMove&&count>0?'':'disabled'}>${tile(d)}<span class="tile-count">${count}</span></button>`).join('')}</div>`;
  }
  const ready=action==='challenge'?ends.length===2&&typeof(s.challengeAttempt?.reverse??readingReverse)==='boolean'&&!!factor:pending.length===(action==='double'?2:1);
  controls+=`<div class="move-buttons">${button('clear','↶',!canMove||!(pending.length||ends.length||factor.length),'aria-label="Clear unsubmitted move"')}<button class="primary-button" data-split-command="commit" ${canMove&&ready?'':'disabled'}>${action==='challenge'?(s.challengeAttempt?'Submit attempt':'Submit challenge'):action==='double'?'Place two tiles':'Place tile'} <span>↗</span></button></div>`;
 }
 const inventory=`<details class="split-inventory" ${inventoryOpen?'open':''}><summary>Your tile counts <span>${total(display.piles[seat])}</span></summary><div class="split-inventory-counts">${display.piles[seat].map((count,d)=>`<span class="supply-chip" style="--tile-color:var(--digit-${d})"><b>${d}</b><small>×${count}</small></span>`).join('')}</div></details>`;
 const history=s.history.map((entry,index)=>({entry,move:index+1})).reverse();
 const rows=(s.ended?history:history.slice(0,80)).map(({entry:e,move})=>{
  const description=e.action==='challenge'?`challenged ${e.digits}`:e.action==='double'?'Double Down':'Single Drop',detail=e.action==='challenge'?`${e.digits} ÷ ${e.factor} · ${e.quit?'quit':e.success?'success':'failed'}${e.attempts?.length>1?' · '+e.attempts.length+' attempts':''}${e.cleanup?.length?' · '+e.cleanup.length+' additional removed':''}`:e.moves.map(m=>`${m.digit} at ${String.fromCharCode(65+m.index%s.boardSize)}${Math.floor(m.index/s.boardSize)+1}`).join(' · ');
  const content=`<span class="history-index">${String(move).padStart(2,'0')}</span><span class="history-text"><b>${escape(s.names[e.player])}</b> ${escape(description)}<small>${escape(detail)}</small></span>`;
  return s.ended?`<li><button class="history-entry history-move" data-split-command="history" data-move="${move}" ${reviewMove===move?'aria-current="step"':''}>${content}</button></li>`:`<li class="history-entry">${content}</li>`;
 }).join('')+(s.ended?`<li><button class="history-entry history-move" data-split-command="history" data-move="0" ${reviewMove===0?'aria-current="step"':''}>Starting position</button></li>`:s.history.length?'':'<li class="history-empty">No moves yet.</li>');
 return `${heading}<div id="split-body-${seat}" class="split-panel-body" data-phone-open="${panelOpen}"><div class="split-mode-label">${s.mode.toUpperCase()} · ${mode[0]===null?'Unlimited':mode[0]/60+' + '+mode[1]}</div><div class="split-clocks">${clocks}</div>${session}<div class="split-controls">${controls}</div>${s.ended||s.paused||verdict||(s.turn===seat&&action==='challenge')?inventory:''}<details class="split-history" ${historyOpen?'open':''}><summary>Move history <span>${s.history.length} ${s.history.length===1?'move':'moves'}</span></summary><ol>${rows}</ol></details><p class="split-turn-note">${s.ended?escape(result):s.timeOutRule&&s.elapsed>=s.timeOutSeconds?'Tie-breaker streak: '+s.streak+'/10':'Turn '+(s.history.length+1)}</p></div>`;
}
