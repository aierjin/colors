// Yellow 15799a9 十字联动，支持空格并将下界设为 1。
const MIN_HEIGHT = 1, MAX_HEIGHT = 4;
export const ChainReactionSystem = {
  /**
   * 计算一次点击后的完整下一状态。
   * @param {Array<Array<Pillar>>} pillars 二维方柱数组（会被原地更新）
   * @param {number} row 被点击方柱行
   * @param {number} col 被点击方柱列
   * @param {number} [maxHeight=MAX_HEIGHT] 本关最高高度（反弹上界）
   * @returns {Array} 受影响方柱列表 [{row, col, fromHeight, toHeight}]
   */
  apply(pillars, row, col, maxHeight = MAX_HEIGHT, single = false) {
    const rows = pillars.length;
    const cols = pillars[0].length;
    const targets = [];

    // 收集十字形范围内所有方柱，并确定各自的本次运动方向
    const moves = []; // {row, col, stepDir}
    const center = pillars[row]?.[col];
    if (!center || center.fixed || center.blocked) return [];
    moves.push({ row, col, stepDir: center.direction });

    const neighbors = single ? [] : [
      [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]
    ];
    for (const [r, c] of neighbors) {
      if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
      const p = pillars[r][c];
      if (!p || p.fixed || p.blocked) continue;
      // 相邻方柱按自身本来下一步该去的方向移动
      moves.push({ row: r, col: c, stepDir: p.direction });
    }

    // A link forwards activation only to its partner, never to the remote cross.
    const groups=new Set(single ? [] : moves.map(m=>pillars[m.row][m.col].sync).filter(Boolean));
    const included=new Set(moves.map(m=>m.row*cols+m.col));
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const p=pillars[r][c];if(!p||p.fixed||p.blocked||!p.sync||!groups.has(p.sync)||included.has(r*cols+c))continue;
      included.add(r*cols+c);moves.push({row:r,col:c,stepDir:p.direction});
    }
    // 统一计算本次移动（同一操作同时更新，先算后写，避免相互污染）
    const computed = [];
    for (const m of moves) {
      const p = pillars[m.row][m.col];
      let step = m.stepDir;
      const nextRaw = p.height + step;
      // 越界反弹：若越过 1 或 maxHeight，先反向再移动一级
      if (nextRaw < MIN_HEIGHT) {
        step = +1; // 反弹为向上
      } else if (nextRaw > maxHeight) {
        step = -1; // 反弹为向下
      }
      let newHeight = p.height + step;
      // 兜底 clamp（理论上不会触发）
      newHeight = Math.max(MIN_HEIGHT, Math.min(maxHeight, newHeight));
      computed.push({ row: m.row, col: m.col, newHeight, actualStep: step });
    }

    // 写入新状态
    const affected = [];
    for (const c of computed) {
      const p = pillars[c.row][c.col];
      const from = p.height;
      p.height = c.newHeight;
      // 更新 direction：到达边界则指向内部
      if (c.newHeight === maxHeight) p.direction = -1;
      else if (c.newHeight === MIN_HEIGHT) p.direction = +1;
      else p.direction = c.actualStep;
      affected.push({ row: c.row, col: c.col, fromHeight: from, toHeight: c.newHeight });
    }
    return affected;
  }
};

