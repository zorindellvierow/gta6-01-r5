// Crescent Bay — input.js
// State keyboard + mouse. Tanpa dependensi modul game lain.
// Bedakan "held" (tombol sedang ditekan) dan "pressed" (baru ditekan sekali
// pada frame ini). Panggil endFrame() sekali tiap akhir frame game.

export const KEYS = {
  UP: ['KeyW', 'ArrowUp'],
  DOWN: ['KeyS', 'ArrowDown'],
  LEFT: ['KeyA', 'ArrowLeft'],
  RIGHT: ['KeyD', 'ArrowRight'],
  RUN: ['ShiftLeft', 'ShiftRight'],
  INTERACT: ['KeyE'],
  HANDBRAKE: ['Space'],
  FIRE: ['KeyF'],
  RELOAD: ['KeyR'],
  MUTE: ['KeyM'],
  PAUSE: ['Escape'],
};

export const ALL_CODES = [
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ShiftRight', 'KeyE', 'Space',
  'KeyF', 'KeyR', 'KeyM', 'Escape', 'Enter',
];

export class GameInput {
  constructor() {
    this.held = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.enabled = true;
    this.onPause = null;
    this.onMute = null;
    this._onKeyDown = (event) => this._handleKeyDown(event);
    this._onKeyUp = (event) => this._handleKeyUp(event);
    this._onMouseMove = (event) => this._handleMouseMove(event);
    this._onMouseDown = (event) => this._handleMouseDown(event);
    this._onMouseUp = () => { this.mouseDown = false; };
    this._onBlur = () => { this.held.clear(); this.mouseDown = false; };
    this._attached = false;
  }

  attach(target) {
    if (this._attached) return;
    const root = target || (typeof window !== 'undefined' ? window : null);
    if (!root || !root.addEventListener) return;
    root.addEventListener('keydown', this._onKeyDown);
    root.addEventListener('keyup', this._onKeyUp);
    root.addEventListener('mousemove', this._onMouseMove);
    root.addEventListener('mousedown', this._onMouseDown);
    root.addEventListener('mouseup', this._onMouseUp);
    root.addEventListener('blur', this._onBlur);
    this._attached = true;
  }

  detach() {
    if (!this._attached) return;
    const root = typeof window !== 'undefined' ? window : null;
    if (root && root.removeEventListener) {
      root.removeEventListener('keydown', this._onKeyDown);
      root.removeEventListener('keyup', this._onKeyUp);
      root.removeEventListener('mousemove', this._onMouseMove);
      root.removeEventListener('mousedown', this._onMouseDown);
      root.removeEventListener('mouseup', this._onMouseUp);
      root.removeEventListener('blur', this._onBlur);
    }
    this._attached = false;
  }

  _handleKeyDown(event) {
    if (!this.enabled) return;
    const code = event.code;
    if (code === 'Space' || code.startsWith('Arrow')) {
      if (event.preventDefault) event.preventDefault();
    }
    if (!event.repeat) this.pressed.add(code);
    this.held.add(code);
    if (code === 'Escape' && !event.repeat && typeof this.onPause === 'function') this.onPause();
    if (code === 'KeyM' && !event.repeat && typeof this.onMute === 'function') this.onMute();
  }

  _handleKeyUp(event) {
    this.held.delete(event.code);
  }

  _handleMouseMove(event) {
    this.mouseX = event.clientX || 0;
    this.mouseY = event.clientY || 0;
  }

  _handleMouseDown(event) {
    this.mouseDown = true;
    this.mouseClicked = true;
    this.mouseX = event.clientX || 0;
    this.mouseY = event.clientY || 0;
  }

  isDown(code) {
    return this.held.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  isActionDown(action) {
    const codes = KEYS[action] || [];
    return codes.some((code) => this.held.has(code));
  }

  wasActionPressed(action) {
    const codes = KEYS[action] || [];
    return codes.some((code) => this.pressed.has(code));
  }

  // Sumbu gerak -1..1 dari WASD/panah. y positif = ke bawah layar.
  moveAxis() {
    let x = 0;
    let y = 0;
    if (this.isActionDown('LEFT')) x -= 1;
    if (this.isActionDown('RIGHT')) x += 1;
    if (this.isActionDown('UP')) y -= 1;
    if (this.isActionDown('DOWN')) y += 1;
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  }

  // Dipanggil sekali di akhir tiap frame: pressed hanya hidup satu frame.
  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
  }

  clear() {
    this.held.clear();
    this.pressed.clear();
    this.mouseDown = false;
    this.mouseClicked = false;
  }
}

export function createInput() {
  return new GameInput();
}

export default GameInput;
