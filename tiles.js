import { TYPE_MAP } from "./engine.js?v=b0fb62c34b";
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
  const t = TYPE_MAP[tile.type], digit = digitHTML(t.digit);
  return `<span class="tile owner-${tile.owner} arrow-face ${preview ? "tile-preview" : ""}"><span class="index tl">${digit}</span><span class="index tr">${digit}</span><span class="index br">${digit}</span><span class="index bl">${digit}</span>${routeSVG(tile.type, tile.rotation ?? 0)}</span>`;
}
export function tileLabel(t) {
  const type = TYPE_MAP[t.type];
  return `${t.owner === 0 ? "Blue" : "Orange"} ${type.digit}, ${type.label.toLowerCase()}, rotation ${(t.rotation ?? 0) * 90} degrees`;
}
