'use strict';
// Core helpers: math, input and synthesized sound.
window.LO = window.LO || {};
(function (LO) {
  LO.TS = 32;            // tile size in pixels
  LO.VIEW_W = 960;
  LO.VIEW_H = 540;
  LO.GRAVITY = 1800;
  LO.MAX_FALL = 900;

  LO.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  LO.lerp = (a, b, t) => a + (b - a) * t;
  LO.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  LO.rand = (a, b) => a + Math.random() * (b - a);
  LO.sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
  LO.approach = (v, target, step) =>
    v < target ? Math.min(v + step, target) : Math.max(v - step, target);

  // ---------------------------------------------------------------- Input
  const Input = (LO.Input = {
    down: new Set(),
    pressed: new Set(),
    mouse: { x: 480, y: 270, down: false, pressed: false, rpressed: false, moved: false },
    init(canvas) {
      const block = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
      window.addEventListener('keydown', (e) => {
        if (block.has(e.code)) e.preventDefault();
        if (!this.down.has(e.code)) this.pressed.add(e.code);
        this.down.add(e.code);
        this.usingPad = false;
        LO.Sfx.unlock();
      });
      window.addEventListener('keyup', (e) => this.down.delete(e.code));
      window.addEventListener('blur', () => this.down.clear());
      const pos = (e) => {
        const r = canvas.getBoundingClientRect();
        this.mouse.x = ((e.clientX - r.left) * canvas.width) / r.width;
        this.mouse.y = ((e.clientY - r.top) * canvas.height) / r.height;
      };
      canvas.addEventListener('mousemove', (e) => {
        pos(e); this.mouse.moved = true;
        if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) this.usingPad = false;
      });
      canvas.addEventListener('mousedown', (e) => {
        pos(e);
        this.usingPad = false;
        LO.Sfx.unlock();
        if (e.button === 2) this.mouse.rpressed = true;
        else { this.mouse.pressed = true; this.mouse.down = true; }
        e.preventDefault();
      });
      window.addEventListener('mouseup', (e) => { if (e.button !== 2) this.mouse.down = false; });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    },
    isDown(...codes) { return codes.some((c) => this.down.has(c)); },
    wasPressed(...codes) { return codes.some((c) => this.pressed.has(c)); },
    endFrame() {
      this.pressed.clear();
      this.padPressed.clear();
      this.mouse.pressed = false;
      this.mouse.rpressed = false;
      this.mouse.moved = false;
    },

    // ---------------------------------------------------------- controller
    // Standard mapping: 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 Back,
    // 9 Start, 10 L3, 11 R3, 12-15 D-pad up/down/left/right.
    // 100-103 are the left stick pushed up/down/left/right, so menus can use it.
    usingPad: false,
    padDown: new Set(),
    padPressed: new Set(),
    stick: { x: 0, y: 0 },
    aim: { x: 0, y: 0 },
    pollPad() {
      let pad = null;
      try {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const p of pads) if (p && p.connected) { pad = p; break; }
      } catch (e) { pad = null; }
      this.pad = pad;
      const now = new Set();
      if (pad) {
        const dz = (v) => (Math.abs(v) < 0.22 ? 0 : v);
        this.stick.x = dz(pad.axes[0] || 0); this.stick.y = dz(pad.axes[1] || 0);
        this.aim.x = dz(pad.axes[2] || 0); this.aim.y = dz(pad.axes[3] || 0);
        pad.buttons.forEach((b, i) => { if (b && (b.pressed || b.value > 0.5)) now.add(i); });
        if (this.stick.y < -0.6) now.add(100);
        if (this.stick.y > 0.6) now.add(101);
        if (this.stick.x < -0.6) now.add(102);
        if (this.stick.x > 0.6) now.add(103);
        if (now.size || Math.hypot(this.stick.x, this.stick.y) > 0.5 || Math.hypot(this.aim.x, this.aim.y) > 0.5) {
          if (!this.usingPad) LO.Sfx.unlock();
          this.usingPad = true;
        }
      } else {
        this.stick.x = this.stick.y = this.aim.x = this.aim.y = 0;
      }
      for (const b of now) if (!this.padDown.has(b)) this.padPressed.add(b);
      this.padDown = now;
    },
    padIsDown(...b) { return b.some((i) => this.padDown.has(i)); },
    padWasPressed(...b) { return b.some((i) => this.padPressed.has(i)); },
    rumble(strong, weak, ms) {
      const a = this.pad && this.usingPad && this.pad.vibrationActuator;
      if (!a || !a.playEffect) return;
      try { a.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {}); } catch (e) { /* not supported */ }
    },

    // Named actions, each fed by keys, mouse buttons and controller buttons.
    ACTIONS: {
      interact: { keys: ['KeyE'], pad: [2] },
      possess: { keys: ['KeyQ'], pad: [3] },
      shoot: { mouse: 'pressed', pad: [7] },
      throw: { keys: ['KeyF'], mouse: 'rpressed', pad: [6] },
      pause: { keys: ['Escape', 'KeyP'], pad: [9] },
      help: { keys: ['KeyH'], pad: [8] },
      restart: { keys: ['KeyR'], pad: [] },
      mute: { keys: ['KeyM'], pad: [] },
      confirm: { keys: ['Enter', 'Space'], pad: [0] },
      back: { keys: ['Escape'], pad: [1] },
      navUp: { keys: ['ArrowUp', 'KeyW'], pad: [12, 100] },
      navDown: { keys: ['ArrowDown', 'KeyS', 'Tab'], pad: [13, 101] },
    },
    action(name) {
      const a = this.ACTIONS[name];
      return (a.keys && this.wasPressed(...a.keys)) || (a.mouse && this.mouse[a.mouse]) || this.padWasPressed(...a.pad);
    },
    held(name) {
      const a = this.ACTIONS[name];
      return (a.keys && this.isDown(...a.keys)) || (a.mouse === 'pressed' && this.mouse.down) || this.padIsDown(...a.pad);
    },
    anyPressed() { return this.pressed.size > 0 || this.mouse.pressed || this.padPressed.size > 0; },

    // Button names for on-screen prompts, matching whatever was used last.
    LABELS: {
      interact: ['E', 'X'], possess: ['Q', 'Y'], shoot: ['left click', 'RT'], throw: ['right click or F', 'LT'],
      move: ['A/D', 'the left stick'], jump: ['Space', 'A'], crouch: ['S', 'down on the left stick'],
      climb: ['W/S', 'up/down on the left stick'], run: ['Shift', 'LB'], aim: ['the mouse', 'the right stick'],
      pause: ['Esc', 'Start'], help: ['H', 'Back'], restart: ['R', 'Start → Restart'],
    },
    label(name) { const l = this.LABELS[name]; return l ? l[this.usingPad ? 1 : 0] : name; },
    fill(text) { return text.replace(/\{(\w+)\}/g, (m, k) => this.label(k)); },

    // Movement intent shared by the player and possessed hosts.
    controls() {
      const s = this.stick;
      return {
        left: this.isDown('KeyA', 'ArrowLeft') || s.x < -0.35 || this.padIsDown(14),
        right: this.isDown('KeyD', 'ArrowRight') || s.x > 0.35 || this.padIsDown(15),
        up: this.isDown('KeyW', 'ArrowUp') || s.y < -0.5 || this.padIsDown(12),
        down: this.isDown('KeyS', 'ArrowDown', 'ControlLeft') || s.y > 0.5 || this.padIsDown(13),
        upPressed: this.wasPressed('KeyW', 'ArrowUp'),
        jump: this.wasPressed('Space') || this.padWasPressed(0),
        run: this.isDown('ShiftLeft', 'ShiftRight') || this.padIsDown(4, 10),
      };
    },
  });

  // ---------------------------------------------------------------- Sound
  // Every sound is synthesized so the game ships with no audio files.
  const Sfx = (LO.Sfx = {
    ctx: null,
    master: null,
    muted: false,
    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.3;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        if (LO.Music) LO.Music.init();
      } catch (e) { this.ctx = null; }
    },
    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.3;
      return this.muted;
    },
    tone(freq, dur, type = 'square', vol = 0.2, slide = 0, delay = 0) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master);
      if (this._rev && LO.Music && LO.Music.sfxVerb) g.connect(LO.Music.sfxVerb);
      o.start(t); o.stop(t + dur + 0.02);
    },
    noise(dur, vol = 0.2, freq = 2000, delay = 0, q = 1) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + delay;
      const s = this.ctx.createBufferSource();
      s.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(f); f.connect(g); g.connect(this.master);
      if (this._rev && LO.Music && LO.Music.sfxVerb) g.connect(LO.Music.sfxVerb);
      s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    },
    play(name) {
      if (!this.ctx || this.muted) return;
      this._rev = !['step', 'run', 'click', 'type'].includes(name);
      switch (name) {
        case 'step': this.noise(0.05, 0.05, 600, 0, 2); break;
        case 'run': this.noise(0.07, 0.12, 500, 0, 2); break;
        case 'jump': this.tone(220, 0.12, 'triangle', 0.08, 160); break;
        case 'land': this.noise(0.1, 0.12, 300); break;
        case 'shoot': this.noise(0.06, 0.25, 3000, 0, 3); this.tone(900, 0.05, 'square', 0.05, -500); break;
        case 'glass': this.noise(0.35, 0.3, 5000, 0, 0.8); this.tone(1800, 0.2, 'sine', 0.05, 600); break;
        case 'ping': this.noise(0.05, 0.12, 2500, 0, 4); break;
        case 'thud': this.noise(0.18, 0.35, 180); this.tone(90, 0.15, 'sine', 0.2, -40); break;
        case 'crash': this.noise(0.6, 0.5, 250); this.tone(70, 0.5, 'sawtooth', 0.15, -40); break;
        case 'zap': this.tone(120, 0.5, 'sawtooth', 0.2, 60); this.noise(0.5, 0.3, 4000, 0, 0.5); break;
        case 'alert': this.tone(660, 0.12, 'square', 0.15); this.tone(880, 0.25, 'square', 0.15, 0, 0.12); break;
        case 'huh': this.tone(400, 0.15, 'triangle', 0.1, 120); break;
        case 'possess': this.tone(200, 0.5, 'sine', 0.2, 600); this.tone(300, 0.5, 'triangle', 0.08, 900); break;
        case 'release': this.tone(700, 0.4, 'sine', 0.15, -550); break;
        case 'lever': this.noise(0.08, 0.2, 900, 0, 3); this.tone(160, 0.08, 'square', 0.08); break;
        case 'unlock': this.tone(500, 0.08, 'square', 0.08); this.tone(750, 0.12, 'square', 0.08, 0, 0.08); break;
        case 'free': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.15, 'triangle', 0.12, 0, i * 0.08)); break;
        case 'throw': this.noise(0.12, 0.08, 1200); break;
        case 'shatter': this.noise(0.4, 0.3, 4500, 0, 0.7); break;
        case 'shot': this.noise(0.25, 0.5, 1500, 0, 0.5); this.tone(100, 0.2, 'sawtooth', 0.2, -60); break;
        case 'caught': this.tone(300, 0.6, 'sawtooth', 0.15, -200); break;
        case 'win': [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.15, 0, i * 0.12)); break;
        case 'pickup': this.tone(880, 0.08, 'square', 0.08); this.tone(1320, 0.1, 'square', 0.08, 0, 0.06); break;
        case 'hide': this.noise(0.15, 0.15, 700); break;
        case 'click': this.tone(600, 0.04, 'square', 0.06); break;
        case 'deny': this.tone(180, 0.15, 'square', 0.1); break;
        case 'alarm': [0, 0.22, 0.44].forEach((d) => { this.tone(980, 0.16, 'square', 0.12, -300, d); }); break;
        case 'disguise': this.noise(0.3, 0.12, 1000); this.tone(330, 0.2, 'triangle', 0.08, 110); break;
      }
    },
  });
})(window.LO);
