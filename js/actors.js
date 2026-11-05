'use strict';
// Player, guards, the mission target and small creatures.
(function (LO) {
  const TS = LO.TS;

  class Actor {
    constructor(x, y, w, h) {
      this.x = x; this.y = y; this.w = w; this.h = h;
      this.vx = 0; this.vy = 0; this.dir = 1;
      this.onGround = false; this.wasGround = false; this.climbing = false;
      this.dropT = 0; this.coyote = 0; this.jumpBuf = 0; this.anim = 0;
      this.dead = false; this.ko = false; this.possessed = false;
      this.speech = null; this.speechT = 0;
    }
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    get bottom() { return this.y + this.h; }
    get functional() { return !this.dead && !this.ko; }
    passDoors() { return false; }
    say(text, t = 1.6) { this.speech = text; this.speechT = t; }
    overlaps(o, pad = 0) {
      return this.x - pad < o.x + o.w && this.x + this.w + pad > o.x && this.y - pad < o.y + o.h && this.y + this.h + pad > o.y;
    }
    // tile index of the floor under the actor's feet
    get floorRow() { return Math.floor((this.bottom + 2) / TS); }
  }
  LO.Actor = Actor;

  // Ladder helpers
  function ladderOverlap(level, a) {
    const tx = Math.floor(a.cx / TS);
    const y0 = Math.floor(a.y / TS), y1 = Math.floor((a.y + a.h - 0.001) / TS);
    for (let ty = y0; ty <= y1; ty++) if (level.tile(tx, ty) === 'H') return true;
    return false;
  }
  function ladderBelow(level, a) {
    return level.tile(Math.floor(a.cx / TS), Math.floor((a.bottom + 1) / TS)) === 'H';
  }
  function onOneWay(level, a) {
    const row = Math.floor((a.bottom + 1) / TS);
    const x0 = Math.floor((a.x + 1) / TS), x1 = Math.floor((a.x + a.w - 1) / TS);
    let any = false;
    for (let tx = x0; tx <= x1; tx++) {
      if (level.solidFor(tx, row, a)) return false;
      if (level.tile(tx, row) === '-') any = true;
    }
    return any;
  }

  // Movement shared by the player and anything the player possesses.
  LO.controlActor = function (game, a, inp, dt, o) {
    const lvl = game.level;
    a.dropT = Math.max(0, a.dropT - dt);
    a.coyote = a.onGround ? 0.09 : Math.max(0, a.coyote - dt);
    const move = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const onLadder = o.canClimb && ladderOverlap(lvl, a);
    const jumpPressed = inp.jump || (inp.upPressed && !onLadder && !a.climbing);
    a.jumpBuf = jumpPressed ? 0.12 : Math.max(0, a.jumpBuf - dt);

    // crouching (also forced while there's no headroom)
    if (o.canCrouch) {
      const diff = a.standH - a.crouchH;
      const want = inp.down && a.onGround && !a.climbing && !(ladderBelow(lvl, a) && !a.crouch);
      if (want && !a.crouch) { a.y += diff; a.h = a.crouchH; a.crouch = true; }
      else if (!want && a.crouch) {
        if (!LO.collides(lvl, a, a.x, a.y - diff, a.w, a.standH)) { a.y -= diff; a.h = a.standH; a.crouch = false; }
      }
    }

    // ladders
    if (o.canClimb && !a.climbing && !a.crouch) {
      if ((inp.up && onLadder && !inp.jump) || (inp.down && a.onGround && ladderBelow(lvl, a))) {
        a.climbing = true; a.vx = 0; a.vy = 0;
      }
    }
    if (a.climbing) {
      const stillOn = ladderOverlap(lvl, a) || (inp.down && ladderBelow(lvl, a));
      if (!stillOn) { a.climbing = false; a.vy = Math.max(0, a.vy); }
      else {
        a.vy = ((inp.down ? 1 : 0) - (inp.up ? 1 : 0)) * o.climbSpeed;
        a.vx = move * 70;
        if (move) a.dir = move;
        else {
          const lc = Math.floor(a.cx / TS) * TS + TS / 2 - a.w / 2;
          a.x += (lc - a.x) * Math.min(1, dt * 12);
        }
        if (a.jumpBuf > 0) { a.climbing = false; a.vy = -o.jumpV * 0.7; a.jumpBuf = 0; }
        else if (a.onGround && inp.down && !ladderBelow(lvl, a)) a.climbing = false;
        a.anim += Math.abs(a.vy) * dt * 0.05;
      }
    }

    // let go of jump early for a shorter hop
    if (a.jumping && !inp.jumpHeld && a.vy < -120) { a.vy *= 0.5; a.jumping = false; }
    if (a.onGround || a.vy >= 0) a.jumping = false;
    if (!a.climbing) {
      let sp = o.speed;
      if (a.crouch) sp = o.crouchSpeed;
      else if (inp.run && o.runSpeed) sp = o.runSpeed;
      const accel = a.onGround ? 2200 : 1300;
      a.vx = LO.approach(a.vx, move * sp, accel * dt);
      if (move) a.dir = move;
      if (a.jumpBuf > 0 && a.coyote > 0) {
        if (inp.down && onOneWay(lvl, a)) { a.dropT = 0.25; a.y += 1; }
        else if (!a.crouch) { a.vy = -o.jumpV; a.jumping = true; LO.Sfx.play('jump'); }
        a.jumpBuf = 0; a.coyote = 0;
      }
      if (a.onGround) a.anim += Math.abs(a.vx) * dt * 0.06;
    }
    LO.moveActor(lvl, a, dt);
  };

  // ------------------------------------------------------------ Player
  class Player extends Actor {
    constructor(x, y) {
      super(x, y, 18, 44);
      this.kind = 'player';
      this.standH = 44; this.crouchH = 24;
      this.crouch = false;
      this.disguised = false;
      this.locker = null;
      this.hidden = false;
      this.inVent = false;
      this.suspiciousT = 0; // seconds during which guards treat what you do as suspicious
      this.stepT = 0;
      this.takedownT = 0;
    }
    passDoors() { return this.disguised; }
  }
  LO.Player = Player;
  LO.PLAYER_MOVE = { speed: 140, runSpeed: 235, crouchSpeed: 80, jumpV: 520, climbSpeed: 130, canCrouch: true, canClimb: true };
  LO.GUARD_MOVE = { speed: 120, runSpeed: 0, crouchSpeed: 0, jumpV: 470, climbSpeed: 110, canCrouch: false, canClimb: true };
  LO.CRITTER_MOVE = { speed: 150, runSpeed: 0, crouchSpeed: 0, jumpV: 380, climbSpeed: 0, canCrouch: false, canClimb: false };

  // ------------------------------------------------------------ Guard
  // States: patrol, pause, investigate, search, return, alert, flee, dazed
  class Guard extends Actor {
    constructor(x, y, cfg = {}) {
      super(x, y, 20, 46);
      this.kind = 'guard';
      this.cfg = cfg;
      this.name = cfg.name || 'Guard';
      this.dir = cfg.facing || 1;
      this.state = 'patrol';
      this.t = 0; this.lookT = 0;
      this.susp = 0; this.wary = 0;
      this.flashlight = !!cfg.flashlight;
      this.route = cfg.route || null; this.routeI = 0;
      this.goalX = null; this.hurry = false;
      this.aimT = 0; this.lostT = 0;
      this.lastSeenX = 0; this.lastSeenY = 0;
      this.seesPlayer = false;
      this.stripped = false; this.found = false;
      this.walk = cfg.speed || 55;
    }
    passDoors() { return true; }
    get eyeX() { return this.cx + this.dir * 4; }
    get eyeY() { return this.y + 10; }

    setInvestigate(x, hurry, speech) {
      if (this.state === 'alert' || this.state === 'flee' || !this.functional || this.possessed || this.state === 'dazed') return;
      this.state = 'investigate';
      this.goalX = x; this.hurry = hurry; this.t = 0;
      if (speech) this.say(speech);
    }

    blockedAhead(level, dir) {
      if (this.hitWall === dir) return true;
      const ax = Math.floor((this.cx + dir * (this.w / 2 + 3)) / TS);
      const fy = this.floorRow;
      if (!level.standable(ax, fy, this)) return true; // ledge
      const ty = Math.floor((this.y + 4) / TS), by = Math.floor((this.bottom - 2) / TS);
      for (let y = ty; y <= by; y++) if (level.solidFor(ax, y, this)) return true;
      return false;
    }

    walkToward(level, x, speed) {
      const d = x - this.cx;
      if (Math.abs(d) < 4) { this.vx = 0; return 'arrived'; }
      const dir = Math.sign(d);
      this.dir = dir;
      if (this.blockedAhead(level, dir)) { this.vx = 0; return 'blocked'; }
      this.vx = dir * speed;
      return 'moving';
    }

    update(dt, g) {
      this.speechT -= dt;
      if (this.dead || this.ko) {
        this.vx = 0; this.climbing = false;
        LO.moveActor(g.level, this, dt);
        return;
      }
      if (this.possessed) return; // the game drives possessed hosts
      const lvl = g.level;
      if (this.state === 'dazed') {
        this.vx = 0; this.t -= dt;
        if (this.t <= 0) { this.state = 'return'; }
        LO.moveActor(lvl, this, dt);
        return;
      }
      g.perceive(this, dt);
      this.wary = Math.max(0, this.wary - dt * 0.01);
      const speedMul = this.wary > 0.5 ? 1.15 : 1;
      switch (this.state) {
        case 'patrol': {
          if (this.route) {
            const p = this.route[this.routeI % this.route.length];
            const r = this.walkToward(lvl, p[0] * TS + TS / 2, this.walk * speedMul);
            if (r !== 'moving') { this.state = 'pause'; this.t = p[1]; this.faceAfter = p[2] || 0; }
          } else {
            const atEnd = (this.dir > 0 && this.cx >= this.patrolMax) || (this.dir < 0 && this.cx <= this.patrolMin);
            if (atEnd || this.blockedAhead(lvl, this.dir)) {
              this.vx = 0; this.state = 'pause'; this.t = LO.rand(1.6, 3.2);
            } else this.vx = this.dir * this.walk * speedMul;
          }
          break;
        }
        case 'pause': {
          this.vx = 0; this.t -= dt;
          if (this.route && this.faceAfter) this.dir = this.faceAfter;
          if (this.route && this.route[this.routeI % this.route.length][3] && this.t > 0) {
            // a stop where they look back and forth
            this.lookT -= dt; if (this.lookT <= 0) { this.dir = -this.dir; this.lookT = 2; this.faceAfter = 0; }
          }
          if (this.t <= 0) {
            if (this.route) { this.routeI++; this.state = 'patrol'; }
            else { this.dir = -this.dir; this.state = 'patrol'; }
          }
          break;
        }
        case 'investigate': {
          const r = this.walkToward(lvl, this.goalX, this.hurry ? 135 : 70);
          this.t += dt;
          if (r !== 'moving' || this.t > 12) { this.state = 'search'; this.t = this.hurry ? 6 : 4; this.lookT = 1.1; this.vx = 0; }
          break;
        }
        case 'search': {
          this.vx = 0; this.t -= dt; this.lookT -= dt;
          if (this.lookT <= 0) { this.dir = -this.dir; this.lookT = 1.3; }
          if (this.t <= 0) { this.state = 'return'; this.say(LO.pick(['Must be rats.', 'Nothing.', 'Hmph.', 'Back to it.'])); }
          break;
        }
        case 'return': {
          if (this.route) { this.state = 'patrol'; break; }
          const gx = LO.clamp(this.cx, this.patrolMin + 2, this.patrolMax - 2);
          const r = this.walkToward(lvl, gx, this.walk);
          if (r !== 'moving') { this.state = 'patrol'; }
          break;
        }
        case 'alert': {
          if (this.seesPlayer) {
            this.lostT = 0;
            this.aimT += dt;
            this.dir = Math.sign(this.lastSeenX - this.cx) || this.dir;
            const d = Math.abs(this.lastSeenX - this.cx);
            if (d > 3 * TS) this.walkToward(lvl, this.lastSeenX, 95); else this.vx = 0;
            if (this.aimT >= g.aimTime) g.guardShoots(this);
          } else {
            this.aimT = Math.max(0, this.aimT - dt * 1.5);
            this.lostT += dt;
            this.walkToward(lvl, this.lastSeenX, 160);
            if (this.lostT > 3.5) {
              this.state = 'search'; this.t = 7; this.lookT = 1; this.susp = 0.6; this.wary = 1;
              this.say(LO.pick(['Where did they go?', 'Lost them...', 'Spread out!']));
            }
          }
          g.checkGrab(this);
          break;
        }
        case 'flee': {
          // the target runs from danger and calls for help
          this.t -= dt;
          if (this.seesPlayer) { this.t = 5; this.dir = -Math.sign(this.lastSeenX - this.cx) || this.dir; }
          const r = this.walkToward(lvl, this.cx - Math.sign(this.lastSeenX - this.cx) * 200, 150);
          if (r === 'blocked') { this.vx = 0; this.dir = Math.sign(this.lastSeenX - this.cx) || this.dir; }
          this.callT = (this.callT || 0) - dt;
          if (this.seesPlayer && this.callT <= 0) { g.raiseAlarm(this, 'Guards! GUARDS!'); this.callT = 3; }
          if (this.t <= 0) { this.state = 'return'; this.susp = 0.5; this.wary = 1; }
          break;
        }
      }
      if (this.vx !== 0 && this.onGround) this.anim += Math.abs(this.vx) * dt * 0.06;
      LO.moveActor(lvl, this, dt);
    }
  }
  LO.Guard = Guard;

  class Target extends Guard {
    constructor(x, y, cfg = {}) {
      super(x, y, cfg);
      this.kind = 'target';
      this.isTarget = true;
      this.w = 22; this.h = 46;
      this.walk = cfg.speed || 48;
    }
  }
  LO.Target = Target;

  // ------------------------------------------------------------ Critter
  class Critter extends Actor {
    constructor(x, y) {
      super(x, y + 22, 14, 10);
      this.kind = 'critter';
      this.tiny = true;
      this.t = LO.rand(0.5, 2);
      this.moving = false;
    }
    update(dt, g) {
      this.speechT -= dt;
      if (this.dead) { this.vx = 0; LO.moveActor(g.level, this, dt); return; }
      if (this.possessed) return;
      if (this.state === 'dazed') { this.t -= dt; this.vx = 0; if (this.t <= 0) this.state = null; LO.moveActor(g.level, this, dt); return; }
      this.t -= dt;
      if (this.t <= 0) {
        this.moving = Math.random() < 0.6;
        if (Math.random() < 0.5) this.dir = -this.dir;
        this.t = LO.rand(0.6, 2.2);
      }
      if (this.moving) {
        const ax = Math.floor((this.cx + this.dir * 9) / TS);
        if (this.hitWall === this.dir || !g.level.standable(ax, this.floorRow, this)) { this.dir = -this.dir; }
        this.vx = this.dir * 70;
      } else this.vx = 0;
      if (this.vx) this.anim += Math.abs(this.vx) * dt * 0.12;
      LO.moveActor(g.level, this, dt);
    }
  }
  LO.Critter = Critter;

  LO.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
})(window.LO);
