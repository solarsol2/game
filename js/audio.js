// Web Audio API 기반 사운드 매니저
// 외부 파일 없이 오실레이터로 배경음악·효과음을 생성한다.

class AudioManager {
  constructor() {
    this.actx   = null;
    this.master = null;
    this._musicRunning = false;
    this._loopTimer    = null;
  }

  // 첫 번째 사용자 인터랙션 후 호출
  _init() {
    if (this.actx) return;
    this.actx = new (window.AudioContext || window.webkitAudioContext)();

    this.master = this.actx.createGain();
    this.master.gain.value = 0.28;
    this.master.connect(this.actx.destination);
  }

  resume() {
    if (this.actx && this.actx.state === "suspended") this.actx.resume();
  }

  // ─── 배경음악 ───────────────────────────────────────────
  startMusic() {
    this._init();
    this.resume();
    if (this._musicRunning) return;
    this._musicRunning = true;
    this._scheduleLoop(this.actx.currentTime + 0.15);
  }

  stopMusic() {
    this._musicRunning = false;
    clearTimeout(this._loopTimer);
  }

  _scheduleLoop(t0) {
    if (!this._musicRunning) return;

    const BPM  = 72;
    const B    = 60 / BPM;   // 1 비트 = 0.833s
    const BAR  = B * 4;      // 1 마디
    const LOOP = BAR * 4;    // 4마디 루프 ≈ 13.3s

    // Am - F - C - G 코드 보이싱 [베이스, 5도, 3도]
    const CHORDS = [
      [110,    165,    130.81],  // Am: A2 E3 C3
      [87.31,  130.81, 110],    // F:  F2 C3 A2
      [130.81, 196,    164.81], // C:  C3 G3 E3
      [98,     146.83, 123.47], // G:  G2 D3 B2
    ];

    // 멜로디 [비트 오프셋, 주파수, 지속(비트), 볼륨]
    const MEL = [
      [0,    440,    1.8, 0.13],  // A4  (Am)
      [2,    392,    1.5, 0.10],  // G4
      [4,    349.23, 1.8, 0.13],  // F4  (F)
      [6,    392,    1.5, 0.10],  // G4
      [8,    329.63, 1.8, 0.13],  // E4  (C)
      [9.5,  261.63, 1.4, 0.09],  // C4
      [11,   329.63, 1.5, 0.10],  // E4
      [12,   392,    1.8, 0.13],  // G4  (G)
      [13.5, 293.66, 1.5, 0.10],  // D4
      [15,   246.94, 2.5, 0.11],  // B3  (resolve)
    ];

    // 코드 패드 + 베이스
    for (let c = 0; c < 4; c++) {
      const ct = t0 + c * BAR;
      const ch = CHORDS[c];
      this._osc(ch[0], ct, BAR * 0.92, 0.19, "sine",     0.04, 0.35); // 베이스
      this._osc(ch[1], ct, BAR * 0.88, 0.07, "sine",     0.20, 0.40); // 패드 5도
      this._osc(ch[2], ct, BAR * 0.88, 0.06, "sine",     0.24, 0.40); // 패드 3도
    }

    // 멜로디
    for (const [beat, freq, dur, vol] of MEL) {
      this._osc(freq, t0 + beat * B, dur * B, vol, "sine", 0.01, 0.18);
    }

    this._loopTimer = setTimeout(
      () => this._scheduleLoop(t0 + LOOP),
      (LOOP - 0.35) * 1000
    );
  }

  // 공통 오실레이터 헬퍼 (선형 어택 + 지수 릴리즈)
  _osc(freq, start, dur, vol, type = "sine", atk = 0.02, rel = 0.08) {
    const a   = this.actx;
    const osc = a.createOscillator();
    const g   = a.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + atk);
    g.gain.setTargetAtTime(0, start + Math.max(atk, dur - rel), rel / 3);
    osc.connect(g);
    g.connect(this.master);
    osc.start(start);
    osc.stop(start + dur + rel + 0.05);
  }

  // ─── 바운스 효과음 ────────────────────────────────────────
  // power=true 이면 파워 바운스 (높은 피치)
  playBounce(power = false) {
    if (!this.actx) return;
    this.resume();

    const t      = this.actx.currentTime;
    const startF = power ? 600 : 460;
    const endF   = power ? 250 : 185;
    const vol    = power ? 0.32 : 0.22;
    const dur    = 0.14;

    const playLayer = (freqMult, volMult) => {
      const osc = this.actx.createOscillator();
      const g   = this.actx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(startF * freqMult, t);
      osc.frequency.exponentialRampToValueAtTime(endF * freqMult, t + dur);
      g.gain.setValueAtTime(vol * volMult, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.03);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.06);
    };

    playLayer(1,   1.0);  // 기본 톤
    playLayer(2,   0.25); // 2배음 (탄성감 추가)
  }
}

const audioManager = new AudioManager();
