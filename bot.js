import {
  TYPES, BOARD_CELLS, TYPE_MAP, neighbor, graph, hasCycle, scoringTiles,
  claimedGroups, segments, total, validateMove, scores,
} from "./engine.js";
export const BOT_LEVELS = { beginner: "Gentle", intermediate: "Thoughtful", advanced: "Deep" };
/** Elementary tests are compulsory, independent of the trial-division budget. */
export function findFactor(text, budget = 1200) {
  const n = BigInt(text);
  for (const p of [2n, 3n, 5n, 7n, 11n, 13n])
    if (n > p && n % p === 0n) return p.toString();
  for (let p = 17n, used = 0; p * p <= n && used < budget; p += 2n, used++)
    if (n % p === 0n) return p.toString();
  return null;
}
function random(seed) {
  let x = seed | 0;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
}
const around = at => [0, 1, 2, 3].map(d => neighbor(at, d)).filter(i => i !== null);
/** Estimate endgame scoring after regular-tile and small-group cleanup. */
function evaluate(s, p) {
  const points = scores(s);
  let value = points[p] - points[1 - p];
  if (s.ended) return value;
  const g = graph(s.board), complete = scoringTiles(s.board, g);
  for (const group of claimedGroups(s.board, g))
    if (group.size < 9) value += (group.owner === p ? 1 : -1) * group.size * (0.25 + 0.06 * group.size);
  for (let i = 0; i < BOARD_CELLS; i++) if (s.board[i]) {
    const sign = s.board[i].owner === p ? 1 : -1;
    if (!complete.has(i)) value += sign * (0.06 + 0.18 * g.degree(i));
  }
  return value;
}
export function createBot({ seed = 1, strength = "intermediate" } = {}) {
  const rng = random(seed || 1), advanced = strength === "advanced", gentle = strength === "beginner";
  const width = advanced ? 24 : gentle ? 8 : 16, factorBudget = advanced ? 4000 : gentle ? 100 : 1200;
  const budget = width * TYPES.length * 4;
  function bestCapture(s, p, divisionBudget = factorBudget) {
    if (s.challengeUsed && s.turn === p) return null;
    const view = { ...s, turn: p, challengeUsed: false, challengeSucceeded: false };
    let best = null;
    for (const seg of segments(s.board, 1 - p)) {
      const factor = findFactor(seg.number, divisionBudget);
      if (!factor) continue;
      const command = { type: "challenge", path: seg.path, factor }, after = validateMove(view, command);
      const value = evaluate(after, p) - evaluate(s, p);
      if (!best || value > best.value) best = { command, after, value };
    }
    return best;
  }
  function drops(s, p, count = width) {
    const positions = s.board.flatMap((t, at) => t ? [] : [{ at, priority:
      around(at).reduce((n, j) => n + (s.board[j]?.owner === p ? 3 : s.board[j] ? 0.25 : 0), 0) + rng() * 0.2
    }]).sort((a, b) => b.priority - a.priority).slice(0, count);
    const baseline = evaluate(s, p), result = [];
    for (const { at } of positions)
      for (const type of TYPES) if (s.reserves[p][type.id])
        for (let rotation = 0; rotation < 4; rotation++) {
          const board = s.board.slice();
          board[at] = { id: s.nextId, type: type.id, owner: p, face: "arrow", rotation };
          const connections = graph(board);
          if (type.kind === "fork" && connections.degree(at) === 0) continue;
          if (hasCycle(connections)) continue;
          const future = { ...s, board };
          result.push({ command: { type: "drop", at, tile: type.id, rotation }, value: evaluate(future, p) - baseline, future });
        }
    return result.sort((a, b) => b.value - a.value);
  }
  return { choose(s) {
    const p = s.turn, capture = bestCapture(s, p);
    if (capture && capture.value > 0) return {
      command: capture.command, analysis: { reason: "Capture a verified composite segment", budget, value: capture.value }, seconds: 1,
    };
    const candidates = drops(s, p), checked = [];
    // Every candidate faces an immediate arithmetic reply. A small-prime test is
    // never omitted merely because the positional search budget was exhausted.
    for (const candidate of candidates) {
      if (checked.length >= (advanced ? 12 : gentle ? 3 : 6)) break;
      const ownSegments = segments(candidate.future.board, p).filter(seg => seg.path.includes(candidate.command.at));
      const unsafe = ownSegments.some(seg => findFactor(seg.number, factorBudget));
      if (unsafe) continue;
      const after = validateMove(s, candidate.command);
      let value = candidate.value;
      const reply = bestCapture(after, 1 - p, factorBudget);
      value -= Math.max(0, reply?.value ?? 0);
      if (advanced) {
        const next = drops({ ...after, turn: p }, p, 5).slice(0, 12).find(c =>
          !segments(c.future.board, p).some(seg => seg.path.includes(c.command.at) && findFactor(seg.number, 90)));
        if (next) value += Math.min(2, Math.max(0, next.value)) * 0.35;
      }
      checked.push({ ...candidate, value });
    }
    checked.sort((a, b) => b.value - a.value);
    const best = checked[0], pass = validateMove(s, { type: "pass" });
    if (best && best.value > 0.01 && (!pass.ended || evaluate(pass, p) < evaluate(best.future, p)))
      return { command: best.command, analysis: {
        reason: "Develop a completed path without exposing a known composite", budget, value: Number(best.value.toFixed(3)),
      }, seconds: 1 };
    return { command: { type: "pass" }, analysis: {
      reason: total(s.reserves[p]) ? "No safe beneficial placement found within the budget" : "Reserve exhausted", budget,
    }, seconds: 0.5 };
  } };
}
