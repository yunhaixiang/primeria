import test from 'node:test';
import assert from 'node:assert/strict';
import {BOARD_SIZES,RULES_VERSION,newGame,placement,complete,upgradeGameBoard,isSupportedBoardState} from '../engine.js';
import {createBot} from '../bot.js';

for(const size of BOARD_SIZES){
 const active=()=>({...newGame({boardSize:size},0),started:true});
 const at=(x,y)=>y*size+x;
 function allowed(s,moves){
  const before=structuredClone(s);
  for(const partial of [false,true])assert.doesNotThrow(()=>placement(s,'double',moves,partial));
  assert.deepEqual(s,before);complete(s,{action:'double',moves},0);assert.equal(s.history.length,1);
 }
 for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])test(`${size}: the second tile may touch the first in direction ${dx},${dy}`,()=>{
  const s=active(),first=at(3,3),second=at(3+dx,3+dy);s.board[at(3-dx,3-dy)]=7;
  allowed(s,[{index:first,digit:1},{index:second,digit:9}]);
 });
 for(const vertical of [false,true])test(`${size}: Double Down may extend opposite ends of an existing ${vertical?'column':'row'}`,()=>{
  const cells=[1,2,3,4].map(k=>vertical?at(3,k):at(k,3));
  for(const reverse of [false,true]){
   const s=active();s.board[cells[1]]=3;s.board[cells[2]]=7;
   const moves=[{index:cells[0],digit:1},{index:cells[3],digit:9}];if(reverse)moves.reverse();allowed(s,moves);
  }
 });
 test(`${size}: two separated gaps can be filled together`,()=>{
  const s=active();for(const x of [0,2,4,5])s.board[at(x,3)]=7;
  allowed(s,[{index:at(1,3),digit:1},{index:at(3,3),digit:3}]);
 });
 test(`${size}: the new tiles can touch different sides of one existing tile`,()=>{
  const s=active();s.board[at(3,3)]=7;allowed(s,[{index:at(2,3),digit:1},{index:at(3,2),digit:3}]);
 });
 test(`${size}: the new tiles may attach to separate islands`,()=>{
  const s=active();s.board[at(0,0)]=7;s.board[at(size-1,size-1)]=3;
  allowed(s,[{index:at(1,0),digit:1},{index:at(size-2,size-1),digit:9}]);
 });
 test(`${size}: both tiles must attach when placed, with no diagonal or row-wrap adjacency`,()=>{
  const s=active(),moves=[{index:at(3,3),digit:1},{index:at(4,3),digit:9}];
  assert.throws(()=>placement(s,'double',moves),/existing tile/);
  s.board[at(5,3)]=7;assert.throws(()=>placement(s,'double',moves),/existing tile/);
  const remote=active();remote.board[at(2,3)]=7;
  for(const partial of [false,true])assert.throws(()=>placement(remote,'double',[{index:at(3,3),digit:1},{index:at(4,4),digit:9}],partial),/existing tile/);
  const edge=active();edge.board[size-2]=3;
  assert.throws(()=>placement(edge,'double',[{index:size-1,digit:1},{index:size,digit:9}]),/existing tile/);
  edge.board[size+1]=7;allowed(edge,[{index:size-1,digit:1},{index:size,digit:9}]);
 });
 test(`${size}: a zero can still be the first tile and become interior`,()=>{
  const s=active();s.board[at(1,3)]=1;
  assert.doesNotThrow(()=>placement(s,'double',[{index:at(2,3),digit:0}],true));
  allowed(s,[{index:at(2,3),digit:0},{index:at(3,3),digit:3}]);
 });
 for(const [label,cells] of [['touching',[at(1,3),at(2,3)]],['separated in one run',[at(1,3),at(5,3)]],['in separate runs',[at(1,1),at(5,5)]]])test(`${size}: bot clear-out can use holes ${label}`,()=>{
  const s=active();s.board.fill(3);for(const i of cells)s.board[i]=null;
  s.piles[0]=Array(10).fill(0);s.piles[0][1]=1;s.piles[0][9]=1;
  const result=createBot({size,seed:4,seat:0}).choose(s);
  assert.equal(result.command.action,'double');complete(s,result.command,0);assert.equal(s.ended.winner,0);
 });
}
for(const version of [9,10,11])test(`local rule-${version} saves migrate without changing board, piles or recorded moves`,()=>{
 const legacy={...newGame({boardSize:9},0),started:true,rulesVersion:version};complete(legacy,{action:'single',moves:[{index:0,digit:1}]},0);
 const before=structuredClone(legacy);assert.equal(isSupportedBoardState(legacy),false);const restored=upgradeGameBoard(legacy);
 assert.equal(restored.rulesVersion,RULES_VERSION);assert.ok(isSupportedBoardState(restored));
 for(const key of ['board','piles','history','clocks'])assert.deepEqual(restored[key],before[key]);assert.deepEqual(legacy,before);
});
