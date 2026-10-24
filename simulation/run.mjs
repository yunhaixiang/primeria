import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ARITHMETIC_MODEL,SEARCH_MODEL} from '../bot.js';
import {simulateGame} from './game.js';
const args=process.argv.slice(2),options={games:60,seed:20261023,output:null};
for(let i=0;i<args.length;i+=2){
 const name=args[i]?.replace(/^--/,'');
 if(!Object.hasOwn(options,name)||args[i+1]===undefined)throw Error('Use --games N --seed N --output PATH.');
 options[name]=name==='output'?args[i+1]:Number(args[i+1]);
}
if(!Number.isInteger(options.games)||options.games<1||options.games>1000||!Number.isInteger(options.seed)||options.seed<0||options.seed>0xffffffff)throw Error('Games must be 1–1000 per board; seed must be uint32.');
const profiles=[['beginner','beginner'],['intermediate','intermediate'],['advanced','intermediate']],games=[];
for(const size of [9,11,13,15])for(let run=0;run<options.games;run++){
 const strengths=profiles[run%3].slice();if(run%3===2&&Math.floor(run/3)%2)strengths.reverse();
 games.push({...simulateGame({size,seed:(options.seed+Math.floor(run/3)*104729)>>>0,first:Math.floor(run/6)%2,strengths}),run});
}
const summary=[9,11,13,15].map(size=>{
 const rows=games.filter(r=>r.size===size),done=rows.filter(r=>r.finished),mean=f=>done.length?done.reduce((n,r)=>n+f(r),0)/done.length:null;
 return {size,games:rows.length,finished:done.length,incomplete:rows.length-done.length,meanSingles:mean(r=>r.counts.single),meanDoubles:mean(r=>r.counts.double),meanChallenges:mean(r=>r.counts.challenge),meanMoves:mean(r=>r.moves),meanModelMinutes:mean(r=>r.modelSeconds/60)};
});
const hashes=Object.fromEntries(['bot.js','engine.js'].map(name=>[name,createHash('sha256').update(fs.readFileSync(new URL('../'+name,import.meta.url))).digest('hex')]));
const result={method:{arithmeticModel:ARITHMETIC_MODEL,searchModel:SEARCH_MODEL,sourceHashes:hashes,gamesPerBoard:options.games,seed:options.seed,timeControl:'Rapid 20+20; tie-breaker off',timing:'Assumed bot thinking seconds plus three-second opening and challenge-result countdowns; not measured human times.',profiles:'Cycle beginner/beginner, intermediate/intermediate, advanced/intermediate; balance stronger seat and first player independently in blocks of 12.',historical:'Prior study results retain their previous arithmetic and search assumptions; rerun all conditions with the new model for a fair comparison.'},summary,games};
if(options.output)fs.writeFileSync(options.output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({arithmeticModel:ARITHMETIC_MODEL,summary,output:options.output},null,2));
