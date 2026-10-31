import { TYPE_MAP } from "./engine.js?v=5a55683d07";
export const escapeHTML = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
/** Entry is at the bottom; rotation turns the complete route clockwise. */
export function routeSVG(type, rotation = 0) {
  const t = TYPE_MAP[type];
  let paths = "";
  for (const d of t.exits) {
    // The 11-unit rounded shaft ends at 95, matching the outlined head's inset.
    const shaft =
      d === 0
        ? "M50 89.5V24"
        : d === 1
          ? "M50 89.5V64Q50 50 64 50H76"
          : "M50 89.5V64Q50 50 36 50H24";
    const head =
      d === 0
        ? "M38 25 50 6 62 25Z"
        : d === 1
          ? "M75 38 94 50 75 62Z"
          : "M25 38 6 50 25 62Z";
    paths += `<path class="shaft" d="${shaft}"/><path class="head" d="${head}"/>`;
  }
  return `<svg class="route" viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(${rotation * 90} 50 50)">${paths}</g></svg>`;
}

const indicators = new Map();
// Centers of the filled heads and rounded strokes, counting shared fork ink once.
const indicatorCenters = {
  "0": [50, 46.971],
  "3": [36.061, 60.765],
  "1": [63.939, 60.765],
  "0,3,1": [50, 48.604],
  "0,3": [41.39, 48.071],
  "0,1": [58.61, 48.071],
  "3,1": [50, 56.854],
};
/** Use a shared scale, shifting each arrow to center its visible weight. */
export function indicatorSVG(type, rotation = 0) {
  const key = `${type}:${rotation}`;
  if (indicators.has(key)) return indicators.get(key);
  const angle = rotation * 90 - 45;
  const radians = (angle * Math.PI) / 180;
  const rotate = ([x, y]) => [
    50 + (x - 50) * Math.cos(radians) - (y - 50) * Math.sin(radians),
    50 + (x - 50) * Math.sin(radians) + (y - 50) * Math.cos(radians),
  ];
  let paths = "";
  for (const exit of TYPE_MAP[type].exits) {
    const side = exit === 1 ? 1 : -1;
    const shaft =
      exit === 0
        ? "M50 94V32"
        : `M50 94V64Q50 50 ${50 + side * 14} 50H${50 + side * 18}`;
    const head =
      exit === 0
        ? [
            [34, 30],
            [50, 4],
            [66, 30],
          ]
        : [
            [50 + side * 20, 34],
            [50 + side * 46, 50],
            [50 + side * 20, 66],
          ];
    paths += `<path class="shaft" d="${shaft}"/><path class="head" d="M${head.map((point) => point.join(" ")).join(" ")}Z"/>`;
  }
  const [cx, cy] = rotate(indicatorCenters[TYPE_MAP[type].exits.join(",")]);
  // One common viewBox size gives every shaft and head the same visual scale.
  const size = 96;
  const box = [cx - size / 2, cy - size / 2, size, size]
    .map((n) => Number(n.toFixed(3)))
    .join(" ");
  const svg = `<svg class="route" viewBox="${box}" aria-hidden="true"><g transform="rotate(${angle} 50 50)">${paths}</g></svg>`;
  indicators.set(key, svg);
  return svg;
}
/** Reserve the same baseline space for every digit, including its orientation mark. */
export function digitHTML(value) {
  return `<span class="digit ${value === 6 || value === 9 ? "underlined" : ""}"><span class="digit-value">${value}</span><span class="digit-baseline" aria-hidden="true"></span></span>`;
}
export function factorKeyHTML(
  value,
  owner,
  { split = false, disabled = false } = {},
) {
  return `<button type="button" class="factor-digit tile-key owner-${owner}" ${split ? `data-split-command="factor" data-value="${value}"` : `data-factor-digit="${value}"`} aria-label="Factor digit ${value}" ${disabled ? "disabled" : ""}>${digitHTML(value)}</button>`;
}
export function tileHTML(tile, { preview = false } = {}) {
  const t = TYPE_MAP[tile.type],
    digit = digitHTML(t.digit),
    arrow = tile.face === "arrow";
  return `<span class="tile owner-${tile.owner} ${arrow ? "arrow-face" : "digit-face"} ${preview ? "tile-preview" : ""}"><span class="index tl">${digit}</span><span class="index tr">${digit}</span><span class="index br">${digit}</span><span class="index bl">${digit}</span>${arrow ? routeSVG(tile.type, tile.rotation) : indicatorSVG(tile.type, tile.rotation)}</span>`;
}
export function tileLabel(t) {
  const type = TYPE_MAP[t.type];
  return `${t.owner === 0 ? "Blue" : "Orange"} ${type.digit}, ${type.label.toLowerCase()}, ${t.face === "arrow" ? "claimed" : "unclaimed"}`;
}
