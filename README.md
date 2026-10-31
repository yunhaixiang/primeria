# Primeria

A two-player game of paths and primes, invented by [Yunhai Xiang](https://yunhaimath.com/).

[Play Primeria](https://yunhaixiang.github.io/primeria/) · [How to play](howtoplay.md)

Each player has 58 owned, double-sided tiles on a 15 × 15 board. Drop digit tiles, flip at least two into a connected tree of arrows, and challenge an opponent’s segment by giving a factor of its number. Regular tiles bend or continue; junctions branch. Each digit has one arrow type: 0 bends left, 5 bends right, 2/4/6/8 are straight, and 1/3/7/9 are junctions. A claimed number cannot lead with 0; zeros exposed at the leading end after a capture are also captured. After every move, unclaimed tiles beside an enemy claimed tile are captured. Two consecutive passes end the game. Captured tiles score one point each; claimed tiles score only in groups of at least nine connected through matching arrows. Smaller claimed groups retain their capture ability. Remaining unclaimed tiles are surrendered.

The classic green board and compact interface use ivory tiles with blue and orange ownership colours. Both faces have aligned digits in all four corners. Unclaimed tiles show a small, tilted, solid route indicator at half opacity; claimed tiles show a large arrow aligned to the grid. The factor keypad shares the tile finish and digit style. Rotate the board for either seat. The virtual board previews arrow orientations and the exact number of a selected segment.

## Play

- **One device:** share the board and visible reserves. Toggle **Split view** for opposite-facing player controls, with a separate clock, reserve, move controls and journal for each seat. The view adapts to phones and remembers your preference.
- **Computer:** choose a bounded search budget. This experimental opponent searches branching claims and short development plans, grows groups toward nine scoring tiles, assesses adjacent captures, and checks the opponent’s factor-capture reply. It checks elementary divisors immediately and verifies every proposed factor exactly. Its strength has not been calibrated against human players.
- **Online:** use **Play online** to create an invitation and send it to a friend. Keep the host tab open. PeerJS signalling requires an internet connection; some restrictive networks may prevent a peer connection. The host validates moves and owns the clock.

Time controls are Blitz 10+10, Rapid 20+20, Standard 30+30, Classical 45+60, and Casual without a clock. The numbers are minutes initially and seconds added after each turn. Local games are saved automatically and reopen paused. Completed games support turn-by-turn review and a downloadable JSON record.

## Development

No build framework or external package dependencies are required. Use a current Node.js version and Python 3.

```sh
npm test
npm start
```

Open `http://localhost:4173`. All fonts and the PeerJS client are bundled locally. The online connection service is the only remote runtime dependency.

Run `npm run assets` after interface changes to refresh the browser asset revision; `npm start` and the publishing workflow also do this automatically.

`howtoplay.md` is the rules source. After editing it, run `npm run rules` to update `rules-content.js`, shared by the in-game rulebook and `how-to-play.html`.

```sh
npm run simulate -- --games 1 --seed 42
```

Simulation records contain every legal command, exact challenge arithmetic, final scores and an ASCII board. Simulation thinking budgets are computational budgets, not measured human thinking times. Simulations use Casual mode so timing does not distort rules testing.

The current rules use a separate save format and online protocol from the earlier anchor game. Earlier browser saves remain untouched and are not loaded as current games.

## Printed materials

The existing `cutout/` PDFs are historical materials for earlier rules. They are not the current 58-tile double-sided set. See [the current supply](howtoplay.md#setup) before making physical tiles.
