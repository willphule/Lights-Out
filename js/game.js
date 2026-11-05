'use strict';
// One mission in progress: simulation, rendering and scoring.
(function (LO) {
  const TS = LO.TS;
  const FL_R = 230, FL_HALF = 0.42; // guard flashlight reach and half-angle
  const polyPath = (c, pts) => { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); };
  const wedge = (c, x, y, r, a0, a1) => { c.beginPath(); c.moveTo(x, y); c.arc(x, y, r, a0, a1); c.closePath(); };

  const METHOD_NAMES = {
    accident: 'Accident',
    takedown: 'Silent takedown',
    disguise: 'Takedown in disguise',
    puppeteer: 'Puppeteer',
  };
  LO.METHOD_NAMES = METHOD_NAMES;

  class Game {
    constructor(def, index) {
      this.def = def;
      this.index = index;
      this.level = new LO.Level(def);
      this.time = 0;
      this.state = 'play';
      this.guards = []; this.critters = []; this.lamps = []; this.crates = [];
      this.fuses = []; this.levers = []; this.lockers = []; this.cages = []; this.exits = [];
      this.signs = []; this.pickups = []; this.projectiles = []; this.rings = [];
      this.particles = []; this.floaters = []; this.workers = []; this.tracers = [];
      this.puddles = []; this.lasers = []; this.laserTiles = [];
      this.zapT = 0; this.shake = 0; this.alarmCool = 0; this.banner = null;
      this.ammo = def.ammo ?? 6; this.bottles = def.bottles ?? 2;
      this.energy = 10; this.maxEnergy = 10;
      this.aimTime = def.aimTime || 1.0;
      this.targetDown = null;
      this.holdT = 0; this.holdKey = null;
      this.stats = { alarms: 0, bodiesFound: 0, kos: 0, casualties: 0, freed: 0, lampsShot: 0,
        possessions: 0, shots: 0, coverBlown: 0, spotted: 0 };
      this.spawn();
      this.controlled = this.player;
      this.cam = { x: 0, y: 0 };
      this.snapCamera();
      LO.Scenery.build(this);
      const th = this.theme;
      for (const l of this.lamps) {
        l.color = l.spot ? '235,242,255' : l.circuit ? th.circuit : th.lamp;
        l.fl = 1; l.flash = 0; l.flickT = 2 + Math.random() * 20;
        if (!l.spot) this.makeLampStamps(l);
      }
      for (const g of this.guards) g.look = g.isTarget ? (def.target && def.target.look) || {} : th.guard;
      this.lightCanvas = document.createElement('canvas');
      this.lightCanvas.width = LO.VIEW_W; this.lightCanvas.height = LO.VIEW_H;
      this.lctx = this.lightCanvas.getContext('2d');
      this.worldCanvas = document.createElement('canvas');
      this.worldCanvas.width = LO.VIEW_W; this.worldCanvas.height = LO.VIEW_H;
      this.wctx = this.worldCanvas.getContext('2d');
      this.hitStop = 0; this.slowT = 0; this.slowK = 1;
      this.mood = { alert: 0, watched: 0, possess: 0, hidden: 0 };
      this.say(def.intro || '');
      this.intro = null;
      this.winT = 0;
    }

    // ------------------------------------------------------------ setup
    spawn() {
      const def = this.def, lvl = this.level;
      let gi = 0, si = 0;
      for (const m of lvl.markers) {
        const px = m.x * TS, py = m.y * TS;
        switch (m.ch) {
          case 'P': this.player = new LO.Player(px + 7, py + TS - 44); break;
          case 'g': {
            const cfg = (def.guards && def.guards[gi++]) || {};
            const g = new LO.Guard(px + 6, py + TS - 46, cfg);
            this.guards.push(g); break;
          }
          case 'T': {
            const t = new LO.Target(px + 5, py + TS - 46, def.target || {});
            this.target = t; this.guards.push(t); break;
          }
          case 'r': this.critters.push(new LO.Critter(px + 9, py)); break;
          case 'L': case 'Y': case 'l': case 'y': {
            const small = m.ch === 'l' || m.ch === 'y';
            let top = m.y; while (top > 0 && !'#-'.includes(lvl.tile(m.x, top - 1))) top--;
            this.lamps.push({ x: px + 16, y: py + 12, r: small ? 130 : (def.lampRadius || 200), cone: small ? 1.3 : 1.15,
              on: true, broken: false, circuit: m.ch === 'Y' || m.ch === 'y', ceil: top * TS, poly: null });
            break;
          }
          case 'S': case 's': {
            // searchlight: a narrow beam that sweeps back and forth
            let top = m.y; while (top > 0 && !'#-'.includes(lvl.tile(m.x, top - 1))) top--;
            const n = this.lamps.filter((l) => l.spot).length;
            this.lamps.push({ x: px + 16, y: py + 10, r: 440, on: true, broken: false, circuit: m.ch === 's', ceil: top * TS, poly: null,
              spot: { base: Math.PI / 2, swing: 0.6, speed: 0.85 + n * 0.12, phase: n * 2.4, half: 0.2 }, ang: Math.PI / 2 });
            break;
          }
          case 'z': this.laserTiles.push(m); break;
          case 'C': {
            let top = m.y; while (top > 0 && !'#-'.includes(lvl.tile(m.x, top - 1))) top--;
            this.crates.push({ x: px + 1, y: py + 2, w: 30, h: 28, ropeTop: top * TS, state: 'hanging', vy: 0 });
            break;
          }
          case 'f': this.fuses.push({ x: px + 5, y: py - 20, w: 22, h: 30, state: 'ok', t: 0 }); break;
          case 'v': this.levers.push({ x: px + 9, y: py + 6, w: 14, h: 26, kind: 'gate', on: false }); break;
          case 'u': this.levers.push({ x: px + 9, y: py + 6, w: 14, h: 26, kind: 'crane', on: false }); break;
          case 'k': this.lockers.push({ x: px + 2, y: py - TS + 4, w: 28, h: 60, compromised: false }); break;
          case 'w': this.cages.push({ x: px, y: py - TS + 2, w: 32, h: 62, opened: false, look: Math.random() }); break;
          case 'X': this.exits.push({ x: px, y: py - TS, w: 32, h: 64 }); break;
          case '?': this.signs.push({ x: px + 8, y: py + 6, w: 16, h: 26, text: (def.tips && def.tips[si++]) || '' }); break;
          case 'a': this.pickups.push({ x: px + 8, y: py + 14, w: 16, h: 16, type: 'ammo' }); break;
          case 'n': this.pickups.push({ x: px + 8, y: py + 12, w: 16, h: 20, type: 'bottle' }); break;
        }
      }
      for (let y = 0; y < lvl.h; y++) for (let x = 0; x < lvl.w; x++)
        if (lvl.tile(x, y) === '~') this.puddles.push({ x: x * TS, y: y * TS, w: TS, h: TS });
      // runs of z markers on one row become a single laser tripwire
      this.laserTiles.sort((a, b) => a.y - b.y || a.x - b.x);
      for (const m of this.laserTiles) {
        const last = this.lasers[this.lasers.length - 1];
        if (last && last.row === m.y && last.tx1 === m.x - 1) { last.tx1 = m.x; last.x1 = (m.x + 1) * TS; continue; }
        this.lasers.push({ row: m.y, tx1: m.x, x0: m.x * TS, x1: (m.x + 1) * TS, y: (m.y + 1) * TS - 30, cool: 0 });
      }
      if (!this.player) this.player = new LO.Player(64, 64);
      for (const l of this.lamps) l.poly = lvl.visibility(l.x, l.y, l.r);
      for (const g of this.guards) this.computePatrol(g);
      this.totalWorkers = this.cages.length;
    }

    computePatrol(g) {
      const lvl = this.level;
      const row = Math.floor((g.bottom - 4) / TS), floor = row + 1;
      const start = Math.floor(g.cx / TS);
      let a = start, b = start;
      const ok = (x) => !lvl.solidFor(x, row, g) && lvl.standable(x, floor, g);
      while (ok(a - 1) && !lvl.turnMarks.has(a + ',' + row)) a--;
      while (ok(b + 1) && !lvl.turnMarks.has(b + ',' + row)) b++;
      g.patrolMin = a * TS + 14; g.patrolMax = (b + 1) * TS - 14;
    }

    // ------------------------------------------------------------ messaging
    say(text, t = 3) { if (text) this.banner = { text, t, max: t }; }
    float(x, y, text, color = '#fff', t = 1.6) { this.floaters.push({ x, y, text, color, t, max: t }); }
    noise(x, y, radius, kind) {
      this.rings.push({ x, y, r: radius, t: 0.6, max: 0.6, kind });
      for (const g of this.guards) {
        if (!g.functional || g.possessed || g.state === 'dazed' || g.state === 'alert' || g.state === 'flee') continue;
        if (LO.dist(g.cx, g.cy, x, y) > radius) continue;
        const speech = {
          step: ['Hm?', 'Who\'s there?', 'Footsteps?'],
          glass: ['The light!', 'Who broke that lamp?', 'Huh, a bulb blew?'],
          bottle: ['What was that?', 'Something broke...', 'Hello?'],
          ping: ['Hm?', 'What was that?'],
          thud: ['What was that thump?', 'Hm?'],
          crash: ['What the—?!', 'That came from the crane!'],
          zap: ['The fuses!', 'Power\'s out!', 'Not again...'],
          lever: ['Who\'s at the controls?', 'Hm?'],
          hit: ['Ow! Who did that?'],
        }[kind] || ['Hm?'];
        g.susp = Math.max(g.susp, kind === 'step' ? 0.35 : 0.3);
        g.setInvestigate(x, kind === 'crash' || kind === 'hit', LO.pick(speech));
        LO.Sfx.play('huh');
      }
    }

    // ------------------------------------------------------------ light
    lightAt(x, y) {
      let L = 0;
      const lvl = this.level;
      for (const l of this.lamps) {
        if (!l.on) continue;
        const d = LO.dist(l.x, l.y, x, y);
        if (d >= l.r) continue;
        if (l.spot) {
          let da = Math.atan2(y - l.y, x - l.x) - l.ang;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          if (Math.abs(da) < l.spot.half && lvl.los(l.x, l.y, x, y)) L += (1 - (d / l.r) ** 2) * 1.4;
        } else {
          let da = Math.atan2(y - l.y, x - l.x) - Math.PI / 2;
          da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
          let k = da <= l.cone ? 1 : da <= l.cone + 0.32 ? 1 - ((da - l.cone) / 0.32) * 0.75 : 0;
          if (d < 56) k = Math.max(k, 0.85 * (1 - d / 56));
          if (k > 0 && lvl.los(l.x, l.y, x, y)) L += k * Math.pow(1 - d / l.r, 1.1) * 1.3;
        }
      }
      for (const g of this.guards) {
        if (!g.flashlight || !g.functional || g.possessed) continue;
        const dx = x - g.eyeX, dy = y - g.eyeY, d = Math.hypot(dx, dy);
        if (d < FL_R && dx * g.dir > 0 && Math.abs(Math.atan2(dy, dx * g.dir)) < FL_HALF && lvl.los(g.eyeX, g.eyeY, x, y))
          L += (1 - d / FL_R) * 1.5;
      }
      return Math.min(1, L);
    }

    bodies() {
      return this.guards.filter((g) => !g.functional);
    }

    // ------------------------------------------------------------ perception
    perceive(gd, dt) {
      const p = this.player;
      const alertish = gd.state === 'alert' || gd.state === 'flee';
      let seen = false, dmin = Infinity, vis = 0;
      if (!p.hidden && !p.dead) {
        const range = (alertish ? 9.5 : 8) * TS, half = alertish ? 0.9 : 0.62;
        const ex = gd.eyeX, ey = gd.eyeY;
        for (const [sx, sy] of [[p.cx, p.y + 5], [p.cx, p.cy], [p.cx, p.bottom - 4]]) {
          const dx = sx - ex, dy = sy - ey, d = Math.hypot(dx, dy);
          if (d > range) continue;
          const fwd = dx * gd.dir;
          const inCone = fwd > 0 && Math.abs(Math.atan2(dy, fwd)) < half;
          if ((inCone || d < 30) && this.level.los(ex, ey, sx, sy)) { seen = true; dmin = Math.min(dmin, d); }
        }
        if (seen) {
          vis = this.playerLight;
          if (p.crouch) vis *= 0.7;
          if (Math.abs(p.vx) > 180) vis *= 1.25;
          if (dmin < 1.4 * TS) vis = Math.max(vis, 0.85);
          else if (dmin < 3 * TS) vis = Math.max(vis, 0.22);
          if (alertish && dmin < 5 * TS) vis = Math.max(vis, 0.6);
          if (p.disguised && !alertish) {
            if (p.suspiciousT > 0 && vis > 0.12) { this.blowCover(gd); vis = 1; }
            else vis = dmin < 2.2 * TS && this.playerLight > 0.3 ? 0.14 : 0;
          }
          seen = vis > 0.06;
        }
      }
      gd.seesPlayer = seen;
      gd.vis = vis;
      if (seen) {
        gd.lastSeenX = p.cx; gd.lastSeenY = p.cy;
        if (!alertish) {
          const rate = vis * (1.8 - dmin / (8 * TS)) * (1 + gd.wary * 0.5) * 0.95;
          gd.susp = Math.min(1, gd.susp + rate * dt);
          if (gd.susp >= 1) this.guardAlert(gd);
          else if (gd.susp > 0.3 && ['patrol', 'pause', 'return', 'search'].includes(gd.state)) {
            gd.setInvestigate(p.cx, false, p.disguised ? 'Hm? You there...' : LO.pick(['Hm?', 'Who\'s there?', 'Is someone there?']));
            LO.Sfx.play('huh');
            if (!gd.countedSpot) { this.stats.spotted++; gd.countedSpot = true; }
          } else if (gd.state === 'investigate') gd.goalX = p.cx;
        }
      } else if (!alertish) {
        gd.susp = Math.max(0, gd.susp - 0.1 * dt);
        if (gd.susp < 0.1) gd.countedSpot = false;
      }

      // bodies on the floor
      if (!alertish) {
        for (const b of this.guards) {
          if (b.functional || b.found || b === gd) continue;
          const dx = b.cx - gd.eyeX, dy = b.cy - gd.eyeY, d = Math.hypot(dx, dy);
          if (d > 7 * TS) continue;
          const fwd = dx * gd.dir;
          if (!(fwd > 0 && Math.abs(Math.atan2(dy, fwd)) < 0.7)) continue;
          if (!(this.lightAt(b.cx, b.y + 4) > 0.12 || d < 3 * TS)) continue;
          if (!this.level.los(gd.eyeX, gd.eyeY, b.cx, b.y + 4)) continue;
          b.found = true;
          this.stats.bodiesFound++;
          this.float(b.cx, b.y - 20, 'BODY FOUND', '#ff8a5c');
          gd.wary = 1;
          gd.setInvestigate(b.cx, true, b.isTarget ? 'Someone got the boss!' : 'Man down!');
          for (const o of this.guards) {
            if (o !== gd && o.functional && LO.dist(o.cx, o.cy, gd.cx, gd.cy) < 10 * TS) { o.wary = 1; o.setInvestigate(b.cx, true, '!?'); }
          }
          LO.Sfx.play('alert');
          break;
        }
      }
    }

    guardAlert(gd) {
      gd.susp = 1; gd.aimT = 0; gd.lostT = 0;
      if (gd.isTarget) { gd.state = 'flee'; gd.t = 5; gd.callT = 0; gd.say('Intruder!'); }
      else { gd.state = 'alert'; gd.say(LO.pick(['There!', 'Intruder!', 'Got you!', 'Freeze!'])); }
      LO.Sfx.play('alert'); LO.Input.rumble(0.35, 0.2, 160);
      if (this.mood.alert < 0.3) { LO.Music.sting('spotted'); this.slowT = 0.35; this.slowK = 0.35; }
      gd.alertT = 0;
      this.raiseAlarm(gd);
    }

    raiseAlarm(src, speech) {
      if (speech) src.say(speech);
      if (this.alarmCool <= 0) {
        this.stats.alarms++;
        this.alarmCool = 10;
        this.say('ALARM RAISED', 2);
      }
      for (const o of this.guards) {
        if (o === src || !o.functional || o.possessed || o.state === 'alert' || o.state === 'flee') continue;
        if (LO.dist(o.cx, o.cy, src.cx, src.cy) > 14 * TS) continue;
        o.lastSeenX = src.lastSeenX;
        o.susp = Math.max(o.susp, 0.75); o.wary = 1;
        o.setInvestigate(src.lastSeenX, true, '!?');
      }
    }

    blowCover(gd) {
      const p = this.player;
      p.disguised = false;
      this.stats.coverBlown++;
      this.float(p.cx, p.y - 24, 'COVER BLOWN', '#ff5c5c');
      gd.say('You\'re not one of us!');
      this.guardAlert(gd);
    }

    guardShoots(gd) {
      if (this.state !== 'play') return;
      LO.Sfx.play('shot');
      const p = this.player;
      this.tracers.push({ x0: gd.cx + gd.dir * 10, y0: gd.y + 18, x1: p.cx, y1: p.cy, t: 0.3 });
      this.shake = 10;
      LO.Input.rumble(1, 1, 450);
      this.fail('A guard shot you.');
    }

    checkGrab(gd) {
      const p = this.player;
      if (Math.abs(gd.cx - p.cx) < 24 && Math.abs(gd.cy - p.cy) < 34) {
        if (p.locker) { if (p.locker.compromised) this.fail('A guard pulled you out of the locker.'); return; }
        if (!p.hidden) this.fail('A guard grabbed you.');
      }
    }

    fail(reason) {
      if (this.state !== 'play') return;
      this.state = 'failed';
      this.failReason = reason;
      this.failT = 0;
      LO.Sfx.play('caught');
      LO.Music.sting('fail');
    }

    // ------------------------------------------------------------ harm
    setLying(a) {
      if (a.lying) return;
      a.lying = true;
      a.fallT = 0;
      a.y += a.h - 12; a.h = 12; a.vx = 0;
      a.climbing = false;
    }

    knockOut(a, method) {
      if (!a.functional) return;
      if (a.possessed) this.release();
      a.ko = true; a.state = 'ko';
      this.setLying(a);
      this.hitStop = 0.09; this.shake = Math.max(this.shake, 4);
      for (let i = 0; i < 8; i++) this.particles.push({ x: a.cx, y: a.bottom - 8, vx: LO.rand(-90, 90), vy: LO.rand(-120, -20), t: LO.rand(0.25, 0.5), color: 'rgba(200,190,170,0.7)' });
      LO.Sfx.play('thud'); LO.Input.rumble(0.5, 0.3, 140);
      this.noise(a.cx, a.cy, 2.2 * TS, 'thud');
      if (a.isTarget) this.neutralize(method);
      else this.stats.kos++;
    }

    kill(a, method, cause) {
      if (a.dead) return;
      if (a === this.player) { this.fail(cause === 'zap' ? 'You were electrocuted.' : 'You were crushed.'); return; }
      if (a.possessed) this.release(true);
      a.dead = true; a.cause = cause;
      this.hitStop = Math.max(this.hitStop, 0.07);
      if (a.kind === 'critter') return;
      a.ko = false; a.state = 'dead';
      this.setLying(a);
      if (a.isTarget) { this.targetCause = cause; this.neutralize(method); }
      else this.stats.casualties++;
    }

    neutralize(method) {
      if (this.targetDown) return;
      this.targetDown = method;
      this.slowT = 1.1; this.slowK = 0.3;
      LO.Music.sting('target');
      this.say('TARGET NEUTRALIZED — ' + METHOD_NAMES[method].toUpperCase(), 3.5);
      this.float(this.target.cx, this.target.y - 30, METHOD_NAMES[method], '#ffd166', 2.5);
      LO.Sfx.play('win');
    }

    // ------------------------------------------------------------ objects
    dropCrate(c) {
      if (c.state !== 'hanging') return;
      c.state = 'falling'; c.vy = 0;
      LO.Sfx.play('ping');
    }

    overloadFuse(f) {
      if (f.state !== 'ok') return;
      f.state = 'tripped'; f.t = this.def.fuseTime || 22;
      for (const l of this.lamps) if (l.circuit && !l.broken) l.on = false;
      this.zapT = 0.9;
      this.shake = 6;
      LO.Input.rumble(0.5, 0.9, 380);
      LO.Sfx.play('zap');
      for (let i = 0; i < 20; i++) this.spark(f.x + f.w / 2, f.y + f.h / 2, '#9be7ff');
      this.noise(f.x + f.w / 2, f.y + f.h / 2, 10 * TS, 'zap');
      for (const pd of this.puddles) for (let i = 0; i < 4; i++) this.spark(pd.x + LO.rand(0, TS), pd.y + TS - 4, '#9be7ff');
      this.say(this.lasers.length ? 'BLACKOUT' : 'Power overload!', 2);
      if (this.lasers.length) LO.Music.sting('blackout');
    }

    breakLamp(l) {
      l.on = false; l.broken = true; l.flash = 0.22;
      this.stats.lampsShot++;
      LO.Sfx.play('glass'); LO.Input.rumble(0.1, 0.35, 90);
      for (let i = 0; i < 14; i++) this.spark(l.x, l.y, '#ffe9a8');
      this.noise(l.x, l.y + 40, 7 * TS, 'glass');
    }

    spark(x, y, color) {
      this.particles.push({ x, y, vx: LO.rand(-160, 160), vy: LO.rand(-220, 60), t: LO.rand(0.3, 0.8), color });
    }

    // ------------------------------------------------------------ possession
    possessCandidates() {
      const p = this.player;
      const out = [];
      const all = [...this.guards.filter((g) => !g.isTarget && g.functional), ...this.critters.filter((c) => !c.dead)];
      for (const a of all) {
        const d = LO.dist(p.cx, p.y + 8, a.cx, a.cy);
        if (d > 9 * TS) continue;
        if (!this.level.los(p.cx, p.y + 8, a.cx, a.cy)) continue;
        out.push(a);
      }
      return out;
    }

    possessTarget() {
      const cands = this.possessCandidates();
      if (!cands.length) return null;
      const m = this.aimWorld();
      let best = null, bd = Infinity;
      for (const a of cands) { const d = LO.dist(m.x, m.y, a.cx, a.cy); if (d < bd) { bd = d; best = a; } }
      if (bd > 160) {
        bd = Infinity;
        for (const a of cands) { const d = LO.dist(this.player.cx, this.player.cy, a.cx, a.cy); if (d < bd) { bd = d; best = a; } }
      }
      return best;
    }

    tryPossess() {
      const p = this.player;
      if (p.locker) { this.float(p.cx, p.y - 20, 'Not from inside a locker', '#aaa'); return; }
      if (this.energy < 2.5) { this.float(p.cx, p.y - 20, 'Too drained', '#aaa'); LO.Sfx.play('deny'); return; }
      const host = this.possessTarget();
      if (!host) {
        const tg = this.target;
        if (tg && tg.functional && LO.dist(tg.cx, tg.cy, p.cx, p.cy) < 9 * TS) this.float(tg.cx, tg.y - 20, 'Mind too guarded', '#c9a0ff');
        else this.float(p.cx, p.y - 20, 'No one in range', '#aaa');
        LO.Sfx.play('deny');
        return;
      }
      host.possessed = true;
      host.vx = 0;
      if (host.kind === 'guard') { host.state = 'possessed'; host.susp = 0; host.seesPlayer = false; }
      this.controlled = host;
      p.vx = 0;
      if (p.crouch === false && p.onGround) { /* sink into a trance */ }
      this.stats.possessions++;
      LO.Sfx.play('possess'); LO.Input.rumble(0.15, 0.5, 220);
      for (let i = 0; i < 16; i++) this.spark(host.cx, host.cy, '#c9a0ff');
    }

    release(silent) {
      const h = this.controlled;
      if (h === this.player) return;
      h.possessed = false;
      if (h.functional && !h.dead) {
        h.state = 'dazed'; h.t = 2.5;
        if (h.kind === 'guard') { h.say('Wha...? How did I get here?'); h.susp = 0; if (!h.route) this.computePatrol(h); }
      }
      this.controlled = this.player;
      if (!silent) LO.Sfx.play('release');
    }

    // ------------------------------------------------------------ interactions
    near(a, o, pad = 10) {
      return a.x - pad < o.x + o.w && a.x + a.w + pad > o.x && a.y - pad < o.y + o.h && a.y + a.h + pad > o.y;
    }

    findInteraction() {
      const a = this.controlled, p = this.player;
      // the target first, then whoever is closest
      const byPriority = [...this.guards].sort((x, y) => (y.isTarget ? 1 : 0) - (x.isTarget ? 1 : 0) || Math.abs(x.cx - a.cx) - Math.abs(y.cx - a.cx));
      if (a === p) {
        if (p.locker) return { label: 'Leave locker', act: () => this.leaveLocker() };
        // takedown
        for (const g of byPriority) {
          if (!g.functional || g.possessed) continue;
          if (Math.abs(g.cx - p.cx) > 40 || Math.abs(g.cy - p.cy) > 30 || p.climbing) continue;
          const behind = g.dir === Math.sign(g.cx - p.cx) || g.state === 'dazed';
          const trusting = p.disguised && g.susp < 0.6;
          if (g.state === 'alert' || g.state === 'flee') continue;
          if (behind || trusting) return { label: g.isTarget ? 'Take down ' + g.name : 'Takedown', act: () => this.playerTakedown(g), danger: g.isTarget };
        }
        for (const g of this.guards) {
          if (g.functional || g.isTarget || g.stripped || g.dead || p.disguised) continue;
          if (Math.abs(g.cx - p.cx) < 34 && Math.abs(g.bottom - p.bottom) < 20)
            return { label: 'Take uniform', act: () => this.takeUniform(g) };
        }
        for (const c of this.cages) if (!c.opened && this.near(p, c, 6))
          return { label: 'Free worker', hold: 1.2, key: c, act: () => this.freeWorker(c) };
      }
      if (a.kind !== 'critter' || true) {
        if (a !== p && a.kind === 'guard') {
          for (const g of byPriority) {
            if (g === a || !g.functional) continue;
            if (Math.abs(g.cx - a.cx) < 42 && Math.abs(g.cy - a.cy) < 30)
              return { label: g.isTarget ? 'Take down ' + g.name : 'Knock out', act: () => this.hostTakedown(g), danger: g.isTarget };
          }
        }
        for (const l of this.levers) if (this.near(a, l, 8))
          return { label: a.kind === 'critter' ? 'Chew the release' : l.kind === 'crane' ? 'Release the crane' : (l.on ? 'Close gates' : 'Open gates'), act: () => this.pullLever(l) };
        for (const f of this.fuses) if (f.state === 'ok' && this.near(a, f, 10))
          return { label: a.kind === 'critter' ? 'Chew the wires' : 'Overload fuse box', act: () => { if (a === p) p.suspiciousT = 1.5; this.overloadFuse(f); } };
      }
      if (a === p) {
        for (const k of this.lockers) if (this.near(p, k, 4) && p.onGround)
          return { label: 'Hide in locker', act: () => this.enterLocker(k) };
        for (const e of this.exits) if (this.near(p, e, 4)) {
          if (this.targetDown) return { label: 'Escape', act: () => this.win() };
          return { label: 'Neutralize the target first', disabled: true };
        }
      }
      return null;
    }

    playerTakedown(g) {
      const p = this.player;
      p.suspiciousT = 1.2;
      p.takedownT = 0.35;
      p.dir = Math.sign(g.cx - p.cx) || p.dir;
      this.knockOut(g, p.disguised ? 'disguise' : 'takedown');
    }

    hostTakedown(g) {
      const h = this.controlled;
      h.dir = Math.sign(g.cx - h.cx) || h.dir;
      h.takedownT = 0.35;
      this.knockOut(g, 'puppeteer');
    }

    takeUniform(g) {
      g.stripped = true;
      this.player.disguised = true;
      LO.Sfx.play('disguise');
      this.float(this.player.cx, this.player.y - 24, 'DISGUISED', '#8fd3ff');
      this.say('Disguised. Guards ignore you unless you act suspicious or linger close in the light.', 4);
    }

    freeWorker(c) {
      c.opened = true;
      this.stats.freed++;
      LO.Sfx.play('free');
      this.workers.push({ x: c.x + 8, y: c.y + 18, t: 2.4, dir: Math.random() < 0.5 ? -1 : 1 });
      this.float(c.x + 16, c.y - 10, LO.pick(['Thank you!', 'Bless you!', 'Free at last!', 'I\'ll tell the others!']), '#9dffb0');
    }

    pullLever(l) {
      l.on = !l.on;
      LO.Sfx.play('lever');
      if (this.controlled === this.player) this.player.suspiciousT = 1;
      if (l.kind === 'gate') {
        this.level.gatesOpen = l.on;
        for (const o of this.levers) if (o.kind === 'gate') o.on = l.on;
        this.float(l.x + 7, l.y - 12, l.on ? 'Gates open' : 'Gates closed', '#ccc');
      } else {
        let best = null, bd = Infinity;
        for (const c of this.crates) {
          if (c.state !== 'hanging') continue;
          const d = Math.abs(c.x - l.x); if (d < bd) { bd = d; best = c; }
        }
        if (best) this.dropCrate(best);
      }
      this.noise(l.x, l.y, 2.5 * TS, 'lever');
    }

    enterLocker(k) {
      const p = this.player;
      if (p.crouch) { p.y -= p.standH - p.crouchH; p.h = p.standH; p.crouch = false; }
      p.locker = k;
      k.compromised = false;
      for (const g of this.guards) {
        if (g.functional && g.seesPlayer && g.susp > 0.25) {
          k.compromised = true;
          g.setInvestigate(k.x + 14, true, 'I saw you get in there!');
        }
      }
      p.x = k.x + 5; p.y = k.y + k.h - p.h - 2; p.vx = 0; p.vy = 0;
      LO.Sfx.play('hide');
    }

    leaveLocker() {
      const p = this.player;
      p.locker = null;
      LO.Sfx.play('hide');
    }

    win() {
      if (this.state !== 'play') return;
      this.state = 'won';
      LO.Sfx.play('win');
      LO.Music.sting('win');
      this.results = this.computeResults();
    }

    // ------------------------------------------------------------ scoring
    approachKey() {
      return this.targetDown === 'accident' ? 'accident-' + (this.targetCause || 'crush') : this.targetDown;
    }

    computeResults() {
      const s = this.stats, def = this.def;
      const lines = [];
      const add = (label, pts) => { lines.push({ label, pts }); return pts; };
      let score = 0;
      score += add('Mission complete', 1000);
      const mBonus = { accident: 600, puppeteer: 450, disguise: 400, takedown: 300 }[this.targetDown] || 0;
      score += add('Method: ' + METHOD_NAMES[this.targetDown], mBonus);
      if (s.freed) score += add(`Workers freed (${s.freed}/${this.totalWorkers})`, s.freed * 150);
      if (this.totalWorkers && s.freed === this.totalWorkers) score += add('Every worker freed', 250);
      const ghost = s.alarms === 0 && s.coverBlown === 0;
      if (ghost) score += add('Never detected', 400);
      if (s.alarms) score += add(`Alarms raised ×${s.alarms}`, -300 * s.alarms);
      if (s.bodiesFound) score += add(`Bodies found ×${s.bodiesFound}`, -150 * s.bodiesFound);
      if (s.kos) score += add(`Guards knocked out ×${s.kos}`, -40 * s.kos);
      if (s.casualties) score += add(`Other casualties ×${s.casualties}`, -250 * s.casualties);
      const par = def.par || 180;
      const tb = Math.max(0, Math.round(((par - this.time) / par) * 400));
      if (tb) score += add('Time bonus', tb);
      score = Math.max(0, score);
      const rank = score >= 2600 ? 'S' : score >= 2100 ? 'A' : score >= 1600 ? 'B' : score >= 1100 ? 'C' : 'D';
      const badges = [];
      if (ghost) badges.push(['Ghost', 'Never raised an alarm']);
      if (s.kos === 0 && s.casualties === 0) badges.push(['Clean Hands', 'Only the target went down']);
      if (this.totalWorkers && s.freed === this.totalWorkers) badges.push(['Liberator', 'Freed every worker']);
      if (this.targetDown === 'accident') badges.push(['Tragic Accident', 'Nobody will suspect a thing']);
      if (this.targetDown === 'puppeteer') badges.push(['Puppeteer', 'Done by someone else\'s hands']);
      if (this.targetDown === 'disguise') badges.push(['Wolf in Wool', 'Walked right up in uniform']);
      if (s.lampsShot >= 5) badges.push(['Lights Out', 'Shot out 5+ lights']);
      if (this.time < par * 0.5) badges.push(['Quick Hands', 'Under half the par time']);
      if (s.bodiesFound === 0 && s.kos + s.casualties > 0) badges.push(['Tidy', 'No bodies were found']);
      return { score, rank, lines, badges, time: this.time, method: this.targetDown };
    }

    // ------------------------------------------------------------ update
    mouseWorld() { return { x: LO.Input.mouse.x + this.cam.x, y: LO.Input.mouse.y + this.cam.y }; }

    // Where the player is aiming: the mouse, or the right stick on a controller.
    aimWorld() {
      if (!LO.Input.usingPad) return this.mouseWorld();
      const a = this.controlled;
      return this.padAimPt || { x: a.cx + a.dir * 120, y: a.y + 8 };
    }

    // Right stick aims around the player. The reticle snaps gently onto
    // lamps, ropes, fuse boxes and anyone you could possess.
    updatePadAim(dt) {
      const I = LO.Input;
      if (!I.usingPad) { this.padAimPt = null; this.aimSnap = null; return; }
      const a = this.controlled;
      const ox = a.cx, oy = a.y + 12;
      const mag = Math.min(1, Math.hypot(I.aim.x, I.aim.y));
      if (mag > 0) {
        this.padAimDir = { x: I.aim.x / Math.hypot(I.aim.x, I.aim.y), y: I.aim.y / Math.hypot(I.aim.x, I.aim.y) };
        this.padAimDist = 70 + mag * 230;
      } else if (!this.padAimDir) {
        this.padAimDir = { x: a.dir, y: -0.15 }; this.padAimDist = 130;
      } else {
        // stick at rest: keep the angle but follow the way you face
        this.padAimDir.x = Math.abs(this.padAimDir.x) * a.dir;
      }
      const rx = ox + this.padAimDir.x * this.padAimDist, ry = oy + this.padAimDir.y * this.padAimDist;
      const pts = [];
      if (a === this.player) {
        for (const l of this.lamps) if (!l.broken) pts.push([l.x, l.y]);
        for (const c of this.crates) if (c.state === 'hanging') pts.push([c.x + c.w / 2, (c.ropeTop + c.y) / 2]);
        for (const f of this.fuses) if (f.state === 'ok') pts.push([f.x + f.w / 2, f.y + f.h / 2]);
        for (const g of this.guards) if (g.functional && !g.isTarget) pts.push([g.cx, g.cy]);
        for (const c of this.critters) if (!c.dead) pts.push([c.cx, c.cy]);
      }
      let best = null, bd = 56;
      for (const [x, y] of pts) {
        const d = LO.dist(x, y, rx, ry);
        if (d < bd && this.level.los(ox, oy, x, y)) { bd = d; best = { x, y }; }
      }
      const tx = best ? best.x : rx, ty = best ? best.y : ry;
      if (!this.padAimPt) this.padAimPt = { x: tx, y: ty };
      const k = Math.min(1, dt * (best ? 20 : 30));
      this.padAimPt.x += (tx - this.padAimPt.x) * k;
      this.padAimPt.y += (ty - this.padAimPt.y) * k;
      this.aimSnap = best;
    }

    update(dt) {
      const I = LO.Input;
      if (this.state === 'failed') { this.failT += dt; this.updateFx(dt); LO.Scenery.update(this, dt); return; }
      if (this.state === 'won') { this.winT += dt; this.updateFx(dt); return; }
      if (this.state !== 'play') return;
      // opening shot: the camera finds the target, then comes back to you
      if (this.intro) {
        const it = this.intro;
        it.t += dt;
        if (it.t > 0.4 && I.anyPressed()) it.t = Math.max(it.t, it.dur - 0.5);
        const tg = this.target;
        const focus = it.t < 1.7 ? tg : this.player;
        const k = Math.min(1, dt * (it.t < 1.7 ? 3 : 2.5));
        this.cam.x = this.clampCamX(LO.lerp(this.cam.x, focus.cx - LO.VIEW_W / 2, k));
        this.cam.y = this.clampCamY(LO.lerp(this.cam.y, focus.cy - LO.VIEW_H / 2, k));
        this.updateLamps(dt); LO.Scenery.update(this, dt); this.updateFx(dt);
        if (it.t >= it.dur) this.intro = null;
        return;
      }
      // impact freeze and slow motion for the big moments
      if (this.hitStop > 0) { this.hitStop -= dt; this.shake = Math.max(this.shake, 2); return; }
      this.realDt = dt;
      if (this.slowT > 0) { this.slowT -= dt; dt *= this.slowK; }
      this.time += dt;
      this.updateLamps(dt);
      LO.Scenery.update(this, dt);
      this.alarmCool -= dt;
      if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
      const p = this.player;
      p.suspiciousT = Math.max(0, p.suspiciousT - dt);
      p.takedownT = Math.max(0, p.takedownT - dt);
      p.aimT = Math.max(0, (p.aimT || 0) - dt);
      LO.updateScarf(p, dt);
      if (this.controlled !== p) this.controlled.takedownT = Math.max(0, (this.controlled.takedownT || 0) - dt);

      // hidden?
      p.inVent = false;
      {
        const x0 = Math.floor((p.x + 2) / TS), x1 = Math.floor((p.x + p.w - 2) / TS);
        const y0 = Math.floor(p.y / TS), y1 = Math.floor((p.bottom - 1) / TS);
        for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.level.tile(tx, ty) === 'V') p.inVent = true;
      }
      if (p.wasInVent && !p.inVent) p.suspiciousT = Math.max(p.suspiciousT, 0.8);
      p.wasInVent = p.inVent;
      p.hidden = !!p.locker || p.inVent;

      // controls
      const ctl = I.controls();
      if (this.controlled === p) {
        if (!p.locker) {
          LO.controlActor(this, p, ctl, dt, LO.PLAYER_MOVE);
          this.footsteps(p, ctl, dt);
          if (ctl.run && Math.abs(p.vx) > 160) p.suspiciousT = Math.max(p.suspiciousT, 0.3);
        }
        this.updatePadAim(dt);
        if (I.action('shoot') && !p.locker) this.shoot();
        if (I.action('throw') && !p.locker) this.throwBottle();
      } else {
        // player body sits in a trance while a host is driven
        p.vx = 0; p.climbing = false;
        LO.moveActor(this.level, p, dt);
        const h = this.controlled;
        LO.controlActor(this, h, ctl, dt, h.kind === 'critter' ? LO.CRITTER_MOVE : LO.GUARD_MOVE);
        if (h.kind === 'guard') h.state = 'possessed';
        this.energy -= dt;
        if (this.energy <= 0) { this.energy = 0; this.release(); this.float(p.cx, p.y - 20, 'Link broken', '#c9a0ff'); }
        this.updatePadAim(dt);
        if (I.action('shoot')) this.float(h.cx, h.y - 16, 'Can\'t shoot while possessing', '#aaa', 1);
      }
      if (this.controlled === p) this.energy = Math.min(this.maxEnergy, this.energy + dt * 0.6);
      if (I.action('possess')) { if (this.controlled !== p) this.release(); else this.tryPossess(); }

      // interactions
      const inter = this.findInteraction();
      this.interaction = inter;
      if (inter && !inter.disabled) {
        if (inter.hold) {
          if (I.held('interact')) {
            if (this.holdKey !== inter.key) { this.holdKey = inter.key; this.holdT = 0; LO.Sfx.play('unlock'); }
            this.holdT += dt;
            p.suspiciousT = Math.max(p.suspiciousT, 0.3);
            if (this.holdT >= inter.hold) { inter.act(); this.holdT = 0; this.holdKey = null; }
          } else { this.holdT = 0; this.holdKey = null; }
        } else if (I.action('interact')) inter.act();
      } else { this.holdT = 0; this.holdKey = null; if (inter && I.action('interact')) LO.Sfx.play('deny'); }

      // light on the player
      this.playerLight = p.hidden ? 0 : Math.max(this.lightAt(p.cx, p.y + 6), this.lightAt(p.cx, p.cy));

      // AI
      for (const g of this.guards) g.update(dt, this);
      for (const c of this.critters) c.update(dt, this);
      for (const l of this.lockers) {
        if (!l.compromised || p.locker !== l) continue;
        for (const g of this.guards) if (g.functional && !g.possessed && Math.abs(g.cx - (l.x + 14)) < 22 && Math.abs(g.cy - (l.y + 30)) < 40) this.fail('A guard pulled you out of the locker.');
      }

      // pickups
      for (const k of this.pickups) {
        if (k.taken || !this.near(p, k, 0)) continue;
        k.taken = true;
        LO.Sfx.play('pickup');
        if (k.type === 'ammo') { this.ammo += 3; this.float(k.x, k.y - 10, '+3 pellets', '#ffe08a'); }
        else { this.bottles += 1; this.float(k.x, k.y - 10, '+1 bottle', '#a8e6ff'); }
      }

      this.updateHazards(dt);
      this.updateProjectiles(dt);
      this.updateFx(dt);
      this.updateMood(dt);
      this.updateCamera(dt);
    }

    updateLamps(dt) {
      for (const l of this.lamps) {
        l.flash = Math.max(0, l.flash - dt);
        // the odd buzzing flicker (looks only; the light still counts)
        l.flickT -= dt;
        if (l.flickT <= 0) { l.flickering = 0.3 + Math.random() * 0.4; l.flickT = 8 + Math.random() * 25; }
        if (l.flickering > 0) { l.flickering -= dt; l.fl = Math.random() < 0.5 ? 0.35 : 1; } else l.fl = 1;
      }
    }

    // How tense things are, for the screen tint and the music.
    updateMood(dt) {
      const m = this.mood, p = this.player;
      let alert = 0, watched = 0, susp = 0;
      for (const g of this.guards) {
        if (!g.functional || g.possessed) continue;
        g.alertT = (g.alertT ?? 9) + dt;
        if (g.state === 'alert' || g.state === 'flee') alert = 1;
        if (g.seesPlayer && g.susp > 0.08) watched = 1;
        if (g.state === 'investigate' || g.seesPlayer) susp = Math.max(susp, g.susp);
      }
      for (const g of this.guards) if (!g.functional) g.fallT = (g.fallT ?? 9) + dt;
      const hidden = p.hidden || (this.playerLight || 0) < 0.08 ? 1 : 0;
      const k = Math.min(1, (this.realDt || dt) * 4);
      m.alert += (alert - m.alert) * Math.min(1, (this.realDt || dt) * (alert > m.alert ? 10 : 2));
      m.watched += (watched * (1 - alert) - m.watched) * k;
      m.possess += ((this.controlled !== p ? 1 : 0) - m.possess) * k;
      m.hidden += (hidden * (1 - alert) - m.hidden) * k;
      LO.Music.setTension({ susp, alert: !!alert, hidden: !!hidden });
      LO.Music.setPower(this.lasersOn());
    }

    footsteps(p, ctl, dt) {
      if (!p.onGround || p.crouch || Math.abs(p.vx) < 30) { p.stepT = 0.15; }
      else {
        p.stepT -= dt;
        if (p.stepT <= 0) {
          const running = ctl.run && Math.abs(p.vx) > 160;
          p.stepT = running ? 0.28 : 0.4;
          LO.Sfx.play(running ? 'run' : 'step');
          this.noise(p.cx, p.bottom - 4, running ? 6 * TS : 2 * TS, 'step');
        }
      }
      if (p.landSpeed > 350) for (let i = 0; i < (p.landSpeed > 650 ? 10 : 5); i++) this.particles.push({ x: p.cx + LO.rand(-8, 8), y: p.bottom - 2, vx: LO.rand(-70, 70), vy: LO.rand(-50, -10), t: LO.rand(0.25, 0.45), color: 'rgba(170,160,150,0.5)', puff: true });
      if (p.landSpeed > 650) { LO.Sfx.play('land'); this.noise(p.cx, p.bottom, 4 * TS, 'step'); }
    }

    shoot() {
      const p = this.player;
      if (this.ammo <= 0) { this.float(p.cx, p.y - 16, 'Out of pellets', '#aaa', 1); LO.Sfx.play('deny'); return; }
      const m = this.aimWorld();
      const sx = p.cx + p.dir * 4, sy = p.y + 14;
      const a = Math.atan2(m.y - sy, m.x - sx);
      p.dir = Math.cos(a) < 0 ? -1 : 1;
      p.aimT = 0.3; p.aimAng = a;
      this.ammo--; this.stats.shots++;
      this.projectiles.push({ type: 'pellet', x: sx, y: sy, vx: Math.cos(a) * 950, vy: Math.sin(a) * 950, t: 1.2 });
      p.suspiciousT = Math.max(p.suspiciousT, 1);
      LO.Sfx.play('shoot');
      this.noise(sx, sy, 1.5 * TS, 'step');
    }

    throwBottle() {
      const p = this.player;
      if (this.bottles <= 0) { this.float(p.cx, p.y - 16, 'No bottles', '#aaa', 1); LO.Sfx.play('deny'); return; }
      const m = this.aimWorld();
      const sx = p.cx, sy = p.y + 10;
      const dx = m.x - sx, dy = m.y - sy;
      const d = Math.max(1, Math.hypot(dx, dy));
      const sp = Math.min(700, 260 + d * 1.1);
      this.bottles--;
      this.projectiles.push({ type: 'bottle', x: sx, y: sy, vx: (dx / d) * sp, vy: (dy / d) * sp - 160, t: 4, rot: 0 });
      p.suspiciousT = Math.max(p.suspiciousT, 1);
      LO.Sfx.play('throw');
    }

    updateProjectiles(dt) {
      const lvl = this.level;
      for (const pr of this.projectiles) {
        pr.t -= dt;
        if (pr.type === 'bottle') { pr.vy += LO.GRAVITY * 0.6 * dt; pr.rot += dt * 12; }
        const steps = Math.ceil((Math.hypot(pr.vx, pr.vy) * dt) / 4);
        for (let i = 0; i < steps && !pr.dead; i++) {
          pr.x += (pr.vx * dt) / steps; pr.y += (pr.vy * dt) / steps;
          const tx = Math.floor(pr.x / TS), ty = Math.floor(pr.y / TS);
          if (pr.type === 'pellet') {
            for (const l of this.lamps) if (!l.broken && LO.dist(l.x, l.y, pr.x, pr.y) < 10) { this.breakLamp(l); pr.dead = true; break; }
            if (pr.dead) break;
            for (const c of this.crates) if (c.state === 'hanging' && Math.abs(pr.x - (c.x + c.w / 2)) < 5 && pr.y > c.ropeTop && pr.y < c.y + 2) { this.dropCrate(c); pr.dead = true; break; }
            if (pr.dead) break;
            for (const f of this.fuses) if (f.state === 'ok' && pr.x > f.x && pr.x < f.x + f.w && pr.y > f.y && pr.y < f.y + f.h) { this.overloadFuse(f); pr.dead = true; break; }
            if (pr.dead) break;
            for (const g of this.guards) {
              if (!g.functional || pr.x < g.x || pr.x > g.x + g.w || pr.y < g.y || pr.y > g.y + g.h) continue;
              pr.dead = true;
              LO.Sfx.play('thud');
              if (!g.possessed && g.state !== 'alert' && g.state !== 'flee') {
                g.lastSeenX = this.player.cx; g.susp = Math.max(g.susp, 0.8); g.wary = 1;
                g.dir = Math.sign(this.player.cx - g.cx) || g.dir;
                g.setInvestigate(this.player.cx, true, 'Ow! Who did that?');
              }
              break;
            }
            if (pr.dead) break;
          } else {
            for (const g of [...this.guards, ...this.critters]) {
              if (!g.functional || pr.x < g.x || pr.x > g.x + g.w || pr.y < g.y || pr.y > g.y + g.h) continue;
              pr.dead = true; break;
            }
          }
          const t = lvl.tile(tx, ty);
          if (t === '#' || (t === 'G' && !lvl.gatesOpen && pr.type === 'bottle') || pr.dead) {
            pr.dead = true;
            if (pr.type === 'pellet') {
              LO.Sfx.play('ping');
              for (let k = 0; k < 4; k++) this.spark(pr.x, pr.y, '#ffd28a');
              this.noise(pr.x, pr.y, 3 * TS, 'ping');
            } else {
              LO.Sfx.play('shatter');
              for (let k = 0; k < 12; k++) this.spark(pr.x, pr.y, '#a8e6ff');
              this.noise(pr.x, pr.y, 7 * TS, 'bottle');
            }
          }
        }
        if (pr.t <= 0) pr.dead = true;
      }
      this.projectiles = this.projectiles.filter((p) => !p.dead);
    }

    allActors() { return [this.player, ...this.guards, ...this.critters]; }

    tripLaser(l, x) {
      l.cool = 4;
      LO.Sfx.play('alarm');
      LO.Input.rumble(0.4, 0.4, 250);
      this.say('LASER TRIPWIRE', 2);
      if (this.alarmCool <= 0) { this.stats.alarms++; this.alarmCool = 10; }
      for (const g of this.guards) {
        if (!g.functional || g.possessed || g.state === 'alert' || g.state === 'flee') continue;
        if (LO.dist(g.cx, g.cy, x, l.y) > 16 * TS) continue;
        g.lastSeenX = x; g.susp = Math.max(g.susp, 0.8); g.wary = 1;
        g.setInvestigate(x, true, LO.pick(['The lasers!', 'Someone tripped the wire!', 'Intruder in the beams!']));
      }
    }

    lasersOn() { return !this.fuses.some((f) => f.state === 'tripped'); }

    updateHazards(dt) {
      for (const l of this.lamps) if (l.spot) l.ang = l.spot.base + Math.sin(this.time * l.spot.speed + l.spot.phase) * l.spot.swing;
      // laser tripwires: staff badges (a uniform) don't trip them, and nothing does when the power is out
      if (this.lasers.length) {
        const on = this.lasersOn(), p = this.player;
        for (const l of this.lasers) {
          l.cool -= dt;
          if (!on || l.cool > 0 || p.disguised || p.hidden) continue;
          if (p.x < l.x1 && p.x + p.w > l.x0 && p.y < l.y + 1 && p.bottom > l.y - 1) this.tripLaser(l, p.cx);
        }
      }
      // crates
      for (const c of this.crates) {
        if (c.state !== 'falling') continue;
        c.vy = Math.min(c.vy + LO.GRAVITY * dt, 1100);
        const ny = c.y + c.vy * dt;
        for (const a of this.allActors()) {
          if (a.dead || a.lying) continue;
          if (a.x < c.x + c.w && a.x + a.w > c.x && a.y < ny + c.h && a.bottom > c.y + c.h * 0.5) this.kill(a, 'accident', 'crush');
        }
        const ty = Math.floor((ny + c.h) / TS);
        let landed = false;
        for (let tx = Math.floor(c.x / TS); tx <= Math.floor((c.x + c.w - 1) / TS); tx++)
          if (this.level.tile(tx, ty) === '#' || this.level.isPlatformTop(tx, ty)) landed = true;
        if (landed) {
          c.y = ty * TS - c.h; c.state = 'landed';
          LO.Sfx.play('crash'); this.shake = 12; LO.Input.rumble(0.9, 0.5, 320);
          for (let i = 0; i < 18; i++) this.spark(c.x + c.w / 2, c.y + c.h, '#b89b72');
          this.noise(c.x + c.w / 2, c.y + c.h - 8, 9 * TS, 'crash');
        } else c.y = ny;
      }
      // fuses
      for (const f of this.fuses) {
        if (f.state !== 'tripped') continue;
        f.t -= dt;
        if (Math.random() < dt * 3) this.spark(f.x + f.w / 2, f.y + 8, '#9be7ff');
        if (f.t <= 0) {
          f.state = 'ok';
          for (const l of this.lamps) if (l.circuit && !l.broken) l.on = true;
          this.float(f.x + f.w / 2, f.y - 10, 'Power restored', '#ffe08a');
        }
      }
      // electrified puddles
      if (this.zapT > 0) {
        this.zapT -= dt;
        for (const a of this.allActors()) {
          if (a.dead || (a.lying && a !== this.player)) continue;
          if (a === this.player && a.hidden) continue;
          for (const pd of this.puddles) {
            if (a.x < pd.x + pd.w && a.x + a.w > pd.x && Math.floor((a.bottom - 1) / TS) === pd.y / TS && a.onGround) {
              for (let i = 0; i < 8; i++) this.spark(a.cx, a.cy, '#c8f4ff');
              this.kill(a, 'accident', 'zap');
              break;
            }
          }
        }
      }
    }

    updateFx(dt) {
      for (const r of this.rings) r.t -= dt;
      this.rings = this.rings.filter((r) => r.t > 0);
      for (const p of this.particles) {
        p.t -= dt;
        if (p.float) { p.vx += Math.sin(p.t * 9 + p.y) * 20 * dt; }
        else if (p.puff) { p.vx *= 1 - dt * 5; p.vy = p.vy * (1 - dt * 5) - 8 * dt; p.size = (p.size || 2) + dt * 14; }
        else p.vy += 600 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      this.particles = this.particles.filter((p) => p.t > 0);
      for (const f of this.floaters) { f.t -= dt; f.y -= 18 * dt; }
      this.floaters = this.floaters.filter((f) => f.t > 0);
      for (const w of this.workers) { w.t -= dt; w.x += w.dir * 60 * dt; }
      this.workers = this.workers.filter((w) => w.t > 0);
      for (const t of this.tracers) t.t -= dt;
      this.tracers = this.tracers.filter((t) => t.t > 0);
      this.shake = Math.max(0, this.shake - dt * 30);
    }

    snapCamera() {
      const a = this.controlled || this.player;
      this.cam.x = this.clampCamX(a.cx - LO.VIEW_W / 2);
      this.cam.y = this.clampCamY(a.cy - LO.VIEW_H / 2);
    }
    clampCamX(x) { const m = this.level.pw - LO.VIEW_W; return m < 0 ? m / 2 : LO.clamp(x, 0, m); }
    clampCamY(y) { const m = this.level.ph - LO.VIEW_H; return m < 0 ? m / 2 : LO.clamp(y, 0, m); }
    updateCamera(dt) {
      const a = this.controlled;
      let lx, ly;
      if (LO.Input.usingPad) { const m = this.aimWorld(); lx = (m.x - a.cx) * 0.3; ly = (m.y - a.cy) * 0.2; }
      else { const m = LO.Input.mouse; lx = (m.x - LO.VIEW_W / 2) * 0.18; ly = (m.y - LO.VIEW_H / 2) * 0.12; }
      const tx = a.cx - LO.VIEW_W / 2 + lx;
      const ty = a.cy - LO.VIEW_H / 2 + ly;
      const k = Math.min(1, dt * 6);
      this.cam.x = this.clampCamX(LO.lerp(this.cam.x, tx, k));
      this.cam.y = this.clampCamY(LO.lerp(this.cam.y, ty, k));
    }

    // ------------------------------------------------------------ render
    // Sky first, then the world on its own layer so the darkness only falls on
    // the world (windows stay bright), then light, glow and the overlays.
    render(ctx) {
      const cam = this.cam;
      const sx = this.shake ? LO.rand(-this.shake, this.shake) * 0.5 : 0;
      const sy = this.shake ? LO.rand(-this.shake, this.shake) * 0.5 : 0;
      const ox = Math.round(-cam.x + sx), oy = Math.round(-cam.y + sy);
      LO.Scenery.drawSky(ctx, this);
      const W = this.wctx;
      W.setTransform(1, 0, 0, 1, 0, 0);
      W.globalCompositeOperation = 'source-over';
      W.clearRect(0, 0, LO.VIEW_W, LO.VIEW_H);
      W.save();
      W.translate(ox, oy);
      W.drawImage(this.staticCanvas, 0, 0);
      this.drawDynamicTiles(W);
      this.drawObjects(W);
      this.drawActors(W);
      this.drawProjectiles(W);
      LO.Scenery.drawWeather(W, this);
      W.restore();
      this.buildLightMap(ox, oy);
      W.globalCompositeOperation = 'source-atop';
      W.drawImage(this.lightCanvas, 0, 0);
      W.globalCompositeOperation = 'source-over';
      ctx.drawImage(this.worldCanvas, 0, 0);

      ctx.save();
      ctx.translate(ox, oy);
      this.drawGlow(ctx);
      LO.Scenery.drawGlow(ctx, this);
      this.drawRim(ctx);
      this.drawOverlayWorld(ctx);
      ctx.restore();
      if (this.lightning > 0) { ctx.fillStyle = `rgba(200,210,255,${this.lightning * 0.1})`; ctx.fillRect(0, 0, LO.VIEW_W, LO.VIEW_H); }
      LO.Scenery.drawVignette(ctx, this);
      if (this.intro) this.drawIntro(ctx);
      else LO.drawHUD(ctx, this);
      if (this.state === 'won') {
        const k = Math.min(1, this.winT / 0.9);
        ctx.fillStyle = `rgba(3,4,9,${k})`; ctx.fillRect(0, 0, LO.VIEW_W, LO.VIEW_H);
        ctx.globalAlpha = Math.min(1, this.winT * 2); ctx.textAlign = 'center';
        ctx.font = LO.F.d(64); ctx.fillStyle = '#f2e8d2'; ctx.fillText('MISSION COMPLETE', LO.VIEW_W / 2, LO.VIEW_H / 2);
        ctx.font = LO.F.t(16); ctx.fillStyle = '#b8ae98'; ctx.fillText('You slip out into the night.', LO.VIEW_W / 2, LO.VIEW_H / 2 + 34);
        ctx.globalAlpha = 1;
      }
    }

    // Letterbox bars and the mission title while the camera shows the target.
    drawIntro(ctx) {
      const it = this.intro, W = LO.VIEW_W, H = LO.VIEW_H;
      const out = Math.max(0, (it.t - (it.dur - 0.6)) / 0.6), inn = Math.min(1, it.t / 0.3);
      const bar = 62 * inn * (1 - out);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
      ctx.globalAlpha = Math.min(1, it.t * 2) * (1 - out);
      ctx.textAlign = 'left';
      ctx.font = LO.F.m(11); ctx.fillStyle = '#b8ae98';
      ctx.fillText(`CASE FILE No. ${this.index + 1}  ·  ${this.def.place.toUpperCase()}`, 40, H - 132);
      ctx.font = LO.F.d(58); ctx.fillStyle = '#f2e8d2'; ctx.fillText(this.def.name.toUpperCase(), 38, H - 70);
      if (it.t < 1.9 && this.target) {
        const tg = this.target, sx = tg.cx - this.cam.x, sy = tg.y - this.cam.y;
        ctx.textAlign = 'center';
        ctx.font = LO.F.d(22); ctx.fillStyle = '#ff7a5c'; ctx.fillText('TARGET', sx, sy - 44);
        ctx.font = LO.F.t(15); ctx.fillStyle = '#f2e8d2'; ctx.fillText(tg.name, sx, sy - 24);
      }
      ctx.textAlign = 'right'; ctx.font = LO.F.m(10); ctx.fillStyle = 'rgba(200,190,170,0.6)';
      ctx.fillText('ANY KEY TO SKIP', W - 30, H - 24);
      ctx.globalAlpha = 1;
    }

    drawDynamicTiles(ctx) {
      const lvl = this.level;
      const t = this.time;
      const x0 = Math.max(0, Math.floor(this.cam.x / TS) - 1), x1 = Math.min(lvl.w, x0 + LO.VIEW_W / TS + 3);
      const y0 = Math.max(0, Math.floor(this.cam.y / TS) - 1), y1 = Math.min(lvl.h, y0 + LO.VIEW_H / TS + 3);
      for (let ty = y0; ty < y1; ty++) for (let tx = x0; tx < x1; tx++) {
        const ch = lvl.tile(tx, ty), px = tx * TS, py = ty * TS;
        if (ch === 'G') {
          ctx.fillStyle = '#3b3326';
          ctx.fillRect(px, py, TS, 3);
          if (!lvl.gatesOpen) {
            ctx.fillStyle = '#8c7a52';
            for (let i = 3; i < TS; i += 7) ctx.fillRect(px + i, py, 3, TS);
            ctx.fillRect(px, py + 10, TS, 2); ctx.fillRect(px, py + 24, TS, 2);
          } else {
            ctx.fillStyle = '#5c5038';
            for (let i = 3; i < TS; i += 7) ctx.fillRect(px + i, py, 3, 5);
          }
        } else if (ch === '~') {
          const zap = this.zapT > 0;
          ctx.fillStyle = zap ? '#bff4ff' : 'rgba(80,140,190,0.55)';
          ctx.fillRect(px - 1, py + TS - 4, TS + 2, 4);
          ctx.fillStyle = zap ? '#ffffff' : 'rgba(160,210,255,0.5)';
          const s = (Math.sin(t * 2 + tx) * 0.5 + 0.5) * 20;
          ctx.fillRect(px + s, py + TS - 4, 6, 1);
          if (zap) {
            ctx.strokeStyle = '#e6fbff'; ctx.lineWidth = 1.5; ctx.beginPath();
            ctx.moveTo(px, py + TS - 4);
            for (let i = 1; i <= 4; i++) ctx.lineTo(px + i * 8, py + TS - 4 - Math.random() * 14);
            ctx.stroke();
          }
        } else if (ch === 'D') {
          const ok = this.controlled !== this.player || this.player.disguised;
          if (lvl.tile(tx, ty - 1) !== 'D') {
            ctx.fillStyle = ok ? '#5cff8a' : '#ff5c5c';
            ctx.fillRect(px + 13, py + 2, 6, 4);
          }
        }
      }
    }

    drawObjects(ctx) {
      const t = this.time;
      // exits
      for (const e of this.exits) {
        ctx.fillStyle = '#0d1a12'; ctx.fillRect(e.x + 2, e.y, 28, 64);
        ctx.strokeStyle = this.targetDown ? '#5cff8a' : '#2f5a3e'; ctx.lineWidth = 2;
        ctx.strokeRect(e.x + 3, e.y + 1, 26, 63);
        ctx.fillStyle = this.targetDown ? '#5cff8a' : '#2f5a3e';
        ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
        ctx.fillText('EXIT', e.x + 16, e.y - 4);
      }
      // signs
      for (const s of this.signs) {
        ctx.fillStyle = '#3a2f22'; ctx.fillRect(s.x + 6, s.y + 10, 3, 16);
        ctx.fillStyle = '#c9b48a'; ctx.fillRect(s.x - 2, s.y, 20, 13);
        ctx.fillStyle = '#3a2f22'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillText('?', s.x + 8, s.y + 10);
      }
      // lockers
      for (const k of this.lockers) {
        ctx.fillStyle = '#3d4a52'; ctx.fillRect(k.x, k.y, k.w, k.h);
        ctx.fillStyle = '#2c363d'; ctx.fillRect(k.x + 2, k.y + 2, k.w - 4, k.h - 4);
        ctx.fillStyle = '#56656f';
        for (let i = 0; i < 3; i++) ctx.fillRect(k.x + 7, k.y + 8 + i * 4, 14, 2);
        ctx.fillRect(k.x + 21, k.y + 30, 3, 8);
        if (this.player.locker === k) {
          ctx.fillStyle = '#7dff8a'; ctx.fillRect(k.x + 9, k.y + 12, 3, 2); ctx.fillRect(k.x + 15, k.y + 12, 3, 2);
        }
      }
      // cages
      for (const c of this.cages) {
        if (!c.opened) {
          LO.drawWorker(ctx, c.x + 6, c.y + 16, Math.sin(t * 1.5 + c.look * 6) > 0 ? 1 : -1, t);
        }
        ctx.fillStyle = '#4a4033'; ctx.fillRect(c.x, c.y, c.w, 4); ctx.fillRect(c.x, c.y + c.h - 4, c.w, 4);
        ctx.fillStyle = c.opened ? 'rgba(140,120,80,0.35)' : '#8c7a52';
        for (let i = 2; i < c.w; i += 6) ctx.fillRect(c.x + i, c.y, 2, c.opened ? 10 : c.h);
        if (!c.opened) { ctx.fillStyle = '#d4af37'; ctx.fillRect(c.x + 12, c.y + 30, 8, 7); }
      }
      // levers
      for (const l of this.levers) {
        ctx.fillStyle = '#3c4048'; ctx.fillRect(l.x - 2, l.y + 14, l.w + 4, 12);
        ctx.strokeStyle = l.kind === 'crane' ? '#e0a040' : '#c0c4cc'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(l.x + 7, l.y + 18);
        ctx.lineTo(l.x + 7 + (l.on ? 8 : -8), l.y + 2); ctx.stroke();
        ctx.fillStyle = l.kind === 'crane' ? '#ff6b3d' : '#ff3d3d';
        ctx.beginPath(); ctx.arc(l.x + 7 + (l.on ? 8 : -8), l.y + 2, 3.5, 0, Math.PI * 2); ctx.fill();
      }
      // fuse boxes
      for (const f of this.fuses) {
        ctx.fillStyle = '#4c5260'; ctx.fillRect(f.x, f.y, f.w, f.h);
        ctx.fillStyle = '#2b2f38'; ctx.fillRect(f.x + 3, f.y + 3, f.w - 6, f.h - 6);
        ctx.fillStyle = '#e6c229'; ctx.beginPath();
        ctx.moveTo(f.x + 12, f.y + 6); ctx.lineTo(f.x + 7, f.y + 16); ctx.lineTo(f.x + 11, f.y + 16); ctx.lineTo(f.x + 9, f.y + 24);
        ctx.lineTo(f.x + 15, f.y + 13); ctx.lineTo(f.x + 11, f.y + 13); ctx.closePath(); ctx.fill();
        ctx.fillStyle = f.state === 'ok' ? '#5cff8a' : (Math.sin(t * 20) > 0 ? '#ff4040' : '#401010');
        ctx.fillRect(f.x + f.w - 7, f.y + 5, 3, 3);
        ctx.strokeStyle = '#30343c'; ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(f.x + f.w / 2, f.y); ctx.lineTo(f.x + f.w / 2, f.y - 40); ctx.stroke();
      }
      // lamps
      for (const l of this.lamps) {
        ctx.strokeStyle = '#1a1c22'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(l.x, l.ceil); ctx.lineTo(l.x, l.y - 5); ctx.stroke();
        if (l.spot) {
          ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.ang - Math.PI / 2);
          ctx.fillStyle = '#353a46'; ctx.fillRect(-8, -9, 16, 14);
          ctx.fillStyle = '#4a5060'; ctx.fillRect(-10, 3, 20, 4);
          ctx.fillStyle = l.broken ? '#555' : l.on ? '#f4f8ff' : '#5a6070'; ctx.fillRect(-7, 6, 14, 3);
          ctx.restore();
          continue;
        }
        ctx.fillStyle = l.circuit ? '#3e4a3a' : '#40444f';
        ctx.beginPath(); ctx.moveTo(l.x - 9, l.y + 1); ctx.lineTo(l.x - 4, l.y - 6); ctx.lineTo(l.x + 4, l.y - 6); ctx.lineTo(l.x + 9, l.y + 1); ctx.closePath(); ctx.fill();
        if (l.broken) { ctx.fillStyle = '#555'; ctx.fillRect(l.x - 3, l.y + 1, 2, 3); ctx.fillRect(l.x + 1, l.y + 1, 2, 2); }
        else { ctx.fillStyle = l.on ? '#fff3c4' : '#6b6450'; ctx.beginPath(); ctx.arc(l.x, l.y + 2, 4, 0, Math.PI * 2); ctx.fill(); }
      }
      // crates
      for (const c of this.crates) {
        if (c.state === 'hanging') {
          ctx.strokeStyle = '#8a7350'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(c.x + c.w / 2, c.ropeTop); ctx.lineTo(c.x + c.w / 2, c.y); ctx.stroke();
          ctx.strokeStyle = '#5a4a32'; ctx.beginPath();
          ctx.moveTo(c.x + c.w / 2, c.y - 6); ctx.lineTo(c.x + 3, c.y); ctx.moveTo(c.x + c.w / 2, c.y - 6); ctx.lineTo(c.x + c.w - 3, c.y); ctx.stroke();
        } else if (c.state === 'falling') {
          ctx.strokeStyle = '#8a7350'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(c.x + c.w / 2, c.ropeTop); ctx.lineTo(c.x + c.w / 2 + 3, c.ropeTop + 16); ctx.stroke();
        }
        ctx.fillStyle = '#7a5c3a'; ctx.fillRect(c.x, c.y, c.w, c.h);
        ctx.fillStyle = '#5c4329';
        ctx.fillRect(c.x, c.y, c.w, 3); ctx.fillRect(c.x, c.y + c.h - 3, c.w, 3);
        ctx.fillRect(c.x, c.y, 3, c.h); ctx.fillRect(c.x + c.w - 3, c.y, 3, c.h);
        ctx.save(); ctx.beginPath(); ctx.rect(c.x, c.y, c.w, c.h); ctx.clip();
        ctx.strokeStyle = '#5c4329'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + c.w, c.y + c.h); ctx.stroke();
        ctx.restore();
      }
      // pickups
      for (const k of this.pickups) {
        if (k.taken) continue;
        const bob = Math.sin(t * 3 + k.x) * 2;
        if (k.type === 'ammo') {
          ctx.fillStyle = '#6b5a2e'; ctx.fillRect(k.x, k.y + bob + 4, 16, 10);
          ctx.fillStyle = '#ffd166'; for (let i = 0; i < 3; i++) ctx.fillRect(k.x + 3 + i * 4, k.y + bob + 1, 2, 4);
        } else {
          ctx.fillStyle = '#3f7a5a'; ctx.fillRect(k.x + 5, k.y + bob + 6, 7, 13); ctx.fillRect(k.x + 7, k.y + bob, 3, 7);
        }
      }
    }

    drawActors(ctx) {
      const t = this.time;
      for (const g of this.guards) if (!g.functional) LO.drawGuard(ctx, g, t);
      for (const c of this.critters) LO.drawCritter(ctx, c, t);
      for (const w of this.workers) { ctx.globalAlpha = Math.min(1, w.t); LO.drawWorker(ctx, w.x, w.y, w.dir, t * 3); ctx.globalAlpha = 1; }
      for (const g of this.guards) if (g.functional) LO.drawGuard(ctx, g, t);
      const p = this.player;
      if (!p.locker) LO.drawPlayer(ctx, p, t, this.controlled !== p);
    }

    drawProjectiles(ctx) {
      for (const pr of this.projectiles) {
        if (pr.type === 'pellet') {
          ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x - pr.vx * 0.012, pr.y - pr.vy * 0.012); ctx.stroke();
        } else {
          ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(pr.rot);
          ctx.fillStyle = '#3f7a5a'; ctx.fillRect(-3, -6, 6, 12); ctx.fillRect(-1, -10, 2, 4);
          ctx.restore();
        }
      }
      for (const p of this.particles) {
        ctx.fillStyle = p.color; ctx.globalAlpha = Math.min(1, p.t * 2);
        if (p.puff) { ctx.beginPath(); ctx.arc(p.x, p.y, p.size || 2, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(p.x - 1, p.y - 1, 2.5, 2.5);
      }
      ctx.globalAlpha = 1;
    }

    // A shaded lamp never moves, so its light and glow are drawn once into stamps.
    makeLampStamps(l) {
      const r = l.r, size = Math.ceil(r * 2);
      const mk = () => { const c = document.createElement('canvas'); c.width = size; c.height = size; return c; };
      const cut = mk(), glow = mk();
      const C = cut.getContext('2d'), G = glow.getContext('2d');
      for (const c of [C, G]) { c.translate(r - l.x, r - l.y); polyPath(c, l.poly); c.clip(); }
      const radial = (c, x, y, rr, col, stops) => {
        const g = c.createRadialGradient(x, y, 0, x, y, rr);
        for (const [k, a] of stops) g.addColorStop(k, `rgba(${col},${a})`);
        c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      };
      radial(C, l.x, l.y, 56, '0,0,0', [[0, 0.85], [1, 0]]);
      for (const [extra, a] of [[0.32, 0.45], [0.16, 0.35], [0, 1]]) {
        C.save(); wedge(C, l.x, l.y, l.r, Math.PI / 2 - l.cone - extra, Math.PI / 2 + l.cone + extra); C.clip();
        radial(C, l.x, l.y, l.r, '0,0,0', [[0, a], [0.45, 0.8 * a], [0.8, 0.3 * a], [1, 0]]);
        C.restore();
      }
      G.globalCompositeOperation = 'lighter';
      // layered wedges give the pool a soft edge, and a narrower one reads as a beam in the air
      for (const [extra, al] of [[0.3, 0.1], [0.12, 0.1], [-0.1, 0.12], [-0.45, 0.06]]) {
        G.save(); wedge(G, l.x, l.y, l.r, Math.PI / 2 - l.cone - extra, Math.PI / 2 + l.cone + extra); G.clip();
        radial(G, l.x, l.y, l.r, l.color, [[0, al], [0.55, al * 0.45], [1, 0]]);
        G.restore();
      }
      radial(G, l.x, l.y + 2, 22, l.color, [[0, 0.7], [1, 0]]);
      l.cutStamp = cut; l.glowStamp = glow;
    }

    inView(x, y, r) {
      return x + r > this.cam.x && x - r < this.cam.x + LO.VIEW_W && y + r > this.cam.y && y - r < this.cam.y + LO.VIEW_H;
    }

    // Darkness with light shapes cut out of it.
    buildLightMap(ox, oy) {
      const L = this.lctx;
      L.setTransform(1, 0, 0, 1, 0, 0);
      L.globalCompositeOperation = 'source-over';
      L.clearRect(0, 0, LO.VIEW_W, LO.VIEW_H);
      L.fillStyle = this.theme.dark;
      L.fillRect(0, 0, LO.VIEW_W, LO.VIEW_H);
      L.globalCompositeOperation = 'destination-out';
      L.translate(ox, oy);
      const radial = (x, y, r, stops) => {
        const g = L.createRadialGradient(x, y, 0, x, y, r);
        for (const [k, a] of stops) g.addColorStop(k, `rgba(0,0,0,${a})`);
        L.fillStyle = g; L.fillRect(x - r, y - r, r * 2, r * 2);
      };
      for (const l of this.lamps) {
        if (!l.on || !this.inView(l.x, l.y, l.r)) continue;
        const f = l.fl;
        if (!l.spot) { L.globalAlpha = f; L.drawImage(l.cutStamp, l.x - l.r, l.y - l.r); L.globalAlpha = 1; continue; }
        L.save(); polyPath(L, l.poly); L.clip();
        if (l.spot) {
          wedge(L, l.x, l.y, l.r, l.ang - l.spot.half, l.ang + l.spot.half); L.clip();
          radial(l.x, l.y, l.r, [[0, f], [0.6, 0.85 * f], [0.9, 0.4 * f], [1, 0]]);
        }
        L.restore();
      }
      // guard flashlights and vision polygons
      for (const g of this.guards) {
        g.visPoly = null;
        if (!g.functional || g.possessed || !this.inView(g.cx, g.cy, 300)) continue;
        const key = Math.round(g.eyeX) + ',' + Math.round(g.eyeY);
        if (g.visKey !== key) { g.visKey = key; g.visCache = this.level.visibility(g.eyeX, g.eyeY, 8.5 * TS); }
        g.visPoly = g.visCache;
        if (!g.flashlight) continue;
        L.save(); polyPath(L, g.visPoly); L.clip();
        wedge(L, g.eyeX, g.eyeY, FL_R, g.dir > 0 ? -FL_HALF : Math.PI - FL_HALF, g.dir > 0 ? FL_HALF : Math.PI + FL_HALF); L.clip();
        radial(g.eyeX, g.eyeY, FL_R, [[0, 1], [0.6, 0.7], [1, 0]]);
        L.restore();
      }
      // windows let in a little moonlight
      for (const w of this.windows) {
        if (!this.inView(w.x, w.y, 80)) continue;
        L.fillStyle = 'rgba(0,0,0,0.35)'; L.fillRect(w.x, w.y, w.w, w.h);
      }
      // night-vision goggles: you can always make out your surroundings a little
      const a = this.controlled;
      radial(a.cx, a.cy, 170, [[0, 0.45], [1, 0]]);
      L.setTransform(1, 0, 0, 1, 0, 0);
    }

    // Additive light on top: colored pools, visible beams, bulbs and flashes.
    drawGlow(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const radial = (x, y, r, col, stops) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        for (const [k, a] of stops) g.addColorStop(k, `rgba(${col},${a})`);
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      };
      for (const l of this.lamps) {
        if (l.flash > 0) radial(l.x, l.y, 90, l.color, [[0, l.flash * 2], [1, 0]]);
        if (!l.on || !this.inView(l.x, l.y, l.r)) continue;
        const f = l.fl;
        if (!l.spot) {
          ctx.globalAlpha = f; ctx.drawImage(l.glowStamp, l.x - l.r, l.y - l.r); ctx.globalAlpha = 1;
        } else {
          ctx.save(); polyPath(ctx, l.poly); ctx.clip();
          wedge(ctx, l.x, l.y, l.r, l.ang - l.spot.half, l.ang + l.spot.half); ctx.clip();
          radial(l.x, l.y, l.r, l.color, [[0, 0.3 * f], [0.7, 0.1 * f], [1, 0]]);
          ctx.restore();
          radial(l.x, l.y + 2, 22, l.color, [[0, 0.7 * f], [1, 0]]);
        }
        ctx.fillStyle = `rgba(255,250,235,${0.95 * f})`;
        ctx.beginPath(); ctx.arc(l.x, l.y + 2, 2.6, 0, Math.PI * 2); ctx.fill();
      }
      for (const g of this.guards) {
        if (!g.flashlight || !g.visPoly) continue;
        ctx.save(); polyPath(ctx, g.visPoly); ctx.clip();
        wedge(ctx, g.eyeX, g.eyeY, FL_R, g.dir > 0 ? -FL_HALF : Math.PI - FL_HALF, g.dir > 0 ? FL_HALF : Math.PI + FL_HALF); ctx.clip();
        radial(g.eyeX, g.eyeY, FL_R, '255,240,200', [[0, 0.22], [1, 0]]);
        ctx.restore();
      }
      for (const e of this.exits) radial(e.x + 16, e.y - 6, 26, this.targetDown ? '90,255,140' : '60,120,80', [[0, this.targetDown ? 0.5 + Math.sin(this.time * 4) * 0.15 : 0.15], [1, 0]]);
      ctx.restore();
    }

    // Lit characters catch a rim of lamp light, so being exposed reads at a glance.
    drawRim(ctx) {
      const t = this.time, col = this.theme.lamp;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const p = this.player;
      if (!p.locker && this.playerLight > 0.12) LO.drawPlayer(ctx, p, t, false, `rgba(${col},${Math.min(0.32, this.playerLight * 0.32)})`);
      for (const g of this.guards) {
        if (!g.functional || !this.inView(g.cx, g.cy, 40)) continue;
        const L = this.lightAt(g.cx, g.y + 12);
        if (L > 0.12) LO.drawGuard(ctx, g, t, `rgba(${col},${Math.min(0.26, L * 0.26)})`);
      }
      ctx.restore();
    }

    drawOverlayWorld(ctx) {
      const t = this.time;
      // vision cones
      for (const g of this.guards) {
        if (!g.visPoly) continue;
        const alertish = g.state === 'alert' || g.state === 'flee';
        const range = (alertish ? 9.5 : 8) * TS, half = alertish ? 0.9 : 0.62;
        ctx.save(); polyPath(ctx, g.visPoly); ctx.clip();
        ctx.beginPath(); ctx.moveTo(g.eyeX, g.eyeY);
        ctx.arc(g.eyeX, g.eyeY, range, g.dir > 0 ? -half : Math.PI - half, g.dir > 0 ? half : Math.PI + half);
        ctx.closePath();
        const col = alertish ? '255,70,70' : g.susp > 0.3 ? '255,170,60' : '255,235,170';
        const gr = ctx.createRadialGradient(g.eyeX, g.eyeY, 0, g.eyeX, g.eyeY, range);
        gr.addColorStop(0, `rgba(${col},${alertish ? 0.16 : 0.09})`); gr.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = gr; ctx.fill();
        ctx.restore();
      }
      // laser tripwires
      const lon = this.lasersOn();
      for (const l of this.lasers) {
        ctx.fillStyle = '#2b2f38';
        ctx.fillRect(l.x0, l.y - 6, 4, 12); ctx.fillRect(l.x1 - 4, l.y - 6, 4, 12);
        ctx.fillStyle = lon ? '#ff3b3b' : '#401818';
        ctx.fillRect(l.x0 + 1, l.y - 1, 2, 2); ctx.fillRect(l.x1 - 3, l.y - 1, 2, 2);
        if (!lon) continue;
        const flick = 0.75 + Math.sin(t * 30 + l.x0) * 0.15 + (l.cool > 0 ? 0.25 : 0);
        ctx.strokeStyle = `rgba(255,50,50,${0.18 * flick})`; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(l.x0 + 4, l.y); ctx.lineTo(l.x1 - 4, l.y); ctx.stroke();
        ctx.strokeStyle = `rgba(255,90,90,${flick})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(l.x0 + 4, l.y); ctx.lineTo(l.x1 - 4, l.y); ctx.stroke();
      }
      // goggles glint so you can find yourself in the dark
      const p = this.player;
      if (!p.locker) {
        const ey = p.crouch ? p.y + 7 : p.y + 8;
        ctx.fillStyle = this.controlled === p ? '#7dff8a' : '#4a8a55';
        ctx.fillRect(p.cx + p.dir * 3 - 1, ey, 4, 2);
      }
      // possession tether
      if (this.controlled !== p) {
        const h = this.controlled;
        ctx.strokeStyle = `rgba(201,160,255,${0.25 + Math.sin(t * 8) * 0.1})`; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.moveTo(p.cx, p.y + 8); ctx.quadraticCurveTo((p.cx + h.cx) / 2, Math.min(p.y, h.y) - 40, h.cx, h.y + 6); ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(201,160,255,0.8)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(h.cx, h.y - 6, 9, 3, 0, 0, Math.PI * 2); ctx.stroke();
      } else {
        // show who possession would grab when you aim near them
        const m = this.aimWorld();
        for (const a of this.possessCandidates()) {
          if (LO.dist(m.x, m.y, a.cx, a.cy) < 40) {
            ctx.strokeStyle = 'rgba(201,160,255,0.6)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.ellipse(a.cx, a.y - 6, 9, 3, 0, 0, Math.PI * 2); ctx.stroke();
          }
        }
      }
      // guard state markers
      ctx.textAlign = 'center';
      for (const g of this.guards) {
        if (!g.functional) {
          if (g.found) { ctx.fillStyle = '#ff8a5c'; ctx.font = LO.F.d(13); ctx.fillText('FOUND', g.cx, g.y - 8); }
          continue;
        }
        const hx = g.cx, hy = g.y - 12;
        if (g.isTarget) {
          ctx.fillStyle = '#ffd166';
          ctx.beginPath(); ctx.moveTo(hx, hy + 6); ctx.lineTo(hx - 5, hy - 2); ctx.lineTo(hx + 5, hy - 2); ctx.closePath(); ctx.fill();
        }
        if (g.possessed) continue;
        if (g.state === 'alert' || g.state === 'flee') {
          const pop = 1 + Math.max(0, 0.3 - (g.alertT || 9)) * 4;
          ctx.save(); ctx.translate(hx, hy - 6); ctx.scale(pop, pop);
          ctx.font = LO.F.d(26); ctx.fillStyle = '#000'; ctx.fillText('!', 1, 1); ctx.fillStyle = '#ff4040'; ctx.fillText('!', 0, 0);
          ctx.restore();
          if (g.seesPlayer && g.state === 'alert') {
            const k = g.aimT / this.aimTime;
            ctx.strokeStyle = `rgba(255,40,40,${0.2 + k * 0.6})`; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(g.cx + g.dir * 10, g.y + 18); ctx.lineTo(p.cx, p.cy); ctx.stroke();
          }
        } else if (g.state === 'dazed') {
          ctx.fillStyle = '#c9a0ff'; ctx.font = LO.F.d(16);
          ctx.fillText('~ ? ~', hx + Math.sin(t * 6) * 3, hy - 6);
        } else if (g.susp > 0.02) {
          ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(hx - 10, hy - 4, 20, 4);
          ctx.fillStyle = g.susp > 0.3 ? '#ffaa3c' : '#ffe9a8'; ctx.fillRect(hx - 10, hy - 4, 20 * g.susp, 4);
          if (g.susp > 0.3) { ctx.font = LO.F.d(20); ctx.fillStyle = '#000'; ctx.fillText('?', hx + 1, hy - 7); ctx.fillStyle = '#ffaa3c'; ctx.fillText('?', hx, hy - 8); }
        }
      }
      // speech
      ctx.font = LO.F.t(12);
      for (const g of this.guards) {
        if (!g.speech || g.speechT <= 0) continue;
        const w = ctx.measureText(g.speech).width + 14;
        const bx = g.cx - w / 2, by = g.y - 48;
        ctx.globalAlpha = Math.min(1, g.speechT * 2);
        ctx.fillStyle = g.state === 'alert' || g.state === 'flee' ? '#ffd9cf' : '#ece3cc';
        ctx.beginPath(); ctx.roundRect(bx, by, w, 18, 6); ctx.fill();
        ctx.beginPath(); ctx.moveTo(g.cx - 4, by + 17); ctx.lineTo(g.cx + 4, by + 17); ctx.lineTo(g.cx + 1, by + 23); ctx.fill();
        ctx.fillStyle = '#1e1a14'; ctx.fillText(g.speech, g.cx, by + 13);
        ctx.globalAlpha = 1;
      }
      // noise rings
      for (const r of this.rings) {
        const k = 1 - r.t / r.max;
        ctx.strokeStyle = `rgba(255,255,255,${(1 - k) * (r.kind === 'step' ? 0.12 : 0.3)})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.3 + 0.7 * k), 0, Math.PI * 2); ctx.stroke();
      }
      // tracers
      for (const tr of this.tracers) {
        ctx.strokeStyle = `rgba(255,230,150,${tr.t * 3})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(tr.x0, tr.y0); ctx.lineTo(tr.x1, tr.y1); ctx.stroke();
      }
      // interaction marker
      if (this.interaction && !this.interaction.disabled) {
        const a = this.controlled;
        ctx.fillStyle = this.interaction.danger ? '#ffd166' : '#ffffff';
        ctx.font = 'bold 11px monospace';
        LO.drawButtonGlyph(ctx, 'interact', a.cx, a.y - 22 + Math.sin(t * 6) * 2, 8);
        if (this.holdT > 0 && this.interaction.hold) {
          ctx.strokeStyle = '#9dffb0'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(a.cx, a.y - 22, 9, -Math.PI / 2, -Math.PI / 2 + (this.holdT / this.interaction.hold) * Math.PI * 2); ctx.stroke();
        }
      }
      // floaters
      ctx.font = LO.F.d(17);
      for (const f of this.floaters) {
        ctx.globalAlpha = Math.min(1, f.t * 1.5);
        ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillText(f.text.toUpperCase(), f.x + 1, f.y + 1);
        ctx.fillStyle = f.color; ctx.fillText(f.text.toUpperCase(), f.x, f.y);
      }
      ctx.globalAlpha = 1;
      // aim reticle
      if (this.controlled === p && this.state === 'play' && !this.intro) {
        const m = this.aimWorld();
        if (this.aimSnap) {
          ctx.strokeStyle = 'rgba(255,233,168,0.55)'; ctx.lineWidth = 1.5;
          const r = 13 + Math.sin(this.time * 8);
          for (let i = 0; i < 4; i++) { const a0 = i * Math.PI / 2 + Math.PI / 4; ctx.beginPath(); ctx.arc(m.x, m.y, r, a0 - 0.35, a0 + 0.35); ctx.stroke(); }
        }
        ctx.strokeStyle = this.ammo > 0 ? 'rgba(255,233,168,0.8)' : 'rgba(150,150,150,0.6)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(m.x, m.y, 7, 0, Math.PI * 2);
        ctx.moveTo(m.x - 11, m.y); ctx.lineTo(m.x - 4, m.y); ctx.moveTo(m.x + 4, m.y); ctx.lineTo(m.x + 11, m.y);
        ctx.moveTo(m.x, m.y - 11); ctx.lineTo(m.x, m.y - 4); ctx.moveTo(m.x, m.y + 4); ctx.lineTo(m.x, m.y + 11);
        ctx.stroke();
      }
    }
  }
  LO.Game = Game;
})(window.LO);
