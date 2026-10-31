import { direction, claimPreview, ports } from "./engine.js?v=78502c4ec6";
/** Orient a clicked sequence automatically, keeping its physical arrow types. */
export function orientPath(board, path, owner) {
  if (!path.length) return [];
  const candidates = [];
  for (let first = 0; first < 4; first++) {
    const tiles = [];
    let valid = true;
    for (let k = 0; k < path.length; k++) {
      const at = path[k],
        t = board[at];
      if (!t || t.owner !== owner || t.face !== "digit") {
        valid = false;
        break;
      }
      const rotation = k ? (direction(at, path[k - 1]) + 2) % 4 : first;
      if (k && direction(at, path[k - 1]) < 0) {
        valid = false;
        break;
      }
      if (
        k < path.length - 1 &&
        !ports({ ...t, rotation }).exits.includes(direction(at, path[k + 1]))
      ) {
        valid = false;
        break;
      }
      tiles.push({ at, rotation });
    }
    if (valid) {
      let length = 0;
      try {
        length = claimPreview(board, tiles, owner).length;
      } catch {}
      candidates.push({ tiles, length });
    }
  }
  return candidates.sort((a, b) => b.length - a.length)[0]?.tiles ?? null;
}
export function orientationsFor(type, entry, exit) {
  return [0, 1, 2, 3].filter((rotation) => {
    const p = ports({ type, rotation });
    return (
      (entry === null || p.entry === entry) &&
      (exit === null || p.exits.includes(exit))
    );
  });
}
