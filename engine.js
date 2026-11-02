/** Primeria's owned-tile rules. Directions: north, east, south, west. */
export const RULES_VERSION = 43;
export const MIN_SCORING_GROUP = 6;
export const BOARD_SIZE = 15;
export const BOARD_CELLS = BOARD_SIZE * BOARD_SIZE;
export const MODES = {
  blitz: [600, 10],
  rapid: [1200, 20],
  standard: [1800, 30],
  classical: [2700, 60],
  casual: [null, 0],
};
export const TYPES = [
  {
    id: "j1",
    digit: 1,
    kind: "fork",
    exits: [0, 3, 1],
    count: 18,
    label: "Three-way fork",
  },
  {
    id: "r2",
    digit: 2,
    kind: "left",
    exits: [3],
    count: 18,
    label: "Left bend",
  },
  {
    id: "j3",
    digit: 3,
    kind: "fork",
    exits: [0, 3],
    count: 18,
    label: "Straight + left",
  },
  {
    id: "r4",
    digit: 4,
    kind: "straight",
    exits: [0],
    count: 18,
    label: "Straight",
  },
  {
    id: "r5",
    digit: 5,
    kind: "straight",
    exits: [0],
    count: 18,
    label: "Straight",
  },
  {
    id: "r6",
    digit: 6,
    kind: "straight",
    exits: [0],
    count: 18,
    label: "Straight",
  },
  {
    id: "j7",
    digit: 7,
    kind: "fork",
    exits: [0, 1],
    count: 18,
    label: "Straight + right",
  },
  {
    id: "r8",
    digit: 8,
    kind: "right",
    exits: [1],
    count: 18,
    label: "Right bend",
  },
  {
    id: "j9",
    digit: 9,
    kind: "fork",
    exits: [3, 1],
    count: 18,
    label: "Left + right",
  },
];
export const TILES_PER_PLAYER = TYPES.reduce((n, type) => n + type.count, 0);
// Safety limit for imported/network records, including optional challenge steps.
export const MAX_GAME_TURNS = 100_000;
const FACTOR_PATTERN = new RegExp(`^\\d{1,${TILES_PER_PLAYER}}$`);
const NUMBER_PATTERN = new RegExp(`^[1-9]\\d{1,${TILES_PER_PLAYER - 1}}$`);
export const TYPE_MAP = Object.fromEntries(TYPES.map((t) => [t.id, t]));
export const total = (counts) =>
  Object.values(counts).reduce((a, b) => a + b, 0);
export const inventory = () =>
  Object.fromEntries(TYPES.map((t) => [t.id, t.count]));
export const clone = (x) => structuredClone(x);
export const coordinate = (i) =>
  `${String.fromCharCode(65 + (i % BOARD_SIZE))}${Math.floor(i / BOARD_SIZE) + 1}`;
export function neighbor(i, d) {
  const r = Math.floor(i / BOARD_SIZE),
    c = i % BOARD_SIZE;
  return d === 0
    ? r
      ? i - BOARD_SIZE
      : null
    : d === 1
      ? c < BOARD_SIZE - 1
        ? i + 1
        : null
      : d === 2
        ? r < BOARD_SIZE - 1
          ? i + BOARD_SIZE
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
  const out = Array.from({ length: BOARD_CELLS }, () => []),
    incoming = Array.from({ length: BOARD_CELLS }, () => []);
  for (let i = 0; i < BOARD_CELLS; i++) {
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
  const color = new Uint8Array(BOARD_CELLS);
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
/** A completed tile lies on a directed path between two distinct junctions.
 * Reachability uses the whole DAG, independent of the segment search limit. */
export const isEndpoint = (board, g, i) =>
  !!board[i] && TYPE_MAP[board[i].type].kind === "fork";
export function completedTiles(board, g = graph(board)) {
  const before = new Map(), after = new Map();
  function reaches(i, edges, memo) {
    if (memo.has(i)) return memo.get(i);
    memo.set(i, false);
    const result = edges[i].some(j => isEndpoint(board, g, j) || reaches(j, edges, memo));
    memo.set(i, result);
    return result;
  }
  return new Set(board.flatMap((tile, i) => {
    if (!tile) return [];
    const up = reaches(i, g.incoming, before), down = reaches(i, g.out, after);
    return (isEndpoint(board, g, i) ? up || down : up && down) ? [i] : [];
  }));
}
/** Endgame first removes unsupported regular tiles; junctions remain for group counting. */
export function scoringTiles(board, g = graph(board)) {
  const eligible = completedTiles(board, g);
  for (let i = 0; i < board.length; i++)
    if (board[i] && isEndpoint(board, g, i)) eligible.add(i);
  return eligible;
}
/** Groups use matching arrows in either direction after unsupported regulars are omitted. */
export function claimedGroups(board, g = graph(board)) {
  const eligible = scoringTiles(board, g), seen = new Set(), groups = [];
  for (const i of eligible) {
    if (seen.has(i)) continue;
    const tiles = [i];
    seen.add(i);
    for (let k = 0; k < tiles.length; k++)
      for (const j of [...g.out[tiles[k]], ...g.incoming[tiles[k]]])
        if (eligible.has(j) && !seen.has(j)) {
          seen.add(j);
          tiles.push(j);
        }
    groups.push({ owner: board[i].owner, tiles, size: tiles.length });
  }
  return groups;
}
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
export function validateSegment(board, path, owner) {
  const g = graph(board);
  validatePath(board, path, owner, g);
  if (!isEndpoint(board, g, path[0]) || !isEndpoint(board, g, path.at(-1)))
    throw Error("A segment must start and end at junction tiles.");
  const number = segmentNumber(board, path);
  return number;
}
/** Enumerate actual directed segments, with a cap for bounded analysis/UI search. */
export function segments(board, owner, limit = 2000) {
  const g = graph(board),
    result = [];
  for (let i = 0; i < BOARD_CELLS && result.length < limit; i++) {
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
        isEndpoint(board, g, end)
      )
        result.push({ path: [...path], number: segmentNumber(board, path) });
      for (const j of g.out[end]) if (!path.includes(j)) walk([...path, j]);
    };
    walk([i]);
  }
  return result;
}
/** Project the mandatory endgame cleanup without changing the live board. */
export function endgameProjection(board) {
  const cleaned = board.slice(), unclaimed = [], smallGroups = [];
  const completed = completedTiles(board);
  for (let at = 0; at < BOARD_CELLS; at++)
    if (board[at] && TYPE_MAP[board[at].type].kind !== "fork" && !completed.has(at)) {
      unclaimed.push(at);
      cleaned[at] = null;
    }
  for (const group of claimedGroups(cleaned))
    if (group.size < MIN_SCORING_GROUP)
      for (const at of group.tiles) {
        smallGroups.push(at);
        cleaned[at] = null;
      }
  return { board: cleaned, unclaimed, smallGroups };
}
export function scoreBreakdown(s) {
  const groups = claimedGroups(s.board), supported = scoringTiles(s.board);
  return [0, 1].map((p) => {
    const own = groups.filter((x) => x.owner === p);
    const eligible = own
      .filter((x) => x.size >= MIN_SCORING_GROUP)
      .reduce((n, x) => n + x.size, 0);
    const growing = own
      .filter((x) => x.size < MIN_SCORING_GROUP)
      .reduce((n, x) => n + x.size, 0);
    return {
      eligible,
      growing,
      unfinished: s.board.filter((t, at) => t?.owner === p && !supported.has(at)).length,
      captured: s.captured[p].length,
      groups: own.map((x) => x.size),
      total: eligible + s.captured[p].length,
    };
  });
}
export function scores(s) {
  return scoreBreakdown(s).map((x) => x.total);
}
export function newGame(
  { mode = "standard", names = ["Blue", "Orange"], first = 0 } = {},
  now = Date.now(),
) {
  if (!Object.hasOwn(MODES, mode) || ![0, 1].includes(first))
    throw Error("Choose a time control and first player.");
  return {
    rulesVersion: RULES_VERSION,
    boardSize: BOARD_SIZE,
    board: Array(BOARD_CELLS).fill(null),
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
    challengeUsed: false,
    challengeSucceeded: false,
    turnNumber: 1,
    history: [],
    revision: 0,
    nextId: 1,
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
function capture(s, at) {
  const t = s.board[at];
  s.captured[1 - t.owner].push({ ...t, at });
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
    return { id: n.nextId++, type, owner: p, face: "arrow", rotation: 0 };
  };
  if (move.type === "drop") {
    if (
      !Number.isInteger(move.at) ||
      move.at < 0 ||
      move.at >= BOARD_CELLS ||
      n.board[move.at]
    )
      throw Error("Choose an empty square.");
    const rotation = move.rotation ?? 0;
    if (!Number.isInteger(rotation) || rotation < 0 || rotation > 3)
      throw Error("Choose a tile orientation.");
    n.board[move.at] = { ...take(move.tile), rotation };
    const connections = graph(n.board);
    if (hasCycle(connections)) throw Error("This drop would create an arrow cycle.");
    detail = { at: move.at, tile: move.tile, rotation };
  } else if (move.type === "challenge") {
    if (n.challengeUsed) throw Error("Only one challenge attempt is allowed per turn.");
    const number = validateSegment(n.board, move.path, 1 - p);
    if (typeof move.factor !== "string" || !FACTOR_PATTERN.test(move.factor))
      throw Error("Enter a positive whole-number factor.");
    const factor = BigInt(move.factor),
      value = BigInt(number);
    if (factor <= 1n || factor >= value)
      throw Error(
        "The factor must be greater than 1 and smaller than the number.",
      );
    const success = value % factor === 0n,
      removed = [];
    if (success) {
      for (const at of move.path) {
        removed.push(at);
        capture(n, at);
      }

    }
    detail = {
      path: [...move.path],
      number,
      factor: factor.toString(),
      success,
      removed,
    };
    n.challengeUsed = true;
    n.challengeSucceeded = success;
    if (success) n.passCount = 0;
  } else if (move.type === "pass") {
  } else throw Error("Choose Drop or Pass, or challenge before your move.");
  const completesTurn = move.type !== "challenge",
    turnNumber = n.turnNumber;
  if (completesTurn)
    n.passCount = move.type === "pass" && !n.challengeSucceeded ? n.passCount + 1 : 0;
  if (n.passCount === 2) {
    const { unclaimed, smallGroups } = endgameProjection(n.board);
    for (const at of unclaimed) capture(n, at);
    for (const at of smallGroups) capture(n, at);
    const points = scores(n);
    n.ended = {
      winner: points[0] === points[1] ? null : points[0] > points[1] ? 0 : 1,
      reason: "passes",
      scores: points,
    };
    detail.unclaimed = unclaimed;
    detail.smallGroups = smallGroups;
  }
  if (completesTurn) {
    if (n.clocks[p] !== null) n.clocks[p] += n.increment;
    n.turn = 1 - p;
    n.turnNumber++;
    n.challengeUsed = false;
    n.challengeSucceeded = false;
  }
  n.lastTick = now;
  n.revision++;
  const event = {
    player: p,
    turnNumber,
    completesTurn,
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
      s.boardSize !== BOARD_SIZE ||
      !Array.isArray(s.board) ||
      s.board.length !== BOARD_CELLS ||
      ![0, 1].includes(s.turn) ||
      !Object.hasOwn(MODES, s.mode) ||
      !Number.isInteger(s.revision) ||
      s.revision < 0 ||
      !Array.isArray(s.history) ||
      s.history.length > MAX_GAME_TURNS ||
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
      !s.captured.every((pile) => Array.isArray(pile) && pile.length <= TILES_PER_PLAYER) ||
      ![0, 1, 2].includes(s.passCount) ||
      typeof s.challengeUsed !== "boolean" ||
      typeof s.challengeSucceeded !== "boolean" ||
      (s.challengeSucceeded && !s.challengeUsed) ||
      !Number.isSafeInteger(s.turnNumber) ||
      s.turnNumber < 1 ||
      !Number.isSafeInteger(s.nextId) ||
      s.nextId < 1 ||
      !Number.isFinite(s.lastTick)
    )
      return false;
    if (
      s.startCountdown &&
      (s.started || s.ended || !Number.isFinite(s.startCountdown.finishAt))
    )
      return false;
    const ids = new Set();
    const validTile = (t) => {
      if (
        !t ||
        typeof t.type !== "string" ||
        !Object.hasOwn(TYPE_MAP, t.type) ||
        ![0, 1].includes(t.owner) ||
        t.face !== "arrow" ||
        !Number.isInteger(t.rotation) ||
        t.rotation < 0 ||
        t.rotation > 3 ||
        !Number.isSafeInteger(t.id) ||
        t.id < 1 ||
        ids.has(t.id) ||
        t.id >= s.nextId
      )
        return false;
      ids.add(t.id);
      return true;
    };
    const supplies = [inventory(), inventory()];
    for (const t of s.board)
      if (t) {
        if (!validTile(t)) return false;
        supplies[t.owner][t.type]--;
      }
    for (let p = 0; p < 2; p++)
      for (const t of s.captured[p]) {
        if (!validTile(t) || t.owner !== 1 - p) return false;
        supplies[t.owner][t.type]--;
      }
    if (s.nextId !== ids.size + 1) return false;
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
    if (
      s.ended &&
      (!["passes", "time", "resign"].includes(s.ended.reason) ||
        ![0, 1, null].includes(s.ended.winner) ||
        !Array.isArray(s.ended.scores) ||
        s.ended.scores.length !== 2 ||
        !s.ended.scores.every(
          (n) => Number.isInteger(n) && n >= 0 &&
            n <= BOARD_CELLS + TILES_PER_PLAYER,
        ))
    )
      return false;
    const validCells = (cells, maximum = TILES_PER_PLAYER) =>
      Array.isArray(cells) &&
      cells.length <= maximum &&
      cells.every((i) => Number.isInteger(i) && i >= 0 && i < BOARD_CELLS);
    let turnNumber = 1, challengeUsed = false, challengeSucceeded = false,
      actor = s.history[0]?.player ?? s.turn;
    for (const e of s.history) {
      if (e.player !== actor || e.turnNumber !== turnNumber ||
          e.completesTurn !== (e.type !== "challenge")) return false;
      if (e.type === "challenge") {
        if (challengeUsed) return false;
        challengeUsed = true;
        challengeSucceeded = e.success;
      } else {
        actor = 1 - actor;
        turnNumber++;
        challengeUsed = false;
        challengeSucceeded = false;
      }
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
          e.at >= BOARD_CELLS ||
          e.command.at !== e.at ||
          e.command.tile !== e.tile ||
          !Number.isInteger(e.rotation) || e.rotation < 0 || e.rotation > 3 ||
          (e.command.rotation ?? 0) !== e.rotation
        )
          return false;
      } else if (e.type === "challenge") {
        if (
          !validCells(e.path) ||
          e.path.length < 2 ||
          !validCells(e.removed) ||
          typeof e.success !== "boolean" ||
          typeof e.number !== "string" ||
          !NUMBER_PATTERN.test(e.number) ||
          typeof e.factor !== "string" ||
          !FACTOR_PATTERN.test(e.factor) ||
          BigInt(e.factor) <= 1n ||
          BigInt(e.factor) >= BigInt(e.number) ||
          !validCells(e.command.path) ||
          typeof e.command.factor !== "string" ||
          !FACTOR_PATTERN.test(e.command.factor)
        )
          return false;
      } else if (e.type !== "pass") return false;
      if (e.adjacentCaptures !== undefined) return false;
      if (e.smallGroups !== undefined &&
          (e.type !== "pass" || !validCells(e.smallGroups, TILES_PER_PLAYER * 2)))
        return false;
      if (e.enclosureCaptures !== undefined) return false;
    }
    if (s.turn !== actor || s.turnNumber !== turnNumber ||
        s.challengeUsed !== challengeUsed || s.challengeSucceeded !== challengeSucceeded) return false;
    return !hasCycle(graph(s.board));
  } catch {
    return false;
  }
}
