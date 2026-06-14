import React, { useState, useRef } from 'react';
const SYMS = ['🍒','🍊','🍋','🍇','🔔','⭐','💎','7️⃣'];
const PRIZE: Record<string,number> = {'💎':500,'7️⃣':300,'⭐':150,'🔔':100,'🍇':80,'🍒':50,'🍊':50,'🍋':50};
const OV:React.CSSProperties={position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10000};
const CARD:React.CSSProperties={background:'#0d0118',border:'1.5px solid rgba(220,38,38,0.5)',borderRadius:16,overflow:'hidden',width:400,boxShadow:'0 0 40px rgba(220,38,38,0.3)'};
const HDR:React.CSSProperties={display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 20px',background:'linear-gradient(135deg,#7c2d12,#dc2626)',color:'white',fontWeight:700,fontSize:18};
export const SlotMachine:React.FC<{onClose:()=>void}>=({onClose})=>{
  const [reels,setReels]=useState(['🎰','🎰','🎰']);
  const [spin,setSpin]=useState(false);
  const [credits,setCredits]=useState(100);
  const [msg,setMsg]=useState('🎰 Good luck!');
  const [mc,setMc]=useState('#e9d5ff');
  const t=useRef<any>(null);
  const go=()=>{
    if(credits<10||spin)return;
    setCredits(c=>c-10);setSpin(true);setMsg('Spinning...');setMc('#fbbf24');
    let i=0;
    t.current=setInterval(()=>{
      setReels([SYMS[~~(Math.random()*8)],SYMS[~~(Math.random()*8)],SYMS[~~(Math.random()*8)]]);
      if(++i>=18){
        clearInterval(t.current);
        const r=[SYMS[~~(Math.random()*8)],SYMS[~~(Math.random()*8)],SYMS[~~(Math.random()*8)]];
        setReels(r);setSpin(false);
        if(r[0]===r[1]&&r[1]===r[2]){const p=PRIZE[r[0]]??50;setCredits(c=>c+p);setMsg(`🎉 JACKPOT! +${p}`);setMc('#86efac');}
        else if(r[0]===r[1]||r[1]===r[2]||r[0]===r[2]){setCredits(c=>c+25);setMsg('✨ Pair! +25');setMc('#fbbf24');}
        else{setMsg('💨 No match');setMc('#f87171');}
      }
    },80);
  };
  return(
    <div style={OV}><div style={CARD}>
      <div style={HDR}><span>🎰 Slot Machine</span><button style={{background:'none',border:'none',color:'white',fontSize:20,cursor:'pointer'}} onClick={onClose}>✕</button></div>
      <div style={{padding:28,textAlign:'center'}}>
        <div style={{color:'#fbbf24',fontSize:14,marginBottom:16}}>💰 Credits: <strong style={{fontSize:22}}>{credits}</strong></div>
        <div style={{display:'flex',gap:12,justifyContent:'center',marginBottom:20}}>
          {reels.map((s,i)=><div key={i} style={{width:86,height:86,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:44,background:'rgba(0,0,0,0.6)',border:'2px solid rgba(251,191,36,0.4)',boxShadow:'0 0 12px rgba(251,191,36,0.1)'}}>{s}</div>)}
        </div>
        <div style={{padding:'10px 20px',borderRadius:8,marginBottom:20,background:'rgba(255,255,255,0.05)',color:mc,fontWeight:600,fontSize:14}}>{msg}</div>
        <button onClick={go} disabled={spin||credits<10} style={{padding:'12px 36px',borderRadius:10,border:'none',background:spin||credits<10?'rgba(100,100,100,0.3)':'linear-gradient(135deg,#dc2626,#7c3aed)',color:'white',fontSize:16,fontWeight:700,cursor:spin||credits<10?'not-allowed':'pointer',boxShadow:'0 4px 20px rgba(220,38,38,0.3)'}}>
          {spin?'⏳ Spinning…':'🎰 SPIN (−10)'}
        </button>
        {credits<=0&&<div style={{marginTop:12,color:'#f87171',fontSize:13}}>Out of credits! <button style={{background:'none',border:'none',color:'#60a5fa',cursor:'pointer',textDecoration:'underline'}} onClick={()=>{setCredits(100);setMsg('Refilled!');setMc('#86efac');}}>Refill 100</button></div>}
        <div style={{marginTop:16,fontSize:11,color:'rgba(255,255,255,0.25)'}}>💎=500 • 7️⃣=300 • ⭐=150 • 🔔=100 • Pair=25</div>
      </div>
    </div></div>
  );
};
