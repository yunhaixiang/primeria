import { cell } from "./territory-fixtures.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  BOARD_SIZE,
  BOARD_CELLS,
  MAX_GAME_TURNS,
  coordinate,
  neighbor,
  TYPES,
  TYPE_MAP,
  inventory,
  total,
  newGame,
  applyMove,
  validateMove,
  claimPreview,
  ports,
  graph,
  hasCycle,
  segments,
  validateSegment,
  segmentNumber,
  scores,
  isSupportedState,
  reviewPosition,
  setRunning,
  tick,
  resign,
  clone,
} from "../engine.js";
function game() {
  const s = newGame({ mode: "casual" }, 0);
  s.started = true;
  return s;
}
function put(s, at, type, owner = 0, face = "digit", rotation = 0) {
  assert.ok(s.reserves[owner][type] > 0);
  s.reserves[owner][type]--;
  s.board[at] = { id: s.nextId++, type, owner, face, rotation };
}
function line(
  s,
  start = cell("A3"),
  owner = 0,
  types = ["j1", "r2", "r4", "r6", "r8", "r2", "r4", "r6", "j1"],
  face = "digit",
) {
  types.forEach((type, k) => put(s, start + k, type, owner, face, 1));
  return types.map((_, k) => ({ at: start + k, rotation: 1 }));
}
const move = (s, m) => applyMove(s, m, 0);
test("150 tiles per player, one arrow type per digit and exact bends/forks", () => {
  assert.equal(total(inventory()), 150);
  assert.equal(TYPES.length, 10);
  assert.ok(TYPES.every(type => type.count === 15));
  assert.deepEqual(
    TYPES.map((t) => t.digit),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
  assert.equal(
    TYPES.filter((t) => t.id[0] === "j").reduce((n, t) => n + t.count, 0),
    60,
  );
  assert.equal(TYPE_MAP.r0.kind, "left");
  assert.equal(TYPE_MAP.r5.kind, "right");
  assert.deepEqual(
    [1, 3, 7, 9].map((d) =>
      TYPES.filter((t) => t.digit === d).reduce((n, t) => n + t.count, 0),
    ),
    [15, 15, 15, 15],
  );
  assert.equal(TYPE_MAP.r0.digit, 0);
});
test("new game fixes the board and validates its complete supply", () => {
  const s = game();
  assert.equal(s.board.length, 225);
  assert.ok(isSupportedState(s));
  assert.equal(s.reserves[0].r2, 15);
  assert.equal(s.reserves[0].j1, 15);
  assert.throws(() => newGame({ mode: "unknown" }));
});
test("drop consumes the chosen type, keeps ownership and changes turn", () => {
  const s = game();
  move(s, { type: "drop", tile: "j1", at: cell("H8") });
  assert.equal(s.reserves[0].j1, 14);
  assert.equal(s.reserves[0].r2, 15);
  assert.equal(s.board[cell("H8")].face, "digit");
  assert.equal(s.board[cell("H8")].owner, 0);
  assert.equal(s.turn, 1);
  assert.ok(isSupportedState(s));
});
test("fifteen copies of one digit can be used, and the sixteenth is unavailable", () => {
  const s = game();
  for (let at = 0; at < 15; at++) {
    move(s, { type: "drop", tile: "j1", at });
    move(s, { type: "pass" });
  }
  assert.equal(s.reserves[0].j1, 0);
  assert.equal(s.board.filter(Boolean).length, 15);
  assert.throws(() => move(s, { type: "drop", tile: "j1", at: cell("C2") }), /not available/);
  assert.ok(isSupportedState(s));
  assert.deepEqual(reviewPosition(s, s.history.length).board, s.board);
});
test("challenge steps share turn numbers with the following move and replay within the history bound", () => {
  const s = game();
  for (const command of [
    { type: "drop", tile: "j1", at: 0 },
    { type: "drop", tile: "j1", at: cell("A3") },
    { type: "drop", tile: "j3", at: 1 },
    { type: "drop", tile: "j3", at: cell("B3") },
    { type: "claim", tiles: [{ at: 0, rotation: 1 }, { at: 1, rotation: 1 }] },
    { type: "claim", tiles: [{ at: cell("A3"), rotation: 1 }, { at: cell("B3"), rotation: 1 }] },
    { type: "challenge", path: [cell("A3"), cell("B3")], factor: "2" },
    { type: "drop", tile: "r4", at: cell("A5") },
    { type: "challenge", path: [0, 1], factor: "2" },
    { type: "pass" },
    { type: "pass" },
  ]) move(s, command);
  assert.equal(s.ended.reason, "passes");
  assert.equal(s.history[6].turnNumber, s.history[7].turnNumber);
  assert.equal(s.history[6].completesTurn, false);
  const mid = reviewPosition(s, 7);
  assert.equal(mid.turn, 0);
  assert.equal(mid.challengeUsed, true);
  assert.ok(isSupportedState(mid));
  assert.ok(isSupportedState(JSON.parse(JSON.stringify(s))));
  const replay = reviewPosition(s, s.history.length);
  assert.deepEqual(replay.reserves, s.reserves);
  assert.deepEqual(scores(replay), scores(s));
  assert.equal(MAX_GAME_TURNS, 100_000);
  const oversized = clone(s);
  oversized.history = Array(MAX_GAME_TURNS + 1).fill(s.history[0]);
  assert.equal(isSupportedState(oversized), false);
});
test("reject occupied/outside/unavailable drops atomically", () => {
  const s = game();
  move(s, { type: "drop", tile: "j1", at: 0 });
  for (const m of [
    { type: "drop", tile: "j1", at: 0 },
    { type: "drop", tile: "j1", at: BOARD_CELLS },
    { type: "drop", tile: "r10", at: cell("F2") },
    { type: "drop", tile: "constructor", at: cell("F2") },
    { type: "drop", tile: "__proto__", at: cell("F2") },
  ]) {
    const old = clone(s);
    assert.throws(() => move(s, m));
    assert.deepEqual(s, old);
  }
});
test("digit tiles never create arrow connections, opposite owners never connect", () => {
  const s = game();
  put(s, cell("A3"), "j1", 0, "arrow", 1);
  put(s, cell("B3"), "j1", 1, "arrow", 1);
  put(s, cell("C3"), "j1", 1, "digit", 1);
  assert.equal(graph(s.board).degree(cell("A3")), 0);
  assert.equal(graph(s.board).degree(cell("B3")), 0);
});
test("a tail must meet an exit; merely touching arrows is not a connection", () => {
  const s = game();
  put(s, cell("A3"), "j1", 0, "arrow", 1);
  put(s, cell("B3"), "j1", 0, "arrow", 0);
  assert.equal(graph(s.board).degree(cell("A3")), 0);
  s.board[cell("B3")].rotation = 1;
  assert.deepEqual(graph(s.board).out[cell("A3")], [cell("B3")]);
});
test("claim nine tiles, read the number from last to first", () => {
  const s = game(),
    tiles = line(s);
  const e = move(s, { type: "claim", tiles });
  assert.equal(e.length, 9);
  assert.equal(e.number, "164286421");
  assert.equal(s.board[cell("A3")].face, "arrow");
  assert.equal(scores(s)[0], 9);
  assert.equal(
    validateSegment(
      s.board,
      tiles.map((t) => t.at),
      0,
    ),
    "164286421",
  );
  assert.ok(isSupportedState(s));
});
test("claims need two new connected tiles but no nine-tile path", () => {
  const s = game();
  line(s);
  assert.throws(
    () => move(s, { type: "claim", tiles: [{ at: cell("A3"), rotation: 1 }] }),
    /at least two/,
  );
  const event = move(s, {
    type: "claim",
    tiles: [
      { at: cell("A3"), rotation: 1 },
      { at: cell("B3"), rotation: 1 },
    ],
  });
  assert.equal(event.length, 2);
  assert.deepEqual(scores(s), [0, 0]);
});
test("claiming two tiles can extend an existing seven-tile path", () => {
  const s = game(),
    tiles = line(s);
  tiles.slice(0, 7).forEach((t) => (s.board[t.at].face = "arrow"));
  const e = move(s, { type: "claim", tiles: tiles.slice(7) });
  assert.equal(e.length, 9);
});
test("claim must flip a connected network of own previously unclaimed tiles", () => {
  const s = game(),
    tiles = line(s);
  assert.throws(
    () => move(s, { type: "claim", tiles: [tiles[0], tiles[2]] }),
    /connected network/,
  );
  s.board[cell("B3")].face = "arrow";
  assert.throws(() => move(s, { type: "claim", tiles }), /unclaimed/);
  s.board[cell("B3")].face = "digit";
  s.board[cell("B3")].owner = 1;
  assert.throws(() => move(s, { type: "claim", tiles }), /your unclaimed/);
});
test("claim rejects repeated cells and invalid rotations", () => {
  const s = game(),
    tiles = line(s);
  assert.throws(() => claimPreview(s.board, [tiles[0], tiles[0]], 0));
  assert.throws(() =>
    claimPreview(s.board, [{ at: cell("A3"), rotation: 5 }, tiles[1]], 0),
  );
});
test("left/right bends, forks and every rotation have the correct ports", () => {
  assert.deepEqual(ports({ type: "r0", rotation: 0 }), {
    entry: 2,
    exits: [3],
  });
  assert.deepEqual(ports({ type: "r5", rotation: 1 }), {
    entry: 3,
    exits: [2],
  });
  assert.deepEqual(ports({ type: "j1", rotation: 2 }), {
    entry: 0,
    exits: [2, 1, 3],
  });
});
test("cycles are detected globally and rejected before a claim is committed", () => {
  const s = game();
  put(s, cell("A3"), "r5", 0, "arrow", 0);
  put(s, cell("B3"), "r5", 0, "arrow", 1);
  put(s, cell("B4"), "r5", 0, "arrow", 2);
  put(s, cell("A4"), "r5", 0, "arrow", 3);
  assert.ok(hasCycle(graph(s.board)));
  s.board[cell("A4")].face = "digit";
  s.board[cell("B4")].face = "digit";
  assert.equal(hasCycle(graph(s.board)), false);
  assert.throws(
    () =>
      claimPreview(
        s.board,
        [
          { at: cell("B4"), rotation: 2 },
          { at: cell("A4"), rotation: 3 },
        ],
        0,
      ),
    /cycle/,
  );
});
test("junction endpoints may also occur inside a longer segment", () => {
  const s = game();
  line(
    s,
    cell("A3"),
    0,
    ["j1", "r2", "j1", "r4", "r4", "r8", "r2", "r4", "j1"],
    "arrow",
  );
  const choices = segments(s.board, 0);
  assert.ok(choices.some((x) => x.path.length === 9));
  assert.ok(choices.some((x) => x.path.length === 3));
  assert.ok(choices.some((x) => x.path.length === 7));
});
test("regular interior tiles cannot serve as segment endpoints", () => {
  const s = game(),
    tiles = line(s, cell("A3"), 0, undefined, "arrow");
  assert.throws(
    () =>
      validateSegment(
        s.board,
        tiles.slice(1).map((x) => x.at),
        0,
      ),
    /junction or an end tile/,
  );
  assert.throws(() => validateSegment(s.board, [cell("A3")], 0), /at least two/);
  assert.throws(() => validateSegment(s.board, [cell("B3"), cell("A3")], 0), /Follow/);
});
test("successful challenge keeps and scores captured tiles without a fee or ending the turn", () => {
  const s = game();
  line(
    s,
    cell("A3"),
    1,
    ["j1", "r2", "j1", "r4", "r4", "r8", "r2", "r4", "j1"],
    "arrow",
  );
  const path = Array.from({ length: 9 }, (_, i) => cell("A3") + i),
    number = segmentNumber(s.board, path);
  assert.equal(BigInt(number) % 3n, 0n);
  const e = move(s, { type: "challenge", path, factor: "3" });
  assert.ok(e.success);
  assert.equal(s.captured[0].length, 9);
  assert.equal(s.captured[1].length, 0);
  assert.equal(total(s.reserves[1]), 141);
  assert.equal(s.reserves[0].j3, 15);
  assert.equal(s.reserves[1].j1, 12);
  assert.deepEqual(scores(s), [9, 0]);
  assert.equal(s.turn, 0);
  assert.equal(s.challengeUsed, true);
  assert.equal(s.challengeSucceeded, true);
  assert.ok(path.every((i) => s.board[i] === null));
  assert.ok(isSupportedState(s));
});
test("failed challenge uses the optional attempt, leaves the same player to move and preserves reserves", () => {
  const s = game(),
    tiles = line(s, cell("A3"), 1, undefined, "arrow");
  const e = move(s, {
    type: "challenge",
    path: tiles.map((t) => t.at),
    factor: "2",
  });
  assert.equal(e.success, false);
  assert.equal(total(s.reserves[0]), 150);
  assert.equal(s.turn, 0);
  assert.equal(s.challengeUsed, true);
  const before = clone(s);
  assert.throws(() => move(s, { type: "challenge", path: tiles.map(t => t.at), factor: "3" }), /one challenge/);
  assert.deepEqual(s, before);
  assert.equal(s.board.filter(Boolean).length, 9);
  assert.ok(isSupportedState(s));
});
test("reject 1, the number itself and malformed factors without consuming the optional attempt", () => {
  const s = game(),
    tiles = line(s, cell("A3"), 1, undefined, "arrow"),
    path = tiles.map((t) => t.at);
  for (const factor of ["1", "0", "-2", "1.5", "164286421", "1e3", ""]) {
    const before = clone(s);
    assert.throws(() =>
      move(s, { type: "challenge", path, factor }),
    );
    assert.deepEqual(s, before);
  }
  assert.equal(s.challengeUsed, false);
  const e = move(s, { type: "challenge", path, factor: "3" });
  assert.equal(e.success, false);
  assert.equal(s.challengeUsed, true);
  assert.equal(total(s.reserves[0]), 150);
});
test("exact arithmetic works beyond Number safe integer range", () => {
  const s = game();
  const types = ["j1", "r2", "r4", "r6", "r8", "r2", "j1", "r4", "r6", "r8", "r2", "r4", "r5"];
  types.forEach((type, k) => put(s, cell("A3") + k, type, 1, "arrow", 1));
  put(s, cell("M4"), "r6", 1, "arrow", 2);
  put(s, cell("M5"), "r8", 1, "arrow", 2);
  put(s, cell("M6"), "r5", 1, "arrow", 2);
  put(s, cell("L6"), "j1", 1, "arrow", 3);
  const path = [...Array.from({ length: 13 }, (_, i) => cell("A3") + i), cell("M4"), cell("M5"), cell("M6"), cell("L6")],
    number = validateSegment(s.board, path, 1);
  assert.ok(BigInt(number) > BigInt(Number.MAX_SAFE_INTEGER));
  const e = move(s, {
    type: "challenge",
    path,
    factor: "2",
  });
  assert.equal(Number(number) % 2, 0);
  assert.equal(BigInt(number) % 2n, 1n);
  assert.equal(e.success, false);
});
test("capture removes zero-connection arrows, but preserves short connected fragments", () => {
  const s = game();
  put(s, cell("A3"), "j1", 1, "arrow", 1);
  put(s, cell("B3"), "j1", 1, "arrow", 1);
  put(s, cell("C3"), "r2", 1, "arrow", 1);
  put(s, cell("B2"), "j9", 1, "arrow", 0); // fork north feeds 16; reversed number is 91
  put(s, cell("D3"), "j1", 1, "arrow", 1);
  const e = move(s, {
    type: "challenge",
    path: [cell("B3"), cell("B2")],
    factor: "7",
  });
  assert.ok(e.success);
  assert.equal(s.captured[0].length, 3);
  assert.deepEqual(
    e.removed.sort((a, b) => a - b),
    [cell("A3"), cell("B3"), cell("B2")].sort((a, b) => a - b),
  );
  assert.equal(total(s.reserves[1]), 145);
  assert.ok(s.board[cell("C3")]);
  assert.ok(s.board[cell("D3")]);
  assert.equal(graph(s.board).degree(cell("C3")), 1);
});
test("two consecutive passes capture unclaimed tiles for points and can draw", () => {
  const s = game();
  put(s, cell("F4"), "r2", 0);
  put(s, cell("A5"), "r4", 1);
  move(s, { type: "pass" });
  assert.equal(s.ended, null);
  move(s, { type: "pass" });
  assert.equal(s.ended.reason, "passes");
  assert.equal(s.ended.winner, null);
  assert.deepEqual(scores(s), [1, 1]);
  assert.equal(s.board.filter(Boolean).length, 0);
  assert.equal(total(s.reserves[0]), 149);
  assert.equal(total(s.reserves[1]), 149);
  assert.ok(isSupportedState(s));
  assert.throws(() => move(s, { type: "pass" }));
});
test("any non-pass move resets the pass streak", () => {
  const s = game();
  move(s, { type: "pass" });
  move(s, { type: "drop", tile: "j1", at: 0 });
  assert.equal(s.passCount, 0);
  move(s, { type: "pass" });
  assert.equal(s.ended, null);
});
test("reserve exhaustion does not end a game; pass is still available", () => {
  const s = game();
  for (const t of TYPES) s.reserves[0][t.id] = 0;
  move(s, { type: "pass" });
  assert.equal(s.ended, null);
  assert.throws(() => {
    s.turn = 0;
    move(s, { type: "challenge", path: [0, 1], factor: "2" });
  });
});
test("clocks include thinking time, increment only completed moves, pause and flag", () => {
  const s = newGame({ mode: "blitz" }, 0);
  setRunning(s, true, 0);
  tick(s, 5000);
  assert.equal(s.clocks[0], 595);
  applyMove(s, { type: "pass" }, 10000);
  assert.deepEqual(s.clocks, [600, 600]);
  setRunning(s, false, 15000);
  tick(s, 90000);
  assert.equal(s.clocks[1], 595);
  setRunning(s, true, 90000);
  tick(s, 700000);
  assert.equal(s.ended.winner, 0);
  assert.equal(s.ended.reason, "time");
});
test("casual has no clock and resignation records the opponent as winner", () => {
  const s = game();
  tick(s, 10000000);
  assert.deepEqual(s.clocks, [null, null]);
  resign(s, 0, 10000000);
  assert.equal(s.ended.winner, 1);
});
test("review replays actual moves, captures, end cleanup and scores", () => {
  const s = game();
  move(s, { type: "drop", tile: "j1", at: cell("F2") });
  move(s, { type: "drop", tile: "r0", at: cell("G2") });
  move(s, { type: "pass" });
  move(s, { type: "pass" });
  const initial = reviewPosition(s, 0),
    afterDrop = reviewPosition(s, 1),
    end = reviewPosition(s, 4);
  assert.equal(initial.board.filter(Boolean).length, 0);
  assert.equal(afterDrop.board[cell("F2")].type, "j1");
  assert.deepEqual(end.board, s.board);
  assert.deepEqual(end.reserves, s.reserves);
  assert.deepEqual(scores(end), scores(s));
});
test("validateMove leaves the actual position untouched", () => {
  const s = game(),
    copy = clone(s);
  const next = validateMove(s, { type: "drop", tile: "j1", at: 0 });
  assert.deepEqual(s, copy);
  assert.equal(next.board[0].type, "j1");
});
test("invalid or incompatible saved/network states are rejected", () => {
  const s = game();
  for (const change of [
    (x) => (x.rulesVersion = 15),
    (x) => (x.boardSize = 11),
    (x) => (x.reserves[0].j1 = 87),
    (x) => x.board.pop(),
    (x) => (x.clocks = [NaN, null]),
    (x) => (x.turn = 4),
    (x) => (x.names[0] = "x".repeat(200)),
    (x) => (x.nextId = 0),
  ]) {
    const copy = clone(s);
    change(copy);
    assert.equal(isSupportedState(copy), false);
  }
});

test("a claim is rejected when an unused fork exit closes a cycle", () => {
  const s = game(),
    types = ["j1", "r2", "j7", "r4", "r6", "r8", "r2", "r4", "j1"];
  const tiles = types.map((type, k) => {
    put(s, cell("C7") + k, type);
    return { at: cell("C7") + k, rotation: 1 };
  });
  put(s, cell("E8"), "r5", 0, "arrow", 2);
  put(s, cell("D8"), "j1", 0, "arrow", 3);
  put(s, cell("C8"), "j1", 0, "arrow", 3);
  put(s, cell("B8"), "r5", 0, "arrow", 3);
  put(s, cell("B7"), "r5", 0, "arrow", 0);
  assert.equal(hasCycle(graph(s.board)), false);
  assert.throws(() => claimPreview(s.board, tiles, 0), /cycle/);
});

test("corrupted history cannot reach the game renderer or replay controls", () => {
  const s = game();
  move(s, { type: "drop", tile: "j1", at: 0 });
  for (const change of [
    (x) => (x.history[0].type = "unknown"),
    (x) => (x.history[0].tile = "constructor"),
    (x) => (x.history[0].command = null),
    (x) => (x.history[0].clocks = [NaN, null]),
    (x) => (x.ended = { winner: 0, reason: "invented", scores: [0, 0] }),
  ]) {
    const copy = clone(s);
    change(copy);
    assert.equal(isSupportedState(copy), false);
  }
});

test("opening countdown protects the first clock and blocks early moves", async () => {
  const { beginGameCountdown, finishGameCountdown } = await import(
    "../engine.js"
  );
  const s = newGame({ mode: "standard" }, 0);
  beginGameCountdown(s, 0);
  assert.ok(isSupportedState(s));
  assert.equal(finishGameCountdown(s, 2999), false);
  assert.throws(
    () => applyMove(s, { type: "drop", tile: "j1", at: 0 }, 1000),
    /Start or resume/,
  );
  assert.throws(() => setRunning(s, true, 1000), /starting/);
  assert.equal(finishGameCountdown(s, 3500), true);
  assert.equal(s.started, true);
  assert.equal(s.clocks[0], 1799.5);
  assert.equal(s.startCountdown, undefined);
  assert.ok(isSupportedState(s));
});

// The zeros bend left; the five turns the path back to the right.
function zeroPath(s, owner = 0, face = "digit") {
  const route = [
    [cell("A3"), "r0", 2],
    [cell("B3"), "r2", 1],
    [cell("C3"), "r0", 1],
    [cell("C2"), "r5", 0],
    [cell("D2"), "r4", 1],
    [cell("E2"), "r6", 1],
    [cell("F2"), "r8", 1],
    [cell("G2"), "r2", 1],
    [cell("H2"), "j1", 1],
  ];
  route.forEach(([at, type, rotation]) =>
    put(s, at, type, owner, face, rotation),
  );
  return route.map(([at, , rotation]) => ({ at, rotation }));
}

test("zero can be dropped anywhere empty without being captured or claimed", () => {
  const s = game();
  move(s, { type: "drop", tile: "r0", at: 0 });
  assert.equal(s.board[0].type, "r0");
  assert.equal(s.board[0].face, "digit");
  assert.equal(s.reserves[0].r0, 14);
  assert.ok(isSupportedState(s));
  assert.ok(isSupportedState(s));
});

test("a leading zero rejects the whole claim without flipping any tile", () => {
  const s = game();
  const tiles = line(s, cell("A3"), 0, [
    "j1",
    "r2",
    "r4",
    "r6",
    "r8",
    "r2",
    "r4",
    "r6",
    "r0",
  ]);
  const before = clone(s);
  assert.throws(
    () => move(s, { type: "claim", tiles }),
    /No Leading Zero Rule/,
  );
  assert.deepEqual(s, before);
});

test("internal and units zeros can be claimed, challenged and saved exactly", () => {
  const s = game();
  const tiles = zeroPath(s);
  move(s, { type: "claim", tiles });
  const path = tiles.map((t) => t.at);
  assert.equal(validateSegment(s.board, path, 0), "128645020");
  assert.ok(isSupportedState(s));
  const e = move(s, { type: "challenge", path, factor: "2" });
  assert.equal(e.number, "128645020");
  assert.equal(e.success, true);
  assert.equal(e.removed.length, 9);
  assert.equal(s.captured[1].length, 9);
  assert.equal(total(s.reserves[0]), 141);
  assert.equal(s.reserves[1].r0, 15);
  assert.ok(isSupportedState(s));
});

test("a newly flipped zero may end the selection when an older path continues beyond it", () => {
  const s = game();
  const tiles = zeroPath(s);
  tiles.slice(3).forEach((t) => (s.board[t.at].face = "arrow"));
  assert.ok(isSupportedState(s));
  const e = move(s, { type: "claim", tiles: tiles.slice(0, 3) });
  assert.equal(e.length, 9);
  assert.ok(isSupportedState(s));
  assert.equal(
    validateSegment(
      s.board,
      tiles.map((t) => t.at),
      0,
    ),
    "128645020",
  );
});

test("capturing a branch removes exposed leading zeros repeatedly, preserving the nonzero fragment", () => {
  const s = game();
  for (const [at, type, rotation] of [
    [cell("A5"), "j1", 1],
    [cell("B5"), "r2", 1],
    [cell("C5"), "r0", 1],
    [cell("C4"), "r0", 0],
    [cell("B4"), "j1", 3],
    [cell("A4"), "j9", 3],
  ])
    put(s, at, type, 1, "arrow", rotation);
  put(s, cell("H12"), "r0", 0);
  assert.ok(isSupportedState(s));
  const e = move(s, {
    type: "challenge",
    path: [cell("B4"), cell("A4")],
    factor: "7",
  });
  assert.equal(e.number, "91");
  assert.equal(e.success, true);
  assert.deepEqual(e.removed, [cell("B4"), cell("A4"), cell("C4"), cell("C5")]);
  assert.equal(s.reserves[1].r0, 13);
  assert.equal(s.reserves[1].j9, 14);
  assert.equal(s.captured[0].length, 4);
  assert.ok(s.board[cell("A5")] && s.board[cell("B5")]);
  assert.equal(s.board[cell("H12")].face, "digit");
  assert.ok(isSupportedState(s));
});

test("zero removal and isolated-arrow removal repeat together until the board is stable", () => {
  const s = game();
  for (const [at, type, rotation] of [
    [cell("A5"), "j1", 1],
    [cell("B5"), "r0", 1],
    [cell("B4"), "j1", 0],
    [cell("B3"), "j9", 0],
  ])
    put(s, at, type, 1, "arrow", rotation);
  const e = move(s, {
    type: "challenge",
    path: [cell("B4"), cell("B3")],
    factor: "7",
  });
  assert.deepEqual(e.removed, [cell("B4"), cell("B3"), cell("B5"), cell("A5")]);
  assert.equal(s.board.filter(Boolean).length, 0);
  assert.equal(s.captured[0].length, 4);
  assert.equal(s.reserves[1].r0, 14);
  assert.equal(s.reserves[1].j9, 14);
  assert.ok(isSupportedState(s));
});

test("leading-zero segments and states are rejected instead of interpreted with a shorter number", () => {
  const s = game();
  const tiles = line(
    s,
    cell("A3"),
    0,
    ["j1", "r2", "r4", "r6", "r8", "r2", "r4", "r6", "r0"],
    "arrow",
  );
  assert.throws(
    () =>
      validateSegment(
        s.board,
        tiles.map((t) => t.at),
        0,
      ),
    /No Leading Zero Rule/,
  );
  assert.ok(segments(s.board, 0).every((segment) => segment.number[0] !== "0"));
  assert.equal(isSupportedState(s), false);
  const old = game();
  old.rulesVersion = 18;
  assert.equal(isSupportedState(old), false);
});

test("15-square board edges never wrap and old 13-square saves are rejected", () => {
  const s = game();
  assert.equal(BOARD_SIZE, 15);
  assert.equal(BOARD_CELLS, 225);
  assert.equal(coordinate(224), "O15");
  assert.equal(neighbor(14, 1), null);
  assert.equal(neighbor(15, 3), null);
  assert.equal(neighbor(210, 2), null);
  assert.equal(neighbor(12, 1), 13); // The former 13-square edge is now interior.
  assert.equal(neighbor(14, 2), 29);
  assert.equal(neighbor(224, 0), 209);
  move(s, { type: "drop", tile: "j1", at: 224 });
  assert.equal(s.board[224].type, "j1");
  assert.throws(() => move(s, { type: "drop", tile: "j1", at: 225 }));
  const old = clone(s);
  old.boardSize = 13;
  old.board = Array(169).fill(null);
  assert.equal(isSupportedState(old), false);
});

test("a failed optional challenge followed by Pass can finish the game", () => {
  const s = game();
  line(s, cell("A3"), 0, ["j3", "j3"], "arrow");
  move(s, { type: "pass" });
  assert.equal(s.turn, 1);
  move(s, { type: "challenge", path: [cell("A3"), cell("B3")], factor: "2" });
  assert.equal(s.turn, 1);
  assert.equal(s.passCount, 1);
  move(s, { type: "pass" });
  assert.equal(s.ended.reason, "passes");
  assert.deepEqual(scores(s), [0, 2]);
  assert.ok(isSupportedState(s));
});

test("a successful optional challenge breaks the pass streak even when followed by Pass", () => {
  const s = game();
  line(s, cell("A3"), 0, ["j3", "j3"], "arrow");
  move(s, { type: "pass" });
  move(s, { type: "challenge", path: [cell("A3"), cell("B3")], factor: "3" });
  assert.equal(s.turn, 1);
  assert.equal(s.passCount, 0);
  move(s, { type: "pass" });
  assert.equal(s.ended, null);
  assert.equal(s.passCount, 0);
  assert.equal(s.turn, 0);
  assert.equal(s.challengeUsed, false);
  move(s, { type: "pass" });
  move(s, { type: "pass" });
  assert.equal(s.ended.reason, "passes");
  assert.deepEqual(scores(s), [0, 2]);
  assert.ok(isSupportedState(s));
});

test("the clock continues through a challenge and adds one increment after the ordinary move", () => {
  for (const factor of ["2", "3"]) {
    const s = newGame({ mode: "blitz" }, 0);
    line(s, cell("A3"), 1, ["j3", "j3"], "arrow");
    setRunning(s, true, 0);
    const e = applyMove(s, { type: "challenge", path: [cell("A3"), cell("B3")], factor }, 5000);
    assert.deepEqual(e.clocks, [595, 600]);
    assert.equal(s.turn, 0);
    setRunning(s, false, 6000);
    tick(s, 20000);
    assert.equal(s.clocks[0], 594);
    setRunning(s, true, 20000);
    assert.ok(isSupportedState(JSON.parse(JSON.stringify(s))));
    const completed = applyMove(s, { type: "drop", tile: "r2", at: 0 }, 24000);
    assert.deepEqual(s.clocks, [600, 600]);
    assert.equal(s.turn, 1);
    assert.equal(completed.turnNumber, e.turnNumber);
    assert.equal(s.challengeUsed, false);
    assert.equal(s.challengeSucceeded, false);
    assert.ok(isSupportedState(s));
  }
});

test("the optional challenge resets next turn and can precede a Claim", () => {
  const s = game();
  line(s, cell("A3"), 1, ["j3", "j3"], "arrow");
  const own = line(s, cell("A5"), 0, ["j1", "j3"]);
  move(s, { type: "challenge", path: [cell("A3"), cell("B3")], factor: "2" });
  move(s, { type: "claim", tiles: own });
  move(s, { type: "drop", tile: "r2", at: 1 });
  assert.equal(s.challengeUsed, false);
  move(s, { type: "challenge", path: [cell("A3"), cell("B3")], factor: "3" });
  assert.equal(total(s.reserves[1]), 147);
  assert.equal(s.reserves[1].j3, 13);
  assert.equal(s.turn, 0);
  assert.ok(isSupportedState(s));
});

test("invalid challenge-phase snapshots and reused challenge entries are rejected", () => {
  const s = game();
  line(s, cell("A3"), 1, ["j3", "j3"], "arrow");
  move(s, { type: "challenge", path: [cell("A3"), cell("B3")], factor: "2" });
  for (const corrupt of [
    x => x.challengeUsed = false,
    x => x.challengeSucceeded = true,
    x => x.turn = 1,
    x => x.turnNumber = 2,
    x => x.history[0].completesTurn = true,
    x => x.history.push(clone(x.history[0])),
  ]) {
    const copy = clone(s);
    corrupt(copy);
    assert.equal(isSupportedState(copy), false);
  }
});

test("repeated captures deplete supplies and accumulate replayable prisoner points", () => {
  const s = game();
  const rounds = 4;
  for (let round = 0; round < rounds; round++) {
    for (const command of [
      { type: "drop", tile: "j3", at: cell("A3") },
      { type: "drop", tile: "j3", at: cell("A5") },
      { type: "drop", tile: "j3", at: cell("B3") },
      { type: "drop", tile: "j3", at: cell("B5") },
      { type: "claim", tiles: [{ at: cell("A3"), rotation: 1 }, { at: cell("B3"), rotation: 1 }] },
      { type: "challenge", path: [cell("A3"), cell("B3")], factor: "3" },
      { type: "claim", tiles: [{ at: cell("A5"), rotation: 1 }, { at: cell("B5"), rotation: 1 }] },
      { type: "challenge", path: [cell("A5"), cell("B5")], factor: "3" },
      { type: "pass" },
      { type: "pass" },
    ]) {
      move(s, command);
      assert.ok(isSupportedState(JSON.parse(JSON.stringify(s))));
    }
    assert.equal(s.ended, null);
    assert.equal(s.board.filter(Boolean).length, 0);
    const reserve = { ...inventory(), j3: 15 - 2 * (round + 1) };
    assert.deepEqual(s.reserves, [reserve, reserve]);
    assert.deepEqual(s.captured.map(pile => pile.length), [2 * (round + 1), 2 * (round + 1)]);
    assert.deepEqual(scores(s), [2 * (round + 1), 2 * (round + 1)]);
  }
  assert.equal(s.nextId, rounds * 4 + 1);
  const replay = reviewPosition(s, s.history.length);
  assert.deepEqual(replay.board, s.board);
  assert.deepEqual(replay.captured, s.captured);
  assert.deepEqual(replay.reserves, s.reserves);
  assert.deepEqual(scores(replay), [rounds * 2, rounds * 2]);
  const invalid = clone(s);
  invalid.reserves[1].j3++; // A prisoner cannot also return to its owner's reserve.
  assert.equal(isSupportedState(invalid), false);
});

test("captures add to claimed-group points and endgame cleanup awards prisoners", () => {
  const s = game();
  line(s, cell("A3"), 0, undefined, "arrow");
  line(s, cell("A5"), 1, ["j3", "j3"], "arrow");
  const before = scores(s);
  move(s, { type: "challenge", path: [cell("A5"), cell("B5")], factor: "3" });
  assert.deepEqual(before, [9, 0]);
  assert.deepEqual(scores(s), [11, 0]);
  assert.equal(s.reserves[1].j3, 13);
  assert.equal(total(s.reserves[1]), 148);
  move(s, { type: "drop", tile: "r2", at: cell("A5") });
  move(s, { type: "pass" });
  move(s, { type: "pass" });
  assert.equal(s.ended.winner, 0);
  assert.deepEqual(s.ended.scores, [11, 1]);
  assert.equal(total(s.reserves[0]), 140);
  assert.equal(total(s.reserves[1]), 148);
  assert.ok(isSupportedState(s));
});

test("captured tiles cannot be replayed and scores above the board area remain valid", () => {
  const s = game();
  // Eight separate ten-tile groups: 80 claimed tiles plus 150 prisoners.
  for (let row = 0; row < BOARD_SIZE; row += 2) {
    const types = [];
    for (let k = 0; k < 10; k++) {
      const pool = k === 0 || k === 9 ? ["j1", "j3", "j7"] : ["r2", "r4", "r6", "r8", "j1", "j3", "j7"];
      const type = pool.find(id => s.reserves[0][id] > types.filter(t => t === id).length);
      types.push(type);
    }
    line(s, row * BOARD_SIZE, 0, types, "arrow");
  }
  for (const type of TYPES)
    for (let k = 0; k < type.count; k++) {
      s.reserves[1][type.id]--;
      s.captured[0].push({ id: s.nextId++, type: type.id, owner: 1, face: "digit", rotation: 0 });
    }
  assert.equal(total(s.reserves[1]), 0);
  assert.deepEqual(scores(s), [230, 0]);
  assert.ok(isSupportedState(s));
  move(s, { type: "pass" });
  assert.throws(() => move(s, { type: "drop", tile: "j3", at: 10 }), /not available/);
  move(s, { type: "pass" });
  assert.deepEqual(s.ended.scores, [230, 0]);
  assert.ok(isSupportedState(JSON.parse(JSON.stringify(s))));
  for (const corrupt of [
    x => delete x.captured,
    x => x.captured[0][0].owner = 0,
    x => x.captured[0][1].id = x.captured[0][0].id,
    x => x.reserves[1].r0++,
  ]) {
    const invalid = clone(s);
    corrupt(invalid);
    assert.equal(isSupportedState(invalid), false);
  }
});
