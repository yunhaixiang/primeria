import * as engine from './engine.js?v=a715b1f2ae';

export const BOT_LEVELS={
 beginner:{label:'Beginner',description:'Basic divisibility checks and short plans.',speed:1.5,ideas:5,targets:2,replies:1,followups:0,budget:7,eleven:false,primes:[7],maxDigits:2,noise:2.5},
 intermediate:{label:'Intermediate',description:'Checks 3, 9, 11, 7 and 13; considers replies.',speed:1,ideas:10,targets:4,replies:2,followups:0,budget:12,eleven:true,primes:[7,13],maxDigits:9,noise:.6},
 advanced:{label:'Advanced',description:'More small-prime checks and deeper planning.',speed:.7,ideas:18,targets:7,replies:4,followups:2,budget:18,eleven:true,primes:[7,13,17,19,23,29,31],maxDigits:13,noise:.15}
};
export function botConfig(state){const b=state?.bot;return b&&b.player===1&&Object.hasOwn(BOT_LEVELS,b.strength)&&typeof b.id==='string'&&b.id.length>0&&b.id.length<100&&Number.isInteger(b.seed)&&b.seed>=0&&b.seed<=0xffffffff?b:null;}
export function isBotTurn(state){return !!botConfig(state)&&state.turn===1;}
// Each check has a mental time cost. No primality oracle or unrestricted factoring.
export function factorChecks(digits,strength='intermediate'){
 if(!/^\d{1,15}$/.test(digits)||!Object.hasOwn(BOT_LEVELS,strength))throw Error('Invalid bot arithmetic input.');
 const level=BOT_LEVELS[strength],n=BigInt(digits),last=Number(digits.at(-1)),sum=[...digits].reduce((a,d)=>a+Number(d),0);
 const checks=[],add=(factor,cost,test)=>checks.push({factor:String(factor),cost:cost*level.speed,divides:(n===0n||BigInt(factor)<n)&&test,method:factor});
 add(2,.25,last%2===0);add(5,.25,last===0||last===5);add(10,.2,last===0);
 add(4,last%2===0?.4:.04,Number(digits.slice(-2))%4===0);add(8,last%2===0?.65:.04,Number(digits.slice(-3))%8===0);
 add(3,.4+digits.length*.15,sum%3===0);add(9,.15,sum%9===0);add(6,.15,last%2===0&&sum%3===0);
 if(level.eleven)add(11,.5+digits.length*.2,[...digits].reduce((a,d,i)=>a+(i%2?-1:1)*Number(d),0)%11===0);
 if(digits.length<=level.maxDigits)for(const p of level.primes)add(p,.8+digits.length*(p<=13?.45:.65),n%BigInt(p)===0n);
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
 function inspect(board,cells,ctx,limit=ctx.budget,perspective=seat,excluded=[]){
  const text=reading(board,cells,perspective),known=facts.get(text);
  const charge=cost=>{if(ctx.seconds+cost>limit){ctx.unfinishedChecks++;return false;}ctx.seconds+=cost;return true;};
  const found=(factor,source)=>({action:'challenge',a:cells[0],b:cells.at(-1),factor:String(factor),cells,digits:text,source});
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
 function winningPlacement(state){
  const pile=state.piles[state.turn],count=engine.total(pile);if(count>2)return null;
  const digits=pile.flatMap((n,d)=>Array(n).fill(d));
  const empty=state.board.map((d,i)=>d===null?i:-1).filter(i=>i>=0);
  if(count===1){for(const index of empty){const command={action:'single',moves:[{index,digit:digits[0]}]};try{engine.placement(state,command.action,command.moves);return command;}catch{}}}
  if(count===2){
   const edge=empty.filter(i=>engine.adjacent(state.board,i));
   for(const index of edge.slice(0,12))for(const order of [digits,digits.slice().reverse()]){
    const board=state.board.slice();board[index]=order[0];
    const seconds=[...new Set([...neighbors(index,size).filter(i=>board[i]===null),...edge.filter(i=>i!==index)])].slice(0,12);
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
   }else if(template===1&&frontier.length&&engine.total(pile)>=2){
    // Put two guards around an already isolated difficult tile when possible.
    const anchors=board.map((d,i)=>d!==null&&!engine.adjacent(board,i)?i:-1).filter(i=>i>=0);
    const anchor=pick(anchors),axis=random()<.5?1:size;
    if(anchor!==undefined){const a=anchor-axis,b=anchor+axis;
     if(a>=0&&b<board.length&&(axis!==1||Math.floor(a/size)===Math.floor(b/size))&&board[a]===null&&board[b]===null&&oddGuards.length)moves=[{index:a,digit:pick(oddGuards)},{index:b,digit:pick(oddGuards)}];
    }
   }
   if(!moves.length&&frontier.length&&engine.total(pile)>=2&&template<3){
    const index=pick(frontier),digit=pick(weighted),copy=board.slice();copy[index]=digit;
    const next=random()<.75?neighbors(index,size).filter(i=>copy[i]===null):frontier.filter(i=>i!==index);
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
  const own=state.piles[root],opponent=state.piles[1-root],count=engine.total(own);
  const shortage=Math.max(0,Math.ceil(hard(own)/2)-guards(own));
  return -3*count+temperament.opponentWeight*engine.total(opponent)-temperament.inventory*(hard(own)+(count<=12?1.5:1)*shortage);
 }
 function assessed(state,command,ctx,limit=ctx.budget){
  const next=branch(engine,state,command),threats=[];let exposure=0,unverified=0,memoryPenalty=0;
  if(!next.ended&&command.moves){
   const local=wholeRuns(next.board,size).filter(c=>c.some(i=>command.moves.some(m=>m.index===i))).sort((a,b)=>b.length-a.length);
   for(const cells of local){
    const text=reading(next.board,cells,next.turn),ending=factorChecks(text,level).slice(0,3).find(c=>c.divides);
    if(ending){exposure=Math.max(exposure,cells.length-1);threats.push({action:'challenge',a:cells[0],b:cells.at(-1),factor:ending.factor});}
    if(punished.has(pattern(text)))memoryPenalty+=3;
    if(ctx.seconds>=limit){unverified++;continue;}
    const misses=ctx.unfinishedChecks,f=inspect(next.board,cells,ctx,limit,next.turn);
    if(f){threats.push(f);exposure=Math.max(exposure,(cells.length-1)*.75);}
    if(ctx.unfinishedChecks>misses)unverified++;
   }
  }
  return {command,next,threats,exposure,unverified,memoryPenalty};
 }
 function choose(state){
  observe(state);
  const root=state.turn,clock=state.clocks[root],pressure=clock!==null&&clock<90;
  const budget=clock!==null&&clock<10?.8:clock!==null&&clock<30?2:clock!==null&&clock<90?4:skill.budget*(.85+random()*.3);
  const ctx={seconds:Math.min(budget*.2,1+random()),budget,cacheHits:0,unfinishedChecks:0,replies:0,followups:0};
  if(state.challengeAttempt){
   const p=state.challengeAttempt,attempt=inspect(state.board,p.cells,ctx,ctx.budget,seat,p.attempts.map(a=>a.factor));
   return {command:attempt||{action:'quitChallenge'},seconds:Math.max(.5,Math.min(budget,ctx.seconds)),trace:{retry:true}};
  }
  if(state.board.every(d=>d===null)){
   const choices=[1,2,3,5,7].filter(d=>state.piles[seat][d]>0);
   if(choices.length){const center=Math.floor(size/2),index=center*size+center;return {command:{action:'single',moves:[{index,digit:pick(choices)}]},seconds:1.2+random()*1.5,trace:{opening:true}};}
  }
  const immediate=winningPlacement(state);
  if(immediate)return {command:immediate,seconds:ctx.seconds+1,trace:{...ctx,style,level,pressure,immediateWin:true,considered:1}};
  const candidates=[];
  const targets=wholeRuns(state.board,size).map(c=>({cells:c,rank:(c.some(i=>state.lastCells.includes(i))?100:0)+c.length*2+random()})).sort((a,b)=>b.rank-a.rank).slice(0,pressure?1:skill.targets);
  for(const {cells}of targets){const f=inspect(state.board,cells,ctx,Math.min(budget*.45,ctx.budget));if(f)candidates.push(assessed(state,f,ctx));}
  const commands=generate(state,pressure?Math.max(3,Math.floor(skill.ideas/2)):skill.ideas,ctx);
  for(const command of commands)candidates.push(assessed(state,command,ctx,budget*.65));
  if(!candidates.length){
   // If placement is blocked, a player may spend a challenge on a plausible factor.
   for(const cells of wholeRuns(state.board,size)){
    const text=reading(state.board,cells,seat),n=BigInt(text);
    if(n>2n||n===0n)return {command:{action:'challenge',a:cells[0],b:cells.at(-1),factor:'2'},seconds:Math.max(.5,budget),trace:{speculative:true}};
   }
   return {command:null,seconds:1,trace:{noLegalMove:true}};
  }
  for(const c of candidates){
   c.score=evaluate(c.next,root)-temperament.risk*(c.exposure*3+c.unverified*.6)-c.memoryPenalty;
   c.score+=(random()-.5)*skill.noise;
  }
  // Obvious ending traps are excluded when a known safer alternative exists.
  const safe=candidates.filter(c=>c.exposure===0);
  const pool=safe.length?safe:candidates;
  pool.sort((a,b)=>b.score-a.score);
  const examined=pool.slice(0,pressure?1:3);
  for(const c of examined){
   if(c.next.ended||ctx.seconds+1>=budget)continue;
   const replies=[];
   const win=winningPlacement(c.next);
   if(win)replies.push(assessed(c.next,win,ctx));
   for(const command of c.threats.slice(0,1))replies.push(assessed(c.next,command,ctx));
   for(const command of generate(c.next,Math.max(1,skill.replies-replies.length),ctx)){
    if(replies.length>=skill.replies||ctx.seconds>=budget)break;
    replies.push(assessed(c.next,command,ctx,budget*.9));
   }
   let worst=Infinity;
   for(const reply of replies){
    ctx.replies++;let value=evaluate(reply.next,root);
    if(skill.followups&&!reply.next.ended&&ctx.seconds+1<budget){
     const winBack=winningPlacement(reply.next);
     const followups=winBack?[winBack]:generate(reply.next,skill.followups,ctx);
     let best=-Infinity;
     for(const command of followups){if(ctx.seconds>=budget)break;const f=assessed(reply.next,command,ctx);ctx.followups++;best=Math.max(best,evaluate(f.next,root)-temperament.risk*(f.exposure*3+f.unverified*.6));}
     if(best>-Infinity)value=best;
    }
    worst=Math.min(worst,value);
   }
   if(worst<Infinity)c.score=worst-c.memoryPenalty-temperament.risk*c.unverified*.25;
  }
  // Risk and continuation are compared for all investigated candidates; neither
  // captures nor any placement type is required to appear a prescribed amount.
  examined.sort((a,b)=>b.score-a.score);
  const selected=examined[0];
  // Occasional arithmetic slips on longer calculations; subsequent attempts can recover.
  if(selected.command.action==='challenge'&&selected.command.digits?.length>=4&&random()<(level==='beginner'?.08:level==='intermediate'?.025:.005)){
   const next=BigInt(selected.command.factor)+1n;
   if(next<BigInt(selected.command.digits))selected.command={...selected.command,factor:String(next)};
  }
  return {command:selected.command,seconds:Math.max(.5,Math.min(ctx.budget,ctx.seconds)+.3),trace:{...ctx,style,level,pressure,immediateWin:false,considered:candidates.length,endingFallback:!safe.length,memoryAvoided:candidates.filter(c=>c.memoryPenalty>0).length,knownExposure:selected.exposure,chosenScore:selected.score}};
 }
 return {choose,observe,profile:{style,level,...temperament,...skill}};
}
