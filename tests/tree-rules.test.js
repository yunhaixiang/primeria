import { cell } from "./territory-fixtures.js";
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
  put(s, cell("H8"), "j1", owner);
  put(s, cell("H7"), "j3", owner);
  put(s, cell("I8"), "j7", owner);
  return [
    { at: cell("I8"), rotation: 1 },
    { at: cell("H8"), rotation: 0 },
    { at: cell("H7"), rotation: 0 },
  ];
}
test("an unordered fork can be claimed without inventing a linear number", () => {
  const s = active(),
    tiles = branch(s);
  const event = move(s, { type: "claim", tiles });
  assert.equal(event.length, 3);
  assert.equal(event.number, null);
  assert.deepEqual(graph(s.board).out[cell("H8")].sort(), [cell("H7"), cell("I8")].sort());
  assert.deepEqual(scores(s), [0, 0]);
  assert.ok(isSupportedState(s));
});
test("automatic alignment handles branches independently of click order", () => {
  const s = active();
  branch(s);
  for (const cells of [
    [cell("H7"), cell("I8"), cell("H8")],
    [cell("H8"), cell("H7"), cell("I8")],
    [cell("I8"), cell("H8"), cell("H7")],
  ]) {
    const tiles = orientTree(s.board, cells, 0);
    assert.ok(tiles);
    assert.equal(claimPreview(s.board, tiles, 0).length, 3);
  }
});
test("two disconnected pairs cannot be bundled into one claim", () => {
  const s = active();
  [cell("A3"), cell("B3"), cell("A7"), cell("B7")].forEach((at) => put(s, at, "j1"));
  assert.throws(
    () =>
      move(s, {
        type: "claim",
        tiles: [cell("A3"), cell("B3"), cell("A7"), cell("B7")].map((at) => ({ at, rotation: 1 })),
      }),
    /connected network/,
  );
});
test("new tiles must connect to each other, not only through older claimed tiles", () => {
  const s = active();
  put(s, cell("H8"), "j1", 0, "arrow", 0);
  put(s, cell("H9"), "j1", 0, "arrow", 0);
  put(s, cell("H7"), "j3");
  put(s, cell("I8"), "j7");
  assert.throws(
    () =>
      claimPreview(
        s.board,
        [
          { at: cell("H7"), rotation: 0 },
          { at: cell("I8"), rotation: 1 },
        ],
        0,
      ),
    /connected network/,
  );
});
test("mere adjacency never captures digits or claimed enemies", () => {
  const s = active();
  const tiles = branch(s);
  put(s, cell("I7"), "r2", 1); // beside two newly claimed tiles: captured once
  put(s, cell("G7"), "r4", 1);
  put(s, cell("H6"), "r6", 1);
  put(s, cell("J9"), "r8", 1); // last is diagonal only
  put(s, cell("J8"), "j1", 1, "arrow", 0);
  put(s, cell("J7"), "j3", 1, "arrow", 0);
  put(s, cell("H9"), "r4"); // friendly digit beside an older enemy group survives
  put(s, cell("I9"), "j1", 1, "arrow", 2);
  put(s, cell("I10"), "j3", 1, "arrow", 2);
  const e = move(s, { type: "claim", tiles });
  assert.equal(e.enclosureCaptures, undefined);
  for (const at of [cell("H6"), cell("G7"), cell("I7")]) assert.ok(s.board[at]);
  assert.ok(s.board[cell("J9")]);
  assert.ok(s.board[cell("J8")]);
  assert.ok(s.board[cell("H9")]);
  assert.deepEqual(scores(s), [0, 0]);
  assert.ok(isSupportedState(s));
});
test("dropping beside an older enemy claimed group survives and can be saved", () => {
  const s = active();
  put(s, cell("A3"), "j1", 1, "arrow", 1);
  put(s, cell("B3"), "j3", 1, "arrow", 1);
  const e = move(s, { type: "drop", tile: "r4", at: cell("A4") });
  assert.ok(s.board[cell("A4")]);
  assert.equal(e.adjacentCaptures, undefined);
  assert.equal(s.reserves[0].r4, 14);
  assert.deepEqual(scores(s), [0, 0]);
  assert.ok(isSupportedState(s));
  assert.ok(isSupportedState(JSON.parse(JSON.stringify(s))));
});
test("a claim does not capture merely beside new or older arrows", () => {
  const s = active();
  put(s, cell("A3"), "j1", 0, "arrow", 1);
  put(s, cell("B3"), "j3", 0, "arrow", 1);
  put(s, cell("A4"), "r2", 1); // beside old arrow only
  put(s, cell("C3"), "j7");
  put(s, cell("D3"), "j3");
  put(s, cell("D4"), "r4", 1); // beside new arrow
  const e = move(s, {
    type: "claim",
    tiles: [{ at: cell("C3"), rotation: 1 }, { at: cell("D3"), rotation: 1 }],
  });
  assert.equal(e.enclosureCaptures, undefined);
  assert.ok(s.board[cell("D4")]);
  assert.ok(s.board[cell("A4")]);
  assert.ok(isSupportedState(s));
});
test("passing or challenging never activates adjacent capture from older arrows", () => {
  for (const command of [
    { type: "pass" },
    { type: "challenge", path: [cell("A5"), cell("B5")], factor: "3" },
    { type: "challenge", path: [cell("A5"), cell("B5")], factor: "2" },
  ]) {
    const s = active();
    put(s, cell("A3"), "j1", 0, "arrow", 1);
    put(s, cell("B3"), "j3", 0, "arrow", 1);
    put(s, cell("A4"), "r2", 1);
    put(s, cell("A5"), "j3", 1, "arrow", 1);
    put(s, cell("B5"), "j3", 1, "arrow", 1);
    const e = move(s, command);
    assert.ok(s.board[cell("A4")]);
    assert.equal(e.adjacentCaptures, undefined);
    assert.ok(isSupportedState(s));
  }
});
test("friendly claimed neighbors do not capture a drop", () => {
  const s = active();
  put(s, cell("A3"), "j1", 0, "arrow", 1);
  put(s, cell("B3"), "j3", 0, "arrow", 1);
  move(s, { type: "drop", tile: "r4", at: cell("A4") });
  assert.ok(s.board[cell("A4")]);
  assert.deepEqual(scores(s), [0, 0]);
});
test("a group crosses nine only through matching arrows, not physical contact", () => {
  const s = active();
  const types = ["j1", "r2", "r4", "r6", "r8", "r2", "r4", "r6", "j3"];
  types.forEach((type, k) => put(s, cell("A3") + k, type, 0, "arrow", 1));
  s.board[cell("I3")].face = "digit";
  s.board[cell("H3")].face = "digit";
  assert.deepEqual(scores(s), [0, 0]);
  const e = move(s, {
    type: "claim",
    tiles: [
      { at: cell("I3"), rotation: 1 },
      { at: cell("H3"), rotation: 1 },
    ],
  });
  assert.equal(e.length, 9);
  assert.deepEqual(scores(s), [9, 0]);
  assert.deepEqual(scoreBreakdown(s)[0], {
    eligible: 9,
    growing: 0,
    captured: 0,
    groups: [9],
    total: 9,
  });
  s.board[cell("E3")].rotation = 0; // physical contact does not keep the groups joined
  assert.deepEqual(
    claimedGroups(s.board).map((g) => g.size),
    [4, 1, 4],
  );
  assert.deepEqual(scores(s), [0, 0]);
});
test("separate sub-nine groups do not score even if their combined size exceeds nine", () => {
  const s = active();
  for (const start of [cell("A3"), cell("A5")])
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
test("cutting a claimed nine-tile group awards prisoners and removes its scoring claim", () => {
  const s = active();
  const types = ["j1", "r2", "r4", "j3", "j3", "r6", "r8", "r2", "j3"];
  types.forEach((type, k) => put(s, cell("A3") + k, type, 1, "arrow", 1));
  assert.deepEqual(scores(s), [0, 9]);
  move(s, { type: "challenge", path: [cell("D3"), cell("E3")], factor: "3" });
  assert.deepEqual(
    claimedGroups(s.board).map((g) => g.size),
    [3, 4],
  );
  assert.deepEqual(scores(s), [2, 0]);
  assert.ok(isSupportedState(s));
});
test("claims, endgame removal of small groups and scoring replay identically", () => {
  const s = active();
  const commands = [
    { type: "drop", tile: "j1", at: cell("H8") },
    { type: "drop", tile: "r4", at: cell("I7") },
    { type: "drop", tile: "j3", at: cell("H7") },
    { type: "pass" },
    { type: "drop", tile: "j7", at: cell("I8") },
    { type: "pass" },
    {
      type: "claim",
      tiles: [
        { at: cell("I8"), rotation: 1 },
        { at: cell("H8"), rotation: 0 },
        { at: cell("H7"), rotation: 0 },
      ],
    },
    { type: "drop", tile: "r2", at: cell("G7") },
    { type: "pass" },
    { type: "pass" },
  ];
  const positions = [clone(s)];
  for (const command of commands) {
    move(s, command);
    assert.ok(isSupportedState(s));
    if (command.type === "drop" && command.at === cell("G7")) {
      assert.ok(s.board[cell("G7")]);
    }
    positions.push(clone(s));
  }
  for (let n = 0; n < positions.length; n++) {
    const replay = reviewPosition(s, n);
    assert.deepEqual(replay.board, positions[n].board);
    assert.deepEqual(replay.reserves, positions[n].reserves);
    assert.deepEqual(scores(replay), scores(positions[n]));
  }
  assert.ok(isSupportedState(JSON.parse(JSON.stringify(s))));
  assert.equal(
    isSupportedState({ ...s, rulesVersion: RULES_VERSION - 1 }),
    false,
  );
});
