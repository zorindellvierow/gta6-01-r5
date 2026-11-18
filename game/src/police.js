// Crescent Bay — police.js (fresh, round 5)
// Sistem wanted 0–5 (naik saat kejahatan, decay kalau lama tidak berbuat
// kejahatan) + AI polisi: spawn di tepi, kejar pemain, tangkap -> BUSTED.
// Sirene via audio saat wanted >= 1. Hanya memakai API publik config/world.
import { WANTED, WORLD } from './config.js';
import {
  moveWithCollision,
  circleHitsCollider,
  isInWater,
} from './world.js';

const num = (v, fb) => (typeof v === 'number' && Number.isFinite(v) ? v : fb);

const MAX_LEVEL = num(WANTED?.MAX_LEVEL, 5);
const DECAY_SECONDS = num(WANTED?.DECAY_SECONDS, 25);
const WORLD_W = num(WORLD?.WIDTH, 2400);
const WORLD_H = num(WORLD?.HEIGHT, 1800);

/** Denda BUSTED / WASTED: pemain kehilangan 20% uang. */
export const PENALTY_RATE = 0.2;

export function applyPenalty(money) {
  return Math.max(0, Math.floor(money * (1 - PENALTY_RATE)));
}

/** Info level wanted: { cops, chaseSpeed }. Fallback kalau bentuk LEVELS beda. */
export function levelInfo(level) {
  const lv = (WANTED?.LEVELS && WANTED.LEVELS[level]) || {};
  const cops = typeof lv.cops === 'number'
    ? lv.cops
    : (typeof lv.count === 'number' ? lv.count : Math.min(level + 1, 5));
  const chaseSpeed = typeof lv.chaseSpeed === 'number'
    ? lv.chaseSpeed
    : (typeof lv.speed === 'number' ? lv.speed : 210 + level * 45);
  return { cops, chaseSpeed };
}

export function createWanted() {
  return { level: 0, quietSeconds: 0 };
}

/**
 * Catat kejahatan: wanted naik `amount` (maks MAX_LEVEL), timer decay reset.
 * `hooks.onWantedUp(level)` dipanggil kalau level benar-benar naik.
 */
export function commitCrime(wanted, amount = 1, hooks = {}) {
  if (!wanted) return 0;
  const before = wanted.level;
  wanted.level = Math.min(MAX_LEVEL, wanted.level + amount);
  wanted.quietSeconds = 0;
  if (wanted.level > before && typeof hooks.onWantedUp === 'function') {
    try { hooks.onWantedUp(wanted.level); } catch { /* abaikan */ }
  }
  return wanted.level;
}

/** Decay: tiap DECAY_SECONDS tanpa kejahatan, wanted turun 1 level. */
export function updateWanted(wanted, dt) {
  if (!wanted || wanted.level <= 0) return wanted ? wanted.level : 0;
  wanted.quietSeconds += dt;
  if (wanted.quietSeconds >= DECAY_SECONDS) {
    wanted.level -= 1;
    wanted.quietSeconds = 0;
  }
  return wanted.level;
}

// ---------------------------------------------------------------- police AI

export function createPolice() {
  return []; // [{x,y,angle,speed,health,ramTimer}]
}

function probeFree(city, x, y, r = 14) {
  if (x < 24 || y < 24 || x > WORLD_W - 24 || y > WORLD_H - 24) return false;
  if (isInWater(x, y)) return false;
  return !circleHitsCollider(city, x, y, r);
}

/** Spawn satu polisi di cincin ~650-800px dari pemain (di tepi layar). */
export function spawnPolice(police, city, player) {
  for (let tries = 0; tries < 40; tries++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 620 + Math.random() * 180;
    const x = player.x + Math.cos(angle) * dist;
    const y = player.y + Math.sin(angle) * dist;
    if (!probeFree(city, x, y, 16)) continue;
    if (police.some((p) => Math.hypot(p.x - x, p.y - y) < 120)) continue;
    police.push({
      x, y,
      angle: Math.atan2(player.y - y, player.x - x),
      speed: 0, health: 100, ramTimer: 0,
    });
    return police[police.length - 1];
  }
  // Fallback: tepi dunia, walau agak jauh.
  const x = Math.min(Math.max(player.x + 650, 40), WORLD_W - 40);
  const y = Math.min(Math.max(player.y, 40), WORLD_H - 40);
  police.push({ x, y, angle: 0, speed: 0, health: 100, ramTimer: 0 });
  return police[police.length - 1];
}

/** Samakan jumlah polisi dengan level wanted (level 0 -> tidak ada polisi).
 *  Kalau kebanyakan, buang yang PALING JAUH dari pemain (bukan pop buta). */
export function syncPoliceCount(police, city, player, wantedLevel) {
  const want = wantedLevel > 0 ? levelInfo(wantedLevel).cops : 0;
  while (police.length < want) spawnPolice(police, city, player);
  while (police.length > want) {
    let far = 0;
    let farD = -1;
    for (let i = 0; i < police.length; i++) {
      const d = Math.hypot(police[i].x - player.x, police[i].y - player.y);
      if (d > farD) { farD = d; far = i; }
    }
    police.splice(far, 1);
  }
  return police.length;
}

/**
 * Update semua polisi: kejar target (mobil pemain kalau mengemudi, kalau tidak
 * posisi pejalan kaki), hindari gedung via moveWithCollision.
 * `hooks.onBusted()` saat polisi menyentuh pemain jalan kaki.
 * `hooks.onRam(impact)` saat polisi menabrak mobil pemain (rusak + kurangi HP).
 * Mengembalikan 'busted' kalau tertangkap, selain itu null.
 */
export function updatePolice(police, target, city, dt, opts = {}) {
  if (dt <= 0 || !police.length) return null;
  const { driving = false, hooks = {} } = opts;
  const level = opts.wantedLevel || 1;
  const chaseSpeed = levelInfo(level).chaseSpeed;
  const tx = target.x;
  const ty = target.y;

  for (let i = police.length - 1; i >= 0; i--) {
    const cop = police[i];
    cop.ramTimer = Math.max(0, (cop.ramTimer || 0) - dt);
    const dx = tx - cop.x;
    const dy = ty - cop.y;
    const dist = Math.hypot(dx, dy) || 1;

    // Belok mulus ke arah target.
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cop.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));

    // Kejar; kalau sudah sangat dekat, pelankan supaya tidak menembus target.
    const speedTarget = dist < 60 ? chaseSpeed * 0.55 : chaseSpeed;
    cop.speed += (speedTarget - cop.speed) * Math.min(1, 2.2 * dt);

    const mx = Math.cos(cop.angle) * cop.speed * dt;
    const my = Math.sin(cop.angle) * cop.speed * dt;
    const next = moveWithCollision(city, cop.x, cop.y, mx, my, 14);
    if (next.hitX || next.hitY) {
      // Mentok gedung: geser menyamping supaya tidak diam selamanya.
      cop.angle += Math.PI / 2.5;
      cop.speed *= 0.5;
    }
    if (!isInWater(next.x, next.y)) {
      cop.x = next.x;
      cop.y = next.y;
    }

    // Jaga jarak antar polisi supaya tidak menumpuk.
    for (const other of police) {
      if (other === cop) continue;
      const d = Math.hypot(other.x - cop.x, other.y - cop.y);
      if (d > 0.1 && d < 36) {
        const push = (36 - d) / 2;
        const px = (cop.x - other.x) / d;
        const py = (cop.y - other.y) / d;
        cop.x += px * push;
        cop.y += py * push;
      }
    }

    if (!driving) {
      // Jalan kaki + polisi menyentuh -> BUSTED.
      if (dist < 30) {
        if (typeof hooks.onBusted === 'function') hooks.onBusted();
        return 'busted';
      }
    } else if (dist < 42 && cop.ramTimer <= 0) {
      // Tabrak mobil pemain: beri damage + dorong.
      cop.ramTimer = 1.1;
      cop.speed *= 0.35;
      if (typeof hooks.onRam === 'function') {
        hooks.onRam(Math.round(cop.speed + 120), cop);
      }
    }
  }
  return null;
}

/** Tembak polisi: kurangi health; kalau habis, polisi hilang. Return true jika mati. */
export function damagePolice(police, cop, amount) {
  if (!cop) return false;
  cop.health -= amount;
  if (cop.health <= 0) {
    const idx = police.indexOf(cop);
    if (idx !== -1) police.splice(idx, 1);
    return true;
  }
  return false;
}

/** Polisi terdekat dari titik (x,y) dalam radius, atau null. */
export function nearestPolice(police, x, y, maxDist = Infinity) {
  let best = null;
  let bestD = maxDist;
  for (const cop of police) {
    const d = Math.hypot(cop.x - x, cop.y - y);
    if (d < bestD) { bestD = d; best = cop; }
  }
  return best ? { cop: best, dist: bestD } : null;
}

/** Nyalakan/matikan sirene sesuai wanted. `audio` boleh null (aman). */
export function updateSiren(wantedLevel, audio, sirenOn) {
  if (!audio) return !!sirenOn;
  try {
    if (wantedLevel >= 1 && !sirenOn && typeof audio.startSiren === 'function') {
      audio.startSiren();
      return true;
    }
    if (wantedLevel <= 0 && sirenOn && typeof audio.stopSiren === 'function') {
      audio.stopSiren();
      return false;
    }
  } catch { /* audio gagal: game tetap jalan */ }
  return !!sirenOn;
}
