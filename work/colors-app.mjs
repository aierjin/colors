import { ColorsGame, move } from './rules.mjs';
import { solve } from './solve.mjs';
import { exact } from './exact.mjs';
import { SwapGame, adjacent, exchange, solveSwap, swapTops } from './swap.mjs';
import { createCameraState, dragOrbit, restoreCamera } from './yellow-camera.mjs';

const $ = id => document.getElementById(id);
const stage = $('stage');
const palette = [
  { name: '莓果粉', hex: 0xf44981, chip: '#f34f87' },
  { name: '蜜橘黄', hex: 0xffa316, chip: '#ffac22' },
  { name: '青苹果绿', hex: 0x0ac7a0, chip: '#21ba95' },
  { name: '蓝莓蓝', hex: 0x575eea, chip: '#6464ed' },
  { name: '葡萄紫', hex: 0xa52ac3, chip: '#bd45cf' },
  { name: '草莓红', hex: 0xce302d, chip: '#c9342d' },
  { name: '汽水青', hex: 0x09a9e7, chip: '#1baeea' },
];
const HOME_PITCH = 54;
const YAW = -.46;
const CELL = 1.22;
const LAYER = .55;
const FLOOR = .095;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = THREE.MathUtils.clamp;
let levelIndex = 0;
let level = LEVELS[0];
let game = level.stacks ? new SwapGame(level.stacks, level.board.length, level.freeSwap, level.allowEmpty, level.carry) : new ColorsGame(level.board);
let size = level.board.length;
const rowOf = index => Math.floor(index / size);
const colOf = index => index % size;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, .1, 60);
const cameraState = createCameraState(YAW);
const target = new THREE.Vector3(0, .74, 0);
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const point = new THREE.Vector3();
const cameraDirection = new THREE.Vector3();
const sceneCenter = new THREE.Vector3();
const lookAt = new THREE.Vector3();

function box(width, height, depth, radius) {
  const shape = new THREE.BoxGeometry(2, 2, 2, 10, 10, 10);
  const positions = shape.attributes.position;
  const normals = shape.attributes.normal;
  const half = [width / 2, height / 2, depth / 2];
  const normal = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    const xyz = [positions.getX(i), positions.getY(i), positions.getZ(i)];
    const inner = xyz.map(value => clamp(value, -.6, .6));
    normal.set(xyz[0] - inner[0], xyz[1] - inner[1], xyz[2] - inner[2]).normalize();
    const rounded = inner.map((value, axis) =>
      value / .6 * (half[axis] - radius) + normal.getComponent(axis) * radius
    );
    positions.setXYZ(i, ...rounded);
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
  return shape;
}

const surface = (color, extra) => new THREE.MeshPhysicalMaterial({ color, roughness: .36, ...extra });
const candyShape = box(1.13, .525, 1.13, .124);
const base = new THREE.Mesh(box(5.23, .31, 5.23, .145), surface(0xd3abda, { roughness: .57 }));
base.position.y = -.19;
scene.add(base);
const rim = new THREE.Mesh(box(5.24, .135, 5.24, .064), surface(0xffeee3));
rim.position.y = -.039;
scene.add(rim);
const tileShape = box(1.19, .105, 1.19, .051);
const wellShape = box(1.04, .035, 1.04, .017);
const tileMaterial = surface(0xeee0f3, { roughness: .66 });
const wellMaterial = surface(0xd3b9dd, { roughness: .8 });
const edgeShape = box(1.16, .037, 1.16, .018);
const edgeMaterial = surface(0xfff3f1, { roughness: .58 });
const candyMaterials = palette.map(({ hex }) => surface(hex, {
  metalness: 0, clearcoat: .36, clearcoatRoughness: .26, roughness: .31, sheen: .26,
  sheenColor: new THREE.Color(0xffc9e7), sheenRoughness: .64,
}));

function texture(width, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = width;
  paint(canvas.getContext('2d'), width);
  const result = new THREE.CanvasTexture(canvas);
  result.colorSpace = THREE.SRGBColorSpace;
  return result;
}

const shadowMap = texture(128, (context, size) => {
  const gradient = context.createRadialGradient(size / 2, size / 2, size * .19, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, '#38204861');
  gradient.addColorStop(.6, '#5b2d6730');
  gradient.addColorStop(1, '#6e417900');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
});
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(7.7, 7.7),
  new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2;
shadow.position.set(.20, -.37, .23);
scene.add(shadow);
const glossMap = texture(128, context => {
  context.rotate(-.12);
  const gradient = context.createLinearGradient(0, 13, 0, 41);
  gradient.addColorStop(0, '#fffaf8ce');
  gradient.addColorStop(1, '#fffaf800');
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(48, 26, 30, 11, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#fffaf871';
  context.beginPath();
  context.ellipse(84, 29, 5, 3.5, .28, 0, Math.PI * 2);
  context.fill();
});
const glossShape = new THREE.PlaneGeometry(.85, .85);
const glossMaterial = new THREE.MeshBasicMaterial({ map: glossMap, transparent: true, opacity: .78, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
const ambient = new THREE.HemisphereLight(0xfff3ff, 0xc68ba6, 2.13);
const keyLight = new THREE.DirectionalLight(0xfff9ed, 2.05);
keyLight.position.set(-3, 7, 5);
const fillLight = new THREE.DirectionalLight(0xc5d1ff, .81);
fillLight.position.set(4, 3, -3);
scene.add(ambient, keyLight, fillLight);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
} catch {
  $('render-error').hidden = false;
}
if (renderer) initialize();

function initialize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0xffffff, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  stage.prepend(canvas);

  let slots = [];
  function buildBoard() {
    for (const slot of slots) {
      scene.remove(slot.column, ...slot.tiles);
      for (const mesh of slot.segments) mesh.material.dispose();
    }
    $('pillar-controls').replaceChildren();
    $('app').setAttribute('aria-label', `${size} × ${size} 软糖棋盘`);
    const scale = (size * CELL + .35) / 5.23;
    base.scale.set(scale, 1, scale);
    rim.scale.set(scale, 1, scale);
    shadow.scale.setScalar(scale);
    slots = level.board.flat().map((piece, index) => {
      const x = (colOf(index) - (size - 1) / 2) * CELL;
      const z = (rowOf(index) - (size - 1) / 2) * CELL;
      const tiles = [];
      for (const [geometry, material, y] of [[edgeShape, edgeMaterial, .023], [tileShape, tileMaterial, .015], [wellShape, wellMaterial, .055]]) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        mesh.userData.cell = index;
        scene.add(mesh);
        tiles.push(mesh);
      }
      const column = new THREE.Group();
      column.position.set(x, FLOOR, z);
      scene.add(column);
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'pillar-key';
      const digit = document.createElement('span');
      const direction = document.createElement('span');
      direction.className = 'direction';
      direction.setAttribute('aria-hidden', 'true');
      label.append(digit, direction);
      $('pillar-controls').append(label);
      label.addEventListener('click', () => click(index));
      const segments = Array.from({ length: 4 }, (_, layer) => {
        const mesh = new THREE.Mesh(candyShape, candyMaterials[piece?.color ?? 0].clone());
        mesh.position.y = (layer + .5) * LAYER;
        mesh.userData.cell = index;
        column.add(mesh);
        return mesh;
      });
      const gloss = new THREE.Mesh(glossShape, glossMaterial);
      gloss.rotation.x = -Math.PI / 2;
      column.add(gloss);
      return { column, tiles, segments, gloss, label, digit, direction, display: 0, burst: false };
    });
  }

  let phase = null;
  let completionTimer;
  let deadEndWorker = null;
  let deadEndEnabled = false;
  try { deadEndEnabled = localStorage.getItem('colors-dead-end') === 'on'; } catch {}

  function updateDeadEndToggle() {
    const toggle = $('dead-end-toggle');
    toggle.hidden = !level.stacks || Boolean(level.demo);
    toggle.setAttribute('aria-checked', String(deadEndEnabled));
    toggle.textContent = '死局提醒 · ' + (deadEndEnabled ? '开' : '关');
  }

  $('dead-end-toggle').addEventListener('click', () => {
    deadEndEnabled = !deadEndEnabled;
    try { localStorage.setItem('colors-dead-end', deadEndEnabled ? 'on' : 'off'); } catch {}
    updateDeadEndToggle();
    clearDeadEnd();
    if (!phase && !expired) checkSwapDeadEnd();
    invalid = true;
  });

  function clearDeadEnd() {
    deadEndWorker?.terminate();
    deadEndWorker = null;
    $('dead-end').hidden = true;
  }

  function checkSwapDeadEnd() {
    if (!deadEndEnabled || !level.stacks || level.demo || !game.steps || !game.activeColors.size) return;
    const workerSource = [adjacent, swapTops, exchange, solveSwap].map(fn => fn.toString()).join('\n')
      + '\nonmessage = ({data}) => postMessage(solveSwap(data.stacks, data.size, 60000, false, data.allowEmpty, data.carry));';
    const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
    try {
      const worker = new Worker(url);
      deadEndWorker = worker;
      worker.onmessage = ({ data }) => {
        if (worker !== deadEndWorker) return;
        clearDeadEnd();
        if (data.route === null && !data.limited && !expired) $('dead-end').hidden = false;
      };
      worker.onerror = () => {
        if (worker === deadEndWorker) clearDeadEnd();
      };
      worker.postMessage({ stacks: game.stacks, size, allowEmpty:level.allowEmpty, carry:level.carry });
    } catch {
      clearDeadEnd();
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  let gesture = null;
  let sliderPointer = null;
  let hintWorker = null;
  let suggested = -1;
  let hover = -1;
  let invalid = true;
  let width = 1;
  let height = 1;
  let guidePage = -1;
  let guideStep = 0;
  let singleArmed = false;
  let swapSelected = -1;
  let swapPartnerHint = -1;
  const swapStatus = () => (level.carry ? '错层移位' : '交换顶层') + ' · 同色同层，三颗消除';
  let preview = new Map();
  const cellOf = action => action % (size * size);
  const soloAction = action => action >= size * size;
  let deadline = 0;
  let expired = false;
  let cheerAnimation = null;
  let cheerIndex = 0;
  const linkSymbols = ['∞', '△', '★', '●'];
  function clearCheer() {
    cheerAnimation?.cancel();
    cheerAnimation = null;
    $('clear-cheer').textContent = '';
  }
  function cheer(matches) {
    if (!matches.length) return;
    clearCheer();
    const multi = new Set(matches.map(piece => piece.color)).size > 1;
    const label = $('clear-cheer');
    label.dataset.multi = multi;
    label.textContent = multi ? 'Bravo!' : ['Good!', 'Nice!', 'Great!'][cheerIndex++ % 3];
    cheerAnimation = label.animate(reducedMotion.matches
      ? [{ opacity: 1 }, { opacity: 1, offset: .75 }, { opacity: 0 }]
      : [{ opacity: 0, scale: .75, translate: '0 12px' }, { opacity: 1, scale: 1.06, offset: .21 },
         { opacity: 1, scale: 1, offset: .67 }, { opacity: 0, scale: 1, translate: '0 -20px' }],
    { duration: 800, easing: 'ease-out', fill: 'forwards' });
  }
  let ratings = {};
  try { ratings = JSON.parse(localStorage.getItem('colors-ratings') || '{}') || {}; } catch {}
  const rating = (steps, minimum) => Math.max(0, 5 - Math.floor(Math.max(0, steps - minimum) / 2) / 2);
  function stars(value) {
    const icon = document.createElement('span');
    icon.className = 'stars';
    icon.setAttribute('role', 'img');
    icon.setAttribute('aria-label', value + ' 星');
    icon.textContent = '★★★★★';
    const fill = document.createElement('span');
    fill.setAttribute('aria-hidden', 'true');
    fill.style.width = value * 20 + '%';
    fill.textContent = '★★★★★';
    icon.append(fill);
    return icon;
  }
  function updateTotal() {
    const total = Object.values(ratings).reduce((sum, value) => sum + value, 0);
    $('total-stars').textContent = '★ ' + total;
    $('total-stars').setAttribute('aria-label', '累计 ' + total + ' 星');
  }
  const lessons = [
    ['#swatches', '同色柱子全部等高就自动消除，位置可以分散。色块表示剩余颜色。空格不再参与联动，清盘就过关。'],
    ['#undo', '撤销会还原上一次点击，包括消除的软糖和步数。'],
    ['#reset', '重置会把本关恢复到开局。'],
    ['#hint', '提示会高亮建议点击的柱子，查看提示不计步。'],
    ['#view', '拖滑杆改变俯仰角，直接拖棋盘可以环绕。'],
    ['#rotate', '恢复视角会回到默认角度。'],
    ['#home', '封面会带你回到游戏首页。'],
    ['#choose', '选关可以直接跳到想玩的关卡。'],
    ['#teach', '想回看规则时，点「教学」打开说明卡。'],
    ['.step-count', '这里显示已用和最少步数。限步关还会显示剩余步数。'],
  ];
  const guideMoves = [
    '点箭头所指的柱子。它和上下左右的柱子各按自己的箭头动一层。层数循环：1 → 2 → 3 → 4 → 3 → 2 → 1，再从 1 往上升。',
    '点标记柱，消除第二组。同色柱等高才会一起消除。',
    '点标记柱，消除第三组。已经清空的位置不会再升降。',
    '点最后一根标记柱。清盘后可在弹窗里重玩、前往下一关或选关。',
  ];
  lessons.push(['.stage', '点击一根柱子，它和上下左右的柱子各按自己的箭头升降一层。层数循环为 1 → 2 → 3 → 4 → 3 → 2 → 1。']);
  const liftIntro = () => level.originalIndex === 0;
  const introLessons = () => level.stacks ? [] : lessons;
  const chapterOf = index => index < 30 ? 0 : index < 40 ? 1 : 2;
  const linkLesson = () => level.originalIndex === 25;
  const lessonCount = () => linkLesson() ? 1 : introLessons().length;
  const tutorialTarget = () => {
    if (guidePage !== lessonCount()) return -1;
    if (level.stacks) return level.route[guideStep]?.[swapSelected < 0 ? 0 : 1] ?? -1;
    if (level.single && guideStep === 1 && !singleArmed) return -1;
    const action = level.route[guideStep];
    return action === undefined ? -1 : cellOf(action);
  };
  const remaining = () => level.limit == null ? Infinity : level.limit - game.steps;
  let completed;
  try { completed = new Set(JSON.parse(localStorage.getItem('colors-completed') || '[]')); }
  catch { completed = new Set(); }

  function updateGuide() {
    $('guide').hidden = guidePage < 0 || guideStep >= level.route.length || Boolean(phase);
    $('guide-copy').textContent = level.stacks
      ? level.carry ? (swapSelected < 0 ? '点箭头指向的柱子，选中最上面的一颗。' : '点箭头指向的相邻柱子。目标升到 2 层，三颗同色顶糖就会一起消除。')
        : swapSelected < 0 ? '点箭头所指的柱子，选中它最上面的一颗。'
        : guideStep === 0 ? '点箭头指向的相邻柱子。交换后三颗粉糖会在同一层消除。' : '点箭头指向的相邻柱子，交换顶层。'
      : level.single
      ? ['先正常点箭头所指的柱子，消掉第一组。', singleArmed ? '点箭头所指的柱子。只有它自己会动，刚好凑齐第二组。' : '单点已充好。点箭头指向的「单点 ×1」按钮，再选柱子。'][guideStep] ?? ''
      : linkLesson()
      ? guidePage === 0 ? '带相同符号的两根柱子成对联动，例如 ∞ 和 ∞。点击或带动其中一根，另一根也按自己的方向动一层。两端各只动一次，任一端消除后配对解除。' : '点箭头所指的柱子，观察远端配对柱一起升降。'
      : liftIntro() ? (guidePage < lessons.length ? lessons[guidePage]?.[1] ?? '' : guideMoves[guideStep] ?? '') : '';
    $('guide-next').hidden = guidePage === lessonCount();
    $('guide-arrow').toggleAttribute('hidden', $('guide').hidden);
    invalid = true;
  }

  function updateSingle() {
    const button = $('single');
    button.hidden = !level.single;
    button.disabled = game.singleCharge !== 1 || Boolean(phase);
    button.textContent = game.singleCharge === 1 ? '单点 ×1' : '单点 ×0';
    button.setAttribute('aria-pressed', String(singleArmed));
  }

  function refreshUI() {
    updateDeadEndToggle();
    updateSingle();
    $('steps').textContent = String(game.steps).padStart(2, '0');
    $('step-unit').textContent = level.carry ? '次移位' : level.stacks ? '次交换' : '次升降';
    $('undo').disabled = game.steps === 0;
    const remaining = [...game.activeColors].sort();
    const complete = !remaining.length && !phase;
    const exhausted = level.limit !== null && game.steps >= level.limit && !complete && !phase;
    $('best').textContent = level.minimum == null ? '参考 ' + level.route.length + ' 次' : '最少 ' + level.minimum + ' 次';
    $('budget').hidden = level.limit === null;
    if (level.limit !== null) $('budget').textContent = '剩余 ' + Math.max(0, level.limit - game.steps) + ' / ' + level.limit + ' 次';
    const swatches = remaining.map(color => {
      const item = document.createElement('span');
      item.className = 'swatch';
      item.style.setProperty('--candy', palette[color].chip);
      item.setAttribute('aria-hidden', 'true');
      return item;
    });
    $('swatches').replaceChildren(...swatches);
    $('swatches').setAttribute('aria-label', remaining.length
      ? '剩余颜色：' + remaining.map(i => palette[i].name).join('、')
      : '所有颜色均已消除');
    $('status-title').textContent = complete ? '清盘成功！'
      : exhausted ? '步数用完了，试试撤销或重置' : level.stacks ? swapStatus() : '同色等高，整组消除';
    $('status').classList.toggle('complete', complete);
    $('next').hidden = !complete;
    $('next').textContent = levelIndex === LEVELS.length - 1 ? '选关' : '下一关';
    $('hint').hidden = complete;
    $('hint').disabled = Boolean(phase || hintWorker || exhausted || expired || guidePage >= 0);
    if (complete) {
      completed.add(progressKey(level));
      try { localStorage.setItem('colors-completed', JSON.stringify([...completed])); } catch {}
    }
    const board = game.board;
    slots.forEach((slot, index) => {
      slot.label.classList.remove('link-active');
      const piece = board[rowOf(index)][colOf(index)];
      slot.label.hidden = !piece && !level.allowEmpty;
      slot.label.classList.toggle('empty-cell', !piece);
      if (!piece) {
        slot.digit.textContent = '·';
        slot.direction.textContent = '';
        slot.label.setAttribute('aria-label', `第${rowOf(index) + 1}行第${colOf(index) + 1}列，空格`);
        return;
      }
      slot.digit.textContent = piece.height;
      slot.direction.textContent = level.stacks ? '' : piece.direction > 0 ? '↑' : '↓';
      const linked = piece.sync && game.board.flat().filter(p => p?.sync === piece.sync).length === 2;
      const badge = linked ? linkSymbols[piece.sync - 1] : '';
      slot.label.classList.toggle('linked', Boolean(linked));
      slot.label.dataset.link = linked ? piece.sync : '';
      if (badge) {
        const mark = document.createElement('b');
        mark.className = 'link-badge';
        mark.textContent = badge;
        slot.direction.append(mark);
      }
      const direction = piece.direction > 0 ? '升' : '降';
      slot.label.setAttribute('aria-label', `第${rowOf(index) + 1}行第${colOf(index) + 1}列，${palette[piece.color].name}，${piece.height}层${level.stacks ? '' : '，下次' + direction}${linked ? '，第 ' + piece.sync + ' 对联动柱' : ''}`);
    });
    invalid = true;
  }

  function renderColumn(slot, display, bounce = 0) {
    slot.display = display;
    slot.gloss.visible = display > .3;
    slot.gloss.position.y = display * LAYER - .009 + bounce;
    slot.segments.forEach((mesh, layer) => {
      const fraction = clamp(display - layer, 0, 1);
      mesh.visible = fraction > .025;
      mesh.position.set(0, (layer + fraction / 2) * LAYER + bounce * (layer + 1) / Math.ceil(display || 1), 0);
      mesh.scale.set(1, fraction, 1);
      mesh.rotation.set(0, 0, 0);
      mesh.material.opacity = 1;
      mesh.material.transparent = false;
      mesh.material.depthWrite = true;
      mesh.material.emissive.setHex(0);
    });
  }

  function paintStack(slot, stack) {
    stack.forEach((color, layer) => slot.segments[layer].material.color.copy(candyMaterials[color].color));
    renderColumn(slot, stack.length);
  }

  function alignBoard() {
    clearDeadEnd();
    clearTimeout(completionTimer);
    if (guidePage >= 0 && !game.activeColors.size) guidePage = -1;
    clearHint();
    const board = game.board;
    slots.forEach((slot, index) => {
      slot.burst = false;
      if (level.stacks) paintStack(slot, game.stacks[index]);
      else renderColumn(slot, board[rowOf(index)][colOf(index)]?.height ?? 0);
    });
    refreshUI();
    updateGuide();
    setHover(-1);
    if (!game.activeColors.size && $('cover').hidden) {
      deadline = 0;
      completionTimer = setTimeout(() => {
        if ($('cover').hidden && !$('picker').open && !$('help').open && !$('swap-intro').open) showCompletion();
      }, reducedMotion.matches ? 0 : 480);
    }
  }

  function setPitch(degrees) {
    const pitch = Number(degrees) * Math.PI / 180;
    Object.assign(cameraState, { pitch, rawPitch: pitch, obliquePitch: pitch, top: false });
    $('view').value = degrees;
    $('view').setAttribute('aria-valuetext', Math.round(degrees) + ' 度');
    invalid = true;
  }

  function home() {
    restoreCamera(cameraState, YAW);
    setPitch(HOME_PITCH);
  }

  function fitCamera() {
    // Yellow's spherical orthographic orbit, framed around the candy tray.
    const { yaw, pitch } = cameraState;
    const radius = 19, flat = radius * Math.cos(pitch);
    cameraDirection.set(Math.sin(yaw) * flat, radius * Math.sin(pitch), Math.cos(yaw) * flat);
    camera.position.copy(target).add(cameraDirection);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const edge = size * CELL / 2 + .24;
    for (const x of [-edge, edge]) for (const z of [-edge, edge]) for (const y of [-.43, FLOOR + 4 * LAYER + .12]) {
      point.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    const aspect = width / height;
    const viewHeight = Math.max((maxY - minY) * 1.105, (maxX - minX) * 1.08 / aspect);
    const offsetX = (maxX + minX) * .5, offsetY = (maxY + minY) * .5;
    sceneCenter.set(offsetX, offsetY, 0).transformDirection(camera.matrixWorld);
    sceneCenter.multiplyScalar(Math.hypot(offsetX, offsetY));
    lookAt.copy(target).add(sceneCenter);
    camera.position.copy(lookAt).add(cameraDirection);
    camera.lookAt(lookAt);
    camera.left = -viewHeight * aspect / 2;
    camera.right = -camera.left;
    camera.bottom = -viewHeight / 2;
    camera.top = -camera.bottom;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function hits() {
    return ray.intersectObjects(scene.children, true).find(({ object }) =>
      object.visible && object.userData.cell !== undefined
    )?.object.userData.cell ?? -1;
  }

  function placeLabels() {
    slots.forEach((slot, index) => {
      if (slot.label.hidden) return;
      const { x, z } = slot.column.position;
      point.set(x, FLOOR + slot.display * LAYER + .022, z).project(camera);
      const left = (point.x * .5 + .5) * width;
      const top = (-point.y * .5 + .5) * height;
      slot.label.style.transform = `translate(${left}px,${top}px) translate(-50%,-50%)`;
      pointer.set(point.x, point.y);
      ray.setFromCamera(pointer, camera);
      slot.label.style.opacity = hits() === index ? 1 : 0;
    });
    placeGuide();
  }

  function placeGuide() {
    const card = $('guide');
    const arrow = $('guide-arrow');
    if (card.hidden) return;
    const index = tutorialTarget();
    const linked = slots.find(slot => slot.label.dataset.link);
    const anchor = index >= 0 ? slots[index].label : level.single ? $('single')
      : linkLesson() ? linked?.label ?? stage : document.querySelector(introLessons()[guidePage][0]);
    const rect = anchor.getBoundingClientRect();
    const x = (rect.left + rect.right) / 2, y = (rect.top + rect.bottom) / 2;
    const w = card.offsetWidth, h = card.offsetHeight;
    const gap = 29, margin = 12;
    const above = { x: x - w / 2, y: rect.top - gap - h };
    const below = { x: x - w / 2, y: rect.bottom + gap };
    const sides = [{ x: rect.right + gap, y: y - h / 2 }, { x: rect.left - gap - w, y: y - h / 2 }];
    const candidates = index >= 0 && innerWidth <= 600 ? [above, ...sides, below] : [...sides, above, below];
    const maxX = Math.max(margin, innerWidth - w - margin);
    const lower = index >= 0 ? Math.min(innerHeight - margin, stage.getBoundingClientRect().bottom - 8) : innerHeight - margin;
    const maxY = Math.max(margin, lower - h);
    const fitted = candidates.map(pos => {
      const left = clamp(pos.x, margin, maxX), top = clamp(pos.y, margin, maxY);
      const overlap = Math.max(0, Math.min(left + w, rect.right + 8) - Math.max(left, rect.left - 8))
        * Math.max(0, Math.min(top + h, rect.bottom + 8) - Math.max(top, rect.top - 8));
      const preferAbove = pos === above && index >= 0 && innerWidth <= 600 ? 0 : 1;
      return { left, top, score: overlap * 100 + Math.abs(left - pos.x) * .15 + Math.abs(top - pos.y) + preferAbove * 25 };
    }).sort((a, b) => a.score - b.score)[0];
    const { left, top } = fitted;
    card.style.left = left + 'px';
    card.style.top = top + 'px';
    const startX = clamp(x, left, left + w), startY = clamp(y, top, top + h);
    const endX = clamp(startX, rect.left - 4, rect.right + 4);
    const endY = clamp(startY, rect.top - 4, rect.bottom + 4);
    const line = arrow.querySelector('line');
    for (const [key, value] of Object.entries({x1:startX, y1:startY, x2:endX, y2:endY})) line.setAttribute(key, value);
  }

  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return -1;
    pointer.set((event.clientX - rect.left) / width * 2 - 1, 1 - (event.clientY - rect.top) / height * 2);
    ray.setFromCamera(pointer, camera);
    const index = hits();
    return index >= 0 && (level.allowEmpty || game.board[rowOf(index)][colOf(index)]) ? index : -1;
  }

  function setHover(index) {
    if (hover === index) return;
    hover = index;
    preview = new Map();
    if (!level.stacks && index >= 0 && !phase && !expired && remaining() > 0) {
      const copy = game.board.map(row => row.map(piece => piece && { ...piece }));
      for (const step of move(copy, rowOf(index), colOf(index), singleArmed)) {
        preview.set(step.row * size + step.col, step.toHeight > step.fromHeight ? 'up' : 'down');
      }
    }
    canvas.style.cursor = index < 0 ? 'default' : 'pointer';
    invalid = true;
  }

  stage.addEventListener('pointerover', event => {
    if (!level.carry) return;
    const index = slots.findIndex(slot => slot.label.contains(event.target));
    if (index >= 0) setHover(index);
  });
  stage.addEventListener('pointerleave', () => { if (level.carry) setHover(-1); });

  function click(index) {
    if (phase || index < 0 || remaining() <= 0 || expired || (deadline && performance.now() >= deadline)) return;
    if (guidePage >= 0 && index !== tutorialTarget()) return;
    if (level.stacks) {
      clickSwap(index);
      return;
    }
    const moves = game.begin(rowOf(index), colOf(index), singleArmed);
    if (!moves) return;
    singleArmed = false;
    clearHint();
    $('status-title').textContent = '同色等高，整组消除';
    $('hint').disabled = true;
    phase = { kind: 'lift', start: performance.now(), moves };
    if (guidePage >= 0) guideStep++;
    if (linkLesson() && guideStep === 1) guidePage = -1;
    if (level.single && guideStep === 2) guidePage = -1;
    updateSingle();
    for (const { row, col } of moves) {
      const label = slots[row * size + col].label;
      if (label.dataset.link) label.classList.add('link-active');
    }
    updateGuide();
    if (level.limit !== null) $('budget').textContent = '剩余 ' + remaining() + ' / ' + level.limit + ' 次';
    $('undo').disabled = false;
    $('steps').textContent = String(game.steps).padStart(2, '0');
    setHover(-1);
  }

  function clickSwap(index) {
    if (!$('dead-end').hidden) return;
    if (!game.stacks[index].length && (!level.allowEmpty || swapSelected < 0)) return;
    const first = swapSelected;
    if (index === first) {
      swapSelected = -1;
      $('status-title').textContent = swapStatus();
    } else if (first < 0 || (!level.freeSwap && !adjacent(first, index, size))) {
      if (!game.stacks[index].length) return;
      if (index !== suggested && index !== swapPartnerHint) clearHint();
      swapSelected = index;
      $('status-title').textContent = level.carry ? '点相邻格放下顶糖' : level.allowEmpty ? '再点相邻柱子或空格' : level.freeSwap ? '再点任意一根柱子，交换顶层' : '再点相邻柱子，交换最上面的一颗';
    } else {
      const visual = game.stacks.map(stack => stack.slice());
      const waves = game.swap(first, index);
      if (waves === null) {
        if (level.carry) $('status-title').textContent = '这根柱子已满，最多 4 层';
        return;
      }
      clearDeadEnd();
      phase = { kind: 'swap', start: performance.now(), pair: [first, index], visual, waves };
      swapSelected = -1;
      if (guidePage >= 0 && (++guideStep >= level.route.length || level.carry)) guidePage = -1;
      clearHint();
      $('hint').disabled = true;
      $('undo').disabled = game.steps === 0;
      $('steps').textContent = String(game.steps).padStart(2, '0');
      $('status-title').textContent = swapStatus();
    }
    updateGuide();
  }

  function clearHint() {
    hintWorker?.terminate();
    hintWorker = null;
    if (suggested >= 0) slots[suggested].label.classList.remove('suggested');
    suggested = -1;
    swapPartnerHint = -1;
    invalid = true;
  }

  $('hint').addEventListener('click', () => {
    if (phase || hintWorker || !game.activeColors.size) return;
    clearHint();
    if (level.stacks) {
      const replay = new SwapGame(level.stacks, size, false, level.allowEmpty, level.carry);
      const current = JSON.stringify(game.stacks);
      const onRoute = level.route.findIndex(([a, b]) => {
        if (JSON.stringify(replay.stacks) === current) return true;
        replay.swap(a, b);
        return false;
      });
      const { route, limited } = onRoute >= 0 ? { route: level.route.slice(onRoute) }
        : solveSwap(game.stacks, size, 60000, level.freeSwap, level.allowEmpty, level.carry);
      swapSelected = -1;
      if (!route?.length) {
        $('status-title').textContent = limited ? '暂未找到解法，可以先撤销一步' : '这盘已无解，可以撤销或重置';
        return;
      }
      [suggested, swapPartnerHint] = route[0];
      $('status-title').textContent = level.carry ? `从第 ${rowOf(suggested)+1} 行第 ${colOf(suggested)+1} 列搬到另一处高亮格` : '交换标亮的两根柱子';
      return;
    }
    $('hint').disabled = true;
    $('status-title').textContent = '正在找下一步…';
    const url = URL.createObjectURL(new Blob([
      solve.toString(), '\n', exact.toString(),
      '\nonmessage = ({data}) => postMessage(data.board.length === 5 ? exact(data.board, data.depth, 180000, data.charge) : solve(data.board, 750000, data.depth));'
    ], { type: 'text/javascript' }));
    const finish = result => {
      clearHint();
      $('hint').disabled = false;
      const action = result.route?.[0];
      suggested = action === undefined ? -1 : cellOf(action);
      if (suggested < 0) {
        $('status-title').textContent = result.limited ? '暂未找到解法，可以先撤销一步'
          : level.limit !== null ? '剩余步数内无法清盘，可以撤销或重置' : '这盘已无解，可以撤销或重置';
        return;
      }
      slots[suggested].label.classList.add('suggested');
      const prefix = soloAction(action) ? '开启单点，再点' : '点';
      $('status-title').textContent = `${prefix}第 ${rowOf(suggested) + 1} 行、第 ${colOf(suggested) + 1} 列`;
    };
    try {
      const replay = new ColorsGame(level.board, level.single);
      const current = JSON.stringify(game.board);
      for (const [offset, index] of level.route.entries()) {
        if (replay.singleCharge === game.singleCharge && JSON.stringify(replay.board) === current && level.route.length - offset <= remaining()) {
          finish({ route: level.route.slice(offset) });
          return;
        }
        replay.begin(rowOf(cellOf(index)), colOf(cellOf(index)), soloAction(index));
        replay.finish();
      }
      hintWorker = new Worker(url);
      hintWorker.onmessage = event => finish(event.data);
      hintWorker.onerror = () => finish({ limited: true });
      hintWorker.postMessage({ board: game.board, depth: remaining(), charge: level.single ? game.singleCharge : null });
    } catch {
      finish({ limited: true });
    } finally {
      URL.revokeObjectURL(url);
    }
  });

  function burst(slot, index, elapsed) {
    const flash = Math.sin(Math.min(elapsed / .31, 1) * Math.PI);
    const travel = clamp((elapsed - .22) / .78, 0, 1);
    const reach = 1 - (1 - travel) ** 2;
    slot.gloss.visible = false;
    for (let layer = 0; layer < slot.display; layer++) {
      const mesh = slot.segments[layer];
      const angle = index * 1.37 + layer * 2.39;
      const size = 1 + flash * .085 - travel * .94;
      mesh.scale.setScalar(size);
      mesh.position.set(Math.cos(angle) * reach * .73,
        (layer + .5) * LAYER + flash * .09 + Math.sin(reach * 2.45) * .60 - travel * .31,
        Math.sin(angle) * reach * .73);
      mesh.rotation.set(.66 * reach, angle * reach * .18, Math.sin(angle) * reach);
      mesh.material.emissive.setHex(0xffdeb9);
      mesh.material.emissiveIntensity = flash * .87;
      mesh.material.transparent = true;
      mesh.material.depthWrite = false;
      mesh.material.opacity = 1 - travel ** 1.6;
    }
  }

  function animate(now) {
    if (!phase) return;
    const elapsed = now - phase.start;
    if (phase.kind === 'swap' || phase.kind === 'swap-burst') {
      animateSwap(now, elapsed);
    } else if (phase.kind === 'lift') {
      const t = reducedMotion.matches ? 1 : Math.min(1, elapsed / 300);
      for (const { row, col, fromHeight, toHeight } of phase.moves) {
        const progress = 1 - (1 - Math.min(1, t / .69)) ** 3;
        const rebound = t > .69 ? Math.sin((t - .69) / .31 * Math.PI) * .064 * Math.sign(toHeight - fromHeight) : 0;
        renderColumn(slots[row * size + col], fromHeight + (toHeight - fromHeight) * progress, rebound);
      }
      if (t === 1) {
        const matches = game.finish();
        cheer(matches);
        if (matches.length && game.singleCharge === 1 && !$('single').textContent.includes('×1')) {
          $('single').animate([{scale:1}, {scale:1.16}, {scale:1}], {duration:380});
        }
        phase = matches.length && !reducedMotion.matches ? { kind: 'burst', start: now, matches } : null;
        if (phase) {
          for (const { row, col } of matches) slots[row * size + col].burst = true;
          refreshUI();
        } else alignBoard();
      }
    } else {
      const t = Math.min(1, elapsed / 425);
      for (const { row, col } of phase.matches) burst(slots[row * size + col], row * size + col, t);
      if (t === 1) {
        phase = null;
        alignBoard();
      }
    }
    invalid = true;
  }

  function animateSwap(now, elapsed) {
    const { pair, visual, waves } = phase;
    if (reducedMotion.matches) {
      cheer(waves.flat());
      phase = null;
      alignBoard();
      checkSwapDeadEnd();
      return;
    }
    if (phase.kind === 'swap') {
      const t = clamp(elapsed / 320, 0, 1);
      const u = t * t * (3 - 2 * t);
      pair.forEach((index, i) => {
        const partner = pair[1 - i];
        const slot = slots[index];
        const layer = visual[index].length - 1;
        if (layer < 0 || (level.carry && i === 1)) return;
        const otherLayer = Math.max(0, visual[partner].length - (level.carry ? 0 : 1));
        const dx = slots[partner].column.position.x - slot.column.position.x;
        const dz = slots[partner].column.position.z - slot.column.position.z;
        const arc = Math.sin(Math.PI * u);
        slot.segments[layer].position.set(dx * u + dz * .32 * arc,
          (layer + .5 + (otherLayer - layer) * u) * LAYER + .7 * arc,
          dz * u - dx * .32 * arc);
        slot.gloss.visible = false;
      });
      if (t < 1) return;
      const [a, b] = pair.map(i => visual[i]);
      if (level.carry) b.push(a.pop());
      else swapTops(a, b);
      for (const i of pair) paintStack(slots[i], visual[i]);
      if (!waves.length) {
        phase = null;
        alignBoard();
        checkSwapDeadEnd();
        return;
      }
      Object.assign(phase, { kind: 'swap-burst', start: now + 390, wave: 0, announced: false });
    } else {
      if (elapsed < 0) return;
      if (!phase.announced) {
        cheer(waves[phase.wave]);
        phase.announced = true;
      }
      const t = clamp(elapsed / 310, 0, 1);
      for (const { row, col, height } of waves[phase.wave]) {
        const i = row * size + col;
        const slot = slots[i];
        const mesh = slot.segments[height - 1];
        slot.burst = true;
        slot.gloss.visible = false;
        mesh.material.emissive.setHex(0xffdfcf);
        mesh.material.emissiveIntensity = Math.sin(Math.PI * t) * 1.25;
        mesh.scale.setScalar(1 + .17 * Math.sin(Math.PI * t) - .98 * t ** 3);
        mesh.position.y = (height - .5) * LAYER + .48 * Math.sin(Math.PI * t);
        mesh.material.transparent = true;
        mesh.material.depthWrite = false;
        mesh.material.opacity = 1 - t ** 3;
        if (t === 1) {
          visual[i].pop();
          paintStack(slot, visual[i]);
          slot.burst = false;
          slot.label.hidden = !visual[i].length;
          slot.digit.textContent = visual[i].length;
        }
      }
      if (t === 1) {
        if (++phase.wave < waves.length) {
          phase.start = now + 160;
          phase.announced = false;
        } else {
          phase = null;
          alignBoard();
          checkSwapDeadEnd();
        }
      }
    }
  }

  canvas.addEventListener('pointerdown', event => {
    if (gesture || event.button !== 0 || !event.isPrimary) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, candidate: pick(event), dragging: false };
    canvas.setPointerCapture(event.pointerId);
    if (!phase) setHover(gesture.candidate);
  });
  canvas.addEventListener('pointermove', event => {
    const { clientX: x, clientY: y } = event;
    if (!gesture) {
      if (event.pointerType === 'mouse' && !phase) setHover(pick(event));
      return;
    }
    if (event.pointerId !== gesture.id) return;
    if (Math.hypot(x - gesture.x, y - gesture.y) > 10) gesture.dragging = true;
    if (gesture.dragging) {
      setHover(-1);
      dragOrbit(cameraState, x - gesture.lastX, y - gesture.lastY);
      setPitch(clamp(cameraState.rawPitch * 180 / Math.PI, 13, 89.5));
      Object.assign(gesture, { lastX: x, lastY: y });
    }
  });
  canvas.addEventListener('pointerup', event => {
    if (gesture?.id !== event.pointerId) return;
    const { candidate, dragging } = gesture;
    gesture = null;
    if (!dragging && pick(event) === candidate) click(candidate);
    setHover(-1);
  });
  function cancel(event) {
    if (gesture?.id !== event.pointerId) return;
    gesture = null;
    setHover(-1);
  }
  canvas.addEventListener('lostpointercapture', cancel);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('pointerleave', () => { if (!gesture) setHover(-1); });
  function undo() {
    if (!game.undo()) return;
    clearCheer();
    singleArmed = false;
    swapSelected = -1;
    if (guidePage >= 0) guideStep = game.steps;
    phase = gesture = null;
    alignBoard();
  }
  $('undo').addEventListener('click', undo);
  $('undo-dead-end').addEventListener('click', undo);
  function reset() {
    clearCheer();
    cheerIndex = 0;
    game.reset();
    singleArmed = false;
    swapSelected = -1;
    guideStep = 0;
    phase = gesture = null;
    expired = false;
    deadline = level.seconds ? performance.now() + level.seconds * 1000 : 0;
    $('timer').hidden = !deadline;
    $('timer').classList.remove('urgent');
    if (deadline) $('timer').textContent = timerText(level.seconds);
    home();
    alignBoard();
  }
  $('reset').addEventListener('click', reset);
  function loadLevel(index) {
    levelIndex = index;
    level = LEVELS[index];
    size = level.board.length;
    game = level.stacks ? new SwapGame(level.stacks, size, level.freeSwap, level.allowEmpty, level.carry) : new ColorsGame(level.board, level.single);
    guidePage = [0,25].includes(level.originalIndex) ? 0 : -1;
    $('chapter').textContent = `第 ${level.displayNumber ?? index + 1} 关 · ${level.name}`;
    document.querySelector('.level-note h2').textContent = level.carry ? '移动顶层，凑齐同高' : level.stacks ? '互换顶层，凑齐同高' : '把同色软糖升到一样高';
    document.querySelector('.level-note p').textContent = level.carry ? '先选来源，再点相邻目标。' : level.stacks ? '点相邻两根柱子交换顶层。' : '点击一根，它和四邻会各自升降一层。';
    size = level.board.length;
    clearHint();
    buildBoard();
    $('cover').hidden = true;
    document.querySelector('.shell').inert = false;
    reset();
    if (level.originalIndex === 35) $('single-intro').showModal();
    if (level.carryLesson) showCarryIntro(true);
    if (level.swapLesson || level.demo) {
      $('swap-goal').textContent = '清空棋盘就过关。这关不限时，也不限步。';
      $('swap-title').textContent = '新玩法 · 交换顶层';
      $('swap-start').textContent = '试一次';
      $('swap-intro').showModal();
    }
  }
  const progressKey = entry => entry.originalIndex ?? (entry.carry ? (entry.carryLesson ? 'swap-60' : 'carry-' + entry.carryIndex) : entry.swapLesson ? 45 : 'swap-' + (entry.swapIndex ?? 0));
  function fillPicker(chapter) {
    $('chapter-tabs').hidden = LEVELS.length < 30;
    $('chapter-swap').setAttribute('aria-pressed', String(chapter === 2));
    $('chapter-carry').hidden = LEVELS.length <= 60;
    $('chapter-carry').setAttribute('aria-pressed', String(chapter === 1));
    $('chapter-lift').setAttribute('aria-pressed', String(chapter === 0));
    $('level-grid').replaceChildren(...LEVELS.map((entry, index) => [entry, index])
      .filter(([, index]) => chapterOf(index) === chapter).map(([entry, index]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'control level-choice';
      button.textContent = index + 1;
      const note = document.createElement('small');
      note.textContent = completed.has(progressKey(entry)) ? '已通关' : entry.swapLesson || entry.carryLesson || [0,25].includes(entry.originalIndex) ? '教学' : entry.seconds ? '限时' : entry.limit ? '限步' : '';
      if (Object.hasOwn(ratings, progressKey(entry))) note.replaceChildren(stars(ratings[progressKey(entry)]));
      if (note.hasChildNodes()) button.append(note);
      button.setAttribute('aria-label', `第 ${index + 1} 关 ${entry.name} ${note.textContent}`);
      button.addEventListener('click', () => {
        $('picker').close();
        loadLevel(index);
      });
      return button;
    }));
  }
  function openPicker() {
    fillPicker(chapterOf(levelIndex));
    $('picker').showModal();
  }
  $('chapter-swap').addEventListener('click', () => fillPicker(2));
  $('chapter-lift').addEventListener('click', () => fillPicker(0));
  $('chapter-carry').addEventListener('click', () => fillPicker(1));
  $('start').addEventListener('click', () => loadLevel(0));
  $('home').addEventListener('click', () => {
    clearDeadEnd();
    clearHint();
    deadline = 0;
    $('cover').hidden = false;
    document.querySelector('.shell').inert = true;
    $('start').focus();
  });
  $('choose').addEventListener('click', openPicker);
  $('cover-choose').addEventListener('click', openPicker);
  $('close-picker').addEventListener('click', () => $('picker').close());
  $('teach').addEventListener('click', () => {
    if (level.carry) { showCarryIntro(false); return; }
    if (!level.stacks) { $('help').showModal(); return; }
    $('swap-title').textContent = '怎么玩 · 交换顶层';
    $('swap-goal').textContent = level.seconds ? '在倒计时结束前清空棋盘。' : '清空棋盘就过关。';
    $('swap-start').textContent = '返回游戏';
    $('swap-intro').showModal();
  });
  let carryTeaching = false;
  function showCarryIntro(teaching) {
    carryTeaching = teaching;
    $('carry-start').textContent = teaching ? '试一次' : '返回游戏';
    $('carry-intro').showModal();
  }
  $('carry-intro').addEventListener('cancel', event => { if (carryTeaching) event.preventDefault(); });
  $('carry-start').addEventListener('click', () => {
    $('carry-intro').close();
    if (!carryTeaching) return;
    guidePage = 0;
    refreshUI();
    updateGuide();
  });
  $('swap-start').addEventListener('click', () => {
    $('swap-intro').close();
    if (level.demo || $('swap-start').textContent !== '试一次') return;
    guidePage = lessonCount();
    refreshUI();
    updateGuide();
  });
  $('swap-intro').addEventListener('cancel', event => {
    if ($('swap-start').textContent === '试一次') event.preventDefault();
  });
  $('help-close').addEventListener('click', () => $('help').close());
  $('single-intro').addEventListener('cancel', event => event.preventDefault());
  $('single-start').addEventListener('click', () => {
    $('single-intro').close();
    guidePage = lessonCount();
    refreshUI();
    updateGuide();
  });
  $('single').addEventListener('click', () => {
    if (phase || game.singleCharge !== 1) return;
    singleArmed = !singleArmed;
    setHover(-1);
    updateSingle();
    updateGuide();
  });
  $('next').addEventListener('click', () => {
    if (levelIndex === LEVELS.length - 1) openPicker();
    else loadLevel(levelIndex + 1);
  });
  function showCompletion() {
    const final = levelIndex === LEVELS.length - 1;
    deadline = 0;
    const earned = rating(game.steps, level.minimum ?? level.route.length);
    const key = progressKey(level);
    ratings[key] = Math.max(ratings[key] ?? 0, earned);
    try { localStorage.setItem('colors-ratings', JSON.stringify(ratings)); } catch {}
    updateTotal();
    $('completion-stars').replaceChildren(stars(earned));
    $('completion-title').textContent = final ? '全部关卡完成！' : '清盘成功！';
    const benchmark = level.minimum == null ? '参考 ' + level.route.length : '最少 ' + level.minimum;
    $('completion-detail').textContent = `第 ${level.displayNumber ?? levelIndex + 1} 关 · 用了 ${game.steps} 次${level.carry ? '移位' : level.stacks ? '交换' : '升降'} · ${benchmark} 次`;
    $('completion-next').disabled = final;
    if (!$('completion').open) $('completion').showModal();
  }
  $('completion-replay').addEventListener('click', () => {
    $('completion').close();
    loadLevel(levelIndex);
  });
  $('completion-next').addEventListener('click', () => {
    $('completion').close();
    loadLevel(levelIndex + 1);
  });
  $('completion-choose').addEventListener('click', () => {
    $('completion').close();
    openPicker();
  });
  $('timeout-replay').addEventListener('click', () => {
    $('timeout').close();
    reset();
  });
  $('timeout-choose').addEventListener('click', () => {
    $('timeout').close();
    openPicker();
  });
  $('guide-next').addEventListener('click', () => {
    guidePage++;
    updateGuide();
  });
  $('guide-skip').addEventListener('click', () => {
    guidePage = -1;
    updateGuide();
    refreshUI();
  });
  $('rotate').addEventListener('click', home);
  const slider = $('view');
  // Map pointer movement directly so touch does not wait for the native range drag threshold.
  function slide(event) {
    const rect = slider.getBoundingClientRect();
    const thumbRadius = 12;
    const ratio = clamp((event.clientX - rect.left - thumbRadius) / (rect.width - 2 * thumbRadius), 0, 1);
    setPitch(Number(slider.min) + (Number(slider.max) - Number(slider.min)) * ratio);
  }
  slider.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    slider.focus({ preventScroll: true });
    sliderPointer = event.pointerId;
    slider.setPointerCapture(sliderPointer);
    slide(event);
  });
  slider.addEventListener('pointermove', event => {
    if (sliderPointer === event.pointerId) slide(event);
  });
  slider.addEventListener('pointerup', event => {
    if (sliderPointer !== event.pointerId) return;
    slide(event);
    sliderPointer = null;
  });
  slider.addEventListener('lostpointercapture', event => {
    if (sliderPointer === event.pointerId) sliderPointer = null;
  });
  slider.addEventListener('input', () => setPitch(slider.value));
  new ResizeObserver(() => {
    const rect = stage.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    invalid = true;
  }).observe(stage);
  window.addEventListener('scroll', placeGuide, { passive: true });
  function timerText(seconds) {
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }

  function frame(now) {
    animate(now);
    if (deadline) {
      const seconds = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
      const displayTime = timerText(seconds);
      if ($('timer').textContent !== displayTime) $('timer').textContent = displayTime;
      $('timer').classList.toggle('urgent', seconds <= 10);
      if (!seconds && !phase) {
        clearDeadEnd();
        deadline = 0;
        expired = true;
        clearHint();
        refreshUI();
        $('status-title').textContent = '时间到，请重玩本关';
        if (!$('picker').open && !$('help').open) $('timeout').showModal();
      }
    }
    if (invalid) {
      fitCamera();
      const carryPreview = level.carry && !phase && swapSelected >= 0 && hover >= 0
        ? exchange(game.stacks, swapSelected, hover, size, false, true, true) : null;
      const carryMatches = new Set((carryPreview?.waves[0] ?? []).map(({row,col}) => row*size+col));
      slots.forEach((slot, index) => {
        if (level.carry) {
          const difference = carryPreview ? Number(index === hover) - Number(index === swapSelected) : 0;
          slot.digit.textContent = difference ? String(game.stacks[index].length + difference) : slot.display || '·';
          slot.label.classList.toggle('carry-match', carryMatches.has(index));
        }
        const effect = preview.get(index);
        const selected = index === swapSelected;
        const partner = level.stacks && swapSelected >= 0 && index !== swapSelected && (level.allowEmpty || game.stacks[index].length > 0)
          && (!level.carry || game.stacks[index].length < 4)
          && (level.freeSwap ? index === hover : adjacent(swapSelected, index, size));
        slot.label.classList.toggle('swap-selected', selected);
        slot.label.classList.toggle('swap-partner', Boolean(partner));
        if (level.stacks) slot.label.setAttribute('aria-pressed', String(selected));
        if (level.stacks) slot.label.classList.toggle('suggested', index === suggested || index === swapPartnerHint);
        slot.label.classList.toggle('preview-up', effect === 'up');
        slot.label.classList.toggle('preview-down', effect === 'down');
        slot.label.classList.toggle('preview-target', Boolean(effect) && index === hover);
        if (slot.burst) return;
        for (const [i, layer] of slot.segments.entries()) {
          if (level.stacks && i !== slot.display - 1) continue;
          const marked = index === suggested || index === swapPartnerHint || index === tutorialTarget() || selected;
          layer.material.emissive.setHex(marked ? 0xffd6f2 : effect === 'up' ? 0x9cffdf : effect === 'down' ? 0xffa5cb : 0);
          layer.material.emissiveIntensity = marked || index === hover ? .58 : .12;
        }
      });
      renderer.render(scene, camera);
      placeLabels();
      invalid = false;
    }
    requestAnimationFrame(frame);
  }
  buildBoard();
  updateTotal();
  reset();
  if (level.demo) loadLevel(0);
  else document.querySelector('.shell').inert = true;
  requestAnimationFrame(frame);
}

