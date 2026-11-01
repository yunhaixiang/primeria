# Primeria: How to Play

Primeria is a two-player board game invented by [Yunhai Xiang](https://yunhaimath.com/) that combines strategy with quick mental arithmetic.
Its name refers to prime numbers, such as 2, 3, 5 and 7. A prime is a natural number greater than 1 that cannot be written as the product of two smaller natural numbers.

## Setup

Play on a 15 × 15 board. Each player has 162 tiles: 18 copies of each digit from 1 to 9, marked in their colour. Both players’ reserves are visible.

| Tile | Digit(s) | Arrow | Copies per digit |
|---|---|---|---:|
| Regular | 4, 5, 6 | Straight | 18 |
| Regular | 2 | Bend left | 18 |
| Regular | 8 | Bend right | 18 |
| Junction | 1 | Straight + left + right | 18 |
| Junction | 3 | Straight + left | 18 |
| Junction | 7 | Straight + right | 18 |
| Junction | 9 | Left + right | 18 |

## Moves

Flip a coin to decide who goes first. Players take turns. Before your move, you may attempt one Challenge. Then Drop or Pass.

*Note: Two of your tiles are **connected** if they share an edge and their arrows connect. A **path** is a sequence of at least two of your tiles connected in the direction of the arrows. A **cycle** is a path whose last tile connects back to its first. A **segment** is a path whose first and last tiles are junction tiles. A **group** consists of your tiles connected through matching arrows, in either direction.*

**Drop.** Place one of your unused tiles on an empty square, choosing its arrow orientation. A junction must connect to one of your tiles when placed. A Drop is illegal if it creates a cycle. Tiles cannot be rotated after placement.

**Pass.** End your turn without placing a tile.

**Challenge.** Choose an opponent’s segment and read its number from the last tile to the first, against the arrows. Propose a positive integer factor greater than 1 and smaller than the number, then verify it with a calculator. If correct, remove all tiles in the segment and keep them as captures. Whether correct or not, then make your Drop or Pass.

*Note: On a virtual board, factor verification is automatic. Captured tiles stay out of play.*

## Endgame

Two consecutive passes end the game. A successful Challenge breaks the pass streak; a turn with a successful Challenge does not count as a pass.

First, remove all regular tiles that do not lie on a segment. Then remove all tiles in groups of fewer than nine. Give each removed tile to its owner’s opponent as a capture.

Score one point for each of your tiles left on the board and each tile you captured. The higher score wins; equal scores are a draw.

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

Your clock runs throughout your turn, including factor verification and removing captured tiles. Add the increment once, after your Drop or Pass.

## Tips

These divisibility tests can help you find factors:

1. A number is divisible by 2 if and only if its last digit is even.

2. A number is divisible by 5 if and only if its last digit is 0 or 5.

3. A number is divisible by 3 if and only if the sum of its digits is divisible by 3.

4. A number is divisible by 7 if and only if subtracting three times its last two digits from the remaining number gives a multiple of 7.

5. Alternately add and subtract the digits of the number. The number is divisible by 11 if and only if the result is divisible by 11.

6. A number is divisible by 13 if and only if subtracting nine times its last digit from the remaining number gives a multiple of 13.

7. Split the number into groups of three digits from the right, then alternately add and subtract the groups. The original number is divisible by 7 if and only if the result is divisible by 7. The same test works for 11 and 13.
