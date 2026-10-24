import test from 'node:test';
import assert from 'node:assert/strict';
import {BOARD_SIZES,PILE,total,newGame,placement,challengeNumber,challenge,complete,beginChallengeReview,finishChallengeReview,tick,isSupportedBoardState,RULES_VERSION} from '../engine.js';
const active=(size=13)=>({...newGame({boardSize:size},0),started:true});
const target=(digits='1437',player=0)=>{const s=active(digits.length>13?15:13);s.turn=player;[...digits].forEach((d,i)=>s.board[i]=Number(d));return s;};
const move=(factor,a=0,b=3)=>({action:'challenge',a,b,factor});
test('each player has two zeros, two fives, and 36 independent tiles',()=>{
 const s=newGame();assert.equal(PILE[0],2);assert.equal(PILE[5],2);assert.equal(total(PILE),36);assert.deepEqual(s.piles.map(total),[36,36]);
 s.piles[0][5]--;assert.equal(s.piles[1][5],2);assert.equal(s.rulesVersion,RULES_VERSION);
});
for(const size of BOARD_SIZES){
 const square=(x,y)=>y*size+x;
 test(`${size}: zero cannot be placed in isolation`,()=>{
  const empty=active(size);assert.throws(()=>placement(empty,'single',[{index:square(3,3),digit:0}]),/touch/);
  const s=active(size);s.board[square(2,3)]=1;assert.doesNotThrow(()=>placement(s,'single',[{index:square(3,3),digit:5}]));
 });
 for(const vertical of [false,true])test(`${size}: zero must be interior in a completed ${vertical?'vertical':'horizontal'} number`,()=>{
  const s=active(size),cells=[0,1,2].map(i=>vertical?square(3,i+2):square(i+2,3));s.board[cells[0]]=1;
  assert.throws(()=>placement(s,'single',[{index:cells[1],digit:0}]),/begin or end/);
  const before=structuredClone(s);assert.doesNotThrow(()=>placement(s,'double',[{index:cells[1],digit:0}],true));
  assert.deepEqual(s,before);
  assert.doesNotThrow(()=>placement(s,'double',[{index:cells[1],digit:0},{index:cells[2],digit:3}]));
  assert.throws(()=>placement(s,'double',[{index:cells[1],digit:3},{index:cells[2],digit:0}],true),/begin or end/);
  s.board[cells[2]]=7;assert.doesNotThrow(()=>placement(s,'single',[{index:cells[1],digit:0}]));
 });
 test(`${size}: crossing zero restrictions apply in both directions at completion`,()=>{
  const s=active(size),center=square(3,3),above=square(3,2),below=square(3,4);
  s.board[center-1]=1;s.board[center]=0;s.board[center+1]=7;
  assert.throws(()=>placement(s,'single',[{index:above,digit:3}]),/begin or end/);
  assert.doesNotThrow(()=>placement(s,'double',[{index:above,digit:3},{index:below,digit:1}]));
  s.board[below]=1;
  assert.doesNotThrow(()=>placement(s,'double',[{index:above,digit:3},{index:above-size,digit:7}]));
 });
 test(`${size}: zero checks never wrap board edges`,()=>{
  const s=active(size);s.board[size-1]=1;s.board[size+1]=3;
  assert.throws(()=>placement(s,'single',[{index:size,digit:0}]),/begin or end/);
 });
 for(const vertical of [false,true])for(const player of [0,1])test(`${size}: player ${player} can choose either ${vertical?'vertical':'horizontal'} reading`,()=>{
  const s=active(size),cells=[0,1].map(i=>vertical?square(3,i+2):square(i+2,3));s.turn=player;s.board[cells[0]]=4;s.board[cells[1]]=1;
  assert.equal(challengeNumber(s,...cells,false).digits,'41');assert.equal(challengeNumber(s,...cells,true).digits,'14');
  assert.equal(challenge(s,...cells,'2',false).success,false);assert.equal(challenge(s,...cells,'2',true).success,true);
 });
}
for(const player of [0,1])test(`player ${player} direction choice is independent of rotation and endpoint order`,()=>{
 for(const rotation of [0,1,2,3])for(const reverse of [false,true])for(const swap of [false,true]){
  const s=target(reverse?'41':'14',player);const result=complete(s,{action:'challenge',a:swap?1:0,b:swap?0:1,factor:'2',reverse,rotation},0);
  assert.equal(result.digits,'14');assert.equal(result.reverse,reverse);assert.equal(result.success,true);assert.deepEqual(result.taxedDigits,[1,4]);
 }
});
for(let digits=1;digits<=15;digits++)test(`${digits}-digit failure completes the turn with one factor proposal`,()=>{
 const s=target(digits===1?'4':'1'.repeat(digits)),before=structuredClone(s);
 const entry=complete(s,{action:'challenge',a:0,b:digits-1,factor:digits===1?'3':'2'},0);
 assert.equal(entry.success,false);assert.equal(entry.retry,undefined);assert.equal(s.challengeAttempt,null);
 assert.equal(s.turn,1);assert.equal(s.history.length,1);assert.equal(entry.attempts.length,1);assert.equal(entry.attemptLimit,undefined);
 assert.deepEqual(s.board,before.board);assert.deepEqual(s.piles,before.piles);assert.equal(total(s.taxed),0);assert.equal(s.clocks[0],1220);
 const clocks=s.clocks.slice(),review=beginChallengeReview(s,entry,0);tick(s,2999);assert.deepEqual(s.clocks,clocks);
 assert.equal(finishChallengeReview(s,review,3000),true);assert.equal(s.turn,1);assert.deepEqual(s.clocks,clocks);
 complete(s,{action:'single',moves:[{index:s.board.length-1,digit:7}]},3000);assert.equal(s.turn,0);assert.equal(s.history.length,2);
});
test('a successful challenge completes one turn and taxes both endpoints',()=>{
 const s=target(),entry=complete(s,move('3'),1000);
 assert.equal(entry.success,true);assert.equal(entry.attempts.length,1);assert.deepEqual(entry.taxedDigits,[1,7]);assert.equal(s.turn,1);assert.equal(s.history.length,1);assert.equal(s.clocks[0],1219);
});
test('the next player may independently challenge the same surviving number',()=>{
 const s=target();complete(s,move('2'),1000);assert.equal(s.turn,1);
 const result=complete(s,move('3'),2000);assert.equal(result.success,true);assert.equal(s.turn,0);assert.equal(s.history.length,2);assert.deepEqual(s.history.map(e=>e.attempts.length),[1,1]);
});
test('invalid factors leave the turn, board, and history unchanged',()=>{
 for(const factor of ['0','1','1437','x','2.5']){
  const s=target(),before=structuredClone(s);assert.throws(()=>complete(s,move(factor),0));assert.deepEqual(s,before);
 }
});
test('current saved and online states never allow pending retries',()=>{
 const s=target();complete(s,move('2'),0);const saved=JSON.parse(JSON.stringify(s));assert.ok(isSupportedBoardState(saved));assert.equal(saved.turn,1);
 for(const pending of [{},{player:1},{attempts:[]},true])assert.equal(isSupportedBoardState({...s,challengeAttempt:pending}),false);
 assert.equal(isSupportedBoardState({...s,rulesVersion:14}),false);
});
test('a challenge submitted after the clock expires earns no increment or history entry',()=>{
 const s=target();s.clocks[0]=1;assert.throws(()=>complete(s,move('3'),1001),/over/);assert.equal(s.ended.winner,1);assert.equal(s.clocks[0],0);assert.equal(s.history.length,0);
});
test('one failed challenge counts as one Time Out Rule move',()=>{
 const s=target();Object.assign(s,{timeOutRule:true,timeOutSeconds:1,elapsed:5,leader:0,streak:1});s.piles[1][1]+=10;
 complete(s,move('2'),0);assert.equal(s.streak,2);assert.equal(s.history.length,1);
});
test('per-digit supply is conserved after placements and a successful challenge',()=>{
 const s=active();complete(s,{action:'single',moves:[{index:0,digit:1}]},0);complete(s,{action:'double',moves:[{index:1,digit:4},{index:2,digit:3}]},0);complete(s,{action:'single',moves:[{index:3,digit:7}]},0);
 complete(s,move('3'),0);
 for(let d=0;d<10;d++)assert.equal(s.piles[0][d]+s.piles[1][d]+s.taxed[d]+s.board.filter(n=>n===d).length,2*PILE[d]);
 assert.equal(total(s.piles[0])+total(s.piles[1])+total(s.taxed)+s.board.filter(n=>n!==null).length,72);
});
