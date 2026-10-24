import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,complete,upgradeGameBoard,isSupportedBoardState} from '../engine.js';
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
test('retry locks direction even when the number is a palindrome',()=>{
 const s={...newGame({boardSize:9},0),started:true};[1,0,0,1].forEach((d,i)=>s.board[i]=d);
 assert.ok(complete(s,{action:'challenge',a:0,b:3,reverse:true,factor:'2'},0).retry);
 assert.throws(()=>complete(s,{action:'challenge',a:0,b:3,reverse:false,factor:'7'},0),/reading direction/);
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
test('legacy pending challenges retain their former reading direction on upgrade',()=>{
 const s={...newGame({boardSize:9},0),started:true,turn:1};[1,0,0,3].forEach((d,i)=>s.board[i]=d);
 complete(s,{action:'challenge',a:0,b:3,reverse:true,factor:'2'},0);
 s.rulesVersion=12;delete s.challengeAttempt.reverse;
 const upgraded=upgradeGameBoard(s);assert.equal(upgraded.challengeAttempt.reverse,true);assert.equal(upgraded.challengeAttempt.digits,'3001');assert.equal(isSupportedBoardState(upgraded),true);
 delete upgraded.challengeAttempt.reverse;assert.equal(isSupportedBoardState(upgraded),false);
});
for(const seat of [0,1])test(`seat ${seat}: bot finds a composite reverse of a prime`,()=>{
 const s={...newGame({boardSize:9},0),started:true,turn:seat};[1,0,3].forEach((d,i)=>s.board[i]=d);s.piles[seat]=Array(10).fill(0);s.piles[seat][0]=2;
 const {command}=createBot({size:9,seat,seed:4,strength:'beginner'}).choose(s);assert.equal(command.action,'challenge');assert.equal(command.reverse,true);assert.equal(complete(s,command,0).digits,'301');
});
