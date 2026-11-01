# Primeria

A two-player game of paths and primes, invented by [Yunhai Xiang](https://yunhaimath.com/).

[Play Primeria](https://yunhaixiang.github.io/primeria/) · [How to play](howtoplay.md)

Each player has 162 owned tiles: 18 copies of each digit from 1 to 9. On a 15 × 15 board, place a tile with its arrow already oriented, or Pass. Before the move, you may make one optional Challenge by proposing a factor of an opponent’s segment. A segment is a directed path between two junctions, read against the arrows. Captured tiles stay out of play and score one point each.

Each digit has one arrow type: 2 bends left, 8 bends right, 4/5/6 are straight, and 1/3/7/9 are junctions. Tiles cannot be rotated after placement, and directed cycles are forbidden. A junction must connect to an existing own tile when placed. A successful Challenge captures only its selected segment; disconnected tiles remain until endgame cleanup.

Segments may pass through intermediate junctions and must contain at least two tiles. Two consecutive passes end the game; a successful Challenge breaks the pass streak, and its turn does not count as a pass. First, regular tiles outside every segment become captures for their owners’ opponents. Then all tiles in groups below nine are captured. Groups use matching arrows in either direction. Each remaining own tile and each captured tile scores one point; empty squares do not score.

The classic green board uses ivory tiles with blue and orange ownership colours, aligned digits in all four corners, and large arrows. The factor keypad shares the tile finish and digit style. Rotate a tile before placing it, or rotate the board for either seat. The virtual board previews the exact number of a selected segment.

## Play

- **One device:** share the board and visible reserves. Toggle **Split view** for opposite-facing player controls, with a separate clock, reserve, move controls and journal for each seat. The view adapts to phones and remembers your preference.
- **Online:** use **Play online** to create an invitation and send it to a friend. Keep the host tab open. PeerJS signalling requires an internet connection; some restrictive networks may prevent a peer connection. The host validates moves and owns the clock.

Time controls are Blitz 10+10, Rapid 20+20, Standard 30+30, Classical 45+60, and Casual without a clock. The numbers are minutes initially and seconds added once after each completed turn, including any optional challenge. Local games are saved automatically and reopen paused. Completed games support turn-by-turn review and a downloadable JSON record.

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

The existing `cutout/` PDFs are historical materials for earlier rules. They are not the current 162-tile set. See [the current supply](howtoplay.md#setup) before making physical tiles.
