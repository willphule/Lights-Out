'use strict';
// Adaptive score and ambience, synthesized live with Web Audio.
// The music follows the tension: calm pad, bass and vibraphone when you're unseen;
// brushes and a heartbeat when guards grow suspicious; drums and stabs when you're spotted.
// It muffles while you're hidden. Each mission also has its own soundscape.
(function (LO) {
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const PROG = [[0, 3, 7], [-4, 0, 3], [5, 8, 12], [7, 11, 14]]; // i, VI, iv, V in a minor key
  const PENTA = [0, 3, 5, 7, 10, 12, 15];

  const M = (LO.Music = {
    ctx: null, mode: 'off', themeKey: null,
    tension: { susp: 0, alert: false, hidden: false },
    intensity: 0.15,
    step: 0, nextTime: 0, bpm: 84, power: true,
    ambT: {}, amb: null,

    init() {
      const S = LO.Sfx;
      if (this.ctx || !S.ctx) return;
      const c = (this.ctx = S.ctx);
      this.out = c.createGain(); this.out.gain.value = 0.5; this.out.connect(S.master);
      this.filter = c.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 9000; this.filter.connect(this.out);
      this.bus = c.createGain(); this.bus.gain.value = 1; this.bus.connect(this.filter);
      // a generated hall reverb
      this.verb = c.createConvolver();
      const len = c.sampleRate * 2.6, ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4); }
      this.verb.buffer = ir;
      this.verbOut = c.createGain(); this.verbOut.gain.value = 0.42;
      this.verb.connect(this.verbOut); this.verbOut.connect(this.filter);
      this.verbIn = c.createGain(); this.verbIn.connect(this.verb);
      // sound effects get a touch of the same room
      this.sfxVerb = c.createGain(); this.sfxVerb.gain.value = 0.5; this.sfxVerb.connect(this.verb);
      this.ambBus = c.createGain(); this.ambBus.gain.value = 0.55; this.ambBus.connect(S.master);
      this.nextTime = c.currentTime + 0.1;
      this.timer = setInterval(() => this.tick(), 25);
      if (this.wantMode) this.setMode(this.wantMode, this.wantTheme);
    },

    setMode(mode, themeKey) {
      this.wantMode = mode; this.wantTheme = themeKey;
      if (!this.ctx) return;
      if (mode === this.mode && themeKey === this.themeKey) return;
      this.mode = mode; this.themeKey = themeKey;
      const th = themeKey && LO.THEMES[themeKey];
      this.root = mode === 'level' && th ? th.music.root : 38;
      this.bpm = mode === 'level' ? 84 : 70;
      this.intensity = 0.15;
      this.power = true;
      this.startAmbience(mode === 'level' && th ? th.ambience : null);
    },

    setTension(t) { this.tension = t; },

    setPower(on) {
      if (on === this.power || !this.amb) return;
      this.power = on;
      const now = this.ctx.currentTime;
      if (this.amb.hum) {
        this.amb.hum.gain.cancelScheduledValues(now);
        this.amb.hum.gain.setTargetAtTime(on ? 1 : 0, now, on ? 0.6 : 0.5);
        for (const o of this.amb.humOsc) o.detune.setTargetAtTime(on ? 0 : -1200, now, on ? 0.4 : 0.8);
      }
    },

    // ---------------------------------------------------------- instruments
    voice(type, f, when, dur, vol, opts = {}) {
      const c = this.ctx;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, when);
      if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * opts.slide), when + dur);
      if (opts.detune) o.detune.value = opts.detune;
      const a = opts.attack || 0.005;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(vol, when + a);
      if (opts.hold) g.gain.setValueAtTime(vol, when + a + opts.hold);
      g.gain.exponentialRampToValueAtTime(0.0001, when + a + (opts.hold || 0) + dur);
      let node = g;
      if (opts.lp) { const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = opts.lp; g.connect(f2); node = f2; }
      o.connect(g);
      node.connect(opts.dest || this.bus);
      if (opts.verb) node.connect(this.verbIn);
      o.start(when); o.stop(when + a + (opts.hold || 0) + dur + 0.05);
    },
    hiss(when, dur, vol, type, freq, q = 1, dest) {
      const c = this.ctx, S = LO.Sfx;
      const s = c.createBufferSource(); s.buffer = S.noiseBuf;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain();
      g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      s.connect(f); f.connect(g); g.connect(dest || this.bus);
      s.start(when, Math.random() * 0.5); s.stop(when + dur + 0.05);
    },

    // ---------------------------------------------------------- sequencer
    tick() {
      if (!this.ctx || this.mode === 'off') return;
      const c = this.ctx;
      // follow the game's tension
      const t = this.tension;
      const target = this.mode !== 'level' ? 0.1 : t.alert ? 1 : t.susp > 0.3 ? 0.62 : t.susp > 0.05 ? 0.35 : 0.15;
      this.intensity += (target - this.intensity) * (target > this.intensity ? 0.08 : 0.01);
      const muffle = this.mode === 'level' && t.hidden && !t.alert;
      this.filter.frequency.setTargetAtTime(muffle ? 1100 : 9000, c.currentTime, 0.25);
      if (this.nextTime < c.currentTime - 0.5) this.nextTime = c.currentTime + 0.05;
      while (this.nextTime < c.currentTime + 0.15) {
        this.playStep(this.step, this.nextTime);
        this.nextTime += 60 / this.bpm / 4;
        this.step++;
      }
      this.ambienceEvents();
    },

    playStep(step, when) {
      const s = step % 16, bar = Math.floor(step / 16);
      const chord = PROG[bar % 4];
      const R = this.root, I = this.intensity;
      const level = this.mode === 'level';
      // pad: one chord per bar
      if (s === 0) {
        const len = (60 / this.bpm) * 4;
        for (const n of chord) for (const dt of [-7, 7]) this.voice('sawtooth', midi(R + 24 + n), when, 1.4, 0.012 + (1 - I) * 0.006, { attack: 0.7, hold: len - 0.9, detune: dt, lp: 900, verb: true });
      }
      // bass
      const bassVol = 0.11 + I * 0.05;
      const bassNote = (k) => this.voice('triangle', midi(R + k), when, 0.32, bassVol, { lp: 700 });
      if (I < 0.3) { if (s === 0) bassNote(chord[0]); if (s === 8) bassNote(chord[0] + 7); }
      else if (I < 0.8) { if (s % 4 === 0) bassNote([chord[0], chord[0] + 7, chord[0] + 12, chord[0] + 10][s / 4]); }
      else if (s % 2 === 0) this.voice('sawtooth', midi(R + chord[0] + (s % 8 === 6 ? 12 : 0)), when, 0.12, 0.08, { lp: 500 });
      if (level) {
        // brushes
        if (I > 0.25) {
          if (s % 4 === 2) this.hiss(when, 0.04, 0.03 * I, 'highpass', 6500);
          if (s === 4 || s === 12) this.hiss(when, 0.14, 0.045 * I, 'bandpass', 3000, 0.8);
        }
        // heartbeat
        if (I > 0.5 && I < 0.9 && (s === 0 || s === 3)) this.voice('sine', 64, when, 0.22, 0.32 * (s ? 0.7 : 1), { slide: 0.6 });
        // spotted: drums and stabs
        if (I > 0.85) {
          if (s === 0 || s === 8 || s === 10) this.voice('sine', 90, when, 0.2, 0.5, { slide: 0.45 });
          if (s === 4 || s === 12) this.hiss(when, 0.16, 0.16, 'bandpass', 1800, 0.7);
          this.hiss(when, 0.03, 0.025, 'highpass', 8000);
          if (s === 0 || s === 3 || s === 6) for (const n of chord) this.voice('sawtooth', midi(R + 24 + n), when, 0.12, 0.022, { lp: 2500 });
        }
      }
      // vibraphone: sparse notes while things are calm
      if (I < 0.8) {
        const p = s % 4 === 0 ? 0.2 : s % 2 === 0 ? 0.06 : 0;
        if (Math.random() < p) {
          const n = R + 36 + PENTA[Math.floor(Math.random() * PENTA.length)] + (chord[0] > 4 ? 0 : 0);
          this.voice('sine', midi(n), when, 1.6, 0.045, { verb: true });
          this.voice('sine', midi(n) * 4, when, 0.25, 0.008, { verb: true });
        }
      }
      // the party upstairs: a muffled waltz in 3/4 (gala)
      if (level && this.themeKey === 'gala' && this.amb && step % 2 === 0) {
        const beat = (step / 2) % 6, bar3 = Math.floor(step / 12) % 4;
        const key = this.root + 7 + [0, 5, 7, 0][bar3];
        if (beat === 0 || beat === 3) this.voice('triangle', midi(key), when, 0.4, 0.035, { lp: 900, dest: this.ambBus });
        else this.voice('triangle', midi(key + 12 + [4, 7][beat % 2]), when, 0.25, 0.02, { lp: 1400, dest: this.ambBus });
      }
    },

    // ---------------------------------------------------------- ambience
    loopNoise(type, freq, q, vol) {
      const c = this.ctx;
      const s = c.createBufferSource(); s.buffer = LO.Sfx.noiseBuf; s.loop = true;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.value = vol;
      s.connect(f); f.connect(g); g.connect(this.ambBus); s.start();
      return { s, f, g };
    },
    startAmbience(kind) {
      const c = this.ctx;
      if (this.amb) {
        const old = this.amb;
        old.gain.gain.setTargetAtTime(0, c.currentTime, 0.3);
        setTimeout(() => old.nodes.forEach((n) => { try { n.stop(); } catch (e) { /* already stopped */ } }), 1500);
        this.amb = null;
      }
      if (!kind) return;
      const gain = c.createGain(); gain.gain.value = 0; gain.connect(this.ambBus);
      gain.gain.setTargetAtTime(1, c.currentTime, 0.8);
      const amb = { kind, gain, nodes: [] };
      const noise = (type, freq, q, vol, lfo) => {
        const s = c.createBufferSource(); s.buffer = LO.Sfx.noiseBuf; s.loop = true;
        const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
        const g = c.createGain(); g.gain.value = vol;
        s.connect(f); f.connect(g); g.connect(gain); s.start();
        amb.nodes.push(s);
        if (lfo) {
          const o = c.createOscillator(), og = c.createGain(); o.frequency.value = lfo[0]; og.gain.value = vol * lfo[1];
          o.connect(og); og.connect(g.gain); o.start(); amb.nodes.push(o);
        }
        return g;
      };
      if (kind === 'foundry') { noise('lowpass', 140, 0.7, 0.5); noise('bandpass', 480, 0.6, 0.12, [0.13, 0.6]); }
      if (kind === 'water') { noise('bandpass', 900, 0.5, 0.16, [0.08, 0.5]); noise('lowpass', 120, 0.7, 0.25); }
      if (kind === 'party') { noise('bandpass', 420, 1.4, 0.05, [0.3, 0.8]); noise('bandpass', 900, 2, 0.02, [0.21, 0.9]); }
      if (kind === 'rain') { noise('highpass', 1400, 0.5, 0.16); noise('lowpass', 400, 0.6, 0.12, [0.05, 0.4]); }
      if (kind === 'hum') {
        const hum = c.createGain(); hum.gain.value = 1; hum.connect(gain);
        amb.hum = hum; amb.humOsc = [];
        for (const [f, v] of [[50, 0.09], [100, 0.05], [150, 0.025], [330, 0.008]]) {
          const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; g.gain.value = v;
          o.connect(g); g.connect(hum); o.start(); amb.nodes.push(o); amb.humOsc.push(o);
        }
        noise('lowpass', 200, 0.7, 0.18);
      }
      this.amb = amb;
      this.ambT = { clank: 2, pump: 1, clink: 3, crackle: 1 };
    },
    ambienceEvents() {
      const a = this.amb;
      if (!a) return;
      const c = this.ctx, now = c.currentTime, T = this.ambT;
      const due = (k, lo, hi) => { T[k] -= 0.025; if (T[k] > 0) return false; T[k] = lo + Math.random() * (hi - lo); return true; };
      if (a.kind === 'foundry') {
        if (due('clank', 1.5, 5)) {
          const f = 300 + Math.random() * 500;
          for (const [k, v] of [[1, 0.05], [2.76, 0.03], [5.4, 0.015]]) this.voice('sine', f * k, now + 0.02, 0.7, v, { dest: a.gain, verb: true });
        }
        if (due('pump', 2.4, 2.4)) this.voice('sine', 52, now + 0.02, 0.35, 0.18, { slide: 0.7, dest: a.gain });
      }
      if (a.kind === 'water' && due('pump', 2.6, 2.6)) this.voice('sine', 46, now + 0.02, 0.45, 0.22, { slide: 0.7, dest: a.gain });
      if (a.kind === 'party' && due('clink', 2, 6)) { this.voice('sine', 2600 + Math.random() * 600, now + 0.02, 0.4, 0.015, { dest: a.gain }); this.voice('sine', 3900, now + 0.05, 0.3, 0.01, { dest: a.gain }); }
      if (a.kind === 'hum' && this.power && due('crackle', 0.4, 2.5)) this.hiss(now + 0.02, 0.03 + Math.random() * 0.05, 0.05, 'highpass', 3000, 1, a.gain);
    },
    drip() {
      if (!this.amb) return;
      const now = this.ctx.currentTime;
      this.voice('sine', 1300 + Math.random() * 500, now, 0.08, 0.05, { slide: 0.5, dest: this.amb.gain, verb: true });
    },
    thunder() {
      if (!this.amb) return;
      const now = this.ctx.currentTime + 0.3 + Math.random() * 0.8;
      this.hiss(now, 2.6, 0.6, 'lowpass', 140, 0.7, this.amb.gain);
      this.hiss(now, 0.5, 0.25, 'lowpass', 600, 0.7, this.amb.gain);
    },

    // ---------------------------------------------------------- stingers
    sting(kind) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime + 0.01, R = this.root || 38;
      if (kind === 'spotted') {
        for (const n of [0, 6, 12]) this.voice('sawtooth', midi(R + 24 + n), now, 0.5, 0.04, { lp: 3000, verb: true });
        this.voice('sine', 110, now, 0.5, 0.4, { slide: 0.4 });
      } else if (kind === 'target') {
        [0, 3, 7, 10, 15].forEach((n, i) => this.voice('sine', midi(R + 36 + n), now + i * 0.09, 1.8, 0.05, { verb: true }));
        this.voice('sawtooth', midi(R + 12), now, 2, 0.03, { lp: 600, attack: 0.3 });
      } else if (kind === 'fail') {
        [12, 11, 10, 6].forEach((n, i) => this.voice('triangle', midi(R + 24 + n), now + i * 0.22, 0.6, 0.06, { verb: true }));
      } else if (kind === 'win') {
        [0, 7, 12, 15, 19].forEach((n, i) => this.voice('triangle', midi(R + 24 + n), now + i * 0.12, 1.4, 0.05, { verb: true }));
      } else if (kind === 'stamp') {
        this.hiss(now, 0.25, 0.5, 'lowpass', 400, 0.8, LO.Sfx.master);
        this.voice('sine', 70, now, 0.3, 0.5, { slide: 0.5, dest: LO.Sfx.master });
      } else if (kind === 'type') {
        this.hiss(now, 0.03, 0.12, 'bandpass', 2500 + Math.random() * 1500, 3, LO.Sfx.master);
      } else if (kind === 'blackout') {
        this.voice('sawtooth', 120, now, 1.6, 0.08, { slide: 0.25, lp: 800 });
      }
    },
  });
  void M;
})(window.LO);
