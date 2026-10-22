import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../engine.js';
import {BOT_LEVELS,botConfig,isBotTurn,factorChecks,createBot} from '../bot.js';
const active=(size=11)=>({...engine.newGame({boardSize:size},0),started:true,turn:1});
const factors=(digits,strength='intermediate')=>factorChecks(digits,strength).filter(c=>c.divides).map(c=>c.factor);
function conserve(s){for(let d=0;d<10;d++)assert.equal(s.piles[0][d]+s.piles[1][d]+s.taxed[d]+s.board.filter(n=>n===d).length,2*engine.PILE[d]);}
test('bot configuration validates its strength, side, id and seed and survives saving',()=>{
 const s=active();s.bot={player:1,strength:'intermediate',id:'test-game',seed:5};
 assert.equal(botConfig(s),s.bot);assert.ok(isBotTurn(s));assert.deepEqual(botConfig(JSON.parse(JSON.stringify(s))),s.bot);
 for(const patch of [{player:0},{strength:'impossible'},{id:''},{seed:-1},{seed:Infinity}])assert.equal(botConfig({...s,bot:{...s.bot,...patch}}),null);
 assert.equal(isBotTurn({...s,turn:0}),false);assert.equal(botConfig(engine.newGame()),null);
});
for(const digits of ['2','3','5','7','11','13','101','317'])test(`mental checks do not invent factors of prime ${digits}`,()=>{
 for(const strength of Object.keys(BOT_LEVELS))assert.deepEqual(factors(digits,strength),[]);
});
for(const [digits,expected] of [['120',['2','4','5','6','8','10']],['123',['3']],['729',['3','9']],['121',['11']],['91',['7','13']]])test(`mental rules recognize factors of ${digits}`,()=>{
 for(const f of expected)assert.ok(factors(digits).includes(f),f);
});
test('advanced recognizes small-prime products beyond intermediate knowledge',()=>{
 assert.deepEqual(factors('323','beginner'),[]);assert.deepEqual(factors('323','intermediate'),[]);assert.ok(factors('323','advanced').includes('17'));
 assert.ok(factorChecks('1111111111111','advanced').reduce((n,c)=>n+c.cost,0)>factorChecks('12','advanced').reduce((n,c)=>n+c.cost,0));
 for(const s of ['0','00'])assert.ok(factorChecks(s).every(c=>BigInt(c.factor)>1n));
});
for(const size of engine.BOARD_SIZES)for(const strength of Object.keys(BOT_LEVELS)){
 test(`${size} ${strength}: opening and seeded game use legal moves, conserve supply, and complete`,()=>{
  const s=active(size);s.turn=0;const bots=[0,1].map(seat=>createBot({size,seed:32,seat,strength}));let now=0;
  for(let turn=0;turn<220&&!s.ended;turn++){
   const before=structuredClone(s),result=bots[s.turn].choose(s);assert.deepEqual(s,before,'planning must not alter the game');
   assert.ok(Number.isFinite(result.seconds)&&result.seconds>0&&result.seconds<30);
   if(!result.command)break;
   now+=result.seconds*1000;const entry=engine.complete(s,result.command,now);conserve(s);
   if(entry.action==='challenge'&&!s.ended){const review=engine.beginChallengeReview(s,entry,now);now+=3000;engine.finishChallengeReview(s,review,now);}
  }
  assert.ok(s.ended,'seeded game should reach a normal ending');
 });
 test(`${size} ${strength}: bot plays the final tile rather than delaying victory`,()=>{
  const s=active(size);s.piles[1]=Array(10).fill(0);s.piles[1][5]=1;
  const result=createBot({size,seed:3,strength}).choose(s);assert.equal(result.command.action,'single');assert.equal(result.command.moves[0].digit,5);
  engine.complete(s,result.command,0);assert.equal(s.ended.winner,1);
 });
}
test('bot challenges the entire number from its own fixed perspective',()=>{
 const s=active();[3,2,1].forEach((d,i)=>s.board[i]=d);s.piles[1]=Array(10).fill(0);s.piles[1][0]=2;
 const result=createBot({size:11,seed:4,strength:'intermediate'}).choose(s);
 assert.equal(result.command.action,'challenge');
 const c=engine.challenge(s,result.command.a,result.command.b,result.command.factor);
 assert.equal(c.digits,'123');assert.equal(c.success,true);assert.deepEqual(c.cells,[0,1,2]);
});
test('a locked challenge resumes with a new factor, never with a placement',()=>{
 const s=active();[1,4,3,7].forEach((d,i)=>s.board[i]=d);
 const first=engine.complete(s,{action:'challenge',a:0,b:3,factor:'2'},0);assert.ok(first.retry);
 const result=createBot({size:11,seed:1,strength:'advanced'}).choose(s);
 assert.equal(result.command.action,'challenge');assert.equal(result.command.factor,'3');
 const end=engine.complete(s,result.command,0);assert.equal(end.success,true);assert.equal(end.attemptNumber,2);assert.equal(s.history.length,1);
});
test('bot quits a locked challenge if its mental checks cannot find another factor',()=>{
 const s=active();[1,0,0,9].forEach((d,i)=>s.board[i]=d);engine.complete(s,{action:'challenge',a:0,b:3,factor:'2'},0);
 const result=createBot({size:11,seed:1,strength:'beginner'}).choose(s);assert.equal(result.command.action,'quitChallenge');
 engine.complete(s,result.command,0);assert.equal(s.turn,0);assert.equal(s.challengeAttempt,null);
});
test('bot hurries its planned thinking under time pressure',()=>{
 const s=active();s.board[0]=1;s.clocks[1]=3;
 const r=createBot({size:11,seed:5,strength:'advanced'}).choose(s);assert.ok(r.seconds<2);
});
test('unknown bot levels and invalid board sizes are rejected',()=>{
 assert.throws(()=>createBot({size:11,strength:'oracle'}));assert.throws(()=>createBot({size:10}));
 for(const d of ['','-2','1.2','x'])assert.throws(()=>factorChecks(d));
});

for(const digits of ['11111111111111','111111111111111'])test(`all bot strengths can assess ${digits.length}-digit numbers on the larger board`,()=>{
 for(const strength of Object.keys(BOT_LEVELS)){
  const checks=factorChecks(digits,strength);assert.ok(checks.length>0);assert.ok(checks.every(c=>Number.isFinite(c.cost)));if(digits.length===15)assert.ok(checks.some(c=>c.factor==='3'&&c.divides));
 }
});
