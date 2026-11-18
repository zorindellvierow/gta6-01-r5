// Crescent Bay — all tuning values for the open-world crime game.
// The city is a grid of blocks separated by roads; everything below
// is tuned so on-foot and driving both feel workable.
export const CONFIG = {
  title: 'Crescent Bay',
  worldWidth: 3200,
  worldHeight: 2400,
  blockSize: 320,
  roadWidth: 96,
  playerWalkSpeed: 260,
  playerRunSpeed: 390,
  carAccel: 640,
  carMaxSpeed: 660,
  carReverseSpeed: 270,
  carTurnRate: 2.7,
  npcCarCount: 14,
  pedestrianCount: 22,
  copCarCount: 3,
  maxWanted: 5,
  wantedDecaySeconds: 14,
  playerMaxHealth: 100,
  bulletSpeed: 920,
  bulletDamage: 34,
  punchDamage: 12,
  punchRange: 48,
  punchCooldown: 0.35,
  gunCooldown: 0.22,
  missionReward: [400, 650, 900],
  startingMoney: 50,
  saveKey: 'crescent-bay-save-v1',
  seedDefault: 1,
  step: 1 / 60,
};

// A road exists wherever x or y falls inside a road band of the grid.
export function isRoadAt(x, y) {
  const { blockSize, roadWidth } = CONFIG;
  const half = roadWidth / 2;
  const mx = ((x % blockSize) + blockSize) % blockSize;
  const my = ((y % blockSize) + blockSize) % blockSize;
  return mx < half || mx > blockSize - half || my < half || my > blockSize - half;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export const PALETTE = {
  backdrop: '#0d1117',
  grass: '#233d2a',
  blockA: '#2c3440',
  blockB: '#333d4d',
  blockC: '#3a2f3d',
  road: '#1a1d24',
  roadLine: '#c9a227',
  sidewalk: '#3d4450',
  water: '#1d4e6b',
  park: '#1e4d2b',
  player: '#f2c94c',
  playerCar: '#e5534b',
  npcCar: '#4fc3f7',
  copCar: '#7aa2ff',
  ped: '#e8e8e8',
  text: '#eef1f5',
  muted: '#9aa3b2',
  panel: '#161c26',
  gold: '#f2c94c',
  red: '#e5534b',
  green: '#58c472',
  blue: '#4fc3f7',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
