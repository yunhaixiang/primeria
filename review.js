export { reviewPosition } from "./engine.js?v=d746a55b94";
export function gameResult(s) {
  if (!s.ended) return "";
  if (s.ended.winner === null) return "A drawn game";
  const name = s.names[s.ended.winner];
  return `${name} wins${s.ended.reason === "time" ? " on time" : s.ended.reason === "resign" ? " by resignation" : ""}`;
}
