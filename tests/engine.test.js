import test from 'node:test';
import assert from 'node:assert/strict';
import {BOARD_SIZE,BOARD_CELLS,upgradeGameBoard,MODES,PILE,total,newGame,timeOutSettings,tick,placement,segment,challenge,complete} from '../engine.js';
const active=(options={})=>{const s=newGame(options,0);s.started=true;return s;};
test('starting supply is exactly 37 tiles per player',()=>{assert.equal(total(PILE),37);const s=newGame();assert.equal(total(s.piles[0]),37);assert.equal(BOARD_SIZE,12);assert.equal(s.board.length,144);s.piles[0][0]--;assert.equal(s.piles[1][0],2);});
for(const [mode,[seconds,increment]] of Object.entries(MODES))test(`${mode} clock and increment`,()=>{const s=active({mode});tick(s,2000);assert.equal(s.clocks[0],seconds===null?null:seconds-2);complete(s,{action:'single',moves:[{index:44,digit:3}]},4000);assert.equal(s.clocks[0],seconds===null?null:seconds-4+increment);assert.equal(s.clocks[1],seconds);});
test('unstarted and paused clocks do not run',()=>{const s=newGame({},0);tick(s,10000);assert.equal(s.clocks[0],1200);s.started=true;s.paused=true;tick(s,20000);assert.equal(s.clocks[0],1200);assert.equal(s.elapsed,0);});
test('single drops can be isolated; zero cannot',()=>{const s=active();assert.doesNotThrow(()=>placement(s,'single',[{index:44,digit:3}]));assert.throws(()=>placement(s,'single',[{index:44,digit:0}]),/Zero/);s.board[43]=3;assert.doesNotThrow(()=>placement(s,'single',[{index:44,digit:0}]));});
test('double down cannot open the board; second tile may touch the first',()=>{const s=active();assert.throws(()=>placement(s,'double',[{index:44,digit:3},{index:45,digit:7}]),/touch/);s.board[43]=3;const p=placement(s,'double',[{index:44,digit:3},{index:45,digit:7}]);assert.equal(p.board[45],7);assert.equal(p.pile[7],4);assert.equal(s.board[44],null);});
test('adjacency does not wrap at 12-column boundaries or include diagonals',()=>{const s=active();s.board[11]=3;assert.throws(()=>placement(s,'double',[{index:12,digit:3},{index:13,digit:7}]),/touch/);s.board[11]=null;s.board[39]=7;assert.throws(()=>placement(s,'single',[{index:52,digit:0}]),/Zero/);});
test('cannot overspend a digit or overwrite a square',()=>{const s=active();s.board[44]=3;s.piles[0][7]=1;assert.throws(()=>placement(s,'double',[{index:45,digit:7},{index:46,digit:7}]),/No tiles/);assert.throws(()=>placement(s,'single',[{index:44,digit:7}]),/occupied/);});
test('partial double previews are allowed but cannot commit',()=>{const s=active();s.board[44]=3;assert.doesNotThrow(()=>placement(s,'double',[{index:45,digit:7}],true));assert.throws(()=>complete(s,{action:'double',moves:[{index:45,digit:7}]},0),/Place 2/);});
test('challenge segments must be straight and continuous',()=>{const b=Array(BOARD_CELLS).fill(null);b[13]=2;b[14]=1;b[15]=3;assert.deepEqual(segment(b,15,13),[13,14,15]);assert.throws(()=>segment(b,13,26),/straight/);assert.throws(()=>segment(b,13,16),/empty/);});
test('challenge reading direction changes divisibility',()=>{const s=active();s.board[44]=1;s.board[45]=4;assert.equal(challenge(s,44,45,false,'2').success,true);assert.equal(challenge(s,44,45,true,'2').success,false);assert.equal(challenge(s,44,45,true,'2').digits,'41');});
test('correct challenge transfers every selected tile to opponent',()=>{const s=active();s.board[44]=1;s.board[45]=4;const before=total(s.piles[1]);complete(s,{action:'challenge',a:44,b:45,reverse:false,factor:'2'},0);assert.equal(total(s.piles[1]),before+2);assert.equal(s.board[44],null);assert.equal(s.turn,1);});
test('failed challenge consumes a turn and receives increment',()=>{const s=active();s.board[44]=1;s.board[45]=3;complete(s,{action:'challenge',a:44,b:45,reverse:false,factor:'2'},1000);assert.equal(s.board[44],1);assert.equal(s.turn,1);assert.equal(s.clocks[0],1219);assert.equal(s.history[0].success,false);});
test('single-digit one and trivial factors cannot be challenged',()=>{const s=active();s.board[44]=1;assert.throws(()=>challenge(s,44,44,false,'2'),/cannot/);s.board[44]=4;for(const f of ['0','1','4','-2','2.5','x'])assert.throws(()=>challenge(s,44,44,false,f));});
test('zero, leading zeros and twelve-digit numbers are handled exactly',()=>{const s=active();s.board[0]=0;assert.equal(challenge(s,0,0,false,'2').success,true);s.board[1]=4;assert.equal(challenge(s,0,1,false,'2').digits,'04');s.board=Array(BOARD_CELLS).fill(null);'987654321012'.split('').forEach((n,i)=>s.board[i]=Number(n));assert.equal(challenge(s,0,11,false,'3').success,true);});
test('emptying a pile wins',()=>{const s=active();s.piles[0]=Array(10).fill(0);s.piles[0][7]=1;complete(s,{action:'single',moves:[{index:44,digit:7}]},0);assert.deepEqual(s.ended,{winner:0,reason:'by playing every tile'});});
test('timeout prevents late placement',()=>{const s=active({mode:'blitz'});assert.throws(()=>complete(s,{action:'single',moves:[{index:44,digit:7}]},600001),/over/);assert.equal(s.ended.winner,1);assert.equal(s.board[44],null);});
test('Time Out Rule defaults track ten completed moves with a continuous leader',()=>{const s=active({mode:'casual',timeOutRule:true});s.elapsed=3601;s.piles[1][1]+=20;for(let i=0;i<10;i++){complete(s,{action:'single',moves:[{index:i,digit:7}]},0);if(i<9)assert.equal(s.ended,null);}assert.equal(s.streak,10);assert.equal(s.ended.winner,0);});
test('tiles are conserved through moves and successful challenges',()=>{const s=active();complete(s,{action:'single',moves:[{index:44,digit:1}]},0);complete(s,{action:'single',moves:[{index:45,digit:4}]},0);complete(s,{action:'challenge',a:44,b:45,reverse:false,factor:'2'},0);assert.equal(total(s.piles[0])+total(s.piles[1])+s.board.filter(n=>n!==null).length,74);});

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
 const s=active();
 assert.doesNotThrow(()=>placement(s,'single',[{index:143,digit:7}]));
 assert.throws(()=>placement(s,'single',[{index:143,digit:0}]),/Zero/);
 s.board[131]=2;
 const p=placement(s,'double',[{index:143,digit:3},{index:142,digit:7}]);
 assert.equal(p.board[143],3);assert.equal(p.board[142],7);
 assert.doesNotThrow(()=>placement(s,'single',[{index:143,digit:0}]));
 for(const index of [-1,144,155,1.5])assert.throws(()=>placement(s,'single',[{index,digit:3}]),/square/);
});
test('a horizontal challenge spans all twelve squares of the last row in both directions',()=>{
 const s=active(),digits='987654321012';
 [...digits].forEach((d,x)=>s.board[132+x]=Number(d));
 assert.deepEqual(segment(s.board,143,132),Array.from({length:12},(_,i)=>132+i));
 assert.equal(challenge(s,132,143,false,'3').digits,digits);
 assert.equal(challenge(s,132,143,true,'3').digits,[...digits].reverse().join(''));
 const before=total(s.piles[1]);complete(s,{action:'challenge',a:132,b:143,reverse:false,factor:'3'},0);
 assert.equal(total(s.piles[1]),before+12);assert.equal(s.board.filter(d=>d!==null).length,0);
});
test('a vertical challenge spans the last column using a twelve-square stride',()=>{
 const s=active(),digits='987654321012';
 [...digits].forEach((d,y)=>s.board[y*12+11]=Number(d));
 assert.deepEqual(segment(s.board,143,11),Array.from({length:12},(_,y)=>y*12+11));
 assert.equal(challenge(s,11,143,false,'3').success,true);
 assert.equal(challenge(s,11,143,true,'3').digits,[...digits].reverse().join(''));
 assert.throws(()=>segment(s.board,11,144),/first and last/);
 assert.throws(()=>segment(s.board,131,132),/straight/);
});
test('legacy games expand without changing coordinates, clocks, supplies or history',()=>{
 const legacy=newGame({timeOutRule:true,timeOutSeconds:1200,timeOutMoves:4});
 legacy.board=Array(100).fill(null);legacy.board[99]=7;legacy.board[90]=3;legacy.board[9]=2;
 legacy.lastCells=[90,99];legacy.history=[{action:'single',moves:[{index:99,digit:7}]},{action:'challenge',cells:[9,19,29],digits:'247',factor:'13'}];
 legacy.clocks=[800,1000];legacy.started=true;legacy.elapsed=55;
 const before=JSON.stringify(legacy),expanded=upgradeGameBoard(legacy);
 assert.equal(expanded.board.length,144);assert.equal(expanded.board[117],7);assert.equal(expanded.board[108],3);assert.equal(expanded.board[9],2);
 assert.deepEqual(expanded.lastCells,[108,117]);assert.equal(expanded.history[0].moves[0].index,117);assert.deepEqual(expanded.history[1].cells,[9,21,33]);
 assert.equal(expanded.history[1].digits,'247');assert.equal(expanded.history[1].factor,'13');
 assert.deepEqual(expanded.clocks,legacy.clocks);assert.deepEqual(expanded.piles,legacy.piles);assert.deepEqual(timeOutSettings(expanded),timeOutSettings(legacy));assert.equal(expanded.elapsed,55);
 for(let y=0;y<12;y++)for(let x=0;x<12;x++)if(x>=10||y>=10)assert.equal(expanded.board[y*12+x],null);
 assert.equal(JSON.stringify(legacy),before);assert.equal(upgradeGameBoard(expanded),expanded);
});
