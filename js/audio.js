// 최소한의 효과음 엔진 (Web Audio API, 외부 파일 없이 합성).
// 배경음은 사용하지 않고, 바운스(착지) 사운드와 사망 사운드만 재생한다.

const SFX = (function () {
  let ctx = null;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function unlock() {
    ensureCtx();
  }

  function playBounce() {
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime;

    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(90, t0 + 0.09);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);

    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.12);
  }

  function playDeath() {
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime;

    // 하강하는 버저 톤
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(420, t0);
    osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.32);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);

    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.4);

    // 짧은 노이즈 버즈(전기 충격 느낌)
    const bufSize = Math.floor(c.sampleRate * 0.15);
    const buffer = c.createBuffer(1, bufSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    }
    const noise = c.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = c.createGain();
    noiseGain.gain.setValueAtTime(0.12, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
    noise.connect(noiseGain).connect(c.destination);
    noise.start(t0);
  }

  return { unlock, playBounce, playDeath };
})();
