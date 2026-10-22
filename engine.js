export const BOARD_SIZE = 11;
export const BOARD_CELLS = BOARD_SIZE * BOARD_SIZE;
export const BOARD_SIZES = [9,11,13];
export function getBoardSize(board){
 const size=Array.isArray(board)?Math.sqrt(board.length):0;
 if(!BOARD_SIZES.includes(size))throw Error('This board size is unsupported.');
 return size;
}
export function isSupportedBoardState(state){return !!state&&BOARD_SIZES.includes(state.boardSize)&&Array.isArray(state.board)&&state.board.length===state.boardSize**2&&Array.isArray(state.taxed)&&state.taxed.length===10&&state.taxed.every(n=>Number.isSafeInteger(n)&&n>=0);}
export const RULES_VERSION = 4;
export const MODES = {blitz:[600,10],rapid:[1200,20],standard:[1800,30],classical:[2700,60],casual:[null,0]};
export const PILE = [2,5,3,5,3,3,3,5,3,5];
export const total = pile => pile.reduce((a,b)=>a+b,0);
export function timeOutSettings({timeOutRule,hourRule=false,timeOutSeconds=3600,timeOutMoves=10}={}) {
  if(!Number.isSafeInteger(timeOutSeconds)||timeOutSeconds<1)throw Error('Choose a positive whole-number time out duration.');
  if(!Number.isSafeInteger(timeOutMoves)||timeOutMoves<1)throw Error('Choose a positive whole number of consecutive moves.');
  return {timeOutRule:timeOutRule??hourRule,timeOutSeconds,timeOutMoves};
}
export function newGame(options={},now=Date.now()) {
  const {mode='rapid',names=['Player one','Player two'],first=0,boardSize=BOARD_SIZE}=options;
  if(!BOARD_SIZES.includes(boardSize))throw Error('Choose a 9 × 9, 11 × 11, or 13 × 13 board.');
  if (!MODES[mode]) throw Error('Choose a valid time control.');
  return {boardSize,board:Array(boardSize*boardSize).fill(null),piles:[PILE.slice(),PILE.slice()],taxed:Array(10).fill(0),names:names.map((n,i)=>String(n).trim().slice(0,24)||`Player ${i+1}`),mode,turn:first===1?1:0,clocks:[MODES[mode][0],MODES[mode][0]],increment:MODES[mode][1],started:false,paused:false,ended:null,lastTick:now,elapsed:0,...timeOutSettings(options),leader:null,streak:0,history:[],lastCells:[],revision:0};
}
export function tick(s,now=Date.now()) {
  const seconds=Math.max(0,now-s.lastTick)/1000;s.lastTick=now;
  if (!s.started||s.paused||s.ended) return;
  s.elapsed+=seconds;
  if(s.clocks[s.turn]!==null){s.clocks[s.turn]=Math.max(0,s.clocks[s.turn]-seconds);if(s.clocks[s.turn]===0)s.ended={winner:1-s.turn,reason:'on time'};}
}
export function adjacent(board,index){const size=getBoardSize(board),x=index%size,y=Math.floor(index/size);return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([a,b])=>a>=0&&a<size&&b>=0&&b<size&&board[b*size+a]!==null);}
export function placement(s,action,moves,partial=false){
  const boardCells=s.board.length;getBoardSize(s.board);
  const count=action==='single'?1:action==='double'?2:0;
  if(!count||moves.length<1||moves.length>count||(!partial&&moves.length!==count))throw Error(`Place ${count||'one or two'} tiles to complete this move.`);
  const board=s.board.slice(),pile=s.piles[s.turn].slice();
  for(const m of moves){
    if(!Number.isInteger(m.index)||m.index<0||m.index>=boardCells||!Number.isInteger(m.digit)||m.digit<0||m.digit>9)throw Error('Choose a board square and digit.');
    if(board[m.index]!==null)throw Error('That square is occupied.');
    if(!pile[m.digit])throw Error('No tiles of that digit remain.');
    if((action==='double'||m.digit===0)&&!adjacent(board,m.index))throw Error(m.digit===0?'Zero must touch another tile.':'Each Double Down tile must touch an existing tile.');
    board[m.index]=m.digit;pile[m.digit]--;
  }return {board,pile};
}
export function segment(board,a,b){
  const size=getBoardSize(board),boardCells=board.length;
  if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=boardCells||b>=boardCells)throw Error('Select the first and last tile of a number.');
  if(Math.floor(a/size)!==Math.floor(b/size)&&a%size!==b%size)throw Error('Choose a straight horizontal or vertical number.');
  const step=a===b?1:Math.floor(a/size)===Math.floor(b/size)?1:size,lo=Math.min(a,b),hi=Math.max(a,b),cells=[];
  for(let i=lo;i<=hi;i+=step){if(board[i]===null)throw Error('A challenged number cannot contain empty squares.');cells.push(i);}
  if(a===b){
    if(adjacent(board,a))throw Error('Single-digit challenges require an isolated tile with no edge-adjacent tiles.');
  }else{
    const before=step===1?(lo%size>0?lo-1:null):(lo>=size?lo-size:null);
    const after=step===1?(hi%size<size-1?hi+1:null):(hi+size<boardCells?hi+size:null);
    if((before!==null&&board[before]!==null)||(after!==null&&board[after]!==null))throw Error('Select both ends of the whole uninterrupted number.');
  }
  return cells;
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
    entry={action:'challenge',player:actor,...c};
    if(c.success){
      // The reading direction, rather than endpoint click order, determines the tax.
      const taxedCell=command.reverse?c.cells[0]:c.cells.at(-1),taxedDigit=s.board[taxedCell];
      for(const i of c.cells){if(i===taxedCell)s.taxed[s.board[i]]++;else s.piles[1-actor][s.board[i]]++;s.board[i]=null;}
      Object.assign(entry,{taxedCell,taxedDigit,transferredCount:c.cells.length-1});
    }
    s.lastCells=c.cells;
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

// Expand the former board without moving a tile to a different coordinate.
export function upgradeGameBoard(state){
  const size=Math.sqrt(state.board.length);
  if(BOARD_SIZES.includes(size)){
    if(state.boardSize!==undefined&&state.boardSize!==size)throw Error('The saved board dimensions do not match.');
    if(state.taxed!==undefined&&(!Array.isArray(state.taxed)||state.taxed.length!==10||!state.taxed.every(n=>Number.isSafeInteger(n)&&n>=0)))throw Error('The saved taxation counts are invalid.');
    return state.boardSize===size&&state.taxed!==undefined?state:{...state,boardSize:size,taxed:state.taxed??Array(10).fill(0)};
  }
  const oldSize=state.board.length===100?10:null;
  if(!oldSize)throw Error('This saved board size is unsupported.');
  const remap=index=>Math.floor(index/oldSize)*BOARD_SIZE+index%oldSize;
  const board=Array(BOARD_CELLS).fill(null);
  state.board.forEach((digit,index)=>{board[remap(index)]=digit;});
  return {...state,taxed:state.taxed??Array(10).fill(0),boardSize:BOARD_SIZE,board,lastCells:state.lastCells.map(remap),history:state.history.map(entry=>({
    ...entry,...(entry.moves?{moves:entry.moves.map(move=>({...move,index:remap(move.index)}))}:{}),
    ...(entry.cells?{cells:entry.cells.map(remap)}:{})
  }))};
}
