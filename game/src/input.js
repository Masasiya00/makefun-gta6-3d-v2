// SOLMAR BAY 3D — keyboard and mouse input.
// Tracks held keys, edge-triggered presses, and pointer-lock mouse look.
// The sim reads `keys` and consumes `pressed` once per fixed step.
export const keys = Object.create(null);
export const pressed = Object.create(null);
export const mouse = { dx: 0, dy: 0, locked: false, down: false, clicked: false };

export function initInput(canvas, onPause, onAnyKey) {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    keys[k] = true; pressed[k] = true;
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) e.preventDefault();
    if (e.key === 'Escape' && onPause) onPause();
    if (onAnyKey) onAnyKey();
  });
  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });
  window.addEventListener('blur', () => { for (const k of Object.keys(keys)) keys[k] = false; });
  canvas.addEventListener('mousedown', (e) => {
    mouse.down = true; mouse.clicked = true;
    if (!mouse.locked && document.pointerLockElement !== canvas) {
      try { canvas.requestPointerLock(); } catch (_) { /* pointer lock unavailable */ }
    }
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  document.addEventListener('pointerlockchange', () => {
    mouse.locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (mouse.locked) { mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0; }
  });
}

export function consumePress(k) {
  if (pressed[k]) { pressed[k] = false; return true; }
  return false;
}

export function clearPresses() {
  for (const k of Object.keys(pressed)) pressed[k] = false;
  mouse.dx = 0; mouse.dy = 0; mouse.clicked = false;
}
