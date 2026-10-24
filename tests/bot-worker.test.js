import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {newGame,placement} from '../engine.js';
import {SEARCH_MODEL} from '../bot.js';

test('the playable worker loads the new planner and returns a legal Advanced move',async t=>{
 const url=new URL('../bot-worker.js',import.meta.url).href;
 const worker=new Worker(`
  const {parentPort}=require('node:worker_threads');
  globalThis.self={postMessage:message=>parentPort.postMessage(message)};
  import(${JSON.stringify(url)}).then(()=>parentPort.on('message',data=>self.onmessage({data}))).catch(error=>{throw error;});
 `,{eval:true});
 t.after(()=>worker.terminate());
 const state={...newGame({boardSize:15,mode:'standard'},0),started:true,turn:1};
 state.board[112]=1;state.bot={player:1,strength:'advanced',id:'deep-search-worker',seed:4};
 const reply=await new Promise((resolve,reject)=>{
  worker.once('message',resolve);worker.once('error',reject);
  worker.postMessage({id:8,state,key:'deep-search-worker',seed:4});
 });
 assert.equal(reply.id,8);assert.ok(!reply.error,reply.error);
 assert.equal(reply.result.trace.searchModel,SEARCH_MODEL);
 assert.ok(reply.result.trace.searchDepth>=3);
 assert.doesNotThrow(()=>placement(state,reply.result.command.action,reply.result.command.moves));
});
