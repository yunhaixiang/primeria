import { BOARD_SIZE } from "./engine.js?v=b0fb62c34b";
/** Map displayed board coordinates to the fixed, stored board coordinates. */
export function logicalIndex(row, column, rotation = 0) {
  for (let q = 0; q < rotation % 4; q++) [row, column] = [BOARD_SIZE - 1 - column, row];
  return row * BOARD_SIZE + column;
}
export function boardLabels(rotation = 0) {
  return {
    columns: Array.from({ length: BOARD_SIZE }, (_, c) =>
      rotation % 2
        ? String(Math.floor(logicalIndex(0, c, rotation) / BOARD_SIZE) + 1)
        : String.fromCharCode(65 + (logicalIndex(0, c, rotation) % BOARD_SIZE)),
    ),
    rows: Array.from({ length: BOARD_SIZE }, (_, r) =>
      rotation % 2
        ? String.fromCharCode(65 + (logicalIndex(r, 0, rotation) % BOARD_SIZE))
        : String(Math.floor(logicalIndex(r, 0, rotation) / BOARD_SIZE) + 1),
    ),
  };
}
