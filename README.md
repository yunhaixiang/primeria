# Primeria: How to Play

Primeria is a two-player board game invented by [Yunhai Xiang](https://yunhaimath.com/) which combines clever strategies with quick mental arithmetic skills. The name of the game is a reference to [prime numbers](https://en.wikipedia.org/wiki/Prime_number), which are natural numbers greater than 1 that cannot be factored into the product of two smaller natural numbers: for example 2, 3, 5, and 7.

[Click here to play](https://yunhaixiang.github.io/primeria/).

For a physical set, see the [cutout folder](cutout/), which contains printable A2 boards in all four sizes, rounded tiles, and tile plates. The [printing instructions](cutout/README.md) explain the paper sizes, materials, and cutting process.

## Set-up

The game is played on a square board with 9 × 9, 11 × 11, 13 × 13, or 15 × 15 squares. Each player starts with a pile of 36 tiles labelled with digits 0 ~ 9. Each player gets 2 copies of 0 and 5 each, 3 copies of 2, 4, 6, and 8 each, and 5 copies of 1, 3, 7, and 9 each.

## Moves

Players take turns making moves. Flip a coin to decide which player plays first. At each turn, the player chooses from one of three kinds of moves.

1. **Single Drop**: Place one tile on any empty square.

2. **Double Down**: Place two tiles, one at a time. Each tile must be placed adjacent to a tile already on the board when it is placed. After both placements, the two newly placed tiles must belong to the same uninterrupted horizontal or vertical run.

3. **Challenge**: Declare a number on the board to challenge, formed by an uninterrupted horizontal or vertical run of tiles, read from left to right or top to bottom, from the challenger’s perspective. The challenger gets one or more attempts to challenge this number depending on its length: 1 ~ 3 digits get 1 attempt, 4 ~ 6 digits get 2 attempts, 7 ~ 9 digits get 3 attempts, and so on. An attempt consists of a proposal of a factor of the number, other than 1 or itself, and then, depending on whether the game is being played over the board or on a screen, either the challenger verifies the factor with a calculator, or the computer checks it automatically. The clock does not stop during calculator verification.

    - If an attempt succeeds: the number is removed from the board, and all but its ones digit is put into the opponent’s pile. The ones digit is put away, in neither player’s pile.

    - If all attempts fail: the number remains on the board, no tile is placed this turn, and the game moves on to the next turn.

Two tiles are **adjacent** if their squares share an edge. Diagonal contact does not count. A tile is **isolated** if it has no adjacent tiles.

**Special Rule for Zero**: At the end of a turn, no 0-tile may be isolated or lie at either end of a number. For Double Down, this restriction is checked after both tiles have been placed. Additionally, if, as a result of removing tiles from a challenge, a 0-tile becomes the first or last square in an uninterrupted horizontal or vertical run of tiles, or becomes isolated, then that 0-tile is immediately removed from the board and put away, in neither player's pile.

## Winning

There are three ways to win a game (and one optional way).

1. Clear-out: a player wins by playing all the tiles in their pile.

2. Time: a player wins by their opponent running out of time.

3. Resignation: a player wins by their opponent resigning the game.

4. (Optional Rule) Tie-breaker: After the selected time limit is reached, a player wins by having fewer tiles than their opponent after 10 consecutive completed turns, counting both players’ turns. Equal pile sizes reset the count.

## Time Controls

Players can choose one of the following time controls.

| Mode | Time per player | Increment per turn |
| --- | --- | --- |
| Blitz | 10 minutes | 10 seconds |
| Rapid | 20 minutes | 20 seconds |
| Standard | 30 minutes | 30 seconds |
| Classical | 45 minutes | 60 seconds |

## Tips

A good strategy is to make use of the following facts:

1. A number is a multiple of 2 if and only if it ends in 0, 2, 4, 6, or 8.

2. A number is a multiple of 5 if and only if it ends in 0 or 5.

3. A number is a multiple of 3 if and only if the sum of its digits is a multiple of 3.

4. A number is a multiple of 7 if and only if subtracting 3 times its last two digits from the number formed by the remaining digits gives a multiple of 7.

5. A number is a multiple of 11 if and only if the alternating sum of its digits is a multiple of 11.

6. A number is a multiple of 13 if and only if subtracting 9 times its last digit from the number formed by the remaining digits gives a multiple of 13.

7. A number is a multiple of 7, 11, or 13 if and only if the alternating sum of its three-digit blocks, formed starting from the right, is a multiple of 7, 11, or 13, respectively.
