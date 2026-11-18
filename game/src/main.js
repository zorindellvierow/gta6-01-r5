// Crescent Bay — main.js (fresh, round 5)
// Game loop + state machine (menu / play / pause / busted / wasted / complete).
// Merakit modul builder #1 lewat API publiknya + modul r5 (vehicles, police,
// missions, hud). Kalau ada ?shot= di URL, jalankan mode screenshot (shots.js)
// dan JANGAN mulai game loop biasa.
import * as ConfigMod from './config.js';
import * as WorldMod from './world.js';
import * as RenderMod from './render.js';
import * as InputMod from './input.js';
import * as AudioMod from './audio.js';
import * as SaveMod from './save.js';
import {
  createPlayerCar,
  updatePlayerCar,
  createTraffic,
  updateTraffic,
  createParkedCars,
  nearestParkedCar,
  exitCarPosition,
  driveableCarsForRender,
} from './vehicles.js';
import {
  createWanted,
  commitCrime,
  updateWanted,
  createPolice,
  syncPoliceCount,
  updatePolice,
  damagePolice,
  nearestPolice,
  updateSiren,
  applyPenalty,
} from './police.js';
import {
  createMissionState,
  startMission,
  advanceMission,
  retryMission,
  updateMission,
  missionMarker,
  missionReward,
  missionObjectiveText,
  currentMissionDef,
  createTaxi,
  startTaxi,
  updateTaxi,
  cancelTaxi,
  taxiMarker,
  collectCashPickup,
} from './missions.js';
import { createHud } from './hud.js';

// ---- resolve API modul builder #1 (defensif: named export atau default) ----
function pick(mod, name) {
  if (mod && typeof mod[name] !== 'undefined') return mod[name];
  if (mod && mod.default && typeof mod.default[name] !== 'undefined') return mod.default[name];
  return undefined;
}
const cfg = (name, fb) => {
  const v = pick(ConfigMod, name);
  return typeof v === 'undefined' ? fb : v;
};
const num = (v, fb) => (typeof v === 'number' && Number.isFinite(v) ? v : fb);

const GAME_VERSION = cfg('GAME_VERSION', '0.5.0');
const DEFAULT_SEED = cfg('DEFAULT_SEED', 1);
const PLAYER_CFG = cfg('PLAYER', {});
const WEAPON_CFG = cfg('WEAPON', {});
const MISSIONS_CFG = cfg('MISSIONS', {});
const WORLD_CFG = cfg('WORLD', {});

const WALK_SPEED = num(PLAYER_CFG.WALK_SPEED, 150);
const RUN_SPEED = num(PLAYER_CFG.RUN_SPEED, 260);
const PLAYER_RADIUS = num(PLAYER_CFG.RADIUS, 12);
const HEALTH_MAX = num(PLAYER_CFG.HEALTH_MAX, 100);
const START_MONEY = num(PLAYER_CFG.START_MONEY, 50);
const PISTOL_DAMAGE = num(WEAPON_CFG.PISTOL_DAMAGE, 34);
const WEAPON_RANGE = num(WEAPON_CFG.RANGE, 320);
const MAG = num(WEAPON_CFG.MAG, 12);
const RELOAD_SECONDS = num(WEAPON_CFG.RELOAD_SECONDS, 1.4);
const FIRE_COOLDOWN = num(WEAPON_CFG.FIRE_COOLDOWN, 0.22);
const SAVE_VERSION = num(pick(SaveMod, 'SAVE_VERSION'), 1);

const generateCity = pick(WorldMod, 'generateCity');
const moveWithCollision = pick(WorldMod, 'moveWithCollision');
const isInWater = pick(WorldMod, 'isInWater');
const districtAtPoint = pick(WorldMod, 'districtAtPoint');
const circleHitsCollider = pick(WorldMod, 'circleHitsCollider');
const createRenderer = pick(RenderMod, 'createRenderer');
const createInput = pick(InputMod, 'createInput');
const GameInputCls = pick(InputMod, 'GameInput');
const createAudio = pick(AudioMod, 'createAudio');
const GameAudioCls = pick(AudioMod, 'GameAudio');
const saveGame = pick(SaveMod, 'saveGame');
const loadGame = pick(SaveMod, 'loadGame');
const hasSave = pick(SaveMod, 'hasSave');
const validateSave = pick(SaveMod, 'validateSave');

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

const params = new URLSearchParams(window.location.search);
const shotKind = params.get('shot');
if (shotKind) {
  const shots = await import('./shots.js');
  await shots.runShot(shotKind);
} else {
  bootGame();
}

function bootGame() {
  if (typeof generateCity !== 'function' || typeof createRenderer !== 'function') {
    document.body.innerHTML = '<p style="color:#fff;font:16px sans-serif;padding:20px">'
      + 'Crescent Bay gagal dimuat: modul inti tidak ditemukan.</p>';
    throw new Error('Crescent Bay: generateCity/createRenderer tidak tersedia');
  }

  const canvas = document.getElementById('game');
  const hud = createHud();
  const city = generateCity(DEFAULT_SEED);
  const renderer = createRenderer(canvas, city);
  const input = typeof createInput === 'function'
    ? createInput()
    : new GameInputCls();
  try { input.attach(window); } catch { try { input.attach(); } catch { /* abaikan */ } }
  const audio = typeof createAudio === 'function'
    ? createAudio()
    : new GameAudioCls();

  let audioReady = false;
  let muted = false;
  function ensureAudio() {
    if (audioReady) return;
    try {
      if (typeof audio.init === 'function') audio.init();
      audioReady = true;
      if (muted && typeof audio.setMuted === 'function') audio.setMuted(true);
    } catch { /* audio gagal: game tetap jalan tanpa suara */ }
  }
  function sfx(name, ...args) {
    if (!audioReady) return;
    try {
      const fn = audio[name];
      if (typeof fn === 'function') fn.apply(audio, args);
    } catch { /* abaikan */ }
  }
  ['keydown', 'pointerdown'].forEach((ev) =>
    window.addEventListener(ev, ensureAudio, { once: true, passive: true }));

  // ---- state ------------------------------------------------------------
  let state = 'menu'; // menu | playing | paused | busted | wasted | complete
  const player = {
    x: 0, y: 0, angle: 0,
    health: HEALTH_MAX, money: START_MONEY,
    ammo: MAG, reloading: false, reloadTimer: 0, fireCooldown: 0,
    lastDamageAt: -99, lastShotCrimeAt: -99,
  };
  let playerCar = null;
  let driving = false;
  let traffic = [];
  let parked = [];
  let police = createPolice();
  let wanted = createWanted();
  let missions = createMissionState();
  let taxi = createTaxi();
  let playSeconds = 0;
  let autosaveTimer = 0;
  let sirenOn = false;
  let engineOn = false;

  const spawnOf = (key, fb) => {
    const s = city.spawns && city.spawns[key];
    if (s && typeof s.x === 'number') return { x: s.x, y: s.y };
    return fb;
  };
  const playerPos = () => (driving && playerCar
    ? { x: playerCar.x, y: playerCar.y, angle: playerCar.angle }
    : { x: player.x, y: player.y, angle: player.angle });

  function resetWorld(freshTraffic = true) {
    const sp = spawnOf('player', { x: 1200, y: 900 });
    player.x = sp.x; player.y = sp.y; player.angle = 0;
    player.health = HEALTH_MAX; player.money = START_MONEY;
    player.ammo = MAG; player.reloading = false; player.reloadTimer = 0;
    player.fireCooldown = 0; player.lastDamageAt = -99;
    playerCar = null; driving = false;
    traffic = freshTraffic ? createTraffic(city, 8, 1) : traffic;
    parked = createParkedCars(city);
    police = createPolice();
    wanted = createWanted();
    missions = createMissionState();
    taxi = createTaxi();
    playSeconds = 0; autosaveTimer = 0;
    if (sirenOn) { sfx('stopSiren'); sirenOn = false; }
    if (engineOn) { sfx('stopEngine'); engineOn = false; }
  }

  function saveNow() {
    if (typeof saveGame !== 'function') return false;
    try {
      return !!saveGame({
        version: SAVE_VERSION,
        gameVersion: GAME_VERSION,
        money: player.money,
        missionsDone: [...missions.done],
        player: { x: player.x, y: player.y, angle: player.angle },
        wanted: wanted.level,
        playSeconds: Math.round(playSeconds),
        muted,
        savedAt: Date.now(),
      });
    } catch { return false; }
  }

  function applyLoadedSave(save) {
    player.money = num(save.money, START_MONEY);
    player.health = HEALTH_MAX;
    player.ammo = MAG;
    const px = save.player && num(save.player.x, null);
    if (px !== null) {
      player.x = save.player.x;
      player.y = save.player.y;
      player.angle = num(save.player.angle, 0);
    }
    playSeconds = num(save.playSeconds, 0);
    muted = !!save.muted;
    if (muted) sfx('setMuted', true);
    const done = Array.isArray(save.missionsDone) ? save.missionsDone : [];
    missions = createMissionState();
    missions.done = [...done];
    missions.index = done.length;
    wanted = createWanted();
    wanted.level = clamp(num(save.wanted, 0), 0, 5);
    police = createPolice();
    taxi = createTaxi();
    playerCar = null; driving = false;
    if (missions.index < 4) {
      const def = startMission(missions, city, missions.index);
      if (def && def.wantedOnStart) commitCrime(wanted, def.wantedOnStart, {});
    } else {
      missions.status = 'allDone';
    }
  }

  function damagePlayer(amount, cause) {
    if (state !== 'playing' || amount <= 0) return;
    player.health -= amount;
    player.lastDamageAt = playSeconds;
    if (player.health <= 0) {
      player.health = 0;
      doWasted();
    }
  }

  function endStats() {
    return [
      `💰 Uang: $${Math.round(player.money).toLocaleString('en-US')}`,
      `🎯 Misi selesai: ${missions.done.length} / 4`,
      `⏱️ Waktu main: ${Math.floor(playSeconds / 60)}:${String(Math.floor(playSeconds % 60)).padStart(2, '0')}`,
      `⭐ Wanted tertinggi: ${wanted.level}`,
    ];
  }

  function doBusted() {
    if (state !== 'playing') return;
    state = 'busted';
    player.money = applyPenalty(player.money);
    wanted.level = 0;
    police = createPolice();
    if (sirenOn) { sfx('stopSiren'); sirenOn = false; }
    if (engineOn) { sfx('stopEngine'); engineOn = false; }
    sfx('missionFailed');
    saveNow();
    hud.showEnd({ kind: 'busted', stats: endStats(), onRetry: respawn, onMenu: toMenu });
  }

  function doWasted() {
    if (state !== 'playing') return;
    state = 'wasted';
    player.money = applyPenalty(player.money);
    wanted.level = 0;
    police = createPolice();
    if (sirenOn) { sfx('stopSiren'); sirenOn = false; }
    if (engineOn) { sfx('stopEngine'); engineOn = false; }
    sfx('missionFailed');
    saveNow();
    hud.showEnd({ kind: 'wasted', stats: endStats(), onRetry: respawn, onMenu: toMenu });
  }

  function respawn() {
    const sp = spawnOf('player', { x: 1200, y: 900 });
    player.x = sp.x; player.y = sp.y; player.angle = 0;
    player.health = HEALTH_MAX;
    player.ammo = MAG; player.reloading = false;
    playerCar = null; driving = false;
    wanted = createWanted();
    police = createPolice();
    taxi = createTaxi();
    if (missions.status !== 'allDone') retryMission(missions, city);
    state = 'playing';
    hud.hideScreens();
    hud.toast('Kembali ke jalanan, Rook.');
  }

  function toMenu() {
    state = 'menu';
    if (sirenOn) { sfx('stopSiren'); sirenOn = false; }
    if (engineOn) { sfx('stopEngine'); engineOn = false; }
    hud.showMenu({
      hasSave: safeHasSave(),
      onNewGame: newGame,
      onContinue: continueGame,
    });
  }

  function safeHasSave() {
    try { return typeof hasSave === 'function' ? !!hasSave() : false; } catch { return false; }
  }

  function newGame() {
    ensureAudio();
    sfx('click');
    resetWorld(true);
    const def = startMission(missions, city, 0);
    state = 'playing';
    hud.hideScreens();
    hud.toast(def ? `Misi 1 — ${def.title}: ${def.brief}` : 'Selamat datang di Crescent Bay!', 3600);
  }

  function continueGame() {
    ensureAudio();
    sfx('click');
    let save = null;
    try { save = typeof loadGame === 'function' ? loadGame() : null; } catch { save = null; }
    if (!save || (typeof validateSave === 'function' && !validateSave(save))) {
      hud.toast('Save tidak ditemukan / rusak — mulai New Game.');
      return;
    }
    resetWorld(true);
    applyLoadedSave(save);
    state = 'playing';
    hud.hideScreens();
    hud.toast(`Lanjutkan — misi ${Math.min(missions.index + 1, 4)}/4.`);
  }

  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      if (sirenOn) { sfx('stopSiren'); sirenOn = false; }
      if (engineOn) { sfx('stopEngine'); engineOn = false; }
      hud.showPause({ onResume: resumeGame, onMenu: toMenu });
    } else if (state === 'paused') {
      resumeGame();
    }
  }

  function resumeGame() {
    if (state !== 'paused') return;
    state = 'playing';
    hud.hideScreens();
  }

  function districtName(x, y) {
    try {
      const d = typeof districtAtPoint === 'function' ? districtAtPoint(city, x, y) : null;
      if (!d) return 'Crescent Bay';
      const raw = typeof d === 'string' ? d : (d.name || d.id || d.key || d.district || '');
      const map = { MARINA: 'Marina', DOWNTOWN: 'Downtown', BEACHFRONT: 'Beachfront', HILLS: 'Hills' };
      const key = String(raw).toUpperCase();
      if (map[key]) return map[key];
      if (raw) return String(raw).charAt(0).toUpperCase() + String(raw).slice(1).toLowerCase();
      return 'Crescent Bay';
    } catch { return 'Crescent Bay'; }
  }

  // ---- interaksi ---------------------------------------------------------
  function tryInteract() {
    // Keluar mobil.
    if (driving && playerCar) {
      const out = exitCarPosition(playerCar);
      let px = out.x; let py = out.y;
      if ((typeof circleHitsCollider === 'function' && circleHitsCollider(city, px, py, PLAYER_RADIUS + 2))
        || (typeof isInWater === 'function' && isInWater(px, py))) {
        px = playerCar.x - Math.cos(playerCar.angle + Math.PI / 2) * 35;
        py = playerCar.y - Math.sin(playerCar.angle + Math.PI / 2) * 35;
      }
      player.x = px; player.y = py; player.angle = playerCar.angle;
      driving = false;
      if (engineOn) { sfx('stopEngine'); engineOn = false; }
      sfx('click');
      return;
    }
    // Masuk mobil sendiri.
    if (playerCar) {
      const d = Math.hypot(playerCar.x - player.x, playerCar.y - player.y);
      if (d < 80) {
        driving = true;
        sfx('startEngine');
        engineOn = true;
        return;
      }
    }
    // Curi mobil parkir.
    const near = nearestParkedCar(parked, player.x, player.y, 72);
    if (near) {
      const stolen = near.car;
      stolen.taken = true;
      playerCar = {
        x: stolen.x, y: stolen.y, angle: stolen.angle, speed: 0,
        color: stolen.color, health: 100, isPlayer: true, parked: false,
      };
      driving = true;
      commitCrime(wanted, 1, { onWantedUp: () => sfx('wantedUp') });
      sfx('startEngine');
      engineOn = true;
      hud.toast('Mobil dicuri! Wanted +1 ⭐ — kabur!');
      return;
    }
    // Mulai / ulang misi di dekat Selin, atau ulang misi gagal di mana saja.
    const selin = spawnOf('selin', null);
    const nearSelin = selin && Math.hypot(selin.x - player.x, selin.y - player.y) < 110;
    if (missions.status === 'failed') {
      const def = retryMission(missions, city);
      if (def) hud.toast(`Misi diulang: ${def.title}`);
      return;
    }
    if (missions.status === 'idle' && nearSelin) {
      const def = startMission(missions, city, missions.index);
      if (def) hud.toast(`Misi ${missions.index + 1} — ${def.title}: ${def.brief}`, 3600);
    }
  }

  function tryShoot() {
    if (driving || player.reloading || player.ammo <= 0) return;
    if (player.fireCooldown > 0) return;
    player.ammo -= 1;
    player.fireCooldown = FIRE_COOLDOWN;
    sfx('shoot');
    // Kejahatan: tembakan pertama dalam 5 detik menaikkan wanted 1.
    if (playSeconds - player.lastShotCrimeAt > 5) {
      player.lastShotCrimeAt = playSeconds;
      commitCrime(wanted, 1, { onWantedUp: () => sfx('wantedUp') });
    }
    const hit = nearestPolice(police, player.x, player.y, WEAPON_RANGE);
    if (hit) {
      player.angle = Math.atan2(hit.cop.y - player.y, hit.cop.x - player.x);
      const killed = damagePolice(police, hit.cop, PISTOL_DAMAGE);
      if (killed) hud.toast('Polisi dilumpuhkan!');
    }
    if (player.ammo === 0) {
      player.reloading = true;
      player.reloadTimer = RELOAD_SECONDS;
    }
  }

  // ---- update ------------------------------------------------------------
  function tick(dt, now) {
    // Pause / mute lewat polling aksi (sekali per frame).
    if (state === 'playing' || state === 'paused') {
      if (input.wasActionPressed('PAUSE')) togglePause();
    }
    if (input.wasActionPressed('MUTE')) {
      muted = !muted;
      sfx('setMuted', muted);
      hud.toast(muted ? 'Suara dimatikan (M)' : 'Suara dinyalakan (M)');
    }

    if (state === 'playing') {
      playSeconds += dt;
      autosaveTimer += dt;
      const pos = playerPos();

      // -- jalan kaki / mengemudi --
      if (driving && playerCar) {
        const res = updatePlayerCar(playerCar, input, city, dt, {
          onCrash: (impact) => {
            sfx('crash');
            if (impact > 260) {
              damagePlayer(Math.min(25, (impact - 260) / 18), 'crash');
            }
          },
        });
        if (res.crashed && res.impact > 120) hud.toast('BRAK! Mobil menabrak gedung.');
        player.x = playerCar.x; player.y = playerCar.y; player.angle = playerCar.angle;
        if (!engineOn) { sfx('startEngine'); engineOn = true; }
        sfx('setEngineSpeed', clamp(Math.abs(playerCar.speed) / 620, 0, 1), true);
      } else {
        let ax = 0; let ay = 0;
        try {
          const mv = input.moveAxis ? input.moveAxis() : null;
          if (mv && (mv.x || mv.y)) { ax = mv.x; ay = mv.y; }
        } catch { /* abaikan */ }
        if (!ax && !ay) {
          if (input.isActionDown('UP')) ay -= 1;
          if (input.isActionDown('DOWN')) ay += 1;
          if (input.isActionDown('LEFT')) ax -= 1;
          if (input.isActionDown('RIGHT')) ax += 1;
        }
        const len = Math.hypot(ax, ay);
        if (len > 0.01) {
          ax /= Math.max(1, len); ay /= Math.max(1, len);
          let speed = input.isActionDown('RUN') ? RUN_SPEED : WALK_SPEED;
          if (typeof isInWater === 'function' && isInWater(player.x, player.y)) speed *= 0.5;
          player.angle = Math.atan2(ay, ax);
          const next = moveWithCollision(city, player.x, player.y, ax * speed * dt, ay * speed * dt, PLAYER_RADIUS);
          if (!(typeof isInWater === 'function' && isInWater(next.x, next.y))) {
            player.x = next.x; player.y = next.y;
          }
        }
      }

      // -- interaksi & tembak --
      if (input.wasActionPressed('INTERACT')) tryInteract();
      if (input.isActionDown('FIRE')) tryShoot();
      if (input.wasActionPressed('RELOAD') && !player.reloading && player.ammo < MAG) {
        player.reloading = true;
        player.reloadTimer = RELOAD_SECONDS;
      }
      if (player.reloading) {
        player.reloadTimer -= dt;
        if (player.reloadTimer <= 0) {
          player.reloading = false;
          player.ammo = MAG;
        }
      }
      player.fireCooldown = Math.max(0, player.fireCooldown - dt);

      // -- taksi (T) --
      if (input.wasPressed('KeyT')) {
        if (!taxi.active) {
          const fare = startTaxi(taxi, city, playerPos());
          hud.toast(`Taksi: jemput penumpang — ongkos $${fare}.`, 3200);
        } else {
          cancelTaxi(taxi);
          hud.toast('Order taksi dibatalkan.');
        }
      }

      // -- traffic --
      const obstacles = [];
      if (playerCar) obstacles.push(playerCar);
      if (missions.status === 'active' && missions.targetCar) obstacles.push(missions.targetCar);
      updateTraffic(traffic, city, dt, obstacles);

      // -- wanted + polisi --
      updateWanted(wanted, dt);
      const target = playerPos();
      syncPoliceCount(police, city, target, wanted.level);
      const busted = updatePolice(police, target, city, dt, {
        driving, wantedLevel: Math.max(1, wanted.level),
        hooks: {
          onBusted: () => doBusted(),
          onRam: (impact) => {
            if (playerCar) playerCar.speed *= 0.6;
            sfx('crash');
            damagePlayer(clamp(impact / 25, 2, 12), 'ram');
          },
        },
      });
      if (busted === 'busted') { /* doBusted sudah dipanggil via hook */ }
      sirenOn = updateSiren(wanted.level, audioReady ? audio : null, sirenOn);

      // -- misi --
      if (missions.status === 'active') {
        const ev = updateMission(missions, city, target, dt);
        if (ev === 'completed') {
          const def = currentMissionDef(missions) || { title: 'Misi' };
          const reward = missionReward(missions.index);
          player.money += reward;
          sfx('missionComplete');
          sfx('pickupCash');
          saveNow();
          const next = advanceMission(missions, city);
          if (next) {
            if (next.wantedOnStart) commitCrime(wanted, next.wantedOnStart, { onWantedUp: () => sfx('wantedUp') });
            hud.toast(`Misi selesai! +$${reward} — Misi ${missions.index + 1}: ${next.title}`, 3600);
          } else {
            state = 'complete';
            hud.showEnd({
              kind: 'allDone',
              stats: endStats(),
              onRetry: () => { state = 'playing'; hud.hideScreens(); },
              onMenu: toMenu,
            });
          }
        } else if (ev === 'failed') {
          sfx('missionFailed');
          hud.toast('Misi gagal — tekan E untuk mengulang.', 3600);
        }
      }

      // -- taksi aktif --
      if (taxi.active) {
        const fare = taxi.fare;
        const ev = updateTaxi(taxi, target);
        if (ev === 'pickedUp') hud.toast('Penumpang naik! Antar ke tujuan.');
        else if (ev === 'completed') {
          player.money += fare;
          sfx('pickupCash');
          hud.toast(`Taksi selesai! +$${fare}`);
        }
      }

      // -- cash pickup --
      const cash = collectCashPickup(city, target.x, target.y, 36);
      if (cash > 0) {
        player.money += cash;
        sfx('pickupCash');
        hud.toast(`+$${cash} uang jalanan.`);
      }

      // -- regen HP pelan kalau aman --
      if (playSeconds - player.lastDamageAt > 5 && wanted.level === 0 && player.health > 0) {
        player.health = Math.min(HEALTH_MAX, player.health + 2 * dt);
      }

      // -- autosave berkala --
      if (autosaveTimer >= 20) {
        autosaveTimer = 0;
        saveNow();
      }
    }

    // ---- render (semua state: menu pun menampilkan kota) ----
    const pos = playerPos();
    const marker = missions.status === 'active'
      ? missionMarker(missions)
      : (taxi.active ? taxiMarker(taxi) : missionMarker(missions));
    const cars = driveableCarsForRender(playerCar, traffic, parked);
    if (missions.status === 'active' && missions.targetCar) cars.push(missions.targetCar);
    try {
      if (typeof renderer.setMode === 'function') {
        renderer.setMode(driving ? 'car' : 'foot');
      }
      if (typeof renderer.follow === 'function') renderer.follow(pos, dt);
      renderer.render({
        player: { x: pos.x, y: pos.y, angle: pos.angle },
        cars, police,
        pickups: city.pickups || [],
        missionMarker: marker,
        time: playSeconds,
        showMinimap: true,
      });
    } catch (err) {
      console.error('[Crescent Bay] render gagal:', err);
    }

    // ---- HUD ----
    if (state === 'playing' || state === 'paused') {
      let objective = missionObjectiveText(missions);
      if (taxi.active) {
        objective += ` · 🚕 Taksi: ${taxi.phase === 'pickup' ? 'jemput penumpang' : 'antar ke tujuan'} ($${taxi.fare})`;
      }
      hud.update({
        money: player.money,
        wanted: wanted.level,
        health: player.health,
        healthMax: HEALTH_MAX,
        ammo: player.ammo,
        magSize: MAG,
        reloading: player.reloading,
        district: districtName(pos.x, pos.y),
        objective,
      });
    }
  }

  // ---- debug handle (dipakai playtest; tidak memengaruhi gameplay) ----
  window.__crescentBay = {
    version: GAME_VERSION,
    get state() { return state; },
    debug: {
      pos: () => ({ ...playerPos() }),
      driving: () => driving,
      money: () => player.money,
      health: () => player.health,
      wanted: () => wanted.level,
      missionsDone: () => [...missions.done],
      missionStatus: () => missions.status,
      missionIndex: () => missions.index,
      policeCount: () => police.length,
      hasSave: () => safeHasSave(),
      teleport(x, y) {
        if (driving && playerCar) { playerCar.x = x; playerCar.y = y; playerCar.speed = 0; }
        player.x = x; player.y = y;
      },
      teleportToParked() {
        const free = parked.find((c) => !c.taken);
        if (!free) return null;
        player.x = free.x + 40; player.y = free.y;
        if (driving && playerCar) { playerCar.x = player.x; playerCar.y = player.y; }
        return { x: free.x, y: free.y };
      },
      teleportNearTarget() {
        const m = missionMarker(missions) || taxiMarker(taxi);
        if (!m) return null;
        const x = m.x + 12; const y = m.y + 8;
        if (driving && playerCar) { playerCar.x = x; playerCar.y = y; playerCar.speed = 0; }
        player.x = x; player.y = y;
        return { x: m.x, y: m.y };
      },
      spawnCopOnPlayer() {
        const p = playerPos();
        police.push({ x: p.x + 12, y: p.y, angle: 0, speed: 0, health: 100, ramTimer: 0 });
        return police.length;
      },
      setWanted(n) { wanted.level = clamp(n, 0, 5); wanted.quietSeconds = 0; },
      damage(n) { damagePlayer(n, 'debug'); },
      exitCar() {
        if (driving) { driving = false; if (engineOn) { sfx('stopEngine'); engineOn = false; } }
      },
      aimAtWall() {
        const p = playerPos();
        let best = null; let bestD = Infinity;
        for (const b of city.buildings || []) {
          const cx = b.x + b.w / 2; const cy = b.y + b.h / 2;
          const d = Math.hypot(cx - p.x, cy - p.y);
          if (d < bestD) { bestD = d; best = b; }
        }
        if (!best) return false;
        const spots = [
          { x: best.x - 260, y: best.y + best.h / 2, angle: 0 },
          { x: best.x + best.w + 260, y: best.y + best.h / 2, angle: Math.PI },
          { x: best.x + best.w / 2, y: best.y - 260, angle: Math.PI / 2 },
          { x: best.x + best.w / 2, y: best.y + best.h + 260, angle: -Math.PI / 2 },
        ];
        for (const s of spots) {
          if (typeof circleHitsCollider === 'function' && circleHitsCollider(city, s.x, s.y, 16)) continue;
          if (typeof isInWater === 'function' && isInWater(s.x, s.y)) continue;
          if (!playerCar) playerCar = createPlayerCar(s.x, s.y, s.angle);
          playerCar.x = s.x; playerCar.y = s.y; playerCar.angle = s.angle; playerCar.speed = 0;
          player.x = s.x; player.y = s.y; player.angle = s.angle;
          driving = true;
          if (!engineOn) { sfx('startEngine'); engineOn = true; }
          return true;
        }
        return false;
      },
    },
  };

  // ---- loop --------------------------------------------------------------
  window.addEventListener('resize', () => {
    try { if (typeof renderer.resize === 'function') renderer.resize(); } catch { /* abaikan */ }
  });
  try { if (typeof renderer.resize === 'function') renderer.resize(); } catch { /* abaikan */ }

  resetWorld(true);
  hud.showMenu({ hasSave: safeHasSave(), onNewGame: newGame, onContinue: continueGame });
  hud.update({
    money: player.money, wanted: 0, health: player.health,
    healthMax: HEALTH_MAX, ammo: player.ammo, magSize: MAG,
    reloading: false, district: 'Crescent Bay',
    objective: 'Pilih New Game untuk mulai.',
  });

  let last = performance.now();
  let readyFlagged = false;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000 || 0.016));
    last = now;
    try { tick(dt, now / 1000); } catch (err) { console.error('[Crescent Bay] tick gagal:', err); }
    try { if (typeof input.endFrame === 'function') input.endFrame(); } catch { /* abaikan */ }
    if (!readyFlagged) {
      readyFlagged = true;
      window.__cbReady = true;
    }
  }
  requestAnimationFrame(frame);
}
