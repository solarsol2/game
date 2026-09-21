// 레벨 절차적 생성기. 레벨 번호를 시드로 사용해 항상 같은 스테이지를 생성한다.
// 총 10단계(GAME_CONST.TOTAL_LEVELS)로, 단계가 올라갈수록
// 바닥 구덩이 → 가시 → 공중 발판 순으로 요소가 늘어난다.

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateLevel(levelNumber) {
  const C = GAME_CONST;
  const rand = mulberry32(levelNumber * 7919 + 13);
  const difficulty = Math.min(1, (levelNumber - 1) / (C.TOTAL_LEVELS - 1)); // 0~1

  const groundSegments = [];
  const platforms = [];
  const spikes = [];
  const movingSpikes = [];

  const START_X = 120;
  const SAFE_START_LEN = 260;

  let cursor = START_X;
  groundSegments.push({ x1: 0, x2: START_X + SAFE_START_LEN });
  cursor += SAFE_START_LEN;

  const maxGap = 110 + difficulty * 130;         // 110~240 (더 긴 낭떠러지)
  const spikeChance       = levelNumber <= 2 ? 0 : Math.min(0.55, 0.2  + difficulty * 0.4);
  const movingSpikeChance = levelNumber <= 3 ? 0 : Math.min(0.35, 0.05 + difficulty * 0.35);
  const detourChance      = levelNumber <= 3 ? 0 : Math.min(0.35, 0.1  + difficulty * 0.35);
  const stepChance        = levelNumber <= 3 ? 0 : Math.min(0.25, 0.05 + difficulty * 0.3);
  const segCount = 6 + Math.floor(levelNumber * 0.8); // 6~13

  for (let i = 0; i < segCount; i++) {
    const roll = rand();

    if (roll < detourChance) {
      // 구덩이 + 중간 공중 발판 (낭떠러지 더 길게)
      const gapLen = 100 + rand() * maxGap;
      const gapStart = cursor;
      cursor += gapLen;

      const platW = Math.max(65, 140 - difficulty * 60);
      const platY = C.GROUND_Y - (65 + rand() * 70);
      const platX1 = gapStart + gapLen / 2 - platW / 2;

      platforms.push({ x1: platX1, x2: platX1 + platW, y: platY });

      const nextLen = 160 + rand() * 120;
      groundSegments.push({ x1: cursor, x2: cursor + nextLen });
      cursor += nextLen;

    } else if (roll < detourChance + stepChance) {
      // 계단식 연속 발판 구간: 넓은 구덩이를 여러 발판으로 밟고 건넘
      const numPlats = 2 + Math.floor(rand() * 2); // 2~3개
      const platW = 60 + rand() * 30;
      const platSpacing = 85 + rand() * 45;
      const totalGap = platSpacing * (numPlats + 1);
      const gapStart = cursor;
      cursor += totalGap;

      for (let p = 0; p < numPlats; p++) {
        const px = gapStart + platSpacing * (p + 1) - platW / 2;
        const py = C.GROUND_Y - (40 + rand() * 40); // 낮게 배치 - 밟기 쉽게
        platforms.push({ x1: px, x2: px + platW, y: py });
      }

      const nextLen = 140 + rand() * 100;
      groundSegments.push({ x1: cursor, x2: cursor + nextLen });
      cursor += nextLen;

    } else if (roll < detourChance + stepChance + 0.22 + difficulty * 0.1) {
      // 단순 구덩이 (길이 증가)
      const gapLen = 90 + rand() * (maxGap + 60);
      cursor += gapLen;
      const nextLen = 150 + rand() * 150;
      groundSegments.push({ x1: cursor, x2: cursor + nextLen });
      cursor += nextLen;

    } else {
      // 평범한 바닥 구간 — 정적 가시 + 이동 가시 배치 가능
      const len = 200 + rand() * 220;
      const seg = { x1: cursor, x2: cursor + len };
      groundSegments.push(seg);

      if (rand() < spikeChance) {
        const spikeCount = 1 + Math.floor(rand() * (1 + Math.floor(difficulty * 2)));
        for (let s = 0; s < spikeCount; s++) {
          const margin = 40;
          const sx = seg.x1 + margin + rand() * Math.max(10, len - margin * 2 - spikeCount * 30);
          spikes.push({ x: sx, w: 22 });
        }
      }

      if (rand() < movingSpikeChance) {
        const margin = 60;
        const bx = seg.x1 + margin + rand() * Math.max(10, len - margin * 2);
        const range = 35 + rand() * 45;
        movingSpikes.push({
          baseX: bx,
          x: bx,
          w: 22,
          range,
          speed: 1.2 + rand() * 1.8,
          phase: rand() * Math.PI * 2,
        });
      }

      cursor += len;
    }
  }

  // 골 구간
  const goalPad = 260;
  groundSegments.push({ x1: cursor, x2: cursor + goalPad });
  const goalX = cursor + goalPad / 2;
  cursor += goalPad;

  const levelWidth = cursor + 100;

  return {
    id: levelNumber,
    width: levelWidth,
    start: { x: START_X, y: C.GROUND_Y - C.BALL_RADIUS },
    groundSegments,
    platforms,
    spikes,
    movingSpikes,
    goal: { x: goalX, y: C.GROUND_Y },
  };
}
