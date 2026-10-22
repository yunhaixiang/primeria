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
function ask(title,message,confirmLabel='Continue'){return new Promise(resolve=>{const d=$('#confirm-dialog');$('#confirm-title').textContent=title;$('#confirm-detail').textContent=message;$('#confirm-yes').innerHTML=`${escape(confirmLabel)} <span>↗</span>`;const finish=value=>{d.close();$('#confirm-yes').onclick=null;$('#confirm-no').onclick=null;d.oncancel=null;resolve(value);};$('#confirm-yes').onclick=()=>finish(true);$('#confirm-no').onclick=()=>finish(false);d.oncancel=e=>{e.preventDefault();finish(false);};d.showModal();});}
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
 $$('.action-tab[data-action]').forEach(b=>{b.classList.toggle('selected',b.dataset.action===action);b.setAttribute('aria-pressed',b.dataset.action===action);});
 $('#placement-controls').hidden=action==='challenge';$('#challenge-controls').hidden=action!=='challenge';
 $('#undo-button').disabled=!(pending.length||ends.length);
 if(action==='challenge'){
  let html='';if(ends.length===2)try{const cells=segment(state.board,...ends),forward=cells.map(i=>state.board[i]).join(''),backward=cells.slice().reverse().map(i=>state.board[i]).join('');
  const [ax,ay]=screenPosition(cells[0]),[bx,by]=screenPosition(cells.at(-1));
  const labels=cells.length===1?['As placed','Reversed']:ax!==bx?(ax<bx?['Left → right','Right → left']:['Right → left','Left → right']):(ay<by?['Top → bottom','Bottom → top']:['Bottom → top','Top → bottom']);
  html=`<button class="reading-option ${!reverse?'selected':''}" data-reverse="false" aria-pressed="${!reverse}">${forward}<small>${labels[0]}</small></button><button class="reading-option ${reverse?'selected':''}" data-reverse="true" aria-pressed="${reverse}">${backward}<small>${labels[1]}</small></button>`;}catch{}
  $('#reading-options').innerHTML=html;
 }
 const ready=action==='challenge'?ends.length===2&&$('#factor').value.trim().length>0:pending.length===(action==='double'?2:1);
 const button=$('#commit-button');button.innerHTML=`${action==='challenge'?'Submit challenge':action==='double'?'Place two tiles':'Place tile'} <span>↗</span>`;
 button.disabled=!allowed()||!ready;
 $('#start-button .start-label').textContent=state.ended?'Game Over':!state.started?'Start':state.paused?'Resume':'Pause';$('#start-icon').innerHTML=state.ended?'<rect x="5" y="5" width="14" height="14" rx="1"/>':state.started&&!state.paused?'<path d="M8 4v16M16 4v16"/>':'<path d="m8 4 12 8-12 8Z"/>';$('#start-button').classList.toggle('paused',state.paused);
 $('#start-button').disabled=!!state.ended||!!verdict||(role!==null&&(!connection?.open||(!state.started&&role!==0)));
 $('#resign-button').disabled=!state.started||!!state.ended||(role!==null&&!connection?.open);
 $('#new-button').disabled=false;
 $('#board-note').textContent=state.ended?`${state.names[state.ended.winner]} wins. Well played.`:state.started?`${state.names[state.turn]} to play${state.paused?' · paused':''}. ${state.timeOutRule&&state.elapsed>=state.timeOutSeconds?`Time Out streak: ${state.streak}/${state.timeOutMoves}.`:'Make it count.'}`:'A blank board. A world of possibilities.';
 $('#turn-count').textContent=`TURN ${String(state.history.length+1).padStart(2,'0')}`;
}
function renderHistory(){
 $('#history-count').textContent=`${state.history.length} MOVES`;
 $('#history').innerHTML=state.history.length?state.history.slice().reverse().slice(0,80).map((e,i)=>`<li class="history-entry"><span class="history-index">${String(state.history.length-i).padStart(2,'0')}</span><div class="history-text"><b>${escape(state.names[e.player])}</b> ${e.action==='challenge'?`challenged ${e.digits}`:e.action==='double'?'doubled down':'dropped a tile'}<small>${e.action==='challenge'?`${e.digits} ÷ ${e.factor} · ${e.success?'tiles transferred':'not a factor'}`:e.moves.map(m=>`${m.digit} at ${coords(m.index)}`).join(' · ')}</small></div><span class="history-badge">${e.action==='challenge'?(e.success?'✓':'×'):e.action==='double'?'+2':'+1'}</span></li>`).join(''):'<li class="history-empty">Every great game starts with a single tile.</li>';
}
function render(){$('#time-out-summary').textContent=state.timeOutRule?`This game: Time Out Rule begins after ${state.timeOutSeconds/60} minutes and requires ${state.timeOutMoves} consecutive moves.`:'Time Out Rule is off for this game.';renderBoard();renderPlayers();renderControls();renderHistory();$('#sound-button .sound-label').textContent=muted?'Unmute':'Mute';$('#sound-icon-detail').innerHTML=muted?'<path d="m16 9 6 6m0-6-6 6"/>':'<path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>';$('#sound-button').setAttribute('aria-label',muted?'Unmute':'Mute');$('#sound-button').setAttribute('title',muted?'Unmute sound':'Mute sound');$('#sound-button').setAttribute('aria-pressed',String(muted));if(state.ended&&!shownEnd)showEnd();}
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
$$('.action-tab[data-action]').forEach(b=>b.addEventListener('click',()=>{action=b.dataset.action;resetDraft();sound();renderBoard();renderControls();}));
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
$('#resign-button').addEventListener('click',async()=>{
 sound();const who=role??state.turn;if(await ask('Are you sure you wish to resign?',`You are resigning as ${state.names[who]}. ${state.names[1-who]} will win.`, 'Resign'))dispatch({type:'resign'});
});
function updateTimeOutOptions(){const enabled=$('#time-out-rule').checked;$('#time-out-options').hidden=!enabled;$('#time-out-options').disabled=!enabled;$('#time-out-rule').setAttribute('aria-expanded',String(enabled));}
$('#time-out-rule').addEventListener('change',updateTimeOutOptions);
function updateSetupOptions(){
 const form=$('#setup-form'),online=form.elements.location.value==='online',joining=online&&role===null&&form.elements.roomAction.value==='join';
 $('#online-options').hidden=!online;
 $('#room-choice').hidden=role!==null;
 $('#room-choice').disabled=!online||role!==null;
 $('#join-options').hidden=!joining;
 $('#room-code').disabled=!joining;$('#room-code').required=joining;
 const settings=!(joining||(online&&role===1));
 $('#game-settings').hidden=!settings;$('#game-settings').disabled=!settings;
 $('#setup-submit').hidden=online&&role===1;
 $('#setup-submit').innerHTML=`${!online?'Let’s play':role===0?'Start a new game':joining?'Join game':'Create a room'} <span>↗</span>`;
 $('#leave-button').hidden=role===null;
 $('#online-note').textContent=role===1?'You are player two. The host chooses the settings and starts new games.':role===0?'You are player one. New games stay in this room with your friend. Keep this tab open.':'Share an invitation link with your friend. Keep the host’s tab open while playing. Some networks may prevent a connection.';
 $('#setup-warning').textContent=online&&role===1?'To play on one device, select that option above.':!online&&role!==null?'Starting on one device leaves your online room.':joining?'Your friend’s game settings will be used.':'New games replace the current game.';
 updateTimeOutOptions();
}
function openSetup(){
 const form=$('#setup-form');form.elements.one.value=state.names[0];form.elements.two.value=state.names[1];form.elements.mode.value=state.mode;form.elements.first.value='random';
 form.elements.timeOutRule.checked=state.timeOutRule;form.elements.timeOutMinutes.value=state.timeOutSeconds/60;form.elements.timeOutMoves.value=state.timeOutMoves;
 form.elements.location.value=role===null?'local':'online';updateSetupOptions();$('#setup-dialog').showModal();$('#setup-dialog').scrollTop=0;sound();
}
$$('input[name="location"],input[name="roomAction"]').forEach(input=>input.addEventListener('change',()=>{updateSetupOptions();sound('select');}));
$('#new-button').addEventListener('click',openSetup);
$('#setup-form').addEventListener('submit',async e=>{
 e.preventDefault();const data=new FormData(e.target),online=data.get('location')==='online',joining=online&&role===null&&data.get('roomAction')==='join';
 if(online&&role===1)return;
 let code=null,next;
 if(joining){
  code=String(data.get('roomCode')||'').trim();try{if(/^https?:/i.test(code))code=new URL(code).searchParams.get('room')||'';}catch{}
  if(!/^primeria-[a-f0-9]{14}$/.test(code)){toast('Paste a complete invitation link or room code.');$('#room-code').focus();return;}
 }else{
  const enabled=data.has('timeOutRule');
  try{next=newGame({mode:data.get('mode'),names:[data.get('one'),data.get('two')],first:data.get('first')==='random'?(crypto.getRandomValues(new Uint8Array(1))[0]%2):Number(data.get('first')),timeOutRule:enabled,timeOutSeconds:enabled?Number(data.get('timeOutMinutes'))*60:state.timeOutSeconds,timeOutMoves:enabled?Number(data.get('timeOutMoves')):state.timeOutMoves});}catch(err){return toast(err.message);}
 }
 if(online&&role===null&&!window.Peer){roomStatus('The online connection library is unavailable. Reload this page, or play on one device.');return;}
 if((state.started&&!state.ended)||(!online&&role!==null)){
  if(!await ask('A fresh start?',!online&&role!==null?'Leave your online room and start a fresh game on this device?':'Replace this game with a fresh board? Your current game will be replaced.'))return;
 }
 if(!online&&role!==null)leaveRoom();
 if(online&&role===null){connectRoom(code,next);return;}
 state=next;shownEnd=false;verdict=null;action='single';resetDraft();$('#result-dialog').close();$('#setup-dialog').close();save();sendState({fresh:true});render();sound('turn');toast(`${state.names[state.turn]} has the first move. Press Start when ready.`);
});
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
$('#player-cards').addEventListener('click',e=>{const card=e.target.closest('[data-player]');if(!card)return;expanded=expanded===Number(card.dataset.player)?null:Number(card.dataset.player);renderPlayers();});
$('#player-cards').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.target.closest('[data-player]')?.click();}});
document.addEventListener('keydown',e=>{if(e.target.matches('input,select')||$('dialog[open]'))return;if(/^\d$/.test(e.key)){digit=Number(e.key);renderControls();sound('select');}if(e.key==='Escape'){resetDraft();render();}});

function roomStatus(message){$('#room-info').textContent=message;}
function leaveRoom(){
 const oldConnection=connection,oldPeer=peer;
 connection=null;peer=null;role=null;room=null;networkPaused=false;verdict=null;
 oldConnection?.close();oldPeer?.destroy();$('#result-dialog').close();
 state.paused=state.started&&!state.ended;state.lastTick=Date.now();$('#connection-status').innerHTML='<i></i> SHARED TABLE';
 $('#room-info').textContent='';const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url);
 updateSetupOptions();render();save();
}
function disconnected(){if(role===null)return;networkPaused=true;tick(state);state.paused=true;state.lastTick=Date.now();$('#connection-status').innerHTML='<i></i> DISCONNECTED';roomStatus('Connection lost. The game is paused. Leave this room to continue on one device, or create a fresh room.');toast('Connection lost. Both clocks are paused.');render();}
function bindConnection(conn){
 connection=conn;
 conn.on('open',()=>{
  if(conn!==connection)return;
  networkPaused=false;$('#connection-status').innerHTML='<i></i> ONLINE · CONNECTED';$('#leave-button').hidden=false;
  if(role===0){state.paused=state.started;state.lastTick=Date.now();sendState({fresh:true});}else{roomStatus('Connected. You are player two. The host chooses the game and starts the clock.');$('#setup-dialog').close();}
  updateSetupOptions();toast('Your friend is at the table.');sound('turn');render();
 });
 conn.on('data',data=>{
  if(conn!==connection||!data||typeof data!=='object')return;
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
 conn.on('close',()=>{if(conn===connection)disconnected();});conn.on('error',()=>{if(conn===connection)disconnected();});
}
function connectRoom(code=null,next=null){
 if(peer)return;
 role=code?1:0;room=code||`primeria-${crypto.randomUUID().replaceAll('-','').slice(0,14)}`;
 state=next||newGame({mode:state.mode,names:state.names,...timeOutSettings(state)});shownEnd=false;verdict=null;action='single';$('#result-dialog').close();resetDraft();render();roomStatus('Opening a table…');updateSetupOptions();$('#setup-dialog').scrollTop=0;
 const activePeer=peer=code?new Peer():new Peer(room);
 const timeout=setTimeout(()=>{if(peer===activePeer&&!connection?.open)roomStatus('Still waiting. Ask your friend to join using the invitation link. If connecting fails, try another network or play on one device.');},15000);
 activePeer.on('open',()=>{
  clearTimeout(timeout);if(peer!==activePeer)return;
  if(code){
   roomStatus('Joining your friend’s table…');bindConnection(activePeer.connect(code,{reliable:true}));
   setTimeout(()=>{if(peer===activePeer&&!connection?.open)roomStatus('The host has not connected yet. Check that their tab is open, or try another network.');},15000);
  }else{
   const url=new URL(location.href);url.searchParams.set('room',room);history.replaceState(null,'',url);
   $('#room-info').innerHTML=`<strong>Your table is ready.</strong><p>Send this link to your friend:</p><input id="invite-link" readonly aria-label="Invitation link" value="${escape(url.href)}"><button id="copy-link" type="button" class="outline-button">Copy invitation link ↗</button><small>Room code: ${room}</small>`;
   $('#copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(url.href);toast('Invitation copied. Send it to your friend.');}catch{$('#invite-link').select();toast('Select and copy the invitation link.');}});
   $('#connection-status').innerHTML='<i></i> ONLINE · WAITING';
  }
 });
 activePeer.on('connection',incoming=>{if(peer!==activePeer||role!==0||connection){incoming.on('open',()=>incoming.close());return;}bindConnection(incoming);});
 activePeer.on('error',err=>{clearTimeout(timeout);if(peer!==activePeer)return;roomStatus(`Could not connect (${err.type||'network error'}). Leave this room and try again, or play on one device.`);if(connection?.open)disconnected();});
 activePeer.on('disconnected',()=>{if(peer===activePeer&&!connection?.open)disconnected();});
}
$('#leave-button').addEventListener('click',async()=>{
 if(state.started&&!state.ended&&!await ask('Leave this room?','Disconnect from your friend? You can continue this game on one device, with the clocks paused.'))return;
 leaveRoom();$('#setup-form').elements.location.value='local';updateSetupOptions();toast('Back at the shared table.');
});
setInterval(()=>{
 const now=Date.now();const ended=state.ended;
 tick(state,now);if(role===1&&!ended&&state.ended)state.ended=null;renderClocks();
 if(!ended&&state.ended){resetDraft();save();sendState();render();}
 if(role===0&&now-syncAt>1000){sendState();syncAt=now;}
 if(now-saveAt>1000){save();saveAt=now;}
},100);
window.addEventListener('pagehide',save);render();
const urlRoom=new URL(location.href).searchParams.get('room');
if(urlRoom){openSetup();$('#setup-form').elements.location.value='online';$('#setup-form').elements.roomAction.value='join';$('#room-code').value=urlRoom;updateSetupOptions();roomStatus('You’ve been invited. Select Join game to take your seat as player two.');}
