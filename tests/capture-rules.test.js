import test from "node:test";
import assert from "node:assert/strict";
import { newGame, applyMove, scores, isSupportedState, reviewPosition, clone } from "../engine.js";
import { cell, put, line, topPocket } from "./position-fixtures.js";
const active=()=>{const s=newGame({mode:"casual"},0);s.started=true;return s;};
test("capture removes only the selected segment and leaves all disconnected survivors",()=>{
 const s=active(); const path=line(s,cell("A3"),1,["j3","j1","j9"]);
 put(s,cell("L12"),"r2",1,"arrow",2); put(s,cell("M12"),"j1",0,"arrow",0);
 const e=applyMove(s,{type:"challenge",path:path.slice(1),factor:"7"},0);
 assert.deepEqual(e.removed,[path[1],path[2]]);
 assert.ok(s.board[path[0]]);
 assert.equal(s.captured[0].length,2); assert.ok(s.board[cell("L12")]); assert.ok(s.board[cell("M12")]);
 assert.ok(isSupportedState(s));
});
test("a failed challenge removes neither the target nor any isolated tiles",()=>{
 const s=active(),path=line(s,cell("A3"),1,["j1","j3"]); put(s,cell("L12"),"r2");
 const e=applyMove(s,{type:"challenge",path,factor:"2"},0);
 assert.equal(e.success,false); assert.deepEqual(e.removed,[]); assert.equal(s.board.filter(Boolean).length,3);
});
test("capturing one branch leaves a connected unfinished fragment for later rebuilding",()=>{
 const s=active(),path=line(s,cell("A3"),1,["j1","r4","j3","j3"]);
 applyMove(s,{type:"challenge",path:path.slice(2),factor:"3"},0);
 assert.ok(s.board[path[0]]); assert.ok(s.board[path[1]]); assert.equal(s.captured[0].length,2);
 assert.ok(isSupportedState(s));
});
test("closing a geometric pocket captures no enemy tiles and gives no boundary ownership",()=>{
 const s=active(); const fixture=active(), route=topPocket(fixture);
 applyMove(s,{type:"drop",at:cell("D2"),tile:"r4",rotation:2},0);
 applyMove(s,{type:"drop",at:cell("F2"),tile:"r4",rotation:0},0);
 for(const [k,{at}] of route.entries()) {
  if(at===cell("D2")) continue;
  applyMove(s,{type:"drop",at,tile:fixture.board[at].type,rotation:fixture.board[at].rotation},0);
  applyMove(s,{type:"pass"},0);
 }
 assert.ok(s.board[cell("F2")]); assert.deepEqual(scores(s),[9,0]); assert.equal(s.captured[0].length,0);
 assert.ok(isSupportedState(s));
 const replay=reviewPosition(s,s.history.length); assert.deepEqual(replay.board,s.board);
});
test("endgame captures unfinished construction and sub-six completed groups only once",()=>{
 const s=active(); line(s); put(s,cell("J3"),"r4",0,"arrow",1);
 line(s,cell("A5"),1,["j1","j7"]); put(s,cell("L12"),"j9",1);
 applyMove(s,{type:"pass"},0); const e=applyMove(s,{type:"pass"},0);
 assert.equal(e.unclaimed.length,1); assert.equal(e.smallGroups.length,3);
 assert.deepEqual(scores(s),[12,1]); assert.ok(isSupportedState(s));
});
test("obsolete surrounding-capture history metadata is rejected",()=>{
 const s=active(); applyMove(s,{type:"drop",tile:"r4",at:0},0);
 const bad=clone(s);bad.history[0].enclosureCaptures=[];assert.equal(isSupportedState(bad),false);
});

test("endgame removes unsupported regulars before measuring groups, keeping stranded junctions until stage two",()=>{
 const s=active(); line(s,cell("A3"),0,["j1",...Array(3).fill("r4"),"j3"]);
 put(s,cell("F3"),"r6",0,"arrow",1);
 applyMove(s,{type:"pass"},0); const e=applyMove(s,{type:"pass"},0);
 assert.deepEqual(e.unclaimed,[cell("F3")]); assert.equal(e.smallGroups.length,5);
 assert.deepEqual(scores(s),[0,6]); assert.equal(s.board.filter(Boolean).length,0);
});
