import test from 'node:test';
import assert from 'node:assert/strict';
import {BOARD_SIZE,BOARD_CELLS,upgradeGameBoard,MODES,PILE,total,newGame,timeOutSettings,tick,placement,segment,challenge as checkChallenge,complete} from '../engine.js';
// Exercise both fixed player perspectives without an arbitrary reading-direction option.
const challenge=(s,a,b,reverse,factor)=>checkChallenge({...s,turn:reverse?1:0},a,b,factor);
const square=(x,y)=>y*BOARD_SIZE+x;
const active=(options={})=>{const s=newGame(options,0);s.started=true;return s;};
test('starting supply is exactly 36 tiles per player',()=>{assert.equal(total(PILE),36);const s=newGame();assert.equal(total(s.piles[0]),36);assert.equal(BOARD_SIZE,11);assert.equal(s.board.length,121);s.piles[0][0]--;assert.equal(s.piles[1][0],2);});
for(const [mode,[seconds,increment]] of Object.entries(MODES))test(`${mode} clock and increment`,()=>{const s=active({mode});tick(s,2000);assert.equal(s.clocks[0],seconds===null?null:seconds-2);complete(s,{action:'single',moves:[{index:square(4,4),digit:3}]},4000);assert.equal(s.clocks[0],seconds===null?null:seconds-4+increment);assert.equal(s.clocks[1],seconds);});
test('unstarted and paused clocks do not run',()=>{const s=newGame({},0);tick(s,10000);assert.equal(s.clocks[0],1200);s.started=true;s.paused=true;tick(s,20000);assert.equal(s.clocks[0],1200);assert.equal(s.elapsed,0);});
test('single drops can be isolated; zero cannot',()=>{const s=active();assert.doesNotThrow(()=>placement(s,'single',[{index:square(4,4),digit:3}]));assert.throws(()=>placement(s,'single',[{index:square(4,4),digit:0}]),/Zero/);s.board[square(3,4)]=3;assert.throws(()=>placement(s,'single',[{index:square(4,4),digit:0}]),/begin or end/);s.board[square(5,4)]=7;assert.doesNotThrow(()=>placement(s,'single',[{index:square(4,4),digit:0}]));});
test('double down cannot open the board; second tile may touch the first',()=>{const s=active();assert.throws(()=>placement(s,'double',[{index:square(4,4),digit:3},{index:square(5,4),digit:7}]),/touch/);s.board[square(3,4)]=3;const p=placement(s,'double',[{index:square(4,4),digit:3},{index:square(5,4),digit:7}]);assert.equal(p.board[square(5,4)],7);assert.equal(p.pile[7],4);assert.equal(s.board[square(4,4)],null);});
test('adjacency does not wrap at 11-column boundaries or include diagonals',()=>{
 const s=active();s.board[square(10,0)]=3;
 assert.throws(()=>placement(s,'double',[{index:square(0,1),digit:3},{index:square(1,1),digit:7}]),/touch/);
 s.board[square(10,0)]=null;s.board[square(3,3)]=7;
 assert.throws(()=>placement(s,'single',[{index:square(4,4),digit:0}]),/Zero/);
});
test('cannot overspend a digit or overwrite a square',()=>{const s=active();s.board[square(4,4)]=3;s.piles[0][7]=1;assert.throws(()=>placement(s,'double',[{index:square(5,4),digit:7},{index:square(6,4),digit:7}]),/No tiles/);assert.throws(()=>placement(s,'single',[{index:square(4,4),digit:7}]),/occupied/);});
test('partial double previews are allowed but cannot commit',()=>{const s=active();s.board[square(4,4)]=3;assert.doesNotThrow(()=>placement(s,'double',[{index:square(5,4),digit:7}],true));assert.throws(()=>complete(s,{action:'double',moves:[{index:square(5,4),digit:7}]},0),/Place 2/);});
test('challenge segments must be straight and continuous',()=>{
 const b=Array(BOARD_CELLS).fill(null),a=square(1,1);b[a]=2;b[a+1]=1;b[a+2]=3;
 assert.deepEqual(segment(b,a+2,a),[a,a+1,a+2]);
 assert.throws(()=>segment(b,a,square(2,2)),/straight/);assert.throws(()=>segment(b,a,a+3),/empty/);
});
test('challenge reading direction changes divisibility',()=>{const s=active();s.board[square(4,4)]=1;s.board[square(5,4)]=4;assert.equal(challenge(s,square(4,4),square(5,4),false,'2').success,true);assert.equal(challenge(s,square(4,4),square(5,4),true,'2').success,false);assert.equal(challenge(s,square(4,4),square(5,4),true,'2').digits,'41');});
test('correct challenge transfers all but the final tile and taxes that tile',()=>{const s=active();s.board[square(4,4)]=1;s.board[square(5,4)]=4;const before=total(s.piles[1]);complete(s,{action:'challenge',a:square(4,4),b:square(5,4),reverse:false,factor:'2'},0);assert.equal(total(s.piles[1]),before+1);assert.equal(s.taxed[4],1);assert.equal(s.board[square(4,4)],null);assert.equal(s.turn,1);});
test('failed challenge consumes a turn and receives increment',()=>{const s=active();s.board[square(4,4)]=1;s.board[square(5,4)]=3;complete(s,{action:'challenge',a:square(4,4),b:square(5,4),reverse:false,factor:'2'},1000);assert.equal(s.board[square(4,4)],1);assert.equal(s.turn,1);assert.equal(s.clocks[0],1219);assert.equal(s.history[0].success,false);});
test('single-digit one and trivial factors cannot be challenged',()=>{const s=active();s.board[square(4,4)]=1;assert.throws(()=>challenge(s,square(4,4),square(4,4),false,'2'),/cannot/);s.board[square(4,4)]=4;for(const f of ['0','1','4','-2','2.5','x'])assert.throws(()=>challenge(s,square(4,4),square(4,4),false,f));});
test('zero, leading zeros and eleven-digit numbers are handled exactly',()=>{const s=active();s.board[0]=0;assert.equal(challenge(s,0,0,false,'2').success,true);s.board[1]=4;assert.equal(challenge(s,0,1,false,'2').digits,'04');s.board=Array(BOARD_CELLS).fill(null);'98765432103'.split('').forEach((n,i)=>s.board[i]=Number(n));assert.equal(challenge(s,0,10,false,'3').success,true);});
test('emptying a pile wins',()=>{const s=active();s.piles[0]=Array(10).fill(0);s.piles[0][7]=1;complete(s,{action:'single',moves:[{index:square(4,4),digit:7}]},0);assert.deepEqual(s.ended,{winner:0,reason:'by playing every tile'});});
test('timeout prevents late placement',()=>{const s=active({mode:'blitz'});assert.throws(()=>complete(s,{action:'single',moves:[{index:square(4,4),digit:7}]},600001),/over/);assert.equal(s.ended.winner,1);assert.equal(s.board[square(4,4)],null);});
test('Time Out Rule defaults track ten completed moves with a continuous leader',()=>{const s=active({mode:'casual',timeOutRule:true});s.elapsed=3601;s.piles[1][1]+=20;for(let i=0;i<10;i++){complete(s,{action:'single',moves:[{index:i,digit:7}]},0);if(i<9)assert.equal(s.ended,null);}assert.equal(s.streak,10);assert.equal(s.ended.winner,0);});
test('tiles are conserved through moves and successful challenges',()=>{const s=active();complete(s,{action:'single',moves:[{index:square(4,4),digit:1}]},0);complete(s,{action:'single',moves:[{index:square(5,4),digit:4}]},0);complete(s,{action:'challenge',a:square(4,4),b:square(5,4),reverse:false,factor:'2'},0);assert.equal(total(s.taxed)+total(s.piles[0])+total(s.piles[1])+s.board.filter(n=>n!==null).length,72);});

test('custom Time Out Rule starts exactly at the configured duration',()=>{
 const s=active({mode:'casual',timeOutRule:true,timeOutSeconds:1200,timeOutMoves:3});s.piles[1][1]+=20;
 s.elapsed=1199;complete(s,{action:'single',moves:[{index:0,digit:7}]},0);assert.equal(s.streak,0);
 s.elapsed=1200;for(let i=1;i<=3;i++){complete(s,{action:'single',moves:[{index:i,digit:7}]},0);assert.equal(s.streak,i);if(i<3)assert.equal(s.ended,null);}
 assert.deepEqual(s.ended,{winner:0,reason:'by the Time Out Rule'});
});
test('a tie resets the Time Out streak and a new leader starts at one',()=>{
 const s=active({mode:'casual',timeOutRule:true,timeOutSeconds:60,timeOutMoves:4});s.elapsed=60;s.leader=0;s.streak=2;
 s.piles=[Array(10).fill(0),Array(10).fill(0)];s.piles[0][7]=4;s.piles[1][7]=3;
 complete(s,{action:'single',moves:[{index:0,digit:7}]},0);assert.equal(s.streak,0);assert.equal(s.leader,null);
 complete(s,{action:'single',moves:[{index:1,digit:7}]},0);assert.equal(s.streak,1);assert.equal(s.leader,1);assert.equal(s.ended,null);
 s.leader=0;s.streak=3;complete(s,{action:'single',moves:[{index:2,digit:7}]},0);assert.equal(s.streak,0);assert.equal(s.ended,null);
});
test('changing leaders resets a nonzero streak',()=>{
 const s=active({mode:'casual',timeOutRule:true,timeOutSeconds:60,timeOutMoves:4});s.elapsed=60;s.turn=1;s.leader=0;s.streak=3;
 s.piles=[Array(10).fill(0),Array(10).fill(0)];s.piles[0][7]=3;s.piles[1][7]=3;
 complete(s,{action:'single',moves:[{index:0,digit:7}]},0);assert.equal(s.leader,1);assert.equal(s.streak,1);assert.equal(s.ended,null);
});
test('the disabled Time Out Rule never counts a streak',()=>{
 const s=active({mode:'casual',timeOutRule:false,timeOutSeconds:60,timeOutMoves:1});s.elapsed=7200;
 complete(s,{action:'single',moves:[{index:0,digit:7}]},0);assert.equal(s.streak,0);assert.equal(s.ended,null);
});
test('Time Out settings survive serialization and starting an online game',()=>{
 const s=newGame({timeOutRule:true,timeOutSeconds:2700,timeOutMoves:6});const saved=JSON.parse(JSON.stringify(s));
 const online=newGame({...timeOutSettings(saved)});assert.equal(online.timeOutRule,true);assert.equal(online.timeOutSeconds,2700);assert.equal(online.timeOutMoves,6);
});
test('legacy saved games keep the former one-hour defaults',()=>{
 assert.deepEqual(timeOutSettings({hourRule:true}),{timeOutRule:true,timeOutSeconds:3600,timeOutMoves:10});
 assert.equal(timeOutSettings({hourRule:true,timeOutRule:false}).timeOutRule,false);
});
test('invalid Time Out settings cannot start a game',()=>{
 for(const n of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){assert.throws(()=>newGame({timeOutSeconds:n}),/duration/);assert.throws(()=>newGame({timeOutMoves:n}),/consecutive/);}
});
test('playing every tile retains priority over the Time Out Rule',()=>{
 const s=active({mode:'casual',timeOutRule:true,timeOutSeconds:1,timeOutMoves:1});s.elapsed=2;s.piles[0]=Array(10).fill(0);s.piles[0][7]=1;
 complete(s,{action:'single',moves:[{index:0,digit:7}]},0);assert.equal(s.ended.reason,'by playing every tile');
});

test('new rows and columns accept placements with normal adjacency rules',()=>{
 const s=active(),last=BOARD_CELLS-1;
 assert.doesNotThrow(()=>placement(s,'single',[{index:last,digit:7}]));
 assert.throws(()=>placement(s,'single',[{index:last,digit:0}]),/Zero/);
 s.board[last-BOARD_SIZE]=2;
 const p=placement(s,'double',[{index:last,digit:3},{index:last-1,digit:7}]);
 assert.equal(p.board[last],3);assert.equal(p.board[last-1],7);
 assert.throws(()=>placement(s,'single',[{index:last,digit:0}]),/begin or end/);
 for(const index of [-1,BOARD_CELLS,BOARD_CELLS+11,1.5])assert.throws(()=>placement(s,'single',[{index,digit:3}]),/square/);
});
test('a horizontal challenge spans all eleven squares of the last row in both directions',()=>{
 const s=active(),digits='98765432103',start=square(0,10),last=BOARD_CELLS-1;
 [...digits].forEach((d,x)=>s.board[start+x]=Number(d));
 assert.deepEqual(segment(s.board,last,start),Array.from({length:11},(_,i)=>start+i));
 assert.equal(challenge(s,start,last,false,'3').digits,digits);
 assert.equal(challenge(s,start,last,true,'3').digits,[...digits].reverse().join(''));
 const before=total(s.piles[1]);complete(s,{action:'challenge',a:start,b:last,reverse:false,factor:'3'},0);
 assert.equal(total(s.piles[1]),before+10);assert.equal(s.board.filter(d=>d!==null).length,0);
});
test('a vertical challenge spans the last column using a eleven-square stride',()=>{
 const s=active(),digits='98765432103',last=BOARD_CELLS-1;
 [...digits].forEach((d,y)=>s.board[square(10,y)]=Number(d));
 assert.deepEqual(segment(s.board,last,10),Array.from({length:11},(_,y)=>square(10,y)));
 assert.equal(challenge(s,10,last,false,'3').success,true);
 assert.equal(challenge(s,10,last,true,'3').digits,[...digits].reverse().join(''));
 assert.throws(()=>segment(s.board,10,BOARD_CELLS),/first and last/);
 assert.throws(()=>segment(s.board,square(10,9),square(0,10)),/straight/);
});
for(const oldSize of [10])test(`saved ${oldSize} by ${oldSize} games expand with coordinates, clocks, supplies and history preserved`,()=>{
 const legacy=newGame({timeOutRule:true,timeOutSeconds:1200,timeOutMoves:4});
 const last=oldSize*oldSize-1,bottomLeft=oldSize*(oldSize-1),topRight=oldSize-1;
 legacy.board=Array(oldSize*oldSize).fill(null);legacy.board[last]=7;legacy.board[bottomLeft]=3;legacy.board[topRight]=2;
 legacy.lastCells=[bottomLeft,last];legacy.history=[{action:'single',moves:[{index:last,digit:7}]},{action:'challenge',cells:[topRight,topRight+oldSize,topRight+2*oldSize],digits:'247',factor:'13'}];
 legacy.clocks=[800,1000];legacy.started=true;legacy.elapsed=55;
 const before=JSON.stringify(legacy),expanded=upgradeGameBoard(legacy);
 assert.equal(expanded.board.length,121);assert.equal(expanded.board[square(oldSize-1,oldSize-1)],7);assert.equal(expanded.board[square(0,oldSize-1)],3);assert.equal(expanded.board[topRight],2);
 assert.deepEqual(expanded.lastCells,[square(0,oldSize-1),square(oldSize-1,oldSize-1)]);assert.equal(expanded.history[0].moves[0].index,square(oldSize-1,oldSize-1));assert.deepEqual(expanded.history[1].cells,[topRight,topRight+BOARD_SIZE,topRight+2*BOARD_SIZE]);
 assert.equal(expanded.history[1].digits,'247');assert.equal(expanded.history[1].factor,'13');
 assert.deepEqual(expanded.clocks,legacy.clocks);assert.deepEqual(expanded.piles,legacy.piles);assert.deepEqual(timeOutSettings(expanded),timeOutSettings(legacy));assert.equal(expanded.elapsed,55);
 for(let y=0;y<BOARD_SIZE;y++)for(let x=0;x<BOARD_SIZE;x++)if(x>=oldSize||y>=oldSize)assert.equal(expanded.board[square(x,y)],null);
 assert.equal(JSON.stringify(legacy),before);assert.equal(upgradeGameBoard(expanded),expanded);
});

test('horizontal challenges must include the full run in either reading direction',()=>{
 const s=active(),a=square(3,5);[1,4,3,7].forEach((digit,i)=>s.board[a+i]=digit);
 for(const [start,end] of [[a,a+2],[a+1,a+3],[a+1,a+2]])for(const reverse of [false,true]){
  assert.throws(()=>challenge(s,start,end,reverse,'3'),/whole uninterrupted/);
  assert.throws(()=>challenge(s,end,start,reverse,'3'),/whole uninterrupted/);
 }
 assert.equal(challenge(s,a,a+3,false,'3').digits,'1437');
 assert.equal(challenge(s,a+3,a,true,'3').digits,'7341');
});
test('vertical challenges must include the full run in either reading direction',()=>{
 const s=active(),cells=[3,4,5,6].map(y=>square(6,y));[1,4,3,7].forEach((digit,i)=>s.board[cells[i]]=digit);
 for(const [start,end] of [[cells[0],cells[2]],[cells[1],cells[3]],[cells[1],cells[2]]])for(const reverse of [false,true])assert.throws(()=>challenge(s,start,end,reverse,'3'),/whole uninterrupted/);
 assert.equal(challenge(s,cells[0],cells[3],false,'3').digits,'1437');
 assert.equal(challenge(s,cells[3],cells[0],true,'3').digits,'7341');
});
test('a single-digit challenge is rejected for every edge-adjacent neighbor',()=>{
 const a=square(5,5);
 for(const neighbor of [square(4,5),square(6,5),square(5,4),square(5,6)]){
  const s=active();s.board[a]=4;s.board[neighbor]=1;
  assert.throws(()=>challenge(s,a,a,false,'2'),/isolated tile/);
 }
});
test('isolated composite digits remain challengeable and diagonal neighbors are allowed',()=>{
 const s=active();s.board[square(0,0)]=4;s.board[square(1,1)]=7;
 assert.equal(challenge(s,square(0,0),square(0,0),false,'2').success,true);
 const before=total(s.piles[1]);complete(s,{action:'challenge',a:0,b:0,reverse:false,factor:'2'},0);
 assert.equal(s.board[0],null);assert.equal(total(s.piles[1]),before);assert.equal(s.taxed[4],1);
});
test('perpendicular crossings do not extend a multi-digit challenge',()=>{
 const s=active();s.board[square(4,4)]=1;s.board[square(5,4)]=4;s.board[square(6,4)]=7;
 s.board[square(5,3)]=2;s.board[square(5,5)]=6;
 assert.equal(challenge(s,square(4,4),square(6,4),false,'3').digits,'147');
 assert.equal(challenge(s,square(5,3),square(5,5),false,'2').digits,'246');
});
test('row-edge isolation and full-number boundaries never wrap into another row',()=>{
 const left=active();left.board[square(10,4)]=3;left.board[square(0,5)]=1;left.board[square(1,5)]=4;
 assert.equal(challenge(left,square(0,5),square(1,5),false,'2').digits,'14');
 const right=active();right.board[square(9,5)]=1;right.board[square(10,5)]=4;right.board[square(0,6)]=3;
 assert.equal(challenge(right,square(9,5),square(10,5),false,'2').digits,'14');
 const isolated=active();isolated.board[square(10,4)]=3;isolated.board[square(0,5)]=4;
 assert.equal(challenge(isolated,square(0,5),square(0,5),false,'2').success,true);
});
test('zero tiles at either end cannot be omitted from a challenge',()=>{
 const s=active();s.board[0]=1;s.board[1]=4;s.board[2]=0;
 assert.throws(()=>challenge(s,0,1,false,'2'),/whole uninterrupted/);
 assert.equal(challenge(s,0,2,false,'2').digits,'140');
 s.board[0]=0;s.board[1]=1;s.board[2]=4;
 assert.throws(()=>challenge(s,1,2,false,'2'),/whole uninterrupted/);
 assert.equal(challenge(s,0,2,false,'2').digits,'014');
});
test('invalid partial and connected-single challenges do not consume a move or transfer tiles',()=>{
 const s=active(),a=square(4,4);s.board[a]=1;s.board[a+1]=4;s.board[a+2]=7;
 const before=JSON.parse(JSON.stringify(s));
 assert.throws(()=>complete(s,{action:'challenge',a,b:a+1,reverse:false,factor:'2'},0),/whole uninterrupted/);
 assert.deepEqual(s,before);
 assert.throws(()=>complete(s,{action:'challenge',a:a+1,b:a+1,reverse:false,factor:'2'},0),/isolated tile/);
 assert.deepEqual(s,before);
});

for(const oldSize of [12,17])test(`larger ${oldSize} by ${oldSize} saved boards are rejected without truncating their tiles`,()=>{
 const s=newGame();s.board=Array(oldSize*oldSize).fill(null);s.board[s.board.length-1]=7;const before=JSON.stringify(s);
 assert.throws(()=>upgradeGameBoard(s),/unsupported/);assert.equal(JSON.stringify(s),before);
});
