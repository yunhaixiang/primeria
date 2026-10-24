import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,complete,challenge,upgradeGameBoard,isSupportedBoardState} from '../engine.js';
import {pointedChallenge,challengeReadingChoices} from '../challenge-selection.js';
import {createBot} from '../bot.js';
const cross=()=>{const s=newGame({boardSize:9});for(const i of [31,39,40,41,49])s.board[i]=i%9+1;return s;};
test('ambiguous intersections have no selectable line or hover cells',()=>{
 const s=cross();for(const pointer of [{},{dx:0,dy:0},{dx:10,dy:10},{dx:-8,dy:9}]){
  const result=pointedChallenge(s.board,40,pointer);assert.equal(result.choices.length,2);assert.equal(result.line,null);
 }
});
test('clear pointer position selects the visible row or column through an intersection',()=>{
 const s=cross();for(const rotation of [0,1,2,3]){
  const horizontal=pointedChallenge(s.board,40,{rotation,dx:10,dy:0}).line;
  const vertical=pointedChallenge(s.board,40,{rotation,dx:0,dy:10}).line;
  assert.equal(horizontal.axis,rotation%2?'column':'row');assert.equal(vertical.axis,rotation%2?'row':'column');
 }
 assert.deepEqual(pointedChallenge(s.board,39).line.cells,[39,40,41]);assert.equal(pointedChallenge(s.board,0).line,null);
});
test('direction choices are independent of seat and endpoint order and follow board rotation',()=>{
 const s=newGame({boardSize:9});[1,0,3].forEach((d,i)=>s.board[i]=d);
 for(s.turn=0;s.turn<2;s.turn++)for(const ends of [[0,2],[2,0]]){
  const choices=challengeReadingChoices(s,ends);assert.deepEqual(choices.map(c=>c.digits),['103','301']);assert.deepEqual(choices.map(c=>c.reverse),[false,true]);
 }
 for(const [rotation,label] of [[0,'Left → right'],[1,'Top → bottom'],[2,'Right → left'],[3,'Bottom → top']])assert.equal(challengeReadingChoices(s,[0,2],rotation)[0].label,label);
 s.board.fill(null);s.board[40]=4;assert.equal(challengeReadingChoices(s,[40,40]).length,1);
});
test('a successful reverse challenge taxes the two physical endpoints of a palindrome',()=>{
 const s={...newGame({boardSize:9},0),started:true};[1,0,0,1].forEach((d,i)=>s.board[i]=d);
 const entry=complete(s,{action:'challenge',a:0,b:3,reverse:true,factor:'7'},0);
 assert.equal(entry.success,true);assert.deepEqual(entry.taxedCells,[3,0]);assert.deepEqual(entry.taxedDigits,[1,1]);assert.equal(entry.transferredCount,2);assert.equal(s.taxed[1],2);
});
test('a singleton is taxed once and a two-tile run transfers no tiles',()=>{
 for(const digits of [[4],[1,4]]){
  const s={...newGame({},0),started:true};digits.forEach((d,i)=>s.board[i]=d);
  const entry=complete(s,{action:'challenge',a:0,b:digits.length-1,reverse:false,factor:'2'},0);
  assert.equal(entry.taxedCells.length,digits.length);assert.equal(entry.transferredCount,0);assert.equal(s.taxed.reduce((a,b)=>a+b),digits.length);
 }
});
for(const version of [12,14])test(`legacy rule-${version} pending challenge finishes as a failed turn on upgrade`,()=>{
 const s={...newGame({boardSize:9},1000),started:true,paused:true,turn:1,rulesVersion:version};[1,0,0,3].forEach((d,i)=>s.board[i]=d);
 const reverse=version===12,result=challenge(s,0,3,'2',reverse),attempt={factor:result.factor,success:false,quotient:result.quotient,remainder:result.remainder};
 s.challengeAttempt={player:1,a:0,b:3,cells:result.cells,digits:result.digits,attemptLimit:2,attempts:[attempt],...(version===14?{reverse}:{} )};
 const before=structuredClone(s),upgraded=upgradeGameBoard(s);assert.deepEqual(s,before);assert.equal(upgraded.challengeAttempt,null);assert.equal(upgraded.turn,0);assert.equal(upgraded.paused,true);assert.equal(upgraded.history.length,1);assert.equal(upgraded.history[0].success,false);assert.equal(upgraded.history[0].digits,reverse?'3001':'1003');assert.equal(upgraded.history[0].reverse,reverse);assert.equal(upgraded.clocks[1],1220);assert.deepEqual(upgraded.board,s.board);assert.deepEqual(upgraded.piles,s.piles);assert.equal(isSupportedBoardState(upgraded),true);
 assert.deepEqual(upgradeGameBoard(upgraded),upgraded,'settlement must happen only once');
 const bad=structuredClone(s);bad.challengeAttempt.attempts[0].remainder='0';assert.throws(()=>upgradeGameBoard(bad),/invalid/);
});
for(const seat of [0,1])test(`seat ${seat}: bot finds a composite reverse of a prime`,()=>{
 const s={...newGame({boardSize:9},0),started:true,turn:seat};[1,0,3].forEach((d,i)=>s.board[i]=d);s.piles[seat]=Array(10).fill(0);s.piles[seat][0]=2;
 const {command}=createBot({size:9,seat,seed:4,strength:'beginner'}).choose(s);assert.equal(command.action,'challenge');assert.equal(command.reverse,true);assert.equal(complete(s,command,0).digits,'301');
});
