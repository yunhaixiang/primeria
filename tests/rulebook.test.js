import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { RULES_HTML } from "../rules-content.js";
test("current rulebook contains the exact supply, path requirements, pass ending and time modes", async () => {
  const md = await readFile(
    new URL("../howtoplay.md", import.meta.url),
    "utf8",
  );
  for (const text of [
    "162 tiles", "18 copies of each digit", "at least two of your tiles",
    "first and last tiles are junction tiles", "Tiles cannot be rotated after placement",
    "regular tiles that do not lie on a segment", "groups of fewer than six",
    "each square in your territory", "each captured tile",
    "Tiles left on the board do not score", "does not touch the board edge",
    "every tile bordering it is yours",
    "last tile to the first", "two consecutive passes", "Casual",
    "you may attempt one Challenge", "Then Drop or Pass",
    "Whether correct or not, then make your Drop or Pass",
    "Captured tiles stay out of play", "A successful Challenge breaks the pass streak",
    "Add the increment once",
  ]) {
    assert.ok(md.toLowerCase().includes(text.toLowerCase()), text);
    assert.ok(RULES_HTML.toLowerCase().includes(text.toLowerCase()), text);
  }
  const page = await readFile(
      new URL("../how-to-play.html", import.meta.url),
      "utf8",
    ),
    app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.ok(page.includes("rules-content.js"));
  assert.ok(app.includes("rules-content.js"));
  assert.doesNotMatch(md, /Flip at least|No Leading Zero Rule|Drop, Claim|digit side|digit-side/);
  assert.ok(md.includes("**territory**"));
  assert.doesNotMatch(md, /A junction must connect/);
  assert.ok(!/home edges|surrounded|surrounding/i.test(md));
  assert.ok(!app.includes("captured immediately beside"));
  assert.doesNotMatch(md, /No Isolated Arrow Rule|at most six|capped at 6/);
});
test("every browser module and published asset exists", async () => {
  const files = [
    "index.html",
    "how-to-play.html",
    "styles.css",
    "app.js",
    "split-view.js",
    "board-view.js",
    "engine.js",
    "tiles.js",
    "paths.js",
    "review.js",
    "challenge-selection.js",
    "rules-content.js",
  ];
  for (const file of files) {
    const source = await readFile(
      new URL("../" + file, import.meta.url),
      "utf8",
    );
    for (const match of source.matchAll(
      /(?:from\s+|import\s*)['"](\.\/[^'"]+)['"]/g,
    ))
      await readFile(new URL("../" + match[1], import.meta.url));
  }
  const workflow = await readFile(
    new URL("../.github/workflows/pages.yml", import.meta.url),
    "utf8",
  );
  for (const file of files)
    assert.ok(workflow.includes(file), file + " published");
});

test("divisibility tips keep their consecutive numbering", () => {
  assert.equal((RULES_HTML.match(/<ol>/g) || []).length, 1);
  assert.equal((RULES_HTML.match(/<li>/g) || []).length, 7);
});
