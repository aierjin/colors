import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { solve } from './solve.mjs';
import { move, clearGroups, ColorsGame } from './rules.mjs';

const candy = (color, height, direction) => ({ color, height, direction });

test('the hint solver proves the opening optimum and returns legal continuations', () => {
  const { board } = JSON.parse(fs.readFileSync(new URL('./level.json', import.meta.url)));
  assert.deepEqual(solve(board, 220000, 5), { route: null });
  const game = new ColorsGame(board);
  for (let remaining = 6; remaining > 0; remaining--) {
    const { route } = solve(game.board);
    assert.equal(route.length, remaining);
    assert.ok(game.begin(route[0] >> 2, route[0] % 4));
    game.finish();
  }
  assert.equal(game.activeColors.size, 0);
});

test('cross uses individual directions, bounces at 1 and 4, and skips holes', () => {
  const board = [
    [candy('a', 3, 1), candy('b', 4, 1), null],
    [null, candy('a', 2, -1), candy('b', 1, -1)],
    [candy('a', 2, 1), candy('a', 3, 1), candy('b', 3, -1)],
  ];
  assert.equal(move(board, 1, 0).length, 0);
  assert.equal(move(board, 1, 1).length, 4);
  assert.deepEqual(board, [
    [candy('a', 3, 1), candy('b', 3, -1), null],
    [null, candy('a', 1, 1), candy('b', 2, 1)],
    [candy('a', 2, 1), candy('a', 4, -1), candy('b', 3, -1)],
  ]);
});

test('authored 4x4 layout has 16 pillars and the solution reaches a simultaneous final clear', () => {
  const { board, route, clears } = JSON.parse(fs.readFileSync(new URL('./level.json', import.meta.url)));
  assert.equal(board.length, 4);
  assert.ok(board.every(row => row.length === 4 && row.every(piece => piece.height >= 1 && piece.height <= 4)));
  const game = new ColorsGame(board);
  assert.equal(game.activeColors.size, 4);
  for (const color of game.activeColors) {
    const group = board.flat().filter(piece => piece.color === color);
    assert.equal(group.length, 4);
    assert.ok(new Set(group.map(piece => piece.height)).size >= 2);
  }
  const counts = route.map(([row, col]) => {
    assert.ok(game.begin(row - 1, col - 1));
    return game.finish().length;
  });
  assert.deepEqual(counts, clears);
  assert.equal(game.activeColors.size, 0);
  assert.ok(game.undo());
  assert.equal(game.activeColors.size, 2);
});

test('one resolve removes both dispersed groups and leaves survivors in place', () => {
  const board = [
    [candy('a', 3, 1), candy('b', 1, 1), candy('c', 2, 1)],
    [candy('c', 3, -1), candy('a', 3, -1), candy('b', 1, 1)],
  ];
  assert.equal(clearGroups(board).length, 4);
  assert.deepEqual(board, [
    [null, null, candy('c', 2, 1)],
    [candy('c', 3, -1), null, null],
  ]);
});

test('one undo restores all eliminated colors, directions and click count', () => {
  const initial = [
    [candy('a', 3, 1), candy('b', 2, 1)],
    [candy('b', 4, -1), candy('a', 4, -1)],
  ];
  const game = new ColorsGame(initial);
  assert.ok(game.begin(0, 0));
  assert.equal(game.begin(0, 1), null);
  assert.equal(game.finish().length, 4);
  assert.equal(game.begin(1, 1), null);
  assert.ok(game.undo());
  assert.equal(game.steps, 0);
  assert.deepEqual(game.board, initial);
  game.begin(0, 0);
  game.finish();
  game.reset();
  assert.deepEqual(game.board, initial);
  assert.equal(game.steps, 0);
});
