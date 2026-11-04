'use strict';
// Tile map, collision queries, line of sight and light visibility polygons.
(function (LO) {
  const TS = LO.TS;

  // Characters that are terrain. Everything else in a map is a marker for an object.
  //  #  wall            -  one-way platform     H  ladder
  //  V  vent (hides)    D  security door (guards / disguised only)
  //  G  gate (lever)    %  grate (only small creatures fit)
  //  ~  puddle on the floor below
  const TERRAIN = new Set(['#', '-', 'H', 'V', 'D', 'G', '%', '~', ' ']);

  class Level {
    constructor(def) {
      this.def = def;
      const rows = def.map;
      this.h = rows.length;
      this.w = Math.max(...rows.map((r) => r.length));
      this.grid = [];
      this.markers = [];
      this.turnMarks = new Set();
      for (let y = 0; y < this.h; y++) {
        const row = [];
        for (let x = 0; x < this.w; x++) {
          const ch = rows[y][x] || ' ';
          if (TERRAIN.has(ch)) row.push(ch);
          else {
            row.push(' ');
            if (ch === '|') this.turnMarks.add(x + ',' + y);
            else this.markers.push({ ch, x, y });
          }
        }
        this.grid.push(row);
      }
      this.pw = this.w * TS;
      this.ph = this.h * TS;
      this.gatesOpen = false;
      this.buildSegments();
    }

    tile(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return '#';
      return this.grid[ty][tx];
    }

    solidFor(tx, ty, ent) {
      switch (this.tile(tx, ty)) {
        case '#': return true;
        case 'D': return !(ent && (ent._escape || ent.passDoors()));
        case 'G': return !(this.gatesOpen || (ent && (ent._escape || ent.tiny)));
        case '%': return !(ent && (ent.tiny || ent._escape));
        default: return false;
      }
    }

    isPlatformTop(tx, ty) {
      const t = this.tile(tx, ty);
      return t === '-' || (t === 'H' && this.tile(tx, ty - 1) !== 'H');
    }

    // Something an actor can stand on (used for guard ledge checks).
    standable(tx, ty, ent) {
      return this.solidFor(tx, ty, ent) || this.isPlatformTop(tx, ty);
    }

    blocksLight(tx, ty) { return this.tile(tx, ty) === '#'; }

    // Sight is blocked by walls only; doors, gates and grates are bars.
    los(x0, y0, x1, y1) {
      const d = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.ceil(d / 6);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        if (this.blocksLight(Math.floor((x0 + (x1 - x0) * t) / TS), Math.floor((y0 + (y1 - y0) * t) / TS))) return false;
      }
      return true;
    }

    // Edges between wall tiles and open space, merged into long runs.
    buildSegments() {
      const segs = [];
      const solid = (x, y) => this.blocksLight(x, y);
      for (let y = 0; y <= this.h; y++) {
        let runA = null, runB = null;
        for (let x = 0; x <= this.w; x++) {
          const a = x < this.w && solid(x, y - 1) !== solid(x, y) && y > 0 && y < this.h;
          const kind = a ? (solid(x, y) ? 1 : 2) : 0;
          if (runA !== null && kind !== runB) { segs.push({ ax: runA * TS, ay: y * TS, bx: x * TS, by: y * TS }); runA = null; }
          if (kind && runA === null) { runA = x; runB = kind; }
        }
      }
      for (let x = 0; x <= this.w; x++) {
        let runA = null, runB = null;
        for (let y = 0; y <= this.h; y++) {
          const a = y < this.h && solid(x - 1, y) !== solid(x, y) && x > 0 && x < this.w;
          const kind = a ? (solid(x, y) ? 1 : 2) : 0;
          if (runA !== null && kind !== runB) { segs.push({ ax: x * TS, ay: runA * TS, bx: x * TS, by: y * TS }); runA = null; }
          if (kind && runA === null) { runA = y; runB = kind; }
        }
      }
      this.segs = segs;
    }

    // Polygon of everything a light at (lx,ly) reaches within radius r.
    visibility(lx, ly, r) {
      const segs = [];
      for (const s of this.segs) {
        if (Math.max(s.ax, s.bx) < lx - r || Math.min(s.ax, s.bx) > lx + r) continue;
        if (Math.max(s.ay, s.by) < ly - r || Math.min(s.ay, s.by) > ly + r) continue;
        segs.push(s);
      }
      const x0 = lx - r, x1 = lx + r, y0 = ly - r, y1 = ly + r;
      segs.push({ ax: x0, ay: y0, bx: x1, by: y0 }, { ax: x1, ay: y0, bx: x1, by: y1 },
        { ax: x1, ay: y1, bx: x0, by: y1 }, { ax: x0, ay: y1, bx: x0, by: y0 });
      const angles = [];
      for (const s of segs) {
        for (const [px, py] of [[s.ax, s.ay], [s.bx, s.by]]) {
          const a = Math.atan2(py - ly, px - lx);
          angles.push(a - 0.0002, a, a + 0.0002);
        }
      }
      for (let i = 0; i < 32; i++) angles.push(-Math.PI + (i / 32) * Math.PI * 2);
      angles.sort((a, b) => a - b);
      const pts = [];
      for (const a of angles) {
        const dx = Math.cos(a), dy = Math.sin(a);
        let best = Infinity;
        for (const s of segs) {
          const sx = s.bx - s.ax, sy = s.by - s.ay;
          const den = dx * sy - dy * sx;
          if (Math.abs(den) < 1e-9) continue;
          const t = ((s.ax - lx) * sy - (s.ay - ly) * sx) / den;
          const u = ((s.ax - lx) * dy - (s.ay - ly) * dx) / den;
          if (t >= 0 && u >= -1e-6 && u <= 1 + 1e-6 && t < best) best = t;
        }
        if (best === Infinity) continue;
        pts.push(lx + dx * best, ly + dy * best);
      }
      return pts;
    }
  }
  LO.Level = Level;

  // ------------------------------------------------------------ Physics
  LO.collides = function (level, a, x, y, w = a.w, h = a.h) {
    const x0 = Math.floor(x / TS), x1 = Math.floor((x + w - 0.001) / TS);
    const y0 = Math.floor(y / TS), y1 = Math.floor((y + h - 0.001) / TS);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++)
        if (level.solidFor(tx, ty, a)) return true;
    return false;
  };

  LO.platformBelow = function (level, a, s) {
    if (a.dropT > 0 || a.climbing) return false;
    const bottom = a.y + a.h, nb = bottom + s;
    const row = Math.floor(nb / TS);
    const top = row * TS;
    if (!(bottom <= top + 0.01 && nb > top)) return false;
    const x0 = Math.floor((a.x + 1) / TS), x1 = Math.floor((a.x + a.w - 1) / TS);
    for (let tx = x0; tx <= x1; tx++) if (level.isPlatformTop(tx, row)) return true;
    return false;
  };

  LO.moveActor = function (level, a, dt) {
    a._escape = false;
    if (LO.collides(level, a, a.x, a.y)) a._escape = true; // a door closed on us: let us out
    if (!a.climbing && !a.noGravity) a.vy = Math.min(a.vy + LO.GRAVITY * dt, LO.MAX_FALL);
    let dx = a.vx * dt;
    a.hitWall = 0;
    while (dx !== 0) {
      const s = Math.abs(dx) > 1 ? Math.sign(dx) : dx;
      if (!LO.collides(level, a, a.x + s, a.y)) { a.x += s; dx -= s; }
      else { a.hitWall = Math.sign(dx); a.vx = 0; break; }
    }
    let dy = a.vy * dt;
    const fallSpeed = a.vy;
    a.onGround = false;
    while (dy !== 0) {
      const s = Math.abs(dy) > 1 ? Math.sign(dy) : dy;
      if (s > 0 && LO.platformBelow(level, a, s)) {
        a.y = Math.floor((a.y + a.h + s) / TS) * TS - a.h;
        a.onGround = true; a.vy = 0; break;
      }
      if (!LO.collides(level, a, a.x, a.y + s)) { a.y += s; dy -= s; }
      else { if (s > 0) a.onGround = true; a.vy = 0; break; }
    }
    a.landSpeed = a.onGround && !a.wasGround ? fallSpeed : 0;
    a.wasGround = a.onGround;
    a._escape = false;
  };
})(window.LO);
