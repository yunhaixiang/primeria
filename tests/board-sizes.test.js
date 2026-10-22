import test from 'node:test';
import assert from 'node:assert/strict';
import {BOARD_SIZES,getBoardSize,isSupportedBoardState,newGame,placement,segment,challenge as checkChallenge,complete,total,upgradeGameBoard} from '../engine.js';
// Exercise both fixed player perspectives without an arbitrary reading-direction option.
const challenge=(s,a,b,reverse,factor)=>checkChallenge({...s,turn:reverse?1:0},a,b,factor);

for(const size of BOARD_SIZES){
 const square=(x,y)=>y*size+x;
 test(`${size} × ${size}: creation, serialization, and restoration preserve its size`,()=>{
  const s=newGame({boardSize:size},0);
  assert.equal(s.boardSize,size);assert.equal(s.board.length,size*size);assert.equal(getBoardSize(s.board),size);
  s.started=true;complete(s,{action:'single',moves:[{index:square(size-1,size-1),digit:7}]},0);
  const restored=upgradeGameBoard(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(restored,s);assert.equal(restored.board.at(-1),7);assert.ok(isSupportedBoardState(restored));
 });
 test(`${size} × ${size}: edges never wrap and placements stay in bounds`,()=>{
  const s=newGame({boardSize:size});s.board[square(size-1,0)]=3;
  assert.throws(()=>placement(s,'single',[{index:square(0,1),digit:0}]),/Zero/);
  assert.throws(()=>placement(s,'double',[{index:square(0,1),digit:1},{index:square(1,1),digit:3}]),/touch/);
  assert.doesNotThrow(()=>placement(s,'double',[{index:square(size-1,1),digit:1},{index:square(size-2,1),digit:3}]));
  for(const index of [-1,size*size,size*size+1])assert.throws(()=>placement(s,'single',[{index,digit:3}]),/square/);
 });
 test(`${size} × ${size}: whole horizontal and vertical challenges work at the last row and column`,()=>{
  for(const vertical of [false,true]){
   const s=newGame({boardSize:size},0);s.started=true;
   const cells=Array.from({length:size},(_,n)=>vertical?square(size-1,n):square(n,size-1));
   cells.forEach(i=>s.board[i]=3);
   assert.deepEqual(segment(s.board,cells.at(-1),cells[0]),cells);
   for(const reverse of [false,true])assert.equal(challenge(s,cells[0],cells.at(-1),reverse,'3').success,true);
   assert.throws(()=>segment(s.board,cells[1],cells.at(-1)),/whole uninterrupted/);
   assert.throws(()=>segment(s.board,cells[0],cells[0]),/isolated/);
   const before=total(s.piles[1]);complete(s,{action:'challenge',a:cells[0],b:cells.at(-1),reverse:false,factor:'3'},0);
   assert.equal(total(s.piles[1]),before+size-1);assert.equal(s.board.filter(n=>n!==null).length,0);
  }
 });
 test(`${size} × ${size}: board state validation rejects inconsistent online dimensions`,()=>{
  const s=newGame({boardSize:size});
  assert.equal(isSupportedBoardState({...s,boardSize:size===9?11:9}),false);
  assert.equal(isSupportedBoardState({...s,board:s.board.slice(1)}),false);
  assert.equal(isSupportedBoardState({...s,boardSize:undefined}),false);
 });
}
test('unsupported new-game sizes are rejected',()=>{
 for(const boardSize of [0,8,10,12,14,16,9.5,'9',null])assert.throws(()=>newGame({boardSize}),/Choose a/);
});
test('legacy 13 × 13 saves keep every tile, coordinate, and history entry',()=>{
 const legacy=newGame({boardSize:13});legacy.board[168]=7;legacy.lastCells=[168];legacy.history=[{action:'single',moves:[{index:168,digit:7}]}];delete legacy.boardSize;
 const before=JSON.stringify(legacy),restored=upgradeGameBoard(legacy);
 assert.equal(restored.boardSize,13);assert.equal(restored.board[168],7);assert.deepEqual(restored.history,legacy.history);assert.deepEqual(restored.lastCells,[168]);assert.equal(JSON.stringify(legacy),before);
});
test('a save with a mismatched declared size is rejected without modification',()=>{
 const s=newGame({boardSize:13});s.boardSize=9;const before=JSON.stringify(s);
 assert.throws(()=>upgradeGameBoard(s),/dimensions/);assert.equal(JSON.stringify(s),before);
});
