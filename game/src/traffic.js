// SOLMAR BAY 3D — traffic cars and pedestrians.
// Traffic loops along the avenue grid, slows near the player, and stops at
// random red-light pauses. Pedestrians stroll sidewalks, chat in pairs, and
// panic-run from gunfire or speeding cars.
import * as THREE from 'three';
import { boxGeo, mat, mesh } from './world.js';
import { ROAD_X, ROAD_Z } from './world.js';
import { CAR_MODELS } from './state.js';
import { mulberry32, pick, range } from './rng.js';
import { makeCarMesh } from './vehicles.js';

export function spawnTraffic(S, seed) {
  const rng = mulberry32(seed + 202);
  S.traffic = [];
  for (let i = 0; i < 26; i++) {
    const vertical = rng() < 0.5;
    const road = vertical ? pick(rng, ROAD_X) : pick(rng, ROAD_Z);
    const along = range(rng, -240, 240);
    const model = pick(rng, CAR_MODELS);
    const car = {
      model, color: pick(rng, model.colors),
      x: vertical ? road + (rng() < 0.5 ? 3.5 : -3.5) : along,
      z: vertical ? along : road + (rng() < 0.5 ? 3.5 : -3.5),
      heading: vertical ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      speed: range(rng, 8, 14), vertical, road, mesh: null, wait: 0,
      isPlayer: false, wrecked: false, health: 100,
    };
    S.traffic.push(car);
  }
}

export function stepTraffic(S, dt) {
  for (const c of S.traffic) {
    if (c.wait > 0) { c.wait -= dt; continue; }
    // random red-light pause at intersections
    if (Math.random() < dt * 0.02) { c.wait = 1 + Math.random() * 2; continue; }
    const spd = c.speed * dt;
    if (c.vertical) {
      c.z += Math.cos(c.heading) * spd;
      c.x = c.road + (c.heading === 0 ? 3.5 : -3.5);
      if (c.z > 250) c.z = -250;
      if (c.z < -250) c.z = 250;
    } else {
      c.x += Math.sin(c.heading) * spd;
      c.z = c.road + (c.heading === Math.PI / 2 ? 3.5 : -3.5);
      if (c.x > 350) c.x = -350;
      if (c.x < -350) c.x = 350;
    }
    // slow down if the player is right ahead
    const pd = Math.hypot(S.player.x - c.x, S.player.z - c.z);
    if (pd < 12) c.speed = Math.max(3, c.speed - 20 * dt);
    else c.speed = Math.min(14, c.speed + 6 * dt);
    // avoid overlapping the player's car
    if (S.player.inCar) {
      const pc = S.player.inCar;
      const d = Math.hypot(pc.x - c.x, pc.z - c.z);
      if (d < 5) { c.x += (c.x - pc.x) * 0.3; c.z += (c.z - pc.z) * 0.3; }
    }
  }
}

export function syncTrafficMeshes(S, scene) {
  for (const c of S.traffic) {
    if (!c.mesh) { c.mesh = makeCarMesh(c.model, c.color); scene.add(c.mesh); }
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
  }
}

const PED_COLORS = [0xe84c3d, 0x4ea8e8, 0x3aa84a, 0xf2c14e, 0x8a5ad8, 0xe87ab8, 0x5ad8c8, 0xd8d8d8];

export function spawnPeds(S, seed) {
  const rng = mulberry32(seed + 303);
  S.peds = [];
  for (let i = 0; i < 44; i++) {
    const x = range(rng, -340, 340), z = range(rng, -240, 240);
    S.peds.push({
      x, z, heading: range(rng, 0, Math.PI * 2), speed: range(rng, 1.2, 2.2),
      color: pick(rng, PED_COLORS), panic: 0, wait: range(rng, 0, 4),
      mesh: null, anim: range(rng, 0, 6), targetX: x, targetZ: z,
    });
  }
}

export function stepPeds(S, dt, danger) {
  for (const p of S.peds) {
    const dPlayer = Math.hypot(S.player.x - p.x, S.player.z - p.z);
    const carSpeed = S.player.inCar ? Math.abs(S.player.inCar.speed) : 0;
    if (danger || (dPlayer < 8 && (carSpeed > 12 || danger))) p.panic = 2.5;
    if (p.panic > 0) {
      p.panic -= dt;
      const away = Math.atan2(p.x - S.player.x, p.z - S.player.z);
      p.heading = away;
      p.x += Math.sin(away) * 5.5 * dt;
      p.z += Math.cos(away) * 5.5 * dt;
      p.anim += dt * 12;
      continue;
    }
    if (p.wait > 0) { p.wait -= dt; p.anim += dt * 1.5; continue; }
    // wander toward a target, pick a new one on arrival
    const dx = p.targetX - p.x, dz = p.targetZ - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 2) {
      p.targetX = Math.max(-340, Math.min(340, p.x + (Math.random() * 120 - 60)));
      p.targetZ = Math.max(-240, Math.min(240, p.z + (Math.random() * 120 - 60)));
      p.wait = Math.random() * 6;
      continue;
    }
    p.heading = Math.atan2(dx, dz);
    p.x += (dx / d) * p.speed * dt;
    p.z += (dz / d) * p.speed * dt;
    p.anim += dt * 6;
  }
}

export function syncPedMeshes(S, scene) {
  for (const p of S.peds) {
    if (!p.mesh) {
      const g = new THREE.Group();
      const body = mesh(boxGeo(0.9, 1.2, 0.5), mat(p.color), 0, 1.1, 0);
      const head = mesh(new THREE.SphereGeometry(0.36, 8, 6), mat(0xd8a878), 0, 2.0, 0);
      const legL = mesh(boxGeo(0.32, 0.8, 0.36), mat(0x2c2c34), -0.22, 0.4, 0);
      const legR = mesh(boxGeo(0.32, 0.8, 0.36), mat(0x2c2c34), 0.22, 0.4, 0);
      g.add(body, head, legL, legR);
      g.userData.parts = { legL, legR };
      p.mesh = g;
      scene.add(g);
    }
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    const sw = Math.sin(p.anim) * 0.5;
    p.mesh.userData.parts.legL.rotation.x = sw;
    p.mesh.userData.parts.legR.rotation.x = -sw;
  }
}
