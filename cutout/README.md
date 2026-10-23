# Primeria cutout kit

Single-sheet A2 boards for every supported game size: 9 x 9, 11 x 11, 13 x 13, and 15 x 15. The kit also includes a reusable 36-tile sheet and a uniform tile plate with an attached extra-tile row. Print the tile sheet and tile plate twice for two players (72 tiles total). Colors and tile quantities come from the website's current `styles.css` and `engine.js`.

## Files

All board PDFs use **A2 paper (420 x 594 mm), portrait**, one page per board. Print the size you want; there is no assembly across sheets.

| File | Grid | Finished board, including coordinate border |
| --- | --- | --- |
| **board-9x9-A2.pdf** | 9 x 9 | 254 x 254 mm |
| **board-11x11-A2.pdf** | 11 x 11 | 306 x 306 mm |
| **board-13x13-A2.pdf** | 13 x 13 | 358 x 358 mm |
| **board-15x15-A2.pdf** | 15 x 15 | 400 x 400 mm |

All grids have **26 mm squares** and fit the same 24 mm tiles. The 15 x 15 board uses a narrower 5 mm coordinate border to keep 10 mm clear margins on A2; the other boards have 10 mm borders. Columns use capital letters and rows use numbers, with labels readable from opposite seats.

- **tiles-two-player-set.pdf** - one reusable US Letter portrait page with 36 rounded tiles and no player labels. Print two copies: 72 tiles total.
- **tile-bars-4x9.pdf** - one reusable US Letter landscape page with a connected 36-slot main grid and 9-slot extra-tile row. Print two copies, one for each player. Cut the entire plate as one piece.

## Printing and cutting

1. Print in color, single-sided, at **Actual Size / 100%**. Turn off Fit, Shrink, and Scale to Page. For every board, use **A2 (420 x 594 mm), portrait**, in **90-120 gsm matte paper**, then mount on 1-2 mm cardboard. For tiles, use **US Letter (8.5 x 11 in), portrait**; for tile plates, use **US Letter (11 x 8.5 in), landscape**. Use **200-250 gsm matte cardstock** for tiles and plates. If your printer cannot feed that card weight, print on matte paper and glue it to cardboard. Every PDF states its paper size, orientation, and recommended material.
2. Measure a printed 50 mm scale before cutting. Board squares and tile-plate slots are 26 mm; loose tiles are 24 mm, leaving room around their edges. Do not enlarge the smaller boards to fill A2: their squares must remain compatible with the tiles.
3. Trim the chosen board at its green outer edge, using the corner marks. Mount it on 1-2 mm cardboard. Each board is a single piece with no joins.
4. Cut the tiles along their thin rounded outlines (2 mm corner radius), discarding the white gutters. Print directly on suitable card, or glue the sheets to cardboard before cutting. All tiles have digits on four sides; 6 and 9 are underlined.
5. Cut around the tile plate's single outer rectangle. **Keep the main grid and extra-tile row connected; do not cut apart individual slots.** The pale main-grid slots and full-color stripes match the loose tiles; a filled slot is visibly darker than an empty one. The attached extra-tile row has nine blank slots for any digits.

## Using the tile bars

The grid is **4 rows by 9 columns**. Fill each slot with its printed digit at the start. The small fraction in an empty slot identifies its position within that digit's starting supply. Leave gaps as tiles are played, so the opponent can see which starting slots are empty.

The uniform template uses this arrangement, read from top to bottom:

```text
1 1 1 1 1 2 2 2 0
3 3 3 3 3 4 4 4 0
7 7 7 7 7 6 6 6 5
9 9 9 9 9 8 8 8 5
```

Each player's starting pile has 2 copies each of 0 and 5; 3 each of 2, 4, 6, and 8; and 5 each of 1, 3, 7, and 9. Challenges can give a player more tiles of a digit than the starting slots hold. Put those additional tiles on the attached **1 x 9 extra-tile row** below the main grid, clearly visible to both players. Its blank slots accept any digits. The plate does not limit a pile's size.

## Regenerating

From the repository root, run `python3 cutout/generate.py` with ReportLab installed. The generator uses the bundled website fonts and current digit colors. All artwork is vector-based with embedded fonts.
