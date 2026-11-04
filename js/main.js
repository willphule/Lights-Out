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

  function startLevel(i) {
    App.levelIndex = i;
    App.game = new LO.Game(LO.LEVELS[i], i);
    App.screen = 'play';
    App.showHelp = false;
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
  }

  // ------------------------------------------------------------ ui helpers
  function button(ctx, id, label, x, y, w, h, opts = {}) {
    const m = LO.Input.mouse;
    const hover = m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h;
    if (hover && m.moved) App.sel = App.buttons.length;
    const selected = App.sel === App.buttons.length;
    App.buttons.push({ id, x, y, w, h, disabled: opts.disabled });
    ctx.fillStyle = opts.disabled ? 'rgba(20,22,30,0.7)' : selected ? 'rgba(255,209,102,0.16)' : 'rgba(14,16,26,0.85)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = opts.disabled ? '#2a2e3a' : selected ? '#ffd166' : '#3a4056';
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = opts.disabled ? '#555b6c' : selected ? '#ffd166' : '#d8dce6';
    ctx.font = opts.font || 'bold 14px monospace';
    ctx.textAlign = opts.align || 'center';
    ctx.fillText(label, opts.align === 'left' ? x + 14 : x + w / 2, y + h / 2 + 5);
    return selected;
  }

  function menuInput() {
    const I = LO.Input;
    const n = App.buttons.length;
    if (!n) return null;
    if (I.wasPressed('ArrowDown', 'KeyS', 'Tab')) { App.sel = (App.sel + 1) % n; LO.Sfx.play('click'); }
    if (I.wasPressed('ArrowUp', 'KeyW')) { App.sel = (App.sel - 1 + n) % n; LO.Sfx.play('click'); }
    App.sel = LO.clamp(App.sel, 0, n - 1);
    let chosen = null;
    if (I.wasPressed('Enter', 'Space')) chosen = App.buttons[App.sel];
    if (I.mouse.pressed) {
      const m = I.mouse;
      for (const b of App.buttons) if (m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h) chosen = b;
    }
    if (chosen && chosen.disabled) { LO.Sfx.play('deny'); return null; }
    if (chosen) LO.Sfx.play('click');
    return chosen ? chosen.id : null;
  }

  function backdrop(ctx, t) {
    ctx.fillStyle = '#06070d'; ctx.fillRect(0, 0, W, H);
    // a single swinging lamp over a dark room
    const sw = Math.sin(t * 0.8) * 0.12;
    const lx = W * 0.72 + Math.sin(sw) * 160, ly = 60 + Math.cos(sw) * 10;
    ctx.strokeStyle = '#1a1c22'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W * 0.72, -10); ctx.lineTo(lx, ly); ctx.stroke();
    const flick = Math.random() < 0.02 ? 0.3 : 1;
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly + 200, 420);
    g.addColorStop(0, `rgba(255,214,150,${0.22 * flick})`); g.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(lx - 8, ly); ctx.lineTo(lx - 260, H); ctx.lineTo(lx + 260, H); ctx.lineTo(lx + 8, ly); ctx.fill();
    ctx.fillStyle = `rgba(255,243,196,${flick})`; ctx.beginPath(); ctx.arc(lx, ly + 4, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0d0f17'; ctx.fillRect(0, H - 40, W, 40);
    // a silhouette keeping to the dark edge
    const px = W * 0.25;
    ctx.fillStyle = '#000';
    ctx.fillRect(px - 8, H - 76, 16, 22); ctx.beginPath(); ctx.arc(px, H - 84, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(px - 6, H - 56, 5, 16); ctx.fillRect(px + 1, H - 56, 5, 16);
    ctx.fillStyle = '#7dff8a'; ctx.fillRect(px + 2, H - 86, 6, 2);
  }

  function title(ctx, text, y, size = 54) {
    ctx.textAlign = 'center';
    ctx.font = `bold ${size}px monospace`;
    ctx.fillStyle = '#000'; ctx.fillText(text, W / 2 + 3, y + 3);
    ctx.fillStyle = '#f0e6cc'; ctx.fillText(text, W / 2, y);
  }

  // ------------------------------------------------------------ screens
  function drawTitle(ctx) {
    backdrop(ctx, App.t);
    ctx.textAlign = 'center';
    const flick = Math.sin(App.t * 13) > 0.97 ? 0.4 : 1;
    ctx.font = 'bold 76px monospace';
    ctx.fillStyle = '#000'; ctx.fillText('LIGHTS OUT', W / 2 + 4, 154);
    ctx.globalAlpha = flick; ctx.fillStyle = '#f0e6cc'; ctx.fillText('LIGHTS', W / 2 - 110, 150);
    ctx.globalAlpha = 1; ctx.fillStyle = '#3a3f55'; ctx.fillText('OUT', W / 2 + 165, 150);
    ctx.font = '15px monospace'; ctx.fillStyle = '#9aa3b8';
    ctx.fillText('A stealth platformer. Every level is a sandbox. Every shadow is a door.', W / 2, 192);
    App.buttons = [];
    button(ctx, 'play', 'PLAY', W / 2 - 110, 260, 220, 42);
    button(ctx, 'help', 'CONTROLS', W / 2 - 110, 312, 220, 42);
    button(ctx, 'mute', LO.Sfx.muted ? 'SOUND: OFF' : 'SOUND: ON', W / 2 - 110, 364, 220, 42);
    const c = menuInput();
    if (c === 'play') { App.screen = 'select'; App.sel = Math.min(Save.data.unlocked, LO.LEVELS.length) - 1; }
    if (c === 'help') { App.showHelp = true; App.helpFrom = 'title'; }
    if (c === 'mute') LO.Sfx.toggleMute();
  }

  function drawSelect(ctx) {
    backdrop(ctx, App.t);
    title(ctx, 'MISSIONS', 80, 40);
    App.buttons = [];
    LO.LEVELS.forEach((lv, i) => {
      const y = 120 + i * 104;
      const locked = i >= Save.data.unlocked;
      const rec = Save.level(lv.id);
      button(ctx, 'lv' + i, '', 140, y, W - 280, 92, { disabled: locked });
      ctx.textAlign = 'left';
      ctx.font = 'bold 20px monospace'; ctx.fillStyle = locked ? '#555b6c' : '#f0e6cc';
      ctx.fillText(`${i + 1}. ${locked ? '???' : lv.name}`, 164, y + 32);
      ctx.font = '13px monospace'; ctx.fillStyle = locked ? '#444' : '#9aa3b8';
      ctx.fillText(locked ? 'Complete the previous mission to unlock' : `${lv.place}  ·  Target: ${lv.target.name}`, 164, y + 54);
      if (!locked) {
        const found = lv.approaches.filter((a) => rec.found[a.key]).length;
        ctx.fillText(`Approaches discovered ${found}/${lv.approaches.length}`, 164, y + 76);
        ctx.textAlign = 'right';
        ctx.font = 'bold 44px monospace'; ctx.fillStyle = rec.best ? RANK_COLORS[rec.best] : '#2d3242';
        ctx.fillText(rec.best || '–', W - 168, y + 58);
        ctx.font = '11px monospace'; ctx.fillStyle = '#7d8598';
        ctx.fillText(rec.best ? `best ${rec.score}` : 'unranked', W - 168, y + 78);
      }
    });
    button(ctx, 'back', 'BACK', W / 2 - 80, H - 66, 160, 38);
    const c = menuInput();
    if (c === 'back' || LO.Input.wasPressed('Escape')) { App.screen = 'title'; App.sel = 0; }
    else if (c && c.startsWith('lv')) { App.levelIndex = +c.slice(2); App.screen = 'briefing'; App.sel = 0; }
  }

  function drawBriefing(ctx) {
    const lv = LO.LEVELS[App.levelIndex];
    const rec = Save.level(lv.id);
    backdrop(ctx, App.t);
    ctx.fillStyle = 'rgba(6,7,13,0.75)'; ctx.fillRect(60, 30, W - 120, H - 60);
    LO.panel(ctx, 60, 30, W - 120, H - 60);
    ctx.textAlign = 'left';
    ctx.font = '12px monospace'; ctx.fillStyle = '#7d8598';
    ctx.fillText(`MISSION ${App.levelIndex + 1}  ·  ${lv.place.toUpperCase()}`, 90, 64);
    ctx.font = 'bold 30px monospace'; ctx.fillStyle = '#f0e6cc'; ctx.fillText(lv.name, 90, 100);
    ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#ffd166'; ctx.fillText(`TARGET: ${lv.target.name.toUpperCase()}`, 90, 128);
    ctx.font = '14px sans-serif'; ctx.fillStyle = '#c8cdd8';
    LO.wrapText(ctx, lv.briefing, W - 200).forEach((ln, i) => ctx.fillText(ln, 90, 156 + i * 20));
    ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#9aa3b8'; ctx.fillText('INTEL: WAYS IN', 90, 236);
    lv.approaches.forEach((a, i) => {
      const y = 260 + i * 34;
      const got = rec.found[a.key];
      ctx.font = 'bold 13px monospace'; ctx.fillStyle = got ? '#7dff8a' : '#e8dcc0';
      ctx.fillText(`${got ? '✓' : '○'} ${a.name}`, 100, y);
      ctx.font = '12px sans-serif'; ctx.fillStyle = '#9aa3b8';
      ctx.fillText(a.hint, 120, y + 16);
    });
    ctx.font = '12px monospace'; ctx.fillStyle = '#7d8598';
    ctx.fillText(`Loadout: ${lv.ammo} pellets · ${lv.bottles} bottles · par ${Math.floor(lv.par / 60)}:${String(lv.par % 60).padStart(2, '0')}`, 90, H - 80);
    App.buttons = [];
    button(ctx, 'go', 'BEGIN', W - 300, H - 104, 180, 40);
    button(ctx, 'back', 'BACK', W - 300, H - 58, 180, 26, { font: '12px monospace' });
    const c = menuInput();
    if (c === 'go') startLevel(App.levelIndex);
    if (c === 'back' || LO.Input.wasPressed('Escape')) { App.screen = 'select'; App.sel = App.levelIndex; }
  }

  function drawHelp(ctx) {
    ctx.fillStyle = 'rgba(4,5,10,0.88)'; ctx.fillRect(0, 0, W, H);
    title(ctx, 'CONTROLS', 70, 32);
    const rows = [
      ['A / D', 'Move'], ['Space (or W)', 'Jump'], ['S', 'Crouch: quieter, smaller, fits in vents'],
      ['S + Space', 'Drop through a platform'], ['W / S on a ladder', 'Climb'], ['Shift', 'Run (loud)'],
      ['Mouse + Left click', 'Shoot a pellet: break lights, cut ropes, hit fuse boxes'],
      ['Right click / F', 'Throw a bottle to make a distraction'],
      ['E', 'Interact: takedown from behind, take uniform, free workers, levers, lockers, exit'],
      ['Q', 'Possess a guard or rat near the mouse. Q again to return'],
      ['Esc / P', 'Pause'], ['R', 'Restart mission'], ['M', 'Mute'],
    ];
    rows.forEach(([k, v], i) => {
      const y = 116 + i * 28;
      ctx.textAlign = 'right'; ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#ffd166'; ctx.fillText(k, 340, y);
      ctx.textAlign = 'left'; ctx.font = '14px sans-serif'; ctx.fillStyle = '#d8dce6'; ctx.fillText(v, 364, y);
    });
    ctx.textAlign = 'center'; ctx.font = '13px monospace'; ctx.fillStyle = '#7d8598';
    ctx.fillText('Guards see what is lit. Their cones show where they are looking. Noise rings show what they can hear.', W / 2, H - 46);
    ctx.fillText('Press any key to close', W / 2, H - 22);
    if (LO.Input.pressed.size || LO.Input.mouse.pressed) { App.showHelp = false; LO.Input.pressed.clear(); LO.Input.mouse.pressed = false; }
  }

  function drawPause(ctx) {
    App.game.render(ctx);
    ctx.fillStyle = 'rgba(4,5,10,0.75)'; ctx.fillRect(0, 0, W, H);
    title(ctx, 'PAUSED', 150, 40);
    App.buttons = [];
    button(ctx, 'resume', 'RESUME', W / 2 - 110, 200, 220, 40);
    button(ctx, 'restart', 'RESTART', W / 2 - 110, 250, 220, 40);
    button(ctx, 'help', 'CONTROLS', W / 2 - 110, 300, 220, 40);
    button(ctx, 'quit', 'QUIT TO MISSIONS', W / 2 - 110, 350, 220, 40);
    const c = menuInput();
    if (c === 'resume' || LO.Input.wasPressed('Escape', 'KeyP')) App.screen = 'play';
    if (c === 'restart') startLevel(App.levelIndex);
    if (c === 'help') { App.showHelp = true; App.helpFrom = 'pause'; }
    if (c === 'quit') { App.screen = 'select'; App.sel = App.levelIndex; }
  }

  function drawFailed(ctx) {
    const g = App.game;
    const a = Math.min(1, g.failT * 1.5);
    ctx.fillStyle = `rgba(30,4,6,${0.7 * a})`; ctx.fillRect(0, 0, W, H);
    if (g.failT < 0.4) return;
    title(ctx, 'MISSION FAILED', 170, 44);
    ctx.textAlign = 'center'; ctx.font = '16px sans-serif'; ctx.fillStyle = '#ffb0a8';
    ctx.fillText(g.failReason, W / 2, 210);
    App.buttons = [];
    button(ctx, 'retry', 'RETRY  [R]', W / 2 - 110, 260, 220, 40);
    button(ctx, 'quit', 'MISSIONS', W / 2 - 110, 310, 220, 40);
    const c = menuInput();
    if (c === 'retry') startLevel(App.levelIndex);
    if (c === 'quit' || LO.Input.wasPressed('Escape')) { App.screen = 'select'; App.sel = App.levelIndex; }
  }

  function drawResults(ctx) {
    const g = App.game, r = g.results;
    backdrop(ctx, App.t);
    ctx.fillStyle = 'rgba(6,7,13,0.75)'; ctx.fillRect(50, 24, W - 100, H - 48);
    LO.panel(ctx, 50, 24, W - 100, H - 48);
    ctx.textAlign = 'left';
    ctx.font = '12px monospace'; ctx.fillStyle = '#7d8598';
    ctx.fillText(`MISSION COMPLETE  ·  ${g.def.name.toUpperCase()}`, 80, 56);
    const m = Math.floor(r.time / 60), s = Math.floor(r.time % 60);
    ctx.font = 'bold 16px monospace'; ctx.fillStyle = '#f0e6cc';
    ctx.fillText(`Target: ${g.target.name} · ${LO.METHOD_NAMES[r.method]} · ${m}:${String(s).padStart(2, '0')}`, 80, 82);
    r.lines.forEach((ln, i) => {
      const y = 116 + i * 22;
      ctx.textAlign = 'left'; ctx.font = '13px monospace'; ctx.fillStyle = '#c8cdd8'; ctx.fillText(ln.label, 80, y);
      ctx.textAlign = 'right'; ctx.fillStyle = ln.pts >= 0 ? '#9dffb0' : '#ff8a7a';
      ctx.fillText((ln.pts >= 0 ? '+' : '') + ln.pts, 520, y);
    });
    const ly = 116 + r.lines.length * 22;
    ctx.strokeStyle = '#3a4056'; ctx.beginPath(); ctx.moveTo(80, ly - 12); ctx.lineTo(520, ly - 12); ctx.stroke();
    ctx.textAlign = 'left'; ctx.font = 'bold 15px monospace'; ctx.fillStyle = '#f0e6cc'; ctx.fillText('SCORE', 80, ly + 8);
    ctx.textAlign = 'right'; ctx.fillText(String(r.score), 520, ly + 8);

    // rank
    const pop = Math.min(1, App.resultsT * 2.5);
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(120 * (1.6 - pop * 0.6))}px monospace`;
    ctx.globalAlpha = pop;
    ctx.fillStyle = RANK_COLORS[r.rank]; ctx.fillText(r.rank, 720, 196);
    ctx.globalAlpha = 1;
    ctx.font = 'bold 16px monospace'; ctx.fillText(RANKS[r.rank].toUpperCase(), 720, 226);
    if (r.newBest) { ctx.font = '12px monospace'; ctx.fillStyle = '#ffd166'; ctx.fillText('NEW BEST', 720, 246); }
    // approach
    ctx.font = '12px monospace'; ctx.fillStyle = '#9aa3b8';
    if (r.approach) {
      ctx.fillText('Approach: ' + r.approach.name + (r.newApproach ? '  (new!)' : ''), 720, 274);
    } else ctx.fillText('An approach nobody planned for.', 720, 274);
    const rec = Save.level(g.def.id);
    const found = g.def.approaches.filter((a) => rec.found[a.key]).length;
    ctx.fillText(`Approaches discovered ${found}/${g.def.approaches.length}`, 720, 292);
    // badges
    r.badges.slice(0, 5).forEach((b, i) => {
      const y = 320 + i * 30;
      ctx.fillStyle = 'rgba(255,209,102,0.1)'; ctx.fillRect(572, y - 14, 300, 26);
      ctx.textAlign = 'left'; ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#ffd166'; ctx.fillText('★ ' + b[0], 582, y + 3);
      ctx.font = '11px sans-serif'; ctx.fillStyle = '#9aa3b8'; ctx.fillText(b[1], 728, y + 3);
    });
    App.buttons = [];
    const hasNext = App.levelIndex + 1 < LO.LEVELS.length;
    if (hasNext) button(ctx, 'next', 'NEXT MISSION', 80, H - 86, 180, 38);
    button(ctx, 'retry', 'REPLAY', hasNext ? 272 : 80, H - 86, 140, 38);
    button(ctx, 'quit', 'MISSIONS', hasNext ? 424 : 232, H - 86, 140, 38);
    if (!hasNext) { ctx.textAlign = 'left'; ctx.font = '13px monospace'; ctx.fillStyle = '#9dffb0'; ctx.fillText('Every mission done. Try for S ranks and the other approaches.', 80, H - 100); }
    const c = menuInput();
    if (c === 'next') { App.levelIndex++; App.screen = 'briefing'; App.sel = 0; }
    if (c === 'retry') startLevel(App.levelIndex);
    if (c === 'quit') { App.screen = 'select'; App.sel = App.levelIndex; }
  }

  // ------------------------------------------------------------ loop
  function frame(ctx, dt) {
    const I = LO.Input;
    App.t += dt;
    const cur = App.screen === 'play' && !App.showHelp && App.game.state === 'play' ? 'none' : 'default';
    if (ctx.canvas.style.cursor !== cur) ctx.canvas.style.cursor = cur;
    if (I.wasPressed('KeyM')) LO.Sfx.toggleMute();
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
        if (I.wasPressed('Escape', 'KeyP') && g.state === 'play') { App.screen = 'paused'; App.sel = 0; drawPause(ctx); break; }
        if (I.wasPressed('KeyR')) { startLevel(App.levelIndex); break; }
        if (I.wasPressed('KeyH') && g.state === 'play') { App.showHelp = true; App.helpFrom = 'play'; break; }
        g.update(dt);
        g.render(ctx);
        if (g.state === 'failed') drawFailed(ctx);
        if (g.state === 'won') { App.resultsT = 0; finishLevel(); }
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
    const fit = () => {
      const s = Math.min(window.innerWidth / W, window.innerHeight / H);
      canvas.style.width = Math.floor(W * s) + 'px';
      canvas.style.height = Math.floor(H * s) + 'px';
    };
    window.addEventListener('resize', fit); fit();
    const lv = /[?&]level=(\d+)/.exec(location.search);
    if (lv) { Save.data.unlocked = LO.LEVELS.length; startLevel(LO.clamp(+lv[1] - 1, 0, LO.LEVELS.length - 1)); }
    let last = performance.now();
    LO.step = (dt) => { frame(ctx, dt); LO.Input.endFrame(); };
    const loop = (now) => {
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;
      if (!LO.manualStep) LO.step(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
})(window.LO);
