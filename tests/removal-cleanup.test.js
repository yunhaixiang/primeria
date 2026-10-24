import test from 'node:test';
import assert from 'node:assert/strict';
import {BOARD_SIZES,PILE,newGame,complete,isSupportedBoardState} from '../engine.js';
const active=(size,player=0)=>({...newGame({boardSize:size,first:player},0),started:true});
function seed(s,tiles){for(const [index,digit] of tiles){s.board[index]=digit;s.piles[0][digit]--;assert.ok(s.piles[0][digit]>=0);}}
function conserved(s){for(let d=0;d<10;d++)assert.equal(s.piles[0][d]+s.piles[1][d]+s.taxed[d]+s.board.filter(n=>n===d).length,2*PILE[d]);}
for(const size of BOARD_SIZES){
 for(const vertical of [false,true])for(const side of ['start','end'])for(const player of [0,1]){
  test(`${size}: player ${player+1} removes exposed ${vertical?'column':'row'} zero at ${side} and preserves isolated five`,()=>{
   const s=active(size,player),p=(x,y)=>vertical?x*size+y:y*size+x,end=side==='start'?2:4;
   seed(s,[[p(2,3),end===2?3:1],[p(3,3),0],[p(4,3),end===4?3:1],[p(end,4),9],[p(end+(end===2?-1:1),4),5]]);
   const before=s.piles.map(pile=>pile.slice()),entry=complete(s,{action:'challenge',a:p(end,3),b:p(end,4),factor:'3'},0);
   assert.equal(entry.success,true);assert.equal(entry.transferredCount,0);assert.deepEqual(entry.taxedDigits,[3,9]);
   assert.deepEqual(entry.cleanup.map(t=>t.digit),[0]);assert.equal(s.taxed[0],1);assert.equal(s.taxed[5],0);
   assert.equal(s.board[p(3,3)],null);assert.equal(s.board[p(end+(end===2?-1:1),4)],5);
   assert.equal(s.board[p(end===2?4:2,3)],1);
   for(const digit of [0,5])assert.deepEqual(s.piles.map(pile=>pile[digit]),before.map(pile=>pile[digit]));
   assert.equal(s.history.length,1);assert.equal(s.turn,1-player);assert.equal(s.clocks[player],1220);
   conserved(s);const restored=JSON.parse(JSON.stringify(s));assert.ok(isSupportedBoardState(restored));assert.deepEqual(restored.history[0].cleanup,entry.cleanup);
  });
 }
 for(const vertical of [false,true]){
  const p=(x,y)=>vertical?x*size+y:y*size+x;
  test(`${size}: cleanup cascades through ${vertical?'vertical':'horizontal'} zeros but preserves the resulting isolated five`,()=>{
   const s=active(size);seed(s,[[p(1,3),5],[p(2,3),0],[p(3,3),0],[p(4,3),3],[p(5,3),7],[p(4,4),9]]);
   const entry=complete(s,{action:'challenge',a:p(4,3),b:p(4,4),factor:'3'},0);
   assert.deepEqual(entry.cleanup,[{index:p(3,3),digit:0},{index:p(2,3),digit:0}]);
   assert.equal(s.taxed[0],2);assert.equal(s.taxed[5],0);assert.equal(s.board[p(1,3)],5);assert.equal(s.board.filter(d=>d!==null).length,2);assert.equal(s.board[p(5,3)],7);conserved(s);
  });
  test(`${size}: a zero enclosed on one axis is removed if exposed on the other`,()=>{
   const s=active(size);seed(s,[[p(3,3),0],[p(2,3),1],[p(4,3),3],[p(3,2),7],[p(3,4),9],[p(4,4),3]]);
   const entry=complete(s,{action:'challenge',a:p(3,4),b:p(4,4),factor:'3'},0);
   assert.deepEqual(entry.cleanup,[{index:p(3,3),digit:0}]);assert.equal(s.board[p(2,3)],1);assert.equal(s.board[p(4,3)],3);conserved(s);
  });
 }
 test(`${size}: enclosed zeros, connected fives, and isolated ordinary digits remain`,()=>{
  const s=active(size),p=(x,y)=>y*size+x;
  seed(s,[[p(0,1),5],[p(1,1),1],[p(2,1),0],[p(3,1),3],[p(7,7),7],[p(5,5),9],[p(6,5),9]]);
  const entry=complete(s,{action:'challenge',a:p(5,5),b:p(6,5),factor:'3'},0);
  assert.deepEqual(entry.cleanup,[]);assert.equal(s.board[p(2,1)],0);assert.equal(s.board[p(0,1)],5);assert.equal(s.board[p(7,7)],7);conserved(s);
 });
 test(`${size}: a failed challenge never removes additional tiles`,()=>{
  const s=active(size),p=(x,y)=>y*size+x;
  seed(s,[[p(0,1),5],[p(1,1),1],[p(2,1),0],[p(3,1),3],...[1,4,3,7].map((d,i)=>[p(i+1,5),d])]);
  const board=s.board.slice(),piles=s.piles.map(pile=>pile.slice());
  const entry=complete(s,{action:'challenge',a:p(1,5),b:p(4,5),factor:'2'},0);assert.equal(entry.success,false);assert.equal(entry.cleanup,undefined);assert.equal(s.turn,1);assert.equal(s.history.length,1);
  assert.deepEqual(s.board,board);assert.deepEqual(s.piles,piles);assert.deepEqual(s.taxed,Array(10).fill(0));conserved(s);
 });
}
test('previous-rule saves and online states are rejected even without a pending challenge',()=>{
 const s=newGame();assert.ok(isSupportedBoardState(s));assert.equal(isSupportedBoardState({...s,rulesVersion:8}),false);
});
