/**
 * 배경음악 + 효과음
 *
 * 핵심 수정 사항:
 *  - AudioContext.resume()이 비동기 → await 처리 후 음표 스케줄링
 *  - 모든 음을 261~523 Hz 대역으로 고정 (노트북 스피커에서 확실히 들림)
 *  - setTimeout 기반 시퀀서 사용 (Web Audio 절대시간 스케줄링 불필요)
 *
 * 음악: D단조 테마, BPM 68
 *   Dm → Bb → F → C, 4마디 루프 ≈ 14.1초
 *   멜로디(삼각파) + 코드 패드(사인파) 2레이어
 */

class AudioManager {
  constructor() {
    this.actx   = null;
    this.master = null;
    this._running  = false;
    this._seqIdx   = 0;
    this._seqTimer = null;
  }

  // 사용자 클릭 후 반드시 호출 — resume() 완료 보장
  async _boot() {
    if (this.actx) {
      if (this.actx.state === "suspended") await this.actx.resume();
      return;
    }
    this.actx   = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.actx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.actx.destination);
    if (this.actx.state === "suspended") await this.actx.resume();
  }

  async startMusic() {
    await this._boot();
    if (this._running) return;
    this._running = true;
    this._seqIdx  = 0;
    this._tick();
  }

  stopMusic() {
    this._running = false;
    clearTimeout(this._seqTimer);
  }

  /*
   * D단조 4마디 멜로디 시퀀스 (12 노트)
   * [주파수, 지속_ms]   BPM 68 → 4분음표 = 882ms, 2분음표 = 1764ms
   *
   * 마디1 (Dm) : D4(half) A4(q) G4(q)   → 1764 882 882
   * 마디2 (Bb) : Bb4(q) A4(q) G4(half)  → 882 882 1764
   * 마디3 (F)  : A4(half) C5(q) A4(q)   → 1764 882 882
   * 마디4 (C)  : G4(q) F4(q) E4(half)   → 882 882 1764
   */
  _tick() {
    if (!this._running) return;

    const SEQ = [
      [293.66, 1764],  // D4  Dm bar start
      [440.00,  882],  // A4
      [392.00,  882],  // G4
      [466.16,  882],  // Bb4 Bb bar start
      [440.00,  882],  // A4
      [392.00, 1764],  // G4
      [440.00, 1764],  // A4  F bar start
      [523.25,  882],  // C5
      [440.00,  882],  // A4
      [392.00,  882],  // G4  C bar start
      [349.23,  882],  // F4
      [329.63, 1764],  // E4  (긴장 → 다시 D4로 해결)
    ];

    // 마디 시작(3노트마다)마다 코드 패드 기동
    // 코드 보이싱: 모두 261~466 Hz (노트북 스피커 가청 대역)
    const CHORDS = [
      [293.66, 349.23, 440.00],  // Dm: D4 F4 A4
      [293.66, 349.23, 466.16],  // Bb: D4 F4 Bb4
      [261.63, 349.23, 440.00],  // F:  C4 F4 A4
      [261.63, 329.63, 392.00],  // C:  C4 E4 G4
    ];

    const [freq, durMs] = SEQ[this._seqIdx];
    const t    = this.actx.currentTime;
    const durS = durMs / 1000;
    const BAR_DUR_S = (882 * 4) / 1000; // 3.528s

    // 마디 시작 → 코드 패드
    if (this._seqIdx % 3 === 0) {
      const bar = Math.floor(this._seqIdx / 3) % 4;
      for (const cf of CHORDS[bar]) {
        this._pad(cf, t, BAR_DUR_S);
      }
    }

    // 멜로디 노트 (삼각파 — 맑고 밝은 음색)
    this._note(freq, t, durS * 0.82, 0.30, "triangle");

    this._seqIdx = (this._seqIdx + 1) % SEQ.length;
    this._seqTimer = setTimeout(() => this._tick(), durMs);
  }

  // 짧은 단발 노트
  _note(freq, t, dur, vol, type = "sine") {
    const osc = this.actx.createOscillator();
    const g   = this.actx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // 부드러운 코드 패드 (느린 어택/릴리즈)
  _pad(freq, t, dur) {
    const osc = this.actx.createOscillator();
    const g   = this.actx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const atk = Math.min(0.4, dur * 0.2);
    const rel = Math.min(0.3, dur * 0.15);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.07, t + atk);
    g.gain.setValueAtTime(0.07, t + dur - rel);
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // 바운스 효과음
  playBounce(power = false) {
    if (!this.actx || this.actx.state !== "running") return;
    const t = this.actx.currentTime;
    const s = power ? 620 : 480;
    const e = power ? 260 : 200;
    const v = power ? 0.45 : 0.32;

    const osc = this.actx.createOscillator();
    const g   = this.actx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(s, t);
    osc.frequency.exponentialRampToValueAtTime(e, t + 0.13);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(g); g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.20);
  }
}

const audioManager = new AudioManager();
