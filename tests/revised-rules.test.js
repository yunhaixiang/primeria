import test from 'node:test';
import assert from 'node:assert/strict';
import {BOARD_SIZES,PILE,total,newGame,placement,challengeNumber,challenge,complete,beginChallengeReview,finishChallengeReview,tick,isSupportedBoardState,RULES_VERSION} from '../engine.js';
const active=(size=13)=>({...newGame({boardSize:size},0),started:true});
const target=(digits='1437',player=0)=>{const s=active();s.turn=player;[...digits].forEach((d,i)=>s.board[i]=Number(d));return s;};
const move=(factor,a=0,b=3)=>({action:'challenge',a,b,factor});
test('each player has two zeros, two fives, and 36 independent tiles',()=>{
 const s=newGame();assert.equal(PILE[0],2);assert.equal(PILE[5],2);assert.equal(total(PILE),36);assert.deepEqual(s.piles.map(total),[36,36]);
 s.piles[0][5]--;assert.equal(s.piles[1][5],2);assert.equal(s.rulesVersion,RULES_VERSION);
});
for(const size of BOARD_SIZES){
 const square=(x,y)=>y*size+x;
 test(`${size}: neither zero nor five can be placed in isolation`,()=>{
  for(const digit of [0,5]){const s=active(size);assert.throws(()=>placement(s,'single',[{index:square(3,3),digit}]),/touch/);}
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
 });
 test(`${size}: zero checks never wrap board edges`,()=>{
  const s=active(size);s.board[size-1]=1;s.board[size+1]=3;
  assert.throws(()=>placement(s,'single',[{index:size,digit:0}]),/begin or end/);
 });
 for(const vertical of [false,true])test(`${size}: a challenge always uses the challenging player's own fixed ${vertical?'vertical':'horizontal'} reading`,()=>{
  const s=active(size),cells=[0,1].map(i=>vertical?square(3,i+2):square(i+2,3));s.board[cells[0]]=4;s.board[cells[1]]=1;
  s.turn=0;assert.equal(challengeNumber(s,...cells).digits,'41');assert.equal(challengeNumber(s,...cells).perspective,0);assert.equal(challenge(s,...cells,'2').success,false);
  s.turn=1;assert.equal(challengeNumber(s,...cells).digits,'14');assert.equal(challengeNumber(s,...cells).perspective,1);assert.equal(challenge(s,...cells,'2').success,true);
 });
}
for(let digits=1;digits<=13;digits++)test(`${digits} digits allow ${Math.ceil(digits/3)} attempts`,()=>{
 const s=target('1'.repeat(digits));assert.equal(challengeNumber(s,0,digits-1).attemptLimit,Math.ceil(digits/3));
});
for(const player of [0,1])test(`player ${player+1} cannot override its own reading with endpoint order, reverse or rotation flags`,()=>{
 for(const rotation of [0,1,2,3])for(const reverse of [false,true])for(const swap of [false,true]){
  const s=target(player===0?'14':'41',player);
  const result=complete(s,{action:'challenge',a:swap?1:0,b:swap?0:1,factor:'2',reverse,rotation},0);
  assert.equal(result.digits,'14');assert.equal(result.perspective,player);assert.equal(result.success,true);assert.equal(result.taxedDigit,4);
 }
});
test('a failed first attempt locks the number, spends no increment, and resumes the same player after review',()=>{
 const s=target(),entry=complete(s,move('2'),1000);
 assert.equal(entry.retry,true);assert.equal(entry.attemptLimit,2);assert.equal(s.turn,0);assert.equal(s.history.length,0);assert.equal(s.clocks[0],1199);assert.equal(s.challengeAttempt.attempts.length,1);
 const review=beginChallengeReview(s,entry,1000);tick(s,3999);assert.equal(s.clocks[0],1199);
 assert.equal(finishChallengeReview(s,review,4000),true);assert.equal(s.turn,0);assert.equal(s.clocks[0],1199);
 const success=complete(s,move('3'),5000);
 assert.equal(success.success,true);assert.equal(success.attemptNumber,2);assert.equal(success.taxedDigit,7);assert.equal(s.clocks[0],1218);assert.equal(s.turn,1);assert.equal(s.history.length,1);assert.equal(s.history[0].attempts.length,2);assert.equal(s.challengeAttempt,null);
});
test('exhausting all attempts fails once, with a single increment and history entry',()=>{
 const s=target();complete(s,move('2'),1000);const result=complete(s,move('5'),2000);
 assert.equal(result.success,false);assert.equal(result.retry,undefined);assert.equal(result.retriesRemaining,0);assert.equal(s.turn,1);assert.equal(s.clocks[0],1218);assert.equal(s.history.length,1);assert.equal(s.challengeAttempt,null);assert.equal(total(s.taxed),0);
});
test('quitting during Attempt Fails pauses ends the challenge without charging the paused time',()=>{
 const s=target(),first=complete(s,move('2'),1000);beginChallengeReview(s,first,1000);
 const result=complete(s,{action:'quitChallenge'},2000);
 assert.equal(result.quit,true);assert.equal(result.success,false);assert.equal(s.turn,1);assert.equal(s.clocks[0],1219);assert.equal(s.elapsed,1);assert.equal(s.history.length,1);assert.equal(s.challengeAttempt,null);
});
test('quitting after a retry resumes charges thinking time but only one increment',()=>{
 const s=target();const entry=complete(s,move('2'),1000),review=beginChallengeReview(s,entry,1000);finishChallengeReview(s,review,4000);
 complete(s,{action:'quitChallenge'},6000);assert.equal(s.clocks[0],1217);assert.equal(s.elapsed,3);assert.equal(s.history.length,1);
});
test('a pending challenge forbids placements or a different target',()=>{
 const s=target();s.board[30]=4;complete(s,move('2'),0);
 assert.throws(()=>complete(s,{action:'single',moves:[{index:25,digit:3}]},0),/Finish or quit/);
 assert.throws(()=>complete(s,{action:'challenge',a:30,b:30,factor:'2'},0),/Finish or quit/);
 assert.equal(s.challengeAttempt.attempts.length,1);
});
test('invalid factors do not spend an attempt',()=>{
 const s=target();complete(s,move('2'),0);
 for(const factor of ['0','1','7341','x','2.5'])assert.throws(()=>complete(s,move(factor),0));
 assert.equal(s.challengeAttempt.attempts.length,1);assert.equal(s.history.length,0);
});
test('pending attempts survive serialization and are validated in online states',()=>{
 const s=target();complete(s,move('2'),0);const saved=JSON.parse(JSON.stringify(s));assert.ok(isSupportedBoardState(saved));
 assert.equal(complete(saved,move('3'),1000).success,true);
 for(const patch of [{player:1},{digits:'9999'},{attemptLimit:9},{cells:[25]},{attempts:[]},{attempts:[{factor:'0',success:false,remainder:'0'}]}])assert.equal(isSupportedBoardState({...s,challengeAttempt:{...s.challengeAttempt,...patch}}),false);
 assert.equal(isSupportedBoardState({...s,rulesVersion:7}),false);
});
test('a pending challenge can still lose on time without receiving an increment',()=>{
 const s=target();s.clocks[0]=1;complete(s,move('2'),0);assert.throws(()=>complete(s,move('3'),1001),/over/);assert.equal(s.ended.winner,1);assert.equal(s.clocks[0],0);assert.equal(s.history.length,0);
});
test('retry attempts do not count as extra Time Out Rule moves',()=>{
 const s=target();Object.assign(s,{timeOutRule:true,timeOutSeconds:1,timeOutMoves:3,elapsed:5,leader:0,streak:1});s.piles[1][1]+=10;
 complete(s,move('2'),0);assert.equal(s.streak,1);complete(s,move('3'),0);assert.equal(s.streak,2);
});
test('per-digit supply is conserved after legal placements and a successful second attempt',()=>{
 const s=active();complete(s,{action:'single',moves:[{index:0,digit:1}]},0);complete(s,{action:'double',moves:[{index:1,digit:4},{index:2,digit:3}]},0);complete(s,{action:'single',moves:[{index:3,digit:7}]},0);
 complete(s,move('2'),0);complete(s,move('3'),0);
 for(let d=0;d<10;d++)assert.equal(s.piles[0][d]+s.piles[1][d]+s.taxed[d]+s.board.filter(n=>n===d).length,2*PILE[d]);
 assert.equal(total(s.piles[0])+total(s.piles[1])+total(s.taxed)+s.board.filter(n=>n!==null).length,72);
});
for(let digits=1;digits<=13;digits++)test(`${digits}-digit failure exhausts exactly its budget without extra turns or increments`,()=>{
 const s=target(digits===1?'4':'1'.repeat(digits));const limit=Math.ceil(digits/3);let now=0;
 for(let i=0;i<limit;i++){
  const result=complete(s,{action:'challenge',a:0,b:digits-1,factor:digits===1?'3':'2'},now);
  assert.equal(result.success,false);assert.equal(result.attemptNumber,i+1);assert.equal(s.turn,i===limit-1?1:0);assert.equal(s.history.length,i===limit-1?1:0);
  const review=beginChallengeReview(s,result,now);now+=3000;finishChallengeReview(s,review,now);
 }
 assert.equal(s.history[0].attempts.length,limit);assert.equal(s.clocks[0],1220);assert.equal(s.elapsed,0);
});
