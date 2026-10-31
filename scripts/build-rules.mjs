import { readFile, writeFile } from "node:fs/promises";
const text = await readFile(
  new URL("../howtoplay.md", import.meta.url),
  "utf8",
);
const escape = (s) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const inline = (s) =>
  escape(s)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
const lines = text.trim().split("\n");
let html = "",
  list = false;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  if (!/^\d+\. /.test(line) && list) {
    html += "</ol>";
    list = false;
  }
  if (line.startsWith("|")) {
    const rows = [];
    while (lines[i]?.startsWith("|")) {
      rows.push(
        lines[i]
          .split("|")
          .slice(1, -1)
          .map((x) => x.trim()),
      );
      i++;
    }
    i--;
    html +=
      '<div class="table-wrap"><table><thead><tr>' +
      rows[0].map((x) => `<th>${inline(x)}</th>`).join("") +
      "</tr></thead><tbody>" +
      rows
        .slice(2)
        .map(
          (row) =>
            "<tr>" + row.map((x) => `<td>${inline(x)}</td>`).join("") + "</tr>",
        )
        .join("") +
      "</tbody></table></div>";
    continue;
  }
  if (line.startsWith("# ")) html += `<h1>${inline(line.slice(2))}</h1>`;
  else if (line.startsWith("## ")) html += `<h2>${inline(line.slice(3))}</h2>`;
  else if (/^\d+\. /.test(line)) {
    if (!list) {
      html += "<ol>";
      list = true;
    }
    html += `<li>${inline(line.replace(/^\d+\. /, ""))}</li>`;
  } else html += `<p>${inline(line)}</p>`;
}
if (list) html += "</ol>";
await writeFile(
  new URL("../rules-content.js", import.meta.url),
  `// Generated from howtoplay.md by npm run rules.\nexport const RULES_HTML = ${JSON.stringify(html)};\n`,
);
