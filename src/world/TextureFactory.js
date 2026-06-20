import * as THREE from 'three';

const S = 64; // base texture size

function canvas(size = S) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 0x100000000;
  };
}

function toTex(c, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

// ── Tile textures ────────────────────────────────────────────────────────────

export function grassTex() {
  const c = canvas(S); const ctx = c.getContext('2d');
  ctx.fillStyle = '#4e8240'; ctx.fillRect(0, 0, S, S);
  const r = rng(1);
  for (let i = 0; i < 160; i++) {
    const x = r() * S, y = r() * S, rad = 0.6 + r() * 2.5;
    const v = r();
    ctx.fillStyle = v < 0.35 ? 'rgba(75,130,50,0.5)' : v < 0.65 ? 'rgba(30,55,18,0.4)' : 'rgba(100,170,65,0.3)';
    ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.28); ctx.fill();
  }
  // grass blade strokes
  ctx.strokeStyle = 'rgba(95,155,55,0.5)'; ctx.lineWidth = 0.8;
  for (let i = 0; i < 25; i++) {
    const x = r() * S, y = r() * S;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r()-0.5)*3, y - 3 - r()*4); ctx.stroke();
  }
  return toTex(c);
}

export function dirtTex() {
  const c = canvas(S); const ctx = c.getContext('2d');
  ctx.fillStyle = '#7a5520'; ctx.fillRect(0, 0, S, S);
  const r = rng(2);
  for (let i = 0; i < 220; i++) {
    const x = r() * S, y = r() * S, rad = 0.4 + r() * 2;
    ctx.fillStyle = r() < 0.5 ? 'rgba(110,72,28,0.45)' : 'rgba(48,28,8,0.38)';
    ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.28); ctx.fill();
  }
  return toTex(c);
}

export function stoneTex() {
  const c = canvas(128); const ctx = c.getContext('2d');
  ctx.fillStyle = '#78786e'; ctx.fillRect(0, 0, 128, 128);
  const r = rng(3);
  const rowH = 20;
  for (let row = 0; row * rowH < 128 + rowH; row++) {
    const y = row * rowH;
    const off = row % 2 === 0 ? 0 : 20;
    for (let col = -1; col < 5; col++) {
      const x = col * 40 + off;
      const br = 0.80 + r() * 0.28;
      const g = Math.floor(br * 118); const g2 = Math.floor(br * 116);
      ctx.fillStyle = `rgb(${g},${g},${g2})`;
      ctx.fillRect(x + 2, y + 2, 36, rowH - 3);
      // subtle surface cracks
      if (r() < 0.3) {
        ctx.strokeStyle = `rgba(${g-30},${g-30},${g2-30},0.4)`;
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(x+5, y+5); ctx.lineTo(x+5+r()*20, y+5+r()*8); ctx.stroke();
      }
    }
    // mortar
    ctx.fillStyle = 'rgba(42,40,36,0.75)';
    ctx.fillRect(0, y, 128, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function waterTex() {
  const c = canvas(S); const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, '#153b7a'); g.addColorStop(0.5, '#1e5299'); g.addColorStop(1, '#153b7a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  const r = rng(4);
  ctx.strokeStyle = 'rgba(80,140,230,0.35)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 10; i++) {
    const y = r() * S;
    ctx.beginPath(); ctx.moveTo(0, y);
    for (let x = 0; x <= S; x += 3) ctx.lineTo(x, y + Math.sin(x * 0.25 + i * 1.3) * 2.5);
    ctx.stroke();
  }
  return toTex(c);
}

export function tilledTex() {
  const c = canvas(S); const ctx = c.getContext('2d');
  ctx.fillStyle = '#3a2010'; ctx.fillRect(0, 0, S, S);
  // furrows
  ctx.fillStyle = '#251408';
  for (let y = 0; y < S; y += 8) ctx.fillRect(0, y, S, 2);
  const r = rng(5);
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = 'rgba(90,55,20,0.45)';
    ctx.fillRect(r()*S, r()*S, 1+r()*2, 1+r()*1);
  }
  return toTex(c);
}

export function dangerGrassTex() {
  const c = canvas(S); const ctx = c.getContext('2d');
  ctx.fillStyle = '#252e12'; ctx.fillRect(0, 0, S, S);
  const r = rng(6);
  for (let i = 0; i < 130; i++) {
    ctx.fillStyle = r() < 0.5 ? 'rgba(38,50,18,0.5)' : 'rgba(12,16,6,0.45)';
    ctx.beginPath(); ctx.arc(r()*S, r()*S, 0.5+r()*2, 0, 6.28); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(30,40,15,0.55)'; ctx.lineWidth = 0.7;
  for (let i = 0; i < 18; i++) {
    const x = r()*S, y = r()*S;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+(r()-0.5)*3, y-2-r()*5); ctx.stroke();
  }
  return toTex(c);
}

// ── Building textures ────────────────────────────────────────────────────────

export function woodTex(hex = 0x8B4513) {
  const c = canvas(S); const ctx = c.getContext('2d');
  const col = `#${hex.toString(16).padStart(6,'0')}`;
  ctx.fillStyle = col; ctx.fillRect(0, 0, S, S);
  const r = rng(7 + hex);
  // plank dividers
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < S; y += 14) ctx.fillRect(0, y, S, 1.5);
  // grain lines
  for (let i = 0; i < 22; i++) {
    const y = r() * S;
    ctx.strokeStyle = r() < 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,200,120,0.18)';
    ctx.lineWidth = 0.5 + r();
    ctx.beginPath(); ctx.moveTo(0, y + (r()-0.5)*2);
    ctx.quadraticCurveTo(S/2, y+(r()-0.5)*4, S, y+(r()-0.5)*2); ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}

export function stoneWallTex() {
  const c = canvas(128); const ctx = c.getContext('2d');
  ctx.fillStyle = '#6e6e65'; ctx.fillRect(0, 0, 128, 128);
  const r = rng(8);
  const rowH = 18;
  for (let row = 0; row * rowH < 128 + rowH; row++) {
    const y = row * rowH;
    const off = row % 2 === 0 ? 0 : 24;
    for (let col = -1; col < 4; col++) {
      const x = col * 48 + off;
      const br = 0.78 + r() * 0.30;
      const v = Math.floor(br * 115);
      ctx.fillStyle = `rgb(${v},${v},${Math.floor(v*0.97)})`;
      ctx.fillRect(x + 2, y + 2, 44, rowH - 3);
      if (r() < 0.25) {
        ctx.strokeStyle = `rgba(${v-40},${v-40},${v-40},0.35)`;
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(x+4,y+6); ctx.lineTo(x+4+r()*30,y+6+r()*6); ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(35,33,28,0.7)';
    ctx.fillRect(0, y, 128, 2);
  }
  return new THREE.CanvasTexture(c);
}

export function roofTex() {
  const c = canvas(S); const ctx = c.getContext('2d');
  ctx.fillStyle = '#7a3232'; ctx.fillRect(0, 0, S, S);
  const r = rng(9);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 5; col++) {
      const x = col * 14 + (row % 2) * 7;
      const y = row * 8;
      const br = 0.75 + r() * 0.35;
      ctx.fillStyle = `rgba(${Math.floor(br*150)},${Math.floor(br*45)},${Math.floor(br*45)},1)`;
      ctx.fillRect(x + 1, y + 1, 12, 6);
    }
    ctx.fillStyle = 'rgba(35,10,10,0.55)';
    ctx.fillRect(0, row*8, S, 1);
  }
  return new THREE.CanvasTexture(c);
}

export function chestTex() {
  const c = canvas(S); const ctx = c.getContext('2d');
  ctx.fillStyle = '#7a4820'; ctx.fillRect(0, 0, S, S);
  const r = rng(10);
  // plank lines
  for (let y = 0; y < S; y += 16) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(0, y, S, 2);
  }
  // iron bands
  ctx.fillStyle = '#888'; ctx.fillRect(0, S/2-4, S, 8);
  ctx.fillStyle = '#aaa'; ctx.fillRect(0, S/2-3, S, 2);
  // lock
  ctx.fillStyle = '#ccaa00'; ctx.fillRect(S/2-4, S/2-6, 8, 12); ctx.beginPath();
  ctx.arc(S/2, S/2-2, 3, 0, Math.PI*2); ctx.fillStyle='#ffdd00'; ctx.fill();
  return new THREE.CanvasTexture(c);
}

// Campfire / lantern use emissive, no texture needed
