'use strict';
// Character art (drawn with shapes) and the heads-up display.
(function (LO) {
  // Fonts: a condensed display face, a typewriter face for notes and files, and a mono for small print.
  LO.F = {
    d: (s) => `${s}px "Bebas Neue", Impact, "Arial Narrow", sans-serif`,
    t: (s) => `${s}px "Special Elite", "Courier New", monospace`,
    m: (s, b) => `${b ? 'bold ' : ''}${s}px ui-monospace, Menlo, Consolas, monospace`,
  };

  // Fill helper: in "flat" mode every part is one color (used for the rim-light pass).
  const painter = (ctx, flat) => (c) => { ctx.fillStyle = flat || c; };

  // ------------------------------------------------------------ player
  LO.updateScarf = function (p, dt) {
    const ax = p.cx - p.dir * 3, ay = p.crouch ? p.y + 9 : p.y + 13;
    if (!p.scarf) p.scarf = Array.from({ length: 6 }, () => ({ x: ax, y: ay, px: ax, py: ay }));
    const s = p.scarf;
    s[0].x = ax; s[0].y = ay;
    const wind = -p.vx * 0.9 - p.dir * 14;
    for (let i = 1; i < s.length; i++) {
      const q = s[i];
      const vx = (q.x - q.px) * 0.86, vy = (q.y - q.py) * 0.86;
      q.px = q.x; q.py = q.y;
      q.x += vx + wind * dt * dt * 30; q.y += vy + 240 * dt * dt + Math.sin(performance.now() / 180 + i) * 0.08;
    }
    for (let k = 0; k < 3; k++) for (let i = 1; i < s.length; i++) {
      const a = s[i - 1], b = s[i];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, want = 4.2;
      b.x = a.x + (dx / d) * want; b.y = a.y + (dy / d) * want;
    }
  };

  LO.drawPlayer = function (ctx, p, t, trance, flat) {
    const P = painter(ctx, flat);
    const coat = p.disguised ? '#2c4a7a' : '#1c1f28', coatHi = p.disguised ? '#3a5d92' : '#2a2f3c';
    const trim = p.disguised ? '#1d2f50' : '#11131a';
    const x = p.cx, y = p.y, h = p.h;
    if (trance && !flat) {
      ctx.fillStyle = `rgba(201,160,255,${0.14 + Math.sin(t * 5) * 0.07})`;
      ctx.beginPath(); ctx.ellipse(x, p.cy, 17, h / 2 + 7, 0, 0, Math.PI * 2); ctx.fill();
    }
    // scarf trails behind (world space, not mirrored)
    if (p.scarf && !p.disguised) {
      ctx.strokeStyle = flat || '#7d2433'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.scarf[0].x, p.scarf[0].y);
      for (let i = 1; i < p.scarf.length; i++) { ctx.lineWidth = 3 - i * 0.35; ctx.lineTo(p.scarf[i].x, p.scarf[i].y); }
      ctx.stroke(); ctx.lineCap = 'butt';
    }
    ctx.save();
    if (p.dir < 0) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
    const moving = Math.abs(p.vx) > 12 && p.onGround;
    const run = Math.abs(p.vx) > 180;
    const sw = moving ? Math.sin(p.anim) : 0;
    if (p.crouch) {
      const sh = moving ? Math.sin(p.anim * 1.4) * 2 : 0;
      P(trim); ctx.fillRect(x - 8 + sh, y + 17, 6, 7); ctx.fillRect(x + 3 - sh, y + 17, 6, 7);
      P(coat); ctx.beginPath(); ctx.ellipse(x - 1, y + 13, 10, 7, 0.15, 0, Math.PI * 2); ctx.fill();
      P(coatHi); ctx.fillRect(x - 8, y + 9, 12, 2);
      P('#3a2a1e'); ctx.fillRect(x - 10, y + 10, 5, 7); // satchel
      P(coat); ctx.beginPath(); ctx.arc(x + 6, y + 6, 6.5, 0, Math.PI * 2); ctx.fill();
      P(trim); ctx.fillRect(x + 6, y + 4, 7, 4);
    } else {
      const lean = run ? 0.12 : 0;
      ctx.translate(x, y + h); ctx.rotate(lean); ctx.translate(-x, -(y + h));
      // legs
      let l1 = sw * (run ? 7 : 5), l2 = -l1;
      if (!p.onGround && !p.climbing) { l1 = 4; l2 = -3; }
      if (p.climbing) { l1 = Math.sin(p.anim * 2) * 3; l2 = -l1; }
      P(trim);
      ctx.fillRect(x - 5 + l1, y + h - 15, 5, 15 - Math.max(0, -l1 * 0.3));
      ctx.fillRect(x + l2, y + h - 15, 5, 15 - Math.max(0, -l2 * 0.3));
      P('#0b0c10'); ctx.fillRect(x - 6 + l1, y + h - 3, 7, 3); ctx.fillRect(x - 1 + l2, y + h - 3, 7, 3);
      // back arm
      P(trim);
      if (p.climbing) ctx.fillRect(x - 6, y + 4 - Math.sin(p.anim * 2) * 4, 4, 12);
      else ctx.fillRect(x - 4 - sw * 4, y + 15, 4, 11);
      // coat body
      P(coat); ctx.beginPath(); ctx.moveTo(x - 8, y + 13); ctx.lineTo(x + 8, y + 13); ctx.lineTo(x + 9, y + 32); ctx.lineTo(x - 9, y + 32); ctx.fill();
      P(coatHi); ctx.fillRect(x - 7, y + 14, 2, 17);
      if (p.disguised) { P('#c8b25a'); ctx.fillRect(x + 3, y + 17, 3, 3); }
      else { P('#3a2a1e'); ctx.fillRect(x - 11, y + 18, 6, 9); P('#4a3626'); ctx.fillRect(x - 9, y + 13, 2, 7); }
      P(trim); ctx.fillRect(x - 8, y + 28, 17, 2);
      // front arm: aiming, striking or swinging
      P(coatHi);
      if (p.aimT > 0) {
        ctx.save(); ctx.translate(x + 2, y + 16);
        const a = p.dir < 0 ? Math.PI - p.aimAng : p.aimAng;
        ctx.rotate(a); ctx.fillRect(0, -2, 13, 4); P('#3a3d46'); ctx.fillRect(11, -3, 6, 4); ctx.restore();
      } else if (p.takedownT > 0) {
        ctx.fillRect(x, y + 15, 15, 4); P('#0b0c10'); ctx.fillRect(x + 13, y + 14, 4, 6);
      } else if (p.climbing) {
        ctx.fillRect(x + 1, y + 4 + Math.sin(p.anim * 2) * 4, 4, 12);
      } else {
        ctx.save(); ctx.translate(x + 1, y + 15); ctx.rotate(sw * 0.6 + (p.onGround ? 0 : -0.8)); ctx.fillRect(-2, 0, 4, 11); ctx.restore();
      }
      // hooded head
      const bow = trance ? 3 : 0;
      P(coat); ctx.beginPath(); ctx.arc(x, y + 7 + bow, 7, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 7, y + 6 + bow); ctx.lineTo(x - 10, y + 12 + bow); ctx.lineTo(x - 3, y + 12 + bow); ctx.fill();
      if (p.disguised) { P('#1d2f50'); ctx.fillRect(x - 7, y - 1, 15, 4); ctx.fillRect(x + 1, y + 2, 10, 2); }
      P('#0a0b0f'); ctx.fillRect(x + 1, y + 5 + bow, 7, 5);
      P('#2a2e36'); ctx.fillRect(x - 6, y + 6 + bow, 7, 2); // goggle strap
    }
    ctx.restore();
  };

  // ------------------------------------------------------------ guards and targets
  function drawHat(P, ctx, kind, x, y, col, look) {
    switch (kind) {
      case 'hard': P(col); ctx.beginPath(); ctx.arc(x + 1, y + 2, 7.5, Math.PI, 0); ctx.fill(); ctx.fillRect(x - 8, y + 1, 18, 2.5); break;
      case 'cap': P(col); ctx.fillRect(x - 6, y - 1, 13, 5); ctx.fillRect(x + 2, y + 2, 9, 2); break;
      case 'peak': P(col); ctx.fillRect(x - 7, y - 3, 15, 5); ctx.fillRect(x - 5, y + 1, 12, 2); ctx.fillRect(x + 3, y + 2, 8, 2); P('#c8b25a'); ctx.fillRect(x, y - 2, 3, 3); break;
      case 'helmet': P(col); ctx.beginPath(); ctx.arc(x + 1, y + 3, 8, Math.PI * 1.05, -0.05); ctx.fill(); P('#222'); ctx.fillRect(x + 3, y + 3, 6, 2); break;
      case 'top': P(col); ctx.fillRect(x - 5, y - 12, 12, 13); ctx.fillRect(x - 8, y, 18, 3); P(look.chain || '#d4af37'); ctx.fillRect(x - 5, y - 4, 12, 2); break;
      case 'bowler': P(col); ctx.beginPath(); ctx.arc(x + 1, y + 1, 6.5, Math.PI, 0); ctx.fill(); ctx.fillRect(x - 8, y, 18, 2.5); break;
      case 'tiara': P(look.jewel || '#f0e0a0'); ctx.beginPath(); ctx.moveTo(x - 5, y + 2); ctx.lineTo(x - 3, y - 3); ctx.lineTo(x, y + 1); ctx.lineTo(x + 2, y - 5); ctx.lineTo(x + 4, y + 1); ctx.lineTo(x + 7, y - 3); ctx.lineTo(x + 8, y + 2); ctx.fill(); break;
      case 'none': default: P('#1a1410'); ctx.beginPath(); ctx.arc(x, y + 4, 6.5, Math.PI * 1.05, -0.1); ctx.fill(); break;
    }
  }

  function guardFigure(ctx, g, t, P, x, y, lookOverride) {
    const look = lookOverride || g.look || {};
    const target = g.isTarget;
    const body = target ? (look.gown || look.coat || '#7a2c3a') : g.stripped ? '#5f5f5f' : (look.body || '#2c4a7a');
    const dark = target ? '#2a1418' : g.stripped ? '#444' : (look.dark || '#1d2f50');
    const skin = '#c9a27e';
    const moving = Math.abs(g.vx) > 5 && g.onGround;
    const sw = moving ? Math.sin(g.anim) : 0;
    const breathe = moving ? 0 : Math.sin(t * 2 + g.x * 0.01) * 0.6;
    const alertish = g.state === 'alert' || g.state === 'flee';
    // legs
    if (target && look.gown) {
      P(body); ctx.beginPath(); ctx.moveTo(x - 6, y + 22); ctx.lineTo(x + 7, y + 22); ctx.lineTo(x + 12 + sw * 2, y + 46); ctx.lineTo(x - 11 + sw * 2, y + 46); ctx.fill();
    } else {
      P(dark); ctx.fillRect(x - 5 + sw * 5, y + 31, 5, 15); ctx.fillRect(x + sw * -5, y + 31, 5, 15);
      P('#0d0d10'); ctx.fillRect(x - 6 + sw * 5, y + 43, 7, 3); ctx.fillRect(x - 1 - sw * 5, y + 43, 7, 3);
    }
    // back arm
    P(dark); ctx.fillRect(x - 6 - sw * 3, y + 15 + breathe, 4, 12);
    // torso
    const wide = target && look.belly ? 13 : target ? 10 : 8;
    P(body); ctx.fillRect(x - wide, y + 12 + breathe, wide * 2, 21 - breathe);
    if (target && look.belly) { ctx.beginPath(); ctx.ellipse(x + 3, y + 24, 12, 9, 0, 0, Math.PI * 2); ctx.fill(); }
    if (target) {
      if (look.apron) { P(look.apron); ctx.fillRect(x - 6, y + 18, 13, 16); }
      if (look.chain) { P(look.chain); ctx.fillRect(x + 2, y + 18, 6, 1.5); ctx.fillRect(x + 7, y + 18, 1.5, 4); }
      if (look.jewel) { P(look.jewel); ctx.fillRect(x - 3, y + 13, 7, 2); }
      P('#d4af37'); if (!look.gown) ctx.fillRect(x - 1, y + 14, 2, 14);
    } else {
      if (look.tie) { P('#e8e4dc'); ctx.fillRect(x - 2, y + 12, 5, 8); P(look.tie); ctx.fillRect(x - 0.5, y + 13, 2, 7); }
      P('#c8b25a'); ctx.fillRect(x + 2, y + 16, 3, 3);
      P(dark); ctx.fillRect(x - 8, y + 28, 16, 3);
    }
    // head
    P(skin); ctx.beginPath(); ctx.arc(x + 1, y + 7 + breathe * 0.5, 6.5, 0, Math.PI * 2); ctx.fill();
    P('#1a1a1a'); ctx.fillRect(x + 4, y + 6, 2, 2);
    if (target && look.belly) { P('#5a3b2a'); ctx.fillRect(x + 3, y + 10, 6, 2); }
    if (g.possessed && !P.flat) { ctx.fillStyle = '#d6b4ff'; ctx.fillRect(x + 3.5, y + 5.5, 3, 3); }
    const hat = target ? (look.hat || 'top') : g.stripped ? 'none' : (look.hat || 'cap');
    drawHat(P, ctx, hat, x, y, target ? (look.hatColor || '#2a1015') : (look.hatColor || '#1d2f50'), look);
    // front arm: pistol when alert, flashlight, baton or swinging
    if (alertish && !target) {
      P(body); ctx.fillRect(x, y + 15, 14, 4); P('#111'); ctx.fillRect(x + 12, y + 13, 7, 3); ctx.fillRect(x + 13, y + 15, 2, 3);
    } else if (g.takedownT > 0) {
      P(body); ctx.fillRect(x, y + 15, 16, 4);
    } else if (g.flashlight) {
      P(body); ctx.fillRect(x, y + 16, 9, 4); P('#333'); ctx.fillRect(x + 7, y + 13, 7, 5); P('#fff6c8'); ctx.fillRect(x + 13, y + 13, 2, 5);
    } else {
      ctx.save(); ctx.translate(x + 1, y + 15 + breathe); ctx.rotate(-sw * 0.5);
      P(body); ctx.fillRect(-2, 0, 4, 12);
      if (target && look.baton) { P('#1a1a1a'); ctx.fillRect(-1, 10, 3, 12); }
      ctx.restore();
    }
  }

  LO.drawGuard = function (ctx, g, t, flat) {
    const P = painter(ctx, flat); P.flat = !!flat;
    if (!g.functional) {
      const fy = g.bottom;
      if (g.fallT !== undefined && g.fallT < 0.35) {
        // collapsing
        const k = g.fallT / 0.35, a = k * k * (Math.PI / 2) * (g.dir || 1);
        ctx.save(); ctx.translate(g.cx, fy); ctx.rotate(a); ctx.translate(-g.cx, -fy);
        guardFigure(ctx, g, t, P, g.cx, fy - 46);
        ctx.restore();
        return;
      }
      const look = g.look || {};
      const body = g.isTarget ? (look.gown || look.coat || '#7a2c3a') : g.stripped ? '#5f5f5f' : (look.body || '#2c4a7a');
      const d = g.dir || 1;
      const stir = g.ko && g.wakeT !== undefined && g.wakeT < 6 ? Math.sin(t * 22) * (6 - g.wakeT) * 0.25 : 0;
      ctx.save(); ctx.translate(0, -Math.abs(stir)); if (d < 0) { ctx.translate(g.cx * 2, 0); ctx.scale(-1, 1); }
      P(look.dark || '#1d2f50'); ctx.fillRect(g.cx - 22, fy - 7, 16, 6);
      P(body); ctx.fillRect(g.cx - 8, fy - 10, 22, 9);
      P('#c9a27e'); ctx.beginPath(); ctx.arc(g.cx + 19, fy - 6, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (!flat && g.ko) {
        const waking = g.wakeT !== undefined && g.wakeT < 6;
        ctx.textAlign = 'center';
        if (waking) { ctx.fillStyle = '#ffaa3c'; ctx.font = LO.F.d(16); ctx.fillText('!?', g.cx + d * 18, fy - 18 + Math.sin(t * 12) * 2); }
        else { ctx.fillStyle = '#ffe9a8'; ctx.font = LO.F.d(11); ctx.fillText('z', g.cx + d * 22 + Math.sin(t * 2) * 2, fy - 16 - (t * 8) % 8); }
        if (g.wakeT !== undefined && g.wakeMax) {
          // how long until they come round
          const k = Math.max(0, g.wakeT / g.wakeMax);
          ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,0.45)';
          ctx.beginPath(); ctx.arc(g.cx + d * 18, fy - 6, 5, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = waking ? '#ffaa3c' : 'rgba(255,233,168,0.8)';
          ctx.beginPath(); ctx.arc(g.cx + d * 18, fy - 6, 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
        }
      }
      return;
    }
    const x = g.cx, y = g.y;
    ctx.save();
    if (g.dir < 0) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
    if (g.possessed && !flat) {
      ctx.fillStyle = `rgba(201,160,255,${0.18 + Math.sin(t * 6) * 0.08})`;
      ctx.beginPath(); ctx.ellipse(x, g.cy, 17, 30, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (g.state === 'dazed') { ctx.translate(x, y + 46); ctx.rotate(Math.sin(t * 5) * 0.06); ctx.translate(-x, -(y + 46)); }
    guardFigure(ctx, g, t, P, x, y);
    ctx.restore();
  };

  // A large portrait of a target, for the case file.
  LO.drawPortrait = function (ctx, look, x, y, scale) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    const fake = { isTarget: true, look, vx: 0, anim: 0, onGround: true, state: 'patrol', x: 0, functional: true };
    const P = painter(ctx, null);
    guardFigure(ctx, fake, 0, P, 0, 0, look);
    ctx.restore();
  };

  LO.drawCritter = function (ctx, c, t) {
    const x = c.cx, y = c.bottom;
    ctx.save();
    if (c.dir < 0) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
    if (c.possessed) {
      ctx.fillStyle = `rgba(201,160,255,${0.2 + Math.sin(t * 6) * 0.1})`;
      ctx.beginPath(); ctx.ellipse(x, y - 6, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (c.dead) { ctx.fillStyle = '#4a3f38'; ctx.fillRect(x - 7, y - 4, 14, 4); ctx.restore(); return; }
    const hop = Math.abs(Math.sin(c.anim)) * 2;
    ctx.fillStyle = '#5b4d44';
    ctx.beginPath(); ctx.ellipse(x - 1, y - 5 - hop, 7, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 6, y - 6 - hop, 3.5, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a6a60'; ctx.fillRect(x + 3, y - 10 - hop, 2, 2);
    ctx.strokeStyle = '#8a6a60'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x - 7, y - 4 - hop); ctx.quadraticCurveTo(x - 14, y - 2, x - 15, y - 8 + Math.sin(t * 8) * 2); ctx.stroke();
    ctx.fillStyle = c.possessed ? '#d6b4ff' : '#ff6060'; ctx.fillRect(x + 7, y - 7 - hop, 1.5, 1.5);
    ctx.restore();
  };

  LO.drawWorker = function (ctx, x, y, dir, t) {
    ctx.save();
    if (dir < 0) { ctx.translate((x + 10) * 2, 0); ctx.scale(-1, 1); }
    ctx.fillStyle = '#5e5442'; ctx.fillRect(x + 4, y + 30, 4, 12); ctx.fillRect(x + 11, y + 30, 4, 12);
    ctx.fillStyle = '#8a7f62'; ctx.fillRect(x + 2, y + 12, 16, 20);
    ctx.fillStyle = '#6e654d'; ctx.fillRect(x + 5, y + 12, 3, 10); ctx.fillRect(x + 12, y + 12, 3, 10);
    ctx.fillStyle = '#b8936e'; ctx.beginPath(); ctx.arc(x + 10, y + 8, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2f22'; ctx.fillRect(x + 4, y + 1, 12, 3);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x + 12, y + 7, 2, 2);
    ctx.restore();
  };

  // ------------------------------------------------------------ HUD pieces
  function panel(ctx, x, y, w, h, alpha = 0.72) {
    ctx.fillStyle = `rgba(6,8,14,${alpha})`;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,230,180,0.1)'; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
  LO.panel = panel;

  LO.wrapText = function (ctx, text, maxW) {
    const words = text.split(' ');
    const lines = []; let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  };

  const PAD_COLORS = { A: '#5bd16a', B: '#e5534b', X: '#4a8fe7', Y: '#e8c547' };
  // A keycap on keyboard, a colored face button on a controller.
  LO.drawButtonGlyph = function (ctx, action, x, y, r = 10) {
    const label = LO.Input.label(action);
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (LO.Input.usingPad && PAD_COLORS[label]) {
      ctx.fillStyle = PAD_COLORS[label]; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(x, y + r * 0.15, r * 0.82, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#10131a'; ctx.font = LO.F.d(Math.round(r * 1.5)); ctx.fillText(label, x, y + 1);
    } else {
      ctx.font = LO.F.d(Math.round(r * 1.4));
      const w = Math.max(r * 2, ctx.measureText(label).width + r);
      ctx.fillStyle = '#e9e2d0'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - r, w, r * 2, 3); ctx.fill();
      ctx.fillStyle = '#b3aa94'; ctx.fillRect(x - w / 2 + 1, y + r - 3, w - 2, 2);
      ctx.fillStyle = '#16181f'; ctx.fillText(label, x, y + 0.5);
    }
    ctx.restore();
  };
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
  }

  // The visibility eye: shut when hidden, wide open and red when exposed.
  function drawEye(ctx, g) {
    const p = g.player;
    const cx = 50, cy = 50;
    const L = p.hidden ? 0 : g.playerLight || 0;
    ctx.fillStyle = 'rgba(6,8,14,0.8)'; ctx.beginPath(); ctx.arc(cx, cy, 36, 0, Math.PI * 2); ctx.fill();
    // WILL ring
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(120,90,180,0.22)';
    ctx.beginPath(); ctx.arc(cx, cy, 31, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = g.energy >= 2.5 ? '#b48cff' : '#5d4a80';
    ctx.beginPath(); ctx.arc(cx, cy, 31, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * g.energy) / g.maxEnergy); ctx.stroke();
    const open = p.hidden ? 0 : 0.12 + Math.min(1, L * 1.4) * 0.88;
    const col = p.hidden || L < 0.08 ? '#7dff8a' : L < 0.35 ? '#ffd166' : '#ff5c4c';
    const w = 19, hgt = 13 * open;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(cx - w, cy); ctx.quadraticCurveTo(cx, cy - hgt * 1.6, cx + w, cy); ctx.quadraticCurveTo(cx, cy + hgt * 1.6, cx - w, cy); ctx.closePath();
    ctx.fillStyle = '#d8cfbb'; ctx.fill(); ctx.clip();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.arc(cx, cy, 3.5 + L * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(cx + 2, cy - 4, 2, 2);
    ctx.restore();
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - w, cy); ctx.quadraticCurveTo(cx, cy - hgt * 1.6, cx + w, cy); ctx.stroke();
    if (open < 0.05) {
      ctx.beginPath(); for (const k of [-10, -3, 4, 11]) { ctx.moveTo(cx + k, cy + 1); ctx.lineTo(cx + k - 1, cy + 5); } ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(cx - w, cy); ctx.quadraticCurveTo(cx, cy + hgt * 1.6, cx + w, cy); ctx.stroke();
    }
    return { col, label: p.hidden ? (p.locker ? 'HIDDEN · LOCKER' : 'HIDDEN · VENT') : L < 0.08 ? 'IN SHADOW' : L < 0.35 ? 'DIM' : 'EXPOSED' };
  }

  function pelletIcon(ctx, x, y) { ctx.fillStyle = '#d6b14a'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + i * 4, y, 2, 0, Math.PI * 2); ctx.fill(); } }
  function bottleIcon(ctx, x, y) { ctx.fillStyle = '#4f9a72'; ctx.fillRect(x, y - 4, 6, 10); ctx.fillRect(x + 2, y - 9, 2, 5); }

  // ------------------------------------------------------------ HUD
  LO.drawHUD = function (ctx, g) {
    const p = g.player, I = LO.Input, W = LO.VIEW_W, H = LO.VIEW_H;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const eye = drawEye(ctx, g);
    ctx.font = LO.F.d(24); ctx.fillStyle = '#000'; ctx.fillText(eye.label, 93, 45);
    ctx.fillStyle = eye.col; ctx.fillText(eye.label, 92, 44);
    ctx.font = LO.F.d(18);
    pelletIcon(ctx, 94, 62); ctx.fillStyle = '#e8dcc0'; ctx.fillText(String(g.ammo), 110, 68);
    bottleIcon(ctx, 132, 63); ctx.fillText(String(g.bottles), 142, 68);
    ctx.font = LO.F.m(9); ctx.fillStyle = 'rgba(200,180,255,0.6)'; ctx.fillText('WILL', 162, 67);
    if (p.disguised) {
      const k = Math.max(0, p.cover / p.coverMax);
      const low = k < 0.3;
      ctx.fillStyle = '#2c4a7a'; ctx.fillRect(92, 79, 12, 4); ctx.fillRect(96, 77, 10, 2);
      ctx.font = LO.F.d(15); ctx.fillStyle = low ? '#ffaa3c' : '#8fd3ff';
      ctx.fillText(p.scrutiny ? 'UNIFORM · UNDER SCRUTINY' : 'UNIFORM', 110, 84);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(92, 89, 130, 5);
      ctx.fillStyle = low && Math.sin(g.time * 12) > 0 ? '#ffaa3c' : '#5fa8e0'; ctx.fillRect(92, 89, 130 * k, 5);
    }

    // objective
    const tname = g.target ? g.target.name : 'the target';
    const done = !!g.targetDown;
    ctx.font = LO.F.t(15);
    const objA = done ? 'ESCAPE' : 'TARGET', objB = done ? 'Reach the exit' : tname;
    const ow = Math.max(230, ctx.measureText(objB).width + 100);
    panel(ctx, W - ow - 12, 12, ow, 56);
    ctx.textAlign = 'left';
    ctx.font = LO.F.d(17); ctx.fillStyle = done ? '#7dff8a' : '#ff7a5c';
    ctx.fillText(objA, W - ow, 34);
    ctx.textAlign = 'right';
    ctx.font = LO.F.t(15); ctx.fillStyle = '#efe4c8';
    ctx.fillText(objB, W - 24, 34);
    ctx.font = LO.F.m(10); ctx.fillStyle = '#a9a6b8';
    const m = Math.floor(g.time / 60), s = Math.floor(g.time % 60);
    let info = `${m}:${String(s).padStart(2, '0')}   ALARMS ${g.stats.alarms}`;
    if (g.totalWorkers) info = `FREED ${g.stats.freed}/${g.totalWorkers}   ` + info;
    ctx.fillText(info, W - 24, 56);

    // banner: a film-style band for big moments, a note for longer messages
    ctx.textAlign = 'center';
    if (g.banner) {
      const a = Math.min(1, g.banner.t * 2, (g.banner.max - g.banner.t) * 5 + 0.2);
      ctx.globalAlpha = a;
      if (g.banner.text.length <= 42) {
        const by = 96;
        ctx.fillStyle = 'rgba(4,5,10,0.78)'; ctx.fillRect(0, by, W, 46);
        ctx.fillStyle = 'rgba(255,220,160,0.25)'; ctx.fillRect(0, by, W, 1); ctx.fillRect(0, by + 45, W, 1);
        ctx.font = LO.F.d(32); ctx.fillStyle = /ALARM|TRIPWIRE|BLOWN/.test(g.banner.text) ? '#ff6b5c' : /NEUTRAL/.test(g.banner.text) ? '#ffd166' : '#f2ead8';
        const spaced = g.banner.text.split('').join(String.fromCharCode(8202));
        ctx.fillText(spaced, W / 2, by + 34);
      } else {
        ctx.font = LO.F.t(15);
        const lines = LO.wrapText(ctx, g.banner.text, 560);
        panel(ctx, W / 2 - 300, 96, 600, 16 + lines.length * 20, 0.82);
        ctx.fillStyle = '#efe4c8';
        lines.forEach((ln, i) => ctx.fillText(ln, W / 2, 116 + i * 20));
      }
      ctx.globalAlpha = 1;
    }

    // prompt
    const inter = g.interaction;
    if (inter && g.state === 'play') {
      ctx.font = LO.F.d(22);
      const label = inter.label + (inter.hold && !inter.disabled ? '  (HOLD)' : '');
      const tw = ctx.measureText(label).width;
      const w = tw + (inter.disabled ? 30 : 64);
      panel(ctx, W / 2 - w / 2, H - 50, w, 34, 0.8);
      if (!inter.disabled) LO.drawButtonGlyph(ctx, 'interact', W / 2 - w / 2 + 22, H - 33, 11);
      ctx.textAlign = 'left';
      ctx.fillStyle = inter.disabled ? '#8a8a8a' : inter.danger ? '#ffd166' : '#f2ead8';
      ctx.fillText(label, W / 2 - w / 2 + (inter.disabled ? 15 : 42), H - 25);
      ctx.textAlign = 'center';
    }

    // signs: a pinned paper note, kept on the half of the screen away from you
    const cur = g.controlled;
    for (const sgn of g.signs) {
      if (Math.abs(sgn.x + 8 - cur.cx) < 48 && Math.abs(sgn.y + 13 - cur.cy) < 48 && sgn.text) {
        ctx.font = LO.F.t(15);
        const lines = LO.wrapText(ctx, LO.Input.fill(sgn.text), 520);
        const h = 26 + lines.length * 20;
        const sy = cur.cy - g.cam.y;
        if (sy > H * 0.55) g.tipTop = true;
        else if (sy < H * 0.45) g.tipTop = false;
        const y = g.tipTop ? 128 : H - 62 - h;
        ctx.save();
        ctx.translate(W / 2, y + h / 2); ctx.rotate(-0.008);
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(-284, -h / 2 + 4, 572, h);
        ctx.fillStyle = '#e9e0c9'; ctx.fillRect(-288, -h / 2, 576, h);
        ctx.fillStyle = 'rgba(120,90,40,0.12)'; ctx.fillRect(-288, -h / 2, 576, 6);
        ctx.fillStyle = '#b8322a'; ctx.beginPath(); ctx.arc(0, -h / 2 + 3, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a2418';
        lines.forEach((ln, i) => ctx.fillText(ln, 0, -h / 2 + 26 + i * 20));
        ctx.restore();
        break;
      }
    }

    // off-screen arrows: where the target is, and who is onto you
    for (const gd of g.guards) {
      if (!gd.functional || gd.possessed) continue;
      const alertish = gd.state === 'alert' || gd.state === 'flee';
      if (!gd.isTarget && !alertish && gd.susp < 0.3) continue;
      const sx = gd.cx - g.cam.x, sy = gd.cy - g.cam.y;
      if (sx > 10 && sx < W - 10 && sy > 10 && sy < H - 10) continue;
      const cx = LO.clamp(sx, 28, W - 28), cy = LO.clamp(sy, 100, H - 70);
      const a = Math.atan2(sy - cy, sx - cx);
      const col = alertish ? '#ff4a3a' : gd.isTarget ? '#ffd166' : '#ffaa3c';
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
      ctx.globalAlpha = alertish ? 0.7 + Math.sin(g.time * 10) * 0.3 : 0.85;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(-7, -9); ctx.lineTo(-7, 9); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-5, -7); ctx.lineTo(-5, 7); ctx.fill();
      ctx.restore();
      if (gd.isTarget) { ctx.font = LO.F.d(13); ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText('TARGET', cx - Math.cos(a) * 20, cy - Math.sin(a) * 20 + 4); }
    }
    ctx.globalAlpha = 1;

    if (g.controlled !== p) {
      ctx.font = LO.F.d(19); ctx.fillStyle = '#c9a0ff';
      const who = g.controlled.kind === 'critter' ? 'a rat' : g.controlled.name.toLowerCase();
      ctx.fillText(`POSSESSING ${who.toUpperCase()}  ·  ${LO.Input.label('possess')} TO RETURN  ·  YOUR BODY IS DEFENSELESS`, W / 2, H - 62 - (inter ? 0 : -36));
    }
    ctx.textAlign = 'left';
    ctx.font = LO.F.m(10); ctx.fillStyle = 'rgba(200,190,170,0.5)';
    ctx.fillText(I.usingPad ? 'BACK  controls    START  pause' : 'H  controls    ESC  pause    R  restart', 14, H - 10);
  };
})(window.LO);
