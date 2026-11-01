import { graph, isEndpoint, validateSegment } from "./engine.js?v=d746a55b94";
export function extendChallenge(board, path, at, owner) {
  const t = board[at];
  if (!t || t.owner !== owner || t.face !== "arrow") return path;
  if (path.at(-1) === at) return path.slice(0, -1);
  if (path.includes(at)) return path.slice(0, path.indexOf(at) + 1);
  const g = graph(board);
  if (!path.length) return isEndpoint(board, g, at) ? [at] : path;
  return g.out[path.at(-1)].includes(at) ? [...path, at] : path;
}
export function challengeReady(board, path, owner) {
  try {
    return { number: validateSegment(board, path, owner), error: null };
  } catch (e) {
    return { number: null, error: e.message };
  }
}
