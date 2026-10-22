import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,complete} from './engine.js';
import {splitPermissions,splitPanelHTML} from './split-view.js';
const active=()=>{const s=newGame({first:0});s.started=true;return s;};
const options=seat=>({seat,tile:d=>`<span>${d}</span>`,formatTime:t=>String(t)});
test('split seats allow only the current human to draft a move',()=>{
 const s=active();assert.equal(splitPermissions(s,0).canMove,true);assert.equal(splitPermissions(s,1).canMove,false);
 complete(s,{action:'single',moves:[{index:0,digit:3}]});
 assert.equal(splitPermissions(s,0).canMove,false);assert.equal(splitPermissions(s,1).canMove,true);
});
test('online and bot seats retain their existing authority',()=>{
 const s=active();s.turn=1;
 assert.equal(splitPermissions(s,1,{role:0}).canMove,false);
 assert.equal(splitPermissions(s,1,{role:1,connected:true}).canMove,true);
 assert.equal(splitPermissions(s,1,{role:1,connected:false}).canMove,false);
 assert.equal(splitPermissions(s,1,{botPlayer:1}).canMove,false);
 assert.equal(splitPermissions(s,0,{botPlayer:1}).canResign,true);
});
test('paused, opening, ended, disconnected and review boards prevent drafting',()=>{
 for(const patch of [{paused:true},{startCountdown:{}},{ended:{winner:0}}])assert.equal(splitPermissions(Object.assign(active(),patch),0).canMove,false);
 assert.equal(splitPermissions(active(),0,{networkPaused:true}).canMove,false);
 assert.equal(splitPermissions(active(),0,{reviewMove:0}).canMove,false);
 assert.equal(splitPermissions(active(),0,{resigning:0}).canMove,false);
});
test('a failed attempt countdown allows only its challenger to quit',()=>{
 const s=active();s.challengeAttempt={};s.paused=true;
 assert.equal(splitPermissions(s,0,{verdict:{retry:true}}).canQuit,true);
 assert.equal(splitPermissions(s,1,{verdict:{retry:true}}).canQuit,false);
 assert.equal(splitPermissions(s,0,{verdict:{retry:true}}).canMove,false);
 assert.equal(splitPermissions(s,0,{verdict:{retry:false}}).canQuit,false);
});
test('each panel keeps its own inventory, escapes names, and has no duplicate IDs',()=>{
 const s=active();s.names=['<one>','two'];s.piles[0][3]=2;s.piles[1][3]=4;
 const first=splitPanelHTML(s,{...options(0),pending:[{index:0,digit:3}]});
 const second=splitPanelHTML(s,{...options(1),pending:[{index:0,digit:3}]});
 assert.match(first,/Digit 3, 1 remaining/);assert.match(second,/Digit 3, 4 remaining/);
 assert.match(first,/&lt;one&gt;/);
 const ids=[...(first+second).matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
 assert.match(second,/data-split-command="digit" data-value="3"[^>]*disabled/);
});
test('second seat challenges read from the same fixed challenger perspective',()=>{
 const s=active();s.turn=1;s.board[0]=1;s.board[1]=2;
 const html=splitPanelHTML(s,{...options(1),action:'challenge',ends:[0,1],factor:'3'});
 assert.match(html,/<strong>21<\/strong>/);assert.match(html,/Challenger’s perspective/);
 assert.match(html,/Submit challenge/);assert.match(html,/Factor digit 3/);
});
test('ended panels offer history review and preserve expanded history',()=>{
 const s=active();complete(s,{action:'single',moves:[{index:0,digit:3}]});s.ended={winner:0,reason:'by resignation'};
 const html=splitPanelHTML(s,{...options(1),historyOpen:true,reviewMove:0});
 assert.match(html,/class="split-history" open/);assert.match(html,/data-split-command="history" data-move="1"/);assert.match(html,/data-split-command="review-next"/);
});
test('rendering both seats never changes the game, draft, or player perspectives',()=>{
 const s=active();s.board[0]=1;s.board[1]=2;s.turn=1;
 const before=structuredClone(s),pending=[{index:2,digit:3}];
 for(const seat of [0,1])splitPanelHTML(s,{...options(seat),pending,action:'challenge',ends:[0,1]});
 assert.deepEqual(s,before);assert.deepEqual(pending,[{index:2,digit:3}]);
});

test('phone panel toggles control their own accessible body without changing permission',()=>{
 const s=active();for(const seat of [0,1])for(const panelOpen of [false,true]){
  const html=splitPanelHTML(s,{...options(seat),panelOpen});
  assert.match(html,new RegExp('aria-expanded="'+panelOpen+'" aria-controls="split-body-'+seat+'"'));
  assert.match(html,new RegExp('id="split-body-'+seat+'" class="split-panel-body" data-phone-open="'+panelOpen+'"'));
  assert.match(html,new RegExp('split-phone-clock" data-player="'+seat+'"'));
 }
 assert.equal(splitPermissions(s,1).canMove,false);
});
