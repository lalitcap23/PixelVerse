import React from 'react';
const WINS=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
export const checkWinner=(b:(string|null)[])=>{
  for(const [a,c,d]of WINS)if(b[a]&&b[a]===b[c]&&b[c]===b[d])return b[a];
  return b.every(Boolean)?'draw':null;
};
const OV:React.CSSProperties={position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10000};
interface Props{onClose:()=>void;board:(string|null)[];turn:'X'|'O';symbol:'X'|'O'|null;onMove:(cell:number)=>void;onReset:()=>void;otherOnline:boolean;}
export const TicTacToe:React.FC<Props>=({onClose,board,turn,symbol,onMove,onReset,otherOnline})=>{
  const winner=checkWinner(board);
  const myTurn=turn===symbol&&!winner;
  const statusColor=winner==='draw'?'#fbbf24':winner?'#86efac':myTurn?'#a78bfa':'#94a3b8';
  const statusMsg=!symbol?'Waiting for a 2nd player in the zone…':winner==='draw'?'🤝 Draw!':winner?`🏆 ${winner} wins!`:myTurn?`Your turn (${symbol})`:`Waiting for ${turn}…`;
  return(
    <div style={OV}><div style={{background:'#080015',border:'1.5px solid rgba(139,92,246,0.55)',borderRadius:16,overflow:'hidden',width:420,boxShadow:'0 0 50px rgba(139,92,246,0.35)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 20px',background:'linear-gradient(135deg,#312e81,#7c3aed)',color:'white',fontWeight:700,fontSize:18}}>
        <span>🎯 Tic-Tac-Toe</span>
        <button style={{background:'none',border:'none',color:'white',fontSize:20,cursor:'pointer'}} onClick={onClose}>✕</button>
      </div>
      <div style={{padding:28,textAlign:'center'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:20}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:otherOnline?'#10b981':'#ef4444',boxShadow:`0 0 6px ${otherOnline?'#10b981':'#ef4444'}`}}/>
          <span style={{fontSize:13,color:'rgba(255,255,255,0.5)'}}>{otherOnline?'2 players connected':'Waiting for opponent…'}</span>
        </div>
        {symbol&&<div style={{marginBottom:16,fontSize:13,color:'rgba(255,255,255,0.5)'}}>You are <strong style={{color:symbol==='X'?'#60a5fa':'#f472b6',fontSize:16}}>{symbol}</strong></div>}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,88px)',gridTemplateRows:'repeat(3,88px)',gap:8,justifyContent:'center',marginBottom:20}}>
          {board.map((v,i)=>(
            <button key={i} onClick={()=>!v&&myTurn&&onMove(i)} style={{
              borderRadius:8,border:'2px solid rgba(139,92,246,0.35)',
              background:v?'rgba(139,92,246,0.12)':'rgba(0,0,0,0.4)',
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:38,fontWeight:900,
              color:v==='X'?'#60a5fa':v==='O'?'#f472b6':'transparent',
              cursor:!v&&myTurn?'pointer':'default',
              transition:'background 0.15s',
            }}>{v||'·'}</button>
          ))}
        </div>
        <div style={{padding:'10px 20px',borderRadius:8,marginBottom:16,background:'rgba(255,255,255,0.05)',color:statusColor,fontWeight:600,fontSize:14}}>{statusMsg}</div>
        {(winner||board.every(Boolean))&&<button onClick={onReset} style={{padding:'8px 28px',borderRadius:8,border:'none',background:'linear-gradient(135deg,#7c3aed,#4f46e5)',color:'white',fontWeight:600,cursor:'pointer',fontSize:14}}>New Game</button>}
      </div>
    </div></div>
  );
};
