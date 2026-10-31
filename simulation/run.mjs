import { simulate } from "./game.js";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const args = process.argv.slice(2),
  option = (name, fallback) => {
    const at = args.indexOf("--" + name);
    return at < 0 ? fallback : args[at + 1];
  },
  games = Number(option("games", "1")),
  seed = Number(option("seed", "1")),
  strength = option("strength", "intermediate"),
  output = option("out", null);
if (
  !Number.isInteger(games) ||
  games < 1 ||
  games > 100 ||
  !Number.isInteger(seed) ||
  !["beginner", "intermediate", "advanced"].includes(strength)
)
  throw Error(
    "Use --games 1..100 --seed INTEGER --strength beginner|intermediate|advanced.",
  );
if (output) await mkdir(resolve(output), { recursive: true });
for (let i = 0; i < games; i++) {
  const game = simulate({ seed: seed + i, strength });
  console.log(
    `Game ${i + 1} · seed ${game.seed} · ${game.turns} turns · ${game.scores.join("–")} · ${game.winner === null ? "draw" : game.state.names[game.winner] + " wins"}`,
  );
  console.log(JSON.stringify(game.moves));
  console.log(game.board);
  if (output)
    await writeFile(
      resolve(output, `game-${seed + i}.json`),
      JSON.stringify(game, null, 2) + "\n",
    );
}
