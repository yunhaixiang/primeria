import test from "node:test";
import assert from "node:assert/strict";
import {
  BOARD_SIZE,
  BOARD_CELLS,
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
  start = 26,
  owner = 0,
  types = ["j1", "r2", "r4", "r6", "r8", "r2", "r4", "r6", "j1"],
  face = "digit",
) {
  types.forEach((type, k) => put(s, start + k, type, owner, face, 1));
  return types.map((_, k) => ({ at: start + k, rotation: 1 }));
}
const move = (s, m) => applyMove(s, m, 0);
test("58 tiles per player, one arrow type per digit and exact bends/forks", () => {
  assert.equal(total(inventory()), 58);
  assert.equal(TYPES.length, 10);
  assert.deepEqual(
    TYPES.map((t) => t.digit),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
  assert.equal(
    TYPES.filter((t) => t.id[0] === "j").reduce((n, t) => n + t.count, 0),
    28,
  );
  assert.equal(TYPE_MAP.r0.kind, "left");
  assert.equal(TYPE_MAP.r5.kind, "right");
  assert.deepEqual(
    [1, 3, 7, 9].map((d) =>
      TYPES.filter((t) => t.digit === d).reduce((n, t) => n + t.count, 0),
    ),
    [7, 7, 7, 7],
  );
  assert.equal(TYPE_MAP.r0.digit, 0);
});
test("new game fixes the board and validates its complete supply", () => {
  const s = game();
  assert.equal(s.board.length, 169);
  assert.ok(isSupportedState(s));
  assert.equal(s.reserves[0].r2, 5);
  assert.equal(s.reserves[0].j1, 7);
  assert.throws(() => newGame({ mode: "unknown" }));
});
test("drop consumes the chosen type, keeps ownership and changes turn", () => {
  const s = game();
  move(s, { type: "drop", tile: "j1", at: 98 });
  assert.equal(s.reserves[0].j1, 6);
  assert.equal(s.reserves[0].r2, 5);
  assert.equal(s.board[98].face, "digit");
  assert.equal(s.board[98].owner, 0);
  assert.equal(s.turn, 1);
  assert.ok(isSupportedState(s));
});
test("reject occupied/outside/unavailable drops atomically", () => {
  const s = game();
  move(s, { type: "drop", tile: "j1", at: 0 });
  for (const m of [
    { type: "drop", tile: "j1", at: 0 },
    { type: "drop", tile: "j1", at: 169 },
    { type: "drop", tile: "r10", at: 18 },
    { type: "drop", tile: "constructor", at: 18 },
    { type: "drop", tile: "__proto__", at: 18 },
  ]) {
    const old = clone(s);
    assert.throws(() => move(s, m));
    assert.deepEqual(s, old);
  }
});
test("digit tiles never create arrow connections, opposite owners never connect", () => {
  const s = game();
  put(s, 26, "j1", 0, "arrow", 1);
  put(s, 27, "j1", 1, "arrow", 1);
  put(s, 28, "j1", 1, "digit", 1);
  assert.equal(graph(s.board).degree(26), 0);
  assert.equal(graph(s.board).degree(27), 0);
});
test("a tail must meet an exit; merely touching arrows is not a connection", () => {
  const s = game();
  put(s, 26, "j1", 0, "arrow", 1);
  put(s, 27, "j1", 0, "arrow", 0);
  assert.equal(graph(s.board).degree(26), 0);
  s.board[27].rotation = 1;
  assert.deepEqual(graph(s.board).out[26], [27]);
});
test("claim nine tiles, read the number from last to first", () => {
  const s = game(),
    tiles = line(s);
  const e = move(s, { type: "claim", tiles });
  assert.equal(e.length, 9);
  assert.equal(e.number, "164286421");
  assert.equal(s.board[26].face, "arrow");
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
    () => move(s, { type: "claim", tiles: [{ at: 26, rotation: 1 }] }),
    /at least two/,
  );
  const event = move(s, {
    type: "claim",
    tiles: [
      { at: 26, rotation: 1 },
      { at: 27, rotation: 1 },
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
  s.board[27].face = "arrow";
  assert.throws(() => move(s, { type: "claim", tiles }), /unclaimed/);
  s.board[27].face = "digit";
  s.board[27].owner = 1;
  assert.throws(() => move(s, { type: "claim", tiles }), /your unclaimed/);
});
test("claim rejects repeated cells and invalid rotations", () => {
  const s = game(),
    tiles = line(s);
  assert.throws(() => claimPreview(s.board, [tiles[0], tiles[0]], 0));
  assert.throws(() =>
    claimPreview(s.board, [{ at: 26, rotation: 5 }, tiles[1]], 0),
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
  put(s, 26, "r5", 0, "arrow", 0);
  put(s, 27, "r5", 0, "arrow", 1);
  put(s, 40, "r5", 0, "arrow", 2);
  put(s, 39, "r5", 0, "arrow", 3);
  assert.ok(hasCycle(graph(s.board)));
  s.board[39].face = "digit";
  s.board[40].face = "digit";
  assert.equal(hasCycle(graph(s.board)), false);
  assert.throws(
    () =>
      claimPreview(
        s.board,
        [
          { at: 40, rotation: 2 },
          { at: 39, rotation: 3 },
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
    26,
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
    tiles = line(s, 26, 0, undefined, "arrow");
  assert.throws(
    () =>
      validateSegment(
        s.board,
        tiles.slice(1).map((x) => x.at),
        0,
      ),
    /junction or an end tile/,
  );
  assert.throws(() => validateSegment(s.board, [26], 0), /at least two/);
  assert.throws(() => validateSegment(s.board, [27, 26], 0), /Follow/);
});
test("successful challenge captures all tiles including junctions and always pays its fee", () => {
  const s = game();
  line(
    s,
    26,
    1,
    ["j1", "r2", "j1", "r4", "r4", "r8", "r2", "r4", "j1"],
    "arrow",
  );
  const path = Array.from({ length: 9 }, (_, i) => 26 + i),
    number = segmentNumber(s.board, path);
  assert.equal(BigInt(number) % 3n, 0n);
  const e = move(s, { type: "challenge", fee: "j3", path, factor: "3" });
  assert.ok(e.success);
  assert.equal(s.captured[0].length, 9);
  assert.equal(s.captured[0][2].type, "j1");
  assert.equal(s.captured[1][0].type, "j3");
  assert.equal(s.reserves[0].j3, 6);
  assert.ok(path.every((i) => s.board[i] === null));
  assert.ok(isSupportedState(s));
});
test("failed challenge spends its fee, ends the turn and does not remove the segment", () => {
  const s = game(),
    tiles = line(s, 26, 1, undefined, "arrow");
  const e = move(s, {
    type: "challenge",
    fee: "r2",
    path: tiles.map((t) => t.at),
    factor: "2",
  });
  assert.equal(e.success, false);
  assert.equal(s.captured[1].length, 1);
  assert.equal(s.captured[0].length, 0);
  assert.equal(s.turn, 1);
  assert.equal(s.board.filter(Boolean).length, 9);
  assert.ok(isSupportedState(s));
});
test("reject 1, the number itself, malformed factors and missing fees before consuming a tile", () => {
  const s = game(),
    tiles = line(s, 26, 1, undefined, "arrow"),
    path = tiles.map((t) => t.at);
  for (const factor of ["1", "0", "-2", "1.5", "164286421", "1e3", ""]) {
    const before = clone(s);
    assert.throws(() =>
      move(s, { type: "challenge", fee: "r2", path, factor }),
    );
    assert.deepEqual(s, before);
  }
  s.reserves[0].r2 = 0;
  assert.throws(() =>
    move(s, { type: "challenge", fee: "r2", path, factor: "3" }),
  );
});
test("exact arithmetic works beyond Number safe integer range", () => {
  const s = game();
  const types = ["j1", "r2", "r4", "r6", "r8", "r2", "j1", "r4", "r6", "r8", "r2", "r4", "r5"];
  types.forEach((type, k) => put(s, 26 + k, type, 1, "arrow", 1));
  put(s, 51, "r6", 1, "arrow", 2);
  put(s, 64, "r8", 1, "arrow", 2);
  put(s, 77, "r5", 1, "arrow", 2);
  put(s, 76, "j1", 1, "arrow", 3);
  const path = [...Array.from({ length: 13 }, (_, i) => 26 + i), 51, 64, 77, 76],
    number = validateSegment(s.board, path, 1);
  assert.ok(BigInt(number) > BigInt(Number.MAX_SAFE_INTEGER));
  const e = move(s, {
    type: "challenge",
    fee: "r2",
    path,
    factor: "2",
  });
  assert.equal(Number(number) % 2, 0);
  assert.equal(BigInt(number) % 2n, 1n);
  assert.equal(e.success, false);
});
test("capture removes zero-connection arrows, but preserves short connected fragments", () => {
  const s = game();
  put(s, 26, "j1", 1, "arrow", 1);
  put(s, 27, "j1", 1, "arrow", 1);
  put(s, 28, "r2", 1, "arrow", 1);
  put(s, 14, "j9", 1, "arrow", 0); // fork north feeds 16; reversed number is 91
  put(s, 29, "j1", 1, "arrow", 1);
  const e = move(s, {
    type: "challenge",
    fee: "r2",
    path: [27, 14],
    factor: "7",
  });
  assert.ok(e.success);
  assert.deepEqual(
    e.removed.sort((a, b) => a - b),
    [26, 27, 14].sort((a, b) => a - b),
  );
  assert.equal(s.captured[0].length, 3);
  assert.ok(s.board[28]);
  assert.ok(s.board[29]);
  assert.equal(graph(s.board).degree(28), 1);
});
test("two consecutive passes capture unclaimed tiles, ignore reserves, and can draw", () => {
  const s = game();
  put(s, 44, "r2", 0);
  put(s, 52, "r4", 1);
  move(s, { type: "pass" });
  assert.equal(s.ended, null);
  move(s, { type: "pass" });
  assert.equal(s.ended.reason, "passes");
  assert.equal(s.ended.winner, null);
  assert.deepEqual(scores(s), [1, 1]);
  assert.equal(s.board.filter(Boolean).length, 0);
  assert.equal(total(s.reserves[0]), 57);
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
    move(s, { type: "challenge", fee: "j1", path: [0, 1], factor: "2" });
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
  move(s, { type: "drop", tile: "j1", at: 18 });
  move(s, { type: "drop", tile: "r0", at: 19 });
  move(s, { type: "pass" });
  move(s, { type: "pass" });
  const initial = reviewPosition(s, 0),
    afterDrop = reviewPosition(s, 1),
    end = reviewPosition(s, 4);
  assert.equal(initial.board.filter(Boolean).length, 0);
  assert.equal(afterDrop.board[18].type, "j1");
  assert.deepEqual(end.board, s.board);
  assert.deepEqual(end.captured, s.captured);
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
    put(s, 80 + k, type);
    return { at: 80 + k, rotation: 1 };
  });
  put(s, 95, "r5", 0, "arrow", 2);
  put(s, 94, "j1", 0, "arrow", 3);
  put(s, 93, "j1", 0, "arrow", 3);
  put(s, 92, "r5", 0, "arrow", 3);
  put(s, 79, "r5", 0, "arrow", 0);
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
    [26, "r0", 2],
    [27, "r2", 1],
    [28, "r0", 1],
    [15, "r5", 0],
    [16, "r4", 1],
    [17, "r6", 1],
    [18, "r8", 1],
    [19, "r2", 1],
    [20, "j1", 1],
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
  assert.equal(s.reserves[0].r0, 4);
  assert.deepEqual(s.captured, [[], []]);
  assert.ok(isSupportedState(s));
});

test("a leading zero rejects the whole claim without flipping any tile", () => {
  const s = game();
  const tiles = line(s, 26, 0, [
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
  const e = move(s, { type: "challenge", fee: "r0", path, factor: "2" });
  assert.equal(e.number, "128645020");
  assert.equal(e.success, true);
  assert.equal(e.removed.length, 9);
  assert.equal(s.captured[1].length, 9);
  assert.equal(s.captured[0][0].type, "r0");
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
    [52, "j1", 1],
    [53, "r2", 1],
    [54, "r0", 1],
    [41, "r0", 0],
    [40, "j1", 3],
    [39, "j9", 3],
  ])
    put(s, at, type, 1, "arrow", rotation);
  put(s, 150, "r0", 0);
  assert.ok(isSupportedState(s));
  const e = move(s, {
    type: "challenge",
    fee: "r2",
    path: [40, 39],
    factor: "7",
  });
  assert.equal(e.number, "91");
  assert.equal(e.success, true);
  assert.deepEqual(e.removed, [40, 39, 41, 54]);
  assert.equal(s.captured[0].length, 4);
  assert.ok(s.board[52] && s.board[53]);
  assert.equal(s.board[150].face, "digit");
  assert.ok(isSupportedState(s));
});

test("zero removal and isolated-arrow removal repeat together until the board is stable", () => {
  const s = game();
  for (const [at, type, rotation] of [
    [52, "j1", 1],
    [53, "r0", 1],
    [40, "j1", 0],
    [27, "j9", 0],
  ])
    put(s, at, type, 1, "arrow", rotation);
  const e = move(s, {
    type: "challenge",
    fee: "r2",
    path: [40, 27],
    factor: "7",
  });
  assert.deepEqual(e.removed, [40, 27, 53, 52]);
  assert.equal(s.board.filter(Boolean).length, 0);
  assert.equal(s.captured[0].length, 4);
  assert.ok(isSupportedState(s));
});

test("leading-zero segments and states are rejected instead of interpreted with a shorter number", () => {
  const s = game();
  const tiles = line(
    s,
    26,
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

test("13-square board edges never wrap into adjacent rows or an old 15-square board", () => {
  const s = game();
  assert.equal(BOARD_SIZE, 13);
  assert.equal(BOARD_CELLS, 169);
  assert.equal(coordinate(168), "M13");
  assert.equal(neighbor(12, 1), null);
  assert.equal(neighbor(13, 3), null);
  assert.equal(neighbor(156, 2), null);
  assert.equal(neighbor(12, 2), 25);
  assert.equal(neighbor(168, 0), 155);
  assert.throws(() => move(s, { type: "drop", tile: "j1", at: 169 }));
  const old = clone(s);
  old.boardSize = 15;
  old.board = Array(225).fill(null);
  assert.equal(isSupportedState(old), false);
});
