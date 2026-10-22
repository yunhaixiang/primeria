import test from 'node:test';
import assert from 'node:assert/strict';
import {BOARD_SIZES,newGame,challengeLines,segment,complete} from '../engine.js';
for(const size of BOARD_SIZES){
 const square=(x,y)=>y*size+x;
 test(`${size}: any tile in a run selects the same maximal horizontal or vertical number`,()=>{
  for(const vertical of [false,true]){
   const s=newGame({boardSize:size}),cells=[0,1,2,3].map(i=>vertical?square(size-1,i):square(i,size-1));
   cells.forEach((c,i)=>s.board[c]=[1,4,3,7][i]);const expected=[{axis:vertical?'column':'row',cells}];
   for(const c of cells){assert.deepEqual(challengeLines(s.board,c),expected);assert.deepEqual(segment(s.board,cells[0],cells.at(-1)),cells);}
  }
 });
 test(`${size}: a crossing offers the full row and column, never a connected singleton`,()=>{
  const s=newGame({boardSize:size}),row=[1,2,3].map(x=>square(x,2)),column=[1,2,3].map(y=>square(2,y));
  [...row,...column].forEach(i=>s.board[i]=3);
  assert.deepEqual(challengeLines(s.board,square(2,2)),[{axis:'row',cells:row},{axis:'column',cells:column}]);
  for(const line of challengeLines(s.board,square(2,2)))assert.deepEqual(segment(s.board,line.cells[0],line.cells.at(-1)),line.cells);
 });
 test(`${size}: gaps, row boundaries, isolated tiles and empty squares are handled correctly`,()=>{
  const s=newGame({boardSize:size});s.board[size-1]=4;s.board[size]=6;s.board[size+2]=8;
  assert.deepEqual(challengeLines(s.board,size-1),[{axis:'isolated',cells:[size-1]}]);
  assert.deepEqual(challengeLines(s.board,size),[{axis:'isolated',cells:[size]}]);
  assert.deepEqual(challengeLines(s.board,size+1),[]);
  s.board[size+1]=1;assert.deepEqual(challengeLines(s.board,size+1),[{axis:'row',cells:[size,size+1,size+2]}]);
  for(const index of [-1,size*size,1.5])assert.throws(()=>challengeLines(s.board,index),/tile/);
 });
 test(`${size}: one-click selection still supports reverse reading, taxation and isolated challenges`,()=>{
  const s=newGame({boardSize:size},0);s.started=true;[1,4,3,7].forEach((d,i)=>s.board[i]=d);
  const line=challengeLines(s.board,2)[0];const e=complete(s,{action:'challenge',a:line.cells[0],b:line.cells.at(-1),reverse:true,factor:'3'},0);
  assert.equal(e.digits,'7341');assert.equal(e.taxedDigit,1);assert.equal(e.transferredCount,3);
  s.board[0]=8;const single=challengeLines(s.board,0)[0];assert.deepEqual(single.cells,[0]);
  const isolated=complete(s,{action:'challenge',a:single.cells[0],b:single.cells.at(-1),reverse:false,factor:'2'},0);
  assert.equal(isolated.transferredCount,0);assert.equal(s.taxed[8],1);
 });
}
