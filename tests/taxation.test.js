import test from 'node:test';
import assert from 'node:assert/strict';
import {BOARD_SIZES,PILE,total,newGame,complete,upgradeGameBoard,isSupportedBoardState} from '../engine.js';
const active=size=>({...newGame({boardSize:size,mode:'casual'},0),started:true});
for(const size of BOARD_SIZES)for(const vertical of [false,true])for(const reverse of [false,true])for(const swap of [false,true]){
 test(`${size}: taxation follows ${reverse?'reverse':'forward'} ${vertical?'vertical':'horizontal'} reading, endpoints ${swap?'swapped':'ordered'}`,()=>{
  const s=active(size);s.turn=reverse?0:1;const actor=s.turn,opponent=1-actor,cells=[0,1,2,3].map(i=>vertical?i*size:i);[1,4,3,7].forEach((d,i)=>s.board[cells[i]]=d);
  const before=s.piles[opponent].slice(),taxedCell=reverse?cells[0]:cells.at(-1),taxedDigit=reverse?1:7;
  const e=complete(s,{action:'challenge',a:swap?cells.at(-1):cells[0],b:swap?cells[0]:cells.at(-1),reverse,factor:'3'},0);
  assert.equal(e.digits,reverse?'7341':'1437');assert.equal(e.taxedCell,taxedCell);assert.equal(e.taxedDigit,taxedDigit);assert.equal(e.transferredCount,3);
  assert.equal(total(s.taxed),1);assert.equal(s.taxed[taxedDigit],1);assert.ok(cells.every(i=>s.board[i]===null));
  for(const d of [1,4,3,7])assert.equal(s.piles[opponent][d],before[d]+(d===taxedDigit?0:1));
  assert.deepEqual(s.piles[actor],PILE);assert.equal(s.turn,opponent);
 });
}
for(const digit of [0,4,6,8,9])test(`isolated ${digit} is entirely taxed`,()=>{
 const s=active(11);s.board[0]=digit;const piles=s.piles.map(p=>p.slice());
 const e=complete(s,{action:'challenge',a:0,b:0,reverse:true,factor:digit===9?'3':'2'},0);
 assert.equal(e.transferredCount,0);assert.equal(s.taxed[digit],1);assert.equal(s.board[0],null);assert.deepEqual(s.piles,piles);
});
for(const reverse of [false,true])test(`zeros are taxed as physical digits in ${reverse?'reverse':'forward'} reading`,()=>{
 const s=active(11);[0,1,4,0].forEach((d,i)=>s.board[i]=d);
 const e=complete(s,{action:'challenge',a:0,b:3,reverse,factor:'2'},0);
 assert.equal(e.taxedDigit,0);assert.equal(s.taxed[0],1);assert.equal(s.piles[1][0],PILE[0]+1);
});
test('failed and invalid challenges leave taxation and inventories untouched',()=>{
 const s=active(11);[1,3].forEach((d,i)=>s.board[i]=d);s.taxed[7]=2;
 const before=structuredClone(s);complete(s,{action:'challenge',a:0,b:1,reverse:false,factor:'2'},0);
 assert.deepEqual(s.taxed,before.taxed);assert.deepEqual(s.board,before.board);assert.deepEqual(s.piles,before.piles);
 assert.throws(()=>complete(s,{action:'challenge',a:0,b:0,factor:'2'},0),/isolated/);assert.deepEqual(s.taxed,before.taxed);
});
test('taxes accumulate, conserve each digit, and survive saving and online serialization',()=>{
 let s=active(11);
 for(let n=0;n<2;n++){
  const reverse=s.turn===0;
  complete(s,{action:'single',moves:[{index:0,digit:reverse?4:1}]},0);
  complete(s,{action:'single',moves:[{index:1,digit:reverse?1:4}]},0);
  complete(s,{action:'challenge',a:0,b:1,reverse:false,factor:'2'},0);
 }
 assert.equal(s.taxed[4],2);
 s=upgradeGameBoard(JSON.parse(JSON.stringify(s)));assert.ok(isSupportedBoardState(s));
 for(let d=0;d<10;d++)assert.equal(s.piles[0][d]+s.piles[1][d]+s.taxed[d]+s.board.filter(n=>n===d).length,PILE[d]*2);
 assert.equal(s.history.at(-1).taxedDigit,4);
});
test('old saved games gain empty tax counts without changing prior transfers or the source save',()=>{
 const legacy=active(13);delete legacy.taxed;legacy.piles[1][4]++;legacy.history=[{action:'challenge',success:true,cells:[0],digits:'4',factor:'2',player:0}];
 const before=structuredClone(legacy),restored=upgradeGameBoard(legacy);
 assert.deepEqual(legacy,before);assert.deepEqual(restored.taxed,Array(10).fill(0));assert.deepEqual(restored.piles,before.piles);assert.deepEqual(restored.history,before.history);assert.ok(isSupportedBoardState(restored));
});
test('malformed taxation counts are rejected when restoring or receiving state',()=>{
 for(const taxed of [null,[],Array(10).fill(-1),Array(10).fill(0.5)]){
  const s={...active(11),taxed};assert.equal(isSupportedBoardState(s),false);assert.throws(()=>upgradeGameBoard(s),/taxation/);
 }
});
