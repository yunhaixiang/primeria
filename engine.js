/** Primeria's owned-tile rules. Directions: north, east, south, west. */
export const RULES_VERSION = 24;
export const MIN_SCORING_GROUP = 9;
export const BOARD_SIZE = 15;
export const BOARD_CELLS = 225;
export const MODES = {
  blitz: [600, 10],
  rapid: [1200, 20],
  standard: [1800, 30],
  classical: [2700, 60],
  casual: [null, 0],
};
export const TYPES = [
  {
    id: "r0",
    digit: 0,
    kind: "left",
    exits: [3],
    count: 5,
    label: "Left bend",
  },
  {
    id: "j1",
    digit: 1,
    kind: "fork",
    exits: [0, 3, 1],
    count: 7,
    label: "Three-way fork",
  },
  {
    id: "r2",
    digit: 2,
    kind: "straight",
    exits: [0],
    count: 5,
    label: "Straight",
  },
  {
    id: "j3",
    digit: 3,
    kind: "fork",
    exits: [0, 3],
    count: 7,
    label: "Straight + left",
  },
  {
    id: "r4",
    digit: 4,
    kind: "straight",
    exits: [0],
    count: 5,
    label: "Straight",
  },
  {
    id: "r5",
    digit: 5,
    kind: "right",
    exits: [1],
    count: 5,
    label: "Right bend",
  },
  {
    id: "r6",
    digit: 6,
    kind: "straight",
    exits: [0],
    count: 5,
    label: "Straight",
  },
  {
    id: "j7",
    digit: 7,
    kind: "fork",
    exits: [0, 1],
    count: 7,
    label: "Straight + right",
  },
  {
    id: "r8",
    digit: 8,
    kind: "straight",
    exits: [0],
    count: 5,
    label: "Straight",
  },
  {
    id: "j9",
    digit: 9,
    kind: "fork",
    exits: [3, 1],
    count: 7,
    label: "Left + right",
  },
];
export const TILES_PER_PLAYER = TYPES.reduce((n, type) => n + type.count, 0);
const FACTOR_PATTERN = new RegExp(`^\\d{1,${TILES_PER_PLAYER}}$`);
const NUMBER_PATTERN = new RegExp(`^[1-9]\\d{1,${TILES_PER_PLAYER - 1}}$`);
export const TYPE_MAP = Object.fromEntries(TYPES.map((t) => [t.id, t]));
export const total = (counts) =>
  Object.values(counts).reduce((a, b) => a + b, 0);
export const inventory = () =>
  Object.fromEntries(TYPES.map((t) => [t.id, t.count]));
export const clone = (x) => structuredClone(x);
export const coordinate = (i) =>
  `${String.fromCharCode(65 + (i % 15))}${Math.floor(i / 15) + 1}`;
export function neighbor(i, d) {
  const r = Math.floor(i / 15),
    c = i % 15;
  return d === 0
    ? r
      ? i - 15
      : null
    : d === 1
      ? c < 14
        ? i + 1
        : null
      : d === 2
        ? r < 14
          ? i + 15
          : null
        : c
          ? i - 1
          : null;
}
export function direction(a, b) {
  for (let d = 0; d < 4; d++) if (neighbor(a, d) === b) return d;
  return -1;
}
export function ports(tile) {
  const t = TYPE_MAP[tile.type],
    r = tile.rotation ?? 0;
  return { entry: (2 + r) % 4, exits: t.exits.map((d) => (d + r) % 4) };
}
export function graph(board) {
  const out = Array.from({ length: 225 }, () => []),
    incoming = Array.from({ length: 225 }, () => []);
  for (let i = 0; i < 225; i++) {
    const t = board[i];
    if (!t || t.face !== "arrow") continue;
    for (const d of ports(t).exits) {
      const j = neighbor(i, d),
        n = j === null ? null : board[j];
      if (
        n?.face === "arrow" &&
        n.owner === t.owner &&
        ports(n).entry === (d + 2) % 4
      ) {
        out[i].push(j);
        incoming[j].push(i);
      }
    }
  }
  return { out, incoming, degree: (i) => out[i].length + incoming[i].length };
}
export function hasCycle(g) {
  const color = new Uint8Array(225);
  function visit(i) {
    if (color[i] === 1) return true;
    if (color[i] === 2) return false;
    color[i] = 1;
    for (const j of g.out[i]) if (visit(j)) return true;
    color[i] = 2;
    return false;
  }
  return g.out.some((_, i) => visit(i));
}
/** Claimed groups use matching arrows, in either direction, never mere contact. */
export function claimedGroups(board, g = graph(board)) {
  const seen = new Set(),
    groups = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i]?.face !== "arrow" || seen.has(i)) continue;
    const tiles = [i];
    seen.add(i);
    for (let k = 0; k < tiles.length; k++)
      for (const j of [...g.out[tiles[k]], ...g.incoming[tiles[k]]])
        if (!seen.has(j)) {
          seen.add(j);
          tiles.push(j);
        }
    groups.push({ owner: board[i].owner, tiles, size: tiles.length });
  }
  return groups;
}
export const isEndpoint = (board, g, i) =>
  !!board[i] && (TYPE_MAP[board[i].type].kind === "fork" || g.degree(i) === 1);
export function validatePath(board, path, owner, g = graph(board)) {
  if (
    !Array.isArray(path) ||
    path.length < 2 ||
    path.length > TILES_PER_PLAYER ||
    new Set(path).size !== path.length
  )
    throw Error("Select a path of at least two different tiles.");
  for (let k = 0; k < path.length; k++) {
    const i = path[k];
    if (
      !Number.isInteger(i) ||
      !board[i] ||
      board[i].owner !== owner ||
      board[i].face !== "arrow"
    )
      throw Error("Choose connected arrow tiles of the same player.");
    if (k && !g.out[path[k - 1]].includes(i))
      throw Error("Follow the arrow from one tile into the next.");
  }
  return true;
}
export function segmentNumber(board, path) {
  return path
    .slice()
    .reverse()
    .map((i) => TYPE_MAP[board[i].type].digit)
    .join("");
}
/** Numbers are read against the arrows: an exposed arrowhead is the leading end. */
export const isLeadingZero = (board, g, i) =>
  board[i]?.face === "arrow" &&
  TYPE_MAP[board[i].type].digit === 0 &&
  g.out[i].length === 0;
export function validateSegment(board, path, owner) {
  const g = graph(board);
  validatePath(board, path, owner, g);
  if (!isEndpoint(board, g, path[0]) || !isEndpoint(board, g, path.at(-1)))
    throw Error("A segment must start and end at a junction or an end tile.");
  const number = segmentNumber(board, path);
  if (number[0] === "0")
    throw Error("No Leading Zero Rule: a number cannot start with 0.");
  return number;
}
/** Enumerate actual directed segments, with a cap for bounded bot/UI search. */
export function segments(board, owner, limit = 2000) {
  const g = graph(board),
    result = [];
  for (let i = 0; i < 225 && result.length < limit; i++) {
    if (
      board[i]?.owner !== owner ||
      board[i].face !== "arrow" ||
      !isEndpoint(board, g, i)
    )
      continue;
    const walk = (path) => {
      if (result.length >= limit) return;
      const end = path.at(-1);
      if (
        path.length > 1 &&
        isEndpoint(board, g, end) &&
        TYPE_MAP[board[end].type].digit !== 0
      )
        result.push({ path: [...path], number: segmentNumber(board, path) });
      for (const j of g.out[end]) if (!path.includes(j)) walk([...path, j]);
    };
    walk([i]);
  }
  return result;
}
export function claimPreview(board, tiles, owner) {
  if (
    !Array.isArray(tiles) ||
    tiles.length < 2 ||
    tiles.length > TILES_PER_PLAYER ||
    new Set(tiles.map((t) => t.at)).size !== tiles.length
  )
    throw Error(
      "Choose at least two of your unclaimed tiles to form a connected network.",
    );
  const next = board.slice();
  for (const p of tiles) {
    const t = board[p.at];
    if (
      !Number.isInteger(p.at) ||
      !t ||
      t.owner !== owner ||
      t.face !== "digit"
    )
      throw Error("Only your unclaimed tiles can be flipped.");
    if (!Number.isInteger(p.rotation) || p.rotation < 0 || p.rotation > 3)
      throw Error("Choose a tile orientation.");
    next[p.at] = { ...t, face: "arrow", rotation: p.rotation };
  }
  const g = graph(next);
  const selected = new Set(tiles.map((t) => t.at)),
    reached = new Set([tiles[0].at]);
  const pending = [tiles[0].at];
  for (let k = 0; k < pending.length; k++)
    for (const j of [...g.out[pending[k]], ...g.incoming[pending[k]]])
      if (selected.has(j) && !reached.has(j)) {
        reached.add(j);
        pending.push(j);
      }
  if (reached.size !== selected.size)
    throw Error(
      "The newly flipped tiles must form one connected network of arrows.",
    );
  if (hasCycle(g)) throw Error("This claim would create an arrow cycle.");
  if (next.some((_, i) => isLeadingZero(next, g, i)))
    throw Error("No Leading Zero Rule: a claim cannot leave a leading 0.");
  const group = claimedGroups(next, g).find((x) =>
    x.tiles.includes(tiles[0].at),
  );
  // A branching claim has several numbers; never concatenate its selection order.
  const roots = tiles.filter(
    (t) => !g.incoming[t.at].some((j) => selected.has(j)),
  );
  const ordered = roots.length === 1 ? [roots[0].at] : [];
  while (ordered.length) {
    const children = g.out[ordered.at(-1)].filter((j) => selected.has(j));
    if (children.length !== 1) break;
    ordered.push(children[0]);
  }
  return {
    board: next,
    length: group.size,
    number:
      ordered.length === tiles.length ? segmentNumber(next, ordered) : null,
  };
}
export function scoreBreakdown(s) {
  const groups = claimedGroups(s.board);
  return [0, 1].map((p) => {
    const own = groups.filter((x) => x.owner === p);
    const scoring = own
      .filter((x) => x.size >= MIN_SCORING_GROUP)
      .reduce((n, x) => n + x.size, 0);
    const growing = own
      .filter((x) => x.size < MIN_SCORING_GROUP)
      .reduce((n, x) => n + x.size, 0);
    return {
      scoring,
      growing,
      captured: s.captured[p].length,
      groups: own.map((x) => x.size),
      total: scoring + s.captured[p].length,
    };
  });
}
export function scores(s) {
  return scoreBreakdown(s).map((x) => x.total);
}
export function newGame(
  { mode = "standard", names = ["Blue", "Orange"], first = 0, bot = null } = {},
  now = Date.now(),
) {
  if (!Object.hasOwn(MODES, mode) || ![0, 1].includes(first))
    throw Error("Choose a time control and first player.");
  return {
    rulesVersion: RULES_VERSION,
    boardSize: 15,
    board: Array(225).fill(null),
    reserves: [inventory(), inventory()],
    captured: [[], []],
    names: names.map(
      (n, i) =>
        String(n ?? "")
          .trim()
          .slice(0, 24) || ["Blue", "Orange"][i],
    ),
    mode,
    turn: first,
    clocks: [MODES[mode][0], MODES[mode][0]],
    increment: MODES[mode][1],
    started: false,
    paused: false,
    lastTick: now,
    ended: null,
    passCount: 0,
    history: [],
    revision: 0,
    nextId: 1,
    bot,
  };
}
export function tick(s, now = Date.now()) {
  if (!s.started || s.paused || s.ended) {
    s.lastTick = now;
    return;
  }
  const delta = Math.max(0, now - s.lastTick) / 1000;
  s.lastTick = now;
  if (s.clocks[s.turn] !== null) {
    s.clocks[s.turn] = Math.max(0, s.clocks[s.turn] - delta);
    if (s.clocks[s.turn] === 0) {
      s.ended = { winner: 1 - s.turn, reason: "time", scores: scores(s) };
      s.revision++;
    }
  }
}
/** The opening countdown starts neither player's clock until it finishes. */
export function beginGameCountdown(s, now = Date.now()) {
  if (s.started || s.ended || s.startCountdown)
    throw Error("The game has already started.");
  s.startCountdown = { finishAt: now + 3000 };
  s.paused = false;
  s.lastTick = now;
  s.revision++;
}
export function finishGameCountdown(s, now = Date.now()) {
  if (!s.startCountdown || now < s.startCountdown.finishAt) return false;
  const start = s.startCountdown.finishAt;
  delete s.startCountdown;
  s.started = true;
  s.paused = false;
  s.lastTick = start;
  s.revision++;
  tick(s, now);
  return true;
}
export function setRunning(s, running, now = Date.now()) {
  if (s.startCountdown) throw Error("The game is starting.");
  if (typeof running !== "boolean") throw Error("Choose start or pause.");
  tick(s, now);
  if (s.ended) throw Error("The game has ended.");
  s.started = true;
  s.paused = !running;
  s.lastTick = now;
  s.revision++;
}
function capture(s, at, by) {
  const t = s.board[at];
  s.captured[by].push({ ...t, at });
  s.board[at] = null;
}
export function validateMove(s, move) {
  const draft = clone(s);
  draft.started = true;
  draft.paused = false;
  draft.clocks = [null, null];
  applyMove(draft, move, 0);
  return draft;
}
export function applyMove(s, move, now = Date.now()) {
  if (!s.started || s.paused || s.ended)
    throw Error("Start or resume the game first.");
  tick(s, now);
  if (s.ended) throw Error("Your clock has run out.");
  const n = clone(s),
    p = s.turn;
  let detail = {};
  if (!move || typeof move !== "object") throw Error("Choose a move.");
  const take = (type) => {
    if (
      typeof type !== "string" ||
      !Object.hasOwn(TYPE_MAP, type) ||
      !Number.isInteger(n.reserves[p][type]) ||
      n.reserves[p][type] < 1
    )
      throw Error("That tile is not available in your reserve.");
    n.reserves[p][type]--;
    return { id: n.nextId++, type, owner: p, face: "digit", rotation: 0 };
  };
  if (move.type === "drop") {
    if (
      !Number.isInteger(move.at) ||
      move.at < 0 ||
      move.at >= 225 ||
      n.board[move.at]
    )
      throw Error("Choose an empty square.");
    n.board[move.at] = take(move.tile);
    detail = { at: move.at, tile: move.tile };
  } else if (move.type === "claim") {
    const result = claimPreview(n.board, move.tiles, p);
    n.board = result.board;
    detail = {
      tiles: clone(move.tiles),
      length: result.length,
      number: result.number,
    };
  } else if (move.type === "challenge") {
    const number = validateSegment(n.board, move.path, 1 - p);
    if (typeof move.factor !== "string" || !FACTOR_PATTERN.test(move.factor))
      throw Error("Enter a positive whole-number factor.");
    const factor = BigInt(move.factor),
      value = BigInt(number);
    if (factor <= 1n || factor >= value)
      throw Error(
        "The factor must be greater than 1 and smaller than the number.",
      );
    const fee = take(move.fee);
    n.captured[1 - p].push(fee);
    const success = value % factor === 0n,
      removed = [];
    if (success) {
      for (const at of move.path) {
        removed.push(at);
        capture(n, at, p);
      }
      // Removing a leading zero can expose another zero or isolate an arrow.
      for (;;) {
        const g = graph(n.board);
        const cleanup = n.board.flatMap((tile, at) =>
          tile?.face === "arrow" &&
          (g.degree(at) === 0 || isLeadingZero(n.board, g, at))
            ? [at]
            : [],
        );
        if (!cleanup.length) break;
        for (const at of cleanup) {
          removed.push(at);
          capture(n, at, 1 - n.board[at].owner);
        }
      }
    }
    detail = {
      path: [...move.path],
      number,
      factor: factor.toString(),
      fee: move.fee,
      success,
      removed,
    };
  } else if (move.type === "pass") {
  } else throw Error("Choose Drop, Claim, Challenge or Pass.");
  const adjacentCaptures = [];
  if (move.type === "claim") {
    const targets = new Set();
    for (const { at } of move.tiles)
      for (const d of [0, 1, 2, 3]) {
        const target = neighbor(at, d),
          tile = target === null ? null : n.board[target];
        if (tile?.face === "digit" && tile.owner !== p) targets.add(target);
      }
    for (const at of targets) adjacentCaptures.push({ at, by: p });
  }
  for (const { at, by } of adjacentCaptures) capture(n, at, by);
  if (adjacentCaptures.length) detail.adjacentCaptures = adjacentCaptures;
  n.passCount = move.type === "pass" ? n.passCount + 1 : 0;
  if (n.passCount === 2) {
    const unclaimed = [];
    for (let at = 0; at < 225; at++)
      if (n.board[at]?.face === "digit") {
        unclaimed.push(at);
        capture(n, at, 1 - n.board[at].owner);
      }
    const points = scores(n);
    n.ended = {
      winner: points[0] === points[1] ? null : points[0] > points[1] ? 0 : 1,
      reason: "passes",
      scores: points,
    };
    detail.unclaimed = unclaimed;
  }
  if (n.clocks[p] !== null) n.clocks[p] += n.increment;
  n.turn = 1 - p;
  n.lastTick = now;
  n.revision++;
  const event = {
    player: p,
    type: move.type,
    ...detail,
    command: clone(move),
    clocks: [...n.clocks],
    scores: scores(n),
  };
  n.history.push(event);
  Object.assign(s, n);
  return event;
}
export function resign(s, player, now = Date.now()) {
  tick(s, now);
  if (s.ended) return;
  s.ended = { winner: 1 - player, reason: "resign", scores: scores(s) };
  s.revision++;
}
export function reviewPosition(s, count) {
  const first = s.history[0]?.player ?? s.turn,
    r = newGame({ mode: s.mode, names: s.names, first }, 0);
  r.started = true;
  r.clocks = [null, null];
  for (const e of s.history.slice(0, count)) {
    applyMove(r, e.command, 0);
    r.clocks = [null, null];
  }
  r.clocks = count
    ? s.history[count - 1].clocks
    : [...newGame({ mode: s.mode }).clocks];
  return r;
}
/** Reject incompatible saves and malformed network snapshots before rendering. */
export function isSupportedState(s) {
  try {
    if (
      s?.rulesVersion !== RULES_VERSION ||
      s.boardSize !== 15 ||
      !Array.isArray(s.board) ||
      s.board.length !== 225 ||
      ![0, 1].includes(s.turn) ||
      !Object.hasOwn(MODES, s.mode) ||
      !Number.isInteger(s.revision) ||
      s.revision < 0 ||
      !Array.isArray(s.history) ||
      s.history.length > 500 ||
      typeof s.started !== "boolean" ||
      typeof s.paused !== "boolean" ||
      !Array.isArray(s.names) ||
      s.names.length !== 2 ||
      !s.names.every((n) => typeof n === "string" && n.length <= 24) ||
      !Array.isArray(s.clocks) ||
      s.clocks.length !== 2 ||
      !s.clocks.every((c) => c === null || (Number.isFinite(c) && c >= 0)) ||
      s.increment !== MODES[s.mode][1]
    )
      return false;
    if (
      !Array.isArray(s.reserves) ||
      s.reserves.length !== 2 ||
      !Array.isArray(s.captured) ||
      s.captured.length !== 2 ||
      ![0, 1, 2].includes(s.passCount) ||
      !Number.isInteger(s.nextId) ||
      s.nextId < 1 ||
      !Number.isFinite(s.lastTick)
    )
      return false;
    if (
      s.startCountdown &&
      (s.started || s.ended || !Number.isFinite(s.startCountdown.finishAt))
    )
      return false;
    let count = 0;
    const ids = new Set();
    const validTile = (t) => {
      if (
        !t ||
        typeof t.type !== "string" ||
        !Object.hasOwn(TYPE_MAP, t.type) ||
        ![0, 1].includes(t.owner) ||
        !["digit", "arrow"].includes(t.face) ||
        !Number.isInteger(t.rotation) ||
        t.rotation < 0 ||
        t.rotation > 3 ||
        !Number.isInteger(t.id) ||
        t.id < 1 ||
        ids.has(t.id) ||
        t.id >= s.nextId
      )
        return false;
      ids.add(t.id);
      count++;
      return true;
    };
    const supplies = [inventory(), inventory()];
    for (const t of s.board)
      if (t) {
        if (!validTile(t)) return false;
        supplies[t.owner][t.type]--;
      }
    for (let p = 0; p < 2; p++) {
      if (!s.captured[p].every((t) => validTile(t) && t.owner === 1 - p))
        return false;
      for (const t of s.captured[p]) supplies[t.owner][t.type]--;
    }
    for (let p = 0; p < 2; p++) {
      for (const type of TYPES) {
        const n = s.reserves[p][type.id];
        if (
          !Number.isInteger(n) ||
          n < 0 ||
          n > type.count ||
          n !== supplies[p][type.id]
        )
          return false;
      }
    }
    if (count > TILES_PER_PLAYER * 2 || s.nextId !== count + 1) return false;
    if (
      s.ended &&
      (!["passes", "time", "resign"].includes(s.ended.reason) ||
        ![0, 1, null].includes(s.ended.winner) ||
        !Array.isArray(s.ended.scores) ||
        s.ended.scores.length !== 2 ||
        !s.ended.scores.every(
          (n) => Number.isInteger(n) && n >= 0 && n <= TILES_PER_PLAYER * 2,
        ))
    )
      return false;
    const validCells = (cells) =>
      Array.isArray(cells) &&
      cells.length <= TILES_PER_PLAYER &&
      cells.every((i) => Number.isInteger(i) && i >= 0 && i < 225);
    const validRotations = (cells) =>
      Array.isArray(cells) &&
      cells.length >= 2 &&
      cells.length <= TILES_PER_PLAYER &&
      cells.every(
        (t) =>
          Number.isInteger(t.at) &&
          t.at >= 0 &&
          t.at < 225 &&
          Number.isInteger(t.rotation) &&
          t.rotation >= 0 &&
          t.rotation < 4,
      );
    for (const e of s.history) {
      if (
        ![0, 1].includes(e.player) ||
        !e.command ||
        e.command.type !== e.type ||
        !Array.isArray(e.clocks) ||
        e.clocks.length !== 2 ||
        !e.clocks.every((n) => n === null || (Number.isFinite(n) && n >= 0))
      )
        return false;
      if (e.type === "drop") {
        if (
          !Object.hasOwn(TYPE_MAP, e.tile) ||
          !Number.isInteger(e.at) ||
          e.at < 0 ||
          e.at >= 225 ||
          e.command.at !== e.at ||
          e.command.tile !== e.tile
        )
          return false;
      } else if (e.type === "claim") {
        if (
          !validRotations(e.tiles) ||
          !validRotations(e.command.tiles) ||
          !Number.isInteger(e.length) ||
          e.length < 2 ||
          e.length > TILES_PER_PLAYER
        )
          return false;
      } else if (e.type === "challenge") {
        if (
          !validCells(e.path) ||
          e.path.length < 2 ||
          !validCells(e.removed) ||
          !Object.hasOwn(TYPE_MAP, e.fee) ||
          typeof e.success !== "boolean" ||
          typeof e.number !== "string" ||
          !NUMBER_PATTERN.test(e.number) ||
          typeof e.factor !== "string" ||
          !FACTOR_PATTERN.test(e.factor) ||
          BigInt(e.factor) <= 1n ||
          BigInt(e.factor) >= BigInt(e.number) ||
          !validCells(e.command.path) ||
          typeof e.command.factor !== "string" ||
          !FACTOR_PATTERN.test(e.command.factor) ||
          !Object.hasOwn(TYPE_MAP, e.command.fee)
        )
          return false;
      } else if (e.type !== "pass") return false;
      if (
        e.adjacentCaptures &&
        (e.type !== "claim" ||
          !Array.isArray(e.adjacentCaptures) ||
          !validCells(e.adjacentCaptures.map((x) => x.at)) ||
          new Set(e.adjacentCaptures.map((x) => x.at)).size !==
            e.adjacentCaptures.length ||
          !e.adjacentCaptures.every((x) => x.by === e.player))
      )
        return false;
    }
    const g = graph(s.board);
    return (
      !hasCycle(g) &&
      s.board.every((t, i) =>
        t?.face === "arrow"
          ? g.degree(i) > 0 && !isLeadingZero(s.board, g, i)
          : true,
      )
    );
  } catch {
    return false;
  }
}
