import test from "node:test";
import assert from "node:assert/strict";
import { TYPES, BOARD_SIZE, BOARD_CELLS, newGame } from "../engine.js";
import { orientationsFor } from "../paths.js";
import { extendChallenge, challengeReady } from "../challenge-selection.js";
import { routeSVG, tileHTML, factorKeyHTML } from "../tiles.js";
import { cell, line } from "./position-fixtures.js";
test("regular bends match their printed turns and straight tiles cannot turn",()=>{
 assert.deepEqual(orientationsFor("r2",3,0),[1]);
 assert.deepEqual(orientationsFor("r8",3,0),[]);
 assert.deepEqual(orientationsFor("r4",3,1),[1]);
});
test("challenge selection starts at junctions and finishes only at a second junction",()=>{
 const s=newGame(), cells=line(s,cell("A3"),0,["j1","r4","r6","j3"]);
 assert.deepEqual(extendChallenge(s.board,[],cells[1],0),[]);
 let path=extendChallenge(s.board,[],cells[0],0);
 path=extendChallenge(s.board,path,cells[1],0);assert.ok(challengeReady(s.board,path,0).error);
 path=extendChallenge(s.board,path,cells[2],0);path=extendChallenge(s.board,path,cells[3],0);
 assert.equal(challengeReady(s.board,path,0).number,"3641");
 assert.deepEqual(extendChallenge(s.board,path,cells[3],0),path.slice(0,-1));
});
test("all tiles show a full solid arrow with four aligned corner digits",()=>{
 for(const type of TYPES){
  const html=tileHTML({type:type.id,owner:0,rotation:2});
  assert.equal((html.match(/class="index /g)||[]).length,4);
  assert.equal((html.match(/digit-baseline/g)||[]).length,4);
  assert.match(html,/arrow-face/);assert.doesNotMatch(html,/digit-face/);
  assert.match(html,/rotate\(180 50 50\)/);
 }
 assert.equal((routeSVG("j1").match(/class="head"/g)||[]).length,3);
});
test("rotating the board preserves every coordinate and labels its actual row or column", async () => {
  const { logicalIndex, boardLabels } = await import("../board-view.js");
  for (let r = 0; r < 4; r++) {
    const cells = Array.from({ length: BOARD_CELLS }, (_, i) =>
      logicalIndex(Math.floor(i / BOARD_SIZE), i % BOARD_SIZE, r),
    );
    assert.equal(new Set(cells).size, BOARD_CELLS);
    const labels = boardLabels(r);
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
