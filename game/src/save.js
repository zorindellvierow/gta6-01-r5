// Crescent Bay — save.js
// Simpan/muat localStorage. Data save berbentuk objek polos; setiap muat
// divalidasi — data rusak atau dari versi lama ditolak dan mengembalikan null
// supaya game mulai baru daripada crash.

import { SAVE_KEY, GAME_VERSION } from './config.js';

export const SAVE_VERSION = 1;

export function defaultSave() {
  return {
    version: SAVE_VERSION,
    gameVersion: GAME_VERSION,
    money: 50,
    missionsDone: [],
    player: { x: 1000, y: 900, angle: -Math.PI / 2 },
    wanted: 0,
    playSeconds: 0,
    muted: false,
    savedAt: Date.now(),
  };
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

// Validasi ketat: kembalikan objek save bersih, atau null kalau rusak.
export function validateSave(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (data.version !== SAVE_VERSION) return null;
  if (!isFiniteNumber(data.money) || data.money < 0 || data.money > 100000000) return null;
  if (!Array.isArray(data.missionsDone)) return null;
  for (let i = 0; i < data.missionsDone.length; i += 1) {
    if (!isFiniteNumber(data.missionsDone[i]) || data.missionsDone[i] < 0) return null;
  }
  if (!data.player || typeof data.player !== 'object') return null;
  if (!isFiniteNumber(data.player.x) || !isFiniteNumber(data.player.y)) return null;
  if (data.player.x < 0 || data.player.x > 2400 || data.player.y < 0 || data.player.y > 1800) return null;
  if (!isFiniteNumber(data.wanted) || data.wanted < 0 || data.wanted > 5) return null;
  if (!isFiniteNumber(data.playSeconds) || data.playSeconds < 0) return null;
  return {
    version: SAVE_VERSION,
    gameVersion: typeof data.gameVersion === 'string' ? data.gameVersion : GAME_VERSION,
    money: Math.floor(data.money),
    missionsDone: data.missionsDone.slice(),
    player: {
      x: data.player.x,
      y: data.player.y,
      angle: isFiniteNumber(data.player.angle) ? data.player.angle : 0,
    },
    wanted: Math.floor(data.wanted),
    playSeconds: Math.floor(data.playSeconds),
    muted: data.muted === true,
    savedAt: isFiniteNumber(data.savedAt) ? data.savedAt : Date.now(),
  };
}

export function saveGame(state) {
  if (typeof localStorage === 'undefined') return false;
  try {
    const data = {
      version: SAVE_VERSION,
      gameVersion: GAME_VERSION,
      money: state.money || 0,
      missionsDone: (state.missionsDone || []).slice(),
      player: {
        x: state.player ? state.player.x : 1000,
        y: state.player ? state.player.y : 900,
        angle: state.player ? (state.player.angle || 0) : 0,
      },
      wanted: state.wanted || 0,
      playSeconds: state.playSeconds || 0,
      muted: state.muted === true,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return validateSave(parsed);
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.removeItem(SAVE_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export default saveGame;
