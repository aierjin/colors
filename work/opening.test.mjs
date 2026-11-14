import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {solve} from './solve.mjs';
import {ColorsGame} from './rules.mjs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const levels=JSON.parse(html.match(/const LEVELS = (.*);/)[1]);
test('opening practice is unrestricted and the reference routes are shortest',()=>{
 assert.equal(levels.length,70);
 for(const [offset,level] of levels.slice(1,7).entries()){
  const size=level.board.length;
  assert.equal(size,offset<3?3:4);
  assert.equal(level.minimum,[2,3,3,4,5,6][offset]);
  assert.equal(level.limit,null);
  assert.equal(level.seconds,undefined);
  const proof=solve(level.board,200000,level.minimum);
  assert.equal(proof.route?.length,level.minimum);
  const game=new ColorsGame(level.board);
  assert.ok(level.board.flat().every(Boolean));
  for(const tile of level.route){
   assert.ok(game.begin(Math.floor(tile/size),tile%size));
   game.finish();
  }
  assert.equal(game.activeColors.size,0);
 }
 assert.equal(levels[7].limit,10);
});
