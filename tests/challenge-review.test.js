import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,complete,tick,beginChallengeReview,finishChallengeReview,challengeReviewSeconds} from '../engine.js';
function challenged(success=true){
 const s=newGame({},0);s.started=true;s.board[0]=success?4:1;s.board[1]=success?1:3;
 const entry=complete(s,{action:'challenge',a:0,b:1,reverse:false,factor:'2'},1000);
 const review=beginChallengeReview(s,entry,1000);return {s,review};
}
for(const success of [false,true])test(`${success?'successful':'failed'} challenge pauses both clocks for exactly three seconds`,()=>{
 const {s,review}=challenged(success),clocks=s.clocks.slice(),elapsed=s.elapsed;
 assert.equal(review.success,success);assert.equal(review.resumeAt,4000);
 for(const [now,count] of [[1000,3],[1999,3],[2000,2],[2999,2],[3000,1],[3999,1]]){
  tick(s,now);assert.equal(finishChallengeReview(s,review,now),false);assert.equal(challengeReviewSeconds(review,now),count);
  assert.deepEqual(s.clocks,clocks);assert.equal(s.elapsed,elapsed);assert.equal(s.paused,true);
 }
 assert.equal(finishChallengeReview(s,review,4000),true);assert.equal(s.paused,false);assert.equal(s.turn,1);assert.deepEqual(s.clocks,clocks);
 tick(s,4500);assert.equal(s.clocks[0],clocks[0]);assert.equal(s.clocks[1],clocks[1]-.5);assert.equal(s.elapsed,elapsed+.5);
 const revision=s.revision;assert.equal(finishChallengeReview(s,review,4500),false);assert.equal(s.revision,revision);
});
test('a delayed timer charges only time after the review deadline',()=>{
 const {s,review}=challenged(),clocks=s.clocks.slice();tick(s,7000);
 assert.equal(finishChallengeReview(s,review,7000),true);assert.equal(s.clocks[1],clocks[1]-3);assert.equal(s.clocks[0],clocks[0]);assert.equal(s.elapsed,4);
});
test('an expired review cannot resume an ended game or a replacement game',()=>{
 const {s,review}=challenged();s.ended={winner:0,reason:'by resignation'};
 const before=structuredClone(s);assert.equal(finishChallengeReview(s,review,5000),false);assert.deepEqual(s,before);
 const fresh=newGame({},0);assert.equal(finishChallengeReview(fresh,review,5000),false);assert.equal(fresh.started,false);assert.equal(fresh.paused,false);
});
test('a guest countdown uses remaining duration independently of the host clock',()=>{
 const {review}=challenged();const hostNow=2000,guestNow=987654321000;
 const received={...review,resumeAt:guestNow+(review.resumeAt-hostNow)};
 assert.equal(challengeReviewSeconds(received,guestNow),2);assert.equal(challengeReviewSeconds(received,guestNow+1000),1);
});
