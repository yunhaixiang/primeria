import {
  newGame,
  BOARD_SIZE,
  applyMove,
  isSupportedState,
  scores,
  scoreBreakdown,
  MAX_GAME_TURNS,
  TYPE_MAP,
  reviewPosition,
} from "../engine.js";
import { createBot } from "../bot.js";
export function simulate({
  seed = 1,
  strength = "intermediate",
  maxTurns = MAX_GAME_TURNS,
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
      throw Error(`Invalid state after step ${state.history.length}`);
    if (
      event.type === "challenge" &&
      event.success !== (BigInt(event.number) % BigInt(event.factor) === 0n)
    )
      throw Error("Arithmetic mismatch.");
  }
  if (!state.ended)
    throw Error(
      `Search exceeded ${maxTurns} steps; no result has been invented.`,
    );
  const replay = reviewPosition(state, state.history.length);
  if (
    JSON.stringify(replay.board) !== JSON.stringify(state.board) ||
    JSON.stringify(replay.reserves) !== JSON.stringify(state.reserves) ||
    JSON.stringify(replay.captured) !== JSON.stringify(state.captured)
  )
    throw Error("Replay mismatch.");
  const board = Array.from({ length: BOARD_SIZE }, (_, r) =>
    Array.from({ length: BOARD_SIZE }, (_, c) => {
      const t = state.board[r * BOARD_SIZE + c];
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
    turns: state.turnNumber - 1,
    actions: state.history.length,
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
