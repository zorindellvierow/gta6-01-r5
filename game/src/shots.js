// Crescent Bay — shots.js (fresh, round 5)
// Mode screenshot deterministik untuk shots.json:
//   ?shot=start&seed=1  -> menu awal di atas kota
//   ?shot=play&seed=1   -> Rook mengemudi di Downtown, 1 polisi mengejar
//   ?shot=end&seed=1    -> layar misi selesai
// Tanpa input acak, tanpa loop animasi: satu render lalu berhenti.
// Dipakai main.js saat ada ?shot= di URL. Bukan game loop.
import * as ConfigMod from './config.js';
import * as WorldMod from './world.js';
import * as RenderMod from './render.js';
import { createTraffic, createParkedCars } from './vehicles.js';
import { createHud } from './hud.js';

function pick(mod, name) {
  if (mod && typeof mod[name] !== 'undefined') return mod[name];
  if (mod && mod.default && typeof mod.default[name] !== 'undefined') return mod.default[name];
  return undefined;
}
const generateCity = pick(WorldMod, 'generateCity');
const circleHitsCollider = pick(WorldMod, 'circleHitsCollider');
const isInWater = pick(WorldMod, 'isInWater');
const createRenderer = pick(RenderMod, 'createRenderer');
const DISTRICTS = pick(ConfigMod, 'DISTRICTS') || {};
const WORLD_CFG = pick(ConfigMod, 'WORLD') || {};
const WORLD_W = typeof WORLD_CFG.WIDTH === 'number' ? WORLD_CFG.WIDTH : 2400;
const WORLD_H = typeof WORLD_CFG.HEIGHT === 'number' ? WORLD_CFG.HEIGHT : 1800;

/** Normalisasi bounds distrik: {x,y,w,h} / {minX,minY,maxX,maxY} / {bounds}. */
function districtRect(def, fallback) {
  if (!def) return fallback;
  const b = def.bounds || def;
  if (typeof b.x === 'number' && typeof b.w === 'number') {
    return { x: b.x, y: b.y, w: b.w, h: b.h };
  }
  if (typeof b.minX === 'number' && typeof b.maxX === 'number') {
    return { x: b.minX, y: b.minY, w: b.maxX - b.minX, h: b.maxY - b.minY };
  }
  if (typeof b.cx === 'number' && typeof b.cy === 'number') {
    return { x: b.cx - 300, y: b.cy - 200, w: 600, h: 400 };
  }
  return fallback;
}

function freePoint(city, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y += 40) {
    for (let x = x0; x <= x1; x += 40) {
      if (typeof isInWater === 'function' && isInWater(x, y)) continue;
      if (typeof circleHitsCollider === 'function' && circleHitsCollider(city, x, y, 16)) continue;
      return { x, y };
    }
  }
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

export async function runShot(kind) {
  window.__shotDone = false;
  try {
    const params = new URLSearchParams(window.location.search);
    const seed = Number(params.get('seed') || '1') || 1;
    const canvas = document.getElementById('game');
    const city = generateCity(seed);
    const renderer = createRenderer(canvas, city);
    const hud = createHud();
    if (typeof renderer.resize === 'function') renderer.resize();

    const traffic = createTraffic(city, 6, seed);
    const parked = createParkedCars(city);
    const parkedFree = parked.filter((c) => !c.taken);
    const pickups = city.pickups || [];
    const spawnOf = (key, fb) => {
      const s = city.spawns && city.spawns[key];
      return s && typeof s.x === 'number' ? { x: s.x, y: s.y } : fb;
    };

    if (kind === 'start') {
      const sp = spawnOf('player', { x: 1200, y: 900 });
      if (typeof renderer.setMode === 'function') renderer.setMode('foot');
      if (typeof renderer.follow === 'function') renderer.follow({ x: sp.x, y: sp.y, angle: 0 }, 0.016);
      renderer.render({
        player: { x: sp.x, y: sp.y, angle: 0 },
        cars: [...traffic, ...parkedFree],
        police: [],
        pickups,
        missionMarker: spawnOf('selin', null),
        time: 0,
        showMinimap: true,
      });
      hud.update({
        money: 50, wanted: 0, health: 100, healthMax: 100,
        ammo: 12, magSize: 12, reloading: false,
        district: 'Crescent Bay', objective: '',
      });
      hud.showMenu({ hasSave: false, onNewGame: () => {}, onContinue: () => {} });
    } else if (kind === 'play') {
      // Rook mengemudi di Downtown, 1 polisi mengejar dari belakang.
      const downtown = districtRect(DISTRICTS.DOWNTOWN, {
        x: WORLD_W * 0.3, y: WORLD_H * 0.3, w: WORLD_W * 0.4, h: WORLD_H * 0.4,
      });
      const road = freePoint(city, downtown.x, downtown.y, downtown.x + downtown.w, downtown.y + downtown.h);
      const angle = 0; // menghadap timur di jalan downtown
      const playerCar = {
        x: road.x, y: road.y, angle, speed: 320,
        color: '#e8b93b', health: 100, isPlayer: true, parked: false,
      };
      const cop = {
        x: road.x - 150, y: road.y + 26, angle: 0,
        speed: 300, health: 100, ramTimer: 0,
      };
      const marker = { x: road.x + 420, y: road.y };
      if (typeof renderer.setMode === 'function') renderer.setMode('car');
      if (typeof renderer.follow === 'function') renderer.follow({ x: road.x, y: road.y, angle }, 0.016);
      renderer.render({
        player: { x: road.x, y: road.y, angle },
        cars: [playerCar, ...traffic, ...parkedFree],
        police: [cop],
        pickups,
        missionMarker: marker,
        time: 96,
        showMinimap: true,
      });
      hud.update({
        money: 1250, wanted: 2, health: 86, healthMax: 100,
        ammo: 9, magSize: 12, reloading: false,
        district: 'Downtown',
        objective: 'Misi 3/4 — Kejar Target Downtown: pepet mobil target! (2:14)',
      });
    } else if (kind === 'end') {
      const sp = spawnOf('hills', { x: 2000, y: 400 });
      if (typeof renderer.setMode === 'function') renderer.setMode('foot');
      if (typeof renderer.follow === 'function') renderer.follow({ x: sp.x, y: sp.y, angle: 0 }, 0.016);
      renderer.render({
        player: { x: sp.x, y: sp.y, angle: 0 },
        cars: [...traffic, ...parkedFree],
        police: [],
        pickups,
        missionMarker: null,
        time: 512,
        showMinimap: true,
      });
      hud.update({
        money: 2450, wanted: 0, health: 100, healthMax: 100,
        ammo: 12, magSize: 12, reloading: false,
        district: 'Hills',
        objective: 'Semua misi selesai — Crescent Bay milikmu, Rook.',
      });
      hud.showEnd({
        kind: 'allDone',
        stats: [
          '💰 Uang: $2,450',
          '🎯 Misi selesai: 4 / 4',
          '⏱️ Waktu main: 8:32',
          '⭐ Wanted tertinggi: 3',
        ],
        onRetry: () => {},
        onMenu: () => {},
      });
    } else {
      throw new Error(`shot tidak dikenal: ${kind}`);
    }
    window.__shotDone = true;
  } catch (err) {
    console.error('[Crescent Bay] shot gagal:', err);
    window.__shotError = String(err && err.message ? err.message : err);
  }
}
