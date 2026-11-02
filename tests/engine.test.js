import test from "node:test";
import assert from "node:assert/strict";
import {
  newGame, TYPES, TYPE_MAP, TILES_PER_PLAYER, BOARD_SIZE, BOARD_CELLS, RULES_VERSION,
  total, applyMove, validateMove, isSupportedState, scores, scoreBreakdown,
  reviewPosition, graph, hasCycle, setRunning, tick, resign, clone,
  beginGameCountdown, finishGameCountdown, coordinate, neighbor,
} from "../engine.js";
import { cell, put, line } from "./position-fixtures.js";
export const active = (mode = "casual") => { const s = newGame({ mode }, 0); s.started = true; return s; };
const move = (s, m) => applyMove(s, m, 0);
test("nine digits, 18 copies each, and the new digit-to-arrow mapping", () => {
  const s = active();
  assert.equal(TILES_PER_PLAYER, 162);
  assert.equal(total(s.reserves[0]), 162);
  assert.equal(TYPE_MAP.r0, undefined);
  assert.deepEqual(TYPES.map(t => t.digit), [1,2,3,4,5,6,7,8,9]);
  assert.ok(TYPES.every(t => t.count === 18));
  assert.deepEqual(TYPE_MAP.r2.exits, [3]);
  assert.deepEqual(TYPE_MAP.r8.exits, [1]);
  for (const id of ["r4", "r5", "r6"]) assert.deepEqual(TYPE_MAP[id].exits, [0]);
  for (const id of ["j1", "j3", "j7", "j9"]) assert.equal(TYPE_MAP[id].kind, "fork");
  assert.ok(isSupportedState(s));
});
test("Drop commits its orientation immediately; Claim, zero and occupied squares are rejected atomically", () => {
  const s = active();
  const e = move(s, { type: "drop", tile: "r2", at: 0, rotation: 3 });
  assert.equal(s.board[0].face, "arrow");
  assert.equal(s.board[0].rotation, 3);
  assert.equal(e.rotation, 3);
  assert.ok(isSupportedState(s)); // Isolated construction is legal.
  for (const command of [
    { type: "claim", tiles: [] }, { type: "drop", tile: "r0", at: 1 },
    { type: "drop", tile: "j1", at: 0 }, { type: "drop", tile: "j1", at: 1, rotation: 4 },
    { type: "drop", tile: "j1", at: -1 }, { type: "drop", tile: "j1", at: 225 },
  ]) {
    const before = clone(s);
    assert.throws(() => move(s, command));
    assert.deepEqual(s, before);
  }
});
test("a Drop that closes a directed cycle is rejected without consuming a tile", () => {
  const s = active();
  put(s, cell("B2"), "r8", 0, "arrow", 0);
  put(s, cell("C2"), "r8", 0, "arrow", 1);
  put(s, cell("C3"), "r8", 0, "arrow", 2);
  assert.equal(hasCycle(graph(s.board)), false);
  const before = clone(s);
  assert.throws(() => move(s, { type: "drop", tile: "r8", at: cell("B3"), rotation: 3 }), /cycle/);
  assert.deepEqual(s, before);
});
test("optional challenge captures exact tiles, scores prisoners, and preserves the turn", () => {
  const s = active(); const path = line(s, cell("A3"), 1, ["j1", "j9"]);
  const reserve = clone(s.reserves);
  const e = move(s, { type: "challenge", path, factor: "7" });
  assert.equal(e.number, "91"); assert.equal(e.success, true);
  assert.equal(s.turn, 0); assert.equal(s.challengeUsed, true);
  assert.deepEqual(scores(s), [2,0]); assert.deepEqual(s.reserves, reserve);
  assert.ok(isSupportedState(s));
  assert.throws(() => move(s, { type: "challenge", path, factor: "7" }), /one challenge/);
  move(s, { type: "drop", at: 0, tile: "r8", rotation: 2 });
  assert.equal(s.turn, 1); assert.equal(s.challengeUsed, false);
});
test("factor validation is exact for large integers and failed attempts do not remove tiles", () => {
  const s = active(); const path = line(s, cell("A3"), 1, ["j1", ...Array(13).fill("r4"), "j1"]);
  for (const factor of ["0", "1", "-2", "1.5", "x", "1".repeat(163)])
    assert.throws(() => move(s, { type: "challenge", path, factor }));
  const e = move(s, { type: "challenge", path, factor: "3" });
  assert.equal(e.success, BigInt(e.number) % 3n === 0n);
  assert.ok(isSupportedState(s));
});
test("two passes capture unfinished tiles and completed groups below six", () => {
  const s = active();
  line(s); // Nine completed blue tiles survive.
  line(s, cell("A5"), 1, ["j3", "j7"]); // Two completed orange tiles do not.
  put(s, cell("L12"), "r4"); // An unfinished blue tile.
  assert.deepEqual(scoreBreakdown(s).map(x => [x.eligible, x.growing, x.unfinished]), [[9,0,1],[0,2,0]]);
  move(s, { type: "pass" }); move(s, { type: "pass" });
  assert.deepEqual(scores(s), [11,1]);
  assert.equal(s.ended.winner, 0); assert.equal(s.board.filter(Boolean).length, 9);
  assert.ok(isSupportedState(s));
});
test("a non-pass placement resets the pass streak", () => {
  const s = active(); move(s, { type: "pass" });
  move(s, { type: "drop", at: 0, tile: "r4", rotation: 2 });
  assert.equal(s.passCount, 0); move(s, { type: "pass" }); assert.equal(s.ended, null);
});
test("successful challenge breaks a pass streak, failed challenge does not", () => {
  for (const factor of ["2", "3"]) {
    const s = active(); const path = line(s, cell("A3"), 0, ["j3", "j3"]);
    move(s, { type: "pass" }); move(s, { type: "challenge", path, factor });
    move(s, { type: "pass" });
    assert.equal(Boolean(s.ended), factor === "2");
    assert.ok(isSupportedState(s));
  }
});
test("one increment follows the ordinary move, with the clock running through challenge verification", () => {
  const s = newGame({ mode: "blitz" }, 0); const path = line(s, cell("A3"), 1, ["j3", "j3"]);
  setRunning(s, true, 0);
  applyMove(s, { type: "challenge", path, factor: "3" }, 5000);
  assert.deepEqual(s.clocks, [595,600]);
  applyMove(s, { type: "drop", tile: "r4", at: 0, rotation: 1 }, 10000);
  assert.deepEqual(s.clocks, [600,600]);
  setRunning(s, false, 15000); tick(s, 90000); assert.equal(s.clocks[1], 595);
  setRunning(s, true, 90000); tick(s, 700000);
  assert.equal(s.ended.winner, 0); assert.equal(s.ended.reason, "time");
});
test("opening countdown protects the first clock and blocks early moves", () => {
  const s = newGame({ mode: "standard" }, 0); beginGameCountdown(s, 0);
  assert.ok(isSupportedState(s)); assert.equal(finishGameCountdown(s, 2999), false);
  assert.throws(() => applyMove(s, { type: "drop", tile: "j1", at: 0 }, 1000), /Start or resume/);
  assert.throws(() => setRunning(s, true, 1000), /starting/);
  assert.equal(finishGameCountdown(s, 3500), true);
  assert.equal(s.clocks[0], 1799.5); assert.ok(isSupportedState(s));
});
test("casual clocks stay disabled and resignation awards the game to the opponent", () => {
  const s = active(); tick(s, 9999999); assert.deepEqual(s.clocks, [null,null]);
  resign(s, 0, 9999999); assert.equal(s.ended.winner, 1);
});
test("review preserves placement orientations, challenge steps, supplies, cleanup and final scores", () => {
  const s = active();
  const cmds = [
    {type:"drop", at:cell("A2"), tile:"r4", rotation:0},
    {type:"drop", at:cell("A5"), tile:"r6", rotation:2},
    {type:"drop", at:cell("A3"), tile:"j1", rotation:1},
    {type:"drop", at:cell("A6"), tile:"j3", rotation:2},
    {type:"drop", at:cell("B3"), tile:"j9", rotation:1},
    {type:"challenge", path:[cell("A3"),cell("B3")], factor:"7"},
    {type:"drop", at:cell("A7"), tile:"r6", rotation:2},
    {type:"pass"}, {type:"pass"},
  ];
  for (const cmd of cmds) { move(s,cmd); assert.ok(isSupportedState(s)); }
  const replay = reviewPosition(s,s.history.length);
  for (const field of ["board","reserves","captured","ended"]) assert.deepEqual(replay[field],s[field]);
  assert.equal(reviewPosition(s,3).board[cell("A3")].rotation,1);
});
test("validateMove is pure and bad snapshots cannot reach rendering or replay", () => {
  const s = active(), before = clone(s); validateMove(s, {type:"drop", at:0,tile:"r4",rotation:3});
  assert.deepEqual(s,before);
  move(s, {type:"drop", at:0,tile:"r4",rotation:3});
  for (const corrupt of [
    x=>x.rulesVersion=RULES_VERSION-1, x=>x.boardSize=13, x=>x.reserves[0].j1++,
    x=>x.board.pop(), x=>x.board[0].face="digit", x=>x.board[0].type="r0",
    x=>x.history[0].rotation=7, x=>x.history[0].command.rotation=2,
    x=>x.history[0].type="claim", x=>x.history[0].command=null,
    x=>x.history[0].clocks=[NaN,null], x=>x.clocks=[NaN,null],
    x=>x.nextId=1, x=>x.names[0]="x".repeat(30), x=>x.turn=4,
  ]) { const bad=clone(s); corrupt(bad); assert.equal(isSupportedState(bad),false); }
});
test("15-square board edges and coordinates do not wrap", () => {
  assert.equal(BOARD_SIZE,15); assert.equal(BOARD_CELLS,225); assert.equal(coordinate(224),"O15");
  assert.equal(neighbor(14,1),null); assert.equal(neighbor(15,3),null); assert.equal(neighbor(210,2),null);
  assert.equal(neighbor(224,0),209);
});

test("junctions may start isolated networks without an existing connection", () => {
  const s = active();
  move(s, {type:"drop",at:cell("C3"),tile:"j1",rotation:1});
  assert.equal(graph(s.board).degree(cell("C3")), 0);
  assert.ok(isSupportedState(s));
});
test("a single 9 junction is not a segment, while composite paths through junctions are challengeable", () => {
  const s = active(); const path = line(s, cell("A3"), 1, ["j1","j3","j1","j3"]);
  put(s,cell("L12"),"j9",1);
  assert.throws(() => move(s,{type:"challenge",path:[cell("L12")],factor:"3"}), /at least two/);
  const e = move(s,{type:"challenge",path,factor:"31"});
  assert.equal(e.number,"3131"); assert.equal(e.success,true); assert.equal(e.removed.length,4);
  assert.ok(s.board[cell("L12")]);
});
