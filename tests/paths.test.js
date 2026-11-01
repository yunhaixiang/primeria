import { cell } from "./territory-fixtures.js";
import test from "node:test";
import assert from "node:assert/strict";
import { BOARD_SIZE, BOARD_CELLS, newGame, claimPreview, ports, segments } from "../engine.js";
import { orientPath } from "../paths.js";
import { extendChallenge, challengeReady } from "../challenge-selection.js";
import { routeSVG, tileHTML, factorKeyHTML } from "../tiles.js";
function board() {
  const b = newGame().board;
  for (let k = 0; k < 9; k++)
    b[cell("A3") + k] = { id: k + 1, type: "r2", owner: 0, face: "digit", rotation: 0 };
  return b;
}
test("clicked path can orient itself in either straight direction", () => {
  const b = board(),
    path = Array.from({ length: 9 }, (_, i) => cell("A3") + i);
  const tiles = orientPath(b, path, 0);
  assert.equal(tiles.length, 9);
  assert.ok(tiles.every((t) => t.rotation === 1));
  assert.equal(claimPreview(b, tiles, 0).length, 9);
  assert.ok(orientPath(b, path.reverse(), 0).every((t) => t.rotation === 3));
});
test("left bend fits its printed shape and right bend cannot replace that turn", () => {
  const b = board();
  b[cell("C3")].type = "r0";
  b[cell("C2")] = { type: "r2", owner: 0, face: "digit", rotation: 0 };
  const path = [cell("A3"), cell("B3"), cell("C3"), cell("C2")];
  assert.ok(orientPath(b, path, 0));
  b[cell("C3")].type = "r5";
  assert.equal(orientPath(b, path, 0), null);
});
test("challenge selection starts at endpoints and follows valid arrows", () => {
  const b = board();
  for (const t of b.filter(Boolean)) {
    t.face = "arrow";
    t.rotation = 1;
  }
  assert.deepEqual(extendChallenge(b, [], cell("B3"), 0), []);
  let path = extendChallenge(b, [], cell("A3"), 0);
  assert.deepEqual(path, [cell("A3")]);
  assert.deepEqual(extendChallenge(b, path, cell("C3"), 0), [cell("A3")]);
  path = extendChallenge(b, path, cell("B3"), 0);
  assert.deepEqual(path, [cell("A3"), cell("B3")]);
  assert.ok(challengeReady(b, path, 0).error);
  for (let i = cell("C3"); i <= cell("I3"); i++) path = extendChallenge(b, path, i, 0);
  assert.equal(challengeReady(b, path, 0).number, "222222222");
  assert.deepEqual(extendChallenge(b, path, cell("I3"), 0), path.slice(0, -1));
});
test("both tile faces preserve four aligned corner digits, ownership and route exits", () => {
  const front = tileHTML({ type: "j9", owner: 1, face: "digit", rotation: 0 }),
    back = tileHTML({ type: "j1", owner: 0, face: "arrow", rotation: 2 });
  assert.equal((front.match(/class="index /g) || []).length, 4);
  assert.equal((back.match(/class="index /g) || []).length, 4);
  assert.match(front, /underlined/);
  assert.match(back, /owner-0/);
  assert.match(routeSVG("j1", 2), /rotate\(180 50 50\)/);
  assert.equal((routeSVG("j1").match(/class="head"/g) || []).length, 3);
});

test("rotating the board preserves every coordinate and labels its actual row or column", async () => {
  const { logicalIndex, boardLabels, boardHomeEdges } = await import("../board-view.js");
  for (let r = 0; r < 4; r++) {
    const cells = Array.from({ length: BOARD_CELLS }, (_, i) =>
      logicalIndex(Math.floor(i / BOARD_SIZE), i % BOARD_SIZE, r),
    );
    assert.equal(new Set(cells).size, BOARD_CELLS);
    const labels = boardLabels(r);
    assert.deepEqual(boardHomeEdges(r), { columns: r % 2, rows: 1 - r % 2 });
    for (let c = 0; c < BOARD_SIZE; c++) {
      const i = logicalIndex(0, c, r);
      assert.equal(
        labels.columns[c],
        r % 2
          ? String(Math.floor(i / BOARD_SIZE) + 1)
          : String.fromCharCode(65 + (i % BOARD_SIZE)),
      );
    }
  }
  assert.equal(boardLabels(1).columns[0], String(BOARD_SIZE));
  assert.equal(boardLabels(3).columns[0], "1");
});

test("every tile uses identical corner boxes and reserves space for orientation marks", () => {
  for (const type of [
    "r0",
    "j1",
    "r2",
    "j3",
    "r4",
    "r5",
    "r6",
    "j7",
    "r8",
    "j9",
  ]) {
    const front = tileHTML({ type, owner: 0, face: "digit", rotation: 1 });
    const back = tileHTML({ type, owner: 0, face: "arrow", rotation: 1 });
    assert.equal(
      front
        .replace("digit-face", "arrow-face")
        .replace(/<svg[\s\S]*<\/svg>/, ""),
      back.replace(/<svg[\s\S]*<\/svg>/, ""),
    );
    assert.equal((front.match(/digit-value/g) || []).length, 4);
    assert.equal((front.match(/digit-baseline/g) || []).length, 4);
    assert.doesNotMatch(front, /front-index|mini-route/);
  }
});

test("both factor keypads reuse tile digits and retain their own input commands", () => {
  const main = factorKeyHTML(9, 0);
  const split = factorKeyHTML(6, 1, { split: true, disabled: true });
  assert.match(main, /tile-key owner-0/);
  assert.match(main, /data-factor-digit="9"/);
  assert.match(main, /digit underlined/);
  assert.match(split, /tile-key owner-1/);
  assert.match(split, /data-split-command="factor" data-value="6"/);
  assert.match(split, /disabled/);
  assert.match(split, /digit-baseline/);
});
