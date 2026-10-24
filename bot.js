import * as engine from './engine.js?v=0981ea2d5b';

export const BOT_LEVELS={
 beginner:{label:'Beginner',description:'Scans every number for small factors; short plans.',speed:1.5,ideas:5,targets:2,depth:1,width:2,rootWidth:5,nodes:100,budget:7,eleven:true,primes:[7,13],maxDigits:15,noise:2.5},
 intermediate:{label:'Intermediate',description:'Scans both reading directions and plans up to three turns ahead.',speed:1,ideas:12,targets:4,depth:3,width:3,rootWidth:8,nodes:650,budget:12,eleven:true,primes:[7,13],maxDigits:15,noise:.6},
 advanced:{label:'Advanced',description:'Checks either reading direction and plans up to five turns ahead.',speed:.7,ideas:28,targets:7,depth:5,width:4,rootWidth:12,nodes:2400,budget:18,eleven:true,primes:[7,13,17,19,23,29,31],maxDigits:13,noise:.15}
};
export function botConfig(state){const b=state?.bot;return b&&b.player===1&&Object.hasOwn(BOT_LEVELS,b.strength)&&typeof b.id==='string'&&b.id.length>0&&b.id.length<100&&Number.isInteger(b.seed)&&b.seed>=0&&b.seed<=0xffffffff?b:null;}
export function isBotTurn(state){return !!botConfig(state)&&state.turn===1;}
// Website bots and simulations share these assumed mental costs (seconds),
// not measured human timings. Cheap tests work at every board length and level.
// Larger-prime trial divisions remain slower; there is no primality oracle.
export const ARITHMETIC_MODEL='quick-small-primes-full-scan-v2';
export const SEARCH_MODEL='any-orientation-two-endpoint-minimax-v3';
export const SMALL_PRIMES=Object.freeze([2,3,5,7,11,13]);
export const FULL_SCAN_SECONDS=.25;
export function factorChecks(digits,strength='intermediate'){
 if(!/^\d{1,15}$/.test(digits)||!Object.hasOwn(BOT_LEVELS,strength))throw Error('Invalid bot arithmetic input.');
 const level=BOT_LEVELS[strength],n=BigInt(digits),last=Number(digits.at(-1)),sum=[...digits].reduce((a,d)=>a+Number(d),0);
 const checks=[],add=(factor,cost,test)=>checks.push({factor:String(factor),cost:cost*level.speed,divides:(n===0n||BigInt(factor)<n)&&test,method:factor,quick:factor<=13});
 add(2,.03,last%2===0);add(5,.03,last===0||last===5);add(10,.02,last===0);
 add(4,last%2===0?.05:.01,Number(digits.slice(-2))%4===0);add(8,last%2===0?.08:.01,Number(digits.slice(-3))%8===0);
 add(3,.06+digits.length*.008,sum%3===0);add(9,.02,sum%9===0);add(6,.01,last%2===0&&sum%3===0);
 if(level.eleven)add(11,.08+digits.length*.012,[...digits].reduce((a,d,i)=>a+(i%2?-1:1)*Number(d),0)%11===0);
 for(const p of level.primes)if(p<=13||digits.length<=level.maxDigits)add(p,p<=13?.12+digits.length*.025:.8+digits.length*.65,n%BigInt(p)===0n);
 return checks;
}
export const STYLES={balanced:{risk:1.2,opponentWeight:1.15,inventory:.8,temperature:.25}};
export function createBot({size,seed=1,seat=1,strength='intermediate'}={}){
 if(!Object.hasOwn(BOT_LEVELS,strength))throw Error('Choose a bot strength.');
 if(!engine.BOARD_SIZES.includes(size)||![0,1].includes(seat))throw Error('Invalid bot board or seat.');
 return createPlanner(engine,{size,seed,seat,level:strength});
}
export function wholeRuns(board,S){
 const result=[];
 for(let axis=0;axis<2;axis++)for(let line=0;line<S;line++){
  let cells=[];
  for(let k=0;k<=S;k++){
   const i=axis?k*S+line:line*S+k;
   if(k<S&&board[i]!==null)cells.push(i);
   else{if(cells.length>1)result.push(cells);cells=[];}
  }
 }
 for(let i=0;i<board.length;i++)if(board[i]!==null&&!neighbors(i,S).some(j=>board[j]!==null))result.push([i]);
 return result;
}
const neighbors=(i,S)=>[i%S?i-1:-1,i%S<S-1?i+1:-1,i>=S?i-S:-1,i<S*(S-1)?i+S:-1].filter(i=>i>=0);
const hard=p=>[0,4,6,8].reduce((s,d)=>s+p[d],0);
const guards=p=>[1,3,7,9].reduce((s,d)=>s+p[d],0);
const reading=(board,cells,perspective=0)=>(perspective===1?cells.slice().reverse():cells).map(i=>board[i]).join('');
// Every complete legal target is examined; no target-count or clock cutoff.
export function scanSmallFactors(board,perspective=0){
 const size=engine.getBoardSize(board);
 if(![0,1].includes(perspective))throw Error('Choose a player perspective.');
 return wholeRuns(board,size).map(cells=>{
  const digits=reading(board,cells,perspective),n=BigInt(digits);
  const factors=SMALL_PRIMES.filter(p=>(n===0n||BigInt(p)<n)&&n%BigInt(p)===0n).map(String);
  return {cells,digits,reverse:perspective===1,factors};
 });
}
function smallChallenge(target,excluded=[]){
 const factor=target?.factors.find(f=>!excluded.includes(f));
 return factor?{action:'challenge',a:target.cells[0],b:target.cells.at(-1),reverse:target.reverse,factor,cells:target.cells,digits:target.digits,source:'full-board small-prime scan'}:null;
}
const pattern=text=>text;
function branch(engine,state,command){
 const next={...state,board:state.board.slice(),piles:state.piles.map(p=>p.slice()),taxed:state.taxed?.slice(),clocks:state.clocks.slice(),history:state.history.slice(),lastCells:state.lastCells.slice()};
 engine.complete(next,command,state.lastTick);return next;
}

function createPlanner(engine,{size,seed,seat,style='balanced',level='intermediate'}){
 const temperament=STYLES[style],skill=BOT_LEVELS[level];
 if(!temperament||!skill)throw Error('Unknown player profile');
 let rng=(seed^Math.imul(seat+1,0x9e3779b1))>>>0;
 const random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);
 const pick=a=>a[Math.floor(random()*a.length)];
 const facts=new Map(),punished=new Map();let observed=0;
 function remember(text,result){
  facts.delete(text);facts.set(text,result);
  if(facts.size>24)facts.delete(facts.keys().next().value);
 }
 function observe(state){
  for(let i=observed;i<state.history.length;i++){
   const entry=state.history[i];
   if(entry.action==='challenge'&&entry.success){
    remember(entry.digits,{factor:entry.factor,source:'seen challenge'});
    const previous=state.history[i-1];
    if(previous?.player===seat&&previous.moves?.some(m=>entry.cells.includes(m.index)))punished.set(pattern(entry.digits),i+12);
   }
  }
  observed=state.history.length;
  for(const [key,expiry]of punished)if(expiry<observed)punished.delete(key);
 }
 function inspect(board,cells,ctx,limit=ctx.budget,perspective=0,excluded=[]){
  const text=reading(board,cells,perspective),known=facts.get(text);
  const charge=cost=>{if(ctx.seconds+cost>limit){ctx.unfinishedChecks++;return false;}ctx.seconds+=cost;return true;};
  const found=(factor,source)=>({action:'challenge',a:cells[0],b:cells.at(-1),reverse:perspective===1,factor:String(factor),cells,digits:text,source});
  if(known?.factor&&!excluded.includes(known.factor)&&charge(.2*skill.speed)){
   ctx.cacheHits++;return found(known.factor,'remembered factor');
  }
  for(const check of factorChecks(text,level)){
   if(!charge(check.cost))return null;
   if(check.divides&&!excluded.includes(check.factor)){
    remember(text,{factor:check.factor,source:'mental divisibility check'});return found(check.factor,check.method);
   }
  }
  return null;
 }
 function secondSquares(board,first){
  const squares=[],x=first%size,y=Math.floor(first/size);
  // Only the first empty square in each direction can complete this run.
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   let a=x+dx,b=y+dy;
   while(a>=0&&a<size&&b>=0&&b<size){
    const index=b*size+a;if(board[index]===null){squares.push(index);break;}
    a+=dx;b+=dy;
   }
  }
  return squares;
 }
 function winningPlacement(state){
  const pile=state.piles[state.turn],count=engine.total(pile);if(count>2)return null;
  const digits=pile.flatMap((n,d)=>Array(n).fill(d));
  const empty=state.board.map((d,i)=>d===null?i:-1).filter(i=>i>=0);
  if(count===1){for(const index of empty){const command={action:'single',moves:[{index,digit:digits[0]}]};try{engine.placement(state,command.action,command.moves);return command;}catch{}}}
  if(count===2){
   const edge=empty.filter(i=>engine.adjacent(state.board,i));
   for(const index of edge)for(const order of [digits,digits.slice().reverse()]){
    const board=state.board.slice();board[index]=order[0];
    const seconds=secondSquares(board,index);
    for(const next of seconds){const command={action:'double',moves:[{index,digit:order[0]},{index:next,digit:order[1]}]};try{engine.placement(state,command.action,command.moves);return command;}catch{}}
   }
  }
  return null;
 }
 function generate(state,limit,ctx){
  const pile=state.piles[state.turn],board=state.board,empty=board.map((d,i)=>d===null?i:-1).filter(i=>i>=0);
  const frontier=empty.filter(i=>engine.adjacent(board,i));
  const weighted=pile.flatMap((n,d)=>Array(n).fill(d)),difficult=weighted.filter(d=>[0,4,6,8].includes(d));
  const oddGuards=weighted.filter(d=>[1,3,7,9].includes(d));
  const isolated=empty.filter(i=>!engine.adjacent(board,i));
  const commands=[],seen=new Set();
  for(let attempt=0;attempt<limit*7&&commands.length<limit;attempt++){
   if(ctx.seconds+.12>ctx.budget)break;ctx.seconds+=.12;
   const template=attempt%4;let moves=[];
   if(template===0&&frontier.length&&engine.total(pile)>=2&&difficult.length&&oddGuards.length){
    // An existing odd guard plus a difficult middle digit plus a new guard.
    const index=pick(frontier),digit=pick(difficult),x=index%size,y=Math.floor(index/size);
    const directions=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>{
     const ax=x-dx,ay=y-dy,bx=x+dx,by=y+dy;
     return ax>=0&&ax<size&&ay>=0&&ay<size&&bx>=0&&bx<size&&by>=0&&by<size&&board[by*size+bx]===null&&[1,3,7,9].includes(board[ay*size+ax]);
    });
    if(directions.length){const [dx,dy]=pick(directions);moves=[{index,digit},{index:(y+dy)*size+x+dx,digit:pick(oddGuards)}];}
   }
   if(!moves.length&&frontier.length&&engine.total(pile)>=2&&template<3){
    const index=pick(frontier),digit=pick(weighted),copy=board.slice();copy[index]=digit;
    const legal=secondSquares(copy,index),near=neighbors(index,size).filter(i=>copy[i]===null),favorNear=random()<.75;
    const next=favorNear&&near.length?near:legal;
    if(next.length)moves=[{index,digit},{index:pick(next),digit:pick(weighted)}];
   }
   if(!moves.length){
    // Mix bridges, adjacent singles, and isolated singles; no target move quota.
    const bridges=frontier.filter(i=>neighbors(i,size).filter(j=>board[j]!==null).length>=2);
    const safeDigits=weighted.filter(d=>[1,2,3,5,7].includes(d));
    const index=pick(bridges.length&&random()<.5?bridges:isolated.length&&safeDigits.length&&random()<.5?isolated:empty);
    moves=[{index,digit:pick(isolated.includes(index)&&safeDigits.length?safeDigits:weighted)}];
   }
   const command={action:moves.length===2?'double':'single',moves},key=JSON.stringify(command);
   if(seen.has(key))continue;
   try{engine.placement(state,command.action,moves);seen.add(key);commands.push(command);}catch{}
  }
  // A legal single is always available for a nonzero digit if any square is free.
  if(!commands.length)for(const index of empty)for(const digit of [...new Set(weighted)]){
   const command={action:'single',moves:[{index,digit}]};try{engine.placement(state,'single',command.moves);return [command];}catch{}
  }
  return commands;
 }
 function evaluate(state,root){
  if(state.ended)return state.ended.winner===root?100000:-100000;
  const burden=p=>hard(p)+(engine.total(p)<=12?1.5:1)*Math.max(0,Math.ceil(hard(p)/2)-guards(p));
  const own=state.piles[root],opponent=state.piles[1-root];
  // Returning a tile and shedding one affect the race symmetrically. The former
  // evaluation valued an opponent's returned tile at less than half an own tile.
  return 3*(engine.total(opponent)-engine.total(own))+temperament.inventory*(burden(opponent)-burden(own));
 }
 function singleIdeas(state,limit){
  const groups=[[],[],[]];
  for(let index=0;index<state.board.length;index++)if(state.board[index]===null){
   const occupied=neighbors(index,size).filter(i=>state.board[i]!==null).length;
   groups[occupied===0?0:occupied===1?1:2].push(index);
  }
  const available=groups.filter(g=>g.length),digits=[1,4,3,6,7,8,9,2,5,0].filter(d=>state.piles[state.turn][d]);
  const result=[],seen=new Set();
  if(!available.length||!digits.length)return result;
  // Sample isolated anchors, extensions and bridges separately. Isolated
  // composites are legal and return no tiles if challenged; do not omit them.
  for(let attempt=0;attempt<limit*8&&result.length<limit;attempt++){
   const group=available[attempt%available.length],digit=digits[Math.floor(attempt/available.length)%digits.length];
   const move={index:pick(group),digit},key=move.index+':'+digit;
   if(seen.has(key))continue;seen.add(key);
   try{engine.placement(state,'single',[move]);result.push({action:'single',moves:[move]});}catch{}
  }
  return result;
 }
 function search(state,extra,ctx,pressure){
  const root=state.turn,boardCache=new Map(),actionCache=new Map(),winCache=new Map(),transpositions=new Map();
  const stats={searchModel:SEARCH_MODEL,searchNodes:0,searchDepth:0,searchCutoffs:0,searchCacheHits:0,searchGenerated:0,threatDefenses:0,replies:0,followups:0,placementCoverage:{nodesWithSingles:0,nodesRetainingSingles:0,nodesWithDoubles:0,nodesRetainingDoubles:0},exploredMoveTypes:{single:0,double:0,challenge:0}};
  const nodeLimit=pressure?Math.min(skill.nodes,160):skill.nodes;
  const maxDepth=pressure?Math.min(skill.depth,2):skill.depth;
  const stopped=Symbol('search budget');
  const boardKey=s=>s.board.map(d=>d===null?'.':d).join('');
  const positionKey=s=>boardKey(s)+'/'+s.turn+'/'+s.piles.map(p=>p.join(',')).join('/')+'/'+s.taxed.join(',')+'/'+(s.timeOutRule?s.elapsed+':'+s.leader+':'+s.streak:'');
  function information(s){
   const key=boardKey(s);if(boardCache.has(key))return boardCache.get(key);
   const both=[...scanSmallFactors(s.board,0),...scanSmallFactors(s.board,1)],scans=[both,both];
   const challenges=scans.map(targets=>targets.flatMap(t=>{
    const known=smallChallenge(t);if(known)return [known];
    const fact=facts.get(t.digits),n=BigInt(t.digits),f=fact?.factor&&BigInt(fact.factor);
    return f&&f>1n&&f<n&&n%f===0n?[{action:'challenge',a:t.cells[0],b:t.cells.at(-1),reverse:t.reverse,factor:String(f),cells:t.cells,digits:t.digits,source:'remembered factor'}]:[];
   }).sort((a,b)=>b.cells.length-a.cells.length));
   const result={scans,challenges,best:challenges.map(c=>c.length?Math.max(0,c[0].cells.length-2):0)};
   boardCache.set(key,result);return result;
  }
  function win(s){
   const key=positionKey(s);if(!winCache.has(key))winCache.set(key,winningPlacement(s));return winCache.get(key);
  }
  function score(s){
   if(s.ended)return evaluate(s,root);
   const info=information(s);
   // Include stored captures on both sides, including numbers untouched by the
   // last move. The player about to move has first use of their capture.
   const reserve=player=>info.best[player]*(s.turn===player?1.5:.7);
   return evaluate(s,root)+reserve(root)-reserve(1-root)+(s.turn===root?.2:-.2);
  }
  function endpoints(board,cells){
   if(cells.length===1)return neighbors(cells[0],size).filter(i=>board[i]===null);
   const step=cells[1]-cells[0],first=cells[0],last=cells.at(-1);
   return [first-step,last+step].filter(i=>i>=0&&i<board.length&&board[i]===null&&(step!==1||Math.floor(i/size)===Math.floor(first/size)));
  }
  function defenses(s,ply){
   if(level==='beginner'||ply>1)return [];
   const threats=information(s).challenges[1-s.turn].filter(c=>c.cells.length>=3).slice(0,ply===0?2:1);
   if(!threats.length)return [];
   const result=[],firsts=[],seen=new Set();
   for(const threat of threats)for(const index of endpoints(s.board,threat.cells)){
    const group=[];
    for(let digit=0;digit<10;digit++)if(s.piles[s.turn][digit]){
     try{
      const move={index,digit},p=engine.placement(s,'double',[move],true),next={...s,board:p.board,piles:s.piles.map((pile,i)=>i===s.turn?p.pile:pile)};
      const key=index+':'+digit;if(seen.has(key))continue;seen.add(key);
      const danger=information(next).best[1-s.turn];
      group.push({move,next,rank:-4*danger+(hard(s.piles[s.turn])-hard(p.pile))});
      try{engine.placement(s,'single',[move]);result.push({action:'single',moves:[move]});}catch{}
     }catch{}
    }
    group.sort((a,b)=>b.rank-a.rank);firsts.push(...group.slice(0,ply===0?2:1));
   }
   for(const first of firsts){
    const points=new Set(neighbors(first.move.index,size).filter(i=>first.next.board[i]===null));
    for(const line of engine.challengeLines(first.next.board,first.move.index))for(const i of endpoints(first.next.board,line.cells))points.add(i);
    for(const threat of information(first.next).challenges[1-s.turn].slice(0,1))for(const i of endpoints(first.next.board,threat.cells))points.add(i);
    for(const index of points)for(let digit=0;digit<10;digit++)if(first.next.piles[s.turn][digit]){
     if(ply>0&&![1,3,7,9].includes(digit))continue;
     const command={action:'double',moves:[first.move,{index,digit}]};
     try{engine.placement(s,command.action,command.moves);result.push(command);}catch{}
    }
   }
   stats.threatDefenses+=result.length;return result;
  }
  function options(s,ply){
   const key=positionKey(s)+'/'+Math.min(ply,2);if(actionCache.has(key))return actionCache.get(key);
   const victory=win(s);if(victory){const r=[{command:victory,next:branch(engine,s,victory)}];actionCache.set(key,r);return r;}
   const scratch={seconds:0,budget:Infinity};
   const randomPlacements=generate(s,ply===0?skill.ideas:Math.max(4,skill.width*2),scratch);
   const singles=singleIdeas(s,ply===0?Math.max(4,Math.floor(skill.ideas/2)):Math.max(2,skill.width));
   const commands=[...information(s).challenges[s.turn],...(ply===0?extra:[]),...defenses(s,ply),...randomPlacements,...singles];
   const unique=new Set(),children=[];
   for(const command of commands){
    const signature=command.action==='challenge'?'c:'+command.a+':'+command.b+':'+command.reverse:JSON.stringify(command.moves);
    if(unique.has(signature))continue;unique.add(signature);
    try{
     const next=branch(engine,s,command);
     const immediate=next.ended?null:win(next);
     const value=immediate?(next.turn===root?100000:-100000):score(next);
     children.push({command,next,value});stats.searchGenerated++;
    }catch{}
   }
   const sign=s.turn===root?1:-1;
   children.sort((a,b)=>sign*(b.value-a.value));
   // Keep different placement options alive before comparing their deeper
   // continuations. Immediate two-tile progress must not prune every Single.
   const width=ply===0?skill.rootWidth:skill.width;
   const placements=children.filter(c=>c.command.action!=='challenge'),kept=new Set();
   const minimum=Math.max(1,Math.floor(width/4));
   const singleRole=c=>{
    const move=c.command.moves[0],occupied=neighbors(move.index,size).filter(i=>s.board[i]!==null).length;
    return (occupied===0?'isolated':occupied===1?'extension':'bridge')+([4,6,8].includes(move.digit)?':hard':':other');
   };
   for(const action of ['single','double']){
    const pool=placements.filter(c=>c.command.action===action),roles=new Set();let count=0;
    for(const c of pool){
     const role=action==='single'?singleRole(c):JSON.stringify(c.next.board);
     if(roles.has(role))continue;
     roles.add(role);kept.add(c);if(++count===minimum)break;
    }
    if(count<minimum)for(const c of pool)if(!kept.has(c)){kept.add(c);if(++count===minimum)break;}
   }
   for(const c of placements){if(kept.size>=width)break;kept.add(c);}
   // Preserve global move order for alpha-beta pruning and retain every known
   // challenge. These are search slots, never quotas for moves actually played.
   const selected=children.filter(c=>c.command.action==='challenge'||kept.has(c));
   const tally=list=>Object.fromEntries(['single','double','challenge'].map(action=>[action,list.filter(c=>c.command.action===action).length]));
   const generated=tally(children),retained=tally(selected);
   for(const [action,label]of [['single','Singles'],['double','Doubles']]){
    if(generated[action])stats.placementCoverage['nodesWith'+label]++;
    if(retained[action])stats.placementCoverage['nodesRetaining'+label]++;
   }
   if(ply===0)stats.rootCandidates={generated,retained,singleAlternatives:selected.filter(c=>c.command.action==='single').map(c=>({...c.command.moves[0],role:singleRole(c),staticScore:c.value}))};
   actionCache.set(key,selected);return selected;
  }
  function minimax(s,depth,alpha,beta,ply,quiet=2){
   if(++stats.searchNodes>nodeLimit)throw stopped;
   if(s.ended)return {value:evaluate(s,root),pv:[]};
   const victory=win(s);if(victory)return {value:s.turn===root?100000-ply:-100000+ply,pv:[victory]};
   const originalAlpha=alpha,originalBeta=beta;
   const key=positionKey(s)+'/'+depth+'/'+quiet+'/'+ply;
   if(transpositions.has(key)){stats.searchCacheHits++;return transpositions.get(key);}
   const maximize=s.turn===root;
   let children;
   if(depth<=0){
    if(!quiet)return {value:score(s),pv:[]};
    // Extend tactical capture sequences past the nominal horizon. Stand pat
    // represents declining a capture, rather than forcing every available one.
    children=information(s).challenges[s.turn].filter(c=>c.cells.length>=3||engine.total(s.piles[1-s.turn])<=2).map(command=>({command,next:branch(engine,s,command)}));
    if(!children.length)return {value:score(s),pv:[]};
   }else children=options(s,ply);
   let best={value:depth<=0?score(s):maximize?-Infinity:Infinity,pv:[]},cutoff=false;
   for(const child of children){
    stats.exploredMoveTypes[child.command.action]++;
    if(ply===1)stats.replies++;if(ply===2)stats.followups++;
    const reply=minimax(child.next,depth-1,alpha,beta,ply+1,depth<=0?quiet-1:quiet);
    if(maximize?reply.value>best.value:reply.value<best.value)best={value:reply.value,pv:[child.command,...reply.pv]};
    if(maximize)alpha=Math.max(alpha,best.value);else beta=Math.min(beta,best.value);
    if(beta<=alpha){stats.searchCutoffs++;cutoff=true;break;}
   }
   if(!Number.isFinite(best.value))best={value:score(s),pv:[]};
   if(!cutoff&&best.value>originalAlpha&&best.value<originalBeta)transpositions.set(key,best);
   return best;
  }
  stats.opponentSmallPrimeTargets=information(state).scans[1-root].filter(t=>t.factors.length).length;
  stats.opponentBestCapture=information(state).best[1-root];
  const roots=options(state,0);
  if(!roots.length)return {command:null,stats};
  let selected=roots[0],variation=[selected.command],value=selected.value;
  for(let depth=1;depth<=maxDepth;depth++){
   let best=null,alpha=-Infinity;
   const ordered=roots.slice().sort((a,b)=>(a===selected?-1:b===selected?1:0));
   try{
    for(const child of ordered){
     stats.exploredMoveTypes[child.command.action]++;
     const reply=minimax(child.next,depth-1,alpha,Infinity,1);
     if(!best||reply.value>best.value)best={child,value:reply.value,pv:[child.command,...reply.pv]};
     alpha=Math.max(alpha,reply.value);
    }
   }catch(error){if(error!==stopped)throw error;break;}
   selected=best.child;value=best.value;variation=best.pv;stats.searchDepth=depth;
   if(value>=99900)break;
  }
  Object.assign(stats,{principalVariation:variation,chosenScore:value,considered:roots.length,knownExposure:information(selected.next).best[1-root]});
  return {command:selected.command,stats};
 }
 function choose(state){
  observe(state);
  const root=state.turn,clock=state.clocks[root],pressure=clock!==null&&clock<90;
  const budget=clock!==null&&clock<10?.8:clock!==null&&clock<30?2:clock!==null&&clock<90?4:skill.budget*(.85+random()*.3);
  const scanned=[...scanSmallFactors(state.board,0),...scanSmallFactors(state.board,1)];
  const scanSeconds=scanned.length?FULL_SCAN_SECONDS*skill.speed:0;
  const ctx={seconds:Math.min(budget*.2,1+random())+scanSeconds,budget,cacheHits:0,unfinishedChecks:0,replies:0,followups:0,smallPrimeRunsScanned:scanned.length,smallPrimeTargets:scanned.filter(t=>t.factors.length).length,scanSeconds};
  if(state.board.every(d=>d===null)){
   const choices=[1,2,3,5,7].filter(d=>state.piles[seat][d]>0);
   if(choices.length){const center=Math.floor(size/2),index=center*size+center;return {command:{action:'single',moves:[{index,digit:pick(choices)}]},seconds:1.2+random()*1.5,trace:{...ctx,opening:true}};}
  }
  const immediate=winningPlacement(state);
  if(immediate)return {command:immediate,seconds:ctx.seconds+1,trace:{...ctx,style,level,pressure,immediateWin:true,considered:1}};
  const extra=[];
  const targets=scanned.filter(t=>!t.factors.length).map(({cells,reverse})=>({cells,reverse,rank:(cells.some(i=>state.lastCells.includes(i))?100:0)+cells.length*2})).sort((a,b)=>b.rank-a.rank).slice(0,pressure?1:skill.targets);
  for(const {cells,reverse}of targets){const f=inspect(state.board,cells,ctx,budget*.35,reverse?1:0);if(f)extra.push(f);}
  const result=search(state,extra,ctx,pressure);
  if(!result.command){
   for(const cells of wholeRuns(state.board,size))for(const reverse of [false,true]){
    const text=reading(state.board,cells,reverse?1:0),n=BigInt(text);
    if(n>2n||n===0n)return {command:{action:'challenge',a:cells[0],b:cells.at(-1),reverse,factor:'2'},seconds:Math.max(.5,budget),trace:{...ctx,...result.stats,speculative:true}};
   }
   return {command:null,seconds:1,trace:{...ctx,...result.stats,noLegalMove:true}};
  }
  // Searching hypothetical branches is separate from arithmetic discovery.
  // Its bounded assumed cost does not consume the small-prime scan's budget.
  const planningSeconds=result.stats.searchNodes*.004*skill.speed;
  return {command:result.command,seconds:Math.max(.5,Math.min(budget,ctx.seconds+planningSeconds+1)),trace:{...ctx,...result.stats,style,level,pressure,immediateWin:false,planningSeconds}};
 }
 return {choose,observe,profile:{style,level,...temperament,...skill}};
}
