import test from "node:test";
import assert from "node:assert/strict";
import { homeReachability, newGame, applyMove, territory, scores, scoreBreakdown, isSupportedState, reviewPosition, clone } from "../engine.js";
import { put, topPocket, placePath } from "./territory-fixtures.js";
const active = () => { const s = newGame({ mode: "casual" }, 0); s.started = true; return s; };
const board = () => Array(225).fill(null);
const wall = (b, cells, owner) => {
  for (const at of cells) b[at] = { owner, face: "arrow", type: "j1", rotation: 0 };
};
test("both players can reach the whole empty board from their own home edges", () => {
  for (const p of [0, 1]) assert.equal(homeReachability(board(), p).reduce((a, b) => a + b, 0), 225);
});
test("north-edge pocket traps Orange without requiring zero liberties", () => {
  const b = board();
  wall(b, [3, 18, 33, 34, 35, 36, 37, 22, 7], 0);
  const orange = homeReachability(b, 1);
  for (const at of [4, 5, 6, 19, 20, 21]) assert.equal(orange[at], 0);
  assert.equal(orange[0], 1);
  assert.equal(homeReachability(b, 0)[5], 1);
});
test("an open orthogonal gap restores escape; diagonal contact does not seal it", () => {
  const b = board();
  wall(b, [3, 18, 33, 34, 36, 37, 22, 7], 0);
  assert.equal(homeReachability(b, 1)[5], 1);
  b[35] = { owner: 0, face: "digit", type: "r4" };
  assert.equal(homeReachability(b, 1)[5], 1);
  b[35].face = "arrow";
  assert.equal(homeReachability(b, 1)[5], 0);
});
test("a tile on a home edge can escape, including at corners", () => {
  const b = board();
  wall(b, [1, 15, 16], 1);
  assert.equal(homeReachability(b, 0)[0], 1);
  wall(b, [1, 15, 16], 0);
  assert.equal(homeReachability(b, 1)[0], 1);
});
test("friendly and unclaimed tiles are passable in the escape test", () => {
  const b = board();
  wall(b, [3, 18, 33, 34, 36, 37, 22, 7], 0);
  b[35] = { owner: 1, face: "arrow", type: "j3" };
  assert.equal(homeReachability(b, 1)[5], 1);
  b[35] = { owner: 0, face: "digit", type: "r4" };
  assert.equal(homeReachability(b, 1)[5], 1);
});
test("enclosure is symmetric after swapping players and rotating a quarter turn", () => {
  const b = board(), rotated = board();
  wall(b, [3, 18, 33, 34, 35, 36, 37, 22, 7], 0);
  const rotate = at => at % 15 * 15 + 14 - Math.floor(at / 15);
  b.forEach((t, at) => { if (t) rotated[rotate(at)] = { ...t, owner: 1 - t.owner }; });
  const before = homeReachability(b, 1), after = homeReachability(rotated, 0);
  before.forEach((value, at) => assert.equal(after[rotate(at)], value));
});
test("a Claim captures surrounded unclaimed tiles, including those not adjacent to its wall", () => {
  const s = active(), tiles = topPocket(s);
  put(s, 5, "r2", 1); put(s, 20, "r4", 1);
  put(s, 4, "j1", 1, "arrow", 2); put(s, 19, "j3", 1, "arrow", 2);
  put(s, 0, "r8", 1);
  const e = applyMove(s, { type: "claim", tiles }, 0);
  assert.deepEqual(e.enclosureCaptures, [{ at: 5, by: 0 }, { at: 20, by: 0 }]);
  assert.ok(s.board[4]); assert.ok(s.board[19]); assert.ok(s.board[0]);
  assert.equal(e.adjacentCaptures, undefined);
  assert.equal(scoreBreakdown(s)[0].territory, 4);
  assert.deepEqual(scores(s), [15, 0]);
  assert.ok(isSupportedState(s));
});
test("enclosure capture waits for a Claim, never a Drop, Pass or failed Challenge", () => {
  for (const kind of ["drop", "pass", "challenge"]) {
    const s = active(); topPocket(s, 9); put(s, 5, "r4", 1);
    put(s, 150, "j1", 1, "arrow", 1); put(s, 151, "j3", 1, "arrow", 1);
    const command = kind === "drop" ? { type: kind, at: 160, tile: "r4" } : kind === "pass" ? { type: kind } : { type: kind, path: [150, 151], factor: "2", fee: "r2" };
    applyMove(s, command, 0);
    assert.ok(s.board[5]); assert.equal(s.captured[0].length, 0);
  }
});
test("an eight-tile wall does not score territory; a matching ninth tile does", () => {
  const s = active(); topPocket(s, 9);
  assert.equal(scoreBreakdown(s)[0].territory, 6);
  s.board[7].face = "digit";
  assert.equal(scoreBreakdown(s)[0].territory, 0);
  assert.equal(territory(s.board)[5], null);
});
function widePocket(s) {
  const cells = [...Array.from({ length: 5 }, (_, r) => r * 15 + 2), ...Array.from({ length: 10 }, (_, c) => 63 + c), ...Array.from({ length: 4 }, (_, r) => (3 - r) * 15 + 12)];
  placePath(s, cells);
}
test("a small invading island does not contest territory; reaching nine does", () => {
  const s = active(); widePocket(s);
  const invasion = placePath(s, Array.from({ length: 9 }, (_, c) => 33 + c), 1, false);
  for (const { at, rotation } of invasion.slice(0, 7)) Object.assign(s.board[at], { face: "arrow", rotation });
  assert.equal(scoreBreakdown(s)[0].territory, 27);
  assert.equal(territory(s.board)[20], 0);
  s.turn = 1;
  applyMove(s, { type: "claim", tiles: invasion.slice(7) }, 0);
  assert.equal(scoreBreakdown(s)[0].territory, 0);
  assert.equal(territory(s.board)[20], null);
  assert.deepEqual(scores(s), [19, 9]);
  const next = placePath(s, [150, 151], 0, false);
  applyMove(s, { type: "claim", tiles: next }, 0);
  assert.ok(invasion.every(t => s.board[t.at]?.face === "arrow"));
  assert.ok(isSupportedState(s));
});
test("endgame captures an undersized invading island and unclaimed tiles, then counts the cleared territory", () => {
  const s = active(); widePocket(s);
  const invasion = placePath(s, Array.from({ length: 9 }, (_, c) => 33 + c), 1, false);
  for (const { at, rotation } of invasion.slice(0, 7)) Object.assign(s.board[at], { face: "arrow", rotation });
  applyMove(s, { type: "pass" }, 0);
  const e = applyMove(s, { type: "pass" }, 0);
  assert.equal(e.smallGroups.length, 7); assert.equal(e.unclaimed.length, 2);
  assert.equal(s.captured[0].length, 9);
  assert.equal(scoreBreakdown(s)[0].territory, 36);
  assert.deepEqual(scores(s), [64, 0]);
  assert.ok(isSupportedState(JSON.parse(JSON.stringify(s))));
});
test("challenging an invasion below nine restores the surrounding territory immediately", () => {
  const s = active(); widePocket(s);
  const types = ["j3", "j3", "r2", "r2", "r2", "r2", "r2", "r4", "j1"];
  types.forEach((type, k) => put(s, 33 + k, type, 1, "arrow", 1));
  assert.equal(scoreBreakdown(s)[0].territory, 0);
  applyMove(s, { type: "challenge", fee: "r0", path: [33, 34], factor: "3" }, 0);
  assert.equal(scoreBreakdown(s)[0].territory, 29);
  assert.equal(scoreBreakdown(s)[1].growing, 7);
  assert.deepEqual(scores(s), [50, 1]);
  assert.ok(isSupportedState(s));
});
test("a successful challenge opens the surrounding wall and removes its territory", () => {
  const s = active(), tiles = topPocket(s, 9);
  s.reserves[0].j3++; s.reserves[0].j9--; s.board[7].type = "j9";
  assert.equal(scoreBreakdown(s)[0].territory, 6);
  s.turn = 1;
  const e = applyMove(s, { type: "challenge", fee: "r2", path: tiles.map(t => t.at), factor: "7" }, 0);
  assert.equal(e.success, true);
  assert.equal(scoreBreakdown(s)[0].territory, 0);
  assert.deepEqual(scores(s), [1, 9]);
  assert.ok(isSupportedState(s));
});
test("large territory scores above the old tile-only limit and survives serialization", () => {
  const s = active();
  const cells = [...Array.from({ length: 14 }, (_, r) => r * 15 + 1), ...Array.from({ length: 12 }, (_, c) => 197 + c), ...Array.from({ length: 13 }, (_, r) => (12 - r) * 15 + 13)];
  placePath(s, cells);
  assert.equal(scoreBreakdown(s)[0].territory, 143);
  applyMove(s, { type: "pass" }, 0); applyMove(s, { type: "pass" }, 0);
  assert.equal(scores(s)[0], 182);
  assert.ok(isSupportedState(JSON.parse(JSON.stringify(s))));
});
test("a legal enclosure game replays every position, score and territory exactly", () => {
  const s = active(), fixture = active(), tiles = topPocket(fixture), positions = [clone(s)];
  const record = command => { applyMove(s, command, 0); assert.ok(isSupportedState(s)); positions.push(clone(s)); };
  tiles.forEach(({ at }, k) => {
    record({ type: "drop", at, tile: fixture.board[at].type });
    record(k < 2 ? { type: "drop", at: k ? 20 : 5, tile: k ? "r4" : "r2" } : { type: "pass" });
  });
  record({ type: "claim", tiles }); record({ type: "pass" }); record({ type: "pass" });
  assert.deepEqual(scores(s), [17, 0]);
  positions.forEach((expected, turn) => {
    const replay = reviewPosition(s, turn);
    assert.deepEqual(replay.board, expected.board);
    assert.deepEqual(replay.captured, expected.captured);
    assert.deepEqual(territory(replay.board), territory(expected.board));
    assert.deepEqual(scores(replay), scores(expected));
  });
});
test("territory ownership and scores rotate with home edges and player colors", () => {
  const s = active(), other = active(); topPocket(s, 9);
  const rotate = at => at % 15 * 15 + 14 - Math.floor(at / 15);
  s.board.forEach((t, at) => {
    if (t) put(other, rotate(at), t.type, 1 - t.owner, t.face, (t.rotation + 1) % 4);
  });
  const before = territory(s.board), after = territory(other.board);
  before.forEach((value, at) => assert.equal(after[rotate(at)], value === null ? null : 1 - value));
  assert.deepEqual(scores(other), scores(s).slice().reverse());
});
