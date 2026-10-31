import {
  TYPES,
  neighbor,
  direction,
  segments,
  total,
  validateMove,
  claimPreview,
  scores,
} from "./engine.js?v=78502c4ec6";
import { orientationsFor, orientPath } from "./paths.js?v=78502c4ec6";
export const BOT_LEVELS = {
  beginner: "Gentle",
  intermediate: "Thoughtful",
  advanced: "Deep",
};
/** Known elementary tests are always performed before budgeted trial division. */
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
function findClaim(state, budget) {
  const p = state.turn,
    board = state.board;
  let visited = 0,
    result = null;
  const starts = board
    .map((t, i) => (t?.owner === p && t.face === "digit" ? i : null))
    .filter((i) => i !== null);
  function walk(path) {
    if (++visited > budget || result) return;
    const oriented = orientPath(board, path, p);
    if (!oriented) return;
    if (path.length >= 2) {
      try {
        claimPreview(board, oriented, p);
        result = { type: "claim", tiles: oriented };
        return;
      } catch {}
    }
    if (path.length >= 12) return;
    const last = path.at(-1);
    for (let d = 0; d < 4; d++) {
      const j = neighbor(last, d);
      if (
        j !== null &&
        !path.includes(j) &&
        board[j]?.owner === p &&
        board[j].face === "digit"
      )
        walk([...path, j]);
    }
  }
  for (const i of starts) {
    walk([i]);
    if (result || visited > budget) break;
  }
  return { command: result, visited };
}
export function createBot({ seed = 1, strength = "intermediate" } = {}) {
  const rng = random(seed || 1);
  let plan = null;
  const budget =
    strength === "advanced" ? 16000 : strength === "beginner" ? 1800 : 7000;
  function legal(s, m) {
    try {
      validateMove(s, m);
      return true;
    } catch {
      return false;
    }
  }
  function planValid(s) {
    return (
      plan &&
      plan.owner === s.turn &&
      plan.tiles.every(
        (t) =>
          !s.board[t.at] ||
          (s.board[t.at].owner === s.turn &&
            s.board[t.at].type === t.type &&
            s.board[t.at].face === "digit"),
      )
    );
  }
  function makePlan(s) {
    const p = s.turn,
      candidates = [];
    let evaluated = 0;
    // Construct several legal routes, including bends, before choosing reserve tiles.
    for (let trial = 0; trial < 100; trial++) {
      const start = Math.floor(rng() * 225);
      if (s.board[start]) continue;
      const path = [start];
      let d = Math.floor(rng() * 4);
      for (let k = 1; k < 9; k++) {
        const directions = [d, (d + 1) % 4, (d + 3) % 4].sort(
          () => rng() - 0.5,
        );
        let chosen = null;
        for (const nextD of directions) {
          const at = neighbor(path.at(-1), nextD);
          if (at === null || s.board[at] || path.includes(at)) continue;
          // Keep room for bends and later branches; don't wind a route against itself.
          if (path.slice(0, -1).some((i) => direction(i, at) >= 0)) continue;
          chosen = { at, d: nextD };
          break;
        }
        if (!chosen) break;
        path.push(chosen.at);
        d = chosen.d;
      }
      if (path.length < 9) continue;
      const remaining = { ...s.reserves[p] },
        tiles = [];
      let okay = true;
      for (let k = 0; k < 9; k++) {
        const entry = k ? direction(path[k], path[k - 1]) : null,
          exit = k < 8 ? direction(path[k], path[k + 1]) : null;
        let options = TYPES.filter(
          (t) =>
            remaining[t.id] > 0 && orientationsFor(t.id, entry, exit).length,
        );
        // The units digit is read last; odd junctions avoid instant even/5 attacks.
        if (k === 0)
          options = options.filter((t) => [1, 3, 7, 9].includes(t.digit));
        if (k === 8) options = options.filter((t) => t.digit !== 0);
        if (!options.length) {
          okay = false;
          break;
        }
        const regular = options.filter((t) => t.id[0] === "r");
        if (regular.length) options = regular;
        const type = options[Math.floor(rng() * options.length)],
          rots = orientationsFor(type.id, entry, exit),
          rotation = rots[Math.floor(rng() * rots.length)];
        remaining[type.id]--;
        tiles.push({ at: path[k], type: type.id, rotation });
      }
      if (!okay) continue;
      const board = s.board.slice();
      tiles.forEach(
        (t, k) =>
          (board[t.at] = {
            id: 1000 + k,
            type: t.type,
            owner: p,
            face: "digit",
            rotation: 0,
          }),
      );
      let preview;
      try {
        preview = claimPreview(
          board,
          tiles.map((t) => ({ at: t.at, rotation: t.rotation })),
          p,
        );
      } catch {
        continue;
      }
      const threats = segments(preview.board, p, 300).map((x) =>
        findFactor(x.number, 250),
      );
      const closest =
        tiles.reduce(
          (n, t) =>
            n +
            Math.min(
              t.at % 15,
              14 - (t.at % 15),
              Math.floor(t.at / 15),
              14 - Math.floor(t.at / 15),
            ),
          0,
        ) / 9;
      const value =
        threats.filter(Boolean).length * -7 + closest * 0.05 + rng() * 2;
      candidates.push({ owner: p, tiles, value });
      evaluated++;
    }
    candidates.sort((a, b) => b.value - a.value);
    return { plan: candidates[0] ?? null, evaluated };
  }
  return {
    choose(s) {
      const p = s.turn,
        fee = TYPES.filter((t) => s.reserves[p][t.id] > 0).sort(
          (a, b) =>
            (a.id[0] === "j") - (b.id[0] === "j") ||
            Number([1, 3, 7, 9].includes(a.digit)) -
              Number([1, 3, 7, 9].includes(b.digit)),
        )[0]?.id;
      let scans = 0,
        best = null;
      if (fee)
        for (const seg of segments(s.board, 1 - p, 2500)) {
          scans++;
          const factor = findFactor(
            seg.number,
            strength === "advanced"
              ? 4000
              : strength === "beginner"
                ? 100
                : 1200,
          );
          if (!factor) continue;
          const command = { type: "challenge", fee, path: seg.path, factor };
          let after;
          try {
            after = validateMove(s, command);
          } catch {
            continue;
          }
          const old = scores(s),
            points = scores(after),
            value = points[p] - points[1 - p] - (old[p] - old[1 - p]);
          if (!best || value > best.value) best = { command, value };
        }
      if (best && best.value >= 1)
        return {
          command: best.command,
          analysis: { reason: "Verified capture", segments: scans, budget },
          seconds: 1,
        };
      if (planValid(s) && plan.tiles.every((t) => s.board[t.at])) {
        const command = {
          type: "claim",
          tiles: plan.tiles.map(({ at, rotation }) => ({ at, rotation })),
        };
        plan = null;
        if (legal(s, command))
          return {
            command,
            analysis: { reason: "Claim planned route", budget },
            seconds: 1,
          };
      }
      const claim = findClaim(s, budget);
      if (claim.command)
        return {
          command: claim.command,
          analysis: {
            reason: "Complete a legal path",
            nodes: claim.visited,
            budget,
          },
          seconds: 1,
        };
      if (!planValid(s)) plan = null;
      if (!plan) {
        const made = makePlan(s);
        plan = made.plan;
      }
      if (plan) {
        const remaining = plan.tiles.filter((t) => !s.board[t.at]);
        if (remaining.length) {
          const t = remaining[0],
            command = { type: "drop", tile: t.type, at: t.at };
          if (legal(s, command))
            return {
              command,
              analysis: { reason: "Develop a planned nine-tile route", budget },
              seconds: 1,
            };
          plan = null;
        } else {
          const command = {
            type: "claim",
            tiles: plan.tiles.map(({ at, rotation }) => ({ at, rotation })),
          };
          plan = null;
          if (legal(s, command))
            return {
              command,
              analysis: { reason: "Claim planned route", budget },
              seconds: 1,
            };
        }
      }
      if (best)
        return {
          command: best.command,
          analysis: { reason: "Verified capture", segments: scans, budget },
          seconds: 1,
        };
      // Do not scatter unclaimable reserve tiles: passing keeps unused tiles safe.
      return {
        command: { type: "pass" },
        analysis: {
          reason: total(s.reserves[p])
            ? "No worthwhile route found within the search budget"
            : "Reserve exhausted",
          budget,
        },
        seconds: 0.5,
      };
    },
  };
}
