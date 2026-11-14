import fs from 'node:fs';
import assert from 'node:assert/strict';
import {exchange,SwapGame} from './swap.mjs';
const carry=JSON.parse(fs.readFileSync('work/full-release.json')).carry;
const swap=JSON.parse(fs.readFileSync('work/full-swaps-selected.json')).swap;
for(const [levels,move] of [[carry,true],[swap,false]]){
 for(const level of levels){
  assert.equal(level.stacks.length,16);
  assert.ok(level.stacks.every(s=>s.length>=1&&s.length<=4));
  const tops=level.stacks.map(s=>s.length+':'+s.at(-1));
  assert.ok(tops.every(k=>tops.filter(x=>x===k).length<3));
  const game=new SwapGame(level.stacks,4,false,move,move);
  const heights=[];
  for(const pair of level.route){
   const waves=game.swap(...pair);
   assert.ok(waves);
   heights.push(...waves.flat().map(p=>p.height));
  }
  assert.equal(game.activeColors.size,0);
  if(move)assert.ok(heights.some(h=>h>1));
 }
}
console.log('20 carry boards, 4 swap boards: fully occupied, no opening matches, playable routes');
