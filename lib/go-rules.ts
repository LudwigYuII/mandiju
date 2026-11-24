export type Stone = 0 | 1 | 2;
export const boardSize = 9;
export const emptyBoard = '0'.repeat(boardSize ** 2);

function neighbors(index: number) {
  const row = Math.floor(index / boardSize);
  const column = index % boardSize;
  return [
    ...(row > 0 ? [index - boardSize] : []),
    ...(row < boardSize - 1 ? [index + boardSize] : []),
    ...(column > 0 ? [index - 1] : []),
    ...(column < boardSize - 1 ? [index + 1] : []),
  ];
}

function group(board: string[], origin: number) {
  const color = board[origin];
  const points = new Set([origin]);
  const boundary = new Set<string>();
  for (const point of points) {
    for (const adjacent of neighbors(point)) {
      if (board[adjacent] === color) points.add(adjacent);
      else boundary.add(board[adjacent]);
    }
  }
  return { points, boundary };
}

/** Chinese area scoring, 9×9, positional superko and no suicide. */
export function placeStone(position: string, point: number, color: 1 | 2, history: ReadonlySet<string>) {
  if (!Number.isInteger(point) || point < 0 || point >= emptyBoard.length || position[point] !== '0')
    throw new Error('请选择空交叉点');
  const board = position.split('');
  const own = String(color);
  const opponent = String(3 - color);
  board[point] = own;
  for (const adjacent of neighbors(point)) {
    if (board[adjacent] !== opponent) continue;
    const captured = group(board, adjacent);
    if (!captured.boundary.has('0')) {
      for (const stone of captured.points) board[stone] = '0';
    }
  }
  if (!group(board, point).boundary.has('0')) throw new Error('此处落子无气');
  const next = board.join('');
  if (history.has(next)) throw new Error('不能重现此前的棋形');
  return next;
}

/** Score the agreed position after removing the dead groups marked by both players. */
export function areaScore(position: string, dead: ReadonlySet<number>) {
  const board = position.split('');
  for (const point of dead) {
    if (!Number.isInteger(point) || point < 0 || point >= board.length || position[point] === '0')
      throw new Error('请选择棋盘上的死子');
    for (const stone of group(position.split(''), point).points) board[stone] = '0';
  }
  const score = { black: 0, white: 7.5 };
  const seen = new Set<number>();
  for (let point = 0; point < board.length; point++) {
    if (board[point] === '1') score.black++;
    else if (board[point] === '2') score.white++;
    else if (!seen.has(point)) {
      const region = group(board, point);
      for (const empty of region.points) seen.add(empty);
      if (region.boundary.size === 1) {
        if (region.boundary.has('1')) score.black += region.points.size;
        else score.white += region.points.size;
      }
    }
  }
  return score;
}
