// Web Audio API 배경음악 + 효과음
// 외부 파일 없이 오실레이터로 생성. 모든 음을 200~650Hz 대역에 배치해 어느 스피커에서도 들린다.

class AudioManager {
  constructor() {
    this.actx   = null;
    this.master = null;
    this._musicRunning = false;
    this._loopTimer    = null;
  }

  _init() {
    if (this.actx) return;
    this.actx   = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.actx.createGain();
    this.master.gain.value = 0.45;
    this.master.connect(this.actx.destination);
  }

  resume() {
    if (this.actx && this.actx.state === "suspended") this.actx.resume();
  }

  // ─── 배경음악 ───────────────────────────────────────────────
  startMusic() {
    this._init();
    this.resume();
    if (this._musicRunning) return;
    this._musicRunning = true;
    this._scheduleLoop(this.actx.currentTime + 0.08);
  }

  stopMusic() {
    this._musicRunning = false;
    clearTimeout(this._loopTimer);
  }

  /*
   * D 단조 (D minor) 잔잔한 테마
   * BPM 68 · 4마디 루프 ≈ 14.1초
   *
   * 코드: Dm → Bb → F → C
   * 멜로디 음역: D4(294) ~ C5(523) — 노트북 스피커에서도 선명하게 들리는 대역
   *
   * 마디별 흐름
   *   Bar1 Dm : D4 _ A4  G4   ← 뿌리음에서 5도로 도약
   *   Bar2 Bb : Bb4  A4  G4 _ ← 정점 Bb4에서 내려옴
   *   Bar3 F  : A4 _  C5  A4  ← C5로 한 번 치솟고 내려옴
   *   Bar4 C  : G4  F4  E4 _  ← 반음계 하강, 다시 D4로 해결
   */
  _scheduleLoop(t0) {
    if (!this._musicRunning) return;

    const BPM  = 68;
    const B    = 60 / BPM;       // 1비트 ≈ 0.882s
    const BAR  = B * 4;          // 1마디 ≈ 3.529s
    const LOOP = BAR * 4;        // 전체 루프 ≈ 14.12s

    // 코드 보이싱: [베이스, 패드low, 패드high]
    // 모든 음을 3~4옥타브 범위로 올려 가청 대역 확보
    const CHORDS = [
      [146.83, 220.00, 261.63],  // Dm : D3  A3  C4
      [233.08, 174.61, 293.66],  // Bb : Bb3 F3  D4
      [174.61, 261.63, 329.63],  // F  : F3  C4  E4
      [130.81, 196.00, 246.94],  // C  : C3  G3  B3
    ];

    // 멜로디: [비트오프셋, Hz, 길이(비트), 볼륨]
    const MEL = [
      [0,    293.66, 1.8, 0.20],  // D4  (Dm 루트)
      [2,    440.00, 0.9, 0.17],  // A4
      [3,    392.00, 0.9, 0.15],  // G4
      [4,    466.16, 0.9, 0.20],  // Bb4 (Bb 루트 — 가장 높은 포인트)
      [5,    440.00, 0.9, 0.17],  // A4
      [6,    392.00, 1.8, 0.17],  // G4  (지속)
      [8,    440.00, 1.8, 0.19],  // A4  (F코드)
      [10,   523.25, 0.8, 0.17],  // C5  (클라이맥스)
      [11,   440.00, 0.9, 0.15],  // A4
      [12,   392.00, 0.9, 0.17],  // G4  (C코드)
      [13,   349.23, 0.9, 0.15],  // F4
      [14,   329.63, 1.9, 0.18],  // E4  (긴장 → 다시 D4로 해결)
    ];

    // 코드 패드 + 베이스 스케줄링
    for (let c = 0; c < 4; c++) {
      const ct = t0 + c * BAR;
      const [bass, pLo, pHi] = CHORDS[c];
      this._osc(bass, ct, BAR * 0.90, 0.22, "sine",     0.04, 0.30);
      this._osc(pLo,  ct, BAR * 0.85, 0.10, "sine",     0.18, 0.38);
      this._osc(pHi,  ct, BAR * 0.85, 0.08, "sine",     0.22, 0.38);
    }

    // 멜로디 스케줄링 (삼각파 → 맑은 피리 느낌)
    for (const [beat, freq, dur, vol] of MEL) {
      this._osc(freq, t0 + beat * B, dur * B, vol, "triangle", 0.008, 0.14);
    }

    this._loopTimer = setTimeout(
      () => this._scheduleLoop(t0 + LOOP),
      (LOOP - 0.3) * 1000
    );
  }

  // 오실레이터 헬퍼 — 선형 어택 + 지수 릴리즈
  _osc(freq, start, dur, vol, type = "sine", atk = 0.02, rel = 0.10) {
    const a   = this.actx;
    const osc = a.createOscillator();
    const g   = a.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + atk);
    g.gain.setTargetAtTime(0, start + Math.max(atk + 0.01, dur - rel), rel / 3);
    osc.connect(g);
    g.connect(this.master);
    osc.start(start);
    osc.stop(start + dur + rel + 0.1);
  }

  // ─── 바운스 효과음 ───────────────────────────────────────────
  playBounce(power = false) {
    if (!this.actx) return;
    this.resume();
    const t      = this.actx.currentTime;
    const startF = power ? 620 : 480;
    const endF   = power ? 260 : 200;
    const vol    = power ? 0.38 : 0.28;
    const dur    = 0.13;

    const layer = (fm, vm) => {
      const osc = this.actx.createOscillator();
      const g   = this.actx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(startF * fm, t);
      osc.frequency.exponentialRampToValueAtTime(endF * fm, t + dur);
      g.gain.setValueAtTime(vol * vm, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.03);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.07);
    };

    layer(1,    1.00);  // 기본음
    layer(2,    0.22);  // 2배음 — 탄성감
    layer(0.5,  0.15);  // 저음 타격감
  }
}

const audioManager = new AudioManager();
