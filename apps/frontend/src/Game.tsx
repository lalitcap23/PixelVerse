import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SlotMachine } from './games/SlotMachine';
import { RPS } from './games/RPS';
import { TicTacToe } from './games/TicTacToe';
import { WS_URL } from './api';
import { Logo, ToastContainer, useToast } from './components';

interface ArenaProps { token: string; spaceId: string; onLeave: () => void; }
interface UserState  { userId: string; username: string; x: number; y: number; }
interface ChatMsg    { id: string; userId: string; username: string; message: string; timestamp: number; type: 'global' | 'proximity'; }

const TILE = 48, PROX = 3;
const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 1200;
const MUSIC_PANEL_POS = { left: 27 * TILE, top: 2 * TILE };
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
  { name:'☕ Coffee Corner', x:1,  y:1, w:9,  h:9,  border:'rgba(245,158,11,0.35)', label:'#f59e0b' },
  { name:'🎮 Game Lounge',   x:10, y:1, w:8,  h:9,  border:'rgba(139,92,246,0.35)', label:'#a78bfa' },
  { name:'🎵 Music Zone',   x:19, y:1, w:7,  h:9,  border:'rgba(168,85,247,0.35)', label:'#a855f7' },
];
const getZoneAt = (p:{x:number;y:number}) =>
  ZONES.find(z => p.x>=z.x && p.x<z.x+z.w && p.y>=z.y && p.y<z.y+z.h) ?? null;

// ── Collision walls — only gate tiles are passable at zone boundaries ─────────
const WALLS_SET = (() => {
  const s = new Set<string>();
  const b = (tx:number,ty:number) => s.add(`${tx},${ty}`);
  // Top boundary row
  for(let tx=0;tx<34;tx++) b(tx,0);
  // Vertical walls: Coffee|Game|Music
  for(let ty=0;ty<11;ty++) { b(0,ty); b(9,ty); b(18,ty); b(26,ty); }
  // Coffee (x 1-8): gate at x=4
  for(let tx=1;tx<9;tx++)  if(tx!==4)  b(tx,10);
  // Game (x 10-17): gate at x=13
  for(let tx=10;tx<18;tx++) if(tx!==13) b(tx,10);
  // Music (x 19-25): gate at x=22
  for(let tx=19;tx<26;tx++) if(tx!==22) b(tx,10);
  
  // Game Lounge Pagoda towers collision (solid towers)
  for(let ty=1;ty<=6;ty++) {
    b(10,ty); b(11,ty);
    b(16,ty); b(17,ty);
  }
  return s;
})();
const isBlocked = (tx:number,ty:number) => WALLS_SET.has(`${tx},${ty}`);


// ── Shared music tracks ────────────────────────────────────────────────────
const MUSIC_TRACKS = [
  {title:'Lofi Hip Hop Radio',  artist:'Chillhop',        yt:'jfKfPfyJRdk'},
  {title:'Synthwave Radio',     artist:'Nightwave Plaza',  yt:'4xDzrJKXOOY'},
  {title:'Jazz Lofi Beats',     artist:'Lofi Jazz',        yt:'DWcJFNfaw9c'},
  {title:'Chill Lo-Fi Beats',   artist:'Chillhop Music',  yt:'5qap5aO4i9A'},
  {title:'Ambient Study Music', artist:'Yellowbrickcinema',yt:'lTRiuFIWV54'},
];

// ── Minecraft-style canvas world ───────────────────────────────────────────
function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const T = TILE;
  const hv = (tx:number,ty:number) => (tx*13+ty*7)%17;

  // ─ Tile helpers ─────────────────────────────────────────────
  const G = (px:number,py:number,v:number) => {
    ctx.fillStyle=['#4a7c3f','#527a44','#456e39'][v%3];
    ctx.fillRect(px,py,T,T);
    if(v%5===0){ctx.fillStyle='rgba(0,0,0,0.07)';ctx.fillRect(px+3,py+6,4,4);}
    if(v%4===0){ctx.fillStyle='rgba(140,220,80,0.1)';ctx.fillRect(px+T*.6,py+5,3,T*.3);}
  };
  const D = (px:number,py:number,v:number) => {
    ctx.fillStyle=v%2?'#856035':'#7a5530';ctx.fillRect(px,py,T,T);
    ctx.fillStyle='rgba(0,0,0,0.07)';
    if(v%3===0){ctx.beginPath();ctx.arc(px+T*.3,py+T*.4,2,0,Math.PI*2);ctx.fill();}
    if(v%5===0){ctx.beginPath();ctx.arc(px+T*.7,py+T*.7,1.5,0,Math.PI*2);ctx.fill();}
  };
  const S = (px:number,py:number) => {
    ctx.fillStyle='#6a6a6a';ctx.fillRect(px,py,T,T);
    [[0,0],[1,0],[0,1],[1,1]].forEach(([i,j])=>{
      ctx.fillStyle=['#787878','#727272','#7e7e7e','#747474'][i+j*2];
      ctx.fillRect(px+i*(T/2)+1,py+j*(T/2)+1,T/2-2,T/2-2);
    });
    ctx.strokeStyle='rgba(0,0,0,0.25)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(px+T/2,py);ctx.lineTo(px+T/2,py+T);ctx.stroke();
    ctx.beginPath();ctx.moveTo(px,py+T/2);ctx.lineTo(px+T,py+T/2);ctx.stroke();
    ctx.strokeRect(px+.5,py+.5,T-1,T-1);
  };
  const WP = (px:number,py:number,v:number) => {
    ctx.fillStyle=v%2?'#8b6a2c':'#7d5e25';ctx.fillRect(px,py,T,T);
    ctx.strokeStyle='rgba(50,28,5,0.22)';ctx.lineWidth=1;
    [T/3,T*2/3].forEach(y=>{ctx.beginPath();ctx.moveTo(px,py+y);ctx.lineTo(px+T,py+y);ctx.stroke();});
  };
  const OB = (px:number,py:number) => {
    ctx.fillStyle='#0d0918';ctx.fillRect(px,py,T,T);
    ctx.fillStyle='rgba(139,92,246,0.1)';
    ctx.fillRect(px+2,py+2,T/2-3,T/2-3);ctx.fillRect(px+T/2+1,py+T/2+1,T/2-3,T/2-3);
    ctx.strokeStyle='rgba(139,92,246,0.14)';ctx.lineWidth=1;ctx.strokeRect(px+.5,py+.5,T-1,T-1);
  };
  const GZ = (px:number,py:number,tx:number,ty:number,v:number) => {
    if ((tx === 10 || tx === 11 || tx === 16 || tx === 17) && ty >= 1 && ty <= 6) {
      if (ty === 6) {
        ctx.fillStyle = '#374151'; ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#1f2937'; ctx.fillRect(px, py + T - 6, T, 6);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
      } else if (ty === 1) {
        ctx.fillStyle = '#1e293b'; ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#0f172a'; ctx.fillRect(px, py, T, 8);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
      } else {
        ctx.fillStyle = '#f3f4f6'; ctx.fillRect(px, py, T, T);
        ctx.strokeStyle = '#451a03'; ctx.lineWidth = 4;
        ctx.strokeRect(px + 2, py + 2, T - 4, T - 4);
        ctx.beginPath();
        if (ty % 2 === 0) {
          ctx.moveTo(px, py + T/2); ctx.lineTo(px + T, py + T/2);
        } else {
          ctx.moveTo(px + T/2, py); ctx.lineTo(px + T/2, py + T);
        }
        ctx.stroke();
        if (ty === 3 || ty === 4) {
          ctx.fillStyle = '#1e1b4b'; ctx.beginPath();
          ctx.roundRect(px + T/2 - 6, py + T/2 - 8, 12, 16, 2); ctx.fill();
          ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1; ctx.stroke();
        }
      }
      return;
    }
    if (tx >= 12 && tx <= 15 && ty >= 1 && ty <= 6) {
      const isAlt = (tx + ty) % 2 === 0;
      ctx.fillStyle = isAlt ? '#e2e8f0' : '#cbd5e1'; ctx.fillRect(px, py, T, T);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
      if (v % 4 === 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        ctx.fillRect(px + 4, py + 4, T/2, 4);
        ctx.fillRect(px + T/2 + 2, py + T/2, T/2 - 4, 4);
      }
      return;
    }
    if (ty === 7 || ty === 8) {
      ctx.fillStyle = (ty === 7) ? '#78350f' : '#92400e'; ctx.fillRect(px, py, T, T);
      ctx.strokeStyle = 'rgba(20,5,0,0.35)'; ctx.lineWidth = 1;
      [T/4, T/2, T*3/4].forEach(xVal => {
        ctx.beginPath(); ctx.moveTo(px + xVal, py); ctx.lineTo(px + xVal, py + T); ctx.stroke();
      });
      ctx.fillStyle = '#451a03';
      ctx.fillRect(px + 4, py + 4, 2, 2);
      ctx.fillRect(px + T - 6, py + T - 6, 2, 2);
      return;
    }
    if (ty === 9) {
      ctx.fillStyle = '#4b5563'; ctx.fillRect(px, py, T, T);
      ctx.fillStyle = '#78350f'; 
      ctx.fillRect(px, py + 6, T, 4);
      ctx.fillRect(px, py + 18, T, 4);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(px + T/2 - 3, py, 6, T);
      return;
    }
    OB(px, py);
  };
  const WA = (px:number,py:number,v:number) => {
    ctx.fillStyle=v%2?'#1a5fa8':'#1956a0';ctx.fillRect(px,py,T,T);
    ctx.strokeStyle='rgba(100,180,255,0.28)';ctx.lineWidth=1;ctx.setLineDash([4,4]);
    [.35,.68].forEach(y=>{ctx.beginPath();ctx.moveTo(px,py+T*y);ctx.lineTo(px+T,py+T*y);ctx.stroke();});
    ctx.setLineDash([]);
    ctx.fillStyle='rgba(255,255,255,0.06)';ctx.fillRect(px+2,py+T*.3,T*.35,3);
  };
  const DF = (px:number,py:number,v:number) => {
    ctx.fillStyle=(Math.floor(px/T)+Math.floor(py/T))%2===0?'#130a1e':'#0d0618';
    ctx.fillRect(px,py,T,T);
    ctx.strokeStyle='rgba(168,85,247,0.14)';ctx.lineWidth=1;ctx.strokeRect(px+.5,py+.5,T-1,T-1);
    if(v%5===0){ctx.fillStyle='rgba(168,85,247,0.07)';ctx.fillRect(px+2,py+2,T-4,T-4);}
    if(v%7===0){ctx.fillStyle='rgba(236,72,153,0.05)';ctx.fillRect(px+5,py+5,T-10,T-10);}
    if(v%11===0){ctx.fillStyle='rgba(59,130,246,0.05)';ctx.fillRect(px+8,py+8,T-16,T-16);}
  };

  // ─ Minecraft top-down tree ────────────────────────────────────
  const tree = (tx:number,ty:number) => {
    const px=tx*T,py=ty*T;
    ctx.fillStyle='rgba(0,0,0,0.18)';ctx.fillRect(px-4,py+6,T+8,T+4);
    ctx.fillStyle='#1a5218';ctx.fillRect(px,py,T,T);
    ctx.fillStyle='#267a22';ctx.fillRect(px-6,py+8,T+12,T-16);
    ctx.fillStyle='#267a22';ctx.fillRect(px+8,py-6,T-16,T+12);
    ctx.fillStyle='#3a9030';ctx.fillRect(px+5,py+5,T*.38,T*.32);
    ctx.fillStyle='#5c3d1a';ctx.fillRect(px+T/2-4,py+T/2-4,8,8);
    ctx.fillStyle='#7a5028';ctx.fillRect(px+T/2-2,py+T/2-2,4,4);
  };

  // ─ Full tile pass ─────────────────────────────────────────────
  const cols=Math.ceil(w/T)+1, rows=Math.ceil(h/T)+1;
  for(let tx=0;tx<cols;tx++) for(let ty=0;ty<rows;ty++){
    const px=tx*T,py=ty*T,v=hv(tx,ty);
    if(tx>=1&&tx<9&&ty>=1&&ty<10){WP(px,py,v);continue;}  // Coffee
    if(tx>=10&&tx<18&&ty>=1&&ty<10){GZ(px,py,tx,ty,v);continue;}   // Game
    if(tx>=19&&tx<26&&ty>=1&&ty<10){DF(px,py,v);continue;} // Music
    const wall=(ty===0&&tx<27)||(ty===10&&tx<27)||(tx===0&&ty<11)||(tx===9&&ty<11)||(tx===18&&ty<11)||(tx===26&&ty<11);
    if(wall){S(px,py);continue;}
    if(ty>=10&&ty<=11){D(px,py,v);continue;}
    if(tx>=22&&tx<30&&ty>=15&&ty<21){WA(px,py,v);continue;}
    G(px,py,v);
  }

  // ─ Trees ──────────────────────────────────────────────────────
  [[2,0],[4,0],[6,0],[11,0],[15,0],[18,0],[20,0],[23,0],[26,0],[28,0],[30,0],
   [0,12],[0,15],[0,18],[0,21],[31,3],[31,8],[31,13],[31,18],[31,22],
   [2,13],[5,14],[8,12],[11,15],[13,14],[17,13],[20,12],[21,15],[24,14],[27,13],[29,12],
   [3,17],[6,19],[9,18],[12,17],[15,20],[18,18],[20,21],[23,19],[25,17],[28,19],[30,21],
   [2,21],[4,23],[7,22],[10,21],[12,23],[14,22],[16,24]
  ].forEach(([tx,ty])=>tree(tx,ty));

  // ─ Road center dashes ─────────────────────────────────────────
  for(let tx=0;tx<cols;tx++){
    ctx.fillStyle='rgba(255,220,50,0.22)';
    ctx.fillRect(tx*T+T*.44,10*T+T-3,T*.12,6);
    ctx.fillStyle='rgba(255,255,255,0.07)';
    ctx.fillRect(tx*T,10*T,T,2);ctx.fillRect(tx*T,12*T-2,T,2);
  }

  // ─ Water pond sand shore ──────────────────────────────────────
  ctx.fillStyle='rgba(210,175,80,0.22)';
  ctx.beginPath();ctx.roundRect(22*T-6,15*T-6,8*T+12,6*T+12,10);ctx.fill();

  // ─ Zone glow borders + name pills ────────────────────────────
  ([['💻 Work Pods','#06b6d4',1,1,8,9],
    ['☕ Café','#f59e0b',9,1,5,9],
    ['🎮 Game Lounge','#a78bfa',14,1,5,9],
    ['🎵 Music Zone','#a855f7',19,1,7,9]
  ] as [string,string,number,number,number,number][]).forEach(([name,color,zx,zy,zw,zh])=>{
    const px2=zx*T,py2=zy*T,pw=zw*T,ph=zh*T;
    ctx.save();ctx.shadowBlur=14;ctx.shadowColor=color;
    ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash([6,4]);
    ctx.strokeRect(px2+1,py2+1,pw-2,ph-2);ctx.setLineDash([]);ctx.restore();
    ctx.font='bold 11px Inter,sans-serif';ctx.textAlign='left';ctx.textBaseline='top';
    const tw=ctx.measureText(name).width;
    ctx.fillStyle='rgba(0,0,0,0.6)';ctx.beginPath();ctx.roundRect(px2+6,py2+5,tw+12,18,5);ctx.fill();
    ctx.fillStyle=color;ctx.fillText(name,px2+12,py2+9);
  });

  // ─ Coffee shop interior ───────────────────────────────────────
  const CX=1*T,CY=1*T;
  for(let tx=1;tx<9;tx++) S(tx*T,CY);
  // Chalkboard
  {const bx=CX+T*.35,by=CY+5,bw=T*2.8,bh=T*.8;
   ctx.fillStyle='#2a1608';ctx.beginPath();ctx.roundRect(bx-4,by-4,bw+8,bh+8,3);ctx.fill();
   ctx.fillStyle='#0d1f12';ctx.beginPath();ctx.roundRect(bx,by,bw,bh,2);ctx.fill();
   ctx.fillStyle='rgba(255,255,255,0.65)';ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.textBaseline='top';
   ctx.fillText('COFFEE · TEA · PASTRY',bx+bw/2,by+4);
   ctx.fillStyle='rgba(255,255,255,0.35)';ctx.font='7px monospace';
   ['Espresso $3','Latte $4','Cake $3'].forEach((t,i)=>ctx.fillText(t,bx+bw/2,by+16+i*9));
  }
  // Pendant lights
  [CX+T*1.2,CX+T*2.5,CX+T*3.8].forEach(lx=>{
    const ly=CY+T*.5;
    ctx.strokeStyle='rgba(180,140,60,0.5)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(lx,CY);ctx.lineTo(lx,ly);ctx.stroke();
    ctx.fillStyle='#6b4512';
    ctx.beginPath();ctx.moveTo(lx-10,ly+5);ctx.lineTo(lx-14,ly+19);ctx.lineTo(lx+14,ly+19);ctx.lineTo(lx+10,ly+5);ctx.closePath();ctx.fill();
    ctx.save();ctx.globalAlpha=0.14;
    const lg=ctx.createRadialGradient(lx,ly+19,0,lx,ly+19,T*.65);
    lg.addColorStop(0,'#ffd580');lg.addColorStop(1,'transparent');
    ctx.fillStyle=lg;ctx.beginPath();ctx.arc(lx,ly+19,T*.65,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.fillStyle='rgba(255,230,80,0.9)';ctx.beginPath();ctx.arc(lx,ly+14,2.5,0,Math.PI*2);ctx.fill();
  });
  // Counter bar
  {const bx=CX+4,by=CY+T*1.35,bw=5*T-8,bh=T*.9;
   ctx.fillStyle='#3a2510';ctx.beginPath();ctx.roundRect(bx,by,bw,bh,3);ctx.fill();
   ctx.fillStyle='#4a3018';ctx.beginPath();ctx.roundRect(bx+2,by+2,bw-4,bh-4,2);ctx.fill();
   ctx.strokeStyle='rgba(245,158,11,0.35)';ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect(bx,by,bw,bh,3);ctx.stroke();
   ctx.fillStyle='#1a1a1a';ctx.beginPath();ctx.roundRect(bx+6,by+4,36,bh-8,3);ctx.fill();
   ctx.fillStyle='rgba(0,255,80,0.4)';ctx.font='5px monospace';ctx.textAlign='center';ctx.fillText('BREW',bx+24,by+12);
   ctx.strokeStyle='rgba(200,200,200,0.4)';ctx.lineWidth=2;
   ctx.beginPath();ctx.moveTo(bx+40,by+bh*.3);ctx.lineTo(bx+40,by+bh);ctx.stroke();
   ctx.fillStyle='#2d1a08';ctx.beginPath();ctx.roundRect(bx+50,by+6,20,bh-12,4);ctx.fill();
   ctx.fillStyle='rgba(245,158,11,0.25)';ctx.beginPath();ctx.arc(bx+60,by+14,7,0,Math.PI*2);ctx.fill();
   const dx=bx+bw-T*1.8,dy2=by+3,dw=T*1.7,dh=bh-6;
   ctx.fillStyle='rgba(180,220,255,0.1)';ctx.beginPath();ctx.roundRect(dx,dy2,dw,dh,3);ctx.fill();
   ctx.strokeStyle='rgba(180,220,255,0.4)';ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect(dx,dy2,dw,dh,3);ctx.stroke();
   [[dx+8,dy2+8,'#c8860a'],[dx+24,dy2+8,'#d4a574'],[dx+40,dy2+8,'#8b4513'],
    [dx+8,dy2+22,'#d4a574'],[dx+24,dy2+22,'#c8860a'],[dx+40,dy2+22,'#8b4513']
   ].forEach(([px3,py3,col])=>{
     ctx.fillStyle=col as string;ctx.beginPath();ctx.arc(px3 as number+5,py3 as number+5,5,0,Math.PI*2);ctx.fill();
   });
  }
  // Tables + chairs
  [[2,4],[5,4],[2,7],[5,7]].forEach(([tx2,ty2])=>{
    const px=tx2*T+T/2,py=ty2*T+T/2;
    ctx.fillStyle='rgba(0,0,0,0.22)';ctx.beginPath();ctx.ellipse(px+3,py+3,T*.4,T*.35,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#3a2208';ctx.beginPath();ctx.arc(px,py,T*.4,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(245,158,11,0.5)';ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle='#f5f0e8';ctx.beginPath();ctx.ellipse(px,py,5,4,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#3d1500';ctx.beginPath();ctx.ellipse(px,py,3,2.5,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.18)';ctx.lineWidth=1;ctx.setLineDash([2,2]);
    ctx.beginPath();ctx.moveTo(px,py-6);ctx.quadraticCurveTo(px-3,py-11,px,py-15);ctx.stroke();ctx.setLineDash([]);
    for(let a=0;a<4;a++){
      const ang=a*Math.PI/2+Math.PI/4,cx=px+Math.cos(ang)*T*.55,cy=py+Math.sin(ang)*T*.55;
      ctx.fillStyle='#5a3818';ctx.beginPath();ctx.roundRect(cx-5,cy-4,10,9,2);ctx.fill();
      ctx.strokeStyle='rgba(245,158,11,0.2)';ctx.lineWidth=1;ctx.stroke();
    }
  });
  // Café gate entrance
  {const gx=CX+T*3.5,gy=CY+9*T;
   [gx-T,gx+T].forEach(px=>{
     ctx.fillStyle='#3a2510';ctx.beginPath();ctx.roundRect(px-6,gy-22,12,22,2);ctx.fill();
     ctx.strokeStyle='rgba(245,158,11,0.5)';ctx.lineWidth=1;ctx.stroke();
     ctx.fillStyle='#c8860a';ctx.beginPath();ctx.roundRect(px-8,gy-28,16,7,2);ctx.fill();
     ctx.save();ctx.globalAlpha=0.1;
     const gl=ctx.createRadialGradient(px,gy-25,0,px,gy-25,T*.5);
     gl.addColorStop(0,'#ffd580');gl.addColorStop(1,'transparent');
     ctx.fillStyle=gl;ctx.beginPath();ctx.arc(px,gy-25,T*.5,0,Math.PI*2);ctx.fill();ctx.restore();
   });
   ctx.fillStyle='#3a2510';ctx.beginPath();ctx.roundRect(gx-T-6,gy-29,T*2+12,8,2);ctx.fill();
   ctx.strokeStyle='rgba(245,158,11,0.45)';ctx.lineWidth=1;ctx.stroke();
   ctx.fillStyle='rgba(245,158,11,0.9)';ctx.font='bold 9px serif';ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.fillText('☕ CAFÉ',gx,gy-25);
   ctx.fillStyle='rgba(245,158,11,0.12)';
   ctx.beginPath();ctx.roundRect(gx-T+6,gy-8,T*2-12,10,3);ctx.fill();
}


  // ══ MINECRAFT COFFEE SHOP ASSETS ═════════════════════════════════════════

  // Bookshelf (oak planks + coloured spines)
  const mcBookshelf=(px:number,py:number)=>{
    ctx.fillStyle='#a0742a';ctx.fillRect(px,py,T,T);
    [[0,0,T,8],[0,T-8,T,8]].forEach(([bx,by,bw,bh])=>{
      ctx.fillStyle='#8b6220';ctx.fillRect(px+bx,py+by,bw,bh);
      ctx.strokeStyle='rgba(50,28,5,0.3)';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(px,py+by+4);ctx.lineTo(px+T,py+by+4);ctx.stroke();
    });
    ['#e74c3c','#3498db','#2ecc71','#9b59b6','#f39c12','#1abc9c','#e67e22','#e91e63'].forEach((c,i)=>{
      const bw2=T/8,bx2=px+i*bw2+1;
      ctx.fillStyle=c;ctx.fillRect(bx2,py+9,bw2-1,T-18);
      ctx.fillStyle='rgba(255,255,255,0.15)';ctx.fillRect(bx2,py+9,2,T-18);
    });
    ctx.strokeStyle='rgba(0,0,0,0.2)';ctx.lineWidth=1;ctx.strokeRect(px+.5,py+.5,T-1,T-1);
  };
  // Barrel (iron bands, lid rings)
  const mcBarrel=(px:number,py:number)=>{
    ctx.fillStyle='#7a5528';ctx.beginPath();ctx.arc(px+T/2,py+T/2,T/2-3,0,Math.PI*2);ctx.fill();
    [T/2-5,T/2-10].forEach(r=>{ctx.strokeStyle='rgba(100,65,20,0.4)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(px+T/2,py+T/2,r,0,Math.PI*2);ctx.stroke();});
    ctx.fillStyle='#5a5a5a';
    ctx.beginPath();ctx.roundRect(px+4,py+T/2-3,T-8,5,1);ctx.fill();
    ctx.beginPath();ctx.roundRect(px+8,py+8,T-16,4,1);ctx.fill();
    ctx.beginPath();ctx.roundRect(px+8,py+T-12,T-16,4,1);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.35)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(px+T/2,py+T/2,T/2-3,0,Math.PI*2);ctx.stroke();
  };
  // Cauldron (coffee brew pot)
  const mcCauldron=(px:number,py:number)=>{
    ctx.fillStyle='#3a3a3a';ctx.beginPath();ctx.arc(px+T/2,py+T/2,T/2-2,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(80,80,80,0.5)';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#3d1500';ctx.beginPath();ctx.ellipse(px+T/2,py+T/2,T/2-8,T/2-10,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,180,50,0.2)';ctx.beginPath();ctx.ellipse(px+T/2-4,py+T/2-4,6,4,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#4a4a4a';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(px+4,py+T/2,6,Math.PI*.5,Math.PI*1.5);ctx.stroke();
    ctx.beginPath();ctx.arc(px+T-4,py+T/2,6,Math.PI*1.5,Math.PI*.5);ctx.stroke();
    ctx.strokeStyle='rgba(200,200,200,0.25)';ctx.lineWidth=1.5;ctx.setLineDash([2,3]);
    [[px+T/2-5,py+T/2-14],[px+T/2+3,py+T/2-12]].forEach(([sx,sy])=>{ctx.beginPath();ctx.moveTo(sx,sy+8);ctx.quadraticCurveTo(sx-4,sy+2,sx,sy);ctx.stroke();});
    ctx.setLineDash([]);
  };
  // Flower pot (terracotta + stem + 4-petal flower)
  const mcFlowerPot=(px:number,py:number,col:string)=>{
    ctx.fillStyle='#b05a2a';
    ctx.beginPath();ctx.moveTo(px-7,py-2);ctx.lineTo(px-5,py+10);ctx.lineTo(px+5,py+10);ctx.lineTo(px+7,py-2);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(80,35,10,0.4)';ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle='#c06830';ctx.beginPath();ctx.roundRect(px-8,py-5,16,5,2);ctx.fill();
    ctx.fillStyle='#2a1505';ctx.beginPath();ctx.ellipse(px,py-3,6,3,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#2d6b1a';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(px,py-3);ctx.lineTo(px,py-14);ctx.stroke();
    ctx.fillStyle=col;
    [0,1,2,3].forEach(i=>{const a=i*Math.PI/2;ctx.beginPath();ctx.ellipse(px+Math.cos(a)*5,py-14+Math.sin(a)*5,3.5,2.5,a,0,Math.PI*2);ctx.fill();});
    ctx.fillStyle='#f5e642';ctx.beginPath();ctx.arc(px,py-14,3,0,Math.PI*2);ctx.fill();
  };
  // Wall lantern
  const mcLantern=(px:number,py:number)=>{
    ctx.strokeStyle='rgba(100,100,100,0.6)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(px,py-10);ctx.lineTo(px,py-2);ctx.stroke();
    ctx.fillStyle='#2a2a2a';ctx.beginPath();ctx.roundRect(px-6,py-2,12,14,2);ctx.fill();
    ctx.strokeStyle='rgba(120,120,120,0.4)';ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle='rgba(255,200,50,0.9)';ctx.beginPath();ctx.arc(px,py+5,4,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.globalAlpha=0.18;
    const ll=ctx.createRadialGradient(px,py+5,0,px,py+5,T*.4);
    ll.addColorStop(0,'#ffd580');ll.addColorStop(1,'transparent');
    ctx.fillStyle=ll;ctx.beginPath();ctx.arc(px,py+5,T*.4,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.fillStyle='#3a3a3a';ctx.beginPath();ctx.roundRect(px-7,py-4,14,4,1);ctx.fill();
    ctx.beginPath();ctx.roundRect(px-5,py-9,10,6,1);ctx.fill();
  };
  // Campfire
  const mcCampfire=(px:number,py:number)=>{
    ctx.fillStyle='#5c3d1a';
    ctx.save();ctx.translate(px+T/2,py+T/2);ctx.rotate(Math.PI/4);ctx.fillRect(-T*.38,-5,T*.76,10);ctx.restore();
    ctx.save();ctx.translate(px+T/2,py+T/2);ctx.rotate(-Math.PI/4);ctx.fillRect(-T*.38,-5,T*.76,10);ctx.restore();
    ctx.fillStyle='rgba(50,50,50,0.5)';ctx.beginPath();ctx.arc(px+T/2,py+T/2,T*.28,0,Math.PI*2);ctx.fill();
    [['#ef4444',8],['#f97316',6],['#fbbf24',4],['#fef08a',2]].forEach(([c,r])=>{
      ctx.fillStyle=c as string;
      [[0,-5],[4,-3],[-4,-3],[2,-8],[-2,-8]].forEach(([ox,oy])=>{ctx.beginPath();ctx.arc(px+T/2+ox,py+T/2+oy,r as number,0,Math.PI*2);ctx.fill();});
    });
    ctx.save();ctx.globalAlpha=0.15;
    const cf=ctx.createRadialGradient(px+T/2,py+T/2,0,px+T/2,py+T/2,T*.5);
    cf.addColorStop(0,'#f97316');cf.addColorStop(1,'transparent');
    ctx.fillStyle=cf;ctx.beginPath();ctx.arc(px+T/2,py+T/2,T*.5,0,Math.PI*2);ctx.fill();ctx.restore();
  };
  // ── Place assets ────────────────────────────────────────────────────────────
  [2,3,4].forEach(ty=>mcBookshelf(8*T,ty*T));
  mcBarrel(1*T,5*T); mcBarrel(1*T,6*T);
  mcCauldron(1*T,3*T);
  mcFlowerPot(3*T+T-14,3*T+6,'#e74c3c');
  mcFlowerPot(6*T+T-14,3*T+6,'#f5e642');
  mcFlowerPot(3*T+T-14,6*T+6,'#e84b6a');
  mcFlowerPot(6*T+T-14,6*T+6,'#a78bfa');
  mcFlowerPot(1*T+6,8*T+6,'#2ecc71');
  mcFlowerPot(8*T-18,8*T+6,'#e74c3c');
  [3,5,7].forEach(ty=>mcLantern(1*T+8,ty*T+T/2));
  mcCampfire(1*T,8*T);


  // ── 🎵 Music Zone canvas assets ───────────────────────────────────────────
  const MX=19*T, MY=1*T; // music zone top-left
  // Speaker block helper
  const mcSpeaker=(px:number,py:number)=>{
    ctx.fillStyle='#111118';ctx.fillRect(px,py,T,T);
    ctx.strokeStyle='rgba(168,85,247,0.35)';ctx.lineWidth=1.5;ctx.strokeRect(px+.5,py+.5,T-1,T-1);
    ctx.fillStyle='#0a0a10';ctx.beginPath();ctx.arc(px+T/2,py+T/2,T*.38,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(168,85,247,0.5)';ctx.lineWidth=1;ctx.stroke();
    [.28,.18,.07].forEach(r=>{
      ctx.strokeStyle=`rgba(168,85,247,${0.1+r*0.5})`;ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(px+T/2,py+T/2,T*r,0,Math.PI*2);ctx.stroke();
    });
    ctx.fillStyle='rgba(168,85,247,0.7)';ctx.beginPath();ctx.arc(px+T/2,py+T/2,3,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.globalAlpha=0.1;
    const sg=ctx.createRadialGradient(px+T/2,py+T/2,0,px+T/2,py+T/2,T*.7);
    sg.addColorStop(0,'#a855f7');sg.addColorStop(1,'transparent');
    ctx.fillStyle=sg;ctx.beginPath();ctx.arc(px+T/2,py+T/2,T*.7,0,Math.PI*2);ctx.fill();ctx.restore();
  };
  // Vinyl poster helper
  const mcVinyl=(px:number,py:number)=>{
    ctx.fillStyle='#1a0a2a';ctx.fillRect(px,py,T,T);
    ctx.strokeStyle='rgba(168,85,247,0.5)';ctx.lineWidth=1.5;ctx.strokeRect(px+.5,py+.5,T-1,T-1);
    ['#0d0010','#16002a','#0d0010'].forEach((c,i)=>{
      ctx.fillStyle=c;ctx.beginPath();ctx.arc(px+T/2,py+T/2,T*.44-i*8,0,Math.PI*2);ctx.fill();
    });
    ctx.fillStyle='#7c2d12';ctx.beginPath();ctx.arc(px+T/2,py+T/2,T*.17,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#0d0010';ctx.beginPath();ctx.arc(px+T/2,py+T/2,3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(168,85,247,0.7)';ctx.font=`${T*.28}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('♫',px+T/2,py+T/2);
    ctx.fillStyle='rgba(236,72,153,0.5)';ctx.font=`${T*.18}px serif`;
    ctx.fillText('♪',px+T*.2,py+T*.25);ctx.fillText('♩',px+T*.8,py+T*.75);
  };
  // Disco ball
  const mcDiscoBall=(px:number,py:number)=>{
    const cx=px+T/2,cy=py+T/2,r=T*.3;
    ctx.fillStyle='#c0c0c0';ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
    const cols=['#ff69b4','#00ffff','#ffff00','#ff6600','#a855f7'];
    for(let row=0;row<4;row++) for(let col=0;col<6;col++){
      const a=(col/6)*Math.PI*2,b=(row/4-.5)*Math.PI;
      const mx2=cx+Math.cos(a)*Math.cos(b)*r,my2=cy+Math.sin(b)*r;
      ctx.fillStyle=cols[(row*3+col)%5];ctx.globalAlpha=0.65;
      ctx.fillRect(mx2-2,my2-2,4,4);ctx.globalAlpha=1;
    }
    // Radiant glow beams
    ctx.save();ctx.globalAlpha=0.08;
    const dg=ctx.createRadialGradient(cx,cy,0,cx,cy,T*.9);
    dg.addColorStop(0,'#ffffff');dg.addColorStop(1,'transparent');
    ctx.fillStyle=dg;ctx.beginPath();ctx.arc(cx,cy,T*.9,0,Math.PI*2);ctx.fill();ctx.restore();
    // Chain
    ctx.strokeStyle='rgba(180,180,180,0.5)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(cx,cy-r);ctx.lineTo(cx,cy-r-10);ctx.stroke();
  };
  // DJ booth / stage
  {const sx=MX+T*2,sy=MY+T*0.5,sw=T*4,sh=T*1.5;
   ctx.fillStyle='#1e0a32';ctx.beginPath();ctx.roundRect(sx,sy,sw,sh,4);ctx.fill();
   ctx.strokeStyle='rgba(168,85,247,0.5)';ctx.lineWidth=2;ctx.stroke();
   // Stage surface
   ctx.fillStyle='#2d1045';ctx.beginPath();ctx.roundRect(sx+4,sy+4,sw-8,sh-8,3);ctx.fill();
   // DJ table
   ctx.fillStyle='#1a0a28';ctx.beginPath();ctx.roundRect(sx+T*.5,sy+T*.4,T*3,sh-T*.8,3);ctx.fill();
   ctx.strokeStyle='rgba(168,85,247,0.3)';ctx.lineWidth=1;ctx.stroke();
   // Turntable circles on table
   [sx+T,sx+T*2.5].forEach(tx3=>{
     const ty3=sy+T*.75;
     ctx.fillStyle='#0d0010';ctx.beginPath();ctx.arc(tx3,ty3,T*.22,0,Math.PI*2);ctx.fill();
     ctx.strokeStyle='rgba(168,85,247,0.4)';ctx.lineWidth=1;ctx.stroke();
     ctx.strokeStyle='rgba(168,85,247,0.2)';[.15,.08].forEach(r=>{
       ctx.beginPath();ctx.arc(tx3,ty3,T*r,0,Math.PI*2);ctx.stroke();
     });
     ctx.fillStyle='rgba(168,85,247,0.5)';ctx.beginPath();ctx.arc(tx3,ty3,2,0,Math.PI*2);ctx.fill();
   });
   // Mixer (center of table)
   ctx.fillStyle='#111118';ctx.beginPath();ctx.roundRect(sx+T*1.5,sy+T*.5,T*.9,T*.45,2);ctx.fill();
   ctx.fillStyle='rgba(168,85,247,0.4)';
   [0,1,2,3,4].forEach(k=>{
     ctx.beginPath();ctx.arc(sx+T*(1.6+k*.14),sy+T*.72,3,0,Math.PI*2);ctx.fill();
   });
   // "NOW PLAYING" LED strip on stage front
   const grad=ctx.createLinearGradient(sx,sy+sh-4,sx+sw,sy+sh-4);
   grad.addColorStop(0,'#a855f7');grad.addColorStop(.5,'#ec4899');grad.addColorStop(1,'#a855f7');
   ctx.fillStyle=grad;ctx.fillRect(sx,sy+sh-4,sw,4);
  }
  // Speakers: four corners + two centre-top
  [[19,1],[25,1],[19,5],[25,5],[21,1],[23,1]].forEach(([tx2,ty2])=>mcSpeaker(tx2*T,ty2*T));
  // Vinyl posters on side walls
  [[19,3],[19,7],[25,3],[25,7]].forEach(([tx2,ty2])=>mcVinyl(tx2*T,ty2*T));
  // Disco balls
  [[21,5],[23,5]].forEach(([tx2,ty2])=>mcDiscoBall(tx2*T,ty2*T));
  // Neon "MUSIC ZONE" sign on back wall
  {const sx=MX+T*.5,sy=MY+2,sw=T*7-T,sh=28;
   ctx.fillStyle='rgba(10,0,20,0.85)';ctx.beginPath();ctx.roundRect(sx,sy,sw,sh,5);ctx.fill();
   ctx.strokeStyle='rgba(168,85,247,0.6)';ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect(sx,sy,sw,sh,5);ctx.stroke();
   ctx.save();ctx.shadowBlur=8;ctx.shadowColor='#a855f7';
   ctx.fillStyle='#e9d5ff';ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.fillText('♪  MUSIC ZONE  ♪',sx+sw/2,sy+sh/2);ctx.restore();
  }
  // Dance floor neon edge strip (bottom of zone)
  const ledGrad=ctx.createLinearGradient(MX,8*T,MX+8*T,8*T);
  ['#a855f7','#ec4899','#3b82f6','#a855f7'].forEach((c,i,a)=>ledGrad.addColorStop(i/(a.length-1),c));
  ctx.fillStyle=ledGrad;ctx.fillRect(MX,9*T-4,8*T,4);
  // Floating music notes scattered on floor
  ctx.font='16px serif';
  [[20,4,'♪'],[22,3,'♫'],[24,4,'♩'],[20,7,'♬'],[24,7,'♪'],[22,6,'♫']].forEach(([tx2,ty2,note])=>{
    ctx.fillStyle=`rgba(168,85,247,0.4)`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(note as string,tx2 as number*T+T/2,ty2 as number*T+T/2);
  });


  // ── 🎮 Game Zone waterfront pagoda assets ──────────────────────────────────
  const GZX=10*T, GZY=1*T;

  // 1. Pagoda Stepped Roofs (Left: x=10..12, Right: x=16..18)
  const drawPagodaRoof = (rx:number) => {
    // Bottom eaves
    ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.roundRect(rx - 8, GZY - 8, 2*T + 16, 10, 3); ctx.fill();
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1; ctx.stroke();
    // Curved roof tips (Japanese style)
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(rx - 8, GZY - 10, 4, 4);
    ctx.fillRect(rx + 2*T + 4, GZY - 10, 4, 4);

    // Middle tier
    ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.roundRect(rx + 8, GZY - 18, 2*T - 16, 10, 2); ctx.fill();
    ctx.stroke();

    // Top tier
    ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.roundRect(rx + 20, GZY - 28, 2*T - 40, 10, 2); ctx.fill();
    ctx.stroke();

    // Gold Spire
    ctx.fillStyle = '#d97706';
    ctx.fillRect(rx + T - 3, GZY - 38, 6, 10);
    ctx.fillRect(rx + T - 1, GZY - 44, 2, 6);
  };
  drawPagodaRoof(GZX);
  drawPagodaRoof(GZX + 6*T);

  // 2. Neon Torii Gate Header Sign
  {
    const sx = GZX + 2*T + 4, sy = GZY - 24, sw = 4*T - 8, sh = 22;
    // Torii pillars
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(GZX + 2*T + 4, GZY - 4, 8, 28);
    ctx.fillRect(GZX + 6*T - 12, GZY - 4, 8, 28);
    // Torii crossbar
    ctx.fillRect(GZX + 2*T, GZY - 10, 4*T, 6);

    // Neon Game Arcade plate
    ctx.fillStyle = 'rgba(12, 10, 20, 0.92)'; ctx.beginPath(); ctx.roundRect(sx + 10, sy + 2, sw - 20, sh, 4); ctx.fill();
    ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.save(); ctx.shadowBlur = 8; ctx.shadowColor = '#a855f7';
    ctx.fillStyle = '#f3e8ff'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⛩️  GAME ARCADE  ⛩️', sx + sw/2, sy + 2 + sh/2); ctx.restore();
  }

  // 3. Hanging Lanterns with Glow
  const drawLantern = (lx:number, ly:number) => {
    // Post/chain
    ctx.strokeStyle = '#374151'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly + 8); ctx.stroke();
    // Cap
    ctx.fillStyle = '#1e293b'; ctx.fillRect(lx - 5, ly + 8, 10, 3);
    // Glowing lamp body
    ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.roundRect(lx - 4, ly + 11, 8, 10, 1); ctx.fill();
    ctx.strokeStyle = '#d97706'; ctx.stroke();
    // Fire particle glow
    ctx.save(); ctx.globalAlpha = 0.12;
    const lg = ctx.createRadialGradient(lx, ly + 16, 0, lx, ly + 16, 16);
    lg.addColorStop(0, '#f97316'); lg.addColorStop(1, 'transparent');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lx, ly + 16, 16, 0, Math.PI*2); ctx.fill(); ctx.restore();
  };
  drawLantern(GZX - 4, GZY + 2);
  drawLantern(GZX + 2*T + 4, GZY + 2);
  drawLantern(GZX + 6*T - 4, GZY + 2);
  drawLantern(GZX + 8*T + 4, GZY + 2);

  // 4. Red wall banners on pagodas
  const drawBanner = (bx:number, by:number) => {
    ctx.fillStyle = '#dc2626'; ctx.fillRect(bx, by, 6, 18);
    ctx.fillStyle = '#fbbf24'; ctx.fillRect(bx + 2, by + 3, 2, 12);
  };
  drawBanner(GZX + 6, GZY + T + 4);
  drawBanner(GZX + T*2 - 12, GZY + T + 4);
  drawBanner(GZX + T*6 + 6, GZY + T + 4);
  drawBanner(GZX + T*8 - 12, GZY + T + 4);

  // 5. Ancient Rune Gaming Pedestals (replacing arcade cabinets)
  const drawPedestal = (px:number, py:number, col:string, label:string, icon:string) => {
    // Base block (quartz look)
    ctx.fillStyle = '#e2e8f0'; ctx.beginPath(); ctx.roundRect(px + 4, py + 8, T - 8, T - 8, 2); ctx.fill();
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1; ctx.stroke();
    // Polished stone trim
    ctx.fillStyle = '#475569'; ctx.fillRect(px + 4, py + 8, T - 8, 4);
    // Floating magic rune sign
    ctx.save(); ctx.shadowBlur = 6; ctx.shadowColor = col;
    ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.roundRect(px + 8, py - 4, T - 16, 10, 2); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = col; ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, px + T/2, py + 1);
    // Floating icon above pedestal
    ctx.font = '16px serif'; ctx.fillText(icon, px + T/2, py - 12);
    ctx.restore();
  };
  drawPedestal(GZX + T*1.5, GZY + T*3, '#fbbf24', 'SLOTS', '🎰');
  drawPedestal(GZX + T*3.5, GZY + T*2.5, '#60a5fa', 'RPS', '🎲');
  drawPedestal(GZX + T*5.5, GZY + T*3, '#a78bfa', 'TTT', '🎯');

  // 6. Waterfront Dock Items & Boats
  const mcBoat = (bx:number, by:number, woodColor:string, trimColor:string) => {
    // Boat hull
    ctx.fillStyle = woodColor; ctx.beginPath(); ctx.roundRect(bx, by, 28, 14, 3); ctx.fill();
    // Inner seating
    ctx.fillStyle = trimColor; ctx.beginPath(); ctx.roundRect(bx + 3, by + 2, 22, 10, 2); ctx.fill();
    // Oars
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(bx + 8, by - 2); ctx.lineTo(bx + 14, by + 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx + 8, by + 16); ctx.lineTo(bx + 14, by + 12); ctx.stroke();
  };
  // Draw boats floating just below the dock fence
  mcBoat(GZX + T*0.5, GZY + T*8.8, '#78350f', '#451a03'); // Oak boat
  mcBoat(GZX + T*2.8, GZY + T*8.8, '#d97706', '#7c2d12'); // Acacia boat
  mcBoat(GZX + T*6.2, GZY + T*8.8, '#451a03', '#1e0700'); // Dark Oak boat

  // Potted bamboo on dock sides
  const drawPottedBamboo = (px:number, py:number) => {
    // Pot
    ctx.fillStyle = '#b45309'; ctx.fillRect(px - 4, py - 6, 8, 6);
    // Stem
    ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px, py - 6); ctx.lineTo(px, py - 22); ctx.stroke();
    // Leaves
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(px - 3, py - 18, 3, 2);
    ctx.fillRect(px, py - 22, 4, 2);
  };
  drawPottedBamboo(GZX + 12, GZY + T*7.5);
  drawPottedBamboo(GZX + 8*T - 12, GZY + T*7.5);

  // Score ticker strip
  {const sx=GZX + 2*T,sy=GZY+T*4.8,sw=4*T,sh=T*.5;
   const grad=ctx.createLinearGradient(sx,sy,sx+sw,sy);
   grad.addColorStop(0,'rgba(124,58,237,0.85)');grad.addColorStop(.5,'rgba(79,70,229,0.85)');grad.addColorStop(1,'rgba(124,58,237,0.85)');
   ctx.fillStyle=grad;ctx.beginPath();ctx.roundRect(sx,sy,sw,sh,4);ctx.fill();
   ctx.fillStyle='rgba(255,255,255,0.95)';ctx.font=`bold ${T*.14}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.fillText('🏆 HIGH SCORE • PLAY NOW 🕹️',sx+sw/2,sy+sh/2);}
  // ── Zone gates: Work Pods, Game Lounge, Chill Zone ────────────────────────
  const drawGate=(gx:number,gy:number,col:string,label:string,dark:string)=>{
    [gx-T,gx+T].forEach(px=>{
      ctx.fillStyle=dark;ctx.beginPath();ctx.roundRect(px-6,gy-22,12,22,2);ctx.fill();
      ctx.strokeStyle=col.replace(')',',0.6)').replace('rgb','rgba');ctx.lineWidth=1.5;ctx.stroke();
      ctx.fillStyle=col;ctx.beginPath();ctx.roundRect(px-8,gy-28,16,7,2);ctx.fill();
      ctx.save();ctx.globalAlpha=0.14;
      const gl=ctx.createRadialGradient(px,gy-25,0,px,gy-25,T*.5);
      gl.addColorStop(0,col);gl.addColorStop(1,'transparent');
      ctx.fillStyle=gl;ctx.beginPath();ctx.arc(px,gy-25,T*.5,0,Math.PI*2);ctx.fill();ctx.restore();
      // Lantern glow dot
      ctx.fillStyle='rgba(255,255,200,0.85)';ctx.beginPath();ctx.arc(px,gy-28,2.5,0,Math.PI*2);ctx.fill();
    });
    ctx.fillStyle=dark;ctx.beginPath();ctx.roundRect(gx-T-6,gy-29,T*2+12,8,2);ctx.fill();
    ctx.strokeStyle=col;ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle=col;ctx.font='bold 9px serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(label,gx,gy-25);
    // Welcome mat
    ctx.fillStyle=col.replace('rgb(','rgba(').replace(')' ,',0.13)');
    if(!col.includes('rgba')) ctx.fillStyle=col+'22';
    ctx.beginPath();ctx.roundRect(gx-T+6,gy-8,T*2-12,10,3);ctx.fill();
  };
  const GY=10*T; // bottom wall row
  // Coffee: gate at tile x=4
  drawGate(4*T+T/2, GY, '#f59e0b', '\u2615 CAF\u00C9', '#1a0a00');
  // Game Lounge: gate at tile x=13
  drawGate(13*T+T/2, GY, '#a78bfa', '\u{1F3AE} GAMES', '#0d0918');
  // Chill Zone: gate at tile x=22, center pixel = 22*T+T/2
  drawGate(22*T+T/2, GY, '#a855f7', '\u{1F3B5} MUSIC', '#0d0618');

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
  const [musicIdx,  setMusicIdx]  = useState(0);
  const [musicOn,   setMusicOn]   = useState(false);
  const inMusicZone = myPos ? (myPos.x>=19 && myPos.x<26 && myPos.y>=1 && myPos.y<10) : false;
  const inGameZone  = myPos ? (myPos.x>=10 && myPos.x<18 && myPos.y>=1 && myPos.y<10) : false;
  const [activeGame, setActiveGame] = useState<'slot'|'rps'|'ttt'|null>(null);
  // Tic-Tac-Toe shared state
  const [tttBoard, setTttBoard] = useState<(string|null)[]>(Array(9).fill(null));
  const [tttTurn,  setTttTurn]  = useState<'X'|'O'>('X');
  const [tttSymbol,setTttSymbol]= useState<'X'|'O'|null>(null);
  const [tttPlayers,setTttPlayers]=useState<string[]>([]);
  // Auto-stop music when player leaves Music Zone
  React.useEffect(() => { if (!inMusicZone) setMusicOn(false); }, [inMusicZone]);

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
          case 'music_change':
            setMusicIdx(msg.payload.idx ?? 0); break;
          case 'ttt_join':
            setTttPlayers(prev=>{const n=[...new Set([...prev,msg.payload.userId])];return n;});
            // Assign symbol: first joiner=X, second=O
            setTttSymbol(prev=>prev); // symbol assigned on join send
            break;
          case 'ttt_move':
            setTttBoard(prev=>{const b=[...prev];b[msg.payload.cell]=msg.payload.sym;return b;});
            setTttTurn(prev=>prev==='X'?'O':'X');
            break;
          case 'ttt_reset':
            setTttBoard(Array(9).fill(null));setTttTurn('X');break;
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
    // Wall collision — only allow movement if destination tile is not a wall
    if(isBlocked(nx,ny)) return;
    setMyPos({x:nx,y:ny});
    wsRef.current.send(JSON.stringify({ type:'move', payload:{x:nx,y:ny} }));
  }, [myPos]);

  const sendMusic = (idx: number) => {
    setMusicIdx(idx);
    wsRef.current?.send(JSON.stringify({ type:'music_change', payload:{ idx } }));
  };
  const sendTttMove=(cell:number)=>{
    if(!tttSymbol||tttTurn!==tttSymbol)return;
    const b=[...tttBoard];b[cell]=tttSymbol;
    setTttBoard(b);setTttTurn(t=>t==='X'?'O':'X');
    wsRef.current?.send(JSON.stringify({type:'ttt_move',payload:{cell,sym:tttSymbol}}));
  };
  const sendTttReset=()=>{
    setTttBoard(Array(9).fill(null));setTttTurn('X');
    wsRef.current?.send(JSON.stringify({type:'ttt_reset'}));
  };
  const joinTtt=()=>{
    // Assign X to first, O to second
    const sym=tttPlayers.length===0?'X':'O';
    setTttSymbol(sym);
    setTttPlayers(prev=>[...new Set([...prev,myUserId])]);
    wsRef.current?.send(JSON.stringify({type:'ttt_join',payload:{userId:myUserId,sym}}));
  };
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
          {/* ── 🎵 Music Player ── */}
          <div style={{
            display:'flex',alignItems:'center',gap:8,
            background:'rgba(168,85,247,0.12)',border:'1px solid rgba(168,85,247,0.35)',
            borderRadius:8,padding:'4px 10px',cursor:'default',
          }}>

            <span style={{fontSize:14}}>🎵</span>
            <div style={{display:'flex',flexDirection:'column',lineHeight:1.2}}>
              <span style={{fontSize:11,color:'#e9d5ff',fontWeight:600,maxWidth:120,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{MUSIC_TRACKS[musicIdx].title}</span>
              <span style={{fontSize:9,color:'rgba(168,85,247,0.7)'}}>{MUSIC_TRACKS[musicIdx].artist}</span>
            </div>
            <div style={{display:'flex',gap:3}}>
              <button onClick={()=>sendMusic((musicIdx-1+MUSIC_TRACKS.length)%MUSIC_TRACKS.length)}
                style={{background:'none',border:'none',color:'#c4b5fd',cursor:'pointer',fontSize:13,padding:'2px 4px'}}>⏮</button>
              <button onClick={()=>setMusicOn(p=>!p)}
                style={{background:'rgba(168,85,247,0.25)',border:'1px solid rgba(168,85,247,0.4)',color:'#e9d5ff',cursor:'pointer',fontSize:13,borderRadius:4,padding:'2px 6px'}}>
                {musicOn?'⏸':'▶'}
              </button>
              <button onClick={()=>sendMusic((musicIdx+1)%MUSIC_TRACKS.length)}
                style={{background:'none',border:'none',color:'#c4b5fd',cursor:'pointer',fontSize:13,padding:'2px 4px'}}>⏭</button>
              <button onClick={()=>sendMusic(Math.floor(Math.random()*MUSIC_TRACKS.length))}
                title="Shuffle — changes for everyone!"
                style={{background:'none',border:'none',color:'#a78bfa',cursor:'pointer',fontSize:12,padding:'2px 4px'}}>🔀</button>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onLeave}>← Leave</button>

        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* Canvas */}
        <div
          style={{ flex:1, overflow:'auto', outline:'none', position:'relative' }}
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
          <div style={{ position:'relative', width:WORLD_WIDTH, height:WORLD_HEIGHT }}>
            <canvas
              ref={canvasRef}
              width={WORLD_WIDTH}
              height={WORLD_HEIGHT}
              style={{ display:'block', cursor:'crosshair' }}
            />

            {musicOn && inMusicZone && (
              <div style={{
                position:'absolute',
                left:MUSIC_PANEL_POS.left,
                top:MUSIC_PANEL_POS.top,
                zIndex:3,
                background:'rgba(10,0,22,0.97)',
                border:'1.5px solid rgba(168,85,247,0.55)',
                borderRadius:12,
                overflow:'hidden',
                boxShadow:'0 0 24px rgba(168,85,247,0.35)',
                minWidth:220,
              }}>
                <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',
                  background:'rgba(168,85,247,0.15)',borderBottom:'1px solid rgba(168,85,247,0.25)'}}>
                  <span style={{fontSize:14}}>🎵</span>
                  <div style={{flex:1,overflow:'hidden'}}>
                    <div style={{fontSize:11,color:'#e9d5ff',fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                      {MUSIC_TRACKS[musicIdx].title}
                    </div>
                    <div style={{fontSize:9,color:'rgba(168,85,247,0.7)'}}>{MUSIC_TRACKS[musicIdx].artist}</div>
                  </div>
                  <button
                    onClick={()=>setMusicOn(false)}
                    style={{background:'none',border:'none',color:'#c4b5fd',cursor:'pointer',fontSize:14,lineHeight:1}}
                  >
                    ✕
                  </button>
                </div>
                <iframe
                  key={`yt-${musicIdx}`}
                  width="220"
                  height="124"
                  src={`https://www.youtube.com/embed/${MUSIC_TRACKS[musicIdx].yt}?autoplay=1&loop=1&playlist=${MUSIC_TRACKS[musicIdx].yt}&controls=1&rel=0`}
                  title="Music Player"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  style={{display:'block',border:'none'}}
                />
                <div style={{display:'flex',justifyContent:'center',gap:6,padding:'6px 8px',
                  background:'rgba(168,85,247,0.1)'}}>
                  <button
                    onClick={()=>sendMusic((musicIdx-1+MUSIC_TRACKS.length)%MUSIC_TRACKS.length)}
                    style={{background:'rgba(168,85,247,0.2)',border:'1px solid rgba(168,85,247,0.3)',
                      color:'#c4b5fd',cursor:'pointer',borderRadius:6,padding:'3px 10px',fontSize:14}}
                  >
                    ⏮
                  </button>
                  <button
                    onClick={()=>sendMusic((musicIdx+1)%MUSIC_TRACKS.length)}
                    style={{background:'rgba(168,85,247,0.2)',border:'1px solid rgba(168,85,247,0.3)',
                      color:'#c4b5fd',cursor:'pointer',borderRadius:6,padding:'3px 10px',fontSize:14}}
                  >
                    ⏭
                  </button>
                  <button
                    onClick={()=>sendMusic(Math.floor(Math.random()*MUSIC_TRACKS.length))}
                    title="Shuffle for everyone"
                    style={{background:'rgba(236,72,153,0.15)',border:'1px solid rgba(236,72,153,0.3)',
                      color:'#f9a8d4',cursor:'pointer',borderRadius:6,padding:'3px 10px',fontSize:14}}
                  >
                    🔀
                  </button>
                </div>
              </div>
            )}
          </div>
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


      {/* 🎮 Game Zone Arcade Panel */}
      {inGameZone && !activeGame && (
        <div style={{
          position:'fixed',right:24,top:'50%',transform:'translateY(-50%)',
          background:'rgba(8,0,20,0.97)',border:'1.5px solid rgba(139,92,246,0.5)',
          borderRadius:16,padding:20,width:220,zIndex:9000,
          boxShadow:'0 0 40px rgba(139,92,246,0.3)',
        }}>
          <div style={{textAlign:'center',marginBottom:16}}>
            <div style={{fontSize:20,marginBottom:4}}>🕹️</div>
            <div style={{fontWeight:700,color:'#e9d5ff',fontSize:15}}>Game Arcade</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:2}}>Choose a game</div>
          </div>
          {([
            {id:'slot',icon:'🎰',name:'Slot Machine',desc:'Single player',col:'#fbbf24'},
            {id:'rps', icon:'🎲',name:'Rock Paper Scissors',desc:'vs Computer',col:'#60a5fa'},
            {id:'ttt', icon:'🎯',name:'Tic-Tac-Toe',desc:'2 Player (WS)',col:'#a78bfa'},
          ] as const).map(g=>(
            <button key={g.id} onClick={()=>{setActiveGame(g.id);if(g.id==='ttt')joinTtt();}}
              style={{
                display:'flex',alignItems:'center',gap:10,width:'100%',
                background:'rgba(255,255,255,0.04)',border:`1px solid ${g.col}33`,
                borderRadius:10,padding:'10px 14px',marginBottom:8,cursor:'pointer',
                color:'white',textAlign:'left',transition:'background 0.2s',
              }}>
              <span style={{fontSize:24}}>{g.icon}</span>
              <div><div style={{fontWeight:600,fontSize:13,color:g.col}}>{g.name}</div><div style={{fontSize:10,color:'rgba(255,255,255,0.35)'}}>{g.desc}</div></div>
            </button>
          ))}
        </div>
      )}

      {/* Game modals */}
      {activeGame==='slot' && <SlotMachine onClose={()=>setActiveGame(null)} />}
      {activeGame==='rps'  && <RPS onClose={()=>setActiveGame(null)} />}
      {activeGame==='ttt'  && (
        <TicTacToe
          onClose={()=>setActiveGame(null)}
          board={tttBoard} turn={tttTurn} symbol={tttSymbol}
          onMove={sendTttMove} onReset={sendTttReset}
          otherOnline={tttPlayers.length>=2}
        />
      )}


      <ToastContainer toasts={toasts} />
    </div>
  );
}