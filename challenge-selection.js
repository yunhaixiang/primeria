import {challengeLines,challengeNumber,getBoardSize} from './engine.js?v=8fbacc9628';

// An intersection has no default axis: only a clear pointer direction selects it.
export function pointedChallenge(board,index,{rotation=0,dx=null,dy=null,tolerance=2}={}){
 const choices=challengeLines(board,index);
 if(choices.length<2)return {choices,line:choices[0]??null};
 if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.abs(Math.abs(dx)-Math.abs(dy))<=tolerance)return {choices,line:null};
 const horizontal=Math.abs(dx)>Math.abs(dy),axis=horizontal!==(rotation%2===1)?'row':'column';
 return {choices,line:choices.find(line=>line.axis===axis)??null};
}

export function readingDirection(board,cells,rotation=0){
 const size=getBoardSize(board),position=index=>{let x=index%size,y=Math.floor(index/size);for(let i=0;i<rotation;i++)[x,y]=[size-1-y,x];return [x,y];};
 if(cells.length===1)return 'Single tile';
 const [ax,ay]=position(cells[0]),[bx,by]=position(cells.at(-1));
 return ax!==bx?(ax<bx?'Left → right':'Right → left'):(ay<by?'Top → bottom':'Bottom → top');
}

export function challengeReadingChoices(state,ends,rotation=0){
 if(ends.length!==2)return [];
 const forward=challengeNumber(state,...ends,false),readings=forward.cells.length===1?[forward]:[forward,challengeNumber(state,...ends,true)];
 return readings.map(reading=>({...reading,label:readingDirection(state.board,reading.readingCells,rotation)}));
}
