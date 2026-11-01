import { ports } from "./engine.js?v=b0fb62c34b";
export function orientationsFor(type, entry, exit) {
  return [0, 1, 2, 3].filter((rotation) => {
    const p = ports({ type, rotation });
    return (
      (entry === null || p.entry === entry) &&
      (exit === null || p.exits.includes(exit))
    );
  });
}
