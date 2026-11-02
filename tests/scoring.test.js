import test from "node:test";
import assert from "node:assert/strict";
import {newGame, applyMove, scores, scoreBreakdown, isSupportedState, reviewPosition} from "../engine.js";
import {cell, put, placePath, line} from "./position-fixtures.js";
const active=()=>{const s=newGame({mode:"casual"},0);s.started=true;return s;};
const ring=(s,owner=0)=>placePath(s,["C3","D3","E3","E4","E5","D5","C5","C4"].map(cell),owner);

test("an enclosed empty square adds no points to the eight surviving wall tiles",()=>{
 const fixture=active(),route=ring(fixture),s=active();
 for(const {at} of route){
   const t=fixture.board[at];
   applyMove(s,{type:"drop",at,tile:t.type,rotation:t.rotation},0);
   applyMove(s,{type:"pass"},0);
 }
 assert.deepEqual(scores(s),[8,0]);
 assert.equal(s.board[cell("D4")],null);
 assert.equal(scoreBreakdown(s)[0].territory,undefined);
 applyMove(s,{type:"pass"},0);
 assert.deepEqual(s.ended.scores,[8,0]);
 assert.ok(isSupportedState(s));
 assert.deepEqual(reviewPosition(s,s.history.length).ended,s.ended);
});

test("open and enclosing networks of the same size score equally",()=>{
 const open=active(),closed=active();
 line(open,cell("A3"),0,["j1",...Array(6).fill("r4"),"j3"]);
 ring(closed);
 assert.deepEqual(scores(open),[8,0]);
 assert.deepEqual(scores(closed),[8,0]);
});

test("cleanup adds prisoners to surviving-tile points, without empty-space points or returns",()=>{
 const s=active();ring(s);put(s,cell("D4"),"j9",1);
 applyMove(s,{type:"pass"},0);applyMove(s,{type:"pass"},0);
 assert.equal(s.captured[0].length,1);
 assert.equal(s.reserves[1].j9,17);
 assert.deepEqual(scores(s),[9,0]);
 assert.equal(s.board.filter(Boolean).length,8);
 assert.ok(isSupportedState(s));
});
