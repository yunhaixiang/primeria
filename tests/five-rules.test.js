import test from 'node:test';
import assert from 'node:assert/strict';
import {BOARD_SIZES,newGame,placement,complete,challenge} from '../engine.js';
const active=size=>({...newGame({boardSize:size},0),started:true});
for(const size of BOARD_SIZES){
 test(`${size}: either player can Single Drop five in isolation, including the opening move`,()=>{
  const s=active(size),last=size*size-1;
  complete(s,{action:'single',moves:[{index:0,digit:5}]},0);
  complete(s,{action:'single',moves:[{index:last,digit:5}]},0);
  assert.equal(s.board[0],5);assert.equal(s.board[last],5);assert.deepEqual(s.piles.map(p=>p[5]),[1,1]);
  assert.throws(()=>placement(s,'single',[{index:size+3,digit:0}]),/touch/);
 });
 test(`${size}: isolated five remains prime and a failed challenge leaves it on the board`,()=>{
  const s=active(size);complete(s,{action:'single',moves:[{index:0,digit:5}]},0);
  assert.equal(challenge(s,0,0,'2').success,false);const piles=s.piles.map(p=>p.slice());
  const entry=complete(s,{action:'challenge',a:0,b:0,factor:'2'},0);
  assert.equal(entry.success,false);assert.equal(s.board[0],5);assert.deepEqual(s.piles,piles);assert.deepEqual(s.taxed,Array(10).fill(0));
 });
 test(`${size}: five follows the normal Double Down adjacency rule`,()=>{
  const s=active(size);
  assert.throws(()=>placement(s,'double',[{index:1,digit:5},{index:2,digit:3}]),/touch/);
  s.board[0]=1;
  assert.doesNotThrow(()=>placement(s,'double',[{index:1,digit:5},{index:2,digit:3}]));
 });
 test(`${size}: five is still taxed if it is the last digit of a successfully challenged number`,()=>{
  for(const player of [0,1]){
   const s=active(size);s.turn=player;const digits=player===0?[1,5]:[5,1];
   digits.forEach((d,i)=>{s.board[i]=d;s.piles[0][d]--;});const before=s.piles.map(p=>p.slice());
   const entry=complete(s,{action:'challenge',a:0,b:1,reverse:player===1,factor:'3'},0);
   assert.equal(entry.digits,'15');assert.deepEqual(entry.taxedDigits,[1,5]);assert.equal(s.taxed[5],1);assert.deepEqual(entry.cleanup,[]);
   assert.deepEqual(s.piles.map(p=>p[5]),before.map(p=>p[5]));
  }
 });
}
