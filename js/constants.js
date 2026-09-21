// 게임 전역 상수. levels.js / game.js / audio.js가 공유한다.
const GAME_CONST = {
  CANVAS_W: 900,
  CANVAS_H: 560,

  TILE: 40,            // 타일 한 칸 크기(px)
  BALL_RADIUS: 12,

  GRAVITY: 0.55,
  BOUNCE_VY: -10,          // 착지 시 항상 이 힘으로 튀어오름 (기존 -13 대비 낮고 경쾌하게 조정)
  POWER_BOUNCE_MULT: 1.6,  // ↑ 입력 중 착지하면 더 높이 튐 (수동 파워바운스)
  FAST_FALL_MULT: 2.4,     // ↓ 입력 중 낙하 가속

  MOVE_ACCEL: 0.7,
  MAX_VX: 6,
  AIR_DRAG: 0.985,
  OVER_SPEED_DECAY: 0.25,  // 부스터로 MAX_VX를 초과한 속도가 서서히 정상 속도로 줄어드는 비율

  ARROW_SIDE_VX: 10,       // 좌/우 부스터 타일이 부여하는 수평 속도
  ARROW_UP_VY: -15.5,      // 상승 부스터 타일이 부여하는 수직 속도
  ARROW_DOWN_VY: 11,       // 하강 부스터 타일이 부여하는 수직 속도

  // 타일 종류
  CELL_EMPTY: 0,
  CELL_WALL: 1,   // 안전한 벽(바운스)
  CELL_HAZARD: 2, // 닿으면 즉사(전기 펜스)

  TOTAL_LEVELS: 100,
  STORAGE_KEY: "bounceball_progress_v2",
};
