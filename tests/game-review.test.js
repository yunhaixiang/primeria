import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,complete,challenge,beginChallengeReview,finishChallengeReview,tick,MODES,PILE} from '../engine.js';
import {gameResult,reviewPosition} from '../review.js';
import {createBot} from '../bot.js';
const samePosition=(a,b)=>{for(const key of ['board','piles','taxed','lastCells','turn','clocks'])assert.deepEqual(a[key],b[key],key);};
function record(s,commands){const snapshots=[structuredClone(s)];for(const command of commands){const entry=complete(s,command,s.lastTick+1000);if(!entry.retry)snapshots.push(structuredClone(s));}return snapshots;}
for(const size of [9,11,13,15])test(`${size}: review reproduces placement, taxation and exposed-zero cleanup without changing the game`,()=>{
 const s={...newGame({boardSize:size},0),started:true},p=(x,y)=>y*size+x;
 const snapshots=record(s,[
  {action:'single',moves:[{index:p(1,1),digit:5}]},
  {action:'double',moves:[{index:p(2,1),digit:0},{index:p(3,1),digit:3}]},
  {action:'single',moves:[{index:p(4,1),digit:7}]},
  {action:'single',moves:[{index:p(3,2),digit:9}]},
  {action:'challenge',a:p(3,1),b:p(3,2),factor:'3'}
 ]);
 assert.equal(s.taxed[0],1);assert.equal(s.taxed[9],1);assert.equal(s.history.at(-1).cleanup.length,1);
 const before=structuredClone(s);
 for(let n=0;n<snapshots.length;n++)samePosition(reviewPosition(s,n),snapshots[n]);
 assert.deepEqual(s,before);
 const review=reviewPosition(s,2);review.board[0]=8;review.piles[0][0]=99;review.taxed[0]=99;review.clocks[0]=0;assert.deepEqual(s,before);
});
for(const quit of [false,true])test(`legacy ${quit?'quit':'multi-attempt successful'} challenges retain their recorded replay`,()=>{
 const s={...newGame({},0),started:true};
 const commands=[{action:'single',moves:[{index:0,digit:1}]},{action:'double',moves:[{index:1,digit:4},{index:2,digit:3}]},{action:'single',moves:[{index:3,digit:7}]}];
 const snapshots=record(s,commands),failed=challenge(s,0,3,'2');
 const entry=complete(s,{action:'challenge',a:0,b:3,factor:quit?'2':'3'},s.lastTick+1000);
 if(quit)entry.quit=true;else entry.attempts.unshift({factor:'2',success:false,quotient:failed.quotient,remainder:failed.remainder});
 snapshots.push(structuredClone(s));assert.equal(s.history.length,4);assert.equal(entry.attempts.length,quit?1:2);
 for(let n=0;n<snapshots.length;n++)samePosition(reviewPosition(s,n),snapshots[n]);
});
for(const size of [9,11,13,15])test(`${size}: every completed position of a full bot game can be reviewed`,()=>{
 const s={...newGame({boardSize:size},0),started:true},bots=[0,1].map(seat=>createBot({size,seed:32,seat,strength:'intermediate'})),snapshots=[structuredClone(s)];let now=0;
 for(let move=0;move<250&&!s.ended;move++){
  const result=bots[s.turn].choose(s);assert.ok(result.command);now+=result.seconds*1000;
  const entry=complete(s,result.command,now);
  if(!entry.retry)snapshots.push(structuredClone(s));
  if(entry.action==='challenge'&&!s.ended){const review=beginChallengeReview(s,entry,now);now+=3000;finishChallengeReview(s,review,now);}
 }
 assert.ok(s.ended);const before=structuredClone(s);
 for(let n=0;n<snapshots.length;n++){
  const position=reviewPosition(s,n),expected=snapshots[n];
  for(const key of ['board','piles','taxed','lastCells','turn'])assert.deepEqual(position[key],expected[key],`move ${n}: ${key}`);
  if(n<s.history.length)assert.deepEqual(position.clocks,expected.clocks);
 }
 assert.deepEqual(s,before);
});
test('old saved games remain reviewable without fabricated historical clocks',()=>{
 const s={...newGame({},0),started:true};record(s,[{action:'single',moves:[{index:0,digit:1}]},{action:'single',moves:[{index:1,digit:3}]}]);
 for(const entry of s.history){delete entry.clocks;delete entry.elapsed;}
 assert.deepEqual(reviewPosition(s,0).clocks,[1200,1200]);assert.equal(reviewPosition(s,1).clocks,undefined);assert.deepEqual(reviewPosition(s,2).clocks,s.clocks);
});
test('starting position, resignation with no moves, and invalid move selections',()=>{
 const s=newGame({first:1,mode:'casual'},0);s.ended={winner:0,reason:'by resignation'};
 const start=reviewPosition(s,0);assert.deepEqual(start.piles,[PILE,PILE]);assert.deepEqual(start.clocks,[null,null]);assert.equal(start.turn,1);
 for(const move of [-1,1,.5,NaN,'0'])assert.throws(()=>reviewPosition(s,move),/Choose a move/);
});
test('end descriptions cover clear-out, time, resignation and the Time Out Rule',()=>{
 const s=newGame({names:['Ada','Emmy']});assert.equal(gameResult(s),'');
 for(const [reason,label] of [['by playing every tile','Clear-out'],['on time','Time'],['by resignation','Resignation'],['by the Time Out Rule','Tie-breaker']]){s.ended={winner:1,reason};assert.equal(gameResult(s),`Emmy Wins by ${label}`);}
});
test('recorded move clocks are frozen copies, independent of later thinking time',()=>{
 const s={...newGame({},0),started:true};const entry=complete(s,{action:'single',moves:[{index:0,digit:1}]},2000),clocks=entry.clocks.slice();tick(s,5000);assert.deepEqual(entry.clocks,clocks);assert.equal(entry.elapsed,2);
});
test('legacy one-endpoint taxation replays its recorded effect',()=>{
 const s={...newGame({},0),started:true};
 record(s,[{action:'single',moves:[{index:0,digit:1}]},{action:'single',moves:[{index:1,digit:4}]}]);
 s.history.push({action:'challenge',player:0,cells:[0,1],readingCells:[0,1],digits:'14',success:true,taxedCell:1,taxedDigit:4});
 const position=reviewPosition(s,3);assert.equal(position.taxed[4],1);assert.equal(position.taxed[1],0);assert.equal(position.piles[1][1],PILE[1]+1);assert.equal(position.board[0],null);
});
