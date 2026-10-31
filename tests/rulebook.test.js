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
    "58 tiles",
    "Flip at least 2",
    "capture every surrounded unclaimed enemy tile",
    "Territory",
    "home edges",
    "all claimed groups of fewer than nine tiles",
    "each empty territory square",
    "at least nine",
    "last tile to the first",
    "two consecutive passes",
    "No Isolated Arrow Rule",
    "No Leading Zero Rule",
    "Casual",
  ]) {
    assert.ok(md.includes(text));
    assert.ok(RULES_HTML.includes(text));
  }
  const page = await readFile(
      new URL("../how-to-play.html", import.meta.url),
      "utf8",
    ),
    app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.ok(page.includes("rules-content.js"));
  assert.ok(app.includes("rules-content.js"));
  assert.ok(!md.includes("adjacent to a tile you just flipped"));
  assert.ok(!app.includes("captured immediately beside"));
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
    "bot.js",
    "bot-worker.js",
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
