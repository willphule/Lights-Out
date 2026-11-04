'use strict';
// Each mission's look: palette, wall textures, background props, windows,
// the sky and skyline behind them, weather and dust drifting in the light.
(function (LO) {
  const TS = LO.TS;

  // ------------------------------------------------------------ helpers
  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
  const rgba = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };
  const hash2 = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const seeded = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const hashStr = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  LO.color = { mix, rgba };

  // ------------------------------------------------------------ themes
  LO.THEMES = {
    foundry: {
      back: '#2e1f19', backHi: '#40291e', wall: '#291c16', floor: '#7a5232', floorHi: '#c08448',
      ladder: '#8f6c3e', platform: '#6d4b30', dark: 'rgba(14,6,6,0.9)',
      lamp: '255,160,70', circuit: '150,205,255', pattern: 'plates', windows: 'grimy',
      sky: { top: '#12090b', bottom: '#6a2a14', glow: '255,110,40', skyline: '#170b0a', lit: '255,170,90', chimneys: true },
      guard: { body: '#4b3c2e', dark: '#2b2219', hat: 'hard', hatColor: '#d39b2f' },
      floorProps: ['barrels', 'ingots', 'crucible', 'bench'], wallProps: ['gear', 'sign', 'pipeV'], ceilProps: ['chain'], big: 'furnace',
      ambience: 'foundry', music: { root: 38 },
    },
    pumps: {
      back: '#123230', backHi: '#1b4642', wall: '#18292a', floor: '#41695e', floorHi: '#79ad9e',
      ladder: '#7d907f', platform: '#4c625a', dark: 'rgba(2,10,13,0.9)',
      lamp: '205,255,235', circuit: '110,180,255', pattern: 'tiles', windows: null,
      sky: null,
      guard: { body: '#2d4d4a', dark: '#1a302e', hat: 'cap', hatColor: '#123230' },
      floorProps: ['barrels', 'valveBox', 'barrels'], wallProps: ['gauge', 'valveWheel', 'pipeV'], ceilProps: ['pipeHang'], big: 'pump',
      ambience: 'water', drips: true, music: { root: 36 },
    },
    gala: {
      back: '#3b1220', backHi: '#521c2e', wall: '#28180f', floor: '#704527', floorHi: '#d3a458',
      ladder: '#8f6c3e', platform: '#6d4b30', dark: 'rgba(16,4,10,0.88)',
      lamp: '255,210,135', circuit: '255,228,170', pattern: 'damask', windows: 'arched',
      sky: { top: '#090d22', bottom: '#2d3058', moon: true, stars: true, skyline: '#0c0d1d', lit: '255,214,140' },
      guard: { body: '#1d1d24', dark: '#0f0f14', hat: 'none', tie: '#8a2034' },
      floorProps: ['plant', 'pedestal', 'table'], wallProps: ['painting', 'painting', 'mirror'], ceilProps: [], big: null,
      ambience: 'party', music: { root: 41 },
    },
    prison: {
      back: '#2a2f2d', backHi: '#363d39', wall: '#252927', floor: '#5d625b', floorHi: '#949a91',
      ladder: '#73705e', platform: '#5c5c52', dark: 'rgba(4,7,9,0.9)',
      lamp: '225,245,210', circuit: '235,245,255', pattern: 'concrete', windows: 'barred',
      sky: { top: '#05070b', bottom: '#1c2531', skyline: '#080a0e', lit: '215,225,165', rain: true, lightning: true },
      guard: { body: '#36463a', dark: '#1f2a22', hat: 'peak', hatColor: '#151c17' },
      floorProps: ['bucket', 'bunk', 'crates'], wallProps: ['notice', 'clock', 'notice'], ceilProps: ['chain'], big: null,
      ambience: 'rain', music: { root: 37 },
    },
    power: {
      back: '#141a26', backHi: '#1d2536', wall: '#191e29', floor: '#4b5669', floorHi: '#d6ad2c',
      ladder: '#8f945c', platform: '#5c6272', dark: 'rgba(3,5,14,0.9)',
      lamp: '205,228,255', circuit: '140,215,255', pattern: 'panels', windows: 'wide',
      sky: { top: '#03050d', bottom: '#18234a', moon: true, skyline: '#070a14', lit: '255,218,130', dense: true },
      guard: { body: '#22324c', dark: '#121c2c', hat: 'helmet', hatColor: '#d6ad2c' },
      floorProps: ['transformer', 'console', 'spool'], wallProps: ['warning', 'leds', 'gauge'], ceilProps: ['cables'], big: 'turbine',
      ambience: 'hum', music: { root: 39 },
    },
  };

  // ------------------------------------------------------------ build
  // Distance in tiles from each open tile down to the floor and up to the ceiling.
  function metrics(lvl) {
    const fd = [], cd = [];
    for (let y = 0; y < lvl.h; y++) { fd.push(new Array(lvl.w).fill(0)); cd.push(new Array(lvl.w).fill(0)); }
    for (let x = 0; x < lvl.w; x++) {
      let run = 0;
      for (let y = 0; y < lvl.h; y++) { if (lvl.tile(x, y) === '#') run = 0; else { cd[y][x] = run; run++; } }
      run = 0;
      for (let y = lvl.h - 1; y >= 0; y--) { if (lvl.tile(x, y) === '#') run = 0; else { fd[y][x] = run; run++; } }
    }
    return { fd, cd };
  }

  function inZone(zones, tx, ty) {
    for (const [x0, y0, x1, y1] of zones) if (tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1) return true;
    return false;
  }

  // Back-wall painters, one tile at a time, so patterns tile seamlessly.
  const PAINT = {
    plates(x, th, px, py, tx, ty, fd, cd) {
      const tone = hash2(Math.floor(px / 64), Math.floor(py / 64));
      x.fillStyle = mix(th.back, th.backHi, tone * 0.6); x.fillRect(px, py, TS, TS);
      x.fillStyle = 'rgba(0,0,0,0.35)';
      if (px % 64 === 0) x.fillRect(px, py, 1, TS);
      if (py % 64 === 0) x.fillRect(px, py, TS, 1);
      x.fillStyle = 'rgba(255,200,150,0.05)';
      if (px % 64 === 0) x.fillRect(px + 1, py, 1, TS);
      if (py % 64 === 0) x.fillRect(px, py + 1, TS, 1);
      x.fillStyle = 'rgba(0,0,0,0.3)';
      for (const [rx, ry] of [[5, 5], [27, 5], [5, 27], [27, 27]]) if ((px + rx) % 64 < 8 || (px + rx) % 64 > 56) if ((py + ry) % 64 < 8 || (py + ry) % 64 > 56) { x.fillRect(px + rx - 1, py + ry - 1, 3, 3); }
      if (cd < 2) { x.fillStyle = `rgba(0,0,0,${0.28 - cd * 0.12})`; x.fillRect(px, py, TS, TS); }
      if (fd === 0) { const g = x.createLinearGradient(0, py, 0, py + TS); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,8,0,0.35)'); x.fillStyle = g; x.fillRect(px, py, TS, TS); }
    },
    tiles(x, th, px, py, tx, ty, fd, cd) {
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const sx = px + i * 16, sy = py + j * 16;
        const band = fd === 2 && j === 0;
        x.fillStyle = band ? mix(th.back, '#0a1e2a', 0.5) : mix(th.back, th.backHi, hash2(sx, sy) * 0.7);
        x.fillRect(sx, sy, 16, 16);
        x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(sx, sy, 16, 1); x.fillRect(sx, sy, 1, 16);
        x.fillStyle = 'rgba(255,255,255,0.04)'; x.fillRect(sx + 1, sy + 1, 14, 1);
      }
      if (hash2(tx, 7) > 0.8) { x.fillStyle = 'rgba(30,40,10,0.22)'; x.fillRect(px + 10, py, 4, TS); }
      if (fd === 0) { x.fillStyle = 'rgba(40,40,15,0.3)'; x.fillRect(px, py + 12, TS, 20); }
    },
    damask(x, th, px, py, tx, ty, fd, cd) {
      x.fillStyle = th.back; x.fillRect(px, py, TS, TS);
      x.fillStyle = 'rgba(255,190,200,0.035)';
      x.fillRect(px + 8, py, 8, TS);
      x.strokeStyle = 'rgba(230,170,120,0.09)'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(px + 16, py + 4); x.lineTo(px + 24, py + 16); x.lineTo(px + 16, py + 28); x.lineTo(px + 8, py + 16); x.closePath(); x.stroke();
      x.fillStyle = 'rgba(230,170,120,0.12)'; x.fillRect(px + 15, py + 15, 2, 2);
      if (cd === 0) { x.fillStyle = '#1c0a10'; x.fillRect(px, py, TS, 6); x.fillStyle = '#a5803c'; x.fillRect(px, py + 6, TS, 1); }
      if (fd === 0) {
        x.fillStyle = '#2b160d'; x.fillRect(px, py + 8, TS, 24);
        x.fillStyle = '#3a2013'; x.fillRect(px + 4, py + 13, TS - 8, 14);
        x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(px + 4, py + 13, TS - 8, 1);
        x.fillStyle = '#b48a3e'; x.fillRect(px, py + 8, TS, 2);
      }
    },
    concrete(x, th, px, py, tx, ty, fd, cd) {
      for (let j = 0; j < 2; j++) {
        const sy = py + j * 16, off = (ty * 2 + j) % 2 ? 16 : 0;
        for (let i = -1; i < 2; i++) {
          const sx = px + off + i * 32;
          x.fillStyle = mix(th.back, th.backHi, hash2(Math.floor((sx) / 32) + 99, sy) * 0.8);
          x.fillRect(Math.max(px, sx), sy, Math.min(px + TS, sx + 32) - Math.max(px, sx), 16);
          x.fillStyle = 'rgba(0,0,0,0.35)';
          if (sx >= px && sx < px + TS) x.fillRect(sx, sy, 1, 16);
        }
        x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(px, sy, TS, 1);
      }
      if (fd === 0 || (fd === 1)) {
        const top = fd === 0 ? py : py + 16;
        x.fillStyle = 'rgba(40,72,52,0.55)'; x.fillRect(px, top, TS, py + TS - top);
        if (fd === 1) { x.fillStyle = 'rgba(15,30,20,0.8)'; x.fillRect(px, top, TS, 2); }
      }
      if (hash2(tx, 3) > 0.85 && cd < 3) { x.fillStyle = 'rgba(70,40,15,0.18)'; x.fillRect(px + 12, py, 3, TS * (0.4 + hash2(tx, ty) * 0.6)); }
    },
    panels(x, th, px, py, tx, ty, fd, cd) {
      const tone = hash2(Math.floor(px / 64), Math.floor(py / 32) + 5);
      x.fillStyle = mix(th.back, th.backHi, tone * 0.7); x.fillRect(px, py, TS, TS);
      x.fillStyle = 'rgba(0,0,0,0.4)';
      if (px % 64 === 0) x.fillRect(px, py, 2, TS);
      x.fillRect(px, py, TS, 1);
      x.fillStyle = 'rgba(160,190,255,0.05)'; x.fillRect(px, py + 1, TS, 1); x.fillRect(px, py + 16, TS, 1);
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px, py + 17, TS, 1);
      if (px % 64 === 0) { x.fillStyle = 'rgba(200,210,230,0.18)'; x.fillRect(px + 4, py + 4, 2, 2); x.fillRect(px + 4, py + 24, 2, 2); }
      if (cd === 0) { x.fillStyle = '#0c1018'; x.fillRect(px, py, TS, 7); x.fillStyle = '#2a3242'; x.fillRect(px, py + 7, TS, 1); }
      if (fd === 0) {
        x.save(); x.beginPath(); x.rect(px, py + TS - 7, TS, 7); x.clip();
        x.fillStyle = '#1a1a10'; x.fillRect(px, py + TS - 7, TS, 7);
        x.fillStyle = 'rgba(214,173,44,0.55)';
        for (let i = -8; i < TS + 8; i += 10) { x.beginPath(); x.moveTo(px + i, py + TS); x.lineTo(px + i + 5, py + TS); x.lineTo(px + i + 12, py + TS - 7); x.lineTo(px + i + 7, py + TS - 7); x.fill(); }
        x.restore();
      }
    },
  };

  function paintSolid(x, th, lvl, tx, ty, px, py) {
    const open = (dx, dy) => lvl.tile(tx + dx, ty + dy) !== '#';
    const deep = !open(0, -1) && !open(0, 1) && !open(-1, 0) && !open(1, 0);
    x.fillStyle = mix(th.wall, '#000000', deep ? 0.35 : 0.1 * hash2(tx, ty)); x.fillRect(px, py, TS, TS);
    for (let i = 0; i < 4; i++) {
      x.fillStyle = hash2(tx * 5 + i, ty) > 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.12)';
      x.fillRect(px + hash2(tx + i, ty * 3) * 28, py + hash2(tx, ty + i * 7) * 28, 4, 2);
    }
    if (open(0, -1)) {
      x.fillStyle = th.floor; x.fillRect(px, py, TS, 6);
      x.fillStyle = th.floorHi; x.fillRect(px, py, TS, 1.5);
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(px, py + 6, TS, 2);
      if (th.pattern === 'damask') { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px + (tx % 2 ? 8 : 24), py + 1.5, 1, 4.5); }
    }
    if (open(0, 1)) { x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(px, py + TS - 4, TS, 4); }
    if (open(-1, 0)) { x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(px, py, 2, TS); }
    if (open(1, 0)) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(px + TS - 2, py, 2, TS); }
  }

  // ------------------------------------------------------------ props
  // Background props are drawn darker than walls so they never read as obstacles.
  function propColors(th) {
    return { dk: mix(th.back, '#000000', 0.55), md: mix(th.back, '#000000', 0.3), lt: mix(th.back, '#ffffff', 0.1), hi: mix(th.backHi, '#ffffff', 0.18) };
  }
  const PROPS = {
    barrels(x, c, px, fy, r) {
      const n = 1 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) {
        const bx = px + i * 18;
        x.fillStyle = c.md; x.fillRect(bx + 2, fy - 26, 16, 26);
        x.fillStyle = c.dk; x.fillRect(bx + 2, fy - 20, 16, 2); x.fillRect(bx + 2, fy - 8, 16, 2);
        x.fillStyle = c.lt; x.fillRect(bx + 4, fy - 25, 2, 24);
      }
      return n * 18 + 4;
    },
    ingots(x, c, px, fy) {
      for (let row = 0; row < 3; row++) for (let i = 0; i < 3 - row; i++) {
        x.fillStyle = row % 2 ? c.lt : c.md; x.fillRect(px + 4 + i * 10 + row * 5, fy - 6 - row * 6, 9, 6);
      }
      return 40;
    },
    crucible(x, c, px, fy) {
      x.fillStyle = c.md; x.beginPath(); x.moveTo(px + 4, fy - 30); x.lineTo(px + 36, fy - 30); x.lineTo(px + 30, fy - 4); x.lineTo(px + 10, fy - 4); x.fill();
      x.fillStyle = c.dk; x.fillRect(px + 2, fy - 33, 36, 4); x.fillRect(px + 12, fy - 4, 4, 4); x.fillRect(px + 24, fy - 4, 4, 4);
      return 44;
    },
    bench(x, c, px, fy) {
      x.fillStyle = c.md; x.fillRect(px, fy - 20, 48, 4); x.fillRect(px + 3, fy - 16, 3, 16); x.fillRect(px + 42, fy - 16, 3, 16);
      x.fillStyle = c.lt; x.fillRect(px + 8, fy - 26, 10, 6); x.fillRect(px + 30, fy - 24, 4, 4);
      return 52;
    },
    valveBox(x, c, px, fy) {
      x.fillStyle = c.md; x.fillRect(px + 2, fy - 22, 26, 22);
      x.strokeStyle = c.lt; x.lineWidth = 2; x.beginPath(); x.arc(px + 15, fy - 11, 6, 0, Math.PI * 2); x.stroke();
      return 32;
    },
    plant(x, c, px, fy, r) {
      x.fillStyle = c.md; x.fillRect(px + 8, fy - 14, 14, 14);
      x.strokeStyle = mix(c.md, '#1a3a20', 0.5); x.lineWidth = 3;
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.45; x.beginPath(); x.moveTo(px + 15, fy - 14); x.quadraticCurveTo(px + 15 + Math.cos(a) * 10, fy - 30, px + 15 + Math.cos(a) * 20, fy - 22 - r() * 16); x.stroke(); }
      return 34;
    },
    pedestal(x, c, px, fy) {
      x.fillStyle = c.md; x.fillRect(px + 8, fy - 30, 14, 30); x.fillRect(px + 5, fy - 32, 20, 4);
      x.fillStyle = c.lt; x.beginPath(); x.arc(px + 15, fy - 41, 7, 0, Math.PI * 2); x.fill(); x.fillRect(px + 10, fy - 35, 10, 4);
      return 32;
    },
    table(x, c, px, fy) {
      x.fillStyle = c.md; x.fillRect(px + 2, fy - 22, 34, 4); x.fillRect(px + 5, fy - 18, 3, 18); x.fillRect(px + 30, fy - 18, 3, 18);
      x.fillStyle = c.lt; x.fillRect(px + 15, fy - 34, 8, 12); x.fillRect(px + 13, fy - 36, 12, 2);
      return 40;
    },
    bucket(x, c, px, fy) {
      x.fillStyle = c.md; x.beginPath(); x.moveTo(px + 6, fy - 14); x.lineTo(px + 20, fy - 14); x.lineTo(px + 18, fy); x.lineTo(px + 8, fy); x.fill();
      x.strokeStyle = c.lt; x.lineWidth = 1; x.beginPath(); x.arc(px + 13, fy - 14, 7, Math.PI, 0); x.stroke();
      return 26;
    },
    bunk(x, c, px, fy) {
      x.fillStyle = c.md; x.fillRect(px, fy - 40, 3, 40); x.fillRect(px + 45, fy - 40, 3, 40);
      x.fillRect(px, fy - 14, 48, 5); x.fillRect(px, fy - 36, 48, 5);
      x.fillStyle = c.lt; x.fillRect(px + 4, fy - 18, 40, 4); x.fillRect(px + 4, fy - 40, 40, 4);
      return 54;
    },
    crates(x, c, px, fy, r) {
      x.fillStyle = c.md; x.fillRect(px + 2, fy - 22, 24, 22);
      x.strokeStyle = c.dk; x.lineWidth = 2; x.strokeRect(px + 3, fy - 21, 22, 20);
      if (r() > 0.5) { x.fillStyle = c.lt; x.fillRect(px + 8, fy - 36, 16, 14); }
      return 30;
    },
    transformer(x, c, px, fy) {
      x.fillStyle = c.md; x.fillRect(px + 4, fy - 34, 34, 34);
      x.fillStyle = c.dk; for (let i = 0; i < 5; i++) x.fillRect(px + 7 + i * 6, fy - 30, 3, 26);
      x.fillStyle = c.lt; x.fillRect(px + 10, fy - 42, 4, 8); x.fillRect(px + 28, fy - 42, 4, 8);
      return 44;
    },
    console(x, c, px, fy) {
      x.fillStyle = c.md; x.beginPath(); x.moveTo(px + 2, fy); x.lineTo(px + 2, fy - 22); x.lineTo(px + 10, fy - 32); x.lineTo(px + 40, fy - 32); x.lineTo(px + 40, fy); x.fill();
      x.fillStyle = c.dk; x.fillRect(px + 12, fy - 28, 24, 6);
      return 44;
    },
    spool(x, c, px, fy) {
      x.fillStyle = c.md; x.beginPath(); x.arc(px + 16, fy - 14, 14, 0, Math.PI * 2); x.fill();
      x.fillStyle = c.dk; x.beginPath(); x.arc(px + 16, fy - 14, 5, 0, Math.PI * 2); x.fill();
      return 34;
    },
    // wall props: (x, c, px, py) with py the top of a 1x1 wall tile area
    gear(x, c, px, py) {
      const cx = px + 16, cy = py + 16;
      x.fillStyle = c.md;
      for (let i = 0; i < 10; i++) { x.save(); x.translate(cx, cy); x.rotate((i / 10) * Math.PI * 2); x.fillRect(-3, -19, 6, 6); x.restore(); }
      x.beginPath(); x.arc(cx, cy, 14, 0, Math.PI * 2); x.fill();
      x.fillStyle = c.dk; x.beginPath(); x.arc(cx, cy, 5, 0, Math.PI * 2); x.fill();
    },
    sign(x, c, px, py, r, th) {
      x.fillStyle = mix(th.back, '#d6a030', 0.35); x.fillRect(px + 2, py + 8, 28, 14);
      x.fillStyle = c.dk; x.fillRect(px + 5, py + 12, 16, 2); x.fillRect(px + 5, py + 16, 10, 2);
    },
    pipeV(x, c, px, py) {
      x.fillStyle = c.md; x.fillRect(px + 12, py - 64, 8, 96);
      x.fillStyle = c.lt; x.fillRect(px + 13, py - 64, 2, 96);
      x.fillStyle = c.dk; x.fillRect(px + 10, py + 4, 12, 4); x.fillRect(px + 10, py - 40, 12, 4);
    },
    gauge(x, c, px, py) {
      x.fillStyle = c.dk; x.beginPath(); x.arc(px + 16, py + 16, 9, 0, Math.PI * 2); x.fill();
      x.fillStyle = c.lt; x.beginPath(); x.arc(px + 16, py + 16, 7, 0, Math.PI * 2); x.fill();
      x.strokeStyle = c.dk; x.lineWidth = 1.5; x.beginPath(); x.moveTo(px + 16, py + 16); x.lineTo(px + 20, py + 11); x.stroke();
      x.fillStyle = c.md; x.fillRect(px + 14, py + 25, 4, 10);
    },
    valveWheel(x, c, px, py) {
      x.fillStyle = c.md; x.fillRect(px, py + 14, TS, 6);
      x.strokeStyle = c.lt; x.lineWidth = 2; x.beginPath(); x.arc(px + 16, py + 17, 8, 0, Math.PI * 2); x.stroke();
      x.beginPath(); x.moveTo(px + 8, py + 17); x.lineTo(px + 24, py + 17); x.moveTo(px + 16, py + 9); x.lineTo(px + 16, py + 25); x.stroke();
    },
    painting(x, c, px, py, r) {
      const w = 26, h = 30, x0 = px + 3, y0 = py - 8;
      x.fillStyle = '#7a5a24'; x.fillRect(x0 - 3, y0 - 3, w + 6, h + 6);
      x.fillStyle = '#c9a050'; x.fillRect(x0 - 3, y0 - 3, w + 6, 1);
      const g = x.createLinearGradient(0, y0, 0, y0 + h);
      const sky = ['#2a3550', '#4a2a30', '#203a30'][Math.floor(r() * 3)];
      g.addColorStop(0, sky); g.addColorStop(1, '#120a08'); x.fillStyle = g; x.fillRect(x0, y0, w, h);
      x.fillStyle = 'rgba(0,0,0,0.5)';
      if (r() > 0.5) { x.beginPath(); x.arc(x0 + w / 2, y0 + 13, 6, 0, Math.PI * 2); x.fill(); x.fillRect(x0 + 6, y0 + 18, w - 12, 12); }
      else { x.beginPath(); x.moveTo(x0, y0 + h); x.lineTo(x0 + 9, y0 + 14); x.lineTo(x0 + 16, y0 + 20); x.lineTo(x0 + w, y0 + 10); x.lineTo(x0 + w, y0 + h); x.fill(); }
    },
    mirror(x, c, px, py) {
      x.fillStyle = '#7a5a24'; x.beginPath(); x.ellipse(px + 16, py + 6, 11, 16, 0, 0, Math.PI * 2); x.fill();
      const g = x.createLinearGradient(px + 6, py - 8, px + 26, py + 20); g.addColorStop(0, '#5a6680'); g.addColorStop(1, '#1a1e2c');
      x.fillStyle = g; x.beginPath(); x.ellipse(px + 16, py + 6, 8, 13, 0, 0, Math.PI * 2); x.fill();
    },
    notice(x, c, px, py, r) {
      x.fillStyle = mix('#d8d0b0', '#000000', 0.55); x.save(); x.translate(px + 16, py + 14); x.rotate((r() - 0.5) * 0.2); x.fillRect(-9, -11, 18, 22);
      x.fillStyle = 'rgba(0,0,0,0.4)'; for (let i = 0; i < 4; i++) x.fillRect(-6, -7 + i * 4, 12 - (i % 2) * 4, 1.5);
      x.fillStyle = '#5a1a1a'; x.fillRect(-1, -12, 2, 2); x.restore();
    },
    clock(x, c, px, py) {
      x.fillStyle = c.dk; x.beginPath(); x.arc(px + 16, py + 12, 11, 0, Math.PI * 2); x.fill();
      x.fillStyle = mix('#d8d0b0', '#000000', 0.5); x.beginPath(); x.arc(px + 16, py + 12, 9, 0, Math.PI * 2); x.fill();
      x.strokeStyle = c.dk; x.lineWidth = 1.5; x.beginPath(); x.moveTo(px + 16, py + 12); x.lineTo(px + 16, py + 6); x.moveTo(px + 16, py + 12); x.lineTo(px + 20, py + 14); x.stroke();
    },
    warning(x, c, px, py) {
      x.fillStyle = mix('#d6ad2c', '#000000', 0.35); x.beginPath(); x.moveTo(px + 16, py + 2); x.lineTo(px + 29, py + 25); x.lineTo(px + 3, py + 25); x.fill();
      x.fillStyle = '#111'; x.fillRect(px + 15, py + 9, 2, 9); x.fillRect(px + 15, py + 20, 2, 2);
    },
    leds(x, c, px, py, r, th, dyn) {
      x.fillStyle = c.dk; x.fillRect(px + 2, py + 2, 28, 26);
      x.fillStyle = c.md; x.fillRect(px + 4, py + 4, 24, 8);
      dyn.push({ type: 'leds', x: px + 6, y: py + 16, n: 5, seed: r() * 100 });
    },
    // ceiling props: hang down from the ceiling tile
    chain(x, c, px, py, r) {
      const len = 20 + r() * 34;
      x.strokeStyle = c.lt; x.lineWidth = 2;
      for (let y = 0; y < len; y += 6) { x.beginPath(); x.ellipse(px + 16, py + y + 3, 2, 3, 0, 0, Math.PI * 2); x.stroke(); }
      x.beginPath(); x.arc(px + 16, py + len + 6, 5, -0.3, Math.PI); x.stroke();
    },
    pipeHang(x, c, px, py) {
      x.fillStyle = c.md; x.fillRect(px - 16, py + 4, TS * 3, 8);
      x.fillStyle = c.lt; x.fillRect(px - 16, py + 5, TS * 3, 2);
      x.fillStyle = c.dk; x.fillRect(px, py, 3, 6); x.fillRect(px + 48, py, 3, 6);
    },
    cables(x, c, px, py, r) {
      x.strokeStyle = c.dk; x.lineWidth = 2;
      for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(px - 16, py + 2 + i * 2); x.quadraticCurveTo(px + 32, py + 18 + i * 4 + r() * 8, px + 80, py + 2 + i * 2); x.stroke(); }
    },
  };

  // One large machine in the background of a tall, wide room.
  const BIG = {
    furnace(x, c, cx, fy, w, h, dyn, th) {
      const bw = Math.min(w * 0.45, 260), bh = Math.min(h * 0.75, 240);
      x.fillStyle = c.dk; x.beginPath(); x.moveTo(cx - bw / 2, fy); x.lineTo(cx - bw / 2 + 20, fy - bh); x.lineTo(cx + bw / 2 - 20, fy - bh); x.lineTo(cx + bw / 2, fy); x.fill();
      x.fillRect(cx - 18, fy - bh - 80, 36, 80);
      x.fillStyle = c.md; x.fillRect(cx - bw / 2 + 24, fy - bh * 0.55, bw - 48, 6);
      const mw = bw * 0.36, mh = bh * 0.24;
      x.fillStyle = '#1a0805'; x.fillRect(cx - mw / 2, fy - mh - 12, mw, mh);
      dyn.push({ type: 'furnace', x: cx - mw / 2, y: fy - mh - 12, w: mw, h: mh, col: th.lamp });
    },
    pump(x, c, cx, fy, w, h) {
      const bw = Math.min(w * 0.3, 200), bh = Math.min(h * 0.7, 230);
      x.fillStyle = c.dk; x.fillRect(cx - bw / 2, fy - bh, bw, bh);
      x.fillStyle = c.md; for (let i = 0; i < 4; i++) x.fillRect(cx - bw / 2 - 6, fy - bh + 20 + i * (bh / 4), bw + 12, 8);
      x.beginPath(); x.arc(cx, fy - bh, bw / 2, Math.PI, 0); x.fill();
      x.fillRect(cx - 10, fy - bh - bw / 2 - 100, 20, 100);
    },
    turbine(x, c, cx, fy, w, h, dyn) {
      const r = Math.min(h * 0.38, 120);
      const cy = fy - r - 20;
      x.fillStyle = c.dk; x.fillRect(cx - r * 1.8, cy - r * 0.55, r * 3.6, r * 1.1);
      x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
      x.fillStyle = c.md; x.beginPath(); x.arc(cx, cy, r * 0.8, 0, Math.PI * 2); x.fill();
      x.fillStyle = c.dk; x.beginPath(); x.arc(cx, cy, r * 0.2, 0, Math.PI * 2); x.fill();
      x.fillRect(cx - r * 0.6, fy - 20, r * 1.2, 20);
      dyn.push({ type: 'turbine', x: cx, y: cy, r: r * 0.75 });
    },
  };

  // ------------------------------------------------------------ windows
  function drawWindow(x, style, px, py, w, h, th) {
    if (style === 'arched') {
      x.save();
      x.beginPath(); x.moveTo(px + 4, py + h); x.lineTo(px + 4, py + 18); x.arc(px + w / 2, py + 18, w / 2 - 4, Math.PI, 0); x.lineTo(px + w - 4, py + h); x.closePath();
      x.globalCompositeOperation = 'destination-out'; x.fill(); x.restore();
      x.strokeStyle = '#b48a3e'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(px + 4, py + h); x.lineTo(px + 4, py + 18); x.arc(px + w / 2, py + 18, w / 2 - 4, Math.PI, 0); x.lineTo(px + w - 4, py + h); x.stroke();
      x.lineWidth = 2; x.strokeStyle = '#5a4020';
      x.beginPath(); x.moveTo(px + w / 2, py + 6); x.lineTo(px + w / 2, py + h); x.moveTo(px + 4, py + h * 0.55); x.lineTo(px + w - 4, py + h * 0.55); x.stroke();
      x.fillStyle = '#6a1a2c';
      for (const sx of [px - 6, px + w - 4]) { x.beginPath(); x.moveTo(sx, py - 4); x.lineTo(sx + 10, py - 4); x.quadraticCurveTo(sx + 12, py + h * 0.6, sx + 8, py + h + 4); x.lineTo(sx - 2, py + h + 4); x.fill(); }
      x.fillStyle = '#4a1020'; x.fillRect(px - 8, py - 8, w + 16, 6);
      x.fillStyle = '#2a160d'; x.fillRect(px, py + h, w, 5);
      return;
    }
    x.clearRect(px + 3, py + 3, w - 6, h - 6);
    if (style === 'grimy') {
      x.fillStyle = 'rgba(70,30,12,0.45)'; x.fillRect(px + 3, py + 3, w - 6, h - 6);
      x.fillStyle = mix(th.wall, '#000000', 0.2);
      x.fillRect(px, py, w, 3); x.fillRect(px, py + h - 3, w, 3); x.fillRect(px, py, 3, h); x.fillRect(px + w - 3, py, 3, h);
      for (let i = 1; i < 3; i++) x.fillRect(px + (w * i) / 3 - 1, py, 2, h);
      x.fillRect(px, py + h / 2 - 1, w, 2);
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(px + 8, py + 6, 10, 6); x.fillRect(px + w - 20, py + h - 16, 12, 8);
    } else if (style === 'barred') {
      x.fillStyle = mix(th.wall, '#000000', 0.3);
      x.fillRect(px, py, w, 3); x.fillRect(px, py + h - 3, w, 3); x.fillRect(px, py, 3, h); x.fillRect(px + w - 3, py, 3, h);
      x.fillStyle = '#3a3c3a'; for (let i = 8; i < w - 4; i += 8) x.fillRect(px + i, py, 3, h);
      x.fillRect(px, py + h / 2, w, 2);
    } else if (style === 'wide') {
      x.fillStyle = '#2a3142';
      x.fillRect(px, py, w, 3); x.fillRect(px, py + h - 3, w, 3); x.fillRect(px, py, 3, h); x.fillRect(px + w - 3, py, 3, h);
      for (let i = 1; i < 3; i++) x.fillRect(px + (w * i) / 3 - 1, py, 2, h);
      x.fillStyle = 'rgba(160,190,255,0.06)';
      x.beginPath(); x.moveTo(px + 10, py + h - 4); x.lineTo(px + 26, py + 4); x.lineTo(px + 34, py + 4); x.lineTo(px + 18, py + h - 4); x.fill();
    }
  }

  // ------------------------------------------------------------ static build
  LO.Scenery = {
    build(game) {
      const lvl = game.level, def = game.def;
      const th = LO.THEMES[def.theme] || LO.THEMES.foundry;
      game.theme = th;
      const zones = def.outdoor || [];
      const { fd, cd } = metrics(lvl);
      const c = document.createElement('canvas');
      c.width = lvl.pw; c.height = lvl.ph;
      const x = c.getContext('2d');
      const rnd = seeded(hashStr(def.id || 'x'));
      const dyn = [];
      const paint = PAINT[th.pattern];

      // back wall
      for (let ty = 0; ty < lvl.h; ty++) for (let tx = 0; tx < lvl.w; tx++) {
        if (lvl.tile(tx, ty) === '#') continue;
        if (inZone(zones, tx, ty)) continue; // open sky
        paint(x, th, tx * TS, ty * TS, tx, ty, fd[ty][tx], cd[ty][tx]);
      }

      // what must stay clear of background clutter
      const busy = new Set();
      const mark = (tx, ty) => busy.add(tx + ',' + ty);
      for (const m of lvl.markers) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) mark(m.x + dx, m.y + dy);
      for (let ty = 0; ty < lvl.h; ty++) for (let tx = 0; tx < lvl.w; tx++) {
        const t = lvl.tile(tx, ty);
        if ('HDVG%~-'.includes(t)) { mark(tx, ty); mark(tx - 1, ty); mark(tx + 1, ty); }
      }
      const free = (tx, ty) => !busy.has(tx + ',' + ty) && lvl.tile(tx, ty) === ' ';

      // outdoor zones: chain-link fence in front of the sky
      for (const [x0, y0, x1, y1] of zones) {
        const fx0 = x0 * TS, fx1 = (x1 + 1) * TS;
        for (let tx = x0; tx <= x1; tx++) {
          let fy = y1;
          while (fy < lvl.h && lvl.tile(tx, fy + 1) !== '#') fy++;
          const floorY = (fy + 1) * TS, top = floorY - 70;
          x.save(); x.beginPath(); x.rect(tx * TS, top, TS, 70); x.clip();
          x.strokeStyle = 'rgba(120,130,125,0.35)'; x.lineWidth = 1;
          for (let i = -80; i < 120; i += 9) {
            x.beginPath(); x.moveTo(tx * TS + i, top); x.lineTo(tx * TS + i + 70, floorY); x.stroke();
            x.beginPath(); x.moveTo(tx * TS + i + 70, top); x.lineTo(tx * TS + i, floorY); x.stroke();
          }
          x.restore();
          if (tx % 4 === 0) { x.fillStyle = '#3a3e3c'; x.fillRect(tx * TS + 14, top - 8, 4, 78); }
          x.fillStyle = '#4a4e4c'; x.fillRect(tx * TS, top - 2, TS, 2);
          x.strokeStyle = '#4a4e4c'; x.beginPath();
          for (let i = 0; i < TS; i += 6) { x.moveTo(tx * TS + i, top - 6); x.lineTo(tx * TS + i + 3, top - 2); x.lineTo(tx * TS + i + 6, top - 6); }
          x.stroke();
        }
        void fx0; void fx1;
      }

      // windows
      const windows = [];
      if (th.windows) {
        const ww = th.windows === 'wide' ? 3 : th.windows === 'barred' ? 2 : 2;
        const wh = th.windows === 'arched' ? 3 : 2;
        const lastByRow = {};
        for (let ty = 1; ty < lvl.h - 1; ty++) for (let tx = 1; tx < lvl.w - ww; tx++) {
          if (cd[ty][tx] !== (th.windows === 'arched' ? 0 : 1) || lvl.tile(tx, ty) !== ' ') continue;
          if (fd[ty][tx] < wh + (th.windows === 'arched' ? 1 : 1)) continue;
          if (inZone(zones, tx, ty)) continue;
          if (tx - (lastByRow[ty] ?? -99) < 8) continue;
          let ok = true;
          for (let i = -1; i <= ww; i++) for (let j = 0; j < wh; j++) if (!free(tx + i, ty + j) || cd[ty + j][tx + i] !== cd[ty][tx] + j) ok = false;
          if (!ok || rnd() < 0.25) continue;
          lastByRow[ty] = tx;
          const px = tx * TS + 2, py = ty * TS + (th.windows === 'arched' ? 10 : 4), w = ww * TS - 4, h = wh * TS - (th.windows === 'arched' ? 14 : 8);
          drawWindow(x, th.windows, px, py, w, h, th);
          windows.push({ x: px, y: py, w, h });
          for (let i = -1; i <= ww; i++) for (let j = -1; j <= wh; j++) mark(tx + i, ty + j);
        }
      }

      // one big machine in the background of tall, wide rooms
      if (th.big) {
        for (let ty = 0; ty < lvl.h; ty++) {
          let run = 0;
          for (let tx = 0; tx <= lvl.w; tx++) {
            const isFloor = tx < lvl.w && lvl.tile(tx, ty) !== '#' && lvl.tile(tx, ty + 1) === '#' && cd[ty][tx] >= 6;
            if (isFloor) { run++; continue; }
            if (run >= 12) {
              const cx = (tx - run / 2) * TS, h = (cd[ty][tx - Math.ceil(run / 2)] + 1) * TS;
              BIG[th.big](x, propColors(th), cx, (ty + 1) * TS, run * TS, h, dyn, th);
            }
            run = 0;
          }
        }
      }

      // small props
      const cols = propColors(th);
      for (let ty = 0; ty < lvl.h - 1; ty++) {
        let next = 0;
        for (let tx = 1; tx < lvl.w - 1; tx++) {
          const f = fd[ty][tx], cdist = cd[ty][tx];
          if (lvl.tile(tx, ty) !== ' ') continue;
          const px = tx * TS, py = ty * TS;
          if (f === 0 && tx >= next && free(tx, ty) && free(tx + 1, ty) && lvl.tile(tx, ty + 1) === '#' && rnd() < 0.2) {
            const fn = PROPS[th.floorProps[Math.floor(rnd() * th.floorProps.length)]];
            const w = fn(x, cols, px, py + TS, rnd, th, dyn);
            next = tx + Math.ceil(w / TS) + 2;
          } else if (f >= 1 && f <= 2 && cdist >= 1 && free(tx, ty) && rnd() < 0.05 && th.wallProps.length) {
            PROPS[th.wallProps[Math.floor(rnd() * th.wallProps.length)]](x, cols, px, py, rnd, th, dyn);
            mark(tx, ty);
          } else if (cdist === 0 && f >= 3 && free(tx, ty) && th.ceilProps.length && rnd() < 0.06) {
            PROPS[th.ceilProps[Math.floor(rnd() * th.ceilProps.length)]](x, cols, px, py, rnd, th, dyn);
          }
        }
      }

      // special tiles
      for (let ty = 0; ty < lvl.h; ty++) for (let tx = 0; tx < lvl.w; tx++) {
        const t = lvl.tile(tx, ty), px = tx * TS, py = ty * TS;
        if (t === 'V') {
          x.fillStyle = '#08090d'; x.fillRect(px, py, TS, TS);
          x.fillStyle = mix(th.wall, '#000000', 0.2); for (let i = 3; i < TS; i += 6) x.fillRect(px, py + i, TS, 2);
          x.fillStyle = mix(th.wall, '#ffffff', 0.1); x.fillRect(px, py, TS, 2); x.fillRect(px, py + TS - 2, TS, 2);
        } else if (t === '%') {
          x.fillStyle = '#0c0e14'; x.fillRect(px, py, TS, TS);
          x.fillStyle = '#4b5266'; for (let i = 3; i < TS; i += 7) x.fillRect(px + i, py, 2, TS);
          x.fillRect(px, py + 2, TS, 2); x.fillRect(px, py + TS - 4, TS, 2);
        } else if (t === '-') {
          x.fillStyle = th.platform; x.fillRect(px, py, TS, 6);
          x.fillStyle = mix(th.platform, '#ffffff', 0.25); x.fillRect(px, py, TS, 1.5);
          x.fillStyle = 'rgba(0,0,0,0.4)'; for (let i = 4; i < TS; i += 8) x.fillRect(px + i, py + 2, 4, 2);
          x.fillStyle = mix(th.platform, '#000000', 0.4); x.fillRect(px + 4, py + 6, 3, 7); x.fillRect(px + 25, py + 6, 3, 7);
        } else if (t === 'H') {
          x.fillStyle = mix(th.ladder, '#000000', 0.25); x.fillRect(px + 7, py, 3, TS); x.fillRect(px + 22, py, 3, TS);
          x.fillStyle = th.ladder; for (let i = 4; i < TS; i += 9) x.fillRect(px + 7, py + i, 18, 3);
          x.fillStyle = mix(th.ladder, '#ffffff', 0.2); x.fillRect(px + 7, py, 1, TS);
        } else if (t === 'D') {
          x.fillStyle = '#10161e'; x.fillRect(px + 4, py, 24, TS);
          x.fillStyle = '#3e6c8e'; for (let i = 6; i < 28; i += 6) x.fillRect(px + i, py, 2, TS);
          x.fillRect(px + 2, py, 3, TS); x.fillRect(px + 27, py, 3, TS);
          if (lvl.tile(tx, ty - 1) !== 'D') { x.fillStyle = '#d6ad2c'; x.fillRect(px + 4, py - 8, 24, 7); x.fillStyle = '#111'; x.font = 'bold 6px monospace'; x.textAlign = 'center'; x.fillText('STAFF', px + 16, py - 2.5); }
        }
      }

      // solid walls and floors on top of everything
      for (let ty = 0; ty < lvl.h; ty++) for (let tx = 0; tx < lvl.w; tx++) {
        if (lvl.tile(tx, ty) === '#') paintSolid(x, th, lvl, tx, ty, tx * TS, ty * TS);
      }

      // drips from the ceiling (pump station)
      const drips = [];
      if (th.drips) {
        for (let ty = 1; ty < lvl.h; ty++) for (let tx = 1; tx < lvl.w - 1; tx++) {
          if (lvl.tile(tx, ty) === ' ' && cd[ty][tx] === 0 && fd[ty][tx] >= 2 && rnd() < 0.05)
            drips.push({ x: tx * TS + 8 + rnd() * 16, top: ty * TS, bottom: (ty + fd[ty][tx] + 1) * TS, t: rnd() * 3, y: null });
        }
      }

      game.staticCanvas = c;
      game.windows = windows;
      game.decor = dyn;
      game.drips = drips;
      game.motes = [];
      game.rain = [];
      game.zones = zones;
      game.lightning = 0;
      game.lightningT = 6 + Math.random() * 6;
      this.buildSky(game);
    },

    // Distant skyline, built once per mission with its lit windows on their own layer.
    buildSky(game) {
      const th = game.theme;
      if (!th.sky) { game.sky = null; return; }
      const s = th.sky;
      const rnd = seeded(hashStr((game.def.id || '') + 'sky'));
      const W = Math.ceil(LO.VIEW_W + Math.max(0, game.level.pw - LO.VIEW_W) * 0.3 + 120), H = 380;
      const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
      const far = mk(), near = mk(), lit = mk();
      const fx = far.getContext('2d'), nx = near.getContext('2d'), lx = lit.getContext('2d');
      fx.fillStyle = mix(s.skyline, s.bottom, 0.45);
      for (let x = 0; x < W;) { const w = 30 + rnd() * 60, h = 90 + rnd() * 150; fx.fillRect(x, H - h, w, h); x += w + rnd() * 6; }
      nx.fillStyle = s.skyline;
      for (let x = 0; x < W;) {
        const w = 40 + rnd() * 90, h = (s.dense ? 140 : 70) + rnd() * (s.dense ? 220 : 160);
        nx.fillRect(x, H - h, w, h);
        if (rnd() < 0.2) { nx.fillRect(x + w / 2 - 3, H - h - 30, 6, 30); }
        if (s.chimneys && rnd() < 0.35) { nx.fillRect(x + w * 0.3, H - h - 70, 12, 70); }
        for (let wy = H - h + 10; wy < H - 8; wy += 12) for (let wx = x + 6; wx < x + w - 6; wx += 9) {
          if (rnd() < (s.dense ? 0.45 : 0.25)) { lx.fillStyle = `rgba(${s.lit},${0.5 + rnd() * 0.5})`; lx.fillRect(wx, wy, 4, 5); }
        }
        x += w + rnd() * 8;
      }
      const stars = [];
      if (s.stars) for (let i = 0; i < 70; i++) stars.push([rnd() * LO.VIEW_W, rnd() * LO.VIEW_H * 0.6, rnd()]);
      const chimneys = [];
      if (s.chimneys) for (let i = 0; i < 6; i++) chimneys.push(rnd() * W);
      game.sky = { far, near, lit, W, H, stars, chimneys, cityLit: 1, rainDrops: [] };
      if (s.rain) for (let i = 0; i < 140; i++) game.sky.rainDrops.push([Math.random() * LO.VIEW_W, Math.random() * LO.VIEW_H, 0.6 + Math.random() * 0.6]);
    },

    update(game, dt) {
      const th = game.theme;
      // dust motes inside lamp light
      const motes = game.motes;
      for (const m of motes) { m.t += dt; m.x += m.vx * dt; m.y += m.vy * dt; m.vx += Math.sin(m.t * 1.3 + m.seed) * 2 * dt; }
      game.motes = motes.filter((m) => m.t < m.life && m.lamp.on);
      const cam = game.cam;
      for (const l of game.lamps) {
        if (!l.on || l.spot) continue;
        if (l.x < cam.x - 100 || l.x > cam.x + LO.VIEW_W + 100 || l.y < cam.y - 300 || l.y > cam.y + LO.VIEW_H + 100) continue;
        if (Math.random() < dt * 8 && game.motes.length < 160) {
          const a = Math.PI / 2 + (Math.random() - 0.5) * l.cone * 1.6, d = 20 + Math.random() * l.r * 0.6;
          const px = l.x + Math.cos(a) * d, py = l.y + Math.sin(a) * d;
          if (game.level.blocksLight(Math.floor(px / TS), Math.floor(py / TS))) continue;
          game.motes.push({ lamp: l, x: px, y: py, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 4 - 1, t: 0, life: 3 + Math.random() * 4, seed: Math.random() * 6 });
        }
      }
      // drips
      for (const d of game.drips) {
        if (d.y === null) { d.t -= dt; if (d.t <= 0) { d.y = d.top + 2; d.vy = 0; } }
        else {
          d.vy += 900 * dt; d.y += d.vy * dt;
          if (d.y >= d.bottom - 2) {
            for (let i = 0; i < 3; i++) game.particles.push({ x: d.x, y: d.bottom - 2, vx: LO.rand(-40, 40), vy: LO.rand(-90, -40), t: 0.3, color: 'rgba(170,220,230,0.8)' });
            d.y = null; d.t = 1 + Math.random() * 3;
            if (Math.random() < 0.5 && Math.abs(d.x - game.controlled.cx) < 400) LO.Music.drip();
          }
        }
      }
      // rain in open-air zones
      if (th.sky && th.sky.rain && game.zones.length) {
        for (const r of game.rain) { r.y += r.vy * dt; r.x += 60 * dt; }
        game.rain = game.rain.filter((r) => {
          if (r.y < r.floor) return true;
          if (Math.random() < 0.4) game.particles.push({ x: r.x, y: r.floor - 1, vx: LO.rand(-30, 30), vy: LO.rand(-60, -20), t: 0.2, color: 'rgba(180,200,220,0.6)' });
          return false;
        });
        for (const [x0, y0, x1, y1] of game.zones) {
          const n = Math.floor((x1 - x0 + 1) * dt * 22);
          for (let i = 0; i < n; i++) {
            const tx = x0 + Math.floor(Math.random() * (x1 - x0 + 1));
            let fy = y1; while (fy < game.level.h - 1 && game.level.tile(tx, fy + 1) !== '#') fy++;
            game.rain.push({ x: tx * TS + Math.random() * TS, y: y0 * TS, vy: 700 + Math.random() * 200, floor: (fy + 1) * TS });
          }
        }
      }
      if (game.sky) {
        for (const d of game.sky.rainDrops) { d[1] += 800 * d[2] * dt; d[0] += 90 * d[2] * dt; if (d[1] > LO.VIEW_H) { d[1] -= LO.VIEW_H + 20; d[0] = Math.random() * LO.VIEW_W; } if (d[0] > LO.VIEW_W) d[0] -= LO.VIEW_W; }
        game.sky.cityLit = LO.lerp(game.sky.cityLit, game.lasersOn() ? 1 : 0.04, Math.min(1, dt * (game.lasersOn() ? 1.5 : 6)));
        if (th.sky.lightning) {
          game.lightningT -= dt;
          game.lightning = Math.max(0, game.lightning - dt * 3);
          if (game.lightningT <= 0) { game.lightning = 1; game.lightningT = 8 + Math.random() * 10; LO.Music.thunder(); }
        }
      }
    },

    drawSky(ctx, game) {
      const th = game.theme, s = th.sky, sk = game.sky, cam = game.cam;
      if (!s) { ctx.fillStyle = '#020405'; ctx.fillRect(0, 0, LO.VIEW_W, LO.VIEW_H); return; }
      if (!sk.base) {
        // the gradient, stars and horizon glow never change, so draw them once
        const c = document.createElement('canvas'); c.width = LO.VIEW_W; c.height = LO.VIEW_H;
        const x = c.getContext('2d');
        const g = x.createLinearGradient(0, 0, 0, LO.VIEW_H);
        g.addColorStop(0, s.top); g.addColorStop(1, s.bottom);
        x.fillStyle = g; x.fillRect(0, 0, LO.VIEW_W, LO.VIEW_H);
        for (const [sx, sy, b] of sk.stars) { x.fillStyle = `rgba(255,255,240,${0.3 + b * 0.5})`; x.fillRect(sx, sy, 1.5, 1.5); }
        if (s.glow) {
          const hg = x.createLinearGradient(0, LO.VIEW_H * 0.4, 0, LO.VIEW_H);
          hg.addColorStop(0, `rgba(${s.glow},0)`); hg.addColorStop(1, `rgba(${s.glow},0.25)`);
          x.fillStyle = hg; x.fillRect(0, 0, LO.VIEW_W, LO.VIEW_H);
        }
        if (s.moon) {
          const mx = LO.VIEW_W * 0.75, my = 90;
          const mg = x.createRadialGradient(mx, my, 10, mx, my, 120); mg.addColorStop(0, 'rgba(230,235,255,0.25)'); mg.addColorStop(1, 'rgba(230,235,255,0)');
          x.fillStyle = mg; x.fillRect(mx - 120, my - 120, 240, 240);
          x.fillStyle = '#e8ecf6'; x.beginPath(); x.arc(mx, my, 22, 0, Math.PI * 2); x.fill();
          x.fillStyle = 'rgba(160,170,190,0.4)'; x.beginPath(); x.arc(mx - 6, my - 4, 5, 0, Math.PI * 2); x.arc(mx + 7, my + 6, 3, 0, Math.PI * 2); x.fill();
        }
        sk.base = c;
      }
      ctx.drawImage(sk.base, 0, 0);
      const baseY = LO.VIEW_H * 0.5 + (game.level.ph * 0.72 - cam.y - LO.VIEW_H * 0.5) * 0.45;
      ctx.drawImage(sk.far, -cam.x * 0.15, baseY - sk.H + 40);
      const nx = -cam.x * 0.3;
      ctx.drawImage(sk.near, nx, baseY - sk.H + 90);
      ctx.globalAlpha = sk.cityLit;
      ctx.drawImage(sk.lit, nx, baseY - sk.H + 90);
      ctx.globalAlpha = 1;
      ctx.fillStyle = s.skyline; ctx.fillRect(0, baseY + 89, LO.VIEW_W, LO.VIEW_H);
      if (s.chimneys) {
        for (const cxp of sk.chimneys) {
          const x0 = nx + cxp + 6;
          for (let i = 0; i < 5; i++) {
            const k = ((game.time * 0.12 + i / 5 + cxp) % 1);
            ctx.fillStyle = `rgba(60,40,40,${0.35 * (1 - k)})`;
            ctx.beginPath(); ctx.arc(x0 + k * 60, baseY - 100 - k * 120, 10 + k * 30, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      if (s.rain) {
        ctx.strokeStyle = 'rgba(170,190,215,0.28)'; ctx.lineWidth = 1; ctx.beginPath();
        for (const [x, y, k] of sk.rainDrops) { ctx.moveTo(x, y); ctx.lineTo(x - 3 * k, y - 14 * k); }
        ctx.stroke();
      }
      if (game.lightning > 0) { ctx.fillStyle = `rgba(210,220,255,${game.lightning * 0.6})`; ctx.fillRect(0, 0, LO.VIEW_W, LO.VIEW_H); }
    },

    // world-space, before lighting: falling drips and rain
    drawWeather(ctx, game) {
      ctx.fillStyle = 'rgba(170,220,230,0.8)';
      for (const d of game.drips) if (d.y !== null) ctx.fillRect(d.x, d.y, 1.5, 4);
      if (game.rain.length) {
        ctx.strokeStyle = 'rgba(175,195,220,0.45)'; ctx.lineWidth = 1; ctx.beginPath();
        for (const r of game.rain) { ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - 1.5, r.y - 12); }
        ctx.stroke();
      }
    },

    // world-space, after lighting: things that glow on their own
    drawGlow(ctx, game) {
      const t = game.time;
      for (const d of game.decor) {
        if (d.type === 'leds') {
          for (let i = 0; i < d.n; i++) {
            const on = Math.sin(t * (1.5 + i * 0.7) + d.seed + i * 2) > 0.2;
            ctx.fillStyle = on ? ['rgba(90,255,140,0.9)', 'rgba(255,90,80,0.9)', 'rgba(255,210,90,0.9)'][i % 3] : 'rgba(40,50,60,0.8)';
            if (!game.lasersOn()) ctx.fillStyle = i === 0 && Math.sin(t * 4) > 0 ? 'rgba(255,60,60,0.9)' : 'rgba(30,30,40,0.8)';
            ctx.fillRect(d.x + i * 4, d.y, 2, 2);
          }
        } else if (d.type === 'furnace') {
          const f = 0.75 + Math.sin(t * 7) * 0.08 + Math.sin(t * 13.3) * 0.06;
          const g = ctx.createLinearGradient(0, d.y, 0, d.y + d.h);
          g.addColorStop(0, `rgba(255,120,40,${0.35 * f})`); g.addColorStop(1, `rgba(255,200,90,${0.7 * f})`);
          ctx.fillStyle = g; ctx.fillRect(d.x, d.y, d.w, d.h);
          const hg = ctx.createRadialGradient(d.x + d.w / 2, d.y + d.h, 0, d.x + d.w / 2, d.y + d.h, 90);
          hg.addColorStop(0, `rgba(255,120,40,${0.18 * f})`); hg.addColorStop(1, 'rgba(255,120,40,0)');
          ctx.fillStyle = hg; ctx.fillRect(d.x - 90, d.y - 60, d.w + 180, d.h + 150);
          if (Math.random() < 0.15) game.particles.push({ x: d.x + Math.random() * d.w, y: d.y, vx: LO.rand(-10, 10), vy: LO.rand(-70, -30), t: LO.rand(0.6, 1.4), color: 'rgba(255,160,60,0.9)', float: true });
        } else if (d.type === 'turbine') {
          game.turbineAng = (game.turbineAng || 0) + (game.lasersOn() ? 0.05 : 0.004);
          const spin = game.turbineAng;
          ctx.strokeStyle = game.lasersOn() ? 'rgba(140,215,255,0.16)' : 'rgba(140,215,255,0.04)'; ctx.lineWidth = 3;
          for (let i = 0; i < 6; i++) { const a = spin + (i / 6) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + Math.cos(a) * d.r, d.y + Math.sin(a) * d.r); ctx.stroke(); }
        }
      }
      // dust motes, lit by their lamp
      ctx.globalCompositeOperation = 'lighter';
      for (const m of game.motes) {
        const l = m.lamp, d = LO.dist(l.x, l.y, m.x, m.y);
        const fade = Math.min(1, m.t, m.life - m.t) * Math.max(0, 1 - d / l.r);
        if (fade <= 0) continue;
        ctx.fillStyle = `rgba(${l.color},${0.55 * fade})`;
        ctx.fillRect(m.x, m.y, 1.5, 1.5);
      }
      ctx.globalCompositeOperation = 'source-over';
    },

    // screen-space: edges darken, tinted by what's happening
    drawVignette(ctx, game) {
      if (!this.vig) {
        const c = document.createElement('canvas'); c.width = LO.VIEW_W; c.height = LO.VIEW_H;
        const x = c.getContext('2d');
        const g = x.createRadialGradient(LO.VIEW_W / 2, LO.VIEW_H / 2, LO.VIEW_H * 0.35, LO.VIEW_W / 2, LO.VIEW_H / 2, LO.VIEW_W * 0.62);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
        x.fillStyle = g; x.fillRect(0, 0, LO.VIEW_W, LO.VIEW_H);
        this.vig = c;
      }
      const m = game.mood;
      ctx.globalAlpha = 0.5 + m.hidden * 0.3; ctx.drawImage(this.vig, 0, 0); ctx.globalAlpha = 1;
      this.tints = this.tints || {};
      const tint = (col, a) => {
        if (a <= 0.01) return;
        if (!this.tints[col]) {
          const c = document.createElement('canvas'); c.width = LO.VIEW_W; c.height = LO.VIEW_H;
          const x = c.getContext('2d');
          const g = x.createRadialGradient(LO.VIEW_W / 2, LO.VIEW_H / 2, LO.VIEW_H * 0.4, LO.VIEW_W / 2, LO.VIEW_H / 2, LO.VIEW_W * 0.6);
          g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},1)`);
          x.fillStyle = g; x.fillRect(0, 0, LO.VIEW_W, LO.VIEW_H);
          this.tints[col] = c;
        }
        ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(this.tints[col], 0, 0); ctx.restore();
      };
      tint('255,30,20', m.alert * (0.22 + Math.sin(game.time * 8) * 0.06));
      tint('255,140,30', m.watched * 0.14);
      tint('170,110,255', m.possess * 0.22);
      tint('40,90,160', m.hidden * 0.12);
    },
  };
})(window.LO);
