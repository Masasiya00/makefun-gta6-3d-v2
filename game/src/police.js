// SOLMAR BAY 3D — wanted level and police.
// Crimes raise heat; heat becomes stars. Police cars spawn and chase with a
// last-seen-position pursuit: stay out of sight and the heat fades, stars
// drop one by one. From 3 stars a helicopter circles with a searchlight.
// Caught on foot = busted; zero health = wasted.
import * as THREE from 'three';
import { boxGeo, cylGeo, mat, mesh } from './world.js';
import { CAR_MODELS } from './state.js';
import { makeCarMesh } from './vehicles.js';

export function addWanted(S, amount, reason) {
  S.heat = Math.min(100, S.heat + amount);
  const stars = S.heat >= 85 ? 5 : S.heat >= 65 ? 4 : S.heat >= 45 ? 3 : S.heat >= 25 ? 2 : S.heat > 0 ? 1 : 0;
  if (stars > S.wanted) {
    S.wanted = stars;
    S.message = reason || 'Wanted level up!'; S.messageTimer = 2.5;
    S.lastSeen = { x: S.player.x, z: S.player.z };
    S.hiddenTimer = 0;
  } else if (stars < S.wanted) {
    S.wanted = stars;
  }
  return S.wanted;
}

export function clearWanted(S) {
  S.wanted = 0; S.heat = 0; S.lastSeen = null; S.hiddenTimer = 0;
  for (const c of S.police) { if (c.mesh) c.mesh.visible = false; }
  S.police = [];
  if (S.heli && S.heli.mesh) S.heli.mesh.visible = false;
  S.heli = null;
}

function policeCarMesh() {
  const g = makeCarMesh(CAR_MODELS[1], 0x1a1a22);
  const bar = mesh(boxGeo(1.0, 0.25, 0.5), mat(0xd81e2c, { emissive: 0xd81e2c, ei: 1 }), 0, 2.05, 0);
  const bar2 = mesh(boxGeo(1.0, 0.25, 0.5), mat(0x2e6ad8, { emissive: 0x2e6ad8, ei: 1 }), 0, 2.05, 0);
  bar2.position.x = 0.0; bar2.visible = false;
  g.add(bar, bar2);
  g.userData.lightA = bar; g.userData.lightB = bar2;
  return g;
}

export function stepPolice(S, dt, scene) {
  if (S.wanted <= 0) {
    if (S.police.length) clearWanted(S);
    return;
  }
  const wantCount = Math.min(1 + S.wanted, 5);
  while (S.police.length < wantCount) {
    const a = Math.random() * Math.PI * 2;
    const car = {
      x: S.player.x + Math.sin(a) * 70, z: S.player.z + Math.cos(a) * 70,
      heading: 0, speed: 0, mesh: null, siren: Math.random() * 2,
    };
    S.police.push(car);
  }
  // Helicopter from 3 stars.
  if (S.wanted >= 3 && !S.heli) {
    const g = new THREE.Group();
    const body = mesh(boxGeo(6, 2.2, 2.6), mat(0x1a2a3a), 0, 0, 0);
    const tail = mesh(boxGeo(6, 1, 1), mat(0x1a2a3a), -5, 0.4, 0);
    const rotor = mesh(boxGeo(11, 0.15, 0.8), mat(0x222222), 0, 1.4, 0);
    const light = new THREE.SpotLight(0xfff2b8, 60, 90, 0.35, 0.5, 1.2);
    light.position.set(0, -1, 0);
    light.target.position.set(0, -40, 0);
    g.add(body, tail, rotor, light, light.target);
    g.userData.rotor = rotor;
    scene.add(g);
    S.heli = { x: S.player.x + 30, z: S.player.z + 30, y: 55, mesh: g, angle: 0 };
  }
  if (S.wanted < 3 && S.heli) {
    if (S.heli.mesh) S.heli.mesh.visible = false;
    S.heli = null;
  }
  // Visibility: player is seen if close to any police unit or the heli.
  let seen = false;
  for (const c of S.police) {
    const d = Math.hypot(c.x - S.player.x, c.z - S.player.z);
    if (d < 55) seen = true;
  }
  if (S.heli) seen = true;
  if (seen) {
    S.lastSeen = { x: S.player.x, z: S.player.z };
    S.hiddenTimer = 0;
  } else {
    S.hiddenTimer += dt;
    if (S.hiddenTimer > 6) {
      S.heat = Math.max(0, S.heat - dt * 4);
      const stars = S.heat >= 85 ? 5 : S.heat >= 65 ? 4 : S.heat >= 45 ? 3 : S.heat >= 25 ? 2 : S.heat > 0 ? 1 : 0;
      if (stars < S.wanted) { S.wanted = stars; S.message = 'Laying low... heat dropping'; S.messageTimer = 2; }
      if (S.wanted === 0) clearWanted(S);
    }
  }
  // Chase: steer toward last seen position, ram when close.
  const target = S.lastSeen || { x: S.player.x, z: S.player.z };
  for (const c of S.police) {
    if (!c.mesh) { c.mesh = policeCarMesh(); scene.add(c.mesh); }
    c.mesh.visible = true;
    const dx = target.x - c.x, dz = target.z - c.z;
    const d = Math.hypot(dx, dz) || 1;
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - c.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    c.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
    const top = 30 + S.wanted * 3;
    c.speed = Math.min(top, c.speed + 18 * dt);
    c.x += Math.sin(c.heading) * c.speed * dt;
    c.z += Math.cos(c.heading) * c.speed * dt;
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
    c.siren += dt * 6;
    const on = Math.sin(c.siren) > 0;
    c.mesh.userData.lightA.visible = on;
    c.mesh.userData.lightB.visible = !on;
    // Ram the player's car / bust on foot.
    const pd = Math.hypot(S.player.x - c.x, S.player.z - c.z);
    if (pd < 4) {
      if (S.player.inCar) {
        S.player.inCar.health -= 12 * dt * 10;
        if (S.player.inCar.health <= 0) { S.player.inCar.wrecked = true; S.player.inCar.speed = 0; }
      } else if (!S.busted) {
        S.busted = true;
        S.message = 'BUSTED!'; S.messageTimer = 3;
      }
    }
  }
  if (S.heli) {
    const h = S.heli;
    h.angle += dt * 0.35;
    const r = 26;
    h.x = S.player.x + Math.sin(h.angle) * r;
    h.z = S.player.z + Math.cos(h.angle) * r;
    h.mesh.position.set(h.x, h.y, h.z);
    h.mesh.rotation.y = -h.angle;
    h.mesh.userData.rotor.rotation.y += dt * 18;
  }
}
