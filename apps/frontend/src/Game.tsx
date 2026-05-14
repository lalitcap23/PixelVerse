import React, { useEffect, useRef, useState, useCallback } from 'react';
import { WS_URL } from './api';
import { Logo, ToastContainer, useToast } from './components';

interface ArenaProps { token: string; spaceId: string; onLeave: () => void; }
interface UserState  { userId: string; username: string; x: number; y: number; }
interface ChatMsg    { id: string; userId: string; username: string; message: string; timestamp: number; type: 'global' | 'proximity'; }

const TILE = 48, PROX = 3;
const PALETTE = ['#06b6d4','#10b981','#f59e0b','#ec4899','#ef4444','#a78bfa'];
const hash = (s: string) => { let h=0; for(const c of s) h=(h*31+c.charCodeAt(0))&0x7fffffff; return h; };
const uColor = (id: string) => PALETTE[hash(id)%PALETTE.length];
const uEmoji = (id: string) => ['🧑','👩','👦','👧','🧔','🧕'][hash(id)%6];
const lighten = (hex: string) => { const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return `rgb(${Math.min(255,r+55)},${Math.min(255,g+55)},${Math.min(255,b+55)})`; };
const dist = (a:{x:number;y:number}, b:{x:number;y:number}) => Math.abs(a.x-b.x)+Math.abs(a.y-b.y);

const FURNITURE = [
  {tx:3,ty:3,e:'🌿'},{tx:6,ty:3,e:'🪴'},{tx:3,ty:7,e:'💻'},{tx:6,ty:7,e:'🖥️'},
  {tx:10,ty:3,e:'☕'},{tx:10,ty:7,e:'📚'},{tx:14,ty:4,e:'🎮'},{tx:14,ty:8,e:'🎨'},
  {tx:18,ty:3,e:'🪑'},{tx:18,ty:7,e:'🛋️'},{tx:22,ty:4,e:'🌱'},{tx:22,ty:8,e:'🗂️'},
  {tx:2,ty:12,e:'📡'},{tx:7,ty:12,e:'🏆'},{tx:12,ty:12,e:'🎯'},{tx:17,ty:12,e:'🔭'},
];

function drawScene(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  myPos: {x:number;y:number}|null,
  others: Map<string,UserState>,
  myUsername: string,
) {
  ctx.fillStyle='#080818'; ctx.fillRect(0,0,w,h);
  // floor
  for(let tx=0;tx<w/TILE;tx++) for(let ty=0;ty<h/TILE;ty++) {
    ctx.fillStyle=(tx+ty)%2===0?'rgba(124,58,237,0.04)':'rgba(6,182,212,0.025)';
    ctx.fillRect(tx*TILE,ty*TILE,TILE,TILE);
  }
  // furniture
  ctx.font=`${TILE*0.55}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
  FURNITURE.forEach(({tx,ty,e}) => {
    ctx.fillStyle='rgba(255,255,255,0.03)';
    ctx.fillRect(tx*TILE+2,ty*TILE+2,TILE-4,TILE-4);
    ctx.fillText(e,tx*TILE+TILE/2,ty*TILE+TILE/2);
  });
  // grid
  ctx.strokeStyle='rgba(124,58,237,0.09)'; ctx.lineWidth=1;
  for(let x=0;x<=w;x+=TILE){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  for(let y=0;y<=h;y+=TILE){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  // proximity ring around self
  if(myPos){
    const cx=myPos.x*TILE+TILE/2,cy=myPos.y*TILE+TILE/2,r=PROX*TILE;
    const g=ctx.createRadialGradient(cx,cy,0,cx,cy,r);
    g.addColorStop(0,'rgba(124,58,237,0)'); g.addColorStop(0.75,'rgba(124,58,237,0)'); g.addColorStop(1,'rgba(124,58,237,0.13)');
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle='rgba(124,58,237,0.18)'; ctx.lineWidth=1; ctx.setLineDash([6,4]);
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
  }
  // draw avatar fn
  const drawAvatar = (x:number,y:number,label:string,color:string,isMe:boolean,nearby:boolean) => {
    const cx=x*TILE+TILE/2,cy=y*TILE+TILE/2,r=isMe?17:14;
    if(nearby&&!isMe){
      ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,r+7,0,Math.PI*2);
      ctx.strokeStyle='#10b981'; ctx.lineWidth=2; ctx.globalAlpha=0.6; ctx.stroke(); ctx.restore();
    }
    ctx.save(); ctx.shadowBlur=isMe?22:(nearby?16:10); ctx.shadowColor=isMe?'#7c3aed':(nearby?'#10b981':color);
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    const g=ctx.createRadialGradient(cx-r*0.3,cy-r*0.3,1,cx,cy,r);
    g.addColorStop(0,lighten(isMe?'#7c3aed':color)); g.addColorStop(1,isMe?'#7c3aed':color);
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle=isMe?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.3)';
    ctx.lineWidth=isMe?2.5:1.5; ctx.stroke(); ctx.restore();
    ctx.font=`${r}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(isMe?'😊':uEmoji(label),cx,cy);
    const tag=isMe?myUsername:(label.slice(0,10));
    ctx.font='bold 9px Inter,sans-serif';
    const tw=ctx.measureText(tag).width;
    ctx.fillStyle='rgba(0,0,0,0.6)';
    ctx.fillRect(cx-tw/2-4,cy+r+3,tw+8,14);
    ctx.fillStyle=isMe?'#c084fc':(nearby?'#6ee7b7':'#a8a3c8');
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText(tag,cx,cy+r+5);
  };
  others.forEach((u) => {
    const nearby = myPos ? dist(myPos,u)<=PROX : false;
    drawAvatar(u.x,u.y,u.username||u.userId,uColor(u.userId),false,nearby);
  });
  if(myPos) drawAvatar(myPos.x,myPos.y,'me','#7c3aed',true,false);
}

export default function Arena({ token, spaceId, onLeave }: ArenaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef     = useRef<WebSocket|null>(null);

  const [myPos,      setMyPos]      = useState<{x:number;y:number}|null>(null);
  const [myUsername, setMyUsername] = useState('You');
  const [others,     setOthers]     = useState<Map<string,UserState>>(new Map());
  const [connected,  setConnected]  = useState(false);
  const [nearbyIds,  setNearbyIds]  = useState<string[]>([]);

  // Chat state
  const [globalMsgs,    setGlobalMsgs]    = useState<ChatMsg[]>([]);
  const [proximityMsgs, setProximityMsgs] = useState<ChatMsg[]>([]);
  const [globalInput,   setGlobalInput]   = useState('');
  const [proxInput,     setProxInput]     = useState('');
  const [chatTab,       setChatTab]       = useState<'global'|'proximity'>('global');

  const gameAreaRef  = useRef<HTMLDivElement>(null);
  const globalEndRef = useRef<HTMLDivElement>(null);
  const proxEndRef   = useRef<HTMLDivElement>(null);
  const { toasts, addToast } = useToast();

  // Focus game area once on mount only — NOT on every render
  useEffect(() => { gameAreaRef.current?.focus(); }, []);

  const scrollToBottom = (ref: React.RefObject<HTMLDivElement>) =>
    ref.current?.scrollIntoView({ behavior:'smooth' });

  // ── WS ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type:'join', payload:{ spaceId, token } }));
    };
    ws.onclose = () => { setConnected(false); addToast('Disconnected','error'); };
    ws.onerror = () => addToast('WebSocket error','error');
    ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);
        switch(msg.type) {
          case 'space-joined': {
            setMyPos({ x:msg.payload.spawn.x, y:msg.payload.spawn.y });
            setMyUsername(msg.payload.username || 'You');
            const m = new Map<string,UserState>();
            (msg.payload.users??[]).forEach((u:any) => { if(u.userId) m.set(u.userId,u); });
            setOthers(m);
            addToast(`Welcome, ${msg.payload.username}! Use WASD to move.`,'success');
            break;
          }
          case 'user-joined': {
            const u = msg.payload;
            if(u.userId) {
              setOthers(prev => new Map(prev).set(u.userId, u));
              addToast(`${u.username||'Someone'} joined!`,'info');
            }
            break;
          }
          case 'movement': {
            const u = msg.payload;
            if(u.userId) setOthers(prev => {
              const n=new Map(prev);
              const existing=n.get(u.userId);
              if(existing) n.set(u.userId,{...existing,x:u.x,y:u.y});
              return n;
            });
            break;
          }
          case 'movement-rejected':
            setMyPos({ x:msg.payload.x, y:msg.payload.y }); break;
          case 'user-left':
            if(msg.payload.userId) setOthers(prev=>{ const n=new Map(prev); n.delete(msg.payload.userId); return n; }); break;
          case 'chat': {
            const m: ChatMsg = { id:Math.random().toString(36), ...msg.payload, type:'global' };
            setGlobalMsgs(prev=>[...prev,m].slice(-100));
            setTimeout(()=>scrollToBottom(globalEndRef),50);
            break;
          }
          case 'proximity-chat': {
            const m: ChatMsg = { id:Math.random().toString(36), ...msg.payload, type:'proximity' };
            setProximityMsgs(prev=>[...prev,m].slice(-100));
            setChatTab('proximity');
            setTimeout(()=>scrollToBottom(proxEndRef),50);
            break;
          }
        }
      } catch(e){ console.error(e); }
    };
    return () => ws.close();
  }, [spaceId, token]);

  // ── Proximity ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if(!myPos) return;
    const n: string[] = [];
    others.forEach((u,uid) => { if(dist(myPos,u)<=PROX) n.push(uid); });
    setNearbyIds(n);
  }, [myPos, others]);

  // ── Canvas ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    if(!ctx) return;
    drawScene(ctx, canvas.width, canvas.height, myPos, others, myUsername);
  }, [myPos, others, myUsername]);

  // ── Keyboard ───────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Don't steal keys from chat inputs
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if(!myPos||!wsRef.current||wsRef.current.readyState!==WebSocket.OPEN) return;
    const d: Record<string,[number,number]> = {
      ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],
      w:[0,-1],s:[0,1],a:[-1,0],d:[1,0],
    };
    const delta = d[e.key];
    if(!delta) return;
    e.preventDefault();
    const nx=Math.max(0,myPos.x+delta[0]), ny=Math.max(0,myPos.y+delta[1]);
    setMyPos({x:nx,y:ny});
    wsRef.current.send(JSON.stringify({ type:'move', payload:{x:nx,y:ny} }));
  }, [myPos]);

  const sendGlobal = () => {
    if(!globalInput.trim()||!wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type:'chat', payload:{ message:globalInput.trim() } }));
    setGlobalInput('');
  };

  const sendProximity = () => {
    if(!proxInput.trim()||!wsRef.current) return;
    if(nearbyIds.length===0){ addToast('No one nearby! Move closer to someone.','error'); return; }
    wsRef.current.send(JSON.stringify({ type:'proximity-chat', payload:{ message:proxInput.trim() } }));
    setProxInput('');
  };

  const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});

  const msgBubble = (m: ChatMsg, isMe: boolean) => (
    <div key={m.id} style={{
      display:'flex', flexDirection:'column',
      alignItems: isMe ? 'flex-end' : 'flex-start',
      marginBottom: 10,
    }}>
      <div style={{ fontSize:10, color:'var(--text-3)', marginBottom:3 }}>
        {m.username} · {fmtTime(m.timestamp)}
      </div>
      <div style={{
        maxWidth:'85%', padding:'8px 12px', borderRadius:12,
        background: isMe ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : 'var(--bg-3)',
        color: isMe ? 'white' : 'var(--text-1)',
        fontSize:13, lineHeight:1.5,
        borderBottomRightRadius: isMe ? 2 : 12,
        borderBottomLeftRadius:  isMe ? 12 : 2,
        border: isMe ? 'none' : '1px solid var(--border-light)',
      }}>
        {m.message}
      </div>
    </div>
  );

  const inputRow = (
    value: string, onChange: (v:string)=>void,
    onSend: ()=>void, placeholder: string,
    disabled?: boolean
  ) => (
    <div style={{ display:'flex', gap:8, padding:'10px 12px', borderTop:'1px solid var(--border-light)' }}>
      <input
        className="input" value={value} placeholder={placeholder}
        onChange={e=>onChange(e.target.value)}
        onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); onSend(); }}}
        style={{ flex:1, padding:'9px 12px', fontSize:13, opacity: disabled?0.5:1 }}
        disabled={disabled}
      />
      <button
        className="btn btn-primary btn-sm" onClick={onSend}
        disabled={disabled||!value.trim()}
        style={{ padding:'9px 14px' }}
      >↑</button>
    </div>
  );

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', background:'var(--bg-0)' }}>

      {/* ── HUD ── */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 20px', height:52, flexShrink:0,
        background:'rgba(6,6,16,0.92)', backdropFilter:'blur(16px)',
        borderBottom:'1px solid var(--border-light)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <Logo size="sm" />
          <div style={{ width:1, height:22, background:'var(--border-light)' }} />
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:7,height:7,borderRadius:'50%',background:connected?'#10b981':'#ef4444',boxShadow:`0 0 6px ${connected?'#10b981':'#ef4444'}` }} />
            <span style={{ fontSize:13, color:'var(--text-2)' }}>{connected?`${1+others.size} online`:'Connecting…'}</span>
          </div>
          {nearbyIds.length>0&&(
            <div style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 10px',
              borderRadius:99, background:'rgba(16,185,129,0.15)', border:'1px solid rgba(16,185,129,0.3)' }}>
              <span style={{ fontSize:11 }}>👋</span>
              <span style={{ fontSize:11, color:'#6ee7b7', fontWeight:600 }}>{nearbyIds.length} nearby</span>
            </div>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {myPos&&<span style={{ fontSize:11, color:'var(--text-3)', fontFamily:'monospace',
            background:'var(--bg-3)', padding:'3px 8px', borderRadius:5, border:'1px solid var(--border-light)' }}>
            {myUsername} ({myPos.x},{myPos.y})
          </span>}
          <button className="btn btn-ghost btn-sm" onClick={onLeave}>← Leave</button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* Canvas */}
        <div
          style={{ flex:1, overflow:'auto', outline:'none' }}
          onKeyDown={handleKeyDown} tabIndex={0}
          ref={gameAreaRef}
          id="game-area"
        >
          {!myPos&&connected&&(
            <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',
              justifyContent:'center',flexDirection:'column',gap:14,zIndex:10,
              background:'rgba(6,6,16,0.8)',backdropFilter:'blur(8px)',pointerEvents:'none' }}>
              <div className="spinner" style={{ width:34,height:34 }} />
              <p style={{ color:'var(--text-2)',fontSize:15 }}>Joining space…</p>
            </div>
          )}
          <canvas ref={canvasRef} width={1600} height={1200} style={{ display:'block',cursor:'crosshair' }} />
        </div>

        {/* ── Right panel ── */}
        <div style={{ width:280, display:'flex', flexDirection:'column',
          background:'var(--bg-1)', borderLeft:'1px solid var(--border-light)', flexShrink:0 }}>

          {/* Users list */}
          <div style={{ borderBottom:'1px solid var(--border-light)' }}>
            <div style={{ padding:'10px 14px', fontSize:11, fontWeight:700,
              color:'var(--text-3)', textTransform:'uppercase', letterSpacing:1 }}>
              {1+others.size} in space
            </div>
            <div style={{ maxHeight:140, overflowY:'auto', padding:'0 8px 8px' }}>
              {/* Me */}
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px',
                borderRadius:7, background:'rgba(124,58,237,0.1)', border:'1px solid rgba(124,58,237,0.2)', marginBottom:4 }}>
                <div style={{ width:26,height:26,borderRadius:'50%',background:'#7c3aed',
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:13 }}>😊</div>
                <div>
                  <p style={{ fontSize:12,fontWeight:700,color:'var(--text-1)' }}>{myUsername}</p>
                  <p style={{ fontSize:10,color:'#c084fc' }}>You</p>
                </div>
              </div>
              {/* Others */}
              {Array.from(others.values()).map(u=>{
                const nearby = nearbyIds.includes(u.userId);
                const color  = uColor(u.userId);
                return (
                  <div key={u.userId} style={{ display:'flex',alignItems:'center',gap:8,padding:'6px 8px',
                    borderRadius:7,marginBottom:3,transition:'all 0.25s',
                    background: nearby?'rgba(16,185,129,0.08)':'rgba(255,255,255,0.02)',
                    border:`1px solid ${nearby?'rgba(16,185,129,0.25)':'var(--border-light)'}` }}>
                    <div style={{ width:26,height:26,borderRadius:'50%',background:color,flexShrink:0,
                      display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,
                      boxShadow:nearby?`0 0 8px ${color}`:'none' }}>{uEmoji(u.userId)}</div>
                    <div style={{ overflow:'hidden' }}>
                      <p style={{ fontSize:12,fontWeight:600,color:'var(--text-1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{u.username||u.userId.slice(0,10)}</p>
                      <p style={{ fontSize:10,color:nearby?'#6ee7b7':'var(--text-3)' }}>{nearby?'👋 nearby':`(${u.x},${u.y})`}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chat tabs */}
          <div style={{ display:'flex', borderBottom:'1px solid var(--border-light)' }}>
            {(['global','proximity'] as const).map(tab=>(
              <button key={tab} onClick={()=>setChatTab(tab)} style={{
                flex:1, padding:'9px', fontSize:12, fontWeight:600, cursor:'pointer',
                background:'none', border:'none', borderBottom:`2px solid ${chatTab===tab?'var(--brand-2)':'transparent'}`,
                color: chatTab===tab?'var(--brand-3)':'var(--text-3)', transition:'all 0.2s', fontFamily:'Inter,sans-serif',
              }}>
                {tab==='global'?'🌐 Global':'👋 Nearby'}
                {tab==='proximity'&&nearbyIds.length>0&&(
                  <span style={{ marginLeft:5, background:'#10b981', color:'white',
                    borderRadius:99, padding:'1px 5px', fontSize:10 }}>{nearbyIds.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Chat messages */}
          <div style={{ flex:1, overflowY:'auto', padding:'12px' }}>
            {chatTab==='global'?(
              globalMsgs.length===0
                ? <p style={{ color:'var(--text-3)',fontSize:12,textAlign:'center',marginTop:24 }}>No messages yet. Say hi! 👋</p>
                : <>{globalMsgs.map(m=>msgBubble(m,m.userId===others.keys().next().value||false))}<div ref={globalEndRef}/></>
            ):(
              nearbyIds.length===0
                ? <div style={{ textAlign:'center',marginTop:24 }}>
                    <p style={{ fontSize:24,marginBottom:8 }}>🚶</p>
                    <p style={{ color:'var(--text-3)',fontSize:12 }}>Walk within {PROX} tiles of someone to proximity chat</p>
                  </div>
                : proximityMsgs.length===0
                  ? <p style={{ color:'var(--text-3)',fontSize:12,textAlign:'center',marginTop:24 }}>Someone's nearby! Start talking.</p>
                  : <>{proximityMsgs.map(m=>msgBubble(m,false))}<div ref={proxEndRef}/></>
            )}
          </div>

          {/* Input */}
          {chatTab==='global'
            ? inputRow(globalInput,setGlobalInput,sendGlobal,'Message everyone…',!connected)
            : inputRow(proxInput,setProxInput,sendProximity,
                nearbyIds.length===0?'Get closer to chat…':'Whisper nearby…',
                !connected||nearbyIds.length===0)
          }
        </div>
      </div>

      {/* Controls */}
      <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:8,
        padding:'8px 20px',flexShrink:0,background:'rgba(6,6,16,0.92)',
        backdropFilter:'blur(12px)',borderTop:'1px solid var(--border-light)' }}>
        <span style={{ fontSize:11,color:'var(--text-3)' }}>Move: WASD / Arrows</span>
        <span style={{ fontSize:11,color:'var(--text-3)' }}>•</span>
        <span style={{ fontSize:11,color:'var(--text-3)' }}>Get within <strong style={{ color:'var(--brand-3)' }}>{PROX} tiles</strong> for proximity chat</span>
        <span style={{ fontSize:11,color:'var(--text-3)' }}>•</span>
        <span style={{ fontSize:11,color:'var(--text-3)' }}>Click canvas first to move</span>
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  );
}