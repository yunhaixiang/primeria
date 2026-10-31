import {
  newGame,
  applyMove,
  isSupportedState,
  scores,
  scoreBreakdown,
  territory,
  TILES_PER_PLAYER,
  TYPE_MAP,
  reviewPosition,
} from "../engine.js";
import { createBot } from "../bot.js";
export function simulate({
  seed = 1,
  strength = "intermediate",
  maxTurns = 6 * TILES_PER_PLAYER + 2,
} = {}) {
  const state = newGame(
    { mode: "casual", names: ["Ada", "Emmy"], first: seed % 2 },
    0,
  );
  state.started = true;
  const bots = [
    createBot({ seed: seed * 2 + 11, strength }),
    createBot({ seed: seed * 2 + 19, strength }),
  ];
  const analysis = [];
  while (!state.ended && state.history.length < maxTurns) {
    const result = bots[state.turn].choose(state);
    const event = applyMove(state, result.command, 0);
    analysis.push(result.analysis);
    if (!isSupportedState(state))
      throw Error(`Invalid state after turn ${state.history.length}`);
    if (
      event.type === "challenge" &&
      event.success !== (BigInt(event.number) % BigInt(event.factor) === 0n)
    )
      throw Error("Arithmetic mismatch.");
  }
  if (!state.ended)
    throw Error(
      `Search exceeded ${maxTurns} turns; no result has been invented.`,
    );
  const replay = reviewPosition(state, state.history.length);
  if (
    JSON.stringify(replay.board) !== JSON.stringify(state.board) ||
    JSON.stringify(replay.captured) !== JSON.stringify(state.captured)
  )
    throw Error("Replay mismatch.");
  const board = Array.from({ length: 15 }, (_, r) =>
    Array.from({ length: 15 }, (_, c) => {
      const t = state.board[r * 15 + c];
      return t
        ? `${t.owner === 0 ? "B" : "O"}${TYPE_MAP[t.type].digit}${t.face === "arrow" ? "*" : " "}`
        : " . ";
    }).join(" "),
  ).join("\n");
  return {
    seed,
    strength,
    scores: scores(state),
    breakdown: scoreBreakdown(state),
    territory: territory(state.board),
    turns: state.history.length,
    winner: state.ended.winner,
    moves: Object.fromEntries(
      ["drop", "claim", "challenge", "pass"].map((type) => [
        type,
        state.history.filter((m) => m.type === type).length,
      ]),
    ),
    board,
    analysis,
    state,
  };
}
