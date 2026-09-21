// 게임 전역 상수. game.js / levels.js가 공유한다.
const GAME_CONST = {
  CANVAS_W: 900,
  CANVAS_H: 500,
  GROUND_Y: 400,          // 기본 바닥 높이(y좌표)
  BALL_RADIUS: 15,

  GRAVITY: 0.45,
  BOUNCE_VY: -13,         // 착지 시 항상 이 힘으로 튀어오름(퍼펙트 바운스)
  POWER_BOUNCE_MULT: 1.32,// ↑ 입력 중 착지하면 더 높이 튐
  FAST_FALL_MULT: 2.3,    // ↓ 입력 중 낙하 가속

  MOVE_ACCEL: 0.7,
  MAX_VX: 6,
  AIR_DRAG: 0.985,

  TOTAL_LEVELS: 10,
  STORAGE_KEY: "bounceball_progress_v3",
};
