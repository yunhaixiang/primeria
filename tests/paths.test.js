import test from "node:test";
import assert from "node:assert/strict";
import { newGame, claimPreview, ports, segments } from "../engine.js";
import { orientPath } from "../paths.js";
import { extendChallenge, challengeReady } from "../challenge-selection.js";
import { routeSVG, tileHTML, factorKeyHTML } from "../tiles.js";
function board() {
  const b = newGame().board;
  for (let k = 0; k < 9; k++)
    b[30 + k] = { id: k + 1, type: "r2", owner: 0, face: "digit", rotation: 0 };
  return b;
}
test("clicked path can orient itself in either straight direction", () => {
  const b = board(),
    path = Array.from({ length: 9 }, (_, i) => 30 + i);
  const tiles = orientPath(b, path, 0);
  assert.equal(tiles.length, 9);
  assert.ok(tiles.every((t) => t.rotation === 1));
  assert.equal(claimPreview(b, tiles, 0).length, 9);
  assert.ok(orientPath(b, path.reverse(), 0).every((t) => t.rotation === 3));
});
test("left bend fits its printed shape and right bend cannot replace that turn", () => {
  const b = board();
  b[32].type = "r0";
  b[17] = { type: "r2", owner: 0, face: "digit", rotation: 0 };
  const path = [30, 31, 32, 17];
  assert.ok(orientPath(b, path, 0));
  b[32].type = "r5";
  assert.equal(orientPath(b, path, 0), null);
});
test("challenge selection starts at endpoints and follows valid arrows", () => {
  const b = board();
  for (const t of b.filter(Boolean)) {
    t.face = "arrow";
    t.rotation = 1;
  }
  assert.deepEqual(extendChallenge(b, [], 31, 0), []);
  let path = extendChallenge(b, [], 30, 0);
  assert.deepEqual(path, [30]);
  assert.deepEqual(extendChallenge(b, path, 32, 0), [30]);
  path = extendChallenge(b, path, 31, 0);
  assert.deepEqual(path, [30, 31]);
  assert.ok(challengeReady(b, path, 0).error);
  for (let i = 32; i <= 38; i++) path = extendChallenge(b, path, i, 0);
  assert.equal(challengeReady(b, path, 0).number, "222222222");
  assert.deepEqual(extendChallenge(b, path, 38, 0), path.slice(0, -1));
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
    const cells = Array.from({ length: 225 }, (_, i) =>
      logicalIndex(Math.floor(i / 15), i % 15, r),
    );
    assert.equal(new Set(cells).size, 225);
    const labels = boardLabels(r);
    assert.deepEqual(boardHomeEdges(r), { columns: r % 2, rows: 1 - r % 2 });
    for (let c = 0; c < 15; c++) {
      const i = logicalIndex(0, c, r);
      assert.equal(
        labels.columns[c],
        r % 2
          ? String(Math.floor(i / 15) + 1)
          : String.fromCharCode(65 + (i % 15)),
      );
    }
  }
  assert.equal(boardLabels(1).columns[0], "15");
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
