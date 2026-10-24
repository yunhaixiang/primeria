import {createBot} from './bot.js?v=dfdffc7ea0';
let bot=null,gameKey=null;
self.onmessage=event=>{
 const {id,state,key,seed}=event.data;
 try{
  if(key!==gameKey){bot=createBot({size:state.boardSize,seed,strength:state.bot.strength,seat:state.bot.player});gameKey=key;}
  const result=bot.choose(state);
  self.postMessage({id,result});
 }catch(error){self.postMessage({id,error:error.message});}
};
