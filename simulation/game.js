import assert from 'node:assert/strict';
import * as engine from '../engine.js';
import {ARITHMETIC_MODEL,createBot} from '../bot.js';

// Use the same engine, arithmetic and planner as the playable bot.
export function simulateGame({size=11,seed=1,first=0,strengths=['intermediate','intermediate'],maxMoves=1000}={}){
 const state=engine.newGame({boardSize:size,mode:'rapid',first,timeOutRule:false},0);state.started=true;
 if(!Array.isArray(strengths)||strengths.length!==2)throw Error('Choose two bot strengths.');
 if(!Number.isInteger(maxMoves)||maxMoves<1)throw Error('Choose a positive move limit.');
 const bots=strengths.map((strength,seat)=>createBot({size,seed,seat,strength}));
 const counts={single:0,double:0,challenge:0};let now=0,decisions=0,challengeAttempts=0,reviewPauses=0;
 while(!state.ended&&state.history.length<maxMoves&&decisions<maxMoves*2){
  const plan=bots[state.turn].choose(state);decisions++;
  if(!plan.command)break;
  now+=plan.seconds*1000;
  const before=state.history.length;let entry;
  try{entry=engine.complete(state,plan.command,now);}catch(error){if(state.ended?.reason==='on time')break;throw error;}
  if(plan.command.action==='challenge')challengeAttempts++;
  if(state.history.length>before)counts[entry.action]++;
  for(let d=0;d<10;d++)assert.equal(state.piles[0][d]+state.piles[1][d]+state.taxed[d]+state.board.filter(n=>n===d).length,2*engine.PILE[d]);
  if(entry.action==='challenge'&&!state.ended){reviewPauses++;const review=engine.beginChallengeReview(state,entry,now);now+=3000;engine.finishChallengeReview(state,review,now);}
 }
 assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),state.history.length);
 return {arithmeticModel:ARITHMETIC_MODEL,rulesVersion:engine.RULES_VERSION,size,seed,first,strengths,finished:!!state.ended,ending:state.ended,moves:state.history.length,counts,challengeAttempts,reviewPauses,thinkingSeconds:state.elapsed,modelSeconds:now/1000+3,remaining:state.piles.map(engine.total)};
}
