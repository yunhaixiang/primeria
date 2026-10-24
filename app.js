import {BOARD_SIZES,isSupportedBoardState,RULES_VERSION,upgradeGameBoard,MODES,PILE,total,newGame,timeOutSettings,tick,placement,adjacent,segment,challengeLines,challengeNumber,challenge,complete,beginChallengeReview,finishChallengeReview,challengeReviewSeconds,beginGameCountdown,finishGameCountdown} from './engine.js?v=0981ea2d5b';
import {BOT_LEVELS,botConfig,isBotTurn,createBot} from './bot.js?v=8a49f49262';

import {gameResult,reviewPosition} from './review.js?v=47d2587a64';

import {splitPanelHTML,splitPermissions} from './split-view.js?v=5d0f7be226';
import {pointedChallenge as resolveChallengePointer,challengeReadingChoices} from './challenge-selection.js?v=231cdb762c';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const modeName=s=>s[0].toUpperCase()+s.slice(1);
const colors=Array.from({length:10},(_,i)=>`var(--digit-${i})`);
const ONLINE_VERSION=2;
const key='primeria.game.rules15.v1';let state=newGame(),action='single',digit=3,pending=[],ends=[],lineChoices=[],challengeAxis='row',readingReverse=null,rotation=0,muted=false,expanded=null,factor='';
const phoneLayout=matchMedia('(max-width:600px), (max-width:1000px) and (max-height:500px)');
let boardZoom=false,splitLastTurn=null;const splitPhoneOpen=[false,false];
let splitView=false,splitPreference=false;const splitHistoryOpen=[false,false],splitInventoryOpen=[false,false];
let peer=null,connection=null,role=null,room=null,networkPaused=false,verdict=null,shownEnd=false,reviewMove=null,reviewSnapshot=null,resigning=null,toastTimer,audio,saveAt=0,syncAt=0,botWorker=null,botJob=null,botCounter=0;
try{
 for(const slot of [key,'primeria.game.rules14.v1','primeria.game.rules13.v1','primeria.game.rules12.v1','primeria.game.rules11.v1','primeria.game.rules10.v1','primeria.game.rules9.v1']){
  try{
   const saved=JSON.parse(localStorage.getItem(slot));
   if(![9,10,11,12,13,14,15].includes(saved?.version)||!MODES[saved.state?.mode]||saved.state.piles?.length!==2)continue;
   if(saved.state.bot&&!botConfig(saved.state))continue;
   const restored=upgradeGameBoard(saved.state);if(!isSupportedBoardState(restored))continue;Object.assign(restored,timeOutSettings(restored));
   state=restored;if(state.startCountdown&&!state.started&&!state.ended)beginGameCountdown(state);state.paused=state.started&&!state.ended;state.lastTick=Date.now();break;
  }catch{}
 }
 splitPreference=localStorage.getItem('primeria.splitView')==='true';
 muted=localStorage.getItem('primeria.muted')==='true';
}catch{}
function viewState(){return reviewSnapshot??state;}
function viewer(){return role??(botConfig(state)?0:viewState().turn);}
function boardSize(){return state.boardSize;}

function save(){if(role!==null)return;try{localStorage.setItem(key,JSON.stringify({version:RULES_VERSION,state}));}catch{}}
function sound(kind='click'){
 if(muted)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const now=audio.currentTime;
 const notes={click:[520],select:[650],place:[440,660],turn:[392,523],challenge:[330,440,660],fail:[260,196],win:[392,494,587,784]};
 (notes[kind]||notes.click).forEach((freq,i)=>{const osc=audio.createOscillator(),gain=audio.createGain();osc.type=kind==='place'?'sine':'triangle';osc.frequency.setValueAtTime(freq,now+i*.065);osc.frequency.exponentialRampToValueAtTime(freq*.82,now+i*.065+.13);gain.gain.setValueAtTime(0,now+i*.065);gain.gain.linearRampToValueAtTime(kind==='click'?.025:.055,now+i*.065+.007);gain.gain.exponentialRampToValueAtTime(.001,now+i*.065+.16);osc.connect(gain);gain.connect(audio.destination);osc.start(now+i*.065);osc.stop(now+i*.065+.18);});}catch{}
}
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4000);}
function ask(title,message,confirmLabel='Continue'){return new Promise(resolve=>{const d=$('#confirm-dialog');$('#confirm-title').textContent=title;$('#confirm-detail').textContent=message;$('#confirm-yes').innerHTML=`${escape(confirmLabel)} <span>↗</span>`;const finish=value=>{d.close();$('#confirm-yes').onclick=null;$('#confirm-no').onclick=null;d.oncancel=null;resolve(value);};$('#confirm-yes').onclick=()=>finish(true);$('#confirm-no').onclick=()=>finish(false);d.oncancel=e=>{e.preventDefault();finish(false);};d.showModal();});}
function tile(n){return `<span class="tile${n===6||n===9?' orientation-mark':''}" style="--tile-color:${colors[n]}" aria-hidden="true"><span class="tile-number north">${n}</span><span class="tile-number east">${n}</span><span class="tile-number south">${n}</span><span class="tile-number west">${n}</span></span>`;}
function columnLabel(x){return String.fromCharCode(65+x);}
function coords(index){return `${columnLabel(index%boardSize())}${Math.floor(index/boardSize())+1}`;}
function allowed(){return !state.startCountdown&&!isBotTurn(state)&&resigning===null&&!state.ended&&!state.paused&&state.started&&(role===null||(connection?.open&&state.turn===role));}
function resetDraft(){cancelBot();resigning=null;pending=[];ends=[];lineChoices=[];readingReverse=null;factor='';clearChallengeHover();}
function boardIndex(row,col){let x=col,y=row;for(let i=0;i<rotation;i++)[x,y]=[y,boardSize()-1-x];return y*boardSize()+x;}
function screenPosition(index){let x=index%boardSize(),y=Math.floor(index/boardSize());for(let i=0;i<rotation;i++)[x,y]=[boardSize()-1-y,x];return [x,y];}
function lineLabel(line){
 const a=screenPosition(line.cells[0]),b=screenPosition(line.cells.at(-1));
 return line.cells.length===1?'Single tile':a[0]===b[0]?'Column':'Row';
}
function pointedChallenge(index,event){
 let dx=null,dy=null;
 if(event){
  const rect=event.target.closest('[data-index]').getBoundingClientRect();
  dx=event.clientX-rect.left-rect.width/2;dy=event.clientY-rect.top-rect.height/2;
 }
 return resolveChallengePointer(state.board,index,{rotation,dx,dy});
}
function clearChallengeHover(){ $$('.cell.challenge-hover, .cell.challenge-ambiguous').forEach(c=>{c.classList.remove('challenge-hover','challenge-ambiguous');c.removeAttribute('aria-disabled');}); }
function previewChallenge(event){
 if(action!=='challenge'||!allowed()||event.pointerType==='touch')return clearChallengeHover();
 const cell=event.target.closest('[data-index]');
 if(!cell)return clearChallengeHover();
 const {line}=pointedChallenge(Number(cell.dataset.index),event.type==='focusin'?null:event),cells=new Set(line?.cells||[]);
 clearChallengeHover();
 if(!line&&state.board[Number(cell.dataset.index)]!==null){cell.classList.add('challenge-ambiguous');cell.setAttribute('aria-disabled','true');}
 $$('.cell').forEach(c=>c.classList.toggle('challenge-hover',cells.has(Number(c.dataset.index))));
}
function chooseChallenge(line,choices){
 if(!line)return;
 ends=[line.cells[0],line.cells.at(-1)];lineChoices=choices;challengeAxis=line.axis;readingReverse=line.cells.length===1?false:null;factor='';clearChallengeHover();sound('select');
}
function chooseReading(reverse){if(!allowed())return;readingReverse=reverse;factor='';sound('select');renderControls();}
function renderBoard(){
 if(state.ended&&reviewMove===null)boardZoom=false;
 const surround=$('.board-surround');surround.classList.toggle('board-zoomed',phoneLayout.matches&&boardZoom);
 $('#board-zoom-button').setAttribute('aria-pressed',String(boardZoom));$('#board-zoom-label').textContent=boardZoom?'Fit board':'Zoom board';$('#phone-board-size').textContent=`${boardSize()} × ${boardSize()}`;
 $('#board').style.setProperty('--board-size',boardSize());
 $('#board').setAttribute('aria-label',`Primeria board, columns A through ${columnLabel(boardSize()-1)}, rows 1 through ${boardSize()}`);
 const display=viewState(),preview=display.board.slice();pending.forEach(m=>preview[m.index]=m.digit);let selection=[];
 if(ends.length===2)try{selection=segment(state.board,...ends);}catch{}else selection=ends;
 let html='';
 for(let row=-1;row<=boardSize();row++)for(let col=-1;col<=boardSize();col++){
  if(row<0||row>=boardSize()||col<0||col>=boardSize()){let label='';if((row<0||row>=boardSize())&&(col<0||col>=boardSize()))label='✦';else if(row<0||row>=boardSize()){const i=boardIndex(row<0?0:boardSize()-1,col);label=rotation%2?Math.floor(i/boardSize())+1:columnLabel(i%boardSize());}else {const i=boardIndex(row,col<0?0:boardSize()-1);label=rotation%2?columnLabel(i%boardSize()):Math.floor(i/boardSize())+1;}
   html+=`<span class="axis ${label==='✦'?'corner':''} ${row<0||col===boardSize()?'opposite-axis':''}" aria-hidden="true">${label}</span>`;continue;
  }
  const index=boardIndex(row,col),n=preview[index],draft=pending.some(m=>m.index===index),selected=selection.includes(index),last=display.lastCells.includes(index);
  let legal=false;if(allowed()&&action!=='challenge'&&n===null&&pending.length<(action==='double'?2:1))try{placement(state,action,[...pending,{index,digit}],true);legal=true;}catch{}
  html+=`<button class="cell ${n===null?'empty':'occupied'} ${(row+col)%2?'alt':''} ${draft?'pending':''} ${selected?'challenge-selected':''} ${last?'last':''} ${legal?'legal':''}" data-index="${index}" aria-label="${coords(index)}, ${n===null?'empty':`digit ${n}`}${draft?', pending placement':''}${selected?', selected for challenge':''}" ${state.ended?'disabled':''}>${n===null?'':tile(n)}</button>`;
 }
 $('#board').innerHTML=html;$('.board-surround').classList.toggle('finished',!!state.ended&&reviewMove===null);
}
function formatTime(t){if(t===null)return '∞';const s=Math.ceil(t);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function renderClocks(){const clocks=viewState().clocks;for(let i=0;i<2;i++)for(const clock of $$(`#clock-${i}, .split-clock[data-player="${i}"]`)){clock.textContent=clocks?formatTime(clocks[i]):'—';clock.classList.toggle('low',!!clocks&&clocks[i]!==null&&clocks[i]<60);}}
function renderPlayers(){
 const display=viewState();
 $('#player-cards').innerHTML=state.names.map((name,i)=>`<div class="player-card ${state.turn===i&&!state.ended?'active':''} ${expanded===i?'expanded':''}" role="button" tabindex="0" data-player="${i}" aria-expanded="${expanded===i}" aria-label="${escape(name)}, ${total(display.piles[i])} tiles. Show tile counts"><span class="player-avatar">${i===0?'✳':'✧'}</span><div class="player-info"><div class="player-name">${escape(name)}${(role===i||(botConfig(state)&&i===0))&&name.toLowerCase()!=='you'?' · you':''}</div><div class="player-desc">${state.turn===i&&!state.ended?'<i class="turn-dot"></i>':''}${total(display.piles[i])} tiles ${state.turn===i&&!state.ended?'· '+(state.paused?'paused':state.started?'to play':'first move'):''}</div><div class="pile-peek">${display.piles[i].map((n,d)=>`<span style="--tile-color:${colors[d]}">${d} × ${n}</span>`).join('')}</div></div><span id="clock-${i}" class="player-time"></span></div>`).join('');renderClocks();
 if(role===null)$('#connection-status').innerHTML=`<i></i> ${botConfig(state)?'VS BOT · '+BOT_LEVELS[state.bot.strength].label.toUpperCase():'LOCAL GAME'}`;
 const mode=MODES[state.mode];$('#mode-label').textContent=`${modeName(state.mode).toUpperCase()} · ${mode[0]===null?'∞':`${mode[0]/60} + ${mode[1]}`}`;
 $('#move-owner').textContent=state.names[state.turn].toUpperCase();
 const opponent=1-viewer();$('#opponent-name').textContent=`${state.names[opponent].toUpperCase()}’S PILE`;
 $('#opponent-rack').innerHTML=display.piles[opponent].map((n,d)=>`<span class="supply-chip" style="--tile-color:${colors[d]}" aria-label="${escape(state.names[opponent])}: digit ${d}, ${n} remaining"><b>${d}</b><small>×${n}</small></span>`).join('');
}
function canQuickStart(){return role===null&&!state.started&&!state.ended&&!state.startCountdown&&!new URL(location.href).searchParams.has('room');}
function renderStartCountdown(){
 const countdown=state.startCountdown,visible=!!countdown&&!state.started&&!state.ended&&!networkPaused;
 const quickStart=canQuickStart();$('#quick-start').hidden=!quickStart;
 $('#start-countdown').hidden=!visible;$('#board').inert=quickStart||visible||(!!state.ended&&reviewMove===null);
 if(visible){
  const seconds=challengeReviewSeconds(countdown),message=`Game Starts in ${seconds} ${seconds===1?'Second':'Seconds'}`;
  for(const text of [$('#start-countdown-text'),$('#split-start-countdown-text')])if(text.textContent!==message)text.textContent=message;
 }
}
function splitViewAvailable(){return role===null&&!botConfig(state);}
function splitContext(seat){return {seat,display:viewState(),tile,formatTime,action,digit,pending,ends,lineChoices,challengeAxis,readingReverse,rotation,factor,verdict,resigning,reviewMove,panelOpen:splitPhoneOpen[seat],historyOpen:splitHistoryOpen[seat],inventoryOpen:splitInventoryOpen[seat],lineLabel,result:gameResult(state),role,connected:!!connection?.open,botPlayer:botConfig(state)?.player??null,networkPaused};}
function orientDialogs(seat=0){$$('dialog').forEach(d=>d.classList.toggle('opposite-dialog',splitView&&seat===1));}
function renderSplitPanels(){
 if(splitLastTurn!==null&&splitLastTurn!==state.turn&&!verdict)splitPhoneOpen[splitLastTurn]=false;splitLastTurn=state.turn;
 document.body.classList.toggle('phone-layout',phoneLayout.matches);
 document.body.classList.toggle('split-view',splitView);$('#split-button').setAttribute('aria-pressed',String(splitView));
 for(let seat=0;seat<2;seat++){
  const panel=$('#split-panel-'+seat);panel.hidden=!splitView;if(!splitView)continue;
  const scroll=panel.scrollTop,bodyScroll=panel.querySelector('.split-panel-body')?.scrollTop||0,historyScroll=panel.querySelector('.split-history ol')?.scrollTop||0,focused=panel.contains(document.activeElement)?document.activeElement:null,command=focused?.dataset.splitCommand,value=focused?.dataset.value,move=focused?.dataset.move;
  panel.innerHTML=splitPanelHTML(state,splitContext(seat));panel.scrollTop=scroll;panel.querySelector('.split-panel-body').scrollTop=bodyScroll;
  panel.querySelector('.split-history ol').scrollTop=historyScroll;
  if(command){const selector=`[data-split-command="${command}"]${value===undefined?'':`[data-value="${value}"]`}${move===undefined?'':`[data-move="${move}"]`}`,replacement=panel.querySelector(selector);if(replacement&&!replacement.disabled)replacement.focus({preventScroll:true});}
 }
 renderClocks();renderVerdict();
}
function renderControls(){
 const canSplit=splitViewAvailable();splitView=canSplit&&splitPreference;$('#split-button').hidden=!canSplit;$('#split-button').disabled=!canSplit;if(!canSplit)orientDialogs();
 renderStartCountdown();renderGameEnd();
 const paused=state.started&&state.paused&&!state.ended&&!verdict;
 if(paused)resigning=null;
 const thinking=isBotTurn(state)&&state.started&&!state.paused&&!state.ended&&!verdict&&resigning===null;
 $('#bot-thinking').hidden=!thinking;
 if(botConfig(state))$('#bot-thinking-level').textContent=BOT_LEVELS[state.bot.strength].label;
 $('#pause-panel').hidden=!paused;$('.move-panel > .section-heading').hidden=paused||thinking||!!state.ended;
 if(resigning!==null&&(!state.started||state.ended||(role!==null&&!connection?.open)||(role===null&&!botConfig(state)&&state.turn!==resigning)))resigning=null;
 $('#resign-confirmation').hidden=resigning===null;
 if(resigning!==null)$('#resign-detail').textContent=`${state.names[1-resigning]} will win the game.`;
 $('#move-options').hidden=paused||thinking||!!verdict||resigning!==null||!!state.ended;renderVerdict();
 const pile=state.piles[viewer()].slice();pending.forEach(m=>pile[m.digit]--);
 $('.move-panel > .section-heading h2').textContent=state.turn!==viewer()?'Their move':'Your move';
 $('#rack').innerHTML=pile.map((n,d)=>`<button class="rack-button ${digit===d?'selected':''}" data-digit="${d}" aria-label="Digit ${d}, ${n} remaining" aria-pressed="${digit===d}" ${n===0?'disabled':''}>${tile(d)}<span class="tile-count">${n}</span></button>`).join('');
 $('#rack-count').textContent=`${total(pile)} remaining`;
 $$('.action-tab[data-action]').forEach(b=>{b.disabled=!!isBotTurn(state);b.classList.toggle('selected',b.dataset.action===action);b.setAttribute('aria-pressed',b.dataset.action===action);});
 $('#placement-controls').hidden=action==='challenge';$('#challenge-controls').hidden=action!=='challenge';
 $('#undo-button').disabled=!(pending.length||ends.length||factor.length);
 $('#factor').textContent=factor||'—';$('#factor').classList.toggle('empty',!factor);$('#factor-backspace').disabled=!factor;
 if(action==='challenge'){
  $('#challenge-lines').hidden=lineChoices.length<2;
  $('#challenge-lines').innerHTML=lineChoices.length<2?'':lineChoices.map(line=>`<button class="challenge-line ${line.axis===challengeAxis?'selected':''}" data-challenge-line="${line.axis}" aria-pressed="${line.axis===challengeAxis}" aria-label="Select ${lineLabel(line).toLowerCase()} ${challengeNumber(state,line.cells[0],line.cells.at(-1)).digits}">${lineLabel(line)}<span>${challengeNumber(state,line.cells[0],line.cells.at(-1)).digits}</span></button>`).join('');
  let html='';
  if(ends.length===2)try{
   const choices=challengeReadingChoices(state,ends,rotation);
   html=choices.map(choice=>`<button type="button" class="reading-choice ${choice.reverse===readingReverse?'selected':''}" data-reading-reverse="${choice.reverse}" aria-pressed="${choice.reverse===readingReverse}" ${!allowed()?'disabled':''}><strong>${choice.digits}</strong><small>${choice.label}</small></button>`).join('');
   if(readingReverse===null)html='<p class="reading-prompt">Choose a reading direction.</p>'+html;
  }catch{}
  $('#reading-options').innerHTML=html;
 }
 const ready=action==='challenge'?ends.length===2&&typeof readingReverse==='boolean'&&factor.length>0:pending.length===(action==='double'?2:1);
 const button=$('#commit-button');button.innerHTML=`${action==='challenge'?'Submit challenge':action==='double'?'Place two tiles':'Place tile'} <span>↗</span>`;
 button.disabled=!allowed()||!ready;
 $('#phone-commit-button').hidden=!splitView||!ready||!allowed();$('#phone-commit-button').textContent=action==='challenge'?'Submit factor':action==='double'?'Place two tiles':'Place tile';
 $('#start-button').hidden=!state.started||!!state.ended;
 $('#start-button .start-label').textContent=state.paused?'Resume':'Pause';$('#start-icon').innerHTML=state.ended?'<rect x="5" y="5" width="14" height="14" rx="1"/>':state.started&&!state.paused?'<path d="M8 4v16M16 4v16"/>':'<path d="m8 4 12 8-12 8Z"/>';$('#start-button').classList.toggle('paused',state.paused);
 $('#start-button').disabled=!state.started||!!state.ended||!!verdict||(role!==null&&!connection?.open);
 $('#pause-resume').disabled=$('#start-button').disabled;
 $('#resign-button').disabled=!state.started||!!state.ended||(role!==null&&!connection?.open);
 $('#new-button').disabled=false;
 $('#board-note').textContent=reviewMove!==null?`Review · ${reviewMove===0?'Starting position':`After move ${reviewMove}`} of ${state.history.length}`:state.ended?gameResult(state):state.started?`${state.names[state.turn]==='You'?'Your turn':state.names[state.turn]+' to play'}${state.paused?' · paused':''}${state.timeOutRule&&state.elapsed>=state.timeOutSeconds?` · Tie-breaker streak: ${state.streak}/${state.timeOutMoves}`:''}.`:networkPaused?'Connection lost.':state.startCountdown?'Starting game…':role!==null?'Waiting for your opponent.':`Quick Start · ${modeName(state.mode)} · ${boardSize()} × ${boardSize()}.`;
 $('#turn-count').textContent=reviewMove!==null?`MOVE ${String(reviewMove).padStart(2,'0')}`:`TURN ${String(state.history.length+1).padStart(2,'0')}`;
 renderSplitPanels();
}
function renderHistory(){
 $('#history-count').textContent=`${state.history.length} ${state.history.length===1?'MOVE':'MOVES'}`;
 const entries=state.history.map((entry,index)=>({entry,move:index+1})).reverse();
 $('#history').innerHTML=(state.ended?entries:entries.slice(0,80)).map(({entry:e,move})=>{
  const content=`<span class="history-index">${String(move).padStart(2,'0')}</span><span class="history-text"><b>${escape(state.names[e.player])}</b> ${e.action==='challenge'?`challenged ${e.digits}`:e.action==='double'?'doubled down':'dropped a tile'}<small>${e.action==='challenge'?`${e.digits} ÷ ${e.factor} · ${e.quit?'quit':e.success?(e.taxedDigits?`${e.transferredCount} transferred · ${e.taxedDigits.join(', ')} taxed`:e.taxedDigit===undefined?'tiles transferred':`${e.transferredCount} transferred · ${e.taxedDigit} taxed`):'not a factor'}${e.cleanup?.length?' · '+e.cleanup.length+' additional '+(e.cleanup.length===1?'tile':'tiles')+' removed':''}${e.attempts?.length>1?' · '+e.attempts.length+' attempts':''}`:e.moves.map(m=>`${m.digit} at ${coords(m.index)}`).join(' · ')}</small></span><span class="history-badge">${e.action==='challenge'?(e.success?'✓':'×'):e.action==='double'?'+2':'+1'}</span>`;
  return state.ended?`<li><button class="history-entry history-move" data-review-move="${move}" aria-label="Review move ${move}: ${escape(state.names[e.player])}, ${e.action==='challenge'?'challenge':e.action==='double'?'Double Down':'Single Drop'}" ${reviewMove===move?'aria-current="step"':''}>${content}</button></li>`:`<li class="history-entry">${content}</li>`;
 }).join('')+(state.ended?`<li><button class="history-entry history-move" data-review-move="0" ${reviewMove===0?'aria-current="step"':''}><span class="history-index">00</span><span class="history-text">Starting position</span></button></li>`:state.history.length?'':'<li class="history-empty">No moves yet.</li>');
 $('.history-panel').classList.toggle('reviewing',!!state.ended);
}
function renderGameEnd(){
 const ended=!!state.ended,reviewing=reviewMove!==null;
 $('#game-end').hidden=!ended||reviewing;
 $('#game-end-title').textContent=gameResult(state);$('[data-split-result-title]').textContent=gameResult(state);
 $('.move-panel').hidden=ended&&!reviewing;
 $('#game-review-panel').hidden=!ended||!reviewing;
 $('#game-review-title').textContent='Review Game';
 $('#game-review-detail').textContent=reviewing?`${reviewMove===0?'Starting position':'After move '+reviewMove} · ${state.history.length} ${state.history.length===1?'move':'moves'}`:gameResult(state);
 $('#review-navigation').hidden=!reviewing;
 $('#review-result').hidden=!reviewing;
 $('#review-first').disabled=$('#review-previous').disabled=reviewMove===0;
 $('#review-next').disabled=$('#review-last').disabled=reviewMove===state.history.length;
}
function selectReview(move,focusHistory=false){
 if(!state.ended)return;
 try{reviewSnapshot=reviewPosition(state,move);reviewMove=move;resetDraft();sound('select');render();
  const selected=$(`#history [data-review-move="${move}"]`),list=$('#history');
  if(selected){const item=selected.getBoundingClientRect(),bounds=list.getBoundingClientRect();if(item.top<bounds.top)list.scrollTop+=item.top-bounds.top;else if(item.bottom>bounds.bottom)list.scrollTop+=item.bottom-bounds.bottom;if(focusHistory)selected.focus({preventScroll:true});}
 }catch(err){toast(err.message);}
}
function closeReview(){reviewMove=null;reviewSnapshot=null;render();$('#end-review').focus();}
function render(){const display=viewState(),taxed=total(display.taxed);$('#taxed-count').textContent=`${taxed} ${taxed===1?'tile':'tiles'} out of play`;$('#taxed-count').title=display.taxed.map((n,d)=>`${d}: ${n}`).join(' · ');$('#taxed-count').hidden=taxed===0;renderBoard();renderPlayers();renderControls();renderHistory();$('#sound-button .sound-label').textContent=muted?'Unmute':'Mute';$('#sound-icon-detail').innerHTML=muted?'<path d="m16 9 6 6m0-6-6 6"/>':'<path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>';$('#sound-button').setAttribute('aria-label',muted?'Unmute':'Mute');$('#sound-button').setAttribute('title',muted?'Unmute sound':'Mute sound');$('#sound-button').setAttribute('aria-pressed',String(muted));if(state.ended&&!shownEnd)showEnd();}
function showEnd(){shownEnd=true;sound('win');$('#end-review').focus({preventScroll:true});}
function renderVerdict(){
 const panel=$('#challenge-review');panel.hidden=!verdict;
 if(!verdict)return;
 panel.classList.toggle('failed',!verdict.success);
 $('#challenge-review-title').textContent=verdict.success?'Challenge Success':'Challenge Failed';
 const seconds=challengeReviewSeconds(verdict);
 const message=`Moving to next turn in ${seconds} ${seconds===1?'second':'seconds'}`;
 for(const text of [$('#challenge-countdown'),...$$('[data-split-countdown]')])if(text.textContent!==message)text.textContent=message;
}
function showVerdict(review){verdict=review;if(phoneLayout.matches)splitPhoneOpen[review.player]=true;sound(review.success?'challenge':'fail');}
function sendState(extra={}){if(role===0&&connection?.open)connection.send({type:'state',rulesVersion:RULES_VERSION,onlineVersion:ONLINE_VERSION,state,startMs:state.startCountdown?Math.max(0,state.startCountdown.resumeAt-Date.now()):0,verdict,verdictMs:verdict?Math.max(0,verdict.resumeAt-Date.now()):0,...extra});}
function applyCommand(command,actor=viewer()){
 tick(state);
 if(command.type==='start'){
  if(state.ended)throw Error('Start a new game to play again.');
  if(verdict)throw Error('The next turn begins after the countdown.');
  if(!state.started)throw Error('The game starts automatically after the countdown.');
  state.paused=!state.paused;
  state.lastTick=Date.now();state.revision++;sound('turn');
 }else if(command.type==='resign'){
  if(!state.started||state.ended)throw Error('There is no active game to resign.');state.ended={winner:1-actor,reason:'by resignation'};state.challengeAttempt=null;verdict=null;state.revision++;
 }else if(command.type==='move'){
  if(actor!==state.turn)throw Error('Wait for your turn.');if(verdict)throw Error('Wait for the countdown.');
  const entry=complete(state,command.move);if(entry.action==='challenge'&&!state.ended)showVerdict(beginChallengeReview(state,entry));else sound('turn');
 }
 resetDraft();save();sendState();render();
}
function dispatch(command){
 if(role!==null&&!connection?.open)return toast('Your friend must be connected first.');
 try{if(role===1){connection.send({type:'command',command,revision:state.revision});return;}applyCommand(command);}catch(e){toast(e.message);renderControls();}
}
$('#board').addEventListener('click',e=>{
 const cell=e.target.closest('[data-index]');if(!cell)return;if(!allowed())return toast(state.paused?'Resume the game first.':!state.started?'The game has not started yet.':'Wait for your turn.');const index=Number(cell.dataset.index);
 if(action==='challenge'){
  if(state.board[index]===null)return toast('Select a tile on the board.');
  const {line,choices}=pointedChallenge(index,e.detail?e:null);
  if(!line){clearChallengeHover();return toast('Point toward the row or column side of the intersection, or select another tile in the number.');}
  chooseChallenge(line,choices);
 }else{
  const existing=pending.findIndex(m=>m.index===index);if(existing>=0){pending=pending.slice(0,existing);render();return;}
  if(pending.length===(action==='double'?2:1))return toast('Commit your move, or clear it to choose again.');
  const next=[...pending,{index,digit}];try{placement(state,action,next,true);}catch(err){return toast(err.message);}pending=next;sound('place');
 }
 renderBoard();renderControls();
});
$('#board').addEventListener('pointermove',previewChallenge);
$('#board').addEventListener('pointerleave',clearChallengeHover);
$('#board').addEventListener('focusin',previewChallenge);
$('#board').addEventListener('focusout',clearChallengeHover);
$('#challenge-lines').addEventListener('click',e=>{
 const button=e.target.closest('[data-challenge-line]');if(!button||!allowed())return;
 const line=lineChoices.find(c=>c.axis===button.dataset.challengeLine);if(!line||line.axis===challengeAxis)return;
 chooseChallenge(line,lineChoices);renderBoard();renderControls();
});
$('#reading-options').addEventListener('click',e=>{const button=e.target.closest('[data-reading-reverse]');if(button&&!button.disabled)chooseReading(button.dataset.readingReverse==='true');});
$('#rack').addEventListener('click',e=>{const b=e.target.closest('[data-digit]');if(!b)return;digit=Number(b.dataset.digit);sound('select');renderControls();renderBoard();});
$$('.action-tab[data-action]').forEach(b=>b.addEventListener('click',()=>{action=b.dataset.action;resetDraft();sound();renderBoard();renderControls();}));
function appendFactor(value){if(factor.length>=20)return toast('A factor can have up to 20 digits.');factor+=value;sound('select');renderControls();}
function deleteFactorDigit(){factor=factor.slice(0,-1);sound();renderControls();}
$('#factor-keypad').innerHTML=colors.map((color,d)=>`<button class="factor-digit" data-factor-digit="${d}" style="--tile-color:${color}" aria-label="Factor digit ${d}">${d}</button>`).join('');
$('#factor-keypad').addEventListener('click',e=>{const button=e.target.closest('[data-factor-digit]');if(button)appendFactor(button.dataset.factorDigit);});
$('#factor-backspace').addEventListener('click',deleteFactorDigit);
$('#undo-button').addEventListener('click',()=>{resetDraft();sound();render();});
function commitMove(){
 if(!allowed())return;
 if(action==='challenge'){if(typeof readingReverse!=='boolean')return toast('Choose a reading direction.');try{challenge(state,ends[0],ends[1],factor,readingReverse);}catch(err){return toast(err.message);}}
 dispatch({type:'move',move:action==='challenge'?{action,a:ends[0],b:ends[1],reverse:readingReverse,factor:factor}:{action,moves:pending.slice()}});
}
$('#commit-button').addEventListener('click',commitMove);
$('#rules-button').addEventListener('click',()=>{orientDialogs();sound();$('#rules-dialog').showModal();});
$('#rotate-button').addEventListener('click',()=>{rotation=(rotation+1)%4;sound();renderBoard();renderControls();toast(`Board rotated ${rotation*90}°. Coordinates stay with their squares.`);});
$('#sound-button').addEventListener('click',()=>{muted=!muted;try{localStorage.setItem('primeria.muted',muted);}catch{}sound();render();});
$$('[data-quick-start]').forEach(button=>button.addEventListener('click',()=>{
 if(!canQuickStart())return;
 beginGameCountdown(state);resetDraft();save();render();sound('turn');
}));
$('#start-button').addEventListener('click',()=>dispatch({type:'start'}));
$('#pause-resume').addEventListener('click',()=>{if(state.started&&state.paused&&!state.ended&&!verdict)dispatch({type:'start'});});
$('#pause-new-game').addEventListener('click',openSetup);
$('#bot-pause').addEventListener('click',()=>{if(isBotTurn(state)&&state.started&&!state.paused&&!verdict)dispatch({type:'start'});});
$('#bot-resign').addEventListener('click',()=>$('#resign-button').click());
for(const id of ['end-new-game','review-new-game'])$('#'+id).addEventListener('click',openSetup);
for(const id of ['end-review'])$('#'+id).addEventListener('click',()=>{selectReview(state.history.length);$('#review-result').focus({preventScroll:true});});
$('#review-result').addEventListener('click',closeReview);
$('#history').addEventListener('click',e=>{const button=e.target.closest('[data-review-move]');if(button)selectReview(Number(button.dataset.reviewMove),true);});
for(const [id,move] of [['review-first',()=>0],['review-previous',()=>Math.max(0,reviewMove-1)],['review-next',()=>Math.min(state.history.length,reviewMove+1)],['review-last',()=>state.history.length]])$('#'+id).addEventListener('click',()=>selectReview(move()));
function cancelResignation(){resigning=null;sound();renderControls();$(isBotTurn(state)?'#bot-resign':'#resign-button').focus();}
$('#resign-button').addEventListener('click',()=>{
 if($('#resign-button').disabled)return;
 resigning=viewer();clearChallengeHover();sound();renderControls();$('#resign-cancel').focus();
});
$('#resign-cancel').addEventListener('click',cancelResignation);
$('#resign-confirm').addEventListener('click',()=>{if(resigning===null)return;resigning=null;sound();dispatch({type:'resign'});});
phoneLayout.addEventListener('change',()=>{render();});
$('#phone-commit-button').addEventListener('click',commitMove);
$('#board-zoom-button').addEventListener('click',()=>{
 boardZoom=!boardZoom;sound();renderBoard();const surround=$('.board-surround');
 if(!boardZoom){surround.scrollTop=0;surround.scrollLeft=0;return;}
 const index=pending.at(-1)?.index??ends[0]??viewState().lastCells.at(-1),cell=index===undefined?null:$(`#board [data-index="${index}"]`);
 if(cell){const tileRect=cell.getBoundingClientRect(),bounds=surround.getBoundingClientRect();surround.scrollLeft+=tileRect.left-bounds.left-(surround.clientWidth-tileRect.width)/2;surround.scrollTop+=tileRect.top-bounds.top-(surround.clientHeight-tileRect.height)/2;}
 else{surround.scrollLeft=(surround.scrollWidth-surround.clientWidth)/2;surround.scrollTop=(surround.scrollHeight-surround.clientHeight)/2;}
});
$('#split-button').addEventListener('click',()=>{if(!splitViewAvailable())return;splitPreference=!splitView;splitView=splitPreference;try{localStorage.setItem('primeria.splitView',String(splitPreference));}catch{}orientDialogs();sound();render();});
for(const panel of $$('.split-player-panel')){
 panel.addEventListener('toggle',e=>{const seat=Number(panel.dataset.seat);if(e.target.matches('.split-history'))splitHistoryOpen[seat]=e.target.open;if(e.target.matches('.split-inventory'))splitInventoryOpen[seat]=e.target.open;},true);
 panel.addEventListener('click',e=>{
  const button=e.target.closest('[data-split-command]');if(!button||button.disabled||!splitView)return;
  const seat=Number(panel.dataset.seat),command=button.dataset.splitCommand,permissions=splitPermissions(state,seat,splitContext(seat));
  if(command==='panel'){splitPhoneOpen[seat]=!splitPhoneOpen[seat];if(splitPhoneOpen[seat])splitPhoneOpen[1-seat]=false;sound();renderControls();panel.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:splitPhoneOpen[seat]?(seat===1?'start':'end'):'nearest'});return;}
  if(command==='new')return openSetup(seat);
  if(command==='rules'){orientDialogs(seat);sound();$('#rules-dialog').showModal();return;}
  if(command==='pause'){if(permissions.canPause)dispatch({type:'start'});return;}
  if(command==='review')return selectReview(state.history.length);
  if(command==='result')return closeReview();
  if(command==='history')return selectReview(Number(button.dataset.move));
  const reviewTargets={'review-first':0,'review-previous':Math.max(0,reviewMove-1),'review-next':Math.min(state.history.length,reviewMove+1),'review-last':state.history.length};
  if(Object.hasOwn(reviewTargets,command))return selectReview(reviewTargets[command]);
  if(command==='resign'){if(permissions.canResign){resigning=seat;clearChallengeHover();sound();renderControls();}return;}
  if(command==='cancel-resign'){if(resigning===seat){resigning=null;sound();renderControls();}return;}
  if(command==='confirm-resign'){if(resigning===seat&&permissions.canResign){resigning=null;sound();dispatch({type:'resign'});}return;}
  if(!permissions.canMove)return;
  if(command==='action'){action=button.dataset.value;resetDraft();sound();renderBoard();renderControls();}
  if(command==='digit'){digit=Number(button.dataset.value);sound('select');renderControls();renderBoard();}
  if(command==='line'){const line=lineChoices.find(l=>l.axis===button.dataset.value);if(line){chooseChallenge(line,lineChoices);renderBoard();renderControls();}}
  if(command==='reading')chooseReading(button.dataset.value==='true');
  if(command==='factor')appendFactor(button.dataset.value);
  if(command==='delete')deleteFactorDigit();
  if(command==='clear'){resetDraft();sound();render();}
  if(command==='commit')commitMove();
 });
}
$$('[data-split-global]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.splitGlobal==='new')openSetup(1);else selectReview(state.history.length);}));
function updateTimeOutOptions(){const enabled=$('#time-out-rule').checked;$('#time-out-options').hidden=!enabled;$('#time-out-options').disabled=!enabled;$('#time-out-rule').setAttribute('aria-expanded',String(enabled));}
$('#time-out-rule').addEventListener('change',updateTimeOutOptions);
function updateSetupOptions(){
 const form=$('#setup-form'),online=form.elements.location.value==='online',withBot=form.elements.location.value==='bot',joining=online&&role===null&&form.elements.roomAction.value==='join';
 $('#bot-options').hidden=!withBot;$('#bot-options').disabled=!withBot;
 const strength=form.elements.botStrength.value,level=BOT_LEVELS[strength];
 $('#bot-description').textContent=level.description;
 if(withBot){
  if(!form.elements.two.readOnly&&!/^Bot \(/.test(form.elements.two.value))form.elements.two.dataset.localName=form.elements.two.value;
  if(form.elements.one.value==='Player one')form.elements.one.value='You';
  form.elements.two.value=`Bot (${level.label})`;
 }else if(form.elements.two.readOnly){form.elements.two.value=form.elements.two.dataset.localName||'Player two';if(form.elements.one.value==='You')form.elements.one.value='Player one';}
 form.elements.two.readOnly=withBot;
 $('#player-one-label').textContent=withBot?'You':'Player one';$('#player-two-label').textContent=withBot?'Bot':'Player two';
 form.elements.first.querySelector('[value="0"]').textContent=withBot?'You':'Player one';form.elements.first.querySelector('[value="1"]').textContent=withBot?'Bot':'Player two';
 $('#online-options').hidden=!online;
 $('#room-choice').hidden=role!==null;
 $('#room-choice').disabled=!online||role!==null;
 $('#join-options').hidden=!joining;
 $('#room-code').disabled=!joining;$('#room-code').required=joining;
 const settings=!(joining||(online&&role===1));
 $('#game-settings').hidden=!settings;$('#game-settings').disabled=!settings;
 $('#setup-submit').hidden=online&&role===1;
 $('#setup-submit').innerHTML=`${!online?'Create game':role===0?'Start a new game':joining?'Join game':'Create a room'} <span>↗</span>`;
 $('#leave-button').hidden=role===null;
 $('#online-note').textContent=role===1?'You are player two. The host chooses the settings and starts new games.':role===0?'You are player one. New games stay in this room with your friend. Keep this tab open.':'Share an invitation link with your friend. Keep the host’s tab open while playing. Some networks may prevent a connection.';
 $('#setup-warning').textContent=online&&role===1?'To play on one device, select that option above.':!online&&role!==null?'Starting this game leaves your online room.':joining?'Your friend’s game settings will be used.':'New games replace the current game.';
 updateTimeOutOptions();
}
function openSetup(seat=0){
 orientDialogs(Number.isInteger(seat)?seat:0);
 const form=$('#setup-form');form.elements.two.readOnly=false;form.elements.two.dataset.localName=botConfig(state)?'Player two':state.names[1];form.elements.one.value=state.names[0];form.elements.two.value=state.names[1];form.elements.mode.value=state.mode==='casual'?'rapid':state.mode;form.elements.first.value='random';form.elements.boardSize.value=String(boardSize());
 form.elements.timeOutRule.checked=state.timeOutRule;form.elements.timeOutMinutes.value=state.timeOutSeconds/60;
 form.elements.location.value=role===null?(botConfig(state)?'bot':'local'):'online';form.elements.botStrength.value=botConfig(state)?.strength||'intermediate';updateSetupOptions();$('#setup-dialog').showModal();$('#setup-dialog').scrollTop=0;sound();
}
$$('input[name="location"],input[name="roomAction"],input[name="botStrength"]').forEach(input=>input.addEventListener('change',()=>{updateSetupOptions();sound('select');}));
$('#new-button').addEventListener('click',openSetup);
$('#setup-form').addEventListener('submit',async e=>{
 e.preventDefault();const data=new FormData(e.target),online=data.get('location')==='online',withBot=data.get('location')==='bot',joining=online&&role===null&&data.get('roomAction')==='join';
 if(online&&role===1)return;
 let code=null,next;
 if(joining){
  code=String(data.get('roomCode')||'').trim();try{if(/^https?:/i.test(code))code=new URL(code).searchParams.get('room')||'';}catch{}
  if(!/^primeria-[a-f0-9]{14}$/.test(code)){toast('Paste a complete invitation link or room code.');$('#room-code').focus();return;}
 }else{
  const enabled=data.has('timeOutRule');
  try{next=newGame({boardSize:Number(data.get('boardSize')),mode:data.get('mode'),names:[data.get('one'),data.get('two')],first:data.get('first')==='random'?(crypto.getRandomValues(new Uint8Array(1))[0]%2):Number(data.get('first')),timeOutRule:enabled,timeOutSeconds:enabled?Number(data.get('timeOutMinutes'))*60:state.timeOutSeconds});}catch(err){return toast(err.message);}
 }
 if(withBot){const strength=data.get('botStrength');if(!Object.hasOwn(BOT_LEVELS,strength))return toast('Choose a bot strength.');next.bot={player:1,strength,id:crypto.randomUUID(),seed:crypto.getRandomValues(new Uint32Array(1))[0]};}
 if(online&&role===null&&!window.Peer){roomStatus('The online connection library is unavailable. Reload this page, or play on one device.');return;}
 if(((state.started||state.startCountdown)&&!state.ended)||(!online&&role!==null)){
  if(!await ask('Start a new game?',!online&&role!==null?'Leave your online room and start a new game on this device?':'Replace the current game? This starts a new game.'))return;
 }
 if(!online&&role!==null)leaveRoom();
 if(online&&role===null){connectRoom(code,next);return;}
 boardZoom=false;state=next;if(role===null||connection?.open)beginGameCountdown(state);rotation=0;shownEnd=false;reviewMove=null;reviewSnapshot=null;verdict=null;action='single';resetDraft();$('#setup-dialog').close();save();sendState({fresh:true});render();sound('turn');
});
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
$('#player-cards').addEventListener('click',e=>{const card=e.target.closest('[data-player]');if(!card)return;expanded=expanded===Number(card.dataset.player)?null:Number(card.dataset.player);renderPlayers();});
$('#player-cards').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.target.closest('[data-player]')?.click();}});
document.addEventListener('keydown',e=>{if(reviewMove!==null&&!$('dialog[open]')&&!e.target.matches('input,select')){const moves={ArrowLeft:Math.max(0,reviewMove-1),ArrowRight:Math.min(state.history.length,reviewMove+1),Home:0,End:state.history.length};if(Object.hasOwn(moves,e.key)){e.preventDefault();selectReview(moves[e.key]);}return;}if(state.ended)return;if(e.target.matches('input,select')||$('dialog[open]')||state.startCountdown||(state.started&&state.paused&&!verdict))return;if(resigning!==null){if(e.key==='Escape'){e.preventDefault();cancelResignation();}return;}if(isBotTurn(state))return;if(/^\d$/.test(e.key)){e.preventDefault();if(action==='challenge')appendFactor(e.key);else{digit=Number(e.key);renderControls();sound('select');}}if(action==='challenge'&&e.key==='Backspace'){e.preventDefault();deleteFactorDigit();}if(e.key==='Escape'){resetDraft();render();}});

function roomStatus(message){$('#room-info').textContent=message;}
function leaveRoom(){
 const oldConnection=connection,oldPeer=peer;
 connection=null;peer=null;role=null;room=null;networkPaused=false;verdict=null;
 oldConnection?.close();oldPeer?.destroy();
 if(state.startCountdown&&!state.started&&!state.ended)beginGameCountdown(state);
 state.paused=state.started&&!state.ended;state.lastTick=Date.now();$('#connection-status').innerHTML='<i></i> LOCAL GAME';
 $('#room-info').textContent='';const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url);
 updateSetupOptions();render();save();
}
function disconnected(){if(role===null)return;networkPaused=true;verdict=null;tick(state);state.paused=true;state.lastTick=Date.now();$('#connection-status').innerHTML='<i></i> DISCONNECTED';roomStatus('Connection lost. The game is paused. Leave this room to continue on one device, or create a new room.');toast('Connection lost. Both clocks are paused.');render();}
function bindConnection(conn){
 connection=conn;
 conn.on('open',()=>{
  if(conn!==connection)return;
  networkPaused=false;$('#connection-status').innerHTML='<i></i> ONLINE · CONNECTED';$('#leave-button').hidden=false;
  if(role===0){if(!state.started&&!state.ended)beginGameCountdown(state);else state.paused=state.started;state.lastTick=Date.now();sendState({fresh:true});}
  $('#setup-dialog').close();
  updateSetupOptions();toast('Your opponent is connected.');sound('turn');render();
 });
 conn.on('data',data=>{
  if(conn!==connection||!data||typeof data!=='object')return;
  if(role===1&&data.type==='state'&&(data.onlineVersion!==ONLINE_VERSION||data.rulesVersion!==RULES_VERSION||!isSupportedBoardState(data.state))){
   connection=null;conn.close();networkPaused=true;state.paused=state.started&&!state.ended;state.lastTick=Date.now();
   $('#connection-status').innerHTML='<i></i> UPDATE REQUIRED';
   roomStatus('This room uses an unsupported board size or rules. Both players should reload Primeria and create a new room.');toast('Both players need the latest Primeria rules.');render();return;
  }
  if(role===0&&data.type==='command'){
   if(data.revision!==state.revision){sendState();return;}
   try{if(!['move','start','resign'].includes(data.command?.type))return;applyCommand(data.command,1);}catch(err){conn.send({type:'error',message:err.message});sendState();}
  }else if(role===1&&data.type==='state'&&isSupportedBoardState(data.state)){
   const oldRevision=state.revision,wasEnded=state.ended,oldVerdict=verdict;
   Object.assign(data.state,timeOutSettings(data.state));
   if(data.state.startCountdown){const countdown=data.state.startCountdown;countdown.resumeAt=Date.now()+Math.max(0,data.startMs);if(state.startCountdown?.revision===countdown.revision&&!data.fresh)countdown.resumeAt=Math.min(state.startCountdown.resumeAt,countdown.resumeAt);}
   state=data.state;state.lastTick=Date.now();
   if(data.fresh){rotation=0;shownEnd=false;reviewMove=null;reviewSnapshot=null;verdict=null;}
   if(data.verdict){
    const review={...data.verdict,resumeAt:Date.now()+Math.max(0,data.verdictMs)};
    if(verdict?.revision!==review.revision)showVerdict(review);
    else verdict={...review,resumeAt:Math.min(verdict.resumeAt,review.resumeAt)};
   }else verdict=null;
   if(oldRevision!==state.revision||data.fresh||!!oldVerdict!==!!verdict){resetDraft();render();if(!data.verdict&&!state.ended)sound('turn');}else {renderClocks();renderVerdict();renderStartCountdown();if(!wasEnded&&state.ended)render();}
  }else if(data.type==='error')toast(data.message||'Move could not be accepted.');
 });
 conn.on('close',()=>{if(conn===connection)disconnected();});conn.on('error',()=>{if(conn===connection)disconnected();});
}
function connectRoom(code=null,next=null){
 if(peer)return;
 role=code?1:0;room=code||`primeria-${crypto.randomUUID().replaceAll('-','').slice(0,14)}`;
 state=next||newGame({boardSize:boardSize(),mode:state.mode,names:state.names,...timeOutSettings(state)});rotation=0;shownEnd=false;reviewMove=null;reviewSnapshot=null;verdict=null;action='single';resetDraft();render();roomStatus('Connecting…');updateSetupOptions();$('#setup-dialog').scrollTop=0;
 const activePeer=peer=code?new Peer():new Peer(room);
 const timeout=setTimeout(()=>{if(peer===activePeer&&!connection?.open)roomStatus('Still waiting. Ask your friend to join using the invitation link. If connecting fails, try another network or play on one device.');},15000);
 activePeer.on('open',()=>{
  clearTimeout(timeout);if(peer!==activePeer)return;
  if(code){
   roomStatus('Joining the room…');bindConnection(activePeer.connect(code,{reliable:true,metadata:{boardSizes:BOARD_SIZES,rulesVersion:RULES_VERSION,onlineVersion:ONLINE_VERSION}}));
   setTimeout(()=>{if(peer===activePeer&&!connection?.open)roomStatus('The host has not connected yet. Check that their tab is open, or try another network.');},15000);
  }else{
   const url=new URL(location.href);url.searchParams.set('room',room);history.replaceState(null,'',url);
   $('#room-info').innerHTML=`<strong>Room created.</strong><p>Send this link to your friend:</p><input id="invite-link" readonly aria-label="Invitation link" value="${escape(url.href)}"><button id="copy-link" type="button" class="outline-button">Copy invitation link ↗</button><small>Room code: ${room}</small>`;
   $('#copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(url.href);toast('Invitation copied. Send it to your friend.');}catch{$('#invite-link').select();toast('Select and copy the invitation link.');}});
   $('#connection-status').innerHTML='<i></i> ONLINE · WAITING';
  }
 });
 activePeer.on('connection',incoming=>{if(peer!==activePeer||role!==0||connection){incoming.on('open',()=>incoming.close());return;}if(incoming.metadata?.onlineVersion!==ONLINE_VERSION||incoming.metadata?.rulesVersion!==RULES_VERSION||!incoming.metadata?.boardSizes?.includes(boardSize())){incoming.on('open',()=>{incoming.send({type:'error',message:'This room uses an unsupported board size or rules. Reload Primeria, then join again.'});incoming.close();});return;}bindConnection(incoming);});
 activePeer.on('error',err=>{clearTimeout(timeout);if(peer!==activePeer)return;roomStatus(`Could not connect (${err.type||'network error'}). Leave this room and try again, or play on one device.`);if(connection?.open)disconnected();});
 activePeer.on('disconnected',()=>{if(peer===activePeer&&!connection?.open)disconnected();});
}
$('#leave-button').addEventListener('click',async()=>{
 if(state.started&&!state.ended&&!await ask('Leave this room?','Disconnect from your friend? You can continue this game on one device, with the clocks paused.'))return;
 leaveRoom();$('#setup-form').elements.location.value='local';updateSetupOptions();toast('Playing on one device.');
});
function cancelBot(){botWorker?.terminate();botWorker=null;botJob=null;}
function botFailed(job){
 if(botJob!==job)return;cancelBot();tick(state);if(state.ended){render();return;}
 state.paused=true;state.revision++;save();render();toast('The bot could not choose a move. Resume to retry.');
}
function updateBot(now){
 if(role!==null||!botConfig(state)||!isBotTurn(state)||!state.started||state.paused||state.ended||verdict){cancelBot();return;}
 if(botJob){
  if(botJob.game!==state.bot.id||botJob.revision!==state.revision){cancelBot();return;}
  if(botJob.result&&now>=botJob.executeAt){
   const job=botJob;
   try{applyCommand(job.result.command?{type:'move',move:job.result.command}:{type:'resign'},1);}catch{botFailed(job);}
  }
  return;
 }
 const job=botJob={id:++botCounter,game:state.bot.id,revision:state.revision,startedAt:now,result:null};
 const receive=result=>{
  if(botJob!==job)return;
  if(!result||!Number.isFinite(result.seconds))return botFailed(job);
  const remaining=state.clocks[1],delay=Math.min(Math.max(500,result.seconds*1000),remaining===null?60000:Math.max(100,remaining*500));
  job.result=result;job.executeAt=Math.max(Date.now()+100,job.startedAt+delay);
 };
 const fallback=()=>{
  if(botJob!==job)return;botWorker?.terminate();botWorker=null;
  try{receive(createBot({size:state.boardSize,seed:state.bot.seed^state.revision,strength:state.bot.strength}).choose(state));}catch{botFailed(job);}
 };
 try{
  botWorker=new Worker(new URL('./bot-worker.js?v=f8d68a105c',import.meta.url),{type:'module'});
  botWorker.onmessage=event=>{if(botJob!==job||event.data.id!==job.id)return;if(event.data.error)fallback();else receive(event.data.result);};
  botWorker.onerror=event=>{event.preventDefault();fallback();};
  botWorker.postMessage({id:job.id,state,key:job.game,seed:state.bot.seed^state.revision});
 }catch{fallback();}
}
setInterval(()=>{
 const now=Date.now();const ended=state.ended;
 if(state.startCountdown&&role!==1&&!networkPaused&&(role===null||connection?.open)&&finishGameCountdown(state,now)){resetDraft();save();sendState();render();sound('turn');}
 if(state.startCountdown)renderStartCountdown();
 if(verdict&&role!==1&&!networkPaused&&(role===null||connection?.open)&&finishChallengeReview(state,verdict,now)){
  splitPhoneOpen[verdict.player]=false;verdict=null;resetDraft();save();sendState();render();sound('turn');
 }
 if(verdict)renderVerdict();
 tick(state,now);if(role===1&&!ended&&state.ended)state.ended=null;renderClocks();
 if(!ended&&state.ended){resetDraft();save();sendState();render();}
 if(role===0&&now-syncAt>1000){sendState();syncAt=now;}
 updateBot(now);
 if(now-saveAt>1000){save();saveAt=now;}
},100);
window.addEventListener('pagehide',()=>{cancelBot();save();});resetDraft();render();
const urlRoom=new URL(location.href).searchParams.get('room');
if(urlRoom){openSetup();$('#setup-form').elements.location.value='online';$('#setup-form').elements.roomAction.value='join';$('#room-code').value=urlRoom;updateSetupOptions();roomStatus('Select Join game to join as player two.');}
