# Primeria

A two-player board game of prime numbers on a choice of 9 × 9, 11 × 11, or 13 × 13 boards, invented by [Yunhai Xiang](https://yunhaimath.com/posts/c219c1f/). A responsive, static website designed for GitHub Pages.

## Play

Choose **New Game** in the toolbar above the board, choose **On one device** or **Over the internet**, enter both names, choose the board size, select a clock, and choose who moves first (or flip a coin). Press **Start** when both players are ready. The same button changes to **Pause** during play and **Resume** while paused. Resign is the fourth option in the move panel and asks for confirmation before ending your game. Mute/Unmute (with a changing speaker icon) and Rotate are above the board; GitHub is beside the creator’s attribution in the footer.

- **Single Drop:** select a digit and any vacant square. Zero and five must share an edge with an existing tile. At the end of a placement, zero must lie inside every row or column number it belongs to, never at either end.
- **Double Down:** select and place two tiles in order. Each must share an edge with an existing tile, including the tile just placed. A zero may be the first tile while the move is being drafted, but the complete two-tile move must enclose it inside its number; zero cannot be at the end of any affected horizontal or vertical number.
- **Challenge:** click any tile once to select its entire uninterrupted horizontal or vertical number. Hover to preview the whole number. At crossings, moving toward a horizontal or vertical tile edge previews that row or column; after clicking, the Row and Column buttons also let you choose, including on touch screens. Rotation keeps selection attached to the same board coordinates. A single-digit challenge is allowed only for an isolated tile with no edge-adjacent neighbors; click it once. Read the number from the opponent’s fixed perspective, build a nontrivial factor with the colored 0–9 keypad, and submit. Use backspace to correct a digit; number keys also work. Correct challenges transfer all but the final digit in the opponent’s reading direction to the opponent’s pile; that final tile is taxed and removed from play. The attempt limit is the number of digits divided by three, rounded up: 1–3 digits allow one attempt, 4–6 allow two, 7–9 allow three, 10–12 allow four, and 13 allow five. After a wrong factor with attempts left, both clocks pause for a three-second Attempt Fails message, then the challenger’s clock resumes for another factor on the same locked number. Quit Challenge is available between attempts and during that review, and ends the challenge as a failure. A success or exhausted attempt budget ends the turn; Challenge Success or Challenge Failed appears for three seconds before the next player’s clock starts. The whole challenge receives only one increment and one completed-move history entry, with all its factor attempts recorded.

Each player starts with 36 tiles: two each of 0 and 5, three each of 2, 4, 6, 8, and five each of 1, 3, 7, 9. Player one reads left-to-right and top-to-bottom on the default board; player two sits opposite and reads right-to-left and bottom-to-top. A challenge always uses the opponent’s perspective. Rotating either browser changes the view only.

Placements are previews until committed. Clear a draft with the undo button or Escape. Digit keys select rack tiles. The rotation button turns the board 90 degrees while keeping coordinates attached to their original squares. Columns are labeled A–I, A–K, or A–M, and rows 1–9, 1–11, or 1–13, according to the selected size. These labels rotate with the board; move history uses coordinates such as A1 and K11. Counts for every digit are visible in the active rack and the opponent’s supply strip; player cards also expand to show inventories.

The first player to play every tile wins. Resignation and running out of time also end the game. The optional **Time Out Rule** requires the same player to have fewer tiles for a configurable number of consecutive completed moves after a configurable duration of active play. Enable it in New game to set **Time out after** (in minutes, default 60 = 1 hour) and **Consecutive moves** (default 10). A tie resets the streak; a new leader starts a new streak. Settings are preserved in saved games and online rooms.

### Time controls

| Mode | Per player | Increment per completed turn |
| --- | --- | --- |
| Blitz | 10 minutes | 10 seconds |
| Rapid | 20 minutes | 20 seconds |
| Standard | 30 minutes | 30 seconds |
| Classical | 45 minutes | 60 seconds |
| Casual | Unlimited | None |

Clocks run while choosing a move or finding a factor. Modal dialogs do not pause active play. Use Pause explicitly when both players agree. Shared-device games save in local browser storage and restore paused after a reload. The selected size is saved with the game. These revised rules use a separate save slot and require a fresh game; saves from earlier rule versions remain untouched. A saved retry restores the same locked number and the remaining attempt budget, with the game paused until resumed. Closing a tab does not preserve a live online session.

### Online play

Select **New Game → Over the internet → Create a room**, choose the names, time control, and first move, then create the room and share its invitation link. Your friend opens it and selects **Join game**, or chooses **New Game → Over the internet → Join a friend** and pastes the link or room code. Reopen **New Game** to copy the invitation, leave the room, or (as host) start another game in the same room. Choose **On one device** to start a shared-device game. The host is player one, the guest is player two; either may have the first move. Only the host creates new games. Both players can pause, resume, or resign as themselves.

Both browsers must use the same rules version; reload Primeria and create a new room after a rule update. The host chooses the board size, validates moves, and maintains the authoritative clocks. Guests automatically use the host’s selected size, including when the host starts another game in the same room. No account or application backend is required. PeerJS 1.5.5 is vendored; its public PeerServer handles connection signaling, and game data travels over WebRTC between the browsers. Room IDs use cryptographic randomness and are shared through invitation links. Online play depends on that external signaling service and compatible network conditions; there is no hosted TURN relay, reconnection system, or competitive anti-cheat service. A connection loss pauses both clocks; leave the room to continue at a shared device or create a fresh room. Keep the host tab open and active during a game. Shared-device play needs no signaling service.

### Rule interpretations

Adjacency is orthogonal. Challenges cover the whole uninterrupted number in the opponent’s reading direction; crossing tiles in the perpendicular direction do not extend it. Single-digit challenges require an isolated tile, while diagonal neighbors do not affect isolation. Leading zeros are interpreted numerically; the value 1 is excluded from challenges; and 0 may be challenged with any integer factor greater than 1, subject to the same whole-number and isolation requirements. For positive numbers, a proposed factor must be greater than 1 and smaller than the number. Verification uses exact integer arithmetic. On a successful challenge, all tiles except the last digit in the opponent’s reading direction go to the opponent’s pile. That last tile is taxed and permanently removed from play, belonging to neither player. A successful isolated single-digit challenge therefore transfers no tiles. Failed challenges tax nothing. Taxed digit counts are saved and synchronized with online games; earlier saved games are preserved separately and are not silently converted to a different supply or reading rule.

## GitHub Pages

The site uses relative asset URLs and works at `https://yunhaixiang.github.io/primeria/` or another repository subpath. There is no build step and no application secret to configure.

1. In **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source.
2. Push to `main`, or run **Actions → Deploy GitHub Pages → Run workflow**.
3. The workflow runs the rule tests, packages only the website assets, and deploys them to Pages.

Alternatively, because the application files live in the repository root, **Deploy from a branch → main → /(root)** also works. In that case remove or disable the Actions deployment workflow to avoid competing deployments.

## Develop and test

Requires Node.js 20+ for tests and Python 3 for the convenience preview command. No npm install is needed.

```sh
npm test
npm start
```

Open `http://localhost:4173`. JavaScript modules require an HTTP server; opening `index.html` directly as a local file is not supported.

## Files

- `engine.js`: rules, inventories, exact challenge arithmetic, clocks, victory conditions.
- `app.js`: interface, sound synthesis, local saves, and online room synchronization.
- `styles.css`: responsive visual design and ten digit color themes.
- `tests/engine.test.js`: core game-rule and clock tests.
- `vendor/`: PeerJS and its MIT license.

Sound is synthesized locally with Web Audio and starts only after interaction. The interface respects reduced-motion preferences and includes keyboard-focus states and descriptive labels.
