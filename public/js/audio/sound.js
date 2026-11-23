// Web Audio API 합성 사운드 — 외부 음원 파일 없이 목탁/범종/풍경/효과음을 만듭니다.
// 브라우저 정책상 사용자 첫 클릭(입장 버튼) 이후에 init() 해야 소리가 납니다.

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    try { this.muted = localStorage.getItem('sansa-muted') === '1'; } catch { /* ignore */ }
  }

  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    // 은은한 공간감: 짧은 피드백 딜레이를 리버브 대용으로 사용
    this.wet = this.ctx.createGain(); this.wet.gain.value = 0.28;
    const delay = this.ctx.createDelay(1); delay.delayTime.value = 0.19;
    const fb = this.ctx.createGain(); fb.gain.value = 0.42;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    this.wet.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.startAmbience();
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('sansa-muted', m ? '1' : '0'); } catch { /* ignore */ }
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.1);
  }

  out(gainNode, wet = true) {
    gainNode.connect(this.master);
    if (wet) gainNode.connect(this.wet);
  }

  // 감쇠하는 사인 부분음 하나
  partial(freq, { gain = 0.2, attack = 0.005, decay = 1, when = 0, type = 'sine', detune = 0 } = {}) {
    const c = this.ctx; const t = c.currentTime + when;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g); this.out(g);
    o.start(t); o.stop(t + attack + decay + 0.05);
  }

  noiseBuffer() {
    if (this._noise) return this._noise;
    const len = this.ctx.sampleRate * 2;
    const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return (this._noise = b);
  }

  // 🪵 목탁: 짧고 둥근 나무 울림 (공명 대역 + 짧은 타격 노이즈)
  moktak() {
    if (!this.ctx) return;
    const c = this.ctx; const t = c.currentTime;
    const pitch = 520 + Math.random() * 30;
    this.partial(pitch, { gain: 0.5, attack: 0.002, decay: 0.22 });
    this.partial(pitch * 2.02, { gain: 0.12, attack: 0.002, decay: 0.08 });
    this.partial(pitch * 0.5, { gain: 0.18, attack: 0.002, decay: 0.15 });
    const n = c.createBufferSource(); n.buffer = this.noiseBuffer();
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 3;
    const g = c.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    n.connect(bp); bp.connect(g); this.out(g, false); n.start(t); n.stop(t + 0.05);
  }

  // 🔔 범종: 낮은 기음 + 비정수배 부분음, 살짝 어긋난 주파수 쌍으로 '맥놀이'를 표현
  bell() {
    if (!this.ctx) return;
    const f = 98;
    const ratios = [[0.5, 0.25, 9], [1, 0.3, 7], [1.19, 0.12, 5], [1.56, 0.1, 4], [2.0, 0.09, 3.5], [2.74, 0.05, 2.5], [3.76, 0.03, 1.8]];
    for (const [r, g, d] of ratios) {
      this.partial(f * r, { gain: g, attack: 0.01, decay: d });
      this.partial(f * r * 1.004, { gain: g * 0.6, attack: 0.01, decay: d }); // 맥놀이
    }
    const c = this.ctx; const t = c.currentTime;
    const n = c.createBufferSource(); n.buffer = this.noiseBuffer();
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
    const g = c.createGain(); g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    n.connect(lp); lp.connect(g); this.out(g, false); n.start(t); n.stop(t + 0.15);
  }

  // 🎐 풍경: 높은 금속성 부분음이 1~3번 '딸랑'
  chime(strength = 1) {
    if (!this.ctx) return;
    const base = 1650 + Math.random() * 300;
    const hits = 1 + Math.floor(Math.random() * 3 * strength);
    for (let i = 0; i < hits; i++) {
      const when = i * (0.12 + Math.random() * 0.25);
      const f = base * (1 + (Math.random() - 0.5) * 0.04);
      this.partial(f, { gain: 0.09 * strength, attack: 0.002, decay: 2.2, when });
      this.partial(f * 2.76, { gain: 0.03 * strength, attack: 0.002, decay: 1.0, when });
      this.partial(f * 5.4, { gain: 0.012 * strength, attack: 0.002, decay: 0.5, when });
    }
  }

  // ✨ 장식을 달았을 때: 맑은 아르페지오
  sparkle() {
    if (!this.ctx) return;
    [0, 4, 7, 12, 16].forEach((st, i) => this.partial(880 * 2 ** (st / 12), { gain: 0.07, attack: 0.004, decay: 0.9, when: i * 0.07, type: 'triangle' }));
  }

  // 🙏 합장/인사: 부드러운 싱잉볼 느낌
  bow() {
    if (!this.ctx) return;
    this.partial(392, { gain: 0.12, attack: 0.08, decay: 2.5 });
    this.partial(392 * 2.71, { gain: 0.04, attack: 0.08, decay: 1.6 });
  }

  click() { if (this.ctx) this.partial(1200, { gain: 0.04, attack: 0.001, decay: 0.05 }); }

  // 배경: 아주 낮은 바람 소리 + 가끔 들리는 풍경
  startAmbience() {
    const c = this.ctx;
    const n = c.createBufferSource(); n.buffer = this.noiseBuffer(); n.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const g = c.createGain(); g.gain.value = 0.035;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = c.createGain(); lfoG.gain.value = 0.02;
    lfo.connect(lfoG); lfoG.connect(g.gain);
    n.connect(lp); lp.connect(g); g.connect(this.master);
    n.start(); lfo.start();
    const loop = () => {
      if (!document.hidden) this.chime(0.45);
      setTimeout(loop, 9000 + Math.random() * 14000);
    };
    setTimeout(loop, 6000);
  }
}

export const sound = new SoundEngine();
