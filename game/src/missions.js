// Crescent Bay — missions.js (fresh, round 5)
// 4 misi cerita berurutan dari Selin + 2 aktivitas sampingan repeatable:
// taksi (antar penumpang) dan cash drop (ambil pickup uang di dunia).
// Hanya memakai API publik config.js / world.js — tidak ada kode lama.
import { MISSIONS, ECONOMY, WORLD } from './config.js';
import {
  moveWithCollision,
  circleHitsCollider,
  isInWater,
} from './world.js';

const num = (v, fb) => (typeof v === 'number' && Number.isFinite(v) ? v : fb);

const TIME_LIMIT = num(MISSIONS?.TIME_LIMIT_SECONDS, 240);
const CONTACT = MISSIONS?.CONTACT_NAME || 'Selin';
const PROTAGONIST = MISSIONS?.PROTAGONIST_NAME || 'Rook';
const FALLBACK_REWARDS = [250, 600, 1200, 2200];
const WORLD_W = num(WORLD?.WIDTH, 2400);
const WORLD_H = num(WORLD?.HEIGHT, 1800);

/** Hadiah misi ke-`index` (0-based) dari MISSIONS.REWARDS. */
export function missionReward(index) {
  const list = Array.isArray(MISSIONS?.REWARDS) ? MISSIONS.REWARDS : FALLBACK_REWARDS;
  return num(list[index], FALLBACK_REWARDS[index] ?? 250);
}

export const MISSION_DEFS = [
  {
    id: 'm1', title: 'Paket Marina',
    brief: 'Antar paket Selin ke dermaga Marina sebelum waktu habis.',
    targetKind: 'point', targetKey: 'marina', rewardIndex: 0,
  },
  {
    id: 'm2', title: 'Jemput di Beachfront',
    brief: 'Jemput orang kepercayaan Selin di Beachfront.',
    targetKind: 'point', targetKey: 'beach', rewardIndex: 1,
  },
  {
    id: 'm3', title: 'Kejar Target Downtown',
    brief: 'Kejar mobil target di Downtown dan pepet dia sampai berhenti.',
    targetKind: 'moving', targetKey: 'downtown', rewardIndex: 2,
  },
  {
    id: 'm4', title: 'Kabur ke Hills',
    brief: 'Polisi mengincarmu. Kabur ke Hills dan hilangkan jejak.',
    targetKind: 'point', targetKey: 'hills', rewardIndex: 3,
    wantedOnStart: 2,
  },
];

export function createMissionState() {
  return {
    index: 0, // misi aktif berikutnya
    status: 'idle', // idle | active | done | failed | allDone
    timeLeft: 0,
    target: null, // {x,y} untuk misi point
    targetCar: null, // {x,y,angle,speed,color} untuk misi moving
    done: [], // id misi yang sudah selesai
    failedCount: 0,
  };
}

function spawnPoint(city, key) {
  const s = city.spawns && city.spawns[key];
  if (s && typeof s.x === 'number') return { x: s.x, y: s.y };
  return null;
}

/** Cari titik bebas di dalam kotak (dipakai untuk target moving). */
function freePointIn(city, x0, y0, x1, y1, tries = 60) {
  for (let i = 0; i < tries; i++) {
    const x = x0 + Math.random() * (x1 - x0);
    const y = y0 + Math.random() * (y1 - y0);
    if (isInWater(x, y)) continue;
    if (circleHitsCollider(city, x, y, 18)) continue;
    return { x, y };
  }
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

/**
 * Mulai misi ke-`index` (default: state.index). Mengembalikan def misi.
 * Target diambil dari city.spawns (marina/beach/hills); misi moving menaruh
 * mobil target di sekitar tengah Downtown.
 */
export function startMission(state, city, index = state.index) {
  const def = MISSION_DEFS[index];
  if (!def) {
    state.status = 'allDone';
    return null;
  }
  state.index = index;
  state.status = 'active';
  state.timeLeft = TIME_LIMIT;
  state.target = null;
  state.targetCar = null;
  if (def.targetKind === 'moving') {
    // Downtown = kuarter tengah kota.
    const p = freePointIn(city, WORLD_W * 0.3, WORLD_H * 0.3, WORLD_W * 0.7, WORLD_H * 0.7);
    state.targetCar = {
      x: p.x, y: p.y, angle: 0, speed: 0,
      color: '#c94f43', isPlayer: false, parked: false, target: true,
    };
  } else {
    state.target = spawnPoint(city, def.targetKey)
      || { x: WORLD_W / 2, y: WORLD_H / 2 };
  }
  return def;
}

/** Posisi marker misi aktif (target point / mobil target), atau null. */
export function missionMarker(state) {
  if (state.status !== 'active') return null;
  if (state.targetCar) return { x: state.targetCar.x, y: state.targetCar.y };
  return state.target;
}

export function currentMissionDef(state) {
  return MISSION_DEFS[state.index] || null;
}

/** Teks objektif untuk HUD. */
export function missionObjectiveText(state) {
  const def = currentMissionDef(state);
  if (state.status === 'allDone') return 'Semua misi selesai — Crescent Bay milikmu, Rook.';
  if (state.status === 'failed' && def) return `Misi gagal: ${def.title}. Tekan E di dekat Selin untuk mengulang.`;
  if (state.status === 'idle') return 'Temui Selin (E) untuk misi berikutnya.';
  if (!def) return '';
  const t = Math.max(0, Math.ceil(state.timeLeft));
  const mm = Math.floor(t / 60);
  const ss = String(t % 60).padStart(2, '0');
  return `Misi ${state.index + 1}/4 — ${def.title}: ${def.brief} (${mm}:${ss})`;
}

/**
 * Update misi aktif tiap frame. `pos` = posisi pemain {x,y}.
 * Mengembalikan event: null | 'completed' | 'failed'.
 * Misi moving: mobil target kabur dari pemain dengan kecepatan sedang.
 */
export function updateMission(state, city, pos, dt) {
  if (state.status !== 'active' || dt <= 0) return null;
  const def = currentMissionDef(state);
  if (!def) return null;

  state.timeLeft -= dt;
  if (state.timeLeft <= 0) {
    state.status = 'failed';
    state.failedCount += 1;
    return 'failed';
  }

  if (def.targetKind === 'moving' && state.targetCar) {
    const car = state.targetCar;
    const dx = car.x - pos.x;
    const dy = car.y - pos.y;
    const dist = Math.hypot(dx, dy) || 1;
    // Kabur menjauhi pemain, tapi jangan terlalu cepat (bisa dikejar mobil).
    const fleeAngle = Math.atan2(dy, dx);
    let diff = fleeAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const cruise = dist < 500 ? 235 : 150;
    car.speed += (cruise - car.speed) * Math.min(1, 1.5 * dt);
    const next = moveWithCollision(
      city, car.x, car.y,
      Math.cos(car.angle) * car.speed * dt,
      Math.sin(car.angle) * car.speed * dt,
      14,
    );
    if (next.hitX || next.hitY) {
      car.angle += Math.PI / 2;
      car.speed *= 0.5;
    } else if (!isInWater(next.x, next.y)) {
      car.x = next.x;
      car.y = next.y;
    }
    if (dist < 46) {
      state.status = 'done';
      state.done.push(def.id);
      state.targetCar = null;
      return 'completed';
    }
    return null;
  }

  if (state.target) {
    const dist = Math.hypot(state.target.x - pos.x, state.target.y - pos.y);
    if (dist < 48) {
      state.status = 'done';
      state.done.push(def.id);
      return 'completed';
    }
  }
  return null;
}

/** Lanjut ke misi berikutnya setelah selesai; return def baru / null kalau habis. */
export function advanceMission(state, city) {
  const next = state.index + 1;
  if (next >= MISSION_DEFS.length) {
    state.status = 'allDone';
    state.index = next;
    return null;
  }
  return startMission(state, city, next);
}

/** Ulang misi yang gagal (index sama). */
export function retryMission(state, city) {
  return startMission(state, city, state.index);
}

// ---------------------------------------------------------------- side: taksi

export function createTaxi() {
  return {
    active: false, phase: 'idle', // idle | pickup | dropoff
    pickup: null, dropoff: null, fare: 0,
  };
}

function randomSpawnPoint(city) {
  const keys = ['marina', 'beach', 'hills', 'selin', 'player'];
  const pool = keys
    .map((k) => city.spawns && city.spawns[k])
    .filter((s) => s && typeof s.x === 'number');
  if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
  return { x: WORLD_W / 2, y: WORLD_H / 2 };
}

/** Mulai order taksi: jemput penumpang, lalu antar ke tujuan. Return fare. */
export function startTaxi(taxi, city, playerPos) {
  const pickup = randomSpawnPoint(city);
  let dropoff = randomSpawnPoint(city);
  let guard = 0;
  while (Math.hypot(dropoff.x - pickup.x, dropoff.y - pickup.y) < 400 && guard++ < 20) {
    dropoff = randomSpawnPoint(city);
  }
  const dist = Math.hypot(dropoff.x - pickup.x, dropoff.y - pickup.y);
  taxi.active = true;
  taxi.phase = 'pickup';
  taxi.pickup = { x: pickup.x, y: pickup.y };
  taxi.dropoff = { x: dropoff.x, y: dropoff.y };
  taxi.fare = 60 + Math.round(dist / 10);
  return taxi.fare;
}

/** Marker taksi aktif (titik jemput / antar), atau null. */
export function taxiMarker(taxi) {
  if (!taxi.active) return null;
  return taxi.phase === 'pickup' ? taxi.pickup : taxi.dropoff;
}

/**
 * Update taksi. Return event: null | 'pickedUp' | 'completed' | 'cancelled'.
 * `pos` = posisi pemain; batal otomatis kalau pemain jalan kaki menjauh
 * (tidak — taksi tetap jalan; batal hanya via cancelTaxi).
 */
export function updateTaxi(taxi, pos) {
  if (!taxi.active) return null;
  const target = taxi.phase === 'pickup' ? taxi.pickup : taxi.dropoff;
  if (!target) return null;
  const dist = Math.hypot(target.x - pos.x, target.y - pos.y);
  if (dist < 52) {
    if (taxi.phase === 'pickup') {
      taxi.phase = 'dropoff';
      return 'pickedUp';
    }
    const fare = taxi.fare;
    taxi.active = false;
    taxi.phase = 'idle';
    taxi.pickup = null;
    taxi.dropoff = null;
    return 'completed';
  }
  return null;
}

export function cancelTaxi(taxi) {
  taxi.active = false;
  taxi.phase = 'idle';
  taxi.pickup = null;
  taxi.dropoff = null;
}

// ---------------------------------------------------------------- side: cash drop

/**
 * Ambil pickup uang di dekat (x,y). Menandai pickup.taken dan mengembalikan
 * jumlah uang (0 kalau tidak ada). Pakai city.pickups dari world.js.
 */
export function collectCashPickup(city, x, y, radius = 36) {
  const pickups = city.pickups || [];
  for (const p of pickups) {
    if (p.taken) continue;
    if (Math.hypot(p.x - x, p.y - y) < radius) {
      p.taken = true;
      const min = num(ECONOMY?.PICKUP_CASH_MIN, num(ECONOMY?.PICKUP_CASH, 25));
      return typeof p.amount === 'number' ? p.amount : min;
    }
  }
  return 0;
}

export { CONTACT, PROTAGONIST };
