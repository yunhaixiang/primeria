# Primeria

A two-player board game of prime numbers on a 12 × 12 board, invented by [Yunhai Xiang](https://yunhaimath.com/posts/c219c1f/). A responsive, static website designed for GitHub Pages.

## Play

Choose **New Game** in the toolbar above the board, choose **On one device** or **Over the internet**, enter both names, select a clock, and choose who moves first (or flip a coin). Press **Start** when both players are ready. The same button changes to **Pause** during play and **Resume** while paused. Resign is the fourth option in the move panel and asks for confirmation before ending your game. Mute/Unmute (with a changing speaker icon) and Rotate are above the board; GitHub is beside the creator’s attribution in the footer.

- **Single Drop:** select a digit and any vacant square. Zero must share an edge with an existing tile.
- **Double Down:** select and place two tiles in order. Each must share an edge with an existing tile, including the tile just placed.
- **Challenge:** select the first and last tiles of a continuous horizontal or vertical sequence. Select the same tile twice for a one-digit challenge. Choose the reading direction, build a nontrivial factor with the colored 0–9 keypad, and submit. Use backspace to correct a digit; number keys also work. Correct challenges transfer the selected tiles to the opponent’s pile. Incorrect challenges consume the turn. Both clocks pause for the result; press Continue to start the opponent’s clock.

Placements are previews until committed. Clear a draft with the undo button or Escape. Digit keys select rack tiles. The rotation button turns the board 90 degrees while keeping coordinates attached to their original squares. Columns are labeled A–L and rows 1–12. These labels rotate with the board; move history uses coordinates such as A1 and L12. Counts for every digit are visible in the active rack and the opponent’s supply strip; player cards also expand to show inventories.

The first player to play every tile wins. Resignation and running out of time also end the game. The optional **Time Out Rule** requires the same player to have fewer tiles for a configurable number of consecutive completed moves after a configurable duration of active play. Enable it in New game to set **Time out after** (in minutes, default 60 = 1 hour) and **Consecutive moves** (default 10). A tie resets the streak; a new leader starts a new streak. Settings are preserved in saved games and online rooms.

### Time controls

| Mode | Per player | Increment per completed turn |
| --- | --- | --- |
| Blitz | 10 minutes | 10 seconds |
| Rapid | 20 minutes | 20 seconds |
| Standard | 30 minutes | 30 seconds |
| Classical | 45 minutes | 60 seconds |
| Casual | Unlimited | None |

Clocks run while choosing a move or finding a factor. Modal dialogs do not pause active play. Use Pause explicitly when both players agree. Shared-device games save in local browser storage and restore paused after a reload. Saved 10 × 10 games expand to 12 × 12 with tile coordinates, history, supplies, and clocks preserved. Closing a tab does not preserve a live online session.

### Online play

Select **New Game → Over the internet → Create a room**, choose the names, time control, and first move, then create the room and share its invitation link. Your friend opens it and selects **Join game**, or chooses **New Game → Over the internet → Join a friend** and pastes the link or room code. Reopen **New Game** to copy the invitation, leave the room, or (as host) start another game in the same room. Choose **On one device** to start a shared-device game. The host is player one, the guest is player two; either may have the first move. Only the host creates new games. Both players can pause, resume, acknowledge a challenge, or resign as themselves.

The host validates moves and maintains the authoritative clocks. No account or application backend is required. PeerJS 1.5.5 is vendored; its public PeerServer handles connection signaling, and game data travels over WebRTC between the browsers. Room IDs use cryptographic randomness and are shared through invitation links. Online play depends on that external signaling service and compatible network conditions; there is no hosted TURN relay, reconnection system, or competitive anti-cheat service. A connection loss pauses both clocks; leave the room to continue at a shared device or create a fresh room. Keep the host tab open and active during a game. Shared-device play needs no signaling service.

### Rule interpretations

The original article leaves a few edge cases open. This implementation treats adjacency as orthogonal; permits a contiguous part of a longer run to be challenged; interprets leading zeros numerically; excludes the value 1 from challenges; and allows 0 to be challenged with any integer factor greater than 1. For positive numbers, a proposed factor must be greater than 1 and smaller than the number. Verification uses exact integer arithmetic.

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
