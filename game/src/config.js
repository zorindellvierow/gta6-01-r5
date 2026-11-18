// Crescent Bay — config.js
// Semua konstanta game dalam satu tempat. Tidak ada logika di sini, hanya angka
// dan warna, supaya tuning tidak menyentuh modul lain.

export const GAME_TITLE = 'Crescent Bay';
export const GAME_VERSION = '0.5.0-r5';
export const SAVE_KEY = 'crescent-bay-save-v1';
export const DEFAULT_SEED = 'crescent-bay-1';

// --- Kota: grid jalan di atas peta dunia (satuan: meter game) ---
export const WORLD = {
  WIDTH: 2400,
  HEIGHT: 1800,
  BLOCK: 200, // ukuran satu blok kota (termasuk jalan di tepinya)
  ROAD_WIDTH: 28,
  ALLEY_WIDTH: 12,
  SIDEWALK: 10,
};

// Teluk berbentuk bulan sabit di sisi timur peta: air menempati busur di timur.
export const BAY = {
  CENTER_X: 2650,
  CENTER_Y: 900,
  RADIUS_X: 620,
  RADIUS_Y: 980,
  SAND_WIDTH: 46, // lebar pantai di tepi air
};

// --- Distrik: batas kotak (x, y, w, h) + warna identitas ---
export const DISTRICTS = {
  MARINA: {
    name: 'Marina',
    bounds: { x: 1500, y: 1150, w: 800, h: 600 },
    ground: '#5d6b63',
    road: '#3a3f45',
    accent: '#2f8f9d',
    building: ['#7d8a96', '#5f7484', '#8fa3b0'],
  },
  DOWNTOWN: {
    name: 'Downtown',
    bounds: { x: 700, y: 150, w: 900, h: 800 },
    ground: '#6b6f66',
    road: '#33373d',
    accent: '#e8b23a',
    building: ['#4d5a6e', '#5d6b7d', '#3c4757', '#6e5d4f'],
  },
  BEACHFRONT: {
    name: 'Beachfront',
    bounds: { x: 1650, y: 100, w: 650, h: 1000 },
    ground: '#c2a878',
    road: '#4a4640',
    accent: '#ff9e5e',
    building: ['#e8dcc3', '#d9c49a', '#f2e6c9'],
  },
  HILLS: {
    name: 'Hills',
    bounds: { x: 80, y: 80, w: 560, h: 1640 },
    ground: '#5f7a4e',
    road: '#3d4148',
    accent: '#7fb069',
    building: ['#b08968', '#a98467', '#c9ada7', '#8a7967'],
  },
};

export const DISTRICT_ORDER = ['MARINA', 'DOWNTOWN', 'BEACHFRONT', 'HILLS'];

// --- Pemain jalan kaki ---
export const PLAYER = {
  WALK_SPEED: 150, // meter/detik
  RUN_SPEED: 260, // Shift
  RADIUS: 12,
  HEALTH_MAX: 100,
  START_MONEY: 50,
};

// --- Mobil ---
export const VEHICLE = {
  ACCEL: 420, // meter/detik^2
  BRAKE: 700,
  REVERSE_ACCEL: 260,
  MAX_SPEED: 620,
  MAX_REVERSE: 180,
  TURN_RATE: 2.4, // radian/detik pada kecepatan penuh
  HANDBRAKE_DECEL: 950, // Space
  DRAG: 0.6, // gesekan per detik
  LENGTH: 46,
  WIDTH: 22,
};

// --- Wanted level 0-5 ---
export const WANTED = {
  MAX_LEVEL: 5,
  DECAY_SECONDS: 25, // turun 1 level kalau tidak ada kejahatan
  LEVELS: [
    { level: 0, label: 'Bersih', cops: 0, chaseSpeed: 0 },
    { level: 1, label: 'Dicari', cops: 1, chaseSpeed: 300 },
    { level: 2, label: 'Buronan', cops: 2, chaseSpeed: 340 },
    { level: 3, label: 'Siaga', cops: 3, chaseSpeed: 380 },
    { level: 4, label: 'Pengejaran', cops: 4, chaseSpeed: 430 },
    { level: 5, label: 'Paling Dicari', cops: 6, chaseSpeed: 480 },
  ],
};

// --- Misi & ekonomi (semua harga dalam $) ---
export const MISSIONS = {
  REWARDS: [250, 400, 650, 900, 1400, 2200],
  TIME_LIMIT_SECONDS: 240,
  CONTACT_NAME: 'Selin',
  PROTAGONIST_NAME: 'Rook',
};

export const ECONOMY = {
  CAR_REPAIR: 120,
  PISTOL_PRICE: 350,
  AMMO_PRICE: 40,
  AMMO_PACK: 12,
  HEALTH_PACK_PRICE: 80,
  PICKUP_CASH_MIN: 25,
  PICKUP_CASH_MAX: 120,
};

// --- Senjata ---
export const WEAPON = {
  PISTOL_DAMAGE: 34,
  PISTOL_RANGE: 320,
  PISTOL_MAG: 12,
  RELOAD_SECONDS: 1.4,
  FIRE_COOLDOWN: 0.22,
};

// --- Kamera & jarak pandang ---
export const VIEW = {
  FOG_DISTANCE: 900, // jarak kabut mulai menutup (top-down: radius pandang)
  CAMERA_ZOOM_FOOT: 1.0,
  CAMERA_ZOOM_CAR: 0.72,
  CAMERA_SMOOTH: 6.0, // lerp per detik
  MINIMAP_SIZE: 168, // piksel
  MINIMAP_ZOOM: 0.07,
};

// --- Warna umum ---
export const COLORS = {
  WATER: '#1d6f8e',
  WATER_DEEP: '#145a75',
  SAND: '#d9c49a',
  GRASS: '#5f7a4e',
  ROAD: '#33373d',
  ROAD_LINE: '#d8c95a',
  SIDEWALK_COLOR: '#8d8d84',
  SKY_TOP: '#7ec8e3',
  SKY_BOTTOM: '#f7d9a0',
  NIGHT_TINT: 'rgba(10, 16, 48, 0.35)',
  PLAYER: '#e63946',
  POLICE: '#2456d6',
  MISSION_MARKER: '#ffd60a',
};

export const CONFIG = {
  GAME_TITLE,
  GAME_VERSION,
  SAVE_KEY,
  DEFAULT_SEED,
  WORLD,
  BAY,
  DISTRICTS,
  DISTRICT_ORDER,
  PLAYER,
  VEHICLE,
  WANTED,
  MISSIONS,
  ECONOMY,
  WEAPON,
  VIEW,
  COLORS,
};

export default CONFIG;
