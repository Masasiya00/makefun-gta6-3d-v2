// SOLMAR BAY 3D — the player character on foot.
// A low-poly person (torso, head, limbs) with a walk/run swing animation.
// Sim: WASD movement relative to camera yaw, sprint, jump, punch.
import * as THREE from 'three';
import { boxGeo, mat, mesh } from './world.js';
import { WORLD } from './state.js';

export function buildPlayerMesh(S) {
  const g = new THREE.Group();
  g.name = 'player';
  const shirt = mat(S.player.shirt), pants = mat(S.player.pants);
  const skin = mat(0xd8a878), hair = mat(0x2c1e12);
  const torso = mesh(boxGeo(1.1, 1.3, 0.6), shirt, 0, 1.55, 0); torso.name = 'torso';
  const head = mesh(new THREE.SphereGeometry(0.42, 10, 8), skin, 0, 2.55, 0); head.name = 'head';
  const hairM = mesh(boxGeo(0.85, 0.35, 0.85), hair, 0, 2.85, 0);
  const legL = mesh(boxGeo(0.42, 1.0, 0.45), pants, -0.3, 0.5, 0); legL.name = 'legL';
  const legR = mesh(boxGeo(0.42, 1.0, 0.45), pants, 0.3, 0.5, 0); legR.name = 'legR';
  const armL = mesh(boxGeo(0.34, 1.0, 0.36), shirt, -0.75, 1.55, 0); armL.name = 'armL';
  const armR = mesh(boxGeo(0.34, 1.0, 0.36), shirt, 0.75, 1.55, 0); armR.name = 'armR';
  g.add(torso, head, hairM, legL, legR, armL, armR);
  g.userData.parts = { torso, head, legL, legR, armL, armR, shirt, pants };
  return g;
}

export function refreshOutfit(meshGroup, S) {
  const p = meshGroup.userData.parts;
  if (!p) return;
  p.shirt.color.setHex(S.player.shirt);
  p.pants.color.setHex(S.player.pants);
}

const WALK = 5.2, RUN = 9.0, JUMP_V = 8.5, GRAV = 22;

export function stepPlayer(S, input, dt) {
  const p = S.player;
  if (p.inCar) return;
  const fwd = (input.keys['w'] || input.keys['arrowup'] ? 1 : 0) - (input.keys['s'] || input.keys['arrowdown'] ? 1 : 0);
  const strafe = (input.keys['d'] || input.keys['arrowright'] ? 1 : 0) - (input.keys['a'] || input.keys['arrowleft'] ? 1 : 0);
  const sprint = !!(input.keys['shift']);
  const speed = sprint ? RUN : WALK;
  const yaw = S.camYaw;
  let mx = 0, mz = 0;
  if (fwd || strafe) {
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    mx = (-sin * fwd + cos * strafe);
    mz = (-cos * fwd - sin * strafe);
    const len = Math.hypot(mx, mz) || 1;
    mx /= len; mz /= len;
    p.heading = Math.atan2(mx, mz);
    p.moving = true; p.running = sprint;
  } else { p.moving = false; p.running = false; }
  p.x += mx * speed * dt;
  p.z += mz * speed * dt;
  p.x = Math.max(-WORLD.halfX, Math.min(WORLD.halfX, p.x));
  p.z = Math.max(-WORLD.halfZ, Math.min(WORLD.halfZ, p.z));
  p.speed = (fwd || strafe) ? speed : 0;
  S.stats.distance += p.speed * dt;
  // Jump + gravity.
  if (input.pressed[' '] && p.onGround) { p.vy = JUMP_V; p.onGround = false; }
  if (!p.onGround) {
    p.vy -= GRAV * dt;
    p.y = (p.y || 0) + p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.onGround = true; }
  }
  p.animTime += dt * (p.moving ? (sprint ? 2.2 : 1.4) : 0.3);
}

export function syncPlayerMesh(g, S) {
  const p = S.player;
  g.visible = !p.inCar;
  g.position.set(p.x, p.y || 0, p.z);
  g.rotation.y = p.heading;
  const parts = g.userData.parts;
  if (!parts) return;
  const swing = p.moving ? Math.sin(p.animTime * 6) * (p.running ? 0.75 : 0.5) : 0;
  parts.legL.rotation.x = swing;
  parts.legR.rotation.x = -swing;
  parts.armL.rotation.x = -swing * 0.8;
  parts.armR.rotation.x = swing * 0.8;
  parts.torso.position.y = 1.55 + (p.moving ? Math.abs(Math.sin(p.animTime * 6)) * 0.06 : 0);
}
