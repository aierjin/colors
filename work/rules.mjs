import { ChainReactionSystem } from './yellow-move.mjs';

export function move(board, row, col, single = false) {
  return ChainReactionSystem.apply(board, row, col, undefined, single);
}

export function clearGroups(board) {
  const groups = new Map();
  board.forEach((line, row) => line.forEach((piece, col) => {
    if (!piece) return;
    if (!groups.has(piece.color)) groups.set(piece.color, []);
    groups.get(piece.color).push({ row, col, ...piece });
  }));
  const matches = [...groups.values()].filter(group =>
    group.every(piece => piece.height === group[0].height)
  ).flat();
  for (const { row, col } of matches) board[row][col] = null;
  return matches;
}

const copy = board => board.map(row => row.map(piece => piece && { ...piece }));

export class ColorsGame {
  constructor(initial, singleEnabled = false) {
    this.initial = copy(initial);
    this.singleEnabled = singleEnabled;
    this.reset();
  }

  get steps() { return this.history.length; }
  get activeColors() { return new Set(this.board.flat().filter(Boolean).map(piece => piece.color)); }

  begin(row, col, single = false) {
    if (this.moving || !this.board[row]?.[col] || (single && this.singleCharge !== 1)) return null;
    this.history.push({board:copy(this.board), singleCharge:this.singleCharge});
    if (single) this.singleCharge = 2;
    this.moving = true;
    return move(this.board, row, col, single);
  }

  finish() {
    if (!this.moving) return [];
    this.moving = false;
    const matches = clearGroups(this.board);
    if (this.singleEnabled && this.singleCharge === 0 && matches.length) this.singleCharge = 1;
    return matches;
  }

  undo() {
    if (!this.steps) return false;
    const snapshot = this.history.pop();
    this.board = snapshot.board;
    this.singleCharge = snapshot.singleCharge;
    this.moving = false;
    return true;
  }

  reset() {
    this.board = copy(this.initial);
    this.history = [];
    this.singleCharge = 0;
    this.moving = false;
  }
}
