Current Primeria simulator

Run: npm run simulate -- --games 60 --seed 20261023 --output /absolute/path/results.json

Games are per board size (9,11,13,15). Use a multiple of12 to balance matchups and starting seats. The simulator imports the current playable bot and rules engine directly. Records include the arithmetic version and source hashes.

Model: quick-small-primes-full-scan-v2.
Every complete horizontal or vertical number and isolated tile is scanned for prime factors2,3,5,7,11,13 before move selection at every strength and clock level. The scan respects the challenger's fixed perspective and excludes the number itself as a factor. No target-count or time-budget cutoff can hide a small factor. All found targets enter the move comparison; finding a factor does not force a challenge when another move is preferable. An immediate clear-out still wins first.

The whole-board scan has one fixed assumed cost:0.25seconds times level speed, or0.375/0.25/0.175seconds for beginner/intermediate/advanced. It does not accumulate a separate charge per target. These are intentionally idealized attention and timing assumptions, not measurements of people. Known small factors are exact; artificial arithmetic slips apply only to harder factors. A failed challenge with attempts remaining uses any other known small factor of its locked number. Hypothetical opponent replies also scan the whole board.

Strength differences remain in placement ideas, strategy, search depth, noise, handling time and larger-prime calculations. Those calculations and move planning retain their own budgets. There is no unrestricted factoring or primality oracle.

Earlier research snapshots/reports in the chat workspace retain their original source and timings. For new rule comparisons, use this same model on every side and change only Double Down legality and legal square enumeration. Old game-length figures are not recalculated merely by changing the current bot.
