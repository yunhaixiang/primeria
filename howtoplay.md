# Primeria: How to Play

Primeria is a two-player board game invented by [Yunhai Xiang](https://yunhaimath.com/) that combines strategy with quick mental arithmetic.
Its name refers to prime numbers, such as 2, 3 and 5. A prime is a natural number greater than 1 that cannot be written as the product of two smaller natural numbers.

## Setup

The game is played on a 15 × 15 board. Blue's **home edges** are north and south; Orange's are east and west. There are two kinds of tiles:

**Regular tiles** carry one of the digits 0, 2, 4, 5, 6 or 8 and a straight arrow, a left bend or a right bend.

**Junction tiles** carry one of the digits 1, 3, 7 or 9 and a fork arrow: straight + left, straight + right, left + right, or straight + left + right.

Each tile shows the same digit on both sides. The **arrow side** also shows its arrow, while the **digit side** indicates which arrow appears on the back.

Each digit has one arrow type. Each player has 150 tiles, with 15 copies of each digit:

| Tile | Digit(s) | Arrow | Copies per digit |
|---|---|---|---:|
| Regular | 0 | Left bend | 15 |
| Regular | 2, 4, 6, 8 | Straight | 15 |
| Regular | 5 | Right bend | 15 |
| Junction | 1 | Straight + left + right | 15 |
| Junction | 9 | Left + right | 15 |
| Junction | 3 | Straight + left | 15 |
| Junction | 7 | Straight + right | 15 |

## Moves

Players take turns. Flip a coin to decide who goes first. Before your move, you may attempt one Challenge. Then choose one move: Drop, Claim or Pass.

*Note: Tiles are **adjacent** if they share an edge. A **path** is a sequence of at least two arrow-side tiles belonging to the same player, connected in the direction of the arrows. A **cycle** is a path whose last tile connects back to its first. A **segment** is a path whose endpoints are junction tiles or regular tiles with exactly one connection.*

**Drop.** Place one of your unused tiles on an empty square, digit side up.

**Claim.** Flip at least 2 of your digit-side-up tiles on the board to form a connected network of arrows. Then capture every surrounded unclaimed enemy tile.

A tile is **surrounded** if no horizontal or vertical route connects its square to either of its owner's home edges without crossing an opponent's claimed tile. All other tiles are ignored when checking the route. Claimed tiles cannot be captured by surrounding.

**Challenge.** Choose an opponent's segment and read its number from the last tile to the first. Propose a factor other than 1 or the number itself, then check it with a calculator. If correct, capture all tiles in the segment. Whether correct or not, continue with your move. A Challenge costs no tile and does not end your turn.

*Note: On a virtual board, the program checks your proposed factor automatically. Captured tiles stay out of play and score one point each for the capturer.*

**No Cycle Rule:** A Claim is illegal if it creates a cycle on the board.

**No Leading Zero Rule.** A Claim is illegal if any segment would begin with 0 when read from the last tile to the first. After a capture, any 0 that becomes a leading digit is captured by its owner's opponent.

**No Isolated Arrow Rule.** After a capture, every arrow-side tile with no connections is captured by its owner's opponent.

*Note: After a capture, apply both removal rules until neither removes a tile.*

**Pass.** End your turn without a Drop or Claim.

## Endgame

The game ends after two consecutive passes. A turn with a successful Challenge does not count as a pass. Give all unclaimed tiles and all claimed groups of fewer than nine tiles to their owners' opponents as captured tiles. A **group** consists of claimed tiles connected through matching arrows, in either direction.

Score one point for each claimed tile in a group of at least nine and each captured tile. Empty squares do not score. The player with the higher score wins; equal scores result in a draw.

A player also loses by resigning or running out of time.

## Time Controls

Choose a time control before starting.

| Mode | Starting time per player | Increment per completed turn |
|---|---:|---:|
| Blitz | 10 minutes | 10 seconds |
| Rapid | 20 minutes | 20 seconds |
| Standard | 30 minutes | 30 seconds |
| Classical | 45 minutes | 60 seconds |
| Casual | No clock | — |

Your clock runs throughout your turn, including the optional Challenge and removing captured tiles. The increment is added once, after your Drop, Claim or Pass.

## Tips

These divisibility tests can help you find factors:

1. A number is divisible by 2 if and only if its last digit is even.

2. A number is divisible by 5 if and only if its last digit is 0 or 5.

3. A number is divisible by 3 if and only if the sum of its digits is divisible by 3.

4. A number is divisible by 7 if and only if subtracting three times its last two digits from the remaining number gives a multiple of 7.

5. Alternately add and subtract the digits of the number. The number is divisible by 11 if and only if the result is divisible by 11.

6. A number is divisible by 13 if and only if subtracting nine times its last digit from the remaining number gives a multiple of 13.

7. Split the number into groups of three digits from the right, then alternately add and subtract the groups. The original number is divisible by 7 if and only if the result is divisible by 7. The same test works for 11 and 13.
