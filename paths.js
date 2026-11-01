import {
  direction,
  neighbor,
  claimPreview,
  ports,
} from "./engine.js?v=1d923cf797";
/** Fit a connected selection, including forks; click order does not define a path. */
export function orientTree(
  board,
  indices,
  owner,
  { budget = 6000, preferred = [], rank = null } = {},
) {
  if (!indices.length) return [];
  if (
    new Set(indices).size !== indices.length ||
    indices.some(
      (at) =>
        !board[at] || board[at].owner !== owner || board[at].face !== "digit",
    )
  )
    return null;
  if (indices.length === 1)
    return [{ at: indices[0], rotation: preferred[0]?.rotation ?? 0 }];
  const selected = new Set(indices),
    seen = new Set();
  const preferences = new Map(preferred.map((t) => [t.at, t.rotation]));
  let visited = 0,
    best = null,
    bestValue = -Infinity,
    found = 0;
  function walk(assigned) {
    if (++visited > budget || found >= 12) return;
    const key = [...assigned]
      .sort((a, b) => a[0] - b[0])
      .map(([i, r]) => i + ":" + r)
      .join(",");
    if (seen.has(key)) return;
    seen.add(key);
    if (assigned.size === selected.size) {
      const tiles = indices.map((at) => ({ at, rotation: assigned.get(at) }));
      try {
        const result = claimPreview(board, tiles, owner);
        const value =
          result.length * 10 +
          tiles.filter((t) => preferences.get(t.at) === t.rotation).length +
          (rank ? rank(result) : 0);
        found++;
        if (value > bestValue) {
          best = tiles;
          bestValue = value;
        }
      } catch {}
      return;
    }
    const choices = [];
    for (const [at, rotation] of assigned)
      for (const d of ports({ ...board[at], rotation }).exits) {
        const j = neighbor(at, d);
        if (j !== null && selected.has(j) && !assigned.has(j))
          choices.push([j, d]);
      }
    choices.sort(
      (a, b) =>
        Number(preferences.get(b[0]) === b[1]) -
        Number(preferences.get(a[0]) === a[1]),
    );
    for (const [at, rotation] of choices) {
      assigned.set(at, rotation);
      walk(assigned);
      assigned.delete(at);
      if (visited > budget || found >= 12) break;
    }
  }
  for (const root of indices) {
    const rotations = [0, 1, 2, 3].sort(
      (a, b) =>
        Number(preferences.get(root) === b) -
        Number(preferences.get(root) === a),
    );
    for (const rotation of rotations) walk(new Map([[root, rotation]]));
    if (visited > budget || found >= 12) break;
  }
  return best;
}
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
