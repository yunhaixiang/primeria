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
  put(s, 98, "j1", owner);
  put(s, 85, "j3", owner);
  put(s, 99, "j7", owner);
  return [
    { at: 99, rotation: 1 },
    { at: 98, rotation: 0 },
    { at: 85, rotation: 0 },
  ];
}
test("an unordered fork can be claimed without inventing a linear number", () => {
  const s = active(),
    tiles = branch(s);
  const event = move(s, { type: "claim", tiles });
  assert.equal(event.length, 3);
  assert.equal(event.number, null);
  assert.deepEqual(graph(s.board).out[98].sort(), [85, 99].sort());
  assert.deepEqual(scores(s), [0, 0]);
  assert.ok(isSupportedState(s));
});
test("automatic alignment handles branches independently of click order", () => {
  const s = active();
  branch(s);
  for (const cells of [
    [85, 99, 98],
    [98, 85, 99],
    [99, 98, 85],
  ]) {
    const tiles = orientTree(s.board, cells, 0);
    assert.ok(tiles);
    assert.equal(claimPreview(s.board, tiles, 0).length, 3);
  }
});
test("two disconnected pairs cannot be bundled into one claim", () => {
  const s = active();
  [26, 27, 78, 79].forEach((at) => put(s, at, "j1"));
  assert.throws(
    () =>
      move(s, {
        type: "claim",
        tiles: [26, 27, 78, 79].map((at) => ({ at, rotation: 1 })),
      }),
    /connected network/,
  );
});
test("new tiles must connect to each other, not only through older claimed tiles", () => {
  const s = active();
  put(s, 98, "j1", 0, "arrow", 0);
  put(s, 111, "j1", 0, "arrow", 0);
  put(s, 85, "j3");
  put(s, 99, "j7");
  assert.throws(
    () =>
      claimPreview(
        s.board,
        [
          { at: 85, rotation: 0 },
          { at: 99, rotation: 1 },
        ],
        0,
      ),
    /connected network/,
  );
});
test("mere adjacency never captures digits or claimed enemies", () => {
  const s = active();
  const tiles = branch(s);
  put(s, 86, "r2", 1); // beside two newly claimed tiles: captured once
  put(s, 84, "r4", 1);
  put(s, 72, "r6", 1);
  put(s, 113, "r8", 1); // last is diagonal only
  put(s, 100, "j1", 1, "arrow", 0);
  put(s, 87, "j3", 1, "arrow", 0);
  put(s, 111, "r4"); // friendly digit beside an older enemy group survives
  put(s, 112, "j1", 1, "arrow", 2);
  put(s, 125, "j3", 1, "arrow", 2);
  const e = move(s, { type: "claim", tiles });
  assert.equal(e.enclosureCaptures, undefined);
  assert.equal(s.captured[0].length, 0);
  for (const at of [72, 84, 86]) assert.ok(s.board[at]);
  assert.ok(s.board[113]);
  assert.ok(s.board[100]);
  assert.ok(s.board[111]);
  assert.deepEqual(scores(s), [0, 0]);
  assert.ok(isSupportedState(s));
});
test("dropping beside an older enemy claimed group survives and can be saved", () => {
  const s = active();
  put(s, 26, "j1", 1, "arrow", 1);
  put(s, 27, "j3", 1, "arrow", 1);
  const e = move(s, { type: "drop", tile: "r4", at: 39 });
  assert.ok(s.board[39]);
  assert.equal(e.adjacentCaptures, undefined);
  assert.equal(s.reserves[0].r4, 4);
  assert.deepEqual(scores(s), [0, 0]);
  assert.ok(isSupportedState(s));
  assert.ok(isSupportedState(JSON.parse(JSON.stringify(s))));
});
test("a claim does not capture merely beside new or older arrows", () => {
  const s = active();
  put(s, 26, "j1", 0, "arrow", 1);
  put(s, 27, "j3", 0, "arrow", 1);
  put(s, 39, "r2", 1); // beside old arrow only
  put(s, 28, "j7");
  put(s, 29, "j3");
  put(s, 42, "r4", 1); // beside new arrow
  const e = move(s, {
    type: "claim",
    tiles: [{ at: 28, rotation: 1 }, { at: 29, rotation: 1 }],
  });
  assert.equal(e.enclosureCaptures, undefined);
  assert.ok(s.board[42]);
  assert.ok(s.board[39]);
  assert.ok(isSupportedState(s));
});
test("passing or challenging never activates adjacent capture from older arrows", () => {
  for (const command of [
    { type: "pass" },
    { type: "challenge", fee: "r0", path: [52, 53], factor: "3" },
    { type: "challenge", fee: "r0", path: [52, 53], factor: "2" },
  ]) {
    const s = active();
    put(s, 26, "j1", 0, "arrow", 1);
    put(s, 27, "j3", 0, "arrow", 1);
    put(s, 39, "r2", 1);
    put(s, 52, "j3", 1, "arrow", 1);
    put(s, 53, "j3", 1, "arrow", 1);
    const e = move(s, command);
    assert.ok(s.board[39]);
    assert.equal(e.adjacentCaptures, undefined);
    assert.ok(isSupportedState(s));
  }
});
test("friendly claimed neighbors do not capture a drop", () => {
  const s = active();
  put(s, 26, "j1", 0, "arrow", 1);
  put(s, 27, "j3", 0, "arrow", 1);
  move(s, { type: "drop", tile: "r4", at: 39 });
  assert.ok(s.board[39]);
  assert.deepEqual(scores(s), [0, 0]);
});
test("a group crosses nine only through matching arrows, not physical contact", () => {
  const s = active();
  const types = ["j1", "r2", "r4", "r6", "r8", "r2", "r4", "r6", "j3"];
  types.forEach((type, k) => put(s, 26 + k, type, 0, "arrow", 1));
  s.board[34].face = "digit";
  s.board[33].face = "digit";
  assert.deepEqual(scores(s), [0, 0]);
  const e = move(s, {
    type: "claim",
    tiles: [
      { at: 34, rotation: 1 },
      { at: 33, rotation: 1 },
    ],
  });
  assert.equal(e.length, 9);
  assert.deepEqual(scores(s), [9, 0]);
  assert.deepEqual(scoreBreakdown(s)[0], {
    scoring: 9,
    growing: 0,
    territory: 0,
    captured: 0,
    groups: [9],
    total: 9,
  });
  s.board[30].rotation = 0; // physical contact does not keep the groups joined
  assert.deepEqual(
    claimedGroups(s.board).map((g) => g.size),
    [4, 1, 4],
  );
  assert.deepEqual(scores(s), [0, 0]);
});
test("separate sub-nine groups do not score even if their combined size exceeds nine", () => {
  const s = active();
  for (const start of [26, 52])
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
  types.forEach((type, k) => put(s, 26 + k, type, 1, "arrow", 1));
  assert.deepEqual(scores(s), [0, 9]);
  move(s, { type: "challenge", fee: "r0", path: [29, 30], factor: "3" });
  assert.deepEqual(
    claimedGroups(s.board).map((g) => g.size),
    [3, 4],
  );
  assert.deepEqual(scores(s), [2, 1]);
  assert.ok(isSupportedState(s));
});
test("claims, endgame removal of small groups and scoring replay identically", () => {
  const s = active();
  const commands = [
    { type: "drop", tile: "j1", at: 98 },
    { type: "drop", tile: "r4", at: 86 },
    { type: "drop", tile: "j3", at: 85 },
    { type: "pass" },
    { type: "drop", tile: "j7", at: 99 },
    { type: "pass" },
    {
      type: "claim",
      tiles: [
        { at: 99, rotation: 1 },
        { at: 98, rotation: 0 },
        { at: 85, rotation: 0 },
      ],
    },
    { type: "drop", tile: "r2", at: 84 },
    { type: "pass" },
    { type: "pass" },
  ];
  const positions = [clone(s)];
  for (const command of commands) {
    move(s, command);
    assert.ok(isSupportedState(s));
    if (command.type === "drop" && command.at === 84) {
      assert.ok(s.board[84]);
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
