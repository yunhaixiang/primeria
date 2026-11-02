import test from "node:test";
import assert from "node:assert/strict";
import {newGame, territory, territoryPreview, endgameProjection, scores, scoreBreakdown, applyMove, isSupportedState, reviewPosition} from "../engine.js";
import {cell, put, placePath} from "./position-fixtures.js";
const active=()=>{const s=newGame({mode:"casual"},0);s.started=true;return s;};
const ring=(s,owner=0)=>placePath(s,["C3","D3","E3","E4","E5","D5","C5","C4"].map(cell),owner);

test("a surviving arrow network encloses a point without scoring its eight tiles",()=>{
 const fixture=active(),route=ring(fixture),s=active();
 for(const {at} of route){
   const t=fixture.board[at];
   applyMove(s,{type:"drop",at,tile:t.type,rotation:t.rotation},0);
   applyMove(s,{type:"pass"},0);
 }
 assert.deepEqual(territoryPreview(s.board).counts,[1,0]);
 assert.equal(territoryPreview(s.board).owners[cell("D4")],0);
 assert.equal(scoreBreakdown(s)[0].eligible,8);
 assert.deepEqual(scores(s),[1,0]);
 applyMove(s,{type:"pass"},0);
 assert.deepEqual(s.ended.scores,[1,0]);assert.ok(isSupportedState(s));
 assert.deepEqual(reviewPosition(s,s.history.length).ended,s.ended);
});
test("orthogonal walls enclose a square despite diagonal access; arrow directions do not determine territory",()=>{
 const s=active();for(const at of ["D3","E4","D5","C4"])put(s,cell(at),"j1");
 assert.equal(territory(s.board).owners[cell("D4")],0);
 s.board[cell("D3")].rotation=2;
 assert.equal(territory(s.board).owners[cell("D4")],0);
 // All four isolated groups disappear before scoring.
 assert.deepEqual(territoryPreview(s.board).counts,[0,0]);
});
test("an empty route to a board edge is neutral even when its other neighbours are one colour",()=>{
 const s=active();for(const at of ["C1","C2","D2","E2","E1"])put(s,cell(at),"j1");
 assert.equal(territory(s.board).owners[cell("D1")],null);
 assert.deepEqual(territory(s.board).counts,[0,0]);
});
test("an undersized invasion is captured before the surrounding territory is scored",()=>{
 const s=active();ring(s);put(s,cell("D4"),"j9",1);
 assert.equal(territoryPreview(s.board).owners[cell("D4")],0);
 applyMove(s,{type:"pass"},0);applyMove(s,{type:"pass"},0);
 assert.equal(s.captured[0].length,1);assert.deepEqual(scores(s),[2,0]);
 assert.equal(s.reserves[1].j9,17);assert.ok(isSupportedState(s));
});
test("a surviving enemy island makes the shared surrounding empty region neutral",()=>{
 const s=active(),outer=[];
 for(let c=2;c<=8;c++)outer.push(2*15+c);
 for(let r=3;r<=8;r++)outer.push(r*15+8);
 for(let c=7;c>=2;c--)outer.push(8*15+c);
 for(let r=7;r>=3;r--)outer.push(r*15+2);
 placePath(s,outer,0);
 placePath(s,["E5","F5","G5","G6","F6","E6"].map(cell),1);
 assert.deepEqual(territoryPreview(s.board).counts,[0,0]);
 assert.ok(endgameProjection(s.board).board[cell("E5")]);
});
test("ordinary challenges still award prisoners and can open a territory boundary",()=>{
 const s=active();const path=ring(s,1).map(x=>x.at);
 for(const at of [path[0],path.at(-1)]){
   s.reserves[1].j1++;s.reserves[1].j3--;s.board[at].type="j3";
 }
 assert.deepEqual(scores(s),[0,1]);
 const event=applyMove(s,{type:"challenge",path,factor:"3"},0);
 assert.equal(event.success,true);assert.equal(event.removed.length,8);
 assert.deepEqual(scores(s),[8,0]);assert.equal(s.reserves[1].j3,16);
 assert.ok(isSupportedState(s));
});
