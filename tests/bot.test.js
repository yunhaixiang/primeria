import test from "node:test";
import assert from "node:assert/strict";
import { createBot, findFactor } from "../bot.js";
import { topPocket, cell } from "./territory-fixtures.js";
import {
  newGame,
  applyMove,
  isSupportedState,
  TYPE_MAP,
  reviewPosition,
  scores,
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
function put(s, at, type, owner = 0, face = "digit", rotation = 0) {
  s.reserves[owner][type]--;
  s.board[at] = { id: s.nextId++, type, owner, face, rotation };
}
test("bot closes an enclosure to capture unfinished construction and score claimed tiles", () => {
  const s = newGame({ mode: "casual" }, 0);
  s.started = true;
  topPocket(s, 7);
  for (const at of [5, cell("F2")]) put(s, at, "r2", 1);
  const result = createBot({ seed: 27, strength: "advanced" }).choose(s);
  assert.equal(result.command.type, "claim");
  assert.equal(result.command.tiles.length, 2);
  const e = applyMove(s, result.command, 0);
  assert.equal(e.enclosureCaptures.length, 2);
  assert.deepEqual(scores(s), [11, 0]);
  assert.ok(isSupportedState(s));
});
test("bot connects two new tiles to complete a nine-tile scoring group", () => {
  const s = newGame({ mode: "casual" }, 0);
  s.started = true;
  topPocket(s, 7);
  assert.deepEqual(scores(s), [0, 0]);
  const result = createBot({ seed: 9, strength: "advanced" }).choose(s);
  assert.equal(result.command.type, "claim");
  applyMove(s, result.command, 0);
  assert.deepEqual(scores(s), [9, 0]);
  assert.ok(isSupportedState(s));
});
test("bot develops and claims tiles beside an established enemy claimed group", () => {
  const s = newGame({ mode: "casual" }, 0);
  s.started = true;
  put(s, cell("H8"), "j1", 1, "arrow", 1);
  put(s, cell("I8"), "j3", 1, "arrow", 1);
  put(s, cell("H7"), "j3"); // adjacent to the old enemy arrows is a valid starting point
  const bot = createBot({ seed: 42, strength: "advanced" });
  for (let turn = 0; turn < 3; turn++) {
    const result = bot.choose(s);
    applyMove(s, result.command, 0);
    assert.ok(isSupportedState(s));
    applyMove(s, { type: "pass" }, 0);
  }
  assert.equal(s.board[cell("H7")].face, "arrow");
  assert.ok(s.board[cell("H8")]);
  assert.ok(s.board[cell("I8")]);
});
test("two search bots complete a replayable game without invalid moves or arithmetic errors", () => {
  const s = newGame({ mode: "casual" }, 0);
  s.started = true;
  // Start from a legal enclosure race so this regression exercises claims
  // with enclosure captures rather than assuming empty-board strength.
  const fixture = newGame({ mode: "casual" }, 0), tiles = topPocket(fixture);
  tiles.forEach(({ at }, k) => {
    applyMove(s, { type: "drop", at, tile: fixture.board[at].type }, 0);
    applyMove(s, k < 2 ? { type: "drop", at: k ? cell("F2") : 5, tile: "r2" } : { type: "pass" }, 0);
  });
  applyMove(s, { type: "claim", tiles: tiles.slice(0, 6) }, 0);
  applyMove(s, { type: "pass" }, 0);
  const bots = [createBot({ seed: 27 }), createBot({ seed: 57 })];
  let turns = 0;
  // Include optional challenge steps as well as completed turns.
  const maxTurns = 2000; // Regression search budget, not a rule of play.
  while (!s.ended && turns < maxTurns) {
    const result = bots[s.turn].choose(s);
    assert.ok(result.analysis.budget > 0);
    const e = applyMove(s, result.command, 0);
    if (e.type === "challenge")
      assert.equal(e.success, BigInt(e.number) % BigInt(e.factor) === 0n);
    assert.ok(isSupportedState(s), `valid state after turn ${turns}`);
    turns++;
  }
  assert.ok(s.ended, "game finishes without an arbitrary adjudication");
  assert.ok(s.history.some((e) => e.type === "claim"));
  const replay = reviewPosition(s, s.history.length);
  assert.deepEqual(replay.board, s.board);
  assert.deepEqual(replay.reserves, s.reserves);
  assert.deepEqual(scores(replay), scores(s));
});
