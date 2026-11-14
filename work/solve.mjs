// Each digit is a phase of Yellow's 1↑ 2↑ 3↑ 4↓ 3↓ 2↓ cycle. 6 denotes an empty cell.
export function solve(board, limit = 220000, maxDepth = Infinity) {
  const pieces = board.flat();
  const size = board.length;
  const heights = [1, 2, 3, 4, 3, 2];
  const groups = [...new Set(pieces.filter(Boolean).map(p => p.color))]
    .map(color => pieces.flatMap((p, index) => p?.color === color ? [index] : []));
  const crosses = pieces.map((_, i) => [i, i - size, i + size, i % size ? i - 1 : -1, i % size < size-1 ? i + 1 : -1]
    .filter(j => j >= 0 && j < pieces.length));
  const first = pieces.map(p => p ? (p.direction > 0 ? p.height - 1 : 7 - p.height) : 6).join('');
  const empty = '6'.repeat(pieces.length);
  const queue = [{ state: first, parent: -1, click: -1, depth: 0 }];
  const seen = new Set([first]);
  for (let head = 0; head < queue.length; head++) {
    const { state, depth } = queue[head];
    if (state === empty) {
      const route = [];
      for (let i = head; queue[i].parent >= 0; i = queue[i].parent) route.push(queue[i].click);
      return { route: route.reverse() };
    }
    if (depth >= maxDepth) continue;
    for (let click = 0; click < pieces.length; click++) {
      if (state[click] === '6') continue;
      const next = state.split('');
      for (const i of crosses[click]) if (next[i] !== '6') next[i] = String((Number(next[i]) + 1) % 6);
      for (const group of groups) {
        const height = heights[next[group[0]]];
        if (height && group.every(i => heights[next[i]] === height)) for (const i of group) next[i] = '6';
      }
      const key = next.join('');
      if (key === empty) {
        const route = [click];
        for (let i = head; queue[i].parent >= 0; i = queue[i].parent) route.push(queue[i].click);
        return { route: route.reverse() };
      }
      if (depth + 1 >= maxDepth || seen.has(key)) continue;
      if (queue.length >= limit) return { limited: true };
      seen.add(key);
      queue.push({ state: key, parent: head, click, depth: depth + 1 });
    }
  }
  return { route: null };
}
