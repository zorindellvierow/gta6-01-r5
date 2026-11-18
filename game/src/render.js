// Crescent Bay — render.js
// Renderer Canvas 2D top-down (gaya GTA klasik), tanpa dependensi eksternal.
// CATATAN: brief minta Three.js "kalau ada di vendor/" — vendor/ repo ini hanya
// berisi makefun-game.ts, tidak ada three.js, dan game wajib jalan offline
// tanpa network. Jadi renderer ini memakai Canvas 2D murni: tanpa library,
// tanpa unduhan, dan 100% kode ditulis untuk game ini. Kalau koordinator
// nanti mem-vendor three.js, modul ini yang diganti — API createRenderer
// dan state yang diterima render() dibuat stabil supaya main.js tidak berubah.

import { VIEW, COLORS, DISTRICTS, BAY } from './config.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createRenderer(canvas, city) {
  const ctx = canvas.getContext('2d');
  const renderer = {
    canvas,
    ctx,
    city,
    camera: { x: city.spawns.player.x, y: city.spawns.player.y, zoom: VIEW.CAMERA_ZOOM_FOOT },
    mode: 'foot', // 'foot' | 'car'
    width: 0,
    height: 0,
    dpr: 1,
    night: false,

    resize() {
      const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      this.dpr = dpr;
      this.width = canvas.clientWidth || canvas.width || 800;
      this.height = canvas.clientHeight || canvas.height || 600;
      canvas.width = Math.floor(this.width * dpr);
      canvas.height = Math.floor(this.height * dpr);
    },

    setMode(mode) {
      this.mode = mode === 'car' ? 'car' : 'foot';
      this.camera.zoom = this.mode === 'car' ? VIEW.CAMERA_ZOOM_CAR : VIEW.CAMERA_ZOOM_FOOT;
    },

    // Ikuti target dengan smoothing; dt dalam detik.
    follow(target, dt) {
      const t = clamp(VIEW.CAMERA_SMOOTH * dt, 0, 1);
      this.camera.x += (target.x - this.camera.x) * t;
      this.camera.y += (target.y - this.camera.y) * t;
    },

    worldToScreen(wx, wy) {
      const z = this.camera.zoom;
      return {
        x: (wx - this.camera.x) * z + this.width / 2,
        y: (wy - this.camera.y) * z + this.height / 2,
      };
    },

    screenToWorld(sx, sy) {
      const z = this.camera.zoom;
      return {
        x: (sx - this.width / 2) / z + this.camera.x,
        y: (sy - this.height / 2) / z + this.camera.y,
      };
    },

    // Culling sederhana: hanya gambar kotak yang bersinggungan dengan layar.
    isVisible(x, y, w, h) {
      const topLeft = this.screenToWorld(0, 0);
      const bottomRight = this.screenToWorld(this.width, this.height);
      return x + w >= topLeft.x && x <= bottomRight.x
        && y + h >= topLeft.y && y <= bottomRight.y;
    },

    render(state) {
      const { ctx } = this;
      const z = this.camera.zoom;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this._drawSky();
      ctx.save();
      ctx.translate(this.width / 2, this.height / 2);
      ctx.scale(z, z);
      ctx.translate(-this.camera.x, -this.camera.y);
      this._drawGround();
      this._drawRoads();
      this._drawDocks();
      this._drawBuildings();
      this._drawPalms();
      this._drawPickups(state);
      this._drawCars(state);
      this._drawPlayer(state);
      this._drawPolice(state);
      this._drawMissionMarker(state);
      ctx.restore();
      this._drawFog();
      if (this.night) this._drawNightTint();
      if (state && state.showMinimap !== false) this.drawMinimap(state);
    },

    _drawSky() {
      const { ctx } = this;
      const grad = ctx.createLinearGradient(0, 0, 0, this.height);
      grad.addColorStop(0, COLORS.SKY_TOP);
      grad.addColorStop(1, COLORS.SKY_BOTTOM);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);
    },

    _drawGround() {
      const { ctx, city } = this;
      ctx.fillStyle = '#6b6f66';
      ctx.fillRect(0, 0, city.width, city.height);
      // Teluk: elips air + pantai pasir di tepinya.
      ctx.fillStyle = COLORS.SAND;
      ctx.beginPath();
      ctx.ellipse(BAY.CENTER_X, BAY.CENTER_Y, BAY.RADIUS_X + BAY.SAND_WIDTH, BAY.RADIUS_Y + BAY.SAND_WIDTH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.WATER;
      ctx.beginPath();
      ctx.ellipse(BAY.CENTER_X, BAY.CENTER_Y, BAY.RADIUS_X, BAY.RADIUS_Y, 0, 0, Math.PI * 2);
      ctx.fill();
      // Warna dasar tiap distrik (blok tanah).
      const keys = Object.keys(DISTRICTS);
      for (let i = 0; i < keys.length; i += 1) {
        const d = DISTRICTS[keys[i]];
        ctx.fillStyle = d.ground;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(d.bounds.x, d.bounds.y, d.bounds.w, d.bounds.h);
      }
      ctx.globalAlpha = 1;
    },

    _drawRoads() {
      const { ctx, city } = this;
      for (let i = 0; i < city.roads.length; i += 1) {
        const r = city.roads[i];
        if (!this.isVisible(r.x, r.y, r.w, r.h)) continue;
        ctx.fillStyle = r.main ? COLORS.ROAD : '#2c2f34';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        if (r.main) {
          ctx.strokeStyle = COLORS.ROAD_LINE;
          ctx.lineWidth = 2;
          ctx.setLineDash([18, 18]);
          ctx.beginPath();
          if (r.vertical) {
            ctx.moveTo(r.x + r.w / 2, r.y);
            ctx.lineTo(r.x + r.w / 2, r.y + r.h);
          } else {
            ctx.moveTo(r.x, r.y + r.h / 2);
            ctx.lineTo(r.x + r.w, r.y + r.h / 2);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    },

    _drawDocks() {
      const { ctx, city } = this;
      for (let i = 0; i < city.docks.length; i += 1) {
        const d = city.docks[i];
        if (!this.isVisible(d.x, d.y, d.w, d.h)) continue;
        ctx.fillStyle = '#8a6d4b';
        ctx.fillRect(d.x, d.y, d.w, d.h);
        ctx.strokeStyle = '#6b5238';
        ctx.lineWidth = 2;
        ctx.strokeRect(d.x, d.y, d.w, d.h);
      }
      for (let i = 0; i < city.boats.length; i += 1) {
        const b = city.boats[i];
        if (!this.isVisible(b.x, b.y, b.w, b.h)) continue;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    _drawBuildings() {
      const { ctx, city } = this;
      for (let i = 0; i < city.buildings.length; i += 1) {
        const b = city.buildings[i];
        if (!this.isVisible(b.x - 30, b.y - 30, b.w + 60, b.h + 60)) continue;
        // Bayangan tinggi: offset mengikuti jumlah lantai.
        const shade = Math.min(26, b.floors * 3);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.fillRect(b.x + shade, b.y + shade, b.w, b.h);
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        // Jendela: titik-titik kecil, sebagian menyala.
        const cols = Math.max(1, Math.floor(b.w / 14));
        const rows = Math.max(1, Math.floor(b.h / 14));
        for (let cx = 0; cx < cols; cx += 1) {
          for (let cy = 0; cy < rows; cy += 1) {
            const lit = b.windowLit && ((cx * 7 + cy * 3 + b.id) % 3 === 0);
            ctx.fillStyle = lit ? '#ffe66d' : 'rgba(20, 30, 45, 0.55)';
            ctx.fillRect(b.x + 5 + cx * 14, b.y + 5 + cy * 14, 6, 6);
          }
        }
      }
    },

    _drawPalms() {
      const { ctx, city } = this;
      for (let i = 0; i < city.palms.length; i += 1) {
        const p = city.palms[i];
        if (!this.isVisible(p.x - 20, p.y - 20, 40, 40)) continue;
        ctx.strokeStyle = '#7a5a3a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.lean * 14, p.y - 12 * p.size);
        ctx.stroke();
        ctx.fillStyle = '#3f8f4f';
        ctx.beginPath();
        ctx.arc(p.x + p.lean * 14, p.y - 12 * p.size, 9 * p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    _drawPickups(state) {
      const { ctx, city } = this;
      if (!state || !state.pickups) return;
      for (let i = 0; i < state.pickups.length; i += 1) {
        const p = state.pickups[i];
        if (p.taken) continue;
        if (!this.isVisible(p.x - 16, p.y - 16, 32, 32)) continue;
        ctx.fillStyle = '#2ecc71';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', p.x, p.y + 1);
      }
    },

    _drawCars(state) {
      const { ctx } = this;
      if (!state || !state.cars) return;
      for (let i = 0; i < state.cars.length; i += 1) {
        const car = state.cars[i];
        if (!this.isVisible(car.x - 40, car.y - 40, 80, 80)) continue;
        ctx.save();
        ctx.translate(car.x, car.y);
        ctx.rotate(car.angle || 0);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(-20, -9, 44, 22);
        ctx.fillStyle = car.color || '#c0392b';
        ctx.fillRect(-22, -11, 44, 22);
        ctx.fillStyle = '#bcd6e8';
        ctx.fillRect(-6, -9, 14, 18);
        ctx.restore();
      }
    },

    _drawPlayer(state) {
      const { ctx } = this;
      if (!state || !state.player) return;
      const p = state.player;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle || 0);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.arc(2, 3, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.PLAYER;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(4, -3, 8, 6);
      ctx.restore();
    },

    _drawPolice(state) {
      const { ctx } = this;
      if (!state || !state.police) return;
      for (let i = 0; i < state.police.length; i += 1) {
        const cop = state.police[i];
        if (!this.isVisible(cop.x - 40, cop.y - 40, 80, 80)) continue;
        ctx.save();
        ctx.translate(cop.x, cop.y);
        ctx.rotate(cop.angle || 0);
        ctx.fillStyle = COLORS.POLICE;
        ctx.fillRect(-22, -11, 44, 22);
        ctx.fillStyle = (Math.floor((state.time || 0) * 4) % 2 === 0) ? '#ff3b30' : '#3b82ff';
        ctx.fillRect(-4, -11, 8, 22);
        ctx.restore();
      }
    },

    _drawMissionMarker(state) {
      const { ctx } = this;
      if (!state || !state.missionMarker) return;
      const m = state.missionMarker;
      if (!this.isVisible(m.x - 30, m.y - 30, 60, 60)) return;
      const pulse = 14 + Math.sin((state.time || 0) * 4) * 4;
      ctx.strokeStyle = COLORS.MISSION_MARKER;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(m.x, m.y, pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = COLORS.MISSION_MARKER;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 5, 0, Math.PI * 2);
      ctx.fill();
    },

    // Kabut: gelapkan tepi layar di luar radius pandang.
    _drawFog() {
      const { ctx } = this;
      const radius = VIEW.FOG_DISTANCE * this.camera.zoom;
      const grad = ctx.createRadialGradient(
        this.width / 2, this.height / 2, radius * 0.45,
        this.width / 2, this.height / 2, radius,
      );
      grad.addColorStop(0, 'rgba(20, 30, 50, 0)');
      grad.addColorStop(1, 'rgba(20, 30, 50, 0.45)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);
    },

    _drawNightTint() {
      const { ctx } = this;
      ctx.fillStyle = COLORS.NIGHT_TINT;
      ctx.fillRect(0, 0, this.width, this.height);
    },

    drawMinimap(state) {
      const { ctx, city } = this;
      const size = VIEW.MINIMAP_SIZE;
      const scale = size / city.width;
      const mx = this.width - size - 12;
      const my = 12;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#10141c';
      ctx.fillRect(mx - 4, my - 4, size + 8, size + 8);
      ctx.fillStyle = '#20242e';
      ctx.fillRect(mx, my, size, city.height * scale);
      // Air teluk di minimap.
      ctx.fillStyle = COLORS.WATER;
      ctx.beginPath();
      ctx.ellipse(
        mx + BAY.CENTER_X * scale, my + BAY.CENTER_Y * scale,
        BAY.RADIUS_X * scale, BAY.RADIUS_Y * scale, 0, 0, Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = '#5a5f6b';
      for (let i = 0; i < city.buildings.length; i += 1) {
        const b = city.buildings[i];
        ctx.fillRect(mx + b.x * scale, my + b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
      }
      if (state && state.missionMarker) {
        ctx.fillStyle = COLORS.MISSION_MARKER;
        ctx.beginPath();
        ctx.arc(mx + state.missionMarker.x * scale, my + state.missionMarker.y * scale, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (state && state.player) {
        ctx.fillStyle = COLORS.PLAYER;
        ctx.beginPath();
        ctx.arc(mx + state.player.x * scale, my + state.player.y * scale, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  };

  renderer.resize();
  return renderer;
}

export function createSkyGradient(ctx, width, height) {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, COLORS.SKY_TOP);
  grad.addColorStop(1, COLORS.SKY_BOTTOM);
  return grad;
}

export default createRenderer;
