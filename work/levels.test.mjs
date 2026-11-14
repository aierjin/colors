import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { ColorsGame } from './rules.mjs';
import { solve } from './solve.mjs';
import { exact } from './exact.mjs';
import { SwapGame, solveSwap } from './swap.mjs';
const levels = JSON.parse(fs.readFileSync(new URL('./levels.json', import.meta.url)));
assert.equal(levels.length, 46);
for (const [index, level] of levels.slice(0, 45).entries()) test('level ' + (index + 1), () => {
  const size = index < 9 ? 4 : 5;
  assert.equal(level.board.length, size);
  assert.ok(level.board.every(row => row.length === size && row.every(p => p.height >= 1 && p.height <= 4)));
  const game = new ColorsGame(level.board, level.single);
  if(index<20) assert.equal(game.activeColors.size, index >= 16 ? 7 : index >= 12 ? 6 : index >= 9 || [6,8].includes(index) ? 5 : 4);
  for (const color of game.activeColors) {
    const group = level.board.flat().filter(p => p.color === color);
    assert.ok(group.length >= 2 && new Set(group.map(p => p.height)).size >= 2);
  }
  const proof = size === 5 ? exact(level.board, level.minimum - 1, 5000000, level.single ? 0 : null) : solve(level.board, 1900000, level.minimum - 1);
  assert.equal(proof.route, null);
  assert.equal(level.route.length, level.minimum);
  for (const click of level.route) {
    assert.ok(game.begin(Math.floor((click % (size * size)) / size), click % size, click >= size * size));
    game.finish();
  }
  assert.equal(game.activeColors.size, 0);
  assert.equal(level.limit, [8,9,18,19,20].includes(index + 1) ? level.minimum + 2 : null);
  if (index > 0 && index<20) assert.ok(level.minimum >= levels[index - 1].minimum);
  const seconds = [41,43,44].includes(index) ? 120
    : (index>=20 && index<25) || [31,37,38,40].includes(index) ? 60 : undefined;
  assert.equal(level.seconds, seconds);
  assert.equal(level.board.flat().some(p=>p.sync),(index>=25&&index<30)||(index>=32&&index<35)||[38,39,41,42,43,44].includes(index));
});

test('level 46 teaches a cross-height swap and has a shortest route to clear', () => {
  const { stacks, route, minimum, limit, seconds } = levels[45];
  const game = new SwapGame(stacks, 4);
  assert.equal(game.activeColors.size, 3);
  assert.equal(limit, null);
  assert.equal(seconds, undefined);
  const openingGroups = new Map();
  for (const stack of stacks.filter(s => s.length)) {
    const key = stack.length + ':' + stack.at(-1);
    openingGroups.set(key, (openingGroups.get(key) ?? 0) + 1);
  }
  assert.ok([...openingGroups.values()].every(count => count < 3));
  const [a, b] = route[0];
  assert.notEqual(stacks[a].length, stacks[b].length);
  assert.equal(game.swap(a, 0), null);
  const waves = game.swap(a, b);
  assert.equal(waves.length, 1);
  assert.deepEqual(waves[0].map(p => [p.height, p.color]), [[2, 0], [2, 0], [2, 0]]);
  assert.equal(game.stacks[a].length, stacks[a].length);
  assert.equal(game.stacks[a].at(-1), stacks[b].at(-1));
  assert.ok(game.undo());
  assert.deepEqual(game.stacks, stacks);
  assert.equal(game.steps, 0);
  assert.equal(solveSwap(stacks, 4).route?.length, minimum);
  for (const [from, to] of route) assert.notEqual(game.swap(from, to), null);
  assert.equal(game.steps, minimum);
  assert.equal(game.activeColors.size, 0);
  game.reset();
  assert.deepEqual(game.stacks, stacks);
});

test('level 36 first clear grants one charge, second clear uses it, and undo restores it', () => {
  const {board,route} = levels[35];
  const game = new ColorsGame(board,true);
  assert.equal(game.begin(0,0,true),null);
  const first = route[0];
  assert.equal(game.begin(Math.floor(first/5),first%5).length,5);
  assert.equal(new Set(game.finish().map(p=>p.color)).size,1);
  assert.equal(game.singleCharge,1);
  const second = route[1]-25;
  assert.equal(game.begin(Math.floor(second/5),second%5,true).length,1);
  assert.equal(new Set(game.finish().map(p=>p.color)).size,1);
  assert.equal(game.singleCharge,2);
  assert.ok(game.undo());
  assert.equal(game.singleCharge,1);
  assert.ok(game.undo());
  assert.equal(game.singleCharge,0);
});




