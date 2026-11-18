// Crescent Bay — hud.js (fresh, round 5)
// HUD DOM overlay di atas canvas: uang, bintang wanted, health, ammo,
// objektif misi + jarak, pesan sementara (toast), layar menu / pause / akhir.
// Tanpa dependensi; semua elemen dibuat di sini, gaya inline.
import { GAME_TITLE, GAME_VERSION } from './config.js';

const TITLE = typeof GAME_TITLE === 'string' ? GAME_TITLE : 'Crescent Bay';
const VERSION = typeof GAME_VERSION === 'string' ? GAME_VERSION : '0.5.0';

const CSS = `
#cb-hud { position: fixed; inset: 0; pointer-events: none; z-index: 10;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #f2f4f8; }
#cb-hud .cb-top { position: absolute; top: 12px; left: 14px; right: 14px;
  display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
#cb-hud .cb-panel { background: rgba(10,14,22,.72); border: 1px solid rgba(255,255,255,.16);
  border-radius: 10px; padding: 8px 12px; backdrop-filter: blur(2px); }
#cb-hud .cb-money { font-size: 22px; font-weight: 800; color: #7ee787; letter-spacing: .5px; }
#cb-hud .cb-sub { font-size: 12px; color: #c6cdd8; margin-top: 2px; }
#cb-hud .cb-stars { font-size: 24px; letter-spacing: 3px; color: #ffd23e;
  text-shadow: 0 1px 4px rgba(0,0,0,.7); }
#cb-hud .cb-right { text-align: right; }
#cb-hud .cb-bar { width: 170px; height: 12px; background: rgba(255,255,255,.16);
  border-radius: 6px; overflow: hidden; margin-top: 6px; }
#cb-hud .cb-bar > div { height: 100%; background: #e5484d; transition: width .15s linear; }
#cb-hud .cb-ammo { font-size: 14px; font-weight: 700; margin-top: 6px; color: #ffd9a0; }
#cb-hud .cb-objective { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%);
  max-width: 82vw; text-align: center; font-size: 14px; line-height: 1.45; }
#cb-hud .cb-toast { position: absolute; left: 50%; top: 76px; transform: translateX(-50%);
  font-size: 15px; font-weight: 600; background: rgba(10,14,22,.82); border: 1px solid rgba(255,255,255,.2);
  padding: 8px 16px; border-radius: 999px; opacity: 0; transition: opacity .2s; white-space: nowrap;
  max-width: 90vw; overflow: hidden; text-overflow: ellipsis; }
#cb-hud .cb-toast.on { opacity: 1; }
#cb-hud .cb-screen { position: absolute; inset: 0; display: flex; align-items: center;
  justify-content: center; background: rgba(6,10,18,.72); pointer-events: auto; }
#cb-hud .cb-card { background: rgba(14,20,32,.96); border: 1px solid rgba(255,255,255,.18);
  border-radius: 16px; padding: 28px 34px; max-width: 560px; width: min(92vw, 560px);
  text-align: center; box-shadow: 0 18px 60px rgba(0,0,0,.6); }
#cb-hud .cb-card h1 { margin: 0 0 4px; font-size: 42px; letter-spacing: 2px; color: #ffd23e; }
#cb-hud .cb-card h2 { margin: 0 0 10px; font-size: 30px; letter-spacing: 1px; }
#cb-hud .cb-card p { margin: 6px 0; font-size: 15px; line-height: 1.55; color: #d6dce6; }
#cb-hud .cb-card .cb-tag { font-size: 12px; letter-spacing: 3px; color: #8fb8ff; text-transform: uppercase; }
#cb-hud .cb-btns { margin-top: 18px; display: flex; flex-direction: column; gap: 10px; align-items: center; }
#cb-hud button { pointer-events: auto; cursor: pointer; font-size: 16px; font-weight: 700;
  padding: 11px 26px; min-width: 240px; border-radius: 10px; border: 1px solid rgba(255,255,255,.25);
  background: #2b6cb0; color: #fff; }
#cb-hud button:hover { background: #3182ce; }
#cb-hud button.cb-ghost { background: transparent; }
#cb-hud button:disabled { opacity: .45; cursor: default; }
#cb-hud .cb-controls { font-size: 13px; color: #aab4c4; text-align: left; margin: 14px auto 0;
  display: inline-block; line-height: 1.7; }
#cb-hud .cb-stats { font-size: 14px; line-height: 1.8; color: #d6dce6; margin-top: 8px; }
#cb-hud .hidden { display: none !important; }
`;

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}

export function createHud() {
  const root = el('div');
  root.id = 'cb-hud';
  const style = document.createElement('style');
  style.textContent = CSS;
  root.appendChild(style);

  // Bar atas: uang (kiri), wanted + health + ammo (kanan).
  const top = el('div', 'cb-top');
  const left = el('div', 'cb-panel');
  const moneyEl = el('div', 'cb-money', '$50');
  const districtEl = el('div', 'cb-sub', 'Crescent Bay');
  left.append(moneyEl, districtEl);
  const right = el('div', 'cb-panel cb-right');
  const starsEl = el('div', 'cb-stars', '☆☆☆☆☆');
  const barWrap = el('div', 'cb-bar');
  const barFill = el('div');
  barWrap.appendChild(barFill);
  const ammoEl = el('div', 'cb-ammo', '🔫 12 / 12');
  right.append(starsEl, barWrap, ammoEl);
  top.append(left, right);
  root.appendChild(top);

  const toastEl = el('div', 'cb-toast');
  root.appendChild(toastEl);
  const objectiveEl = el('div', 'cb-panel cb-objective', '');
  root.appendChild(objectiveEl);

  // Layar menu / pause / akhir (dibuat sekali, ditampilkan bergantian).
  const menuScreen = el('div', 'cb-screen');
  const menuCard = el('div', 'cb-card');
  menuCard.innerHTML = `
    <div class="cb-tag">GTA 6 &middot; Open World &middot; Top-Down</div>
    <h1>${TITLE}</h1>
    <p>Teluk Crescent, kota yang tidak pernah tidur. Kamu <b>Rook</b> —
    kerja untuk <b>Selin</b>, kabur dari polisi, dan kuasai jalanan.</p>
    <div class="cb-controls">
      <b>WASD / Panah</b> jalan &amp; mengemudi &nbsp;·&nbsp; <b>Shift</b> lari<br>
      <b>E</b> masuk / keluar mobil &middot; curi mobil parkir<br>
      <b>F</b> tembak &nbsp;·&nbsp; <b>R</b> isi ulang &nbsp;·&nbsp; <b>Spasi</b> rem tangan<br>
      <b>T</b> order taksi &nbsp;·&nbsp; <b>M</b> bisu &nbsp;·&nbsp; <b>Esc</b> jeda
    </div>
    <div class="cb-btns"></div>
    <p class="cb-sub" style="margin-top:14px">v${VERSION} &middot; progres tersimpan otomatis</p>`;
  const menuBtns = menuCard.querySelector('.cb-btns');
  const btnNew = el('button', '', '▶ &nbsp;New Game');
  const btnContinue = el('button', 'cb-ghost', '↻ &nbsp;Continue');
  menuBtns.append(btnNew, btnContinue);
  menuScreen.appendChild(menuCard);
  root.appendChild(menuScreen);

  const pauseScreen = el('div', 'cb-screen hidden');
  const pauseCard = el('div', 'cb-card');
  pauseCard.innerHTML = `<h2>JEDA</h2><p>Istirahat sebentar, Rook. Kota menunggumu.</p><div class="cb-btns"></div>`;
  const pauseBtns = pauseCard.querySelector('.cb-btns');
  const btnResume = el('button', '', '▶ &nbsp;Lanjut Main');
  const btnPauseMenu = el('button', 'cb-ghost', 'Menu Utama');
  pauseBtns.append(btnResume, btnPauseMenu);
  pauseScreen.appendChild(pauseCard);
  root.appendChild(pauseScreen);

  const endScreen = el('div', 'cb-screen hidden');
  const endCard = el('div', 'cb-card');
  const endTitle = el('h2', '', 'BUSTED');
  const endText = el('p', '', '');
  const endStats = el('div', 'cb-stats', '');
  const endBtns = el('div', 'cb-btns');
  const btnRetry = el('button', '', '↻ &nbsp;Coba Lagi');
  const btnEndMenu = el('button', 'cb-ghost', 'Menu Utama');
  endBtns.append(btnRetry, btnEndMenu);
  endCard.append(endTitle, endText, endStats, endBtns);
  endScreen.appendChild(endCard);
  root.appendChild(endScreen);

  document.body.appendChild(root);

  let toastTimer = 0;
  let last = { money: null, wanted: null, health: null, ammo: null, objective: null, district: null };

  const hud = {
    root,
    setMoney(n) {
      if (n === last.money) return;
      last.money = n;
      moneyEl.textContent = `$${Math.round(n).toLocaleString('en-US')}`;
    },
    setWanted(level) {
      if (level === last.wanted) return;
      last.wanted = level;
      starsEl.textContent = '★'.repeat(level) + '☆'.repeat(Math.max(0, 5 - level));
    },
    setHealth(hp, max = 100) {
      const pct = Math.max(0, Math.min(100, Math.round((hp / max) * 100)));
      if (pct === last.health) return;
      last.health = pct;
      barFill.style.width = `${pct}%`;
      barFill.style.background = pct > 50 ? '#e5484d' : pct > 25 ? '#e8a13b' : '#e5484d';
    },
    setAmmo(mag, magSize = 12, reloading = false) {
      const text = reloading ? '… isi ulang …' : `🔫 ${mag} / ${magSize}`;
      if (text === last.ammo) return;
      last.ammo = text;
      ammoEl.textContent = text;
    },
    setDistrict(name) {
      if (name === last.district) return;
      last.district = name;
      districtEl.textContent = name || 'Crescent Bay';
    },
    setObjective(text) {
      if (text === last.objective) return;
      last.objective = text;
      objectiveEl.textContent = text || '';
      objectiveEl.classList.toggle('hidden', !text);
    },
    toast(msg, ms = 2600) {
      toastEl.textContent = msg;
      toastEl.classList.add('on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove('on'), ms);
    },
    showMenu({ hasSave = false, onNewGame, onContinue } = {}) {
      menuScreen.classList.remove('hidden');
      pauseScreen.classList.add('hidden');
      endScreen.classList.add('hidden');
      btnContinue.disabled = !hasSave;
      btnNew.onclick = () => { if (onNewGame) onNewGame(); };
      btnContinue.onclick = () => { if (hasSave && onContinue) onContinue(); };
    },
    showPause({ onResume, onMenu } = {}) {
      pauseScreen.classList.remove('hidden');
      menuScreen.classList.add('hidden');
      endScreen.classList.add('hidden');
      btnResume.onclick = () => { if (onResume) onResume(); };
      btnPauseMenu.onclick = () => { if (onMenu) onMenu(); };
    },
    showEnd({ kind = 'busted', title, text, stats = [], onRetry, onMenu } = {}) {
      const titles = {
        busted: 'BUSTED',
        wasted: 'WASTED',
        complete: 'MISI SELESAI',
        allDone: 'SEMUA MISI SELESAI',
      };
      const texts = {
        busted: 'Polisi menangkapmu. Uangmu dipotong 20% sebagai denda.',
        wasted: 'Kamu tumbang. Uangmu dipotong 20% untuk biaya rumah sakit.',
        complete: 'Misi selesai. Selin mentransfer hadiahmu.',
        allDone: 'Semua misi Selin selesai. Crescent Bay milikmu, Rook.',
      };
      endTitle.textContent = title || titles[kind] || 'SELESAI';
      endText.textContent = text || texts[kind] || '';
      endStats.innerHTML = stats.map((s) => `<div>${s}</div>`).join('');
      btnRetry.innerHTML = kind === 'allDone' ? '↻ &nbsp;Main Lagi (Free Roam)' : '↻ &nbsp;Coba Lagi';
      endScreen.classList.remove('hidden');
      menuScreen.classList.add('hidden');
      pauseScreen.classList.add('hidden');
      btnRetry.onclick = () => { if (onRetry) onRetry(); };
      btnEndMenu.onclick = () => { if (onMenu) onMenu(); };
    },
    hideScreens() {
      menuScreen.classList.add('hidden');
      pauseScreen.classList.add('hidden');
      endScreen.classList.add('hidden');
    },
    /** Terapkan snapshot state sekaligus (dipakai tiap frame). */
    update(s) {
      if (!s) return;
      if (typeof s.money === 'number') hud.setMoney(s.money);
      if (typeof s.wanted === 'number') hud.setWanted(s.wanted);
      if (typeof s.health === 'number') hud.setHealth(s.health, s.healthMax || 100);
      if (typeof s.ammo === 'number') hud.setAmmo(s.ammo, s.magSize || 12, !!s.reloading);
      if (typeof s.district === 'string') hud.setDistrict(s.district);
      if (typeof s.objective === 'string') hud.setObjective(s.objective);
    },
  };
  return hud;
}
