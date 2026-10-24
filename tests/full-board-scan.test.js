import test from 'node:test';
import assert from 'node:assert/strict';
import {BOARD_SIZES,newGame,challengeLines,challenge,complete} from '../engine.js';
import {BOT_LEVELS,SMALL_PRIMES,FULL_SCAN_SECONDS,scanSmallFactors,createBot} from '../bot.js';
for(const size of BOARD_SIZES)for(const perspective of [0,1])test(`${size} player ${perspective+1}: full scan covers every maximal number and isolated tile`,()=>{
 const s=newGame({boardSize:size});let rng=90321;
 for(let trial=0;trial<8;trial++){
  s.board=s.board.map(()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng%4?1+(rng%9):null;});
  const expected=new Map();
  for(let i=0;i<s.board.length;i++)if(s.board[i]!==null)for(const line of challengeLines(s.board,i))expected.set(line.cells.join(','),line.cells);
  const found=scanSmallFactors(s.board,perspective);assert.equal(found.length,expected.size);
  for(const row of found){
   assert.deepEqual(row.cells,expected.get(row.cells.join(',')));
   const digits=(perspective?row.cells.slice().reverse():row.cells).map(i=>s.board[i]).join('');assert.equal(row.digits,digits);
   const n=BigInt(digits);assert.deepEqual(row.factors,SMALL_PRIMES.filter(p=>BigInt(p)<n&&n%BigInt(p)===0n).map(String));
  }
 }
});
for(const strength of Object.keys(BOT_LEVELS))for(const lowTime of [false,true])test(`${strength}: remote factors remain visible ${lowTime?'under time pressure':'beyond attention limits'}`,()=>{
 const size=9,s={...newGame({boardSize:size},0),started:true};
 for(const [y,x,a,b] of [[0,0,1,3],[2,3,1,7],[4,0,1,9],[8,6,4,9]]){s.board[y*size+x]=a;s.board[y*size+x+1]=b;}
 s.lastCells=[0,1];if(lowTime)s.clocks[0]=3;
 s.piles[0]=Array(10).fill(0);s.piles[0][0]=2;
 const plan=createBot({size,strength,seat:0,seed:4}).choose(s);
 assert.equal(plan.trace.smallPrimeRunsScanned,8);assert.equal(plan.trace.smallPrimeTargets,3);
 assert.equal(plan.trace.scanSeconds,FULL_SCAN_SECONDS*BOT_LEVELS[strength].speed);
 assert.equal(plan.command.action,'challenge');
 const result=challenge(s,plan.command.a,plan.command.b,plan.command.factor,plan.command.reverse);
 assert.equal(result.success,true);assert.ok(['91','49','94'].includes(result.digits));
});
test('the scanner uses the requested reading direction and excludes prime numbers themselves',()=>{
 const s=newGame({boardSize:9});s.board[0]=4;s.board[1]=1;s.board[20]=7;s.board[40]=1;
 const a=scanSmallFactors(s.board,0),b=scanSmallFactors(s.board,1);
 assert.deepEqual(a.find(t=>t.digits==='41').factors,[]);assert.deepEqual(b.find(t=>t.digits==='14').factors,['2','7']);
 assert.deepEqual(a.find(t=>t.digits==='7').factors,[]);assert.deepEqual(a.find(t=>t.digits==='1').factors,[]);
});
test('a locked challenge uses another known small factor without switching targets',()=>{
 const s={...newGame({boardSize:9},0),started:true};[1,0,0,1].forEach((d,i)=>s.board[i]=d);
 const first=complete(s,{action:'challenge',a:0,b:3,factor:'2'},0);assert.ok(first.retry);
 const plan=createBot({size:9,seat:0,strength:'beginner',seed:4}).choose(s);
 assert.equal(plan.command.action,'challenge');assert.equal(plan.command.factor,'7');
 assert.deepEqual(plan.command.cells,[0,1,2,3]);assert.equal(complete(s,plan.command,0).success,true);
});
