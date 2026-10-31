import test from "node:test";
import assert from "node:assert/strict";
import { createBot, findFactor } from "../bot.js";
import {
  newGame,
  applyMove,
  isSupportedState,
  TYPE_MAP,
  reviewPosition,
  scores,
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
    s.board[30 + k] = {
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
test("two search bots complete a replayable game without invalid moves or arithmetic errors", () => {
  const s = newGame({ mode: "casual" }, 0);
  s.started = true;
  const bots = [createBot({ seed: 42 }), createBot({ seed: 57 })];
  let turns = 0;
  while (!s.ended && turns < 160) {
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
