'use strict';
// Screens, saving and the main loop.
(function (LO) {
  const W = LO.VIEW_W, H = LO.VIEW_H;
  const RANKS = { S: 'Phantom', A: 'Shadow', B: 'Operative', C: 'Clumsy', D: 'Bull in a Lamp Shop' };
  const RANK_COLORS = { S: '#ffd166', A: '#9dffb0', B: '#8fd3ff', C: '#e0c0a0', D: '#ff8a7a' };
  const RANK_ORDER = 'DCBAS';

  // ------------------------------------------------------------ save data
  const Save = {
    data: { levels: {}, unlocked: 1 },
    load() {
      try {
        const raw = localStorage.getItem('lightsout.save');
        if (raw) this.data = Object.assign({ levels: {}, unlocked: 1 }, JSON.parse(raw));
      } catch (e) { /* storage unavailable: play without saving */ }
      if (/[?&]unlock/.test(location.search)) this.data.unlocked = LO.LEVELS.length;
    },
    store() { try { localStorage.setItem('lightsout.save', JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
    level(id) { return (this.data.levels[id] = this.data.levels[id] || { best: null, score: 0, found: {} }); },
  };
  LO.Save = Save;

  // ------------------------------------------------------------ app state
  const App = {
    screen: 'title',
    game: null,
    levelIndex: 0,
    sel: 0,
    buttons: [],
    showHelp: false,
    t: 0,
  };
  LO.App = App;

  function startLevel(i, intro) {
    App.levelIndex = i;
    App.game = new LO.Game(LO.LEVELS[i], i);
    if (intro) App.game.intro = { t: 0, dur: 3.6 };
    App.screen = 'play';
    App.showHelp = false;
    LO.Music.setMode('level', LO.LEVELS[i].theme);
  }

  function finishLevel() {
    const g = App.game, r = g.results, def = g.def;
    const rec = Save.level(def.id);
    r.newBest = !rec.best || RANK_ORDER.indexOf(r.rank) > RANK_ORDER.indexOf(rec.best) || r.score > rec.score;
    if (!rec.best || RANK_ORDER.indexOf(r.rank) > RANK_ORDER.indexOf(rec.best)) rec.best = r.rank;
    rec.score = Math.max(rec.score, r.score);
    const key = g.approachKey();
    r.approach = def.approaches.find((a) => a.key === key);
    r.newApproach = r.approach && !rec.found[key];
    rec.found[key] = true;
    Save.data.unlocked = Math.max(Save.data.unlocked, Math.min(LO.LEVELS.length, App.levelIndex + 2));
    Save.store();
    App.screen = 'results';
    App.sel = 0;
    App.typed = 0; App.stamped = false;
  }

  // ------------------------------------------------------------ ui helpers
  const F = LO.F;
  const INK = '#2a2418', PAPER = '#e9e0c9', RED = '#b8322a';
  const STAMP = { S: '#a8780f', A: '#2f7a3a', B: '#2a5a8a', C: '#7a5a3a', D: '#a8322a' };

  // style: 'text' (lamp-lit menu text), 'paper' (ink on a page) or 'card' (caller draws the card)
  function button(ctx, id, label, x, y, w, h, opts = {}) {
    const m = LO.Input.mouse;
    const hover = m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h;
    if (hover && m.moved) App.sel = App.buttons.length;
    const selected = App.sel === App.buttons.length;
    App.buttons.push({ id, x, y, w, h, disabled: opts.disabled });
    const style = opts.style || 'text';
    ctx.textBaseline = 'middle';
    if (style === 'text') {
      ctx.font = F.d(opts.size || 32);
      ctx.textAlign = opts.align || 'left';
      const tx = opts.align === 'center' ? x + w / 2 : x + 28;
      if (selected && !opts.disabled) {
        const g = ctx.createRadialGradient(x + 10, y + h / 2, 0, x + 10, y + h / 2, 90);
        g.addColorStop(0, 'rgba(255,200,120,0.25)'); g.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 80, y - 40, 260, h + 80);
        ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(x + 10, y + h / 2, 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#000'; ctx.fillText(label, tx + 2, y + h / 2 + 3);
      ctx.fillStyle = opts.disabled ? '#4a4d58' : selected ? '#ffd28a' : '#cfc6b2';
      ctx.fillText(label, tx, y + h / 2 + 1);
    } else if (style === 'paper') {
      ctx.font = F.d(opts.size || 26); ctx.textAlign = 'center';
      ctx.fillStyle = selected ? INK : 'rgba(42,36,24,0.6)';
      ctx.fillText(label, x + w / 2, y + h / 2 + 1);
      if (selected) { ctx.fillStyle = RED; ctx.fillRect(x + w / 2 - ctx.measureText(label).width / 2 - 4, y + h - 6, ctx.measureText(label).width + 8, 3); }
    } else if (style === 'card' && selected) {
      ctx.strokeStyle = '#ffd28a'; ctx.lineWidth = 2; ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
    }
    ctx.textBaseline = 'alphabetic';
    return selected;
  }

  function menuInput() {
    const I = LO.Input;
    const n = App.buttons.length;
    if (!n) return null;
    if (I.action('navDown')) { App.sel = (App.sel + 1) % n; LO.Sfx.play('click'); }
    if (I.action('navUp')) { App.sel = (App.sel - 1 + n) % n; LO.Sfx.play('click'); }
    App.sel = LO.clamp(App.sel, 0, n - 1);
    let chosen = null;
    if (I.action('confirm')) chosen = App.buttons[App.sel];
    if (I.mouse.pressed) {
      const m = I.mouse;
      for (const b of App.buttons) if (m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h) chosen = b;
    }
    if (chosen && chosen.disabled) { LO.Sfx.play('deny'); return null; }
    if (chosen) LO.Sfx.play('click');
    return chosen ? chosen.id : null;
  }

  // ------------------------------------------------------------ the rooftop scene behind the menus
  const Scene = {
    build() {
      const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
      let seed = 7;
      const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      this.far = mk(W + 200, 300); this.near = mk(W + 200, 340); this.lit = mk(W + 200, 340);
      const fx = this.far.getContext('2d'), nx = this.near.getContext('2d'), lx = this.lit.getContext('2d');
      fx.fillStyle = '#121734';
      for (let x = 0; x < W + 200;) { const w = 30 + r() * 60, h = 80 + r() * 160; fx.fillRect(x, 300 - h, w, h); x += w + 4; }
      nx.fillStyle = '#080a18';
      this.windows = [];
      for (let x = 0; x < W + 200;) {
        const w = 50 + r() * 90, h = 110 + r() * 200;
        nx.fillRect(x, 340 - h, w, h);
        if (r() < 0.25) nx.fillRect(x + w / 2 - 2, 340 - h - 40, 4, 40);
        for (let wy = 340 - h + 12; wy < 330; wy += 13) for (let wx = x + 7; wx < x + w - 7; wx += 10) {
          if (r() < 0.3) { lx.fillStyle = `rgba(255,${200 + r() * 40 | 0},${120 + r() * 60 | 0},${0.45 + r() * 0.5})`; lx.fillRect(wx, wy, 4, 6); }
        }
        x += w + 6;
      }
      this.drops = Array.from({ length: 160 }, () => [Math.random() * W, Math.random() * H, 0.6 + Math.random() * 0.6]);
      this.built = true;
    },
    draw(ctx, t, dim = 0) {
      if (!this.built) this.build();
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#05071a'); g.addColorStop(1, '#232a52');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const mx = W * 0.83, my = 92;
      const mg = ctx.createRadialGradient(mx, my, 10, mx, my, 160); mg.addColorStop(0, 'rgba(220,228,255,0.3)'); mg.addColorStop(1, 'rgba(220,228,255,0)');
      ctx.fillStyle = mg; ctx.fillRect(mx - 160, my - 160, 320, 320);
      ctx.fillStyle = '#e8ecf6'; ctx.beginPath(); ctx.arc(mx, my, 26, 0, Math.PI * 2); ctx.fill();
      const drift = Math.sin(t * 0.05) * 30;
      ctx.drawImage(this.far, -60 + drift * 0.3, H - 360);
      ctx.drawImage(this.near, -100 + drift * 0.6, H - 380);
      ctx.globalAlpha = 0.85 + Math.sin(t * 0.7) * 0.05; ctx.drawImage(this.lit, -100 + drift * 0.6, H - 380); ctx.globalAlpha = 1;
      // rain
      ctx.strokeStyle = 'rgba(170,190,220,0.25)'; ctx.lineWidth = 1; ctx.beginPath();
      for (const d of this.drops) {
        d[1] += 13 * d[2]; d[0] += 1.6 * d[2];
        if (d[1] > H) { d[1] = -20; d[0] = Math.random() * W; }
        ctx.moveTo(d[0], d[1]); ctx.lineTo(d[0] - 3 * d[2], d[1] - 15 * d[2]);
      }
      ctx.stroke();
      // rooftop
      const roof = H - 92;
      ctx.fillStyle = '#050609'; ctx.fillRect(0, roof, W, 92);
      ctx.fillStyle = '#0c0e15'; ctx.fillRect(0, roof - 10, W, 12);
      ctx.fillStyle = '#050609';
      ctx.fillRect(70, roof - 150, 90, 100); ctx.fillRect(80, roof - 50, 6, 50); ctx.fillRect(144, roof - 50, 6, 50);
      ctx.beginPath(); ctx.moveTo(62, roof - 150); ctx.lineTo(115, roof - 186); ctx.lineTo(168, roof - 150); ctx.fill();
      ctx.fillRect(250, roof - 130, 3, 120); ctx.fillRect(236, roof - 120, 30, 2);
      // the lamp
      const sway = Math.sin(t * 0.9) * 0.08;
      const px = W * 0.58, py = roof - 210;
      ctx.fillStyle = '#07080c'; ctx.fillRect(px - 3, py, 6, 210); ctx.fillRect(px - 3, py, 70, 5);
      const lx = px + 66 + Math.sin(sway) * 30, ly = py + 30;
      ctx.strokeStyle = '#07080c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + 66, py + 5); ctx.lineTo(lx, ly); ctx.stroke();
      const flick = Math.random() < 0.015 ? 0.35 : 1;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.arc(lx, ly, 330, Math.PI / 2 - 0.55 + sway, Math.PI / 2 + 0.55 + sway); ctx.closePath();
      const cg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 330); cg.addColorStop(0, `rgba(255,190,110,${0.32 * flick})`); cg.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = cg; ctx.fill();
      const pg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 26); pg.addColorStop(0, `rgba(255,220,160,${0.9 * flick})`); pg.addColorStop(1, 'rgba(255,220,160,0)');
      ctx.fillStyle = pg; ctx.fillRect(lx - 26, ly - 26, 52, 52);
      ctx.restore();
      ctx.fillStyle = '#16181f'; ctx.beginPath(); ctx.moveTo(lx - 12, ly + 2); ctx.lineTo(lx - 5, ly - 7); ctx.lineTo(lx + 5, ly - 7); ctx.lineTo(lx + 12, ly + 2); ctx.fill();
      // the player, crouched at the dark edge of the roof
      const cx = W * 0.84, cy = roof - 10;
      ctx.fillStyle = '#020203';
      ctx.beginPath(); ctx.ellipse(cx, cy - 14, 13, 10, 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 9, cy - 26, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(cx - 10, cy - 8, 8, 8); ctx.fillRect(cx + 4, cy - 8, 8, 8);
      ctx.strokeStyle = '#5a1822'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx + 2, cy - 22);
      for (let i = 1; i <= 5; i++) ctx.lineTo(cx + 2 - i * 6, cy - 22 + Math.sin(t * 6 + i) * 2 + i * 0.5);
      ctx.stroke(); ctx.lineCap = 'butt';
      ctx.fillStyle = '#7dff8a'; ctx.fillRect(cx + 11, cy - 28, 6, 2.5);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(125,255,138,0.25)'; ctx.beginPath(); ctx.arc(cx + 14, cy - 27, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      if (dim) { ctx.fillStyle = `rgba(3,4,10,${dim})`; ctx.fillRect(0, 0, W, H); }
    },
  };
  LO.MenuScene = Scene;

  function backdrop(ctx, t, dim = 0.45) { Scene.draw(ctx, t, dim); }

  function heading(ctx, text, x, y, size = 44, align = 'left') {
    ctx.textAlign = align; ctx.font = F.d(size);
    ctx.fillStyle = '#000'; ctx.fillText(text, x + 3, y + 3);
    ctx.fillStyle = '#f2e8d2'; ctx.fillText(text, x, y);
  }
  function paper(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + 6, y + 8, w, h);
    ctx.fillStyle = PAPER; ctx.fillRect(x, y, w, h);
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(120,90,40,0.12)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(120,90,40,0.06)';
    for (let i = 0; i < 6; i++) ctx.fillRect(x, y + 40 + i * 76, w, 1);
  }
  function stamp(ctx, text, x, y, color, size, rot, scale = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(scale, scale);
    ctx.font = F.d(size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + size * 0.5, h = size * 1.05;
    ctx.globalAlpha *= 0.85;
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, size / 14);
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = color; ctx.fillText(text, 0, size * 0.05);
    ctx.restore(); ctx.textBaseline = 'alphabetic';
  }
  const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  // ------------------------------------------------------------ screens
  function drawTitle(ctx) {
    backdrop(ctx, App.t, 0);
    const flick = Math.random() < 0.02 || (App.t % 7 > 6.85) ? 0.25 : 1;
    ctx.textAlign = 'left';
    ctx.font = F.d(140);
    ctx.fillStyle = '#000'; ctx.fillText('LIGHTS', 64, 168);
    ctx.save(); ctx.globalAlpha = flick;
    const g = ctx.createLinearGradient(0, 60, 0, 168); g.addColorStop(0, '#fff6d8'); g.addColorStop(1, '#ffc46e');
    ctx.fillStyle = g; ctx.shadowColor = 'rgba(255,180,90,0.7)'; ctx.shadowBlur = 30; ctx.fillText('LIGHTS', 60, 164);
    ctx.restore();
    const ow = ctx.measureText('LIGHTS ').width;
    ctx.fillStyle = '#10131f'; ctx.fillText('OUT', 60 + ow, 164);
    ctx.strokeStyle = 'rgba(160,170,200,0.25)'; ctx.lineWidth = 1.5; ctx.strokeText('OUT', 60 + ow, 164);
    ctx.font = F.t(17); ctx.fillStyle = '#c9c0ad';
    ctx.fillText('Every level a sandbox. Every shadow a door.', 66, 204);
    App.buttons = [];
    button(ctx, 'play', 'PLAY', 52, 250, 220, 44);
    button(ctx, 'help', 'CONTROLS', 52, 298, 220, 44);
    button(ctx, 'mute', LO.Sfx.muted ? 'SOUND: OFF' : 'SOUND: ON', 52, 346, 220, 44);
    ctx.textAlign = 'left'; ctx.font = F.m(11); ctx.fillStyle = 'rgba(200,190,170,0.6)';
    ctx.fillText(LO.Input.pad ? 'Controller connected  ·  A select  ·  B back' : 'Keyboard and mouse, or plug in a controller and press any button', 66, H - 24);
    const c = menuInput();
    if (c === 'play') { App.screen = 'select'; App.sel = Math.min(Save.data.unlocked, LO.LEVELS.length) - 1; }
    if (c === 'help') { App.showHelp = true; App.helpFrom = 'title'; }
    if (c === 'mute') LO.Sfx.toggleMute();
  }

  function drawSelect(ctx) {
    backdrop(ctx, App.t, 0.55);
    heading(ctx, 'CASE FILES', 80, 72, 46);
    ctx.font = F.t(14); ctx.fillStyle = '#b8ae98'; ctx.textAlign = 'left';
    ctx.fillText('Five names. Four ways in for each. Choose a file.', 300, 68);
    App.buttons = [];
    LO.LEVELS.forEach((lv, i) => {
      const y = 98 + i * 76, x = 80, w = 640, h = 66;
      const locked = i >= Save.data.unlocked;
      const rec = Save.level(lv.id);
      // folder
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x + 5, y + 6, w, h);
      ctx.fillStyle = locked ? '#6b6556' : '#cdb98a'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = locked ? '#5d584a' : '#bfa978'; ctx.fillRect(x + w - 150, y - 8, 110, 10);
      ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(x, y + h - 10, w, 10);
      button(ctx, 'lv' + i, '', x, y, w, h, { style: 'card', disabled: locked });
      ctx.textAlign = 'left';
      ctx.font = F.m(10); ctx.fillStyle = 'rgba(42,36,24,0.6)'; ctx.fillText(`FILE ${String(i + 1).padStart(2, '0')}`, x + 16, y + 18);
      if (locked) {
        ctx.fillStyle = '#16140f'; ctx.fillRect(x + 16, y + 26, 220, 16); ctx.fillRect(x + 16, y + 48, 300, 8);
        stamp(ctx, 'CLASSIFIED', x + 480, y + 34, RED, 26, -0.06);
        return;
      }
      ctx.font = F.d(30); ctx.fillStyle = INK; ctx.fillText(lv.name.toUpperCase(), x + 16, y + 46);
      const nw = ctx.measureText(lv.name.toUpperCase()).width;
      ctx.font = F.t(13); ctx.fillStyle = 'rgba(42,36,24,0.8)';
      ctx.fillText(`${lv.place}  ·  ${lv.target.name}`, x + 30 + nw, y + 44);
      // approaches found
      const found = lv.approaches.filter((a) => rec.found[a.key]).length;
      for (let k = 0; k < lv.approaches.length; k++) {
        ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(x + 16 + k * 14, y + 52, 9, 9);
        if (k < found) { ctx.strokeStyle = RED; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 17 + k * 14, y + 56); ctx.lineTo(x + 20 + k * 14, y + 60); ctx.lineTo(x + 27 + k * 14, y + 50); ctx.stroke(); }
      }
      ctx.font = F.m(10); ctx.fillStyle = 'rgba(42,36,24,0.7)'; ctx.fillText(`${found}/${lv.approaches.length} approaches`, x + 24 + lv.approaches.length * 14, y + 61);
      if (rec.best) stamp(ctx, rec.best, x + w - 52, y + 34, STAMP[rec.best], 44, -0.12);
      else { ctx.font = F.d(16); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(42,36,24,0.45)'; ctx.fillText('UNRANKED', x + w - 52, y + 40); }
    });
    button(ctx, 'back', 'BACK', 64, H - 62, 160, 40, { size: 28 });
    const c = menuInput();
    if (c === 'back' || LO.Input.action('back')) { App.screen = 'title'; App.sel = 0; }
    else if (c && c.startsWith('lv')) { App.levelIndex = +c.slice(2); App.screen = 'briefing'; App.sel = 0; App.briefT = 0; }
  }

  function drawBriefing(ctx) {
    const lv = LO.LEVELS[App.levelIndex];
    const rec = Save.level(lv.id);
    backdrop(ctx, App.t, 0.6);
    const px = 56, py = 22, pw = W - 112, ph = H - 44;
    paper(ctx, px, py, pw, ph);
    // mugshot
    const mx = px + 30, my = py + 34, mw = 190, mh = 230;
    ctx.save(); ctx.translate(mx + mw / 2, my + mh / 2); ctx.rotate(-0.03); ctx.translate(-(mx + mw / 2), -(my + mh / 2));
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(mx + 4, my + 5, mw, mh);
    ctx.fillStyle = '#f4efe2'; ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#2b2f36'; ctx.fillRect(mx + 10, my + 10, mw - 20, mh - 52);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let k = 0; k < 7; k++) ctx.fillRect(mx + 10, my + 24 + k * 22, mw - 20, 1);
    LO.drawPortrait(ctx, lv.target.look || {}, mx + mw / 2 - 2, my + 30, 3.1);
    ctx.font = F.t(14); ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.fillText(lv.target.name, mx + mw / 2, my + mh - 18);
    ctx.restore();
    stamp(ctx, 'TARGET', mx + 150, my + 36, RED, 30, 0.18);
    ctx.fillStyle = '#9aa0a8'; ctx.fillRect(mx + 70, my - 8, 8, 30); ctx.fillRect(mx + 70, my - 8, 30, 6);
    // the file
    const tx = px + 260;
    ctx.textAlign = 'left';
    ctx.font = F.m(11); ctx.fillStyle = 'rgba(42,36,24,0.6)';
    ctx.fillText(`CASE FILE No. ${App.levelIndex + 1}  ·  ${lv.place.toUpperCase()}`, tx, py + 44);
    ctx.font = F.d(50); ctx.fillStyle = INK; ctx.fillText(lv.name.toUpperCase(), tx, py + 92);
    ctx.font = F.t(15); ctx.fillStyle = INK;
    const lines = LO.wrapText(ctx, lv.briefing, pw - 290);
    const shown = Math.floor((App.briefT || 0) * 110);
    let used = 0;
    lines.forEach((ln, i) => {
      const part = ln.slice(0, Math.max(0, shown - used)); used += ln.length;
      ctx.fillText(part, tx, py + 124 + i * 21);
    });
    if (shown < used && Math.random() < 0.5) LO.Music.sting('type');
    const ay = py + 132 + lines.length * 21;
    ctx.font = F.d(24); ctx.fillStyle = RED; ctx.fillText('KNOWN WAYS IN', tx, ay + 10);
    lv.approaches.forEach((a, i) => {
      const y = ay + 40 + i * 42;
      const got = rec.found[a.key];
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.strokeRect(tx, y - 13, 13, 13);
      if (got) { ctx.strokeStyle = RED; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(tx + 1, y - 6); ctx.lineTo(tx + 5, y - 1); ctx.lineTo(tx + 15, y - 17); ctx.stroke(); }
      ctx.font = F.d(21); ctx.fillStyle = INK; ctx.fillText(a.name.toUpperCase(), tx + 24, y);
      let fs = 13; ctx.font = F.t(fs);
      while (fs > 10 && ctx.measureText(a.hint).width > pw - 300) ctx.font = F.t(--fs);
      ctx.fillStyle = 'rgba(42,36,24,0.78)'; ctx.fillText(a.hint, tx + 24, y + 18);
    });
    ctx.font = F.t(13); ctx.fillStyle = 'rgba(42,36,24,0.75)';
    ctx.fillText(`Issued: ${lv.ammo} pellets, ${lv.bottles} bottles.   Par time ${fmtTime(lv.par)}.`, px + 30, py + ph - 26);
    if (rec.best) stamp(ctx, 'BEST ' + rec.best, px + 125, py + 330, STAMP[rec.best], 30, -0.1);
    App.buttons = [];
    button(ctx, 'go', 'BEGIN MISSION', px + pw - 230, py + ph - 52, 200, 40, { style: 'paper', size: 28 });
    button(ctx, 'back', 'BACK', px + pw - 340, py + ph - 52, 100, 40, { style: 'paper', size: 22 });
    App.sel = App.sel === undefined ? 0 : App.sel;
    const c = menuInput();
    if (c === 'go') startLevel(App.levelIndex, true);
    if (c === 'back' || LO.Input.action('back')) { App.screen = 'select'; App.sel = App.levelIndex; }
  }

  function keycap(ctx, label, x, y) {
    ctx.font = F.d(18);
    const parts = label.split(' / ');
    let cx = x;
    for (let i = parts.length - 1; i >= 0; i--) {
      const t = parts[i];
      const pad = { A: '#5bd16a', B: '#e5534b', X: '#4a8fe7', Y: '#e8c547' }[t];
      const w = pad ? 22 : Math.max(22, ctx.measureText(t).width + 12);
      cx -= w;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (pad && LO.Input.usingPad) { ctx.fillStyle = pad; ctx.beginPath(); ctx.arc(cx + w / 2, y, 11, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#10131a'; }
      else { ctx.fillStyle = '#e9e2d0'; ctx.beginPath(); ctx.roundRect(cx, y - 11, w, 22, 3); ctx.fill(); ctx.fillStyle = '#16181f'; }
      ctx.fillText(t, cx + w / 2, y + 1);
      cx -= 6;
    }
    ctx.textBaseline = 'alphabetic';
  }

  function drawHelp(ctx) {
    ctx.fillStyle = 'rgba(3,4,9,0.9)'; ctx.fillRect(0, 0, W, H);
    heading(ctx, 'CONTROLS', W / 2, 62, 44, 'center');
    const rows = LO.Input.usingPad ? [
      ['Left stick', 'Move, climb ladders'], ['A', 'Jump'], ['Down', 'Crouch: quieter, smaller, fits in vents'],
      ['Down / A', 'Drop through a platform'], ['LB', 'Run (loud)'],
      ['Right stick', 'Aim (snaps onto lamps, ropes, fuse boxes and people)'],
      ['RT', 'Shoot a pellet: break lights, cut ropes, hit fuse boxes'],
      ['LT', 'Throw a bottle to make a distraction'],
      ['X', 'Takedown from behind, take uniform, free workers, levers, lockers, exit'],
      ['Y', 'Possess the guard or rat you are aiming at. Y again to return'],
      ['Start', 'Pause (restart from the pause menu)'], ['Back', 'This screen'], ['B', 'Back out of menus'],
    ] : [
      ['A / D', 'Move'], ['Space', 'Jump'], ['S', 'Crouch: quieter, smaller, fits in vents'],
      ['S / Space', 'Drop through a platform'], ['W / S', 'Climb ladders'], ['Shift', 'Run (loud)'],
      ['Click', 'Shoot a pellet: break lights, cut ropes, hit fuse boxes'],
      ['Right click / F', 'Throw a bottle to make a distraction'],
      ['E', 'Takedown from behind, take uniform, free workers, levers, lockers, exit'],
      ['Q', 'Possess a guard or rat near the mouse. Q again to return'],
      ['H', 'This screen'], ['Esc', 'Pause'], ['R', 'Restart mission'], ['M', 'Mute'],
    ];
    rows.forEach(([k, v], i) => {
      const y = 104 + i * 29;
      keycap(ctx, k, 330, y);
      ctx.textAlign = 'left'; ctx.font = F.t(15); ctx.fillStyle = '#e2d9c4'; ctx.fillText(v, 352, y + 5);
    });
    ctx.textAlign = 'center'; ctx.font = F.t(14); ctx.fillStyle = '#a89f8a';
    ctx.fillText('Guards see what is lit. Their cones show where they look. Rings show what they hear.', W / 2, H - 42);
    ctx.font = F.m(11); ctx.fillStyle = '#7d7666';
    ctx.fillText(LO.Input.usingPad ? 'PRESS ANY BUTTON TO CLOSE' : 'PRESS ANY KEY TO CLOSE', W / 2, H - 18);
    if (LO.Input.anyPressed()) { App.showHelp = false; LO.Input.pressed.clear(); LO.Input.padPressed.clear(); LO.Input.mouse.pressed = false; }
  }

  function drawPause(ctx) {
    App.game.render(ctx);
    ctx.fillStyle = 'rgba(3,4,9,0.72)'; ctx.fillRect(0, 0, W, H);
    heading(ctx, 'PAUSED', 80, 150, 72);
    ctx.font = F.t(15); ctx.fillStyle = '#b8ae98'; ctx.textAlign = 'left';
    ctx.fillText(`${App.game.def.name}  ·  ${fmtTime(App.game.time)}`, 84, 178);
    App.buttons = [];
    button(ctx, 'resume', 'RESUME', 60, 210, 260, 44);
    button(ctx, 'restart', 'RESTART', 60, 258, 260, 44);
    button(ctx, 'help', 'CONTROLS', 60, 306, 260, 44);
    button(ctx, 'quit', 'QUIT TO CASE FILES', 60, 354, 300, 44);
    const c = menuInput();
    if (c === 'resume' || LO.Input.action('pause') || LO.Input.action('back')) App.screen = 'play';
    if (c === 'restart') startLevel(App.levelIndex);
    if (c === 'help') { App.showHelp = true; App.helpFrom = 'pause'; }
    if (c === 'quit') { App.screen = 'select'; App.sel = App.levelIndex; }
  }

  function drawFailed(ctx) {
    const g = App.game;
    const a = Math.min(1, g.failT * 1.5);
    ctx.fillStyle = `rgba(40,4,6,${0.72 * a})`; ctx.fillRect(0, 0, W, H);
    if (g.failT < 0.4) return;
    ctx.textAlign = 'left'; ctx.font = F.d(92);
    ctx.fillStyle = '#000'; ctx.fillText('MISSION FAILED', 64, 184);
    ctx.fillStyle = '#ff5c4c'; ctx.fillText('MISSION FAILED', 60, 180);
    ctx.font = F.t(18); ctx.fillStyle = '#f2d8cf'; ctx.fillText(g.failReason, 66, 218);
    App.buttons = [];
    button(ctx, 'retry', LO.Input.usingPad ? 'TRY AGAIN' : 'TRY AGAIN  (R)', 52, 262, 300, 44);
    button(ctx, 'quit', 'CASE FILES', 52, 310, 300, 44);
    const c = menuInput();
    if (c === 'retry') startLevel(App.levelIndex);
    if (c === 'quit' || LO.Input.action('back')) { App.screen = 'select'; App.sel = App.levelIndex; }
  }

  function drawResults(ctx) {
    const g = App.game, r = g.results, t = App.resultsT;
    backdrop(ctx, App.t, 0.6);
    const px = 56, py = 22, pw = W - 112, ph = H - 44;
    paper(ctx, px, py, pw, ph);
    ctx.textAlign = 'left';
    ctx.font = F.m(11); ctx.fillStyle = 'rgba(42,36,24,0.6)'; ctx.fillText(`MISSION REPORT  ·  CASE FILE No. ${App.levelIndex + 1}`, px + 36, py + 40);
    ctx.font = F.d(46); ctx.fillStyle = INK; ctx.fillText(g.def.name.toUpperCase(), px + 36, py + 84);
    ctx.font = F.t(15); ctx.fillText(`${g.target.name}  ·  ${LO.METHOD_NAMES[r.method]}  ·  ${fmtTime(r.time)}`, px + 36, py + 110);
    // lines type out one at a time
    const per = 0.2, shown = Math.min(r.lines.length, Math.floor(t / per));
    if (shown > (App.typed || 0)) { App.typed = shown; LO.Music.sting('type'); }
    for (let i = 0; i < shown; i++) {
      const ln = r.lines[i], y = py + 148 + i * 24;
      ctx.textAlign = 'left'; ctx.font = F.t(15); ctx.fillStyle = INK; ctx.fillText(ln.label, px + 36, y);
      ctx.textAlign = 'right'; ctx.fillStyle = ln.pts >= 0 ? '#2f6a32' : RED; ctx.fillText((ln.pts >= 0 ? '+' : '') + ln.pts, px + 470, y);
    }
    const ly = py + 148 + r.lines.length * 24;
    const tDone = r.lines.length * per;
    if (t > tDone) {
      ctx.fillStyle = INK; ctx.fillRect(px + 36, ly - 14, 434, 1.5);
      ctx.textAlign = 'left'; ctx.font = F.d(26); ctx.fillText('SCORE', px + 36, ly + 12);
      ctx.textAlign = 'right'; ctx.fillText(String(Math.round(r.score * Math.min(1, (t - tDone) * 3))), px + 470, ly + 12);
    }
    // the rank stamp lands
    const tStamp = tDone + 0.45;
    if (t > tStamp) {
      const k = Math.min(1, (t - tStamp) / 0.14);
      if (!App.stamped) { App.stamped = true; LO.Music.sting('stamp'); LO.Input.rumble(0.6, 0.3, 160); }
      const shake = t - tStamp < 0.25 ? (Math.random() - 0.5) * 6 : 0;
      ctx.save(); ctx.translate(shake, shake);
      ctx.globalAlpha = k;
      ctx.save(); ctx.translate(px + 650, py + 170); ctx.rotate(-0.14); ctx.scale(2.2 - k * 1.2, 2.2 - k * 1.2);
      ctx.strokeStyle = STAMP[r.rank]; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 88, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 78, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = STAMP[r.rank]; ctx.font = F.d(130); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(r.rank, 0, 8);
      ctx.font = F.d(18); ctx.fillText(RANKS[r.rank].toUpperCase(), 0, 62);
      ctx.restore();
      ctx.restore();
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = 1;
      if (r.newBest) stamp(ctx, 'NEW BEST', px + 760, py + 92, RED, 22, 0.12);
      ctx.textAlign = 'center'; ctx.font = F.t(14); ctx.fillStyle = INK;
      ctx.fillText(r.approach ? `Approach: ${r.approach.name}${r.newApproach ? '  (new)' : ''}` : 'An approach nobody planned for.', px + 650, py + 290);
      const rec = Save.level(g.def.id);
      const found = g.def.approaches.filter((a) => rec.found[a.key]).length;
      ctx.font = F.m(11); ctx.fillStyle = 'rgba(42,36,24,0.7)'; ctx.fillText(`APPROACHES DISCOVERED ${found}/${g.def.approaches.length}`, px + 650, py + 310);
      r.badges.slice(0, 4).forEach((b, i) => {
        const y = py + 340 + i * 30;
        ctx.textAlign = 'left'; ctx.font = F.d(18); ctx.fillStyle = STAMP.S; ctx.fillText('★ ' + b[0].toUpperCase(), px + 520, y);
        ctx.font = F.t(12); ctx.fillStyle = 'rgba(42,36,24,0.75)'; ctx.fillText(b[1], px + 655, y);
      });
    }
    App.buttons = [];
    const hasNext = App.levelIndex + 1 < LO.LEVELS.length;
    if (hasNext) button(ctx, 'next', 'NEXT CASE', px + 30, py + ph - 54, 160, 40, { style: 'paper', size: 26 });
    button(ctx, 'retry', 'REPLAY', px + (hasNext ? 200 : 30), py + ph - 54, 110, 40, { style: 'paper', size: 26 });
    button(ctx, 'quit', 'CASE FILES', px + (hasNext ? 320 : 150), py + ph - 54, 150, 40, { style: 'paper', size: 26 });
    if (!hasNext) { ctx.textAlign = 'left'; ctx.font = F.t(14); ctx.fillStyle = RED; ctx.fillText('Every file closed. Go back for the S ranks and the other ways in.', px + 36, py + ph - 70); }
    const c = menuInput();
    if (c === 'next') { App.levelIndex++; App.screen = 'briefing'; App.sel = 0; App.briefT = 0; }
    if (c === 'retry') startLevel(App.levelIndex);
    if (c === 'quit') { App.screen = 'select'; App.sel = App.levelIndex; }
  }

  // ------------------------------------------------------------ loop
  function frame(ctx, dt) {
    const I = LO.Input;
    App.t += dt;
    const cur = App.screen === 'play' && !App.showHelp && App.game.state === 'play' ? 'none' : 'default';
    if (ctx.canvas.style.cursor !== cur) ctx.canvas.style.cursor = cur;
    if (I.action('mute')) LO.Sfx.toggleMute();
    if (App.screen !== 'play' && App.screen !== 'paused') LO.Music.setMode('menu');
    if (App.screen === 'briefing') App.briefT = (App.briefT || 0) + dt;
    if (App.showHelp) {
      if (App.helpFrom === 'pause' || App.screen === 'play') App.game.render(ctx);
      else backdrop(ctx, App.t);
      drawHelp(ctx);
      return;
    }
    switch (App.screen) {
      case 'title': drawTitle(ctx); break;
      case 'select': drawSelect(ctx); break;
      case 'briefing': drawBriefing(ctx); break;
      case 'paused': drawPause(ctx); break;
      case 'results': App.resultsT += dt; drawResults(ctx); break;
      case 'play': {
        const g = App.game;
        if (I.action('pause') && g.state === 'play') {
          App.screen = 'paused'; App.sel = 0;
          I.pressed.clear(); I.padPressed.clear(); // the same press must not also resume
          drawPause(ctx); break;
        }
        if (I.action('restart')) { startLevel(App.levelIndex); break; }
        if (I.action('help') && g.state === 'play') { App.showHelp = true; App.helpFrom = 'play'; break; }
        g.update(dt);
        g.render(ctx);
        if (g.state === 'failed') drawFailed(ctx);
        if (g.state === 'won' && g.winT > 1.4) { App.resultsT = 0; finishLevel(); }
        break;
      }
    }
  }

  window.addEventListener('load', () => {
    const canvas = document.getElementById('game');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    LO.Input.init(canvas);
    Save.load();
    const host = canvas.parentElement;
    const fit = () => {
      const s = Math.max(0.1, Math.min(host.clientWidth / W, host.clientHeight / H));
      canvas.style.width = Math.floor(W * s) + 'px';
      canvas.style.height = Math.floor(H * s) + 'px';
    };
    window.addEventListener('resize', fit); fit();
    const lv = /[?&]level=(\d+)/.exec(location.search);
    if (lv) { Save.data.unlocked = LO.LEVELS.length; startLevel(LO.clamp(+lv[1] - 1, 0, LO.LEVELS.length - 1)); }
    let last = performance.now();
    LO.step = (dt) => { LO.Input.pollPad(); frame(ctx, dt); LO.Input.endFrame(); };
    const loop = (now) => {
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;
      if (!LO.manualStep) LO.step(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
})(window.LO);
