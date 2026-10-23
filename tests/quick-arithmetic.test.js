import test from 'node:test';
import assert from 'node:assert/strict';
import {BOT_LEVELS,ARITHMETIC_MODEL,factorChecks,createBot} from '../bot.js';
import {newGame,challenge} from '../engine.js';
import {simulateGame} from '../simulation/game.js';

for(const strength of Object.keys(BOT_LEVELS))test(`${strength}: common tests stay cheap through 15 digits`,()=>{
 for(let length=1;length<=15;length++){
  const checks=factorChecks('8'.repeat(length),strength),quick=checks.filter(c=>c.quick);
  for(const p of [2,3,5,7,11,13])assert.ok(quick.some(c=>c.factor===String(p)),`missing ${p} at ${length} digits`);
  const through11=checks.slice(0,checks.findIndex(c=>c.factor==='11')+1);
  assert.ok(through11.reduce((n,c)=>n+c.cost,0)<=1.021);
  assert.ok(quick.reduce((n,c)=>n+c.cost,0)<=2.506);
 }
});
for(const strength of Object.keys(BOT_LEVELS))for(const [digits,factor] of [['1'.repeat(15),'3'],['1'.repeat(14),'11']])test(`${strength}: recognizes ${factor} on a long whole-run challenge`,()=>{
 const s={...newGame({boardSize:15},0),started:true};
 [...digits].forEach((d,i)=>s.board[i]=Number(d));s.piles[0]=Array(10).fill(0);s.piles[0][0]=2;
 const plan=createBot({size:15,seat:0,strength,seed:4}).choose(s);
 assert.equal(plan.command.action,'challenge');assert.equal(plan.command.factor,factor);
 assert.equal(challenge(s,plan.command.a,plan.command.b,plan.command.factor).success,true);
});
test('larger prime calculations still cost substantially more than the common tests',()=>{
 const checks=factorChecks('1111111111111','advanced'),by=p=>checks.find(c=>c.factor===p);
 assert.equal(by('17').quick,false);assert.ok(by('17').cost>10*by('11').cost);
 assert.ok(!factorChecks('1111111111111','beginner').some(c=>c.factor==='17'));
});
test('the simulator uses the live arithmetic model and accounts for complete turns and paused reviews',()=>{
 const r=simulateGame({size:9,seed:32});
 assert.equal(r.arithmeticModel,ARITHMETIC_MODEL);assert.ok(r.finished);
 assert.equal(r.moves,r.counts.single+r.counts.double+r.counts.challenge);
 assert.ok(Math.abs(r.modelSeconds-r.thinkingSeconds-3*(1+r.reviewPauses))<1e-6);
});
