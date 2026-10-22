import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,beginGameCountdown,finishGameCountdown,challengeReviewSeconds,tick,complete} from '../engine.js';

for(const first of [0,1])test(`opening countdown freezes both clocks and starts player ${first+1} at the deadline`,()=>{
 const s=newGame({first},100),clocks=s.clocks.slice(),piles=structuredClone(s.piles);
 const countdown=beginGameCountdown(s,100);
 for(const [now,seconds] of [[100,3],[1099,3],[1100,2],[2100,1],[3099,1]]){
  tick(s,now);assert.equal(challengeReviewSeconds(countdown,now),seconds);
  assert.equal(finishGameCountdown(s,now),false);assert.equal(s.started,false);
  assert.deepEqual(s.clocks,clocks);assert.equal(s.elapsed,0);
 }
 assert.throws(()=>complete(s,{action:'single',moves:[{index:0,digit:1}]},3099));
 assert.equal(finishGameCountdown(s,3100),true);
 assert.equal(s.started,true);assert.equal(s.paused,false);assert.equal(s.turn,first);
 assert.equal(s.startCountdown,undefined);assert.deepEqual(s.clocks,clocks);
 assert.deepEqual(s.piles,piles);assert.equal(s.history.length,0);
 tick(s,4100);assert.equal(s.clocks[first],clocks[first]-1);assert.equal(s.clocks[1-first],clocks[1-first]);
 assert.equal(finishGameCountdown(s,4100),false);
});
test('a late countdown timer charges only time after its deadline',()=>{
 const s=newGame({},0);beginGameCountdown(s,1000);tick(s,6000);
 assert.equal(finishGameCountdown(s,6500),true);assert.equal(s.elapsed,2.5);
 assert.deepEqual(s.clocks,[1197.5,1200]);assert.equal(s.lastTick,6500);
});
test('a countdown cannot start ended, replaced or already started games',()=>{
 const s=newGame({},0);beginGameCountdown(s,0);s.ended={winner:1,reason:'test'};
 assert.equal(finishGameCountdown(s,4000),false);assert.equal(s.started,false);
 assert.throws(()=>beginGameCountdown(s,4000));
 const replaced=newGame({},0);assert.equal(finishGameCountdown(replaced,4000),false);
 const stale=newGame({},0);beginGameCountdown(stale,0);stale.revision++;
 assert.equal(finishGameCountdown(stale,4000),false);
 const active=newGame({},0);active.started=true;assert.throws(()=>beginGameCountdown(active));
});
test('restarting a saved countdown gives a full three seconds without charging away time',()=>{
 const s=newGame({},0);beginGameCountdown(s,0);const restored=JSON.parse(JSON.stringify(s));
 beginGameCountdown(restored,100000);assert.equal(finishGameCountdown(restored,102999),false);
 assert.equal(finishGameCountdown(restored,103000),true);assert.equal(restored.elapsed,0);
 assert.deepEqual(restored.clocks,[1200,1200]);
});
test('unlimited games start normally after the opening countdown',()=>{
 const s=newGame({mode:'casual'},0);beginGameCountdown(s,0);
 assert.equal(finishGameCountdown(s,4000),true);assert.deepEqual(s.clocks,[null,null]);assert.equal(s.elapsed,1);
});
