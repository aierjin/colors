// Project each color into its own state space. A projected move may click
// anywhere, so its distance and touch cost are lower bounds on the real board.
export function exact(board, maxDepth, nodeLimit = 2000000, singleCharge = null) {
  const n = board.length, pieces = board.flat();
  const crosses = pieces.map((_, i) => pieces.flatMap((p, j) =>
    Math.abs(Math.floor(i/n)-Math.floor(j/n)) + Math.abs(i%n-j%n) <= 1 ? [j] : []));
  const expanded = crosses.map(cross => {
    const links = new Set(cross.map(i=>pieces[i]?.sync).filter(Boolean));
    return [...cross, ...pieces.flatMap((p,i)=>links.has(p?.sync)&&!cross.includes(i)?[i]:[])];
  });
  const heights = [1,2,3,4,3,2];
  const groups = [...new Set(pieces.filter(Boolean).map(p=>p.color))].map(color => {
    const cells = pieces.flatMap((p,i)=>p?.color===color?[i]:[]);
    const powers = cells.map((_,i)=>6**i);
    const size = 6**cells.length;
    const masks = Array.from({length:1<<cells.length},(_,mask)=>cells.flatMap((_,i)=>mask&(1<<i)?[i]:[]));
    const maskFor = cross => cells.reduce((mask,c,i)=>cross.includes(c)?mask|(1<<i):mask,0);
    const direct = crosses.map(maskFor);
    const extensions = expanded.map((cross,i)=>cross.filter(c=>!crosses[i].includes(c)&&cells.includes(c))
      .map(c=>({ bit:1<<cells.indexOf(c), trigger:crosses[i].find(j=>pieces[j]?.sync===pieces[c].sync) })));
    const possible = new Set(direct);
    if(singleCharge!==null) for(const cell of cells) possible.add(maskFor([cell]));
    possible.add(0);
    for(let i=0;i<pieces.length;i++) for(let m=0;m<1<<extensions[i].length;m++){
      possible.add(extensions[i].reduce((bits,e,j)=>m&(1<<j)?bits|e.bit:bits,direct[i]));
    }
    const unique = [...possible].filter(Boolean).map(m=>masks[m]);
    function step(state, mask, delta) {
      let next = state;
      for (const index of mask) {
        const power = powers[index], digit = Math.floor(state/power)%6;
        next += (((digit+delta)%6)-digit)*power;
      }
      return next;
    }
    const equal = new Uint8Array(size);
    const dist = new Uint8Array(size).fill(255);
    const touch = new Uint8Array(size).fill(255);
    const buckets = Array.from({length:6*cells.length+1},()=>[]);
    const queue = [];
    for (let state=0;state<size;state++) {
      if (!powers.every(power=>heights[Math.floor(state/power)%6]===heights[state%6])) continue;
      equal[state]=1; dist[state]=0; touch[state]=0; queue.push(state); buckets[0].push(state);
    }
    for(let i=0;i<queue.length;i++) for(const mask of unique) {
      const previous=step(queue[i],mask,5);
      if(dist[previous]!==255) continue;
      dist[previous]=dist[queue[i]]+1; queue.push(previous);
    }
    for(let cost=0;cost<buckets.length;cost++) for(const state of buckets[cost]) {
      if(touch[state]!==cost) continue;
      for(const mask of unique) {
        const previous=step(state,mask,5), nextCost=cost+mask.length;
        if(nextCost>=buckets.length || nextCost>=touch[previous]) continue;
        touch[previous]=nextCost; buckets[nextCost].push(previous);
      }
    }
    const transitions = new Map([...possible].map(key => {
      const table = new Int16Array(size);
      for(let state=0;state<size;state++){
        const next=step(state,masks[key],1);
        table[state]=equal[next]?-1:next;
      }
      return [key,table];
    }));
    return {cells, transitions, direct, extensions, dist, touch, first: cells.reduce((sum,i,j)=>{
      const p=pieces[i]; return sum+(p.direction>0?p.height-1:7-p.height)*powers[j];
    },0)};
  });
  const owners=pieces.map((p,i)=>p ? groups.findIndex(g=>g.cells.includes(i)) : -1);
  const maskCount = 1 << groups.length;
  const capacity = Array.from({length:maskCount},(_,mask)=>Math.max(...expanded.map(cross=>
    cross.filter(cell=>owners[cell]>=0 && (mask & (1<<owners[cell]))).length)));
  const pairs = groups.flatMap((_,i)=>groups.flatMap((_,j)=>j>i?[[i,j,capacity[(1<<i)|(1<<j)]]]:[]));
  const route=[], seen=new Map();
  let nodes=0, limited=false;
  function search(states, depth, charge) {
    if(states.every(s=>s<0)) return true;
    if(!depth) return false;
    if(++nodes>nodeLimit){limited=true;return false;}
    let touches=0, mask=0;
    for(let i=0;i<states.length;i++){
      if(states[i]<0)continue;
      mask|=1<<i;
      if(groups[i].dist[states[i]]>depth)return false;
      const cost=groups[i].touch[states[i]];
      touches+=cost===255?0:cost;
    }
    if(touches>depth*capacity[mask])return false;
    for(const [i,j,cap] of pairs){
      if(states[i]<0||states[j]<0)continue;
      const a=groups[i].touch[states[i]], b=groups[j].touch[states[j]];
      if(a!==255&&b!==255&&a+b>depth*cap)return false;
    }
    const key=states.join()+'|'+charge;
    if((seen.get(key)??0)>=depth)return false;
    seen.set(key,depth);
    for(let action=0;action<pieces.length*(charge===1?2:1);action++){
      const single=action>=pieces.length, click=action%pieces.length;
      if(owners[click]<0 || states[owners[click]]<0)continue;
      const next=states.map((state,i)=>{
        if(state<0)return state;
        const g=groups[i];
        const bits=single ? (owners[click]===i?1<<g.cells.indexOf(click):0)
          : g.extensions[click].reduce((m,e)=>states[owners[e.trigger]]>=0?m|e.bit:m,g.direct[click]);
        if(!bits && single)return state;
        return g.transitions.get(bits)[state];
      });
      route.push(action);
      const nextCharge=single?2:charge===0&&next.some((state,i)=>state<0&&states[i]>=0)?1:charge;
      if(search(next,depth-1,nextCharge))return true;
      route.pop();
      if(limited)return false;
    }
    return false;
  }
  for(let depth=0;depth<=maxDepth;depth++){
    if(search(groups.map(g=>g.first),depth,singleCharge))return {route,nodes};
    if(limited)return {limited,nodes};
  }
  return {route:null,nodes};
}
