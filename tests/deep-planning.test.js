import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {newGame,complete,challenge,total} from '../engine.js';
import {createBot,scanSmallFactors,BOT_LEVELS,SEARCH_MODEL} from '../bot.js';

function active(size=15){return {...newGame({boardSize:size,mode:'standard'},0),started:true};}
function fixture(){
 const saved=JSON.parse(fs.readFileSync(new URL('./fixtures/emmy-turn-28.json',import.meta.url)));
 return {...active(),...saved};
}
const worstCapture=(board,player)=>Math.max(0,...[0,1].flatMap(reverse=>scanSmallFactors(board,reverse)).filter(t=>t.factors.length).map(t=>Math.max(0,t.cells.length-2)));

test('Advanced defends the existing even-number threat in Emmy turn 28',()=>{
 const state=fixture(),before=structuredClone(state);
 assert.equal(worstCapture(state.board,0),4);
 const result=createBot({size:15,seat:1,seed:20261023,strength:'advanced'}).choose(state);
 assert.deepEqual(state,before,'planning must not mutate the live position');
 assert.equal(result.trace.searchModel,SEARCH_MODEL);
 assert.ok(result.trace.searchDepth>=3);
 assert.ok(result.trace.threatDefenses>0);
 complete(state,result.command,0);
 assert.ok(worstCapture(state.board,0)<4,'reduce the four-tile capture available in either direction');
 assert.equal(state.history.at(-1).success,true,'the defensive challenge succeeds');
});

test('search stops an immediate clear-out with a large capture instead of a tempting short capture',()=>{
 const state=active(9);state.turn=1;
 [3,1,2].forEach((digit,i)=>state.board[i]=digit); // Both readings are divisible by 3.
 state.board[30]=4;state.board[31]=9; // Neither reading returns a tile after taxation.
 state.piles[0]=Array(10).fill(0);state.piles[0][8]=1;
 const plan=createBot({size:9,seat:1,seed:8,strength:'advanced'}).choose(state);
 assert.equal(plan.command.action,'challenge');
 const result=challenge(state,plan.command.a,plan.command.b,plan.command.factor,plan.command.reverse);
 assert.ok(['213','312'].includes(result.digits));assert.equal(result.success,true);
 complete(state,plan.command,0);assert.equal(total(state.piles[0]),2);
});

test('Advanced searches several plies and its reported continuation is legal',()=>{
 const state=active();state.turn=1;state.board[112]=1;
 const plan=createBot({size:15,seat:1,seed:4,strength:'advanced'}).choose(state);
 assert.ok(plan.trace.searchDepth>=3);
 assert.ok(plan.trace.searchNodes<=BOT_LEVELS.advanced.nodes+1);
 assert.ok(plan.trace.replies>0);assert.ok(plan.trace.followups>0);
 assert.ok(plan.trace.principalVariation.length>=plan.trace.searchDepth);
 assert.deepEqual(plan.command,plan.trace.principalVariation[0]);
 for(const command of plan.trace.principalVariation){
  const entry=complete(state,command,0);
  assert.ok(!entry.retry,'the line contains complete legal turns');
  if(state.ended)break;
 }
});

test('seeded search is reproducible and never leaks a partial search result',()=>{
 const state=fixture();
 const a=createBot({size:15,seat:1,seed:20261023,strength:'advanced'}).choose(state);
 const b=createBot({size:15,seat:1,seed:20261023,strength:'advanced'}).choose(state);
 assert.deepEqual(a,b);
 assert.ok(a.trace.searchDepth>=1);
 assert.ok(a.trace.searchNodes<=BOT_LEVELS.advanced.nodes+1);
 assert.deepEqual(a.command,a.trace.principalVariation[0]);
});

test('time pressure reduces search effort without hiding remote small factors',()=>{
 const state=active(9);state.turn=1;state.clocks[1]=3;
 [9,4].forEach((digit,i)=>state.board[60+i]=digit); // Emmy reads 49.
 state.piles[1]=Array(10).fill(0);state.piles[1][0]=2;
 const plan=createBot({size:9,seat:1,seed:4,strength:'advanced'}).choose(state);
 assert.equal(plan.command.action,'challenge');assert.equal(challenge(state,plan.command.a,plan.command.b,plan.command.factor,plan.command.reverse).success,true);
 assert.ok(plan.trace.searchNodes<=161);assert.ok(plan.seconds<2);
});
