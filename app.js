import {MODES,PILE,total,newGame,timeOutSettings,tick,placement,adjacent,segment,challenge,complete} from './engine.js?v=0f2071dea8';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const modeName=s=>s[0].toUpperCase()+s.slice(1);
const colors=Array.from({length:10},(_,i)=>`var(--digit-${i})`);
const key='primeria.game.v1';let state=newGame(),action='single',digit=3,pending=[],ends=[],reverse=false,rotation=0,muted=false,expanded=null;
let peer=null,connection=null,role=null,room=null,networkPaused=false,verdict=null,shownEnd=false,toastTimer,audio,saveAt=0,syncAt=0;
try{const saved=JSON.parse(localStorage.getItem(key));if(saved?.version===1&&saved.state?.board?.length===100&&MODES[saved.state.mode]&&saved.state.piles?.length===2){Object.assign(saved.state,timeOutSettings(saved.state));state=saved.state;state.paused=state.started&&!state.ended;state.lastTick=Date.now();}muted=localStorage.getItem('primeria.muted')==='true';}catch{}
function save(){if(role!==null)return;try{localStorage.setItem(key,JSON.stringify({version:1,state}));}catch{}}
function sound(kind='click'){
 if(muted)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const now=audio.currentTime;
 const notes={click:[520],select:[650],place:[440,660],turn:[392,523],challenge:[330,440,660],fail:[260,196],win:[392,494,587,784]};
 (notes[kind]||notes.click).forEach((freq,i)=>{const osc=audio.createOscillator(),gain=audio.createGain();osc.type=kind==='place'?'sine':'triangle';osc.frequency.setValueAtTime(freq,now+i*.065);osc.frequency.exponentialRampToValueAtTime(freq*.82,now+i*.065+.13);gain.gain.setValueAtTime(0,now+i*.065);gain.gain.linearRampToValueAtTime(kind==='click'?.025:.055,now+i*.065+.007);gain.gain.exponentialRampToValueAtTime(.001,now+i*.065+.16);osc.connect(gain);gain.connect(audio.destination);osc.start(now+i*.065);osc.stop(now+i*.065+.18);});}catch{}
}
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4000);}
function ask(title,message){return new Promise(resolve=>{const d=$('#confirm-dialog');$('#confirm-title').textContent=title;$('#confirm-detail').textContent=message;const finish=value=>{d.close();$('#confirm-yes').onclick=null;$('#confirm-no').onclick=null;d.oncancel=null;resolve(value);};$('#confirm-yes').onclick=()=>finish(true);$('#confirm-no').onclick=()=>finish(false);d.oncancel=e=>{e.preventDefault();finish(false);};d.showModal();});}
function tile(n){return `<span class="tile" style="--tile-color:${colors[n]}" aria-hidden="true"><span class="tile-number north">${n}</span><span class="tile-number east">${n}</span><span class="tile-number south">${n}</span><span class="tile-number west">${n}</span><span class="tile-center"></span></span>`;}
function coords(index){return `(${index%10}, ${Math.floor(index/10)})`;}
function allowed(){return !state.ended&&!state.paused&&state.started&&(role===null||(connection?.open&&state.turn===role));}
function resetDraft(){pending=[];ends=[];reverse=false;$('#factor').value='';}
function boardIndex(row,col){let x=col,y=row;for(let i=0;i<rotation;i++)[x,y]=[y,9-x];return y*10+x;}
function screenPosition(index){let x=index%10,y=Math.floor(index/10);for(let i=0;i<rotation;i++)[x,y]=[9-y,x];return [x,y];}
function renderBoard(){
 const preview=state.board.slice();pending.forEach(m=>preview[m.index]=m.digit);let selection=[];
 if(ends.length===2)try{selection=segment(state.board,...ends);}catch{}else selection=ends;
 let html='';
 for(let row=-1;row<=10;row++)for(let col=-1;col<=10;col++){
  if(row<0||row>9||col<0||col>9){let label='';if((row<0||row>9)&&(col<0||col>9))label='✦';else if(row<0||row>9){const i=boardIndex(row<0?0:9,col);label=rotation%2?Math.floor(i/10):i%10;}else {const i=boardIndex(row,col<0?0:9);label=rotation%2?i%10:Math.floor(i/10);}
   html+=`<span class="axis ${label==='✦'?'corner':''}" aria-hidden="true">${label}</span>`;continue;
  }
  const index=boardIndex(row,col),n=preview[index],draft=pending.some(m=>m.index===index),selected=selection.includes(index),last=state.lastCells.includes(index);
  const legal=allowed()&&action!=='challenge'&&n===null&&(action==='single'&&digit!==0||adjacent(preview,index));
  html+=`<button class="cell ${n===null?'empty':'occupied'} ${(row+col)%2?'alt':''} ${draft?'pending':''} ${selected?'challenge-selected':''} ${last?'last':''} ${legal?'legal':''}" data-index="${index}" aria-label="x ${index%10}, y ${Math.floor(index/10)}, ${n===null?'empty':`digit ${n}`}${draft?', pending placement':''}${selected?', selected for challenge':''}" ${state.ended?'disabled':''}>${n===null?'':tile(n)}</button>`;
 }
 $('#board').innerHTML=html;$('.board-surround').classList.toggle('finished',!!state.ended);
}
function formatTime(t){if(t===null)return '∞';const s=Math.ceil(t);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function renderClocks(){for(let i=0;i<2;i++){const clock=$(`#clock-${i}`);if(clock){clock.textContent=formatTime(state.clocks[i]);clock.classList.toggle('low',state.clocks[i]!==null&&state.clocks[i]<60);}}}
function renderPlayers(){
 $('#player-cards').innerHTML=state.names.map((name,i)=>`<div class="player-card ${state.turn===i&&!state.ended?'active':''} ${expanded===i?'expanded':''}" role="button" tabindex="0" data-player="${i}" aria-expanded="${expanded===i}" aria-label="${escape(name)}, ${total(state.piles[i])} tiles. Show tile counts"><span class="player-avatar">${i===0?'✳':'✧'}</span><div class="player-info"><div class="player-name">${escape(name)}${role===i?' · you':''}</div><div class="player-desc">${state.turn===i&&!state.ended?'<i class="turn-dot"></i>':''}${total(state.piles[i])} tiles ${state.turn===i&&!state.ended?'· '+(state.paused?'paused':state.started?'to play':'first move'):''}</div><div class="pile-peek">${state.piles[i].map((n,d)=>`<span style="--tile-color:${colors[d]}">${d} × ${n}</span>`).join('')}</div></div><span id="clock-${i}" class="player-time"></span></div>`).join('');renderClocks();
 const mode=MODES[state.mode];$('#mode-label').textContent=`${modeName(state.mode).toUpperCase()} · ${mode[0]===null?'∞':`${mode[0]/60} + ${mode[1]}`}`;
 $('#move-owner').textContent=state.names[state.turn].toUpperCase();
 const opponent=1-(role??state.turn);$('#opponent-name').textContent=`${state.names[opponent].toUpperCase()}’S PILE`;
 $('#opponent-rack').innerHTML=state.piles[opponent].map((n,d)=>`<span class="supply-chip" style="--tile-color:${colors[d]}" aria-label="${escape(state.names[opponent])}: digit ${d}, ${n} remaining"><b>${d}</b><small>×${n}</small></span>`).join('');
}
function renderControls(){
 const pile=state.piles[role??state.turn].slice();pending.forEach(m=>pile[m.digit]--);
 $('.move-panel h2').textContent=role!==null&&state.turn!==role?'Their move':'Your move';
 $('#rack').innerHTML=pile.map((n,d)=>`<button class="rack-button ${digit===d?'selected':''}" data-digit="${d}" aria-label="Digit ${d}, ${n} remaining" aria-pressed="${digit===d}" ${n===0?'disabled':''}>${tile(d)}<span class="tile-count">${n}</span></button>`).join('');
 $('#rack-count').textContent=`${total(pile)} remaining`;
 $$('.action-tab').forEach(b=>{b.classList.toggle('selected',b.dataset.action===action);b.setAttribute('aria-pressed',b.dataset.action===action);});
 $('#placement-controls').hidden=action==='challenge';$('#challenge-controls').hidden=action!=='challenge';
 $('#undo-button').disabled=!(pending.length||ends.length);
 if(action==='challenge'){
  let html='';if(ends.length===2)try{const cells=segment(state.board,...ends),forward=cells.map(i=>state.board[i]).join(''),backward=cells.slice().reverse().map(i=>state.board[i]).join('');
  const [ax,ay]=screenPosition(cells[0]),[bx,by]=screenPosition(cells.at(-1));
  const labels=cells.length===1?['As placed','Reversed']:ax!==bx?(ax<bx?['Left → right','Right → left']:['Right → left','Left → right']):(ay<by?['Top → bottom','Bottom → top']:['Bottom → top','Top → bottom']);
  html=`<button class="reading-option ${!reverse?'selected':''}" data-reverse="false" aria-pressed="${!reverse}">${forward}<small>${labels[0]}</small></button><button class="reading-option ${reverse?'selected':''}" data-reverse="true" aria-pressed="${reverse}">${backward}<small>${labels[1]}</small></button>`;}catch{}
  $('#reading-options').innerHTML=html;
 }
 let hint=!state.started?'Start the game when both players are ready.':state.ended?`${state.names[state.ended.winner]} wins ${state.ended.reason}.`:state.paused?'The table is paused. Resume when you’re both ready.':role!==null&&!connection?.open?'Waiting for your friend to connect.':role!==null&&state.turn!==role?`${state.names[state.turn]} is thinking. Your turn is next.`:action==='challenge'?(ends.length===2?'Choose a reading direction and propose a factor.':ends.length===1?'Now select the last tile. Select the same tile for one digit.':'Select the first tile of the number you want to challenge.'):pending.length?`${pending.length} of ${action==='double'?2:1} tiles placed. ${action==='double'&&pending.length===1?'Choose your second tile.':'Ready to commit your move.'}`:'Choose a digit, then a square on the board.';
 $('#move-hint').textContent=hint;
 const ready=action==='challenge'?ends.length===2&&$('#factor').value.trim().length>0:pending.length===(action==='double'?2:1);
 const button=$('#commit-button');button.innerHTML=`${!state.started?'Start game':action==='challenge'?'Submit challenge':action==='double'?'Place two tiles':'Place tile'} <span>↗</span>`;
 button.disabled=state.started?(!allowed()||!ready):!!state.ended||(role!==null&&(role!==0||!connection?.open));
 $('#start-button').textContent=!state.started?'▶ Start game':state.paused?'▶ Resume game':'Ⅱ Pause game';$('#start-button').classList.toggle('paused',state.paused);
 $('#start-button').disabled=!!state.ended||!!verdict||(role!==null&&!connection?.open);
 $('#resign-button').disabled=!state.started||!!state.ended||(role!==null&&!connection?.open);
 $('#new-button').disabled=role===1;$('#online-button').textContent=role===null?'Play online ↗':'Room details ↗';
 $('#board-note').textContent=state.ended?`${state.names[state.ended.winner]} wins. Well played.`:state.started?`${state.names[state.turn]} to play${state.paused?' · paused':''}. ${state.timeOutRule&&state.elapsed>=state.timeOutSeconds?`Time Out streak: ${state.streak}/${state.timeOutMoves}.`:'Make it count.'}`:'A blank board. A world of possibilities.';
 $('#turn-count').textContent=`TURN ${String(state.history.length+1).padStart(2,'0')}`;
}
function renderHistory(){
 $('#history-count').textContent=`${state.history.length} MOVES`;
 $('#history').innerHTML=state.history.length?state.history.slice().reverse().slice(0,80).map((e,i)=>`<li class="history-entry"><span class="history-index">${String(state.history.length-i).padStart(2,'0')}</span><div class="history-text"><b>${escape(state.names[e.player])}</b> ${e.action==='challenge'?`challenged ${e.digits}`:e.action==='double'?'doubled down':'dropped a tile'}<small>${e.action==='challenge'?`${e.digits} ÷ ${e.factor} · ${e.success?'tiles transferred':'not a factor'}`:e.moves.map(m=>`${m.digit} at ${coords(m.index)}`).join(' · ')}</small></div><span class="history-badge">${e.action==='challenge'?(e.success?'✓':'×'):e.action==='double'?'+2':'+1'}</span></li>`).join(''):'<li class="history-empty">Every great game starts with a single tile.</li>';
}
function render(){$('#time-out-summary').textContent=state.timeOutRule?`This game: Time Out Rule begins after ${state.timeOutSeconds/60} minutes and requires ${state.timeOutMoves} consecutive moves.`:'Time Out Rule is off for this game.';renderBoard();renderPlayers();renderControls();renderHistory();$('#sound-button').textContent=muted?'♪̸':'♫';$('#sound-button').setAttribute('aria-label',muted?'Enable sound':'Mute sound');if(state.ended&&!shownEnd)showEnd();}
function showEnd(){shownEnd=true;sound('win');$('#result-eyebrow').textContent='A GAME WELL PLAYED';$('#result-symbol').textContent='✳';$('#result-title').textContent=`${state.names[state.ended.winner]} wins.`;$('#result-detail').textContent=`Victory ${state.ended.reason}. ${state.history.length} moves, and a few new possibilities discovered.`;$('#result-continue').textContent='Back to the board';if(!$('#result-dialog').open)$('#result-dialog').showModal();}
function showVerdict(entry){
 verdict=entry;$('#result-eyebrow').textContent='BOTH CLOCKS ARE PAUSED';$('#result-symbol').textContent=entry.success?'✓':'×';$('#result-title').textContent=entry.success?'Factor found.':'Not this time.';
 $('#result-detail').textContent=entry.success?`${entry.digits} ÷ ${entry.factor} = ${entry.quotient}. ${entry.cells.length} ${entry.cells.length===1?'tile moves':'tiles move'} to ${state.names[1-entry.player]}’s pile.`:`${entry.digits} ÷ ${entry.factor} leaves remainder ${entry.remainder}. No tiles move. The turn passes to ${state.names[state.turn]}.`;
 $('#result-continue').textContent='Continue to the next turn';if(!$('#result-dialog').open)$('#result-dialog').showModal();sound(entry.success?'challenge':'fail');
}
function sendState(extra={}){if(role===0&&connection?.open)connection.send({type:'state',state,verdict,...extra});}
function applyCommand(command,actor=role===null?state.turn:role){
 tick(state);
 if(command.type==='start'){
  if(state.ended)throw Error('Start a new game to play again.');
  if(verdict)throw Error('Review the challenge first.');
  if(!state.started){if(role!==null&&actor!==0)throw Error('The host starts the game.');state.started=true;state.paused=false;}else state.paused=!state.paused;
  state.lastTick=Date.now();state.revision++;sound('turn');
 }else if(command.type==='continue'){
  if(!verdict)return;verdict=null;state.paused=false;state.lastTick=Date.now();state.revision++;$('#result-dialog').close();
 }else if(command.type==='resign'){
  if(!state.started||state.ended)throw Error('There is no active game to resign.');state.ended={winner:1-actor,reason:'by resignation'};state.revision++;
 }else if(command.type==='move'){
  if(actor!==state.turn)throw Error('Wait for your turn.');if(verdict)throw Error('Finish reviewing the challenge first.');
  const entry=complete(state,command.move);if(entry.action==='challenge'){state.paused=true;showVerdict(entry);}else sound('turn');
 }
 resetDraft();save();sendState();render();
}
function dispatch(command){
 if(role!==null&&!connection?.open)return toast('Your friend must be connected first.');
 try{if(role===1){connection.send({type:'command',command,revision:state.revision});return;}applyCommand(command);}catch(e){toast(e.message);renderControls();}
}
$('#board').addEventListener('click',e=>{
 const cell=e.target.closest('[data-index]');if(!cell)return;if(!allowed())return toast(state.paused?'Resume the game first.':!state.started?'Start the game when you’re ready.':'Wait for your turn.');const index=Number(cell.dataset.index);
 if(action==='challenge'){
  if(state.board[index]===null)return toast('Select a tile on the board.');
  if(ends.length===2)ends=[];
  if(ends.length===1)try{segment(state.board,ends[0],index);}catch(err){return toast(err.message);}
  ends.push(index);reverse=false;sound('select');
 }else{
  const existing=pending.findIndex(m=>m.index===index);if(existing>=0){pending=pending.slice(0,existing);render();return;}
  if(pending.length===(action==='double'?2:1))return toast('Commit your move, or clear it to choose again.');
  const next=[...pending,{index,digit}];try{placement(state,action,next,true);}catch(err){return toast(err.message);}pending=next;sound('place');
 }
 renderBoard();renderControls();
});
$('#rack').addEventListener('click',e=>{const b=e.target.closest('[data-digit]');if(!b)return;digit=Number(b.dataset.digit);sound('select');renderControls();renderBoard();});
$$('.action-tab').forEach(b=>b.addEventListener('click',()=>{action=b.dataset.action;resetDraft();sound();renderBoard();renderControls();}));
$('#reading-options').addEventListener('click',e=>{const b=e.target.closest('[data-reverse]');if(!b)return;reverse=b.dataset.reverse==='true';sound('select');renderControls();});
$('#factor').addEventListener('input',renderControls);
$('#factor').addEventListener('keydown',e=>{if(e.key==='Enter'&&!$('#commit-button').disabled)$('#commit-button').click();});
$('#undo-button').addEventListener('click',()=>{resetDraft();sound();render();});
$('#commit-button').addEventListener('click',()=>{
 if(!state.started)return dispatch({type:'start'});
 if(action==='challenge'){try{challenge(state,ends[0],ends[1],reverse,$('#factor').value.trim());}catch(err){return toast(err.message);}}
 dispatch({type:'move',move:action==='challenge'?{action,a:ends[0],b:ends[1],reverse,factor:$('#factor').value.trim()}:{action,moves:pending.slice()}});
});
$('#rotate-button').addEventListener('click',()=>{rotation=(rotation+1)%4;sound();renderBoard();renderControls();toast(`Board rotated ${rotation*90}°. Coordinates stay with their squares.`);});
$('#sound-button').addEventListener('click',()=>{muted=!muted;try{localStorage.setItem('primeria.muted',muted);}catch{}sound();render();});
$('#start-button').addEventListener('click',()=>dispatch({type:'start'}));
$('#result-continue').addEventListener('click',()=>{if(state.ended){$('#result-dialog').close();return;}dispatch({type:'continue'});});
$('#result-dialog').addEventListener('cancel',e=>{if(verdict)e.preventDefault();});
$('#resign-button').addEventListener('click',async()=>{if(!allowed()&&role===null&&state.paused)return toast('Resume the game before resigning.');
 const who=role??state.turn;if(await ask('Leave this game?',`Resign as ${state.names[who]}? ${state.names[1-who]} will win.`))dispatch({type:'resign'});
});
function updateTimeOutOptions(){const enabled=$('#time-out-rule').checked;$('#time-out-options').hidden=!enabled;$('#time-out-options').disabled=!enabled;$('#time-out-rule').setAttribute('aria-expanded',String(enabled));}
$('#time-out-rule').addEventListener('change',updateTimeOutOptions);
function openSetup(){if(role===1)return toast('The host chooses the next game.');const form=$('#setup-form');form.elements.one.value=state.names[0];form.elements.two.value=state.names[1];form.elements.mode.value=state.mode;form.elements.timeOutRule.checked=state.timeOutRule;form.elements.timeOutMinutes.value=state.timeOutSeconds/60;form.elements.timeOutMoves.value=state.timeOutMoves;updateTimeOutOptions();$('#setup-dialog').showModal();sound();}
$('#new-button').addEventListener('click',openSetup);
$('#setup-form').addEventListener('submit',async e=>{e.preventDefault();const data=new FormData(e.target),enabled=data.has('timeOutRule');let next;
 try{next=newGame({mode:data.get('mode'),names:[data.get('one'),data.get('two')],first:data.get('first')==='random'?(crypto.getRandomValues(new Uint8Array(1))[0]%2):Number(data.get('first')),timeOutRule:enabled,timeOutSeconds:enabled?Number(data.get('timeOutMinutes'))*60:state.timeOutSeconds,timeOutMoves:enabled?Number(data.get('timeOutMoves')):state.timeOutMoves});}catch(err){return toast(err.message);}
 if(state.started&&!state.ended&&!await ask('A fresh start?','Replace this game with a fresh board? Your current game will be replaced.'))return;
 state=next;shownEnd=false;verdict=null;action='single';resetDraft();$('#setup-dialog').close();save();sendState({fresh:true});render();sound('turn');toast(`${state.names[state.turn]} has the first move. Press Start game when ready.`);
});
for(const id of ['#rules-button','#rules-footer'])$(id).addEventListener('click',()=>{sound();$('#rules-dialog').showModal();});
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
$('#player-cards').addEventListener('click',e=>{const card=e.target.closest('[data-player]');if(!card)return;expanded=expanded===Number(card.dataset.player)?null:Number(card.dataset.player);renderPlayers();});
$('#player-cards').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.target.closest('[data-player]')?.click();}});
document.addEventListener('keydown',e=>{if(e.target.matches('input,select')||$('dialog[open]'))return;if(/^\d$/.test(e.key)){digit=Number(e.key);renderControls();sound('select');}if(e.key==='Escape'){resetDraft();render();}});

function roomStatus(message){$('#room-info').textContent=message;}
function leaveRoom(){connection?.close();peer?.destroy();connection=null;peer=null;role=null;room=null;networkPaused=false;verdict=null;$('#result-dialog').close();state.paused=state.started&&!state.ended;state.lastTick=Date.now();$('#connection-status').innerHTML='<i></i> SHARED TABLE';$('#host-button').hidden=false;$('#leave-button').hidden=true;$('#room-info').textContent='';history.replaceState(null,'',location.pathname);render();save();}
function disconnected(){if(role===null)return;networkPaused=true;tick(state);state.paused=true;state.lastTick=Date.now();$('#connection-status').innerHTML='<i></i> DISCONNECTED';roomStatus('Connection lost. The game is paused. Leave this room to continue on one device, or create a fresh room.');toast('Connection lost. Both clocks are paused.');render();}
function bindConnection(conn){
 connection=conn;
 conn.on('open',()=>{
  networkPaused=false;$('#connection-status').innerHTML='<i></i> ONLINE · CONNECTED';$('#leave-button').hidden=false;
  if(role===0){state.paused=state.started;state.lastTick=Date.now();sendState({fresh:true});}else roomStatus('Connected. You are player two. The host chooses the game and starts the clock.');
  toast('Your friend is at the table.');sound('turn');render();
 });
 conn.on('data',data=>{
  if(!data||typeof data!=='object')return;
  if(role===0&&data.type==='command'){
   if(data.revision!==state.revision){sendState();return;}
   try{if(!['move','continue','start','resign'].includes(data.command?.type))return;applyCommand(data.command,1);}catch(err){conn.send({type:'error',message:err.message});sendState();}
  }else if(role===1&&data.type==='state'&&data.state?.board?.length===100){
   const oldRevision=state.revision,wasEnded=state.ended,oldVerdict=verdict;
   Object.assign(data.state,timeOutSettings(data.state));state=data.state;state.lastTick=Date.now();
   if(data.verdict&&!oldVerdict)showVerdict(data.verdict);else if(!data.verdict&&oldVerdict){verdict=null;$('#result-dialog').close();}
   if(oldRevision!==state.revision||data.fresh){if(data.fresh){shownEnd=false;verdict=null;$('#result-dialog').close();}resetDraft();render();if(!data.verdict&&!state.ended)sound('turn');}else {renderClocks();if(!wasEnded&&state.ended)render();}
  }else if(data.type==='error')toast(data.message||'Move could not be accepted.');
 });
 conn.on('close',disconnected);conn.on('error',disconnected);
}
async function connectRoom(code=null){
 if(!window.Peer){roomStatus('The online connection library is unavailable. Reload this page, or play on one device.');return;}
 if(peer)return toast('Leave the current room before creating or joining another.');
 if(state.started&&!state.ended&&!await ask('Make room for a friend.','Online play starts a fresh game with your selected time control. Replace the current game?'))return;
 role=code?1:0;room=code||`primeria-${crypto.randomUUID().replaceAll('-','').slice(0,14)}`;
 state=newGame({mode:state.mode,names:state.names,...timeOutSettings(state)});shownEnd=false;resetDraft();render();roomStatus('Opening a table…');$('#host-button').hidden=true;$('#leave-button').hidden=false;
 peer=code?new Peer():new Peer(room);
 const timeout=setTimeout(()=>{if(!connection?.open)roomStatus('Still waiting. If you shared a link, ask your friend to join. If connecting fails, try another network or shared-device play.');},15000);
 peer.on('open',()=>{
  clearTimeout(timeout);
  if(code){roomStatus('Joining your friend’s table…');bindConnection(peer.connect(code,{reliable:true}));setTimeout(()=>{if(role===1&&!connection?.open)roomStatus('The host has not connected yet. Check that their tab is open, or try another network.');},15000);}
  else{const url=new URL(location.href);url.searchParams.set('room',room);history.replaceState(null,'',url);$('#room-info').innerHTML=`<strong>Your table is ready.</strong><br>Send this link to your friend:<input id="invite-link" readonly aria-label="Invitation link" value="${escape(url.href)}"><button id="copy-link" class="outline-button">Copy invitation link ↗</button><br><small>Room code: ${room}</small>`;
   $('#copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(url.href);toast('Invitation copied. Send it to your friend.');}catch{$('#invite-link').select();toast('Select and copy the invitation link.');}});
   $('#connection-status').innerHTML='<i></i> ONLINE · WAITING';
  }
 });
 peer.on('connection',incoming=>{if(role!==0||connection){incoming.on('open',()=>incoming.close());return;}bindConnection(incoming);});
 peer.on('error',err=>{clearTimeout(timeout);roomStatus(`Could not connect (${err.type||'network error'}). Leave this room and try again, or play on one device.`);if(connection?.open)disconnected();});
 peer.on('disconnected',()=>{if(!connection?.open)disconnected();});
}
$('#online-button').addEventListener('click',()=>{$('#online-dialog').showModal();sound();});
$('#host-button').addEventListener('click',()=>connectRoom());
$('#join-button').addEventListener('click',()=>{let code=$('#room-code').value.trim();try{if(code.startsWith('http'))code=new URL(code).searchParams.get('room')||'';}catch{}if(!/^primeria-[a-f0-9]{14}$/.test(code))return toast('Paste a complete invitation link or room code.');connectRoom(code);});
$('#leave-button').addEventListener('click',()=>{leaveRoom();toast('Back at the shared table.');});
let urlRoom=new URL(location.href).searchParams.get('room');if(urlRoom){$('#room-code').value=urlRoom;$('#online-dialog').showModal();roomStatus('You’ve been invited. Select Join to take your seat as player two.');}
setInterval(()=>{
 const now=Date.now();const ended=state.ended;
 tick(state,now);if(role===1&&!ended&&state.ended)state.ended=null;renderClocks();
 if(!ended&&state.ended){resetDraft();save();sendState();render();}
 if(role===0&&now-syncAt>1000){sendState();syncAt=now;}
 if(now-saveAt>1000){save();saveAt=now;}
},100);
window.addEventListener('pagehide',save);render();
