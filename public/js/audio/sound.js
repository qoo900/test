// Web Audio 합성 사운드 (외부 음원 없음)
//  - 벽난로: 낮게 웅웅대는 불 소리 + 무작위 '탁, 타닥' 장작 튀는 소리
//  - 장식 달기: 반짝이는 아르페지오 / 카드 열기: 작은 종소리
// 브라우저 정책상 첫 클릭(입장) 뒤에 init() 해야 소리가 납니다.

class SoundEngine {
  constructor() {
    this.ctx = null; this.master = null; this.muted = false;
    try { this.muted = localStorage.getItem('tree-muted') === '1'; } catch { /* ignore */ }
  }

  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);
    this.startFire();
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('tree-muted', m ? '1' : '0'); } catch { /* ignore */ }
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.1);
  }

  noise() {
    if (this._noise) return this._noise;
    const len = this.ctx.sampleRate * 3; const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate); const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5 + w * 0.02; } // 브라운 노이즈
    return (this._noise = b);
  }
  white() {
    if (this._white) return this._white;
    const len = this.ctx.sampleRate; const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return (this._white = b);
  }

  startFire() {
    const c = this.ctx;
    // 불 소리 바닥: 브라운 노이즈 + 저역 필터 + 느린 흔들림
    const src = c.createBufferSource(); src.buffer = this.noise(); src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;
    const g = c.createGain(); g.gain.value = 0.22;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.3; const lg = c.createGain(); lg.gain.value = 0.06;
    lfo.connect(lg); lg.connect(g.gain);
    src.connect(lp); lp.connect(g); g.connect(this.master); src.start(); lfo.start();
    // 장작 튀는 소리
    const crackle = () => {
      if (!document.hidden) {
        const pops = Math.random() < 0.3 ? 2 + Math.floor(Math.random() * 4) : 1;
        for (let i = 0; i < pops; i++) this.pop(i * (0.02 + Math.random() * 0.07));
      }
      setTimeout(crackle, 80 + Math.random() * 650);
    };
    crackle();
  }

  pop(when = 0) {
    const c = this.ctx; const t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.white(); s.playbackRate.value = 0.7 + Math.random() * 0.8;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500 + Math.random() * 3500; bp.Q.value = 1.5 + Math.random() * 3;
    const g = c.createGain(); const v = 0.05 + Math.random() * 0.22; const d = 0.008 + Math.random() * 0.03;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(bp); bp.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02);
  }

  tone(freq, { gain = 0.08, attack = 0.004, decay = 0.8, when = 0, type = 'sine' } = {}) {
    if (!this.ctx) return;
    const c = this.ctx; const t = c.currentTime + when;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + attack + decay + 0.05);
  }

  sparkle() { [0, 4, 7, 12, 16].forEach((st, i) => this.tone(1046 * 2 ** (st / 12), { gain: 0.06, decay: 0.9, when: i * 0.07, type: 'triangle' })); }
  ding() { this.tone(1568, { gain: 0.05, decay: 1.2 }); this.tone(1568 * 2.76, { gain: 0.015, decay: 0.5 }); }

  // ── 오르골 캐럴: "고요한 밤" (F. Gruber, 1818 — 퍼블릭 도메인) ──
  // [음이름, 8분음표 개수] / 6/8박자, 느린 템포
  static MELODY = [
    ['G4', 3], ['A4', 1], ['G4', 2], ['E4', 6], ['G4', 3], ['A4', 1], ['G4', 2], ['E4', 6],
    ['D5', 4], ['D5', 2], ['B4', 6], ['C5', 4], ['C5', 2], ['G4', 6],
    ['A4', 4], ['A4', 2], ['C5', 3], ['B4', 1], ['A4', 2], ['G4', 3], ['A4', 1], ['G4', 2], ['E4', 6],
    ['A4', 4], ['A4', 2], ['C5', 3], ['B4', 1], ['A4', 2], ['G4', 3], ['A4', 1], ['G4', 2], ['E4', 6],
    ['D5', 4], ['D5', 2], ['F5', 3], ['D5', 1], ['B4', 2], ['C5', 6], ['E5', 6],
    ['C5', 3], ['G4', 1], ['E4', 2], ['G4', 3], ['F4', 1], ['D4', 2], ['C4', 12],
  ];
  static freq(n) {
    const map = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
    return 440 * 2 ** ((map[n[0]] + (Number(n[1]) - 4) * 12) / 12);
  }
  musicBox(freq, when, dur) {
    const c = this.ctx; const t = c.currentTime + when;
    const g = c.createGain(); g.connect(this.musicGain);
    [[1, 0.5, 2.2], [2, 0.12, 0.9], [3.01, 0.05, 0.4], [5.4, 0.025, 0.2]].forEach(([m, a, d]) => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = freq * m;
      const og = c.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(a, t + 0.006); og.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(d, dur * 0.9));
      o.connect(og); og.connect(g); o.start(t); o.stop(t + Math.max(d, dur) + 0.1);
    });
    // 아래 화음(5도/옥타브 아래)을 아주 작게
    if (dur >= 1.5) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = freq / 2;
      const og = c.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.12, t + 0.01); og.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.2);
      o.connect(og); og.connect(g); o.start(t); o.stop(t + dur * 1.3);
    }
  }
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    if (!this.musicGain) {
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.11;
      // 잔향 느낌: 짧은 딜레이 피드백
      const d = this.ctx.createDelay(1); d.delayTime.value = 0.33; const fb = this.ctx.createGain(); fb.gain.value = 0.35;
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
      this.musicGain.connect(this.master); this.musicGain.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(this.master);
    }
    this.musicGain.gain.setTargetAtTime(0.11, this.ctx.currentTime, 0.5);
    const eighth = 0.36;
    const play = () => {
      if (!this.musicOn) return;
      let t = 0.1;
      for (const [n, len] of SoundEngine.MELODY) { this.musicBox(SoundEngine.freq(n), t, len * eighth); t += len * eighth; }
      this.musicTimer = setTimeout(play, (t + 6) * 1000); // 한 번 끝나면 6초 쉬고 다시
    };
    play();
  }
  stopMusic() {
    this.musicOn = false; clearTimeout(this.musicTimer);
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.4);
  }
}

export const sound = new SoundEngine();
