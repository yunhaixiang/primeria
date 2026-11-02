Current owned-tile rules: npm run simulate -- --games 1 --seed 42 --strength advanced
Add --out /absolute/path to save complete JSON records.

Both players use a bounded placement and development search, mandatory cheap divisibility checks,
and exact factors. Scoring for territory and captures, opponent replies and endgame removal of small groups use the same rules engine as the live board. An untested number is never declared prime. The opponent is
experimental, not a calibrated model of expert human play. Casual clocks are
used. Each move and final state is validated; the record is replayed independently.

Each turn allows one optional challenge, without a tile fee, followed by Drop or Pass.
Captured tiles stay out of play and score one point each. Records include challenge steps separately
from completed turns; replays preserve the intermediate position before the normal move.

Challenges capture only the selected segment.
At the end, remove unsupported regular tiles first, then groups below six.
Each player starts with 18 copies of digits 1–9 (162 tiles).
Tiles are placed with fixed orientations; no flipping or zero tiles remain.

Only groups of at least six survive endgame cleanup. Territory is counted afterwards: an orthogonally connected empty region belongs to a player only if it avoids the board edge and borders tiles of that player alone. Board tiles do not score.
