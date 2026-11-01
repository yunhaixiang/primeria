import { direction, ports } from "../engine.js";
export function put(s, at, type, owner = 0, face = "digit", rotation = 0) {
  if (!s.reserves[owner][type]) throw Error("Fixture exhausted " + type);
  s.reserves[owner][type]--;
  s.board[at] = { id: s.nextId++, type, owner, face, rotation };
}
export function topPocket(s, claimedCount = 0) {
  const cells = [3, 16, 29, 30, 31, 32, 33, 20, 7];
  const types = ["j1", "r2", "r0", "r4", "r6", "r8", "r0", "r2", "j3"];
  const rotations = [2, 2, 2, 1, 1, 1, 1, 0, 0];
  cells.forEach((at, k) => put(s, at, types[k], 0, k < claimedCount ? "arrow" : "digit", rotations[k]));
  return cells.map((at, k) => ({ at, rotation: rotations[k] }));
}
export function placePath(s, cells, owner = 0, claimed = true) {
  return cells.map((at, k) => {
    const entry = k ? direction(at, cells[k - 1]) : (direction(at, cells[1]) + 2) % 4;
    const exit = k + 1 < cells.length ? direction(at, cells[k + 1]) : null;
    const types = k === 0 || exit === null ? ["j1", "j3", "j7", "j9"] : ["r2", "r4", "r6", "r8", "r5", "r0", "j1", "j3", "j7", "j9"];
    for (const type of types)
      if (s.reserves[owner][type])
        for (let rotation = 0; rotation < 4; rotation++) {
          const port = ports({ type, rotation });
          if (port.entry === entry && (exit === null || port.exits.includes(exit))) {
            put(s, at, type, owner, claimed ? "arrow" : "digit", rotation);
            return { at, rotation };
          }
        }
    throw Error("Cannot fit fixture at " + at);
  });
}
