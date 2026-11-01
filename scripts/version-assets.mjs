// Give the browser one consistent revision of the complete game interface.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url);
const files = [
  "index.html",
  "how-to-play.html",
  "styles.css",
  "favicon.svg",
  "app.js",
  "engine.js",
  "tiles.js",
  "paths.js",
  "board-view.js",
  "split-view.js",
  "review.js",
  "challenge-selection.js",
  "rules-content.js",
];
const contents = await Promise.all(
  files.map(async (file) => [
    file,
    (await readFile(new URL(file, root), "utf8")).replace(
      /(\.(?:js|css|svg))\?v=[\w-]+/g,
      "$1",
    ),
  ]),
);
const version = createHash("sha256")
  .update(contents.map(([file, source]) => file + "\n" + source).join("\n"))
  .digest("hex")
  .slice(0, 10);
for (const [file, source] of contents) {
  let result = source;
  if (file.endsWith(".js") || file.endsWith(".html"))
    result = result.replace(
      /(["'])(\.\/[^"'?]+\.js)\1/g,
      (_, quote, path) => `${quote}${path}?v=${version}${quote}`,
    );
  if (file.endsWith(".html"))
    result = result.replace(
      /((?:src|href)=["'])(app\.js|styles\.css|favicon\.svg)(["'])/g,
      `$1$2?v=${version}$3`,
    );
  await writeFile(new URL(file, root), result);
}
console.log(`Browser assets: ${version}`);
