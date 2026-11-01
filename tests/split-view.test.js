import test from "node:test";
import assert from "node:assert/strict";
import { newGame, applyMove, clone, total } from "../engine.js";
import { topPocket, put, cell } from "./position-fixtures.js";
import {
  splitPermissions,
  splitPanelHTML,
  splitActionHTML,
} from "../split-view.js";
const active = () => {
  const s = newGame({ mode: "casual", first: 0 }, 0);
  s.started = true;
  return s;
};
const panel = (s, seat, options = {}) =>
  splitPanelHTML(s, {
    seat,
    formatTime: (n) => (n === null ? "∞" : String(n)),
    ...options,
  });
test("only the active seat can move, and permissions switch after a legal drop", () => {
  const s = active();
  assert.equal(splitPermissions(s, 0).canMove, true);
  assert.equal(splitPermissions(s, 1).canMove, false);
  applyMove(s, { type: "drop", tile: "r4", at: cell("I9") }, 0);
  assert.equal(splitPermissions(s, 0).canMove, false);
  assert.equal(splitPermissions(s, 1).canMove, true);
  assert.match(panel(s, 0), /data-split-command="action" disabled/);
  assert.doesNotMatch(panel(s, 1), /data-split-command="action" disabled/);
});
test("online seats never gain authority through another player’s split controls", () => {
  const s = active();
  s.turn = 1;
  assert.equal(splitPermissions(s, 1, { role: 0 }).canMove, false);
  assert.equal(
    splitPermissions(s, 1, { role: 1, connected: true }).canMove,
    true,
  );
  assert.equal(
    splitPermissions(s, 1, { role: 1, connected: false }).canMove,
    false,
  );
  assert.equal(splitPermissions(s, 0).canResign, false);
  assert.equal(splitPermissions(s, 1).canResign, true);
});
test("paused, ended, reviewing and disconnected games disable move submission", () => {
  for (const options of [{ networkLost: true }, { reviewAt: 0 }])
    assert.equal(splitPermissions(active(), 0, options).canMove, false);
  for (const patch of [
    { paused: true },
    { started: false },
    { ended: { winner: 0 } },
  ])
    assert.equal(
      splitPermissions(Object.assign(active(), patch), 0).canMove,
      false,
    );
  const s = active();
  s.paused = true;
  assert.equal(splitPermissions(s, 0).canPause, true);
  assert.equal(splitPermissions(s, 1).canPause, true);
  assert.match(panel(s, 0), /Resume game/);
  assert.equal(splitPermissions(newGame(), 1).canStart, true);
});
test("each player sees their own type-specific reserve and claimed score", () => {
  const s = active();
  applyMove(s, { type: "drop", tile: "r4", at: cell("I9") }, 0);
  const zero = panel(s, 0),
    one = panel(s, 1);
  assert.equal(total(s.reserves[0]), 161);
  assert.equal(total(s.reserves[1]), 162);
  assert.match(zero, /4, Straight, 17 remaining/);
  assert.match(one, /4, Straight, 18 remaining/);
  assert.match(zero, /data-split-command="tile" data-value="r4"[^>]*disabled/);
  assert.doesNotMatch(
    one,
    /data-split-command="tile" data-value="r4"[^>]*disabled/,
  );
});
test("cloned rotation and challenge controls have distinct IDs for both seats", () => {
  const html =
    '<select id="segment-picker"></select><input id="factor-input" value="13"><button id="rotate-tile">Rotate</button>';
  const a = splitActionHTML(html, 0),
    b = splitActionHTML(html, 1);
  const ids = [...(a + b).matchAll(/\bid="([^"]+)"/g)].map((x) => x[1]);
  assert.equal(new Set(ids).size, 6);
  assert.match(a, /data-split-field="factor"/);
  assert.match(b, /data-split-field="segment"/);
  assert.match(b, /split-1-rotate-tile/);
});
test("split panels expose the optional challenge, normal moves and a physical keypad", () => {
  const s = active();
  const html = panel(s, 0, {
    action: "challenge",
    content: '<input id="factor-input" value="13">',
    feedback: "One attempt before your move.",
    commitLabel: "Test factor",
    commitDisabled: false,
  });
  assert.match(html, /data-split-command="commit"[^>]*>Test factor/);
  assert.match(html, /Challenge first · optional/);
  assert.match(html, /Your reserve/);
  assert.doesNotMatch(html, /challenge fee/);
  assert.match(html, /Factor digit 0/);
  assert.match(html, /Factor digit 9/);
  assert.match(html, /Delete last factor digit/);
  assert.match(html, /value="13"/);
  assert.doesNotMatch(html, /Double Down|Single Drop|anchor tiles/);
});
test("each phone panel has its own expandable controls and escaped name", () => {
  const s = active();
  s.names[0] = "<Blue>";
  s.names[1] = "Orange & Gold";
  const a = panel(s, 0, { phoneOpen: true }),
    b = panel(s, 1, { phoneOpen: false });
  assert.match(a, /&lt;Blue&gt;/);
  assert.match(b, /Orange &amp; Gold/);
  assert.match(a, /aria-expanded="true" aria-controls="split-body-0"/);
  assert.match(b, /aria-expanded="false" aria-controls="split-body-1"/);
  assert.match(a, /data-phone-open="true"/);
  assert.match(b, /data-phone-open="false"/);
});
test("split review displays the chosen position without changing the game or draft", () => {
  const s = active();
  applyMove(s, { type: "drop", tile: "r4", at: 0 }, 0);
  applyMove(s, { type: "pass" }, 0);
  applyMove(s, { type: "pass" }, 0);
  const before = clone(s);
  const html = panel(s, 1, {
    reviewAt: 0,
    result: "A drawn game",
    journal: [{ title: "Drop 1", note: "A1" }],
  });
  assert.match(html, /Starting position/);
  assert.match(html, /Previous step/);
  assert.match(html, /Next step/);
  assert.match(html, /Show result/);
  assert.match(html, /data-split-command="history"/);
  assert.deepEqual(s, before);
});

test("countdowns block both seats and only one keypad is rendered per panel", () => {
  const s = newGame();
  s.startCountdown = { finishAt: 3000 };
  assert.equal(splitPermissions(s, 0).canStart, false);
  assert.equal(splitPermissions(s, 1).canMove, false);
  const content =
    '<input id="factor-input"><div id="factor-keypad" data-standalone-only><button>1</button></div><button id="factor-backspace">⌫</button>';
  const html = splitActionHTML(content, 0);
  assert.doesNotMatch(html, /factor-keypad/);
  assert.match(html, /data-split-command="delete"/);
});

test("a used challenge disables only the optional challenge, including after a failed attempt", () => {
  const s = active();
  s.challengeUsed = true;
  const html = panel(s, 0);
  assert.match(html, /data-split-command="action" disabled[^>]*data-value="challenge"/);
  for (const action of ["drop", "pass"])
    assert.match(html, new RegExp('data-split-command="action"  data-value="' + action + '"'));
  const normal = html.match(/aria-label="Move type for Blue">([\s\S]*?)<\/div>/)[1];
  assert.doesNotMatch(normal, /challenge/);
});

test("split scores show claimed tiles and captured points, without territory", () => {
  const s = active();
  topPocket(s);
  put(s, 5, "r2", 1);
  put(s, cell("F2"), "r4", 1);
  assert.match(panel(s, 0), /9 points · 9 scoring tiles · 0 captured/);
  assert.match(panel(s, 1), /0 points · 0 scoring tiles · 0 captured/);
});
