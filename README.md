# Primeria: How to Play

Primeria is a two person board game invented by [Yunhai Xiang](https://yunhaimath.com/) which combines clever strategies with quick mental arithmetic skills. The name of the game is a reference to [prime numbers](https://en.wikipedia.org/wiki/Prime_number), which are natural numbers greater than 1 that cannot be factored into the product of two smaller natural numbers: for example 2, 3, 5, and 7.

## Set-up

The game is played on a square board with 9 × 9, 11 × 11, 13 × 13, or 15 × 15 squares. Each player starts with a pile of 36 tiles labelled with digits 0 ~ 9. Each player gets 2 copies of 0 and 5 each, 3 copies of 2, 4, 6, and 8 each, and 5 copies of 1, 3, 7, and 9 each.

## Moves

Two players take turns to place tiles on the squares. Flip a coin to decide which player plays first. At each turn, the player chooses from one of three kinds of moves.

1. **Single Drop**: the player places one of their tiles on any empty square.

2. **Double Down**: the player places one of their tiles on an empty square adjacent to an existing tile on the board, and then places another one of their tiles on an empty square adjacent to an existing tile on the board (which could be the one just placed).

3. **Challenge**: the player points to a whole connected row or column of digits, and declares to *challenge* the number formed by this row or column (viewed left to right and top to bottom, from the player/challenger’s perspective). An attempt at a challenge is to write down a factor of the number, other than 1 or itself, and then verify it with a calculator. The longer the number, the more attempts the challenger gets: 1 ~ 3 digits get 1 attempt, 4 ~ 6 digits get 2 attempts, 7 ~ 9 digits get 3 attempts, and so on.

    - If an attempt succeeds: the number is removed from the board, and all but its ones digit is put into the opponent’s pile. The ones digit is put away, in neither player’s pile.

    - If all attempts fail: the number remains on the board, no tile is placed this turn, and the game moves on to the next turn.

The zero tile works slightly differently than others.

**Special Rule for Zero**: After each turn, no 0-tile can be placed in the first or last square in a connected row or column, nor a square without any adjacent tiles. If, as a result of removing tiles from a challenge, a 0-tile becomes the first or last square in a connected row or column, or becomes isolated without any adjacent tiles, then that 0-tile is immediately removed from the board and put away in neither player's pile.

## Winning

There are three ways to win a game (and one optional way).

1. Clear-out: a player wins by playing all the tiles in their pile.

2. Time: a player wins by their opponent running out of time.

3. Resignation: a player wins by their opponent resigning the game.

4. (Optional Rule) Tie-breaker: if the game extends for a long time, for example 1 hour, then the first player to have fewer tiles for 10 consecutive turns wins.

## Time Controls

Players can choose one of the following time controls.

| Mode | Time per player | Increment per turn |
| --- | --- | --- |
| Blitz | 10 minutes | 10 seconds |
| Rapid | 20 minutes | 20 seconds |
| Standard | 30 minutes | 30 seconds |
| Classical | 45 minutes | 60 seconds |
| Casual | Unlimited | — |

## Tips

A good strategy is to make use of the following facts:

1. a number is a multiple of 2 if and only if it ends in 0, 2, 4, 6, or 8,

2. a number is a multiple of 5 if and only if it ends in 0 or 5,

3. a number is a multiple of 3 if and only if the sum of its digits is a multiple of 3,

4. a number is a multiple of 7 if and only if subtracting 3 times its last two digits from the number formed by the remaining digits gives a multiple of 7,

5. a number is a multiple of 11 if and only if the alternating sum of its digits is a multiple of 11,

6. a number is a multiple of 13 if and only if subtracting 9 times its last digit from the number formed by the remaining digits gives a multiple of 13,

7. A number is a multiple of 7, 11, or 13 if and only if the alternating sum of its three-digit blocks is a multiple of 7, 11, or 13, respectively.
