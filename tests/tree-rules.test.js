import test from "node:test";
import assert from "node:assert/strict";
import {
  newGame,
  applyMove,
  claimPreview,
  claimedGroups,
  scoreBreakdown,
  scores,
  isSupportedState,
  reviewPosition,
  graph,
  clone,
  RULES_VERSION,
} from "../engine.js";
import { orientTree } from "../paths.js";
const active = () => {
  const s = newGame({ mode: "casual" }, 0);
  s.started = true;
  return s;
};
function put(s, at, type, owner = 0, face = "digit", rotation = 0) {
  assert.ok(s.reserves[owner][type] > 0);
  s.reserves[owner][type]--;
  s.board[at] = { id: s.nextId++, type, owner, face, rotation };
}
const move = (s, m) => applyMove(s, m, 0);
function branch(s, owner = 0) {
  put(s, 112, "j1", owner);
  put(s, 97, "j3", owner);
  put(s, 113, "j7", owner);
  return [
    { at: 113, rotation: 1 },
    { at: 112, rotation: 0 },
    { at: 97, rotation: 0 },
  ];
}
test("an unordered fork can be claimed without inventing a linear number", () => {
  const s = active(),
    tiles = branch(s);
  const event = move(s, { type: "claim", tiles });
  assert.equal(event.length, 3);
  assert.equal(event.number, null);
  assert.deepEqual(graph(s.board).out[112].sort(), [97, 113].sort());
  assert.deepEqual(scores(s), [0, 0]);
  assert.ok(isSupportedState(s));
});
test("automatic alignment handles branches independently of click order", () => {
  const s = active();
  branch(s);
  for (const cells of [
    [97, 113, 112],
    [112, 97, 113],
    [113, 112, 97],
  ]) {
    const tiles = orientTree(s.board, cells, 0);
    assert.ok(tiles);
    assert.equal(claimPreview(s.board, tiles, 0).length, 3);
  }
});
test("two disconnected pairs cannot be bundled into one claim", () => {
  const s = active();
  [30, 31, 90, 91].forEach((at) => put(s, at, "j1"));
  assert.throws(
    () =>
      move(s, {
        type: "claim",
        tiles: [30, 31, 90, 91].map((at) => ({ at, rotation: 1 })),
      }),
    /connected network/,
  );
});
test("new tiles must connect to each other, not only through older claimed tiles", () => {
  const s = active();
  put(s, 112, "j1", 0, "arrow", 0);
  put(s, 127, "j1", 0, "arrow", 0);
  put(s, 97, "j3");
  put(s, 113, "j7");
  assert.throws(
    () =>
      claimPreview(
        s.board,
        [
          { at: 97, rotation: 0 },
          { at: 113, rotation: 1 },
        ],
        0,
      ),
    /connected network/,
  );
});
test("claim captures orthogonal enemy digits once, preserving diagonals and claimed enemies", () => {
  const s = active();
  const tiles = branch(s);
  put(s, 98, "r2", 1); // beside two newly claimed tiles: captured once
  put(s, 96, "r4", 1);
  put(s, 82, "r6", 1);
  put(s, 129, "r8", 1); // last is diagonal only
  put(s, 114, "j1", 1, "arrow", 0);
  put(s, 99, "j3", 1, "arrow", 0);
  put(s, 127, "r4"); // friendly digit beside an older enemy group survives
  put(s, 128, "j1", 1, "arrow", 2);
  put(s, 143, "j3", 1, "arrow", 2);
  const e = move(s, { type: "claim", tiles });
  assert.deepEqual(
    e.adjacentCaptures.map((x) => x.at).sort((a, b) => a - b),
    [82, 96, 98],
  );
  assert.equal(s.captured[0].length, 3);
  assert.ok(s.board[129]);
  assert.ok(s.board[114]);
  assert.ok(s.board[127]);
  assert.deepEqual(scores(s), [3, 0]);
  assert.ok(isSupportedState(s));
});
test("dropping beside an older enemy claimed group survives and can be saved", () => {
  const s = active();
  put(s, 30, "j1", 1, "arrow", 1);
  put(s, 31, "j3", 1, "arrow", 1);
  const e = move(s, { type: "drop", tile: "r4", at: 45 });
  assert.ok(s.board[45]);
  assert.equal(e.adjacentCaptures, undefined);
  assert.equal(s.reserves[0].r4, 4);
  assert.deepEqual(scores(s), [0, 0]);
  assert.ok(isSupportedState(s));
  assert.ok(isSupportedState(JSON.parse(JSON.stringify(s))));
});
test("a claim captures only beside newly flipped tiles, not older arrows", () => {
  const s = active();
  put(s, 30, "j1", 0, "arrow", 1);
  put(s, 31, "j3", 0, "arrow", 1);
  put(s, 45, "r2", 1); // beside old arrow only
  put(s, 32, "j7");
  put(s, 33, "j3");
  put(s, 48, "r4", 1); // beside new arrow
  const e = move(s, {
    type: "claim",
    tiles: [{ at: 32, rotation: 1 }, { at: 33, rotation: 1 }],
  });
  assert.deepEqual(e.adjacentCaptures, [{ at: 48, by: 0 }]);
  assert.ok(s.board[45]);
  assert.ok(isSupportedState(s));
});
test("passing or challenging never activates adjacent capture from older arrows", () => {
  for (const command of [
    { type: "pass" },
    { type: "challenge", fee: "r0", path: [60, 61], factor: "3" },
    { type: "challenge", fee: "r0", path: [60, 61], factor: "2" },
  ]) {
    const s = active();
    put(s, 30, "j1", 0, "arrow", 1);
    put(s, 31, "j3", 0, "arrow", 1);
    put(s, 45, "r2", 1);
    put(s, 60, "j3", 1, "arrow", 1);
    put(s, 61, "j3", 1, "arrow", 1);
    const e = move(s, command);
    assert.ok(s.board[45]);
    assert.equal(e.adjacentCaptures, undefined);
    assert.ok(isSupportedState(s));
  }
});
test("friendly claimed neighbors do not capture a drop", () => {
  const s = active();
  put(s, 30, "j1", 0, "arrow", 1);
  put(s, 31, "j3", 0, "arrow", 1);
  move(s, { type: "drop", tile: "r4", at: 45 });
  assert.ok(s.board[45]);
  assert.deepEqual(scores(s), [0, 0]);
});
test("a group crosses nine only through matching arrows, not physical contact", () => {
  const s = active();
  const types = ["j1", "r2", "r4", "r6", "r8", "r2", "r4", "r6", "j3"];
  types.forEach((type, k) => put(s, 30 + k, type, 0, "arrow", 1));
  s.board[38].face = "digit";
  s.board[37].face = "digit";
  assert.deepEqual(scores(s), [0, 0]);
  const e = move(s, {
    type: "claim",
    tiles: [
      { at: 38, rotation: 1 },
      { at: 37, rotation: 1 },
    ],
  });
  assert.equal(e.length, 9);
  assert.deepEqual(scores(s), [9, 0]);
  assert.deepEqual(scoreBreakdown(s)[0], {
    scoring: 9,
    growing: 0,
    captured: 0,
    groups: [9],
    total: 9,
  });
  s.board[34].rotation = 0; // physical contact does not keep the groups joined
  assert.deepEqual(
    claimedGroups(s.board).map((g) => g.size),
    [4, 1, 4],
  );
  assert.deepEqual(scores(s), [0, 0]);
});
test("separate sub-nine groups do not score even if their combined size exceeds nine", () => {
  const s = active();
  for (const start of [30, 60])
    for (let k = 0; k < 6; k++)
      put(
        s,
        start + k,
        k === 0 ? "j1" : ["r2", "r4", "r6", "r8", "j3"][k - 1],
        0,
        "arrow",
        1,
      );
  assert.deepEqual(
    claimedGroups(s.board).map((g) => g.size),
    [6, 6],
  );
  assert.deepEqual(scores(s), [0, 0]);
});
test("cutting a nine-tile group removes its scoring status while prisoners still score", () => {
  const s = active();
  const types = ["j1", "r2", "r4", "j3", "j3", "r6", "r8", "r2", "j3"];
  types.forEach((type, k) => put(s, 30 + k, type, 1, "arrow", 1));
  assert.deepEqual(scores(s), [0, 9]);
  move(s, { type: "challenge", fee: "r0", path: [33, 34], factor: "3" });
  assert.deepEqual(
    claimedGroups(s.board).map((g) => g.size),
    [3, 4],
  );
  assert.deepEqual(scores(s), [2, 1]);
  assert.ok(isSupportedState(s));
});
test("adjacent captures and nine-tile scoring replay identically and survive serialization", () => {
  const s = active();
  const commands = [
    { type: "drop", tile: "j1", at: 112 },
    { type: "drop", tile: "r4", at: 98 },
    { type: "drop", tile: "j3", at: 97 },
    { type: "pass" },
    { type: "drop", tile: "j7", at: 113 },
    { type: "pass" },
    {
      type: "claim",
      tiles: [
        { at: 113, rotation: 1 },
        { at: 112, rotation: 0 },
        { at: 97, rotation: 0 },
      ],
    },
    { type: "drop", tile: "r2", at: 96 },
    { type: "pass" },
    { type: "pass" },
  ];
  const positions = [clone(s)];
  for (const command of commands) {
    move(s, command);
    assert.ok(isSupportedState(s));
    if (command.type === "drop" && command.at === 96) {
      assert.ok(s.board[96]);
      assert.equal(s.captured[1].length, 0);
    }
    positions.push(clone(s));
  }
  for (let n = 0; n < positions.length; n++) {
    const replay = reviewPosition(s, n);
    assert.deepEqual(replay.board, positions[n].board);
    assert.deepEqual(replay.captured, positions[n].captured);
    assert.deepEqual(scores(replay), scores(positions[n]));
  }
  assert.ok(isSupportedState(JSON.parse(JSON.stringify(s))));
  assert.equal(
    isSupportedState({ ...s, rulesVersion: RULES_VERSION - 1 }),
    false,
  );
});
