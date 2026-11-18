// Keyboard + mouse input. Held keys are polled each frame; presses are
// edge-triggered and cleared once per frame so nothing is double-counted.
const HELD = new Set();
const PRESSED = new Set();
let mouseX = 0;
let mouseY = 0;
let mouseDown = false;
let mouseClicked = false;
let attached = false;

function keyName(e) {
  return e.key.length === 1 ? e.key.toLowerCase() : e.key;
}

function onKeyDown(e) {
  const k = keyName(e);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }
  if (!HELD.has(k)) PRESSED.add(k);
  HELD.add(k);
}

function onKeyUp(e) {
  HELD.delete(keyName(e));
}

function onMouseMove(e) {
  mouseX = e.clientX;
  mouseY = e.clientY;
}

function onMouseDown(e) {
  mouseDown = true;
  mouseClicked = true;
  mouseX = e.clientX;
  mouseY = e.clientY;
}

function onMouseUp() {
  mouseDown = false;
}

export function attachInput(canvas) {
  if (attached) return;
  attached = true;
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => {
    HELD.clear();
  });
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
}

export function isDown(...keys) {
  return keys.some((k) => HELD.has(k));
}

// True once, in the frame right after the key went down.
export function wasPressed(...keys) {
  return keys.some((k) => PRESSED.has(k));
}

export function endFrameInput() {
  PRESSED.clear();
  mouseClicked = false;
}

export function getMouse() {
  return { x: mouseX, y: mouseY, down: mouseDown, clicked: mouseClicked };
}
