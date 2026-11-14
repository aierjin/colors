import fs from 'node:fs';
import path from 'node:path';
import { solveSwap } from './swap.mjs';

const source = '.';
const read = file => fs.readFileSync(file, 'utf8');
const stripModule = text => text.replace(/^import .+;\r?\n/gm, '').replace(/^export /gm, '');
const library = read(path.join(source, 'vendor/three.module.js'))
  .replace(/^export \{.*\};\s*$/m, '')
  .replace(/^\/\/# sourceMappingURL=.*$/m, '');
const exports = [
  'MathUtils', 'Scene', 'OrthographicCamera', 'Vector3', 'Vector2', 'Raycaster', 'BoxGeometry',
  'MeshPhysicalMaterial', 'Mesh', 'CanvasTexture', 'SRGBColorSpace', 'PlaneGeometry',
  'MeshBasicMaterial', 'Color', 'HemisphereLight', 'DirectionalLight', 'WebGLRenderer',
  'ACESFilmicToneMapping', 'Group',
];
const emptyDemo = process.argv.includes('--empty-demo');
const demo = emptyDemo || process.argv.includes('--free-swap');
let levels = JSON.parse(read('work/levels.json'));
if (emptyDemo) {
  const level = JSON.parse(read('work/swap-chapter.json'))[6];
  const { route } = solveSwap(level.stacks, level.board.length, 250000, false, true);
  levels = [{ ...level, name: '空格试玩', displayNumber: 7, demo: true, allowEmpty: true, route, minimum: route.length }];
} else if (demo) {
  const level = levels[45];
  const { route } = solveSwap(level.stacks, 4);
  levels = [{ ...level, name: '相邻交换', demo: true, minimum: route.length }];
} else {
  const keep = [1,2,3,4,6,7,8,9,10,11,13,15,16,17,18,20,21,25,26,27,29,30,33,35,36,38,39,42,44,45];
  const swaps = JSON.parse(read('work/swap-chapter.json'));
  if (swaps.length !== 30) throw new Error('The swap chapter requires 30 boards');
  levels = [...swaps, ...keep.map(n => ({ ...levels[n - 1], originalIndex: n - 1 }))];
  const {carry: fullCarry} = JSON.parse(read('work/full-release.json'));
  const {swap: fullSwap} = JSON.parse(read('work/full-swaps-selected.json'));
  if (fullCarry.length !== 20 || fullSwap.length < 4) throw new Error('Missing full boards');
  [4,9,15,23].forEach((index, i) => {
    levels[index] = {...levels[index], ...fullSwap[i], name:'满盘交换', limit:null};
  });
  const [intro, ...carryLevels] = fullCarry;
  carryLevels.sort((a,b) => a.route.length-b.route.length || a.high-b.high);
  const carry = [intro,...carryLevels].map((level, index) => ({
    ...level, name:index===0?'错层移位':({8:'限步移位',11:'限时移位',16:'限步进阶',19:'满盘终章'})[index]??`满盘 · ${level.colors} 色`,
    carry:true, carryLesson:index===0, carryIndex:index-1, allowEmpty:true,
    limit:[8,16].includes(index)?level.route.length+2:null,
    seconds:({11:150,15:150,19:180})[index],
  }));
  const interlude = [0,1,2,3,5,6,7,9,12,17].map(index => ({
    ...carry[index], name:index===0?'错层移位':`满盘 · ${carry[index].colors} 色`, seconds:undefined, limit:null,
  }));
  levels = [...levels.slice(30), ...interlude, ...levels.slice(0,30).map((level, swapIndex) => ({...level,swapIndex}))];
}
const code = [
  '(function () { "use strict";',
  'const THREE = (() => {',
  read(path.join(source, 'vendor/LICENSE-three.txt')).replace(/^/, '/*\n').concat('\n*/'),
  library,
  'return { ' + exports.join(', ') + ' }; })();',
  'const LEVELS = ' + JSON.stringify(levels) + ';',
  ...['yellow-move', 'yellow-camera', 'rules', 'solve', 'exact', 'swap', 'colors-app'].map(name => stripModule(read('work/' + name + '.mjs'))),
  '})();',
].join('\n');
if (/<\/script/i.test(code)) throw new Error('Unexpected script end tag in the inline build');
let html = read('work/colors.html')
  .replace('/* COLORS_CSS */', () => '\n' + read('work/colors.css'))
  .replace('/* COLORS_SCRIPT */', () => '\n' + code);
if (demo) {
  html = html.replaceAll("colors-ratings", "colors-adjacent-ratings")
    .replaceAll("colors-completed", "colors-adjacent-completed");
}
if (emptyDemo) html = html.replace('<p><strong>同色顶层', '<p><strong>先点柱子，再点相邻空格</strong>，就能把顶层软糖移过去。这算一步。</p><p><strong>同色顶层');
fs.writeFileSync(emptyDemo ? 'colors-empty-demo.html' : demo ? 'colors-free-swap.html' : 'index.html', html);

