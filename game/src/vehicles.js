// Crescent Bay — vehicles.js (fresh, round 5)
// Mobil pemain (fisika arcade), traffic AI, dan mobil parkir yang bisa dicuri.
// Hanya memakai API publik world.js / config.js / random.js — tidak ada kode lama.
import { VEHICLE, WORLD } from './config.js';
import {
  moveWithCollision,
  circleHitsCollider,
  isInWater,
} from './world.js';
import { createRng } from './random.js';

const num = (v, fb) => (typeof v === 'number' && Number.isFinite(v) ? v : fb);

const ACCEL = num(VEHICLE?.ACCEL, 420);
const BRAKE = num(VEHICLE?.BRAKE, 700);
const MAX_SPEED = num(VEHICLE?.MAX_SPEED, 620);
const TURN_RATE = num(VEHICLE?.TURN_RATE, 2.4);
const HANDBRAKE_DECEL = num(VEHICLE?.HANDBRAKE_DECEL, 950);
const DRAG = num(VEHICLE?.DRAG, 0.6);
const CAR_LENGTH = num(VEHICLE?.LENGTH, 46);
const CAR_WIDTH = num(VEHICLE?.WIDTH, 22);
const WORLD_W = num(WORLD?.WIDTH, 2400);
const WORLD_H = num(WORLD?.HEIGHT, 1800);

export const TRAFFIC_COUNT = 8;
export const CAR_RADIUS = Math.max(12, Math.round(CAR_WIDTH / 2) + 3); // 14

const TRAFFIC_COLORS = [
  '#c94f43', '#4f7ec9', '#e8b93b', '#7ec94f', '#9aa3b2',
  '#c98ad1', '#e8e8e8', '#3a3f4a', '#d97b2f', '#2fa8a0',
];

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function probeFree(city, x, y, r = CAR_RADIUS) {
  if (x < 24 || y < 24 || x > WORLD_W - 24 || y > WORLD_H - 24) return false;
  if (isInWater(x, y)) return false;
  return !circleHitsCollider(city, x, y, r);
}

// ---------------------------------------------------------------- player car

export function createPlayerCar(x, y, angle = 0, color = '#e8b93b') {
  return {
    x, y, angle, speed: 0,
    color, health: 100,
    isPlayer: true, parked: false,
  };
}

/**
 * Fisika mobil pemain. `input` = GameInput (aksi UP/DOWN/LEFT/RIGHT/HANDBRAKE).
 * `hooks.onCrash(impact)` dipanggil saat menabrak bangunan dengan keras.
 * Mengembalikan { crashed, impact }.
 */
export function updatePlayerCar(car, input, city, dt, hooks = {}) {
  if (dt <= 0) return { crashed: false, impact: 0 };
  // Aksi bernama + fallback kode tombol mentah.
  const isAct = (a) => { try { return input.isActionDown(a); } catch { return false; } };
  const isKey = (c) => { try { return input.isDown(c); } catch { return false; } };
  const fwd = isAct('UP') || isKey('KeyW') || isKey('ArrowUp');
  const back = isAct('DOWN') || isKey('KeyS') || isKey('ArrowDown');
  const steerLeft = isAct('LEFT') || isKey('KeyA') || isKey('ArrowLeft');
  const steerRight = isAct('RIGHT') || isKey('KeyD') || isKey('ArrowRight');
  const handbrake = isAct('HANDBRAKE') || isKey('Space');

  if (fwd) car.speed += ACCEL * dt;
  if (back) {
    if (car.speed > 12) car.speed -= BRAKE * dt;
    else car.speed -= ACCEL * 0.55 * dt; // mundur
  }
  if (handbrake) {
    const dec = HANDBRAKE_DECEL * dt;
    car.speed = car.speed > 0
      ? Math.max(0, car.speed - dec)
      : Math.min(0, car.speed + dec);
  }
  // Drag + batas kecepatan.
  car.speed -= car.speed * DRAG * dt;
  car.speed = clamp(car.speed, -MAX_SPEED * 0.35, MAX_SPEED);

  const steer = (steerRight ? 1 : 0) - (steerLeft ? 1 : 0);
  if (steer !== 0 && Math.abs(car.speed) > 4) {
    const dir = car.speed >= 0 ? 1 : -1;
    const grip = clamp(Math.abs(car.speed) / 130, 0.25, 1);
    const turnBoost = handbrake ? 1.45 : 1;
    car.angle += steer * TURN_RATE * turnBoost * grip * dir * dt;
  }

  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  const speedBefore = car.speed;
  let crashed = false;
  let impact = 0;

  if (dx !== 0 || dy !== 0) {
    const next = moveWithCollision(city, car.x, car.y, dx, dy, CAR_RADIUS);
    // Jangan masuk ke air (teluk): tahan di tepi.
    if (isInWater(next.x, next.y)) {
      car.speed *= 0.4;
    } else {
      const moved = Math.hypot(next.x - car.x, next.y - car.y);
      const wanted = Math.hypot(dx, dy);
      if ((next.hitX || next.hitY) && wanted - moved > 0.5) {
        crashed = true;
        impact = Math.abs(speedBefore);
        car.speed = -car.speed * 0.22; // pantul sedikit
        if (impact > 120 && typeof hooks.onCrash === 'function') {
          hooks.onCrash(impact, car);
        }
      }
      car.x = next.x;
      car.y = next.y;
    }
  }
  car.x = clamp(car.x, 20, WORLD_W - 20);
  car.y = clamp(car.y, 20, WORLD_H - 20);
  return { crashed, impact };
}

// ---------------------------------------------------------------- traffic AI

export function createTrafficCar(x, y, angle, color, cruise) {
  return {
    x, y, angle, speed: 0, cruise,
    color, isPlayer: false, parked: false,
    straightTime: 0, turnTimer: 3 + Math.random() * 5,
  };
}

/** Spawn `count` mobil traffic di titik bebas (bukan di gedung / air). */
export function createTraffic(city, count = TRAFFIC_COUNT, seed = 1) {
  const rng = createRng((seed >>> 0) ^ 0x9e3779b9);
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard++ < 600) {
    const x = rng.float(70, WORLD_W - 70);
    const y = rng.float(70, WORLD_H - 70);
    if (!probeFree(city, x, y, 16)) continue;
    if (cars.some((c) => Math.hypot(c.x - x, c.y - y) < 140)) continue;
    cars.push(createTrafficCar(
      x, y,
      rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]),
      rng.pick(TRAFFIC_COLORS),
      rng.float(95, 155),
    ));
  }
  return cars;
}

/**
 * Traffic jalan lurus mengikuti jalan; kalau ada gedung/air di depan, belok
 * kiri/kanan (atau putar balik). Berhenti kalau ada mobil lain di depan.
 * `obstacles` = [{x,y}] lain yang perlu dihindari (mis. mobil pemain).
 */
export function updateTraffic(cars, city, dt, obstacles = []) {
  if (dt <= 0) return;
  for (const car of cars) {
    car.turnTimer -= dt;
    car.straightTime += dt;

    const dirX = Math.cos(car.angle);
    const dirY = Math.sin(car.angle);
    const aheadX = car.x + dirX * 54;
    const aheadY = car.y + dirY * 54;
    const blockedAhead = !probeFree(city, aheadX, aheadY, CAR_RADIUS);

    // Mobil lain di depan -> berhenti.
    let blockedByCar = false;
    for (const o of obstacles) {
      const d = Math.hypot(o.x - car.x, o.y - car.y);
      if (d < 58 && d > 1) {
        const dot = ((o.x - car.x) * dirX + (o.y - car.y) * dirY) / d;
        if (dot > 0.45) { blockedByCar = true; break; }
      }
    }
    for (const other of cars) {
      if (other === car) continue;
      const d = Math.hypot(other.x - car.x, other.y - car.y);
      if (d < 52 && d > 1) {
        const dot = ((other.x - car.x) * dirX + (other.y - car.y) * dirY) / d;
        if (dot > 0.45) { blockedByCar = true; break; }
      }
    }

    if (blockedByCar) {
      car.speed = Math.max(0, car.speed - 500 * dt);
    } else if (blockedAhead) {
      // Coba belok kiri / kanan, pilih sisi yang bebas.
      const leftX = car.x + Math.cos(car.angle - Math.PI / 2) * 54;
      const leftY = car.y + Math.sin(car.angle - Math.PI / 2) * 54;
      const rightX = car.x + Math.cos(car.angle + Math.PI / 2) * 54;
      const rightY = car.y + Math.sin(car.angle + Math.PI / 2) * 54;
      const leftFree = probeFree(city, leftX, leftY, CAR_RADIUS);
      const rightFree = probeFree(city, rightX, rightY, CAR_RADIUS);
      if (leftFree && rightFree) car.angle += Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      else if (leftFree) car.angle -= Math.PI / 2;
      else if (rightFree) car.angle += Math.PI / 2;
      else car.angle += Math.PI; // jalan buntu: putar balik
      car.speed *= 0.45;
      car.straightTime = 0;
      car.turnTimer = 4 + Math.random() * 5;
    } else {
      // Belok sesekali di persimpangan supaya traffic tidak monoton.
      if (car.turnTimer <= 0 && car.straightTime > 4) {
        const leftX = car.x + Math.cos(car.angle - Math.PI / 2) * 54;
        const leftY = car.y + Math.sin(car.angle - Math.PI / 2) * 54;
        const rightX = car.x + Math.cos(car.angle + Math.PI / 2) * 54;
        const rightY = car.y + Math.sin(car.angle + Math.PI / 2) * 54;
        const leftFree = probeFree(city, leftX, leftY, CAR_RADIUS);
        const rightFree = probeFree(city, rightX, rightY, CAR_RADIUS);
        if (leftFree && rightFree && Math.random() < 0.55) {
          car.angle += Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        } else if (leftFree && Math.random() < 0.3) {
          car.angle -= Math.PI / 2;
        } else if (rightFree && Math.random() < 0.3) {
          car.angle += Math.PI / 2;
        }
        car.straightTime = 0;
        car.turnTimer = 4 + Math.random() * 6;
      }
      car.speed += (car.cruise - car.speed) * Math.min(1, 1.6 * dt);
    }

    // Menjauhlah dari tepi dunia.
    if (car.x < 50 || car.y < 50 || car.x > WORLD_W - 50 || car.y > WORLD_H - 50) {
      car.angle = Math.atan2(WORLD_H / 2 - car.y, WORLD_W / 2 - car.x);
    }

    const dx = Math.cos(car.angle) * car.speed * dt;
    const dy = Math.sin(car.angle) * car.speed * dt;
    if (dx !== 0 || dy !== 0) {
      const next = moveWithCollision(city, car.x, car.y, dx, dy, CAR_RADIUS);
      if (next.hitX || next.hitY) {
        car.speed *= 0.3;
        car.angle += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
      }
      car.x = next.x;
      car.y = next.y;
    }
    car.x = clamp(car.x, 20, WORLD_W - 20);
    car.y = clamp(car.y, 20, WORLD_H - 20);
  }
}

// ---------------------------------------------------------------- parked cars

/** Mobil parkir dari parkingSpots kota. `taken` = sudah dicuri. */
export function createParkedCars(city) {
  return (city.parkingSpots || []).map((s) => ({
    x: s.x, y: s.y,
    angle: typeof s.angle === 'number' ? s.angle : 0,
    color: typeof s.color === 'string' ? s.color : '#9aa3b2',
    speed: 0, isPlayer: false, parked: true, taken: !!s.taken,
  }));
}

/** Mobil parkir terdekat dalam `maxDist`, atau null. */
export function nearestParkedCar(parked, x, y, maxDist = 70) {
  let best = null;
  let bestD = maxDist;
  for (const car of parked) {
    if (car.taken) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best ? { car: best, dist: bestD } : null;
}

/** Posisi turun dari mobil (sisi pengemudi). */
export function exitCarPosition(car) {
  const side = car.angle + Math.PI / 2;
  return {
    x: car.x + Math.cos(side) * (CAR_LENGTH / 2 + 12),
    y: car.y + Math.sin(side) * (CAR_LENGTH / 2 + 12),
  };
}

/** Daftar mobil untuk renderer: traffic + parkir (belum dicuri) + mobil pemain. */
export function driveableCarsForRender(playerCar, traffic, parked) {
  const cars = [...(traffic || [])];
  for (const p of parked || []) if (!p.taken) cars.push(p);
  if (playerCar) cars.push(playerCar);
  return cars;
}
