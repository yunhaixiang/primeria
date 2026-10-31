/** Map displayed board coordinates to the fixed, stored board coordinates. */
export function logicalIndex(row, column, rotation = 0) {
  for (let q = 0; q < rotation % 4; q++) [row, column] = [14 - column, row];
  return row * 15 + column;
}
export function boardLabels(rotation = 0) {
  return {
    columns: Array.from({ length: 15 }, (_, c) =>
      rotation % 2
        ? String(Math.floor(logicalIndex(0, c, rotation) / 15) + 1)
        : String.fromCharCode(65 + (logicalIndex(0, c, rotation) % 15)),
    ),
    rows: Array.from({ length: 15 }, (_, r) =>
      rotation % 2
        ? String.fromCharCode(65 + (logicalIndex(r, 0, rotation) % 15))
        : String(Math.floor(logicalIndex(r, 0, rotation) / 15) + 1),
    ),
  };
}
export function boardHomeEdges(rotation = 0) {
  return { columns: rotation % 2, rows: 1 - rotation % 2 };
}
