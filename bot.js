import {
  TYPES,
  BOARD_CELLS,
  TYPE_MAP,
  neighbor,
  direction,
  ports,
  claimedGroups,
  homeReachability,
  segments,
  total,
  validateMove,
  scores,
  scoreBreakdown,
} from "./engine.js";
import { orientTree } from "./paths.js";
export const BOT_LEVELS = {
  beginner: "Gentle",
  intermediate: "Thoughtful",
  advanced: "Deep",
};
/** Elementary tests are compulsory, independent of the trial-division budget. */
export function findFactor(text, budget = 1200) {
  const n = BigInt(text);
  for (const p of [2n, 3n, 5n, 7n, 11n, 13n])
    if (n > p && n % p === 0n) return p.toString();
  let used = 0;
  for (let p = 17n; p * p <= n && used < budget; p += 2n, used++)
    if (n % p === 0n) return p.toString();
  return null;
}
function random(seed) {
  let x = seed | 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}
const around = (at) =>
  [0, 1, 2, 3].map((d) => neighbor(at, d)).filter((x) => x !== null);
/** Claimed groups of nine and captures score; smaller groups have future value. */
function evaluate(s, p) {
  const points = scores(s);
  let value = points[p] - points[1 - p];
  if (s.ended) return value;
  for (const group of claimedGroups(s.board))
    if (group.size < 9)
      value += (group.owner === p ? 1 : -1) * group.size * (0.3 + 0.06 * group.size);
  for (const t of s.board)
    if (t?.face === "digit") value += t.owner === p ? 0.15 : -0.15;
  return value;
}
/** Search connected subsets, including branches, rather than the first path. */
function claimCandidates(s, owner, limit, orientationBudget) {
  const starts = s.board.flatMap((t, at) =>
    t?.owner === owner && t.face === "digit" ? [at] : [],
  );
  const seen = new Set(),
    commands = [];
  for (const start of starts)
    for (const reverse of [false, true]) {
      const cells = [start],
        used = new Set(cells);
      for (let k = 0; k < cells.length && cells.length <= 14; k++) {
        const neighbors = around(cells[k]);
        if (reverse) neighbors.reverse();
        for (const at of neighbors)
          if (
            !used.has(at) &&
            s.board[at]?.owner === owner &&
            s.board[at].face === "digit"
          ) {
            cells.push(at);
            used.add(at);
          }
      }
      const sizes = [...new Set([cells.length, 2, 3, 4, 6, 9])].filter(
        (n) => n >= 2 && n <= cells.length,
      );
      for (const n of sizes) {
        const selected = cells.slice(0, n),
          key = [...selected].sort((a, b) => a - b).join(",");
        if (seen.has(key)) continue;
        seen.add(key);
        const tiles = orientTree(s.board, selected, owner, {
          budget: orientationBudget,
          rank: (preview) =>
            -segments(preview.board, owner)
              .filter(
                (seg) =>
                  seg.path.some((i) => used.has(i)) &&
                  findFactor(seg.number, 60),
              )
              .reduce((sum, seg) => sum + seg.path.length * 12, 0),
        });
        if (tiles) commands.push({ type: "claim", tiles });
        if (commands.length >= limit) return commands;
      }
    }
  return commands;
}
export function createBot({ seed = 1, strength = "intermediate" } = {}) {
  const rng = random(seed || 1),
    advanced = strength === "advanced",
    gentle = strength === "beginner";
  const budget = advanced ? 16000 : gentle ? 1800 : 7000;
  const trials = advanced ? 100 : gentle ? 24 : 55;
  const factorBudget = advanced ? 4000 : gentle ? 100 : 1200;
  let plan = null;
  function captureReply(s, owner, divisionBudget = factorBudget) {
    if (owner === s.turn && s.challengeUsed) return null;
    const view = { ...s, turn: owner, challengeUsed: false, challengeSucceeded: false };
    let best = null;
    for (const seg of segments(s.board, 1 - owner)) {
      const factor = findFactor(seg.number, divisionBudget);
      if (!factor) continue;
      const command = { type: "challenge", path: seg.path, factor };
      const after = validateMove(view, command);
      const value = evaluate(after, owner) - evaluate(s, owner);
      if (!best || value > best.value) best = { command, after, value };
    }
    return best;
  }
  function enclosureReply(s, owner) {
    const view = { ...s, turn: owner };
    let best = null;
    for (const command of claimCandidates(s, owner, gentle ? 4 : 12, 150)) {
      const after = validateMove(view, command);
      const value = evaluate(after, owner) - evaluate(s, owner);
      if (!best || value > best.value) best = { command, after, value };
    }
    return best;
  }
  function assessed(s, command, threatened = new Set(), deeper = false) {
    let after;
    try {
      after = validateMove(s, command);
    } catch {
      return null;
    }
    const p = s.turn;
    let value = evaluate(after, p) - evaluate(s, p);
    if (command.type === "claim") {
      value += command.tiles.filter((t) => threatened.has(t.at)).length * 1.1;
      const reply = captureReply(after, 1 - p, deeper ? factorBudget : 90);
      const enclosure = deeper ? enclosureReply(after, 1 - p) : null;
      value -= Math.max(0, reply?.value ?? 0, enclosure?.value ?? 0);
    }
    return { command, after, value };
  }
  function planValid(s) {
    if (!plan || plan.owner !== s.turn) return false;
    const remaining = { ...s.reserves[s.turn] };
    for (const t of plan.tiles) {
      const actual = s.board[t.at];
      if (actual) {
        if (
          actual.owner !== s.turn ||
          actual.face !== "digit" ||
          actual.type !== t.type
        )
          return false;
      } else if (--remaining[t.type] < 0)
        return false;
    }
    return true;
  }
  function planValue(s, tiles, dangerSquares) {
    const p = s.turn,
      future = {
        ...s,
        board: s.board.slice(),
        reserves: s.reserves.map((x) => ({ ...x })),
        nextId: s.nextId,
      };
    const drops = [];
    for (const t of tiles)
      if (!future.board[t.at]) {
        if (--future.reserves[p][t.type] < 0)
          return null;
        future.board[t.at] = {
          id: future.nextId++,
          type: t.type,
          owner: p,
          face: "digit",
          rotation: 0,
        };
        drops.push(t);
      }
    if (!drops.length) return null;
    const command = {
      type: "claim",
      tiles: tiles.map(({ at, rotation }) => ({ at, rotation })),
    };
    const assessment = assessed(future, command);
    if (!assessment) return null;
    // A development plan does not pretend the opponent skips intervening turns.
    const gain =
      evaluate(assessment.after, p) -
      evaluate(s, p) -
      Math.max(0, captureReply(assessment.after, 1 - p, 90)?.value ?? 0);
    const danger = drops.filter((t) => dangerSquares.has(t.at)).length;
    return { owner: p, tiles, value: gain / (drops.length + 1) - danger * 0.5 };
  }
  function makePlan(s, dangerSquares) {
    const p = s.turn,
      starts = [],
      attachments = [],
      available = (at) =>
        !s.board[at] ||
        (s.board[at].owner === p && s.board[at].face === "digit");
    for (let i = 0; i < BOARD_CELLS; i++)
      if (available(i)) {
        if (s.board[i]) starts.push(i, i);
        if (around(i).some((j) => s.board[j])) starts.push(i, i);
      }
    for (let i = 0; i < BOARD_CELLS; i++)
      if (s.board[i]?.owner === p && s.board[i].face === "arrow")
        for (const d of ports(s.board[i]).exits) {
          const at = neighbor(i, d);
          if (at !== null && available(at))
            attachments.push({ at, entry: (d + 2) % 4 });
        }
    let best = null;
    for (let trial = 0; trial < trials; trial++) {
      const attachment =
        trial % 2 === 0 && attachments.length
          ? attachments[Math.floor(rng() * attachments.length)]
          : null;
      const start =
        attachment?.at ??
        (trial % 4 && starts.length
          ? starts[Math.floor(rng() * starts.length)]
          : Math.floor(rng() * BOARD_CELLS));
      if (!available(start)) continue;
      const cells = [start],
        parents = [-1],
        wanted = 2 + Math.floor(rng() * 4);
      for (let k = 1; k < wanted; k++) {
        const candidates = [];
        for (let parent = 0; parent < cells.length; parent++)
          for (const at of around(cells[parent]))
            if (available(at) && !cells.includes(at))
              candidates.push({ at, parent });
        if (!candidates.length) break;
        const chosen = candidates[Math.floor(rng() * candidates.length)];
        cells.push(chosen.at);
        parents.push(chosen.parent);
      }
      if (cells.length < 2) continue;
      const remaining = { ...s.reserves[p] },
        tiles = [];
      for (let k = 0; k < cells.length; k++) {
        const at = cells[k],
          actual = s.board[at];
        const entry =
          parents[k] < 0
            ? (attachment?.entry ?? null)
            : direction(at, cells[parents[k]]);
        const exits = cells.flatMap((to, j) =>
          parents[j] === k ? [direction(at, to)] : [],
        );
        const options = [];
        for (const type of actual
          ? [TYPE_MAP[actual.type]]
          : TYPES.filter((t) => remaining[t.id] > 0))
          for (let rotation = 0; rotation < 4; rotation++) {
            const port = ports({ type: type.id, rotation });
            if (
              (entry !== null && port.entry !== entry) ||
              !exits.every((d) => port.exits.includes(d))
            )
              continue;
            if (k === 0 && ![1, 3, 7, 9].includes(type.digit)) {
              const before = neighbor(at, port.entry),
                old = before === null ? null : s.board[before];
              if (
                !(
                  old?.owner === p &&
                  old.face === "arrow" &&
                  ports(old).exits.includes((port.entry + 2) % 4)
                )
              )
                continue;
            }
            if (!exits.length && type.digit === 0) continue;
            options.push({ at, type: type.id, rotation });
            if (type.kind !== "fork")
              options.push({ at, type: type.id, rotation });
          }
        if (!options.length) break;
        const choice = options[Math.floor(rng() * options.length)];
        if (!actual) remaining[choice.type]--;
        tiles.push(choice);
      }
      if (tiles.length !== cells.length) continue;
      const candidate = planValue(s, tiles, dangerSquares);
      if (candidate && (!best || candidate.value > best.value))
        best = candidate;
    }
    return best;
  }
  return {
    choose(s) {
      const p = s.turn;
      const challenge = captureReply(s, p);
      if (challenge?.value > 0) return {
        command: challenge.command,
        analysis: { reason: "Verified capture before the move", budget, value: challenge.value },
        seconds: 1,
      };
      const enemyClaims = claimCandidates(s, 1 - p, gentle ? 4 : 12, 200);
      const threatened = new Set(),
        dangerSquares = new Set();
      for (const c of enemyClaims) {
        const enemy = validateMove({ ...s, turn: 1 - p }, c);
        for (const hit of enemy.history.at(-1).enclosureCaptures ?? [])
          if (hit.by === 1 - p) threatened.add(hit.at);
        const escape = homeReachability(enemy.board, p);
        escape.forEach((reachable, at) => { if (!reachable) dangerSquares.add(at); });
      }
      const candidates = [],
        capture = captureReply(s, p);
      if (capture) candidates.push({ ...capture, reason: "Verified capture" });
      const claims = claimCandidates(
        s,
        p,
        gentle ? 12 : advanced ? 55 : 30,
        gentle ? 150 : 700,
      );
      if (planValid(s)) {
        const ready = plan.tiles.filter((t) => s.board[t.at]);
        if (ready.length >= 2)
          claims.push({
            type: "claim",
            tiles: ready.map(({ at, rotation }) => ({ at, rotation })),
          });
      }
      for (const command of claims) {
        const candidate = assessed(s, command, threatened);
        if (candidate)
          candidates.push({
            ...candidate,
            reason: candidate.after.history.at(-1).enclosureCaptures?.length
              ? "Enclose unfinished enemy construction"
              : scoreBreakdown(candidate.after)[p].eligible > scoreBreakdown(s)[p].eligible
                  ? "Grow a scoring group"
                  : "Grow a connected group",
          });
      }
      candidates.sort((a, b) => b.value - a.value);
      const checked = [];
      for (const candidate of candidates.slice(0, 8)) {
        if (candidate.command.type === "claim")
          candidate.value = assessed(
            s,
            candidate.command,
            threatened,
            true,
          ).value;
        checked.push(candidate);
      }
      checked.sort((a, b) => b.value - a.value);
      if (!planValid(s)) plan = null;
      if (plan) plan = planValue(s, plan.tiles, dangerSquares);
      const alternative = makePlan(s, dangerSquares);
      if (alternative && (!plan || alternative.value > plan.value + 0.3))
        plan = alternative;
      const best = checked[0];
      if (best && best.value > 0.01 && (!plan || best.value >= plan.value)) {
        if (best.command.type === "claim") plan = null;
        return {
          command: best.command,
          analysis: {
            reason: best.reason,
            budget,
            value: Number(best.value.toFixed(3)),
          },
          seconds: 1,
        };
      }
      if (plan && plan.value > 0.01) {
        const missing = plan.tiles.filter((t) => !s.board[t.at]);
        missing.sort(
          (a, b) =>
            around(b.at).filter((i) => s.board[i]?.owner === 1 - p).length -
            around(a.at).filter((i) => s.board[i]?.owner === 1 - p).length,
        );
        if (missing.length) {
          const t = missing[0],
            command = { type: "drop", tile: t.type, at: t.at },
            after = validateMove(s, command);
          if (after.board[t.at])
            return {
              command,
              analysis: {
                reason: "Develop a connected claim",
                budget,
                plannedTiles: plan.tiles.length,
              },
              seconds: 1,
            };
        }
      }
      if (best && best.value > 0.01)
        return {
          command: best.command,
          analysis: { reason: best.reason, budget },
          seconds: 1,
        };
      return {
        command: { type: "pass" },
        analysis: {
          reason: total(s.reserves[p])
            ? "No beneficial move found within the search budget"
            : "Reserve exhausted",
          budget,
        },
        seconds: 0.5,
      };
    },
  };
}
