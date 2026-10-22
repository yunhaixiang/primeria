export const MODES = {blitz:[600,10],rapid:[1200,20],standard:[1800,30],classical:[2700,60],casual:[null,0]};
export const PILE = [2,5,3,5,3,3,3,5,3,5];
export const total = pile => pile.reduce((a,b)=>a+b,0);
export function timeOutSettings({timeOutRule,hourRule=false,timeOutSeconds=3600,timeOutMoves=10}={}) {
  if(!Number.isSafeInteger(timeOutSeconds)||timeOutSeconds<1)throw Error('Choose a positive whole-number time out duration.');
  if(!Number.isSafeInteger(timeOutMoves)||timeOutMoves<1)throw Error('Choose a positive whole number of consecutive moves.');
  return {timeOutRule:timeOutRule??hourRule,timeOutSeconds,timeOutMoves};
}
export function newGame(options={},now=Date.now()) {
  const {mode='rapid',names=['Player one','Player two'],first=0}=options;
  if (!MODES[mode]) throw Error('Choose a valid time control.');
  return {board:Array(100).fill(null),piles:[PILE.slice(),PILE.slice()],names:names.map((n,i)=>String(n).trim().slice(0,24)||`Player ${i+1}`),mode,turn:first===1?1:0,clocks:[MODES[mode][0],MODES[mode][0]],increment:MODES[mode][1],started:false,paused:false,ended:null,lastTick:now,elapsed:0,...timeOutSettings(options),leader:null,streak:0,history:[],lastCells:[],revision:0};
}
export function tick(s,now=Date.now()) {
  const seconds=Math.max(0,now-s.lastTick)/1000;s.lastTick=now;
  if (!s.started||s.paused||s.ended) return;
  s.elapsed+=seconds;
  if(s.clocks[s.turn]!==null){s.clocks[s.turn]=Math.max(0,s.clocks[s.turn]-seconds);if(s.clocks[s.turn]===0)s.ended={winner:1-s.turn,reason:'on time'};}
}
export function adjacent(board,index){const x=index%10,y=Math.floor(index/10);return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([a,b])=>a>=0&&a<10&&b>=0&&b<10&&board[b*10+a]!==null);}
export function placement(s,action,moves,partial=false){
  const count=action==='single'?1:action==='double'?2:0;
  if(!count||moves.length<1||moves.length>count||(!partial&&moves.length!==count))throw Error(`Place ${count||'one or two'} tiles to complete this move.`);
  const board=s.board.slice(),pile=s.piles[s.turn].slice();
  for(const m of moves){
    if(!Number.isInteger(m.index)||m.index<0||m.index>99||!Number.isInteger(m.digit)||m.digit<0||m.digit>9)throw Error('Choose a board square and digit.');
    if(board[m.index]!==null)throw Error('That square is occupied.');
    if(!pile[m.digit])throw Error('No tiles of that digit remain.');
    if((action==='double'||m.digit===0)&&!adjacent(board,m.index))throw Error(m.digit===0?'Zero must touch another tile.':'Each Double Down tile must touch an existing tile.');
    board[m.index]=m.digit;pile[m.digit]--;
  }return {board,pile};
}
export function segment(board,a,b){
  if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>99||b>99)throw Error('Select the first and last tile of a number.');
  if(Math.floor(a/10)!==Math.floor(b/10)&&a%10!==b%10)throw Error('Choose a straight horizontal or vertical number.');
  const step=a===b?1:Math.floor(a/10)===Math.floor(b/10)?1:10,lo=Math.min(a,b),hi=Math.max(a,b),cells=[];
  for(let i=lo;i<=hi;i+=step){if(board[i]===null)throw Error('A challenged number cannot contain empty squares.');cells.push(i);}return cells;
}
export function challenge(s,a,b,reverse,factor){
  const cells=segment(s.board,a,b),digits=(reverse?cells.slice().reverse():cells).map(i=>s.board[i]).join('');
  if(!/^\d{1,20}$/.test(String(factor)))throw Error('Enter a whole-number factor greater than 1.');
  const n=BigInt(digits),f=BigInt(factor);
  if(n===1n)throw Error('The number 1 cannot be challenged.');
  if(f<=1n||(n!==0n&&f>=n))throw Error('Use a nontrivial factor: greater than 1 and smaller than the number.');
  return {cells,digits,factor:String(f),success:n%f===0n,quotient:String(n/f),remainder:String(n%f)};
}
export function complete(s,command,now=Date.now()){
  tick(s,now);if(s.ended)throw Error('This game is over.');if(!s.started||s.paused)throw Error('Start or resume the game first.');
  const actor=s.turn;let entry;
  if(command.action==='challenge'){
    const c=challenge(s,command.a,command.b,command.reverse,command.factor);
    if(c.success)for(const i of c.cells){s.piles[1-actor][s.board[i]]++;s.board[i]=null;}
    entry={action:'challenge',player:actor,...c};s.lastCells=c.cells;
  }else{
    const p=placement(s,command.action,command.moves);s.board=p.board;s.piles[actor]=p.pile;s.lastCells=command.moves.map(m=>m.index);
    entry={action:command.action,player:actor,moves:command.moves};
  }
  if(s.clocks[actor]!==null)s.clocks[actor]+=s.increment;
  s.history.push(entry);s.revision++;
  if(total(s.piles[actor])===0)s.ended={winner:actor,reason:'by playing every tile'};
  const rule=timeOutSettings(s);
  if(rule.timeOutRule&&s.elapsed>=rule.timeOutSeconds){const a=total(s.piles[0]),b=total(s.piles[1]),leader=a===b?null:a<b?0:1;s.streak=leader!==null&&leader===s.leader?s.streak+1:leader===null?0:1;s.leader=leader;if(!s.ended&&s.streak>=rule.timeOutMoves)s.ended={winner:leader,reason:'by the Time Out Rule'};}
  s.turn=1-actor;s.lastTick=now;return entry;
}
