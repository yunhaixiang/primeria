import test from "node:test";
import assert from "node:assert/strict";
import { newGame, completedTiles, claimedGroups, segments, validateSegment, scores, scoreBreakdown, applyMove } from "../engine.js";
import { cell, put, line } from "./position-fixtures.js";
const active = () => { const s = newGame({mode:"casual"},0); s.started=true; return s; };
test("unfinished regular chains and lone junctions have no completed tiles or challengeable segments", () => {
  const s=active(); line(s,cell("A3"),0,["r4","r4","r6"]); put(s,cell("L12"),"j1");
  assert.equal(completedTiles(s.board).size,0); assert.deepEqual(claimedGroups(s.board).map(g=>g.size),[1]);
  assert.deepEqual(segments(s.board,0),[]); assert.deepEqual(scores(s),[0,0]);
  assert.equal(scoreBreakdown(s)[0].unfinished,3);
});
test("a second junction completes an existing chain without flipping or changing earlier orientations", () => {
  const s=active(), path=line(s,cell("A3"),0,["j1","r4","r6"]);
  assert.equal(completedTiles(s.board).size,0);
  applyMove(s,{type:"drop",at:cell("D3"),tile:"j3",rotation:1},0);
  assert.deepEqual([...completedTiles(s.board)], [...path,cell("D3")]);
  assert.equal(validateSegment(s.board,[...path,cell("D3")],0),"3641");
  assert.equal(scoreBreakdown(s)[0].growing,4);
});
test("only directed junction-to-junction paths qualify; geometric contact alone does not", () => {
  const s=active(); put(s,cell("A3"),"j1",0,"arrow",1); put(s,cell("B3"),"r4",0,"arrow",1);
  put(s,cell("C3"),"j3",0,"arrow",3);
  assert.equal(completedTiles(s.board).size,0);
  assert.throws(()=>validateSegment(s.board,[cell("A3"),cell("B3")],0),/junction/);
  assert.throws(()=>validateSegment(s.board,[cell("A3"),cell("B3"),cell("C3")],0),/Follow/);
});
test("branched networks count shared junctions once and exclude dangling tails", () => {
  const s=active(); const trunk=line(s,cell("A3"),0,["j1","r4","r4","j1"]);
  put(s,cell("D2"),"r6",0,"arrow",0); put(s,cell("D1"),"j7",0,"arrow",0);
  put(s,cell("E3"),"r4",0,"arrow",1); put(s,cell("F3"),"r5",0,"arrow",1);
  const complete=completedTiles(s.board);
  assert.equal(complete.size,6); assert.ok(trunk.every(i=>complete.has(i)));
  assert.equal(complete.has(cell("E3")),false); assert.equal(complete.has(cell("F3")),false);
  assert.deepEqual(claimedGroups(s.board).map(g=>g.size),[6]);
  assert.equal(scoreBreakdown(s)[0].unfinished,2);
});
test("unfinished tails cannot bring an eight-tile completed group over the nine-tile threshold", () => {
  const s=active(); line(s,cell("A3"),0,["j1",...Array(6).fill("r4"),"j3"]);
  put(s,cell("I3"),"r6",0,"arrow",1);
  assert.deepEqual(scores(s),[0,0]); assert.equal(scoreBreakdown(s)[0].growing,8);
  assert.equal(scoreBreakdown(s)[0].unfinished,1);
});
test("nine completed tiles score while unfinished extensions do not", () => {
  const s=active(); line(s); put(s,cell("J3"),"r6",0,"arrow",1);
  assert.deepEqual(scores(s),[9,0]); assert.equal(scoreBreakdown(s)[0].unfinished,1);
  assert.deepEqual(claimedGroups(s.board).map(g=>g.size),[9]);
});
test("challenge endpoints must both be junctions, even when a regular end has degree one", () => {
  const s=active(); const path=line(s,cell("A3"),0,["j1","r4","r6"]);
  assert.throws(()=>validateSegment(s.board,path,0),/junction tiles/);
  assert.deepEqual(segments(s.board,0),[]);
});
test("segments may pass through intermediate junctions and the search cap never limits completion scoring", () => {
  const s=active(); const path=line(s,cell("A3"),0,["j1","j3","j7"]);
  assert.equal(validateSegment(s.board,path,0),"731");
  assert.equal(segments(s.board,0).length,3); assert.equal(segments(s.board,0,1).length,1);
  assert.equal(completedTiles(s.board).size,3);
  assert.deepEqual(claimedGroups(s.board).map(g=>g.size),[3]);
});
test("a broken completed path becomes unfinished immediately and loses its scoring eligibility", () => {
  const s=active(); line(s,cell("A3"),1,["j1","r4","r4","r4","r4","r4","r4","j3","j3"]);
  assert.deepEqual(scores(s),[0,9]);
  applyMove(s,{type:"challenge",path:[cell("H3"),cell("I3")],factor:"3"},0);
  assert.equal(completedTiles(s.board).size,0); assert.equal(scoreBreakdown(s)[1].unfinished,6);
  assert.deepEqual(scores(s),[2,0]);
});
