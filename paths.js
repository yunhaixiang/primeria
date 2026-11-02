import { ports } from "./engine.js?v=510a47bc24";
export function orientationsFor(type, entry, exit) {
  return [0, 1, 2, 3].filter((rotation) => {
    const p = ports({ type, rotation });
    return (
      (entry === null || p.entry === entry) &&
      (exit === null || p.exits.includes(exit))
    );
  });
}
