// SOLMAR BAY 3D — vehicles: six drivable models, driving sim, damage.
// Each car is a low-poly group: body, cabin, wheels, headlights, brake lights.
// Driving is arcade: accelerate, brake/reverse, steering scaled by speed,
// handbrake drift, collision damage, smoke when wrecked.
import * as THREE from 'three';
import { boxGeo, cylGeo, mat, mesh } from './world.js';
import { CAR_MODELS, WORLD } from './state.js';
import { mulberry32, pick, range } from './rng.js';

export function makeCarMesh(model, color) {
  const g = new THREE.Group();
  g.name = `car-${model.id}`;
  const dims = {
    hatch: [3.6, 1.1, 1.8, 1.6], sedan: [4.4, 1.1, 1.9, 1.7],
    coupe: [4.2, 0.95, 1.9, 1.5], suv: [4.6, 1.5, 2.1, 2.0],
    pickup: [4.8, 1.2, 2.0, 1.9], taxi: [4.4, 1.1, 1.9, 1.7],
  }[model.id] || [4.2, 1.1, 1.9, 1.7];
  const [len, bh, wid, ch] = dims;
  const bodyMat = mat(color);
  const body = mesh(boxGeo(len, bh, wid), bodyMat, 0, 0.75, 0);
  g.add(body);
  const cabin = mesh(boxGeo(len * 0.5, 0.75, wid * 0.82), mat(0x1a2a3a), -len * 0.06, bh + 0.55, 0);
  g.add(cabin);
  if (model.id === 'pickup') {
    const bed = mesh(boxGeo(len * 0.4, 0.5, wid * 0.9), mat(0x2a2a2e), len * 0.28, bh + 0.25, 0);
    g.add(bed);
  }
  if (model.id === 'taxi') {
    const sign = mesh(boxGeo(0.9, 0.3, 0.5), mat(0xf5c518, { emissive: 0xf5c518, ei: 0.7 }), 0, bh + 1.15, 0);
    g.add(sign);
  }
  const wheelGeo = cylGeo(0.42, 0.42, 0.35, 10);
  const wheelMat = mat(0x14141a);
  const wheels = [];
  for (const [wx, wz] of [[len * 0.32, wid / 2], [len * 0.32, -wid / 2], [-len * 0.32, wid / 2], [-len * 0.32, -wid / 2]]) {
    const w = mesh(wheelGeo, wheelMat, wx, 0.42, wz);
    w.rotation.x = Math.PI / 2;
    g.add(w); wheels.push(w);
  }
  const headMat = mat(0xfff2b8, { emissive: 0xffe9a8, ei: 0.9 });
  for (const wz of [-wid * 0.32, wid * 0.32]) {
    const h = mesh(boxGeo(0.15, 0.3, 0.35), headMat, len / 2 + 0.02, 0.85, wz);
    h.userData.nightOnly = true;
    g.add(h);
  }
  const brakeMat = mat(0xd81e2c, { emissive: 0xd81e2c, ei: 0.9 });
  const brakeL = mesh(boxGeo(0.15, 0.3, 0.4), brakeMat, -len / 2 - 0.02, 0.9, -wid * 0.3);
  const brakeR = mesh(boxGeo(0.15, 0.3, 0.4), brakeMat, -len / 2 - 0.02, 0.9, wid * 0.3);
  brakeL.visible = false; brakeR.visible = false;
  g.add(brakeL, brakeR);
  g.userData = { model, wheels, brakeL, brakeR, bodyMat, len, wid };
  return g;
}

export function spawnCar(S, model, color, x, z, heading) {
  const car = {
    model, color, x, z, heading, speed: 0, steer: 0,
    health: 100, wrecked: false, driver: null, parked: true,
    mesh: null, smoke: 0, isPlayer: false,
  };
  S.cars.push(car);
  return car;
}

export function spawnParkedCars(S, seed) {
  const rng = mulberry32(seed + 101);
  const spots = [];
  for (const rx of [-270, -180, -90, 0, 90, 180, 270]) {
    for (let z = -220; z < 220; z += 44) spots.push([rx + 11, z + range(rng, -8, 8), Math.PI / 2]);
  }
  for (const rz of [-180, -90, 0, 90, 180]) {
    for (let x = -320; x < 320; x += 55) spots.push([x + range(rng, -8, 8), rz + 11, 0]);
  }
  for (let i = 0; i < 26 && i < spots.length; i++) {
    const [x, z, h] = spots[Math.floor(rng() * spots.length)];
    const model = pick(rng, CAR_MODELS);
    spawnCar(S, model, pick(rng, model.colors), x, z, h);
  }
  // Mission 1 coupe outside Rosa's garage.
  spawnCar(S, CAR_MODELS[2], 0xd81e2c, -108, -108, Math.PI / 2);
}

export function nearestCar(S, x, z, maxDist = 5) {
  let best = null, bd = maxDist;
  for (const c of S.cars) {
    if (c.wrecked) continue;
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function stepDriving(S, input, dt) {
  const p = S.player;
  const car = p.inCar;
  if (!car || car.wrecked) return;
  const m = car.model;
  const fwd = (input.keys['w'] || input.keys['arrowup'] ? 1 : 0);
  const back = (input.keys['s'] || input.keys['arrowdown'] ? 1 : 0);
  const steerIn = (input.keys['a'] || input.keys['arrowleft'] ? 1 : 0) - (input.keys['d'] || input.keys['arrowright'] ? 1 : 0);
  const handbrake = !!input.keys[' '];
  if (fwd) car.speed += m.accel * dt;
  else if (back) car.speed -= (car.speed > 0.5 ? m.accel * 1.4 : m.accel * 0.6) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  car.speed = Math.max(-12, Math.min(m.top, car.speed));
  const steerTarget = steerIn * (0.55 + 0.35 * (1 - Math.abs(car.speed) / m.top));
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const grip = handbrake ? m.grip * 0.45 : m.grip;
  car.heading += car.steer * (car.speed / m.top) * grip * dt * (car.speed < 0 ? -1 : 1);
  const dx = Math.sin(car.heading) * car.speed * dt;
  const dz = Math.cos(car.heading) * car.speed * dt;
  car.x += dx; car.z += dz;
  car.x = Math.max(-WORLD.halfX + 4, Math.min(WORLD.halfX - 4, car.x));
  car.z = Math.max(-WORLD.halfZ + 4, Math.min(WORLD.halfZ - 4, car.z));
  p.x = car.x; p.z = car.z; p.heading = car.heading;
  S.stats.distance += Math.abs(car.speed) * dt;
}

export function damageCar(S, car, amount) {
  car.health -= amount;
  car.smoke = Math.max(car.smoke, amount);
  if (car.health <= 0 && !car.wrecked) {
    car.wrecked = true; car.speed = 0;
    S.message = 'Car wrecked!'; S.messageTimer = 2.5;
  }
}

export function syncCarMeshes(S, scene) {
  for (const car of S.cars) {
    if (!car.mesh) {
      car.mesh = makeCarMesh(car.model, car.color);
      scene.add(car.mesh);
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    const u = car.mesh.userData;
    const spin = car.speed * 0.016;
    for (const w of u.wheels) w.rotation.y = spin * 40 % (Math.PI * 2);
    const braking = car.isPlayer && (car.speed < -0.5);
    u.brakeL.visible = braking || car.wrecked;
    u.brakeR.visible = braking || car.wrecked;
    if (car.wrecked) car.mesh.rotation.z = 0.06;
  }
}
