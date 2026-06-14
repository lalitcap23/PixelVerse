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

const ZONES = [
  { name:'💻 Work Pods',     x:1,  y:1, w:8,  h:9,  border:'rgba(6,182,212,0.35)',   label:'#06b6d4' },
  { name:'☕ Coffee Corner', x:9,  y:1, w:6,  h:9,  border:'rgba(245,158,11,0.35)', label:'#f59e0b' },
  { name:'🎮 Game Lounge',   x:13, y:1, w:6,  h:9,  border:'rgba(139,92,246,0.35)', label:'#a78bfa' },
  { name:'🛋️ Chill Zone',  x:17, y:1, w:8,  h:9,  border:'rgba(16,185,129,0.35)',  label:'#10b981' },
];
const getZoneAt = (p:{x:number;y:number}) =>
  ZONES.find(z => p.x>=z.x && p.x<z.x+z.w && p.y>=z.y && p.y<z.y+z.h) ?? null;

// ── Pure-canvas background renderer ───────────────────────────────────────
function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const T = TILE;

  // Base void
  ctx.fillStyle = '#06060f'; ctx.fillRect(0,0,w,h);

  // ── Road / corridor (y tiles 10-11, full width) ──────────────────────────
  for(let tx=0;tx<w/T;tx++){
    for(const ty of [10,11]){
      ctx.fillStyle = (tx+ty)%2===0 ? '#111120' : '#0f0f1e';
      ctx.fillRect(tx*T,ty*T,T,T);
    }
    // Dashed center-line
    ctx.fillStyle='rgba(255,220,50,0.18)';
    ctx.fillRect(tx*T+T*0.45, 10*T+T-3, T*0.1, 6);
    // Road edge lines
    ctx.fillStyle='rgba(255,255,255,0.06)';
    ctx.fillRect(tx*T,10*T,T,2);
    ctx.fillRect(tx*T,12*T-2,T,2);
  }

  // Vertical connector road (x tiles 0, y 0-10)
  for(let ty=0;ty<10;ty++){
    ctx.fillStyle=(ty%2===0)?'#0e0e1c':'#0c0c1a';
    ctx.fillRect(0,ty*T,T,T);
    ctx.fillStyle='rgba(255,255,255,0.04)';
    ctx.fillRect(T-2,ty*T,2,T);
  }

  // ── 💻 Work Pods floor (x1-8, y1-9) — cool blue slate tiles ─────────────
  for(let tx=1;tx<9;tx++) for(let ty=1;ty<10;ty++){
    const light=(tx+ty)%2===0;
    ctx.fillStyle=light?'#0d1520':'#0b1219';
    ctx.fillRect(tx*T,ty*T,T,T);
    // Subtle grout lines
    ctx.strokeStyle='rgba(6,182,212,0.06)'; ctx.lineWidth=1;
    ctx.strokeRect(tx*T+0.5,ty*T+0.5,T-1,T-1);
  }
  // Desk surfaces (3 desks)
  const deskColor='rgba(6,182,212,0.12)';
  [[2,3],[4,3],[6,3],[2,7],[4,7],[6,7]].forEach(([dx,dy])=>{
    ctx.fillStyle=deskColor;
    ctx.beginPath(); ctx.roundRect(dx*T+4,dy*T+8,T*1.7,T*0.55,4); ctx.fill();
    ctx.strokeStyle='rgba(6,182,212,0.2)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect(dx*T+4,dy*T+8,T*1.7,T*0.55,4); ctx.stroke();
    // Monitor glow
    ctx.fillStyle='rgba(6,182,212,0.25)';
    ctx.beginPath(); ctx.roundRect(dx*T+T*0.6,dy*T+3,T*0.7,T*0.45,3); ctx.fill();
    ctx.fillStyle='rgba(6,182,212,0.6)';
    ctx.fillRect(dx*T+T*0.88,dy*T+3,2,T*0.45);
  });

  // ── ☕ Coffee Corner floor (x9-14, y1-9) — warm wood planks ─────────────
  for(let tx=9;tx<15;tx++) for(let ty=1;ty<10;ty++){
    ctx.fillStyle=(tx+ty)%2===0?'#1a1108':'#1c1309';
    ctx.fillRect(tx*T,ty*T,T,T);
    // Wood grain
    for(let g=0;g<3;g++){
      ctx.strokeStyle=`rgba(160,100,40,${0.04+g*0.02})`; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(tx*T,ty*T+T*0.25*g); ctx.lineTo(tx*T+T,ty*T+T*0.25*g+4); ctx.stroke();
    }
  }
  // Coffee tables (round)
  [[10,3],[12,3],[11,7],[13,7]].forEach(([cx,cy])=>{
    const px=cx*T+T/2, py=cy*T+T/2;
    // Table surface
    ctx.beginPath(); ctx.arc(px,py,T*0.42,0,Math.PI*2);
    ctx.fillStyle='#2a1c0a'; ctx.fill();
    ctx.strokeStyle='rgba(245,158,11,0.35)'; ctx.lineWidth=1.5; ctx.stroke();
    // Coffee cup
    ctx.fillStyle='rgba(245,158,11,0.5)';
    ctx.beginPath(); ctx.roundRect(px-5,py-6,10,10,2); ctx.fill();
    ctx.fillStyle='#3d200a';
    ctx.beginPath(); ctx.ellipse(px,py-2,4,3,0,0,Math.PI*2); ctx.fill();
    // Steam
    ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1.5; ctx.setLineDash([2,2]);
    ctx.beginPath(); ctx.moveTo(px-3,py-9); ctx.quadraticCurveTo(px-6,py-14,px-3,py-18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px+3,py-9); ctx.quadraticCurveTo(px+6,py-14,px+3,py-18); ctx.stroke();
    ctx.setLineDash([]);
    // Chairs
    for(let a=0;a<4;a++){
      const angle=a*Math.PI/2+Math.PI/4;
      const cx2=px+Math.cos(angle)*T*0.52, cy2=py+Math.sin(angle)*T*0.52;
      ctx.beginPath(); ctx.arc(cx2,cy2,5,0,Math.PI*2);
      ctx.fillStyle='#3d2a10'; ctx.fill();
      ctx.strokeStyle='rgba(245,158,11,0.2)'; ctx.lineWidth=1; ctx.stroke();
    }
  });

  // ── 🎮 Game Lounge floor (x13-18, y1-9) — dark with glow grid ───────────
  for(let tx=13;tx<19;tx++) for(let ty=1;ty<10;ty++){
    ctx.fillStyle=(tx+ty)%2===0?'#0e0818':'#0c061a';
    ctx.fillRect(tx*T,ty*T,T,T);
    // Neon grid
    ctx.strokeStyle='rgba(139,92,246,0.1)'; ctx.lineWidth=1;
    ctx.strokeRect(tx*T+1,ty*T+1,T-2,T-2);
  }
  // Arcade cabinet shapes
  [[14,4],[16,4],[14,8],[16,8]].forEach(([ax,ay])=>{
    const px=ax*T+T/2, py=ay*T+T/2;
    // Cabinet body
    ctx.fillStyle='#1a0f2e';
    ctx.beginPath(); ctx.roundRect(px-12,py-16,24,30,4); ctx.fill();
    ctx.strokeStyle='rgba(139,92,246,0.5)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.roundRect(px-12,py-16,24,30,4); ctx.stroke();
    // Screen
    ctx.fillStyle='#0d0620';
    ctx.beginPath(); ctx.roundRect(px-8,py-13,16,14,2); ctx.fill();
    ctx.fillStyle=`hsl(${(ax*37+ay*71)%360},80%,55%)`;
    ctx.globalAlpha=0.7;
    ctx.beginPath(); ctx.roundRect(px-6,py-11,12,10,1); ctx.fill();
    ctx.globalAlpha=1;
    // Joystick
    ctx.fillStyle='#2d1a4a';
    ctx.beginPath(); ctx.arc(px-4,py+8,4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#a78bfa';
    ctx.beginPath(); ctx.arc(px-4,py+6,2.5,0,Math.PI*2); ctx.fill();
    // Button
    ctx.fillStyle='#ef4444';
    ctx.beginPath(); ctx.arc(px+6,py+8,3,0,Math.PI*2); ctx.fill();
  });

  // ── 🛋️ Chill Zone floor (x17-24, y1-9) — soft nature green ─────────────
  for(let tx=17;tx<25;tx++) for(let ty=1;ty<10;ty++){
    ctx.fillStyle=(tx+ty)%2===0?'#0b1a0e':'#0d1f10';
    ctx.fillRect(tx*T,ty*T,T,T);
    // Grass texture dots
    if((tx*3+ty*7)%5===0){
      ctx.fillStyle='rgba(16,185,129,0.12)';
      ctx.beginPath(); ctx.arc(tx*T+T*0.3,ty*T+T*0.6,3,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(tx*T+T*0.7,ty*T+T*0.3,2,0,Math.PI*2); ctx.fill();
    }
  }
  // Couch shapes
  [[18,3],[21,3],[18,7],[21,7]].forEach(([sx,sy])=>{
    const px=sx*T, py=sy*T;
    // Couch body
    ctx.fillStyle='#1a3320';
    ctx.beginPath(); ctx.roundRect(px+3,py+8,T*2.2,T*0.65,6); ctx.fill();
    ctx.strokeStyle='rgba(16,185,129,0.3)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect(px+3,py+8,T*2.2,T*0.65,6); ctx.stroke();
    // Back rest
    ctx.fillStyle='#163d1a';
    ctx.beginPath(); ctx.roundRect(px+3,py+3,T*2.2,T*0.35,4); ctx.fill();
    // Cushions
    [0,1].forEach(i=>{
      ctx.fillStyle='rgba(16,185,129,0.15)';
      ctx.beginPath(); ctx.roundRect(px+5+i*T,py+9,T*0.9,T*0.45,4); ctx.fill();
    });
  });

  // ── Outer area (beyond zones) — dark concrete ────────────────────────────
  // Already covered by base, just add subtle noise for areas outside zones
  for(let tx=1;tx<w/T;tx+=3) for(let ty=12;ty<h/T;ty+=2){
    ctx.fillStyle='rgba(255,255,255,0.008)';
    ctx.fillRect(tx*T+T*0.1,ty*T+T*0.1,T*0.8,T*0.8);
  }
}

function drawScene(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  myPos: {x:number;y:number}|null,
  others: Map<string,UserState>,
  myUsername: string,
  myUserId: string,
  avatarImgs: Map<string, HTMLImageElement>,
) {
  // ── Rich canvas background ──────────────────────────────
  drawBackground(ctx, w, h);

  // ── Zone label overlays ────────────────────────────────
  ZONES.forEach(({x,y,w:zw,h:zh,border,name,label}) => {
    const px=x*TILE,py=y*TILE,pw=zw*TILE,ph=zh*TILE;
    // Border glow
    ctx.save();
    ctx.shadowBlur=12; ctx.shadowColor=border.replace('0.35','0.6');
    ctx.strokeStyle=border; ctx.lineWidth=1.5; ctx.setLineDash([5,4]);
    ctx.strokeRect(px+1,py+1,pw-2,ph-2);
    ctx.setLineDash([]); ctx.restore();
    // Zone name pill
    ctx.font='bold 11px Inter,sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
    const tw=ctx.measureText(name).width;
    ctx.fillStyle='rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.roundRect(px+5,py+4,tw+12,18,5); ctx.fill();
    ctx.fillStyle=label; ctx.fillText(name,px+11,py+8);
  });

  // ── Furniture ─────────────────────────────────────────
  ctx.font=`${TILE*0.55}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
  FURNITURE.forEach(({tx,ty,e}) => {
    ctx.fillStyle='rgba(255,255,255,0.03)';
    ctx.fillRect(tx*TILE+2,ty*TILE+2,TILE-4,TILE-4);
    ctx.fillText(e,tx*TILE+TILE/2,ty*TILE+TILE/2);
  });

  // ── Grid ──────────────────────────────────────────────
  ctx.strokeStyle='rgba(124,58,237,0.07)'; ctx.lineWidth=1;
  for(let x=0;x<=w;x+=TILE){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  for(let y=0;y<=h;y+=TILE){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}

  // ── Proximity ring ────────────────────────────────────
  if(myPos){
    const cx=myPos.x*TILE+TILE/2,cy=myPos.y*TILE+TILE/2,r=PROX*TILE;
    const g=ctx.createRadialGradient(cx,cy,0,cx,cy,r);
    g.addColorStop(0,'rgba(124,58,237,0)'); g.addColorStop(0.75,'rgba(124,58,237,0)'); g.addColorStop(1,'rgba(124,58,237,0.12)');
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle='rgba(124,58,237,0.18)'; ctx.lineWidth=1; ctx.setLineDash([6,4]);
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
  }

  // ── Draw avatar ───────────────────────────────────────
  const drawAvatar = (ax:number, ay:number, uid:string, label:string, color:string, isMe:boolean, nearby:boolean) => {
    const cx=ax*TILE+TILE/2, cy=ay*TILE+TILE/2;
    const size = isMe ? 40 : 34;
    const r = size/2;
    const img = avatarImgs.get(uid);

    // Nearby glow ring
    if(nearby && !isMe){
      ctx.save();
      ctx.beginPath(); ctx.arc(cx,cy,r+8,0,Math.PI*2);
      ctx.strokeStyle='#10b981'; ctx.lineWidth=2.5; ctx.globalAlpha=0.5;
      ctx.stroke(); ctx.restore();
    }

    ctx.save();
    ctx.shadowBlur = isMe?24:(nearby?18:10);
    ctx.shadowColor = isMe?'#7c3aed':(nearby?'#10b981':color);

    if(img){
      // Tinted backing circle
      ctx.beginPath(); ctx.arc(cx,cy,r+3,0,Math.PI*2);
      ctx.fillStyle = isMe?'rgba(124,58,237,0.35)':`${color}44`;
      ctx.fill();
      // Clip to circle then draw sprite
      ctx.save();
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.clip();
      ctx.drawImage(img,cx-r,cy-r,size,size);
      ctx.restore();
      // Ring border
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
      ctx.strokeStyle = isMe?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.25)';
      ctx.lineWidth = isMe?2.5:1.5; ctx.stroke();
    } else {
      // Fallback gradient circle
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
      const g=ctx.createRadialGradient(cx-r*0.3,cy-r*0.3,1,cx,cy,r);
      g.addColorStop(0,lighten(isMe?'#7c3aed':color)); g.addColorStop(1,isMe?'#7c3aed':color);
      ctx.fillStyle=g; ctx.fill();
      ctx.strokeStyle=isMe?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.3)';
      ctx.lineWidth=isMe?2.5:1.5; ctx.stroke();
      ctx.font=`${r*0.9}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(isMe?'😊':uEmoji(uid),cx,cy);
    }
    ctx.restore();

    // Crown for self
    if(isMe){
      ctx.font='12px serif'; ctx.textAlign='center'; ctx.textBaseline='bottom';
      ctx.fillText('👑',cx,cy-r-2);
    }

    // Name tag pill
    const tag = isMe ? myUsername : label.slice(0,12);
    ctx.font='bold 9px Inter,sans-serif'; ctx.textAlign='center';
    const tw = ctx.measureText(tag).width;
    const tx2=cx-tw/2-5, ty2=cy+r+5, th=15, tw2=tw+10;
    ctx.fillStyle='rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.roundRect(tx2,ty2,tw2,th,6);
    ctx.fill();
    ctx.fillStyle = isMe?'#c084fc':(nearby?'#6ee7b7':'#a8a3c8');
    ctx.textBaseline='top';
    ctx.fillText(tag,cx,ty2+3);
  };

  others.forEach((u) => {
    const nearby = myPos ? dist(myPos,u)<=PROX : false;
    drawAvatar(u.x,u.y,u.userId,u.username||u.userId,uColor(u.userId),false,nearby);
  });
  if(myPos) drawAvatar(myPos.x,myPos.y,myUserId,'me','#7c3aed',true,false);
}

export default function Arena({ token, spaceId, onLeave }: ArenaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef     = useRef<WebSocket|null>(null);

  const [myPos,      setMyPos]      = useState<{x:number;y:number}|null>(null);
  const [myUsername, setMyUsername] = useState('You');
  const [myUserId,   setMyUserId]   = useState('');
  const [others,     setOthers]     = useState<Map<string,UserState>>(new Map());
  const [connected,  setConnected]  = useState(false);
  const [nearbyIds,  setNearbyIds]  = useState<string[]>([]);

  // Avatar sprite cache
  const avatarImgsRef  = useRef<Map<string, HTMLImageElement>>(new Map());
  const [avatarVer,    setAvatarVer] = useState(0);
  const currentZoneRef = useRef<string|null>(null);

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

  // Load DiceBear pixel-art avatar for a userId
  const loadAvatar = useCallback((uid: string) => {
    if (!uid || avatarImgsRef.current.has(uid)) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = `https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(uid)}&radius=10&scale=88&backgroundColor=transparent`;
    img.onload = () => { avatarImgsRef.current.set(uid, img); setAvatarVer(v => v+1); };
  }, []);

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
            if(msg.payload.userId){ setMyUserId(msg.payload.userId); loadAvatar(msg.payload.userId); }
            const m = new Map<string,UserState>();
            (msg.payload.users??[]).forEach((u:any) => { if(u.userId){ m.set(u.userId,u); loadAvatar(u.userId); } });
            setOthers(m);
            addToast(`Welcome, ${msg.payload.username}! Use WASD to move.`,'success');
            break;
          }
          case 'user-joined': {
            const u = msg.payload;
            if(u.userId) {
              setOthers(prev => new Map(prev).set(u.userId, u));
              loadAvatar(u.userId);
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

  // ── Zone detection ────────────────────────────────────────────────────────
  useEffect(() => {
    if(!myPos) return;
    const zone = getZoneAt(myPos);
    const name = zone?.name ?? null;
    if(name !== currentZoneRef.current){
      currentZoneRef.current = name;
      if(name) addToast(`Entered ${name}`,'info');
    }
  }, [myPos]);

  // ── Canvas ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    if(!ctx) return;
    drawScene(ctx, canvas.width, canvas.height, myPos, others, myUsername, myUserId, avatarImgsRef.current);
  }, [myPos, others, myUsername, myUserId, avatarVer]);

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