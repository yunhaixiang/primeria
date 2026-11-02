import test from "node:test";
import assert from "node:assert/strict";
import { createBot, findFactor } from "../bot.js";
import { line, cell } from "./position-fixtures.js";
import {
  newGame,
  segments,
  applyMove,
  isSupportedState,
  TYPE_MAP,
  reviewPosition,
  scores,
  scoreBreakdown,
  MAX_GAME_TURNS,
} from "../engine.js";
test("elementary factors are exact and never charged to the trial-division budget", () => {
  for (const n of [
    "777",
    "222222222222222222222222222222222222222222222222",
    "919865421",
    "1001",
    "91",
    "121",
  ]) {
    const f = findFactor(n, 0);
    assert.ok(f, n);
    assert.equal(BigInt(n) % BigInt(f), 0n);
    assert.ok(BigInt(f) > 1n && BigInt(f) < BigInt(n));
  }
  for (const n of ["2", "3", "5", "7", "11", "13", "17", "97"])
    assert.equal(findFactor(n), null);
});
test("bot prioritizes a verified profitable capture over a new route", () => {
  const s = newGame({ mode: "casual" });
  s.started = true;
  for (let k = 0; k < 3; k++) {
    s.reserves[1].j1--;
    s.board[cell("A3") + k] = {
      type: "j1",
      owner: 1,
      face: "arrow",
      rotation: 1,
      id: s.nextId++,
    };
  }
  const result = createBot({ seed: 7 }).choose(s);
  assert.equal(result.command.type, "challenge");
  const event = applyMove(s, result.command);
  assert.equal(event.success, true);
  assert.ok(isSupportedState(s));
});
test("bot finishes a nine-tile path with a safe junction instead of flipping", () => {
  const s = newGame({mode:"casual"},0); s.started=true;
  line(s,cell("A3"),0,["j1",...Array(7).fill("r4")]);
  const result=createBot({seed:27,strength:"advanced"}).choose(s);
  assert.equal(result.command.type,"drop"); assert.equal(result.command.at,cell("I3"));
  assert.equal(TYPE_MAP[result.command.tile].kind,"fork");
  const e=applyMove(s,result.command,0);
  assert.equal(e.enclosureCaptures,undefined); assert.deepEqual(scores(s),[9,0]); assert.equal(scoreBreakdown(s)[0].eligible,9);
  assert.ok(isSupportedState(s));
  for(const seg of segments(s.board,0)) assert.equal(findFactor(seg.number),null);
});
test("bot never challenges an unfinished regular-ended chain even if its digits are composite",()=>{
 const s=newGame({mode:"casual"},0);s.started=true;
 line(s,cell("A3"),1,["j1","r4","r4","r4"]);
 const result=createBot({seed:7,strength:"beginner"}).choose(s);
 assert.notEqual(result.command.type,"challenge");
 applyMove(s,result.command,0);assert.ok(isSupportedState(s));
});
test("search bots finish a replayable game using only oriented drops, exact challenges and passes",()=>{
 const s=newGame({mode:"casual"},0);s.started=true;
 const bots=[createBot({seed:27,strength:"beginner"}),createBot({seed:57,strength:"beginner"})];
 for(let step=0;!s.ended && step<1200;step++){
   const result=bots[s.turn].choose(s);
   assert.ok(result.analysis.budget>0);
   assert.ok(["drop","challenge","pass"].includes(result.command.type));
   const e=applyMove(s,result.command,0);
   if(e.type==="challenge") assert.equal(e.success,BigInt(e.number)%BigInt(e.factor)===0n);
   assert.ok(isSupportedState(s),`valid step ${step}`);
 }
 assert.ok(s.ended,"game completes without an invented result");
 const replay=reviewPosition(s,s.history.length);
 assert.deepEqual(replay.board,s.board);assert.deepEqual(replay.reserves,s.reserves);
 assert.deepEqual(replay.captured,s.captured);assert.deepEqual(scores(replay),scores(s));
});
