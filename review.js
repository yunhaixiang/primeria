import {MODES,PILE} from './engine.js?v=0fb93642b8';

export function gameResult(game){
 if(!game.ended)return '';
 const reasons={'by playing every tile':'Clear-out','on time':'Time','by resignation':'Resignation','by the Time Out Rule':'Tie-breaker'};
 return `${game.names[game.ended.winner]} Wins by ${reasons[game.ended.reason]||game.ended.reason.replace(/^by /,'')}`;
}

// Replay recorded effects, rather than re-evaluating moves under a running clock.
export function reviewPosition(game,move){
 if(!Number.isInteger(move)||move<0||move>game.history.length)throw Error('Choose a move from this game.');
 const board=Array(game.board.length).fill(null),piles=[PILE.slice(),PILE.slice()],taxed=Array(10).fill(0);
 let lastCells=[],turn=game.history[0]?.player??game.turn;
 for(const entry of game.history.slice(0,move)){
  if(entry.action==='challenge'){
   lastCells=entry.cells.slice();
   if(entry.success){
    const final=entry.taxedCell??entry.readingCells?.at(-1)??(entry.reverse?entry.cells[0]:entry.cells.at(-1));
    for(const index of entry.cells){
     const digit=board[index];
     if(digit===null)throw Error('The saved move history is incomplete.');
     if(index===final)taxed[digit]++;else piles[1-entry.player][digit]++;
     board[index]=null;
    }
    for(const tile of entry.cleanup||[]){board[tile.index]=null;taxed[tile.digit]++;}
   }
  }else{
   lastCells=entry.moves.map(tile=>tile.index);
   for(const tile of entry.moves){board[tile.index]=tile.digit;piles[entry.player][tile.digit]--;}
  }
  turn=1-entry.player;
 }
 const entry=game.history[move-1],final=move===game.history.length;
 // Older saves did not record clocks at each move. Do not invent those times.
 const clocks=move===0?[MODES[game.mode][0],MODES[game.mode][0]]:final?game.clocks.slice():entry.clocks?.slice()??undefined;
 return {...game,board,piles,taxed,lastCells,turn,clocks,elapsed:entry?.elapsed??0,challengeAttempt:null};
}
