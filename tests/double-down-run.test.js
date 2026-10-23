import test from 'node:test';
import assert from 'node:assert/strict';
import {BOARD_SIZES,RULES_VERSION,newGame,placement,complete,upgradeGameBoard,isSupportedBoardState} from '../engine.js';
import {createBot} from '../bot.js';

for(const size of BOARD_SIZES){
 const active=()=>({...newGame({boardSize:size},0),started:true});
 const at=(x,y)=>y*size+x;
 for(const vertical of [false,true])test(`${size}: Double Down may extend opposite ends of one ${vertical?'column':'row'}`,()=>{
  const cells=[1,2,3,4].map(k=>vertical?at(3,k):at(k,3));
  for(const reverse of [false,true]){
   const s=active();s.board[cells[1]]=3;s.board[cells[2]]=7;
   const moves=[{index:cells[0],digit:1},{index:cells[3],digit:9}];if(reverse)moves.reverse();
   const before=structuredClone(s),result=placement(s,'double',moves);
   assert.deepEqual(s,before);assert.deepEqual(cells.map(i=>result.board[i]),[1,3,7,9]);
   assert.doesNotThrow(()=>placement(s,'double',moves,true));
  }
 });
 test(`${size}: new tiles can be inside a longer run and fill two gaps`,()=>{
  const s=active();for(const x of [0,2,4,5])s.board[at(x,3)]=7;
  assert.doesNotThrow(()=>placement(s,'double',[{index:at(1,3),digit:1},{index:at(3,3),digit:3}]));
 });
 test(`${size}: a gap between otherwise adjacent placements rejects both preview and commit`,()=>{
  const s=active();s.board[at(0,3)]=3;s.board[at(4,3)]=7;
  const moves=[{index:at(1,3),digit:1},{index:at(3,3),digit:9}];
  assert.doesNotThrow(()=>placement(s,'double',moves.slice(0,1),true));
  const before=structuredClone(s);
  for(const partial of [false,true])assert.throws(()=>placement(s,'double',moves,partial),/same uninterrupted/);
  assert.deepEqual(s,before);
 });
 test(`${size}: connected around a corner does not qualify as the same run`,()=>{
  const s=active();s.board[at(3,3)]=7;
  assert.throws(()=>placement(s,'double',[{index:at(2,3),digit:1},{index:at(3,2),digit:3}]),/same uninterrupted/);
 });
 test(`${size}: unrelated placements and wrapped row endpoints are rejected`,()=>{
  const s=active();s.board[at(0,0)]=7;s.board[at(size-1,size-1)]=3;
  assert.throws(()=>placement(s,'double',[{index:at(1,0),digit:1},{index:at(size-2,size-1),digit:9}]),/same uninterrupted/);
  const edge=active();edge.board[size-2]=3;edge.board[size+1]=7;
  assert.throws(()=>placement(edge,'double',[{index:size-1,digit:1},{index:size,digit:9}]),/same uninterrupted/);
 });
 test(`${size}: a zero can still be the first tile and become interior`,()=>{
  const s=active();s.board[at(1,3)]=1;
  assert.doesNotThrow(()=>placement(s,'double',[{index:at(2,3),digit:0}],true));
  assert.doesNotThrow(()=>complete(s,{action:'double',moves:[{index:at(2,3),digit:0},{index:at(3,3),digit:3}]},0));
 });
 test(`${size}: bot clear-out can use gaps separated by existing tiles`,()=>{
  const s=active();s.board.fill(3);s.board[at(1,3)]=null;s.board[at(5,3)]=null;
  s.piles[0]=Array(10).fill(0);s.piles[0][1]=1;s.piles[0][9]=1;
  const result=createBot({size,seed:4,seat:0}).choose(s);
  assert.equal(result.command.action,'double');complete(s,result.command,0);assert.equal(s.ended.winner,0);
 });
 test(`${size}: bot cannot clear out using two unrelated holes`,()=>{
  const s=active();s.board.fill(3);s.board[at(1,1)]=null;s.board[at(5,5)]=null;
  s.piles[0]=Array(10).fill(0);s.piles[0][1]=1;s.piles[0][9]=1;
  const result=createBot({size,seed:4,seat:0}).choose(s);
  assert.doesNotThrow(()=>complete(s,result.command,0));assert.equal(s.ended,null);
 });
}

test('local rule-nine saves migrate without changing board, piles or recorded moves',()=>{
 const legacy={...newGame({boardSize:9},0),started:true,rulesVersion:9};
 complete(legacy,{action:'single',moves:[{index:0,digit:1}]},0);
 const before=structuredClone(legacy);assert.equal(isSupportedBoardState(legacy),false);
 const restored=upgradeGameBoard(legacy);
 assert.equal(restored.rulesVersion,RULES_VERSION);assert.ok(isSupportedBoardState(restored));
 for(const key of ['board','piles','history','clocks'])assert.deepEqual(restored[key],before[key]);
 assert.deepEqual(legacy,before);
});
