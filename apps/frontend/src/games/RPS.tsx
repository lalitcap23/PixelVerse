import React, { useState } from 'react';
const CH=[{v:'rock',e:'🪨',beats:'scissors'},{v:'paper',e:'📄',beats:'rock'},{v:'scissors',e:'✂️',beats:'paper'}];
const OV:React.CSSProperties={position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10000};
const CARD:React.CSSProperties={background:'#0a0a1a',border:'1.5px solid rgba(59,130,246,0.5)',borderRadius:16,overflow:'hidden',width:440,boxShadow:'0 0 40px rgba(59,130,246,0.2)'};
export const RPS:React.FC<{onClose:()=>void}>=({onClose})=>{
  const [pp,setPP]=useState<typeof CH[0]|null>(null);
  const [cp,setCP]=useState<typeof CH[0]|null>(null);
  const [res,setRes]=useState<'win'|'lose'|'draw'|null>(null);
  const [sc,setSc]=useState({w:0,l:0,d:0});
  const [thinking,setTh]=useState(false);
  const play=(c:typeof CH[0])=>{
    if(thinking)return;
    setPP(c);setCP(null);setRes(null);setTh(true);
    setTimeout(()=>{
      const cpu=CH[~~(Math.random()*3)];
      setCP(cpu);
      const r:typeof res=c.v===cpu.v?'draw':c.beats===cpu.v?'win':'lose';
      setRes(r);
      setSc(s=>({...s,[r==='win'?'w':r==='lose'?'l':'d']:s[r==='win'?'w':r==='lose'?'l':'d']+1}));
      setTh(false);
    },700);
  };
  return(
    <div style={OV}><div style={CARD}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 20px',background:'linear-gradient(135deg,#1d4ed8,#7c3aed)',color:'white',fontWeight:700,fontSize:18}}>
        <span>🎲 Rock Paper Scissors</span>
        <button style={{background:'none',border:'none',color:'white',fontSize:20,cursor:'pointer'}} onClick={onClose}>✕</button>
      </div>
      <div style={{padding:28,textAlign:'center'}}>
        <div style={{display:'flex',justifyContent:'center',gap:24,marginBottom:24}}>
          {([['W','w','#86efac'],['D','d','#fbbf24'],['L','l','#f87171']] as const).map(([l,k,c])=>(
            <div key={k}><div style={{fontSize:24,fontWeight:700,color:c}}>{(sc as any)[k]}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>{l}</div></div>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:32,marginBottom:24,minHeight:90}}>
          <div><div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginBottom:4}}>YOU</div><div style={{fontSize:60}}>{pp?.e??'❓'}</div></div>
          <div style={{fontSize:22,color:'rgba(255,255,255,0.25)'}}>VS</div>
          <div><div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginBottom:4}}>CPU</div><div style={{fontSize:60}}>{thinking?'🤔':cp?.e??'❓'}</div></div>
        </div>
        {res&&<div style={{padding:'10px 24px',borderRadius:8,marginBottom:20,fontWeight:700,fontSize:18,background:res==='win'?'rgba(34,197,94,0.15)':res==='lose'?'rgba(239,68,68,0.12)':'rgba(250,204,21,0.12)',color:res==='win'?'#86efac':res==='lose'?'#f87171':'#fde68a'}}>
          {res==='win'?'🎉 YOU WIN!':res==='lose'?'💀 YOU LOSE':'🤝 DRAW'}
        </div>}
        <div style={{display:'flex',gap:12,justifyContent:'center'}}>
          {CH.map(c=><button key={c.v} onClick={()=>play(c)} disabled={thinking} style={{width:82,height:82,borderRadius:12,border:'2px solid rgba(124,58,237,0.4)',background:pp?.v===c.v?'rgba(124,58,237,0.35)':'rgba(255,255,255,0.05)',fontSize:38,cursor:thinking?'not-allowed':'pointer',transition:'all 0.2s'}}>{c.e}</button>)}
        </div>
        {res&&<button onClick={()=>{setPP(null);setCP(null);setRes(null);}} style={{marginTop:14,background:'none',border:'1px solid rgba(255,255,255,0.2)',color:'rgba(255,255,255,0.6)',padding:'6px 20px',borderRadius:6,cursor:'pointer',fontSize:13}}>Play Again</button>}
      </div>
    </div></div>
  );
};
