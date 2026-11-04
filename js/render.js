'use strict';
// Character art (drawn with shapes) and the heads-up display.
(function (LO) {
  function legs(ctx, x, y, h, anim, color, moving) {
    const s = moving ? Math.sin(anim) * 4 : 0;
    ctx.fillStyle = color;
    ctx.fillRect(x - 5 + s, y + h - 14, 4, 14);
    ctx.fillRect(x + 1 - s, y + h - 14, 4, 14);
  }

  function lying(ctx, a, body, head, extra) {
    const y = a.bottom;
    ctx.fillStyle = body;
    ctx.fillRect(a.cx - 18, y - 9, 30, 8);
    ctx.fillStyle = head;
    ctx.beginPath(); ctx.arc(a.cx + 16, y - 6, 5, 0, Math.PI * 2); ctx.fill();
    if (extra) extra(y);
  }

  LO.drawPlayer = function (ctx, p, t, trance) {
    const suit = p.disguised ? '#2c4a7a' : '#1b1e27';
    const trim = p.disguised ? '#1d2f50' : '#2e3442';
    const x = p.cx, y = p.y;
    if (trance) {
      ctx.fillStyle = `rgba(201,160,255,${0.15 + Math.sin(t * 5) * 0.08})`;
      ctx.beginPath(); ctx.ellipse(x, p.cy, 16, p.h / 2 + 6, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save();
    if (p.dir < 0) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
    if (p.crouch) {
      ctx.fillStyle = suit; ctx.fillRect(x - 9, y + 6, 18, 12);
      ctx.fillStyle = trim; ctx.fillRect(x - 9, y + 16, 7, 8); ctx.fillRect(x + 3, y + 16, 7, 8);
      ctx.fillStyle = suit; ctx.beginPath(); ctx.arc(x + 4, y + 6, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0d0f14'; ctx.fillRect(x + 3, y + 5, 7, 4);
    } else {
      legs(ctx, x, y, p.h, p.anim, trim, Math.abs(p.vx) > 10 && p.onGround);
      ctx.fillStyle = suit; ctx.fillRect(x - 7, y + 12, 14, 20);
      // arm, pointing forward when shooting or taking someone down
      const reach = p.takedownT > 0 ? 10 : 0;
      ctx.fillStyle = trim; ctx.fillRect(x - 2, y + 15, 5 + reach, 4);
      ctx.fillStyle = suit; ctx.beginPath(); ctx.arc(x, y + 7, 6.5, 0, Math.PI * 2); ctx.fill();
      if (p.disguised) { ctx.fillStyle = '#1d2f50'; ctx.fillRect(x - 7, y - 1, 14, 4); ctx.fillRect(x, y + 1, 9, 2); }
      ctx.fillStyle = '#0d0f14'; ctx.fillRect(x + 1, y + 6, 7, 4);
      ctx.fillStyle = '#2b2f3a'; ctx.fillRect(x - 6, y + 13, 3, 12); // pack strap
    }
    ctx.restore();
  };

  LO.drawGuard = function (ctx, g, t) {
    const target = g.isTarget;
    const body = target ? '#7a2c3a' : g.stripped ? '#6b6b6b' : '#2c4a7a';
    const dark = target ? '#4a1822' : g.stripped ? '#4a4a4a' : '#1d2f50';
    const skin = '#c9a27e';
    if (!g.functional) {
      lying(ctx, g, body, skin, (y) => {
        if (g.dead) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(g.cx - 20, y - 2, 40, 2); }
        if (g.ko) { ctx.fillStyle = '#ffe9a8'; ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.fillText('z', g.cx + 22 + Math.sin(t * 2) * 2, y - 14 - (t * 8) % 8); }
      });
      return;
    }
    const x = g.cx, y = g.y;
    ctx.save();
    if (g.dir < 0) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
    if (g.possessed) {
      ctx.fillStyle = `rgba(201,160,255,${0.18 + Math.sin(t * 6) * 0.08})`;
      ctx.beginPath(); ctx.ellipse(x, g.cy, 17, 30, 0, 0, Math.PI * 2); ctx.fill();
    }
    legs(ctx, x, y, g.h, g.anim, dark, Math.abs(g.vx) > 5);
    if (target) {
      ctx.fillStyle = body; ctx.fillRect(x - 10, y + 12, 20, 22);
      ctx.fillStyle = '#d4af37'; ctx.fillRect(x - 2, y + 14, 3, 16); ctx.fillRect(x + 4, y + 18, 3, 3);
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x + 1, y + 7, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a1015'; ctx.fillRect(x - 7, y - 4, 15, 4); ctx.fillRect(x - 4, y - 10, 9, 7);
      ctx.fillStyle = '#5a3b2a'; ctx.fillRect(x + 3, y + 9, 6, 3); // moustache
    } else {
      ctx.fillStyle = body; ctx.fillRect(x - 8, y + 12, 16, 21);
      ctx.fillStyle = '#c8b25a'; ctx.fillRect(x + 2, y + 15, 3, 3); // badge
      ctx.fillStyle = dark; ctx.fillRect(x - 8, y + 28, 16, 3);
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x + 1, y + 7, 6, 0, Math.PI * 2); ctx.fill();
      if (!g.stripped) { ctx.fillStyle = dark; ctx.fillRect(x - 6, y - 1, 13, 4); ctx.fillRect(x + 1, y + 1, 9, 2); }
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x + 4, y + 6, 2, 2);
      // arm / flashlight
      ctx.fillStyle = body; ctx.fillRect(x, y + 16, g.takedownT > 0 ? 16 : 8, 4);
      if (g.flashlight) { ctx.fillStyle = '#333'; ctx.fillRect(x + 7, y + 13, 7, 4); ctx.fillStyle = '#fff6c8'; ctx.fillRect(x + 13, y + 13, 2, 4); }
    }
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
    ctx.fillStyle = '#ff6060'; ctx.fillRect(x + 7, y - 7 - hop, 1.5, 1.5);
    ctx.restore();
  };

  LO.drawWorker = function (ctx, x, y, dir, t) {
    ctx.save();
    if (dir < 0) { ctx.translate((x + 10) * 2, 0); ctx.scale(-1, 1); }
    ctx.fillStyle = '#5e5442'; ctx.fillRect(x + 4, y + 30, 4, 12); ctx.fillRect(x + 11, y + 30, 4, 12);
    ctx.fillStyle = '#8a7f62'; ctx.fillRect(x + 2, y + 12, 16, 20);
    ctx.fillStyle = '#6e654d'; ctx.fillRect(x + 5, y + 12, 3, 10); ctx.fillRect(x + 12, y + 12, 3, 10);
    ctx.fillStyle = '#b8936e'; ctx.beginPath(); ctx.arc(x + 10, y + 7, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2f22'; ctx.fillRect(x + 4, y, 12, 3);
    ctx.restore();
  };

  // ------------------------------------------------------------ HUD
  function panel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(8,10,18,0.72)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
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

  LO.drawHUD = function (ctx, g) {
    const p = g.player;
    ctx.textAlign = 'left';
    // visibility meter
    panel(ctx, 12, 12, 210, 74);
    const L = g.playerLight || 0;
    const label = p.hidden ? (p.locker ? 'HIDDEN · LOCKER' : 'HIDDEN · VENT') : L < 0.08 ? 'IN SHADOW' : L < 0.35 ? 'DIM' : 'EXPOSED';
    ctx.fillStyle = '#8b93a8'; ctx.font = '10px monospace'; ctx.fillText('VISIBILITY', 22, 28);
    ctx.fillStyle = p.hidden || L < 0.08 ? '#7dff8a' : L < 0.35 ? '#ffd166' : '#ff6b5c';
    ctx.font = 'bold 11px monospace'; ctx.fillText(label, 100, 28);
    ctx.fillStyle = '#1b1f2c'; ctx.fillRect(22, 34, 190, 8);
    const grad = ctx.createLinearGradient(22, 0, 212, 0);
    grad.addColorStop(0, '#2d6a3a'); grad.addColorStop(0.4, '#d6b84a'); grad.addColorStop(1, '#ff6b5c');
    ctx.fillStyle = grad; ctx.fillRect(22, 34, 190 * (p.hidden ? 0 : L), 8);
    // will (possession energy)
    ctx.fillStyle = '#8b93a8'; ctx.font = '10px monospace'; ctx.fillText('WILL', 22, 58);
    ctx.fillStyle = '#1b1f2c'; ctx.fillRect(60, 51, 152, 7);
    ctx.fillStyle = g.energy >= 2.5 ? '#b48cff' : '#5d4a80'; ctx.fillRect(60, 51, 152 * (g.energy / g.maxEnergy), 7);
    // inventory
    ctx.fillStyle = '#ffe9a8'; ctx.font = 'bold 11px monospace';
    ctx.fillText(`PELLETS ${g.ammo}`, 22, 78);
    ctx.fillStyle = '#a8e6ff'; ctx.fillText(`BOTTLES ${g.bottles}`, 110, 78);
    if (p.disguised) {
      panel(ctx, 12, 92, 118, 20);
      ctx.fillStyle = '#8fd3ff'; ctx.font = 'bold 10px monospace'; ctx.fillText('IN GUARD UNIFORM', 20, 106);
    }

    // objective
    const tname = g.target ? g.target.name : 'the target';
    const obj = g.targetDown ? 'Reach the exit' : `Neutralize ${tname}`;
    ctx.font = 'bold 12px monospace';
    const ow = Math.max(240, ctx.measureText(obj).width + 30);
    panel(ctx, LO.VIEW_W - ow - 12, 12, ow, 58);
    ctx.textAlign = 'right';
    ctx.fillStyle = g.targetDown ? '#7dff8a' : '#ffd166';
    ctx.fillText(obj, LO.VIEW_W - 22, 30);
    ctx.font = '10px monospace'; ctx.fillStyle = '#b8bfd0';
    if (g.totalWorkers) ctx.fillText(`Workers freed ${g.stats.freed}/${g.totalWorkers}`, LO.VIEW_W - 22, 46);
    const m = Math.floor(g.time / 60), s = Math.floor(g.time % 60);
    ctx.fillText(`${m}:${String(s).padStart(2, '0')}  ·  Alarms ${g.stats.alarms}`, LO.VIEW_W - 22, 61);

    // banner
    ctx.textAlign = 'center';
    if (g.banner) {
      const a = Math.min(1, g.banner.t * 2, (g.banner.max - g.banner.t) * 4 + 0.2);
      ctx.globalAlpha = a;
      ctx.font = 'bold 15px monospace';
      const w = Math.min(LO.VIEW_W - 80, ctx.measureText(g.banner.text).width + 40);
      const lines = LO.wrapText(ctx, g.banner.text, w - 30);
      panel(ctx, LO.VIEW_W / 2 - w / 2, 84, w, 14 + lines.length * 20);
      ctx.fillStyle = '#fff';
      lines.forEach((ln, i) => ctx.fillText(ln, LO.VIEW_W / 2, 104 + i * 20));
      ctx.globalAlpha = 1;
    }

    // prompt
    const inter = g.interaction;
    if (inter && g.state === 'play') {
      const text = inter.disabled ? inter.label : `[E${inter.hold ? ' hold' : ''}] ${inter.label}`;
      ctx.font = 'bold 13px monospace';
      const w = ctx.measureText(text).width + 28;
      panel(ctx, LO.VIEW_W / 2 - w / 2, LO.VIEW_H - 46, w, 28);
      ctx.fillStyle = inter.disabled ? '#999' : inter.danger ? '#ffd166' : '#fff';
      ctx.fillText(text, LO.VIEW_W / 2, LO.VIEW_H - 27);
    }

    // signs
    const cur = g.controlled;
    for (const sgn of g.signs) {
      if (Math.abs(sgn.x + 8 - cur.cx) < 48 && Math.abs(sgn.y + 13 - cur.cy) < 48 && sgn.text) {
        ctx.font = '13px sans-serif';
        const lines = LO.wrapText(ctx, sgn.text, 560);
        const h = 18 + lines.length * 18;
        const y = LO.VIEW_H - 60 - h;
        panel(ctx, LO.VIEW_W / 2 - 300, y, 600, h);
        ctx.fillStyle = '#e8dcc0';
        lines.forEach((ln, i) => ctx.fillText(ln, LO.VIEW_W / 2, y + 22 + i * 18));
        break;
      }
    }

    if (g.controlled !== p) {
      ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#c9a0ff';
      const who = g.controlled.kind === 'critter' ? 'a rat' : g.controlled.name.toLowerCase();
      ctx.fillText(`POSSESSING ${who.toUpperCase()} — [Q] release · your body is defenseless`, LO.VIEW_W / 2, LO.VIEW_H - 58 - (inter ? 0 : -30));
    }
    ctx.textAlign = 'left';
    ctx.font = '10px monospace'; ctx.fillStyle = 'rgba(180,190,210,0.55)';
    ctx.fillText('H: controls   Esc: pause   R: restart', 14, LO.VIEW_H - 10);
  };
})(window.LO);
