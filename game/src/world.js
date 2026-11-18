// Crescent Bay — world.js
// Generator kota deterministik dari seed. Kota pesisir berbentuk bulan sabit:
// teluk di timur, pantai + marina di tepi air, Downtown di tengah,
// perumahan di bukit barat. Semua posisi lahir dari RNG seedable sehingga
// seed yang sama selalu menghasilkan kota yang sama.

import { WORLD, BAY, DISTRICTS, COLORS } from './config.js';
import { createRng } from './random.js';

function pointInBay(x, y) {
  const dx = (x - BAY.CENTER_X) / BAY.RADIUS_X;
  const dy = (y - BAY.CENTER_Y) / BAY.RADIUS_Y;
  return dx * dx + dy * dy < 1;
}

function pointOnSand(x, y) {
  const dx = (x - BAY.CENTER_X) / (BAY.RADIUS_X + BAY.SAND_WIDTH);
  const dy = (y - BAY.CENTER_Y) / (BAY.RADIUS_Y + BAY.SAND_WIDTH);
  return dx * dx + dy * dy < 1 && !pointInBay(x, y);
}

function districtAt(x, y) {
  if (pointInBay(x, y) || pointOnSand(x, y)) return 'BEACHFRONT';
  const keys = Object.keys(DISTRICTS);
  for (let i = 0; i < keys.length; i += 1) {
    const d = DISTRICTS[keys[i]];
    if (x >= d.bounds.x && x < d.bounds.x + d.bounds.w
      && y >= d.bounds.y && y < d.bounds.y + d.bounds.h) {
      return keys[i];
    }
  }
  return 'DOWNTOWN';
}

function overlapsBox(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function generateCity(seed) {
  const rng = createRng(seed);
  const city = {
    seed: rng.seed,
    width: WORLD.WIDTH,
    height: WORLD.HEIGHT,
    roads: [],
    blocks: [],
    buildings: [],
    colliders: [],
    lamps: [],
    palms: [],
    docks: [],
    boats: [],
    parkingSpots: [],
    spawns: {},
    pickups: [],
  };

  // --- Jalan: grid utama tiap BLOCK + gang tiap setengah blok ---
  const step = WORLD.BLOCK;
  for (let x = 0; x <= WORLD.WIDTH; x += step) {
    city.roads.push({ x, y: 0, w: WORLD.ROAD_WIDTH, h: WORLD.HEIGHT, vertical: true, main: true });
  }
  for (let y = 0; y <= WORLD.HEIGHT; y += step) {
    city.roads.push({ x: 0, y, w: WORLD.WIDTH, h: WORLD.ROAD_WIDTH, vertical: false, main: true });
  }
  for (let x = step / 2; x < WORLD.WIDTH; x += step) {
    city.roads.push({ x, y: 0, w: WORLD.ALLEY_WIDTH, h: WORLD.HEIGHT, vertical: true, main: false });
  }
  for (let y = step / 2; y < WORLD.HEIGHT; y += step) {
    city.roads.push({ x: 0, y, w: WORLD.WIDTH, h: WORLD.ALLEY_WIDTH, vertical: false, main: false });
  }

  // --- Blok + bangunan: satu blok kota = 1-4 bangunan ---
  let buildingId = 0;
  const margin = WORLD.ROAD_WIDTH + WORLD.SIDEWALK;
  for (let bx = 0; bx < WORLD.WIDTH / step; bx += 1) {
    for (let by = 0; by < WORLD.HEIGHT / step; by += 1) {
      const blockX = bx * step + margin;
      const blockY = by * step + margin;
      const blockW = step - margin * 2;
      const blockH = step - margin * 2;
      const cx = blockX + blockW / 2;
      const cy = blockY + blockH / 2;
      if (pointInBay(cx, cy)) continue; // blok tenggelam: tidak ada bangunan
      if (pointOnSand(cx, cy)) continue; // pantai: kosong untuk palm
      const district = districtAt(cx, cy);
      const block = { x: blockX, y: blockY, w: blockW, h: blockH, district };
      city.blocks.push(block);

      const count = district === 'DOWNTOWN' ? rng.int(1, 2) : rng.int(1, 4);
      const palette = DISTRICTS[district].building;
      for (let i = 0; i < count; i += 1) {
        const bw = district === 'DOWNTOWN'
          ? rng.float(50, 90)
          : rng.float(34, 70);
        const bh = district === 'DOWNTOWN'
          ? rng.float(50, 90)
          : rng.float(30, 60);
        const px = rng.float(blockX + 4, blockX + blockW - bw - 4);
        const py = rng.float(blockY + 4, blockY + blockH - bh - 4);
        const box = { x: px, y: py, w: bw, h: bh };
        let clash = false;
        for (let k = 0; k < city.buildings.length; k += 1) {
          if (overlapsBox(box, city.buildings[k])) { clash = true; break; }
        }
        if (clash) continue;
        const height = district === 'DOWNTOWN'
          ? rng.int(3, 12)
          : (district === 'HILLS' ? rng.int(1, 2) : rng.int(1, 4));
        const building = {
          id: buildingId,
          x: px,
          y: py,
          w: bw,
          h: bh,
          floors: height,
          color: rng.pick(palette),
          windowLit: rng.chance(0.55),
          district,
        };
        buildingId += 1;
        city.buildings.push(building);
        city.colliders.push({ x: px, y: py, w: bw, h: bh, kind: 'building', id: building.id });
      }
    }
  }

  // --- Dermaga marina: 3 dermaga kayu menjorok ke teluk ---
  const dockBaseX = 2080;
  for (let d = 0; d < 3; d += 1) {
    const dockY = 1250 + d * 160;
    const dock = { x: dockBaseX, y: dockY, w: 190, h: 26 };
    city.docks.push(dock);
    city.colliders.push({ x: dock.x, y: dock.y, w: dock.w, h: dock.h, kind: 'dock', id: d });
    for (let b = 0; b < 2; b += 1) {
      city.boats.push({
        x: dock.x + 40 + b * 80,
        y: dock.y + 34,
        w: 52,
        h: 18,
        color: rng.pick(['#e8e8e8', '#d96a4a', '#4a7fd9', '#e8b23a']),
      });
    }
  }

  // --- Lampu jalan di tiap persimpangan utama ---
  for (let x = 0; x <= WORLD.WIDTH; x += step) {
    for (let y = 0; y <= WORLD.HEIGHT; y += step) {
      if (pointInBay(x, y)) continue;
      city.lamps.push({ x: x + WORLD.ROAD_WIDTH + 4, y: y + WORLD.ROAD_WIDTH + 4 });
    }
  }

  // --- Pohon palm di sepanjang pantai + sedikit di Hills ---
  for (let i = 0; i < 90; i += 1) {
    const x = rng.float(1950, 2350);
    const y = rng.float(80, 1720);
    if (!pointOnSand(x, y) && !pointInBay(x, y)) continue;
    city.palms.push({ x, y, lean: rng.float(-0.2, 0.2), size: rng.float(0.8, 1.3) });
  }
  for (let i = 0; i < 40; i += 1) {
    const x = rng.float(100, 600);
    const y = rng.float(100, 1700);
    if (districtAt(x, y) !== 'HILLS') continue;
    city.palms.push({ x, y, lean: rng.float(-0.15, 0.15), size: rng.float(0.7, 1.1) });
  }

  // --- Titik spawn ---
  city.spawns = {
    player: { x: 1000, y: 900, angle: -Math.PI / 2 },
    selin: { x: 1120, y: 860, angle: Math.PI / 2 },
    marina: { x: 2050, y: 1330, angle: 0 },
    beach: { x: 2150, y: 500, angle: Math.PI },
    hills: { x: 300, y: 300, angle: 0 },
  };

  // --- Mobil parkir di tepi jalan utama ---
  const parkStreets = [
    { x: 1000, y: 640 }, { x: 1200, y: 940 }, { x: 800, y: 1140 },
    { x: 1400, y: 340 }, { x: 600, y: 1540 }, { x: 1800, y: 1240 },
    { x: 400, y: 940 }, { x: 1600, y: 740 },
  ];
  const carColors = ['#c0392b', '#2e86c1', '#f1c40f', '#7d3c98', '#e5e8e8', '#1abc9c'];
  for (let i = 0; i < parkStreets.length; i += 1) {
    city.parkingSpots.push({
      x: parkStreets[i].x,
      y: parkStreets[i].y,
      angle: rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]),
      color: carColors[i % carColors.length],
      taken: false,
    });
  }

  // --- Pickup uang tersebar ---
  for (let i = 0; i < 14; i += 1) {
    const x = rng.float(200, 2100);
    const y = rng.float(150, 1650);
    if (pointInBay(x, y)) continue;
    city.pickups.push({ x, y, amount: rng.int(25, 120), taken: false });
  }

  return city;
}

// --- Tabrakan AABB ---

export function pointHitsCollider(city, x, y) {
  for (let i = 0; i < city.colliders.length; i += 1) {
    const c = city.colliders[i];
    if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return c;
  }
  return null;
}

export function circleHitsCollider(city, x, y, radius) {
  for (let i = 0; i < city.colliders.length; i += 1) {
    const c = city.colliders[i];
    const nearX = Math.max(c.x, Math.min(x, c.x + c.w));
    const nearY = Math.max(c.y, Math.min(y, c.y + c.h));
    const dx = x - nearX;
    const dy = y - nearY;
    if (dx * dx + dy * dy < radius * radius) return c;
  }
  return null;
}

// Gerak sumbu-per-sumbu: coba X lalu Y, tahan sumbu yang menabrak.
// Mengembalikan posisi baru {x, y, hitX, hitY}.
export function moveWithCollision(city, x, y, dx, dy, radius) {
  let nx = x;
  let ny = y;
  let hitX = false;
  let hitY = false;
  if (dx !== 0 && !circleHitsCollider(city, x + dx, y, radius)) nx = x + dx;
  else if (dx !== 0) hitX = true;
  if (dy !== 0 && !circleHitsCollider(city, nx, y + dy, radius)) ny = y + dy;
  else if (dy !== 0) hitY = true;
  nx = Math.max(0, Math.min(city.width, nx));
  ny = Math.max(0, Math.min(city.height, ny));
  return { x: nx, y: ny, hitX, hitY };
}

export function isInWater(x, y) {
  return pointInBay(x, y);
}

export function isOnSand(x, y) {
  return pointOnSand(x, y);
}

export function districtAtPoint(x, y) {
  return districtAt(x, y);
}

export function waterColorAt(x, y) {
  return pointInBay(x, y) ? COLORS.WATER_DEEP : COLORS.WATER;
}

export default generateCity;
