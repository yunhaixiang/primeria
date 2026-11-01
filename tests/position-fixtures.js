import { direction, ports, BOARD_SIZE, TYPES } from "../engine.js";
export const cell = square => (Number(square.slice(1)) - 1) * BOARD_SIZE + square.charCodeAt(0) - 65;
export function put(s, at, type, owner = 0, face = "arrow", rotation = 0) {
  if (s.board[at]) throw Error("Fixture square occupied");
  if (!s.reserves[owner][type]) throw Error("Fixture exhausted " + type);
  s.reserves[owner][type]--;
  s.board[at] = { id: s.nextId++, type, owner, face, rotation };
}
export function line(s, start = cell("A3"), owner = 0, types = ["j1", ...Array(7).fill("r4"), "j3"]) {
  return types.map((type, k) => { put(s, start + k, type, owner, "arrow", 1); return start + k; });
}
/** A U-shaped nine-tile path; no boundary ownership or surrounding rule. */
export function topPocket(s) {
  const cells = [3, cell("D2"), cell("D3"), cell("E3"), cell("F3"), cell("G3"), cell("H3"), cell("H2"), 7];
  const types = ["j1", "r4", "r2", "r4", "r6", "r4", "r2", "r4", "j3"];
  const rotations = [2, 2, 2, 1, 1, 1, 1, 0, 0];
  cells.forEach((at, k) => put(s, at, types[k], 0, "arrow", rotations[k]));
  return cells.map((at, k) => ({ at, rotation: rotations[k] }));
}
export function placePath(s, cells, owner = 0) {
  return cells.map((at, k) => {
    const entry = k ? direction(at, cells[k - 1]) : (direction(at, cells[1]) + 2) % 4;
    const exit = k + 1 < cells.length ? direction(at, cells[k + 1]) : null;
    const types = k === 0 || exit === null ? TYPES.filter(t => t.kind === "fork") : TYPES.filter(t => t.kind !== "fork");
    for (const type of types) if (s.reserves[owner][type.id])
      for (let rotation = 0; rotation < 4; rotation++) {
        const port = ports({ type: type.id, rotation });
        if (port.entry === entry && (exit === null || port.exits.includes(exit))) {
          put(s, at, type.id, owner, "arrow", rotation);
          return { at, rotation };
        }
      }
    throw Error("Cannot fit fixture at " + at);
  });
}
