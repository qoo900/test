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
    // iOS: 무음 스위치가 켜져 있어도 소리가 나도록 '재생' 세션으로 (Safari 17+), 구형은 무음 오디오 태그로 세션 전환
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* ignore */ }
    this.unlockTag();
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    if (this.ctx.state !== 'running') this.ctx.resume?.();
    // 브라우저가 소리를 막아 두었으면 다음 터치/키 입력 때 다시 켬
    const wake = () => { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume?.(); };
    addEventListener('pointerdown', wake, true); addEventListener('keydown', wake, true);
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);
    this.startFire();
  }

  unlockTag() {
    if (this._tag) return;
    try {
      // 0.2초짜리 무음 WAV를 만들어 반복 재생 (오디오 세션을 '미디어 재생'으로 바꾸는 용도)
      const sr = 8000, n = 1600, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
      const w = (o, str) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
      w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
      const a = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))); a.loop = true; a.volume = 0.01; a.setAttribute('playsinline', '');
      a.play().catch(() => {}); this._tag = a;
    } catch { /* ignore */ }
  }
  get running() { return !!this.ctx && this.ctx.state === 'running'; }

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
    // 눈 내리는 소리: 창밖 바람에 눈이 스치는 듯한 부드러운 쉬익 소리
    const wsrc = c.createBufferSource(); wsrc.buffer = this.noise(); wsrc.loop = true; wsrc.playbackRate.value = 1.7;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.6;
    const wg = c.createGain(); wg.gain.value = 0.05;
    const wl = c.createOscillator(); wl.frequency.value = 0.08; const wlg = c.createGain(); wlg.gain.value = 0.035; wl.connect(wlg); wlg.connect(wg.gain);
    const bl = c.createOscillator(); bl.frequency.value = 0.05; const blg = c.createGain(); blg.gain.value = 350; bl.connect(blg); blg.connect(bp.frequency);
    wsrc.connect(bp); bp.connect(wg); wg.connect(this.master); wsrc.start(); wl.start(); bl.start();
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

  // ── 밝은 캐럴 (모두 퍼블릭 도메인) ──
  //  1) Jingle Bells 후렴 (J. L. Pierpont, 1857)  2) We Wish You a Merry Christmas (영국 전래)
  // [음이름, 8분음표 개수], 반주는 마디(8분음표 8개 또는 6개)마다 근음 + 화음
  static SONGS = [
    { name: 'Jingle Bells', eighth: 0.17, bar: 8, bells: true,
      notes: [['E5',2],['E5',2],['E5',4],['E5',2],['E5',2],['E5',4],['E5',2],['G5',2],['C5',3],['D5',1],['E5',8],
              ['F5',2],['F5',2],['F5',3],['F5',1],['F5',2],['E5',2],['E5',2],['E5',1],['E5',1],['E5',2],['D5',2],['D5',2],['E5',2],['D5',4],['G5',4],
              ['E5',2],['E5',2],['E5',4],['E5',2],['E5',2],['E5',4],['E5',2],['G5',2],['C5',3],['D5',1],['E5',8],
              ['F5',2],['F5',2],['F5',2],['F5',2],['F5',2],['E5',2],['E5',2],['E5',1],['E5',1],['G5',2],['G5',2],['F5',2],['D5',2],['C5',8]],
      chords: ['C','C','C','C','F','C','D','G','C','C','C','C','F','C','G','C'] },
    { name: 'We Wish You a Merry Christmas', eighth: 0.2, bar: 6, pickup: 2, bells: false,
      notes: [['G4',2],['C5',2],['C5',1],['D5',1],['C5',1],['B4',1],['A4',2],['A4',2],['A4',2],['D5',2],['D5',1],['E5',1],['D5',1],['C5',1],
              ['B4',2],['G4',2],['G4',2],['E5',2],['E5',1],['F5',1],['E5',1],['D5',1],['C5',2],['A4',2],['G4',1],['G4',1],['A4',2],['D5',2],['B4',2],['C5',6]],
      chords: ['C','F','D','G','E','Am','G','C'] },
  ];
  static CHORD = { C: ['C3', 'E4', 'G4'], F: ['F3', 'A4', 'C5'], G: ['G3', 'B4', 'D5'], D: ['D3', 'F#4', 'A4'], E: ['E3', 'G#4', 'B4'], Am: ['A2', 'C4', 'E4'] };
  static freq(n) {
    const map = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
    const sharp = n[1] === '#' ? 1 : 0; const oct = Number(n.slice(1 + sharp));
    return 440 * 2 ** ((map[n[0]] + sharp + (oct - 4) * 12) / 12);
  }
  // 맑은 글로켄슈필/첼레스타 느낌: 짧게 반짝이고 금방 사라지는 소리
  bellNote(freq, when, dur, vol = 1) {
    const c = this.ctx; const t = c.currentTime + when;
    [[1, 0.42, 0.9], [2.0, 0.14, 0.35], [3.0, 0.06, 0.18], [4.2, 0.03, 0.1]].forEach(([m, a, d]) => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = freq * m;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a * vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(d, dur + 0.4));
      o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + d + 0.05);
    });
  }
  // 부드러운 반주(따뜻한 삼각파 화음)
  padChord(names, when, dur) {
    const c = this.ctx; const t = c.currentTime + when;
    names.forEach((n, i) => {
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = SoundEngine.freq(n);
      const g = c.createGain(); const v = i === 0 ? 0.16 : 0.05;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.95);
      o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + dur);
    });
  }
  // 썰매 방울: 짧은 고음 노이즈
  sleighBell(when) {
    const c = this.ctx; const t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.white();
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6500;
    const g = c.createGain(); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    s.connect(hp); hp.connect(g); g.connect(this.musicGain); s.start(t, Math.random() * 0.5); s.stop(t + 0.1);
  }
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    if (!this.musicGain) {
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.2;
      const d = this.ctx.createDelay(1); d.delayTime.value = 0.12; const fb = this.ctx.createGain(); fb.gain.value = 0.12; // 아주 가벼운 울림만
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4000;
      this.musicGain.connect(this.master); this.musicGain.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(this.master);
    }
    this.musicGain.gain.setTargetAtTime(0.2, this.ctx.currentTime, 0.3);
    let songIdx = 0;
    const play = () => {
      if (!this.musicOn) return;
      const song = SoundEngine.SONGS[songIdx++ % SoundEngine.SONGS.length]; const e = song.eighth;
      let t = 0.15;
      for (const [n, len] of song.notes) { this.bellNote(SoundEngine.freq(n), t, len * e); t += len * e; }
      const start = 0.15 + (song.pickup || 0) * e;
      song.chords.forEach((ch, i) => {
        const bt = start + i * song.bar * e;
        this.padChord(SoundEngine.CHORD[ch], bt, song.bar * e);
        if (song.bells) for (let k = 0; k < song.bar; k += 2) this.sleighBell(bt + k * e);
      });
      this.musicTimer = setTimeout(play, (t + 3) * 1000); // 곡 사이 3초 쉬고 다음 곡
    };
    play();
  }
  stopMusic() {
    this.musicOn = false; clearTimeout(this.musicTimer);
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.4);
  }
}

export const sound = new SoundEngine();
