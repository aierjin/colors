export function adjacent(a,b,size) {
  return Math.abs(Math.floor(a/size)-Math.floor(b/size))+Math.abs(a%size-b%size)===1;
}
export function swapTops(a,b) {
  const first=a.pop(), second=b.pop();
  if(second!==undefined)a.push(second);
  if(first!==undefined)b.push(first);
}
export function exchange(stacks,a,b,size,free=false,allowEmpty=false,carry=false) {
  if(a===b||(!free&&!adjacent(a,b,size))||!stacks[a]||!stacks[b]||(!allowEmpty&&(!stacks[a].length||!stacks[b].length)))return null;
  if(carry && (!stacks[a].length || stacks[b].length >= 4))return null;
  if(!carry && stacks[a].at(-1)===stacks[b].at(-1))return {stacks,waves:[]};
  const next=stacks.map(stack=>stack.slice());
  if(carry)next[b].push(next[a].pop());
  else swapTops(next[a],next[b]);
  const waves=[];
  while(true){
    const groups=new Map();
    next.forEach((stack,i)=>{
      if(!stack.length)return;
      const key=stack.length+':'+stack.at(-1);
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(i);
    });
    const matches=[...groups.values()].filter(group=>group.length>=3).flat();
    if(!matches.length)break;
    waves.push(matches.map(i=>({row:Math.floor(i/size),col:i%size,height:next[i].length,color:next[i].pop()})));
  }
  return {stacks:next,waves};
}
export function solveSwap(stacks,size,limit=60000,free=false,allowEmpty=false,carry=false){
  const edges=stacks.flatMap((_,a)=>stacks.flatMap((_,b)=>(carry||b>a)&&(free||adjacent(a,b,size))?[[a,b]]:[]));
  const key=state=>state.map(s=>s.join('')).join('|');
  const queue=[{stacks,route:[]}],seen=new Set([key(stacks)]);
  for(let i=0;i<queue.length;i++){
    const state=queue[i];
    if(state.stacks.every(s=>!s.length))return {route:state.route};
    for(const [a,b] of edges){
      const move=exchange(state.stacks,a,b,size,free,allowEmpty,carry);
      if(!move||move.stacks===state.stacks)continue;
      if(move.stacks.every(s=>!s.length))return {route:[...state.route,[a,b]]};
      const id=key(move.stacks);
      if(seen.has(id))continue;
      if(queue.length>=limit)return {limited:true};
      seen.add(id);
      queue.push({stacks:move.stacks,route:[...state.route,[a,b]]});
    }
  }
  return {route:null};
}
export class SwapGame {
  constructor(stacks,size,free=false,allowEmpty=false,carry=false){this.initial=stacks;this.size=size;this.free=free;this.allowEmpty=allowEmpty;this.carry=carry;this.reset();}
  get steps(){return this.history.length;}
  get activeColors(){return new Set(this.stacks.flat());}
  get board(){
    return Array.from({length:this.size},(_,r)=>this.stacks.slice(r*this.size,(r+1)*this.size).map(stack=>
      stack.length?{height:stack.length,color:stack.at(-1),stack}:null));
  }
  swap(a,b){
    const result=exchange(this.stacks,a,b,this.size,this.free,this.allowEmpty,this.carry);
    if(!result)return null;
    if(result.stacks===this.stacks)return result.waves;
    this.history.push(this.stacks);
    this.stacks=result.stacks;
    return result.waves;
  }
  undo(){if(!this.steps)return false;this.stacks=this.history.pop();return true;}
  reset(){this.stacks=this.initial;this.history=[];}
}
