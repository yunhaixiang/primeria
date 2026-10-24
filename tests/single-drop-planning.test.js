import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {newGame,complete,adjacent,placement} from '../engine.js';
import {createBot,scanSmallFactors,BOT_LEVELS,SEARCH_MODEL} from '../bot.js';

function opening(size=11){
 const state={...newGame({boardSize:size,mode:'standard'},0),started:true};
 const index=Math.floor(size/2)*size+Math.floor(size/2);
 complete(state,{action:'single',moves:[{index,digit:1}]},0);
 return state;
}

for(const strength of Object.keys(BOT_LEVELS))test(`${strength}: Single Drops survive the placement cutoff after the opening`,()=>{
 const state=opening(),before=structuredClone(state);
 const plan=createBot({size:11,seat:1,seed:20261023,strength}).choose(state);
 assert.deepEqual(state,before);
 assert.equal(plan.trace.searchModel,SEARCH_MODEL);
 const {generated,retained}=plan.trace.rootCandidates;
 assert.ok(generated.single>0);assert.ok(generated.double>0);
 assert.ok(retained.single>0,'do not eliminate every single before lookahead');
 assert.ok(retained.double>0,'preserve Double Down alternatives too');
 assert.ok(retained.single+retained.double<=BOT_LEVELS[strength].rootWidth);
 assert.ok(plan.trace.exploredMoveTypes.single>0,'actually evaluate Single Drop continuations');
 const coverage=plan.trace.placementCoverage;
 assert.equal(coverage.nodesRetainingSingles,coverage.nodesWithSingles,'preserve singles in deeper positions as well');
 assert.equal(coverage.nodesRetainingDoubles,coverage.nodesWithDoubles);
});

test('Advanced considers an isolated composite as a legal way to shed a difficult digit',()=>{
 const state=opening();
 const plan=createBot({size:11,seat:1,seed:20261023,strength:'advanced'}).choose(state);
 const singles=plan.trace.rootCandidates.singleAlternatives;
 const isolated=singles.find(m=>[4,6,8,9].includes(m.digit)&&!adjacent(state.board,m.index));
 assert.ok(isolated,'isolated Single Drops must not be limited to prime digits');
 assert.doesNotThrow(()=>placement(state,'single',[isolated]));
});

test('searching Singles does not force one when a safe Double Down makes better progress',()=>{
 const state=opening();
 const plan=createBot({size:11,seat:1,seed:4,strength:'advanced'}).choose(state);
 assert.ok(plan.trace.rootCandidates.retained.single>0);
 assert.ok(plan.trace.exploredMoveTypes.single>0);
 assert.equal(plan.command.action,'double');
 assert.doesNotThrow(()=>placement(state,'double',plan.command.moves));
});

test('Advanced handles new reverse-reading threats in the former Single Drop defense fixture',()=>{
 const saved=JSON.parse(fs.readFileSync(new URL('./fixtures/single-drop-defense.json',import.meta.url)));
 const state={...newGame({boardSize:11,mode:'standard'},0),...saved,started:true};
 const worst=s=>Math.max(0,...[0,1].flatMap(reverse=>scanSmallFactors(s.board,reverse)).filter(t=>t.factors.length).map(t=>Math.max(0,t.cells.length-2)));
 assert.equal(worst(state),3);
 const plan=createBot({size:11,seat:1,seed:20261023,strength:'advanced'}).choose(state);
 assert.ok(plan.trace.rootCandidates.retained.single>0);
 assert.ok(plan.trace.exploredMoveTypes.single>0);
 assert.ok(plan.trace.searchDepth>=3);
 complete(state,plan.command,0);
 assert.ok(worst(state)<3,'reduce the capture available in either reading direction');
});
