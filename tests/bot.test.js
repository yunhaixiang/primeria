import test from "node:test";
import assert from "node:assert/strict";
import { createBot, findFactor } from "../bot.js";
import { topPocket } from "./territory-fixtures.js";
import {
  newGame,
  applyMove,
  isSupportedState,
  TYPE_MAP,
  reviewPosition,
  scores,
  TILES_PER_PLAYER,
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
    s.board[26 + k] = {
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
test("bot closes an enclosure to capture unfinished construction and score territory", () => {
  const s = newGame({ mode: "casual" }, 0);
  s.started = true;
  topPocket(s, 7);
  for (const at of [5, 18]) put(s, at, "r2", 1);
  const result = createBot({ seed: 27, strength: "advanced" }).choose(s);
  assert.equal(result.command.type, "claim");
  assert.equal(result.command.tiles.length, 2);
  const e = applyMove(s, result.command, 0);
  assert.equal(e.enclosureCaptures.length, 2);
  assert.deepEqual(scores(s), [17, 0]);
  assert.ok(isSupportedState(s));
});
test("bot connects two new tiles to turn a seven-tile group into a scoring group", () => {
  const s = newGame({ mode: "casual" }, 0);
  s.started = true;
  const types = ["j1", "r2", "r4", "r6", "r8", "r2", "r4", "r2", "r2"];
  types.forEach((type, k) =>
    put(s, 26 + k, type, 0, k < 7 ? "arrow" : "digit", 1),
  );
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
  put(s, 98, "j1", 1, "arrow", 1);
  put(s, 99, "j3", 1, "arrow", 1);
  put(s, 85, "j3"); // adjacent to the old enemy arrows is a valid starting point
  const bot = createBot({ seed: 42, strength: "advanced" });
  for (let turn = 0; turn < 3; turn++) {
    const result = bot.choose(s);
    applyMove(s, result.command, 0);
    assert.ok(isSupportedState(s));
    assert.equal(s.captured[1].length, 0);
    applyMove(s, { type: "pass" }, 0);
  }
  assert.equal(s.board[85].face, "arrow");
  assert.ok(s.board[98]);
  assert.ok(s.board[99]);
});
test("two search bots complete a replayable game without invalid moves or arithmetic errors", () => {
  const s = newGame({ mode: "casual" }, 0);
  s.started = true;
  const bots = [createBot({ seed: 42 }), createBot({ seed: 57 })];
  let turns = 0;
  // At most 116 drops/challenges and 58 claims, each separated by a pass,
  // followed by the two ending passes. Contact is no longer self-capture.
  const maxTurns = 6 * TILES_PER_PLAYER + 2;
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
  assert.deepEqual(replay.captured, s.captured);
  assert.deepEqual(scores(replay), scores(s));
});
