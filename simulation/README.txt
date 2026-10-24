Current Primeria simulator

Run: npm run simulate -- --games 60 --seed 20261023 --output /absolute/path/results.json

Games are per board size (9,11,13,15). Use a multiple of12 to balance matchups and starting seats. The simulator imports the current playable bot and rules engine directly. Records include the arithmetic version and source hashes.

Model: quick-small-primes-full-scan-v2.
Every complete horizontal or vertical number and isolated tile is scanned for prime factors2,3,5,7,11,13 before move selection at every strength and clock level. The scan checks both reading directions for either challenger and excludes the number itself as a factor. No target-count or time-budget cutoff can hide a small factor. All found targets enter the move comparison; finding a factor does not force a challenge when another move is preferable. An immediate clear-out still wins first.

The whole-board scan has one fixed assumed cost:0.25seconds times level speed, or0.375/0.25/0.175seconds for beginner/intermediate/advanced. It does not accumulate a separate charge per target. These are intentionally idealized attention and timing assumptions, not measurements of people. Known factors are exact; difficulty comes from bounded planning and larger-factor calculation budgets, not injected arithmetic errors. A failed challenge with attempts remaining uses any other known small factor of its locked number. Hypothetical positions scan the whole board from both reading directions available to either player.

Search model: any-orientation-two-endpoint-minimax-v3. Iterative deepening with alpha-beta pruning searches up to1/3/5 plies for beginner/intermediate/advanced, within deterministic node budgets. A ply is one completed player turn. Known captures remain in the reply set regardless of placement breadth. Capture continuations can extend two plies beyond the nominal horizon. Targeted placements extend or bridge threatened runs; the evaluation accounts for stored captures on both sides and treats returning and shedding tiles symmetrically. Immediate clear-outs take priority. The last fully completed search iteration supplies the move, and time pressure reduces the search budget. These remain selective, heuristic bots rather than optimal players.

Placement pruning preserves promising Single Drops and Double Downs at every searched node before filling the remaining slots by score. Root Single Drops include different roles: isolated anchors, adjacent extensions, and bridges. Isolated composites are legal candidates too: a successful isolated challenge discards that tile and returns none. Single Drops receive no artificial evaluation bonus, and there is no quota for move types actually played. Planning traces record rootCandidates, placementCoverage, and exploredMoveTypes so coverage can be audited separately from played frequency.

Planning has a separate assumed cost of0.004seconds per searched node times level speed, bounded by the turn's existing thinking budget. Search work does not hide known small factors. Records include both arithmeticModel and searchModel so results from the former planner are not mixed with new runs.

Strength differences remain in placement ideas, strategy, search depth, noise, handling time and larger-prime calculations. Those calculations and move planning retain their own budgets. There is no unrestricted factoring or primality oracle.

Earlier research snapshots/reports in the chat workspace retain their original source and timings. For new rule comparisons, use this same model on every side and change only Double Down legality and legal square enumeration. Old game-length figures are not recalculated merely by changing the current bot.

Current Double Down rule: Place two tiles, one at a time. Each tile must be placed adjacent to a tile already on the board when it is placed. After the move, both new tiles must belong to the same complete uninterrupted horizontal or vertical run. Generic bot candidates consider only second squares that join the first tile into one completed run. Candidates still favor a neighboring second square75% of the time, otherwise sampling every same-run second square. All full-board small-prime scanning remains enabled. Earlier studies using unrestricted adjacent-to-existing placements retain their original rules and results.

Successful challenges discard both endpoint tiles (one physical tile for an isolated digit), returning only interior tiles to the opponent. A challenge locks its chosen reading direction for all attempts.
