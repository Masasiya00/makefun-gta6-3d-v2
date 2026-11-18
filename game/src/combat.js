// SOLMAR BAY 3D — combat: fists, pistol, SMG, shotgun.
// Hitscan shooting with muzzle flash, tracer lines, hit markers and damage
// numbers. Mission enemies take cover and shoot back. Pickups: cash, health,
// armour, ammo — scattered around the city and dropped by enemies.
import * as THREE from 'three';
import { WEAPONS } from './state.js';
import { addWanted } from './police.js';

export function spawnEnemies(S, count, cx, cz) {
  for (let i = 0; i < count; i++) {
    S.enemies.push({
      x: cx + (Math.random() - 0.5) * 30, z: cz + (Math.random() - 0.5) * 30,
      health: 60, heading: 0, shootCd: 1 + Math.random() * 2,
      mesh: null, dead: false, coverX: cx, coverZ: cz,
    });
  }
}

export function tryShoot(S, scene, origin, dir) {
  const w = WEAPONS[S.weapon];
  if (!w) return;
  if (S.weapon !== 'fists') {
    if ((S.ammo[S.weapon] || 0) <= 0) { S.message = 'Out of ammo!'; S.messageTimer = 1.5; return; }
    S.ammo[S.weapon]--;
  }
  S.stats.shotsFired++;
  S.lastShotAt = S.elapsed;
  // tracer line
  const end = { x: origin.x + dir.x * w.range, y: 1.4, z: origin.z + dir.z * w.range };
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(origin.x, 1.4, origin.z), new THREE.Vector3(end.x, end.y, end.z),
  ]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
  scene.add(line);
  S.shots.push({ line, ttl: 0.12 });
  // hit enemies
  let hitAny = false;
  for (const e of S.enemies) {
    if (e.dead) continue;
    const dx = e.x - origin.x, dz = e.z - origin.z;
    const dist = Math.hypot(dx, dz);
    if (dist > w.range) continue;
    const dot = (dx * dir.x + dz * dir.z) / (dist || 1);
    const perp = Math.abs(dx * dir.z - dz * dir.x) / (dist || 1);
    if (dot > 0.85 && perp < 2.2) {
      e.health -= w.damage;
      hitAny = true;
      S.damageNumbers.push({ x: e.x, z: e.z, val: w.damage, ttl: 0.9 });
      if (e.health <= 0) {
        e.dead = true;
        S.pickups.push({ x: e.x, z: e.z, kind: 'cash', amount: 25 + Math.floor(Math.random() * 50) });
        if (Math.random() < 0.4) S.pickups.push({ x: e.x + 2, z: e.z, kind: 'health', amount: 25 });
      }
    }
  }
  // hitting a ped or shooting in public raises heat
  if (!hitAny && S.weapon !== 'fists') addWanted(S, 6, 'Shots fired!');
  else if (hitAny) addWanted(S, 4, '');
  // punch a nearby ped
  if (S.weapon === 'fists') {
    for (const p of S.peds) {
      const d = Math.hypot(p.x - origin.x, p.z - origin.z);
      if (d < 2.5) { p.panic = 3; addWanted(S, 8, 'Assault!'); }
    }
  }
}

export function stepCombat(S, dt, scene) {
  // tracer fade
  for (let i = S.shots.length - 1; i >= 0; i--) {
    const s = S.shots[i];
    s.ttl -= dt;
    if (s.ttl <= 0) { scene.remove(s.line); s.line.geometry.dispose(); S.shots.splice(i, 1); }
  }
  for (let i = S.damageNumbers.length - 1; i >= 0; i--) {
    S.damageNumbers[i].ttl -= dt;
    if (S.damageNumbers[i].ttl <= 0) S.damageNumbers.splice(i, 1);
  }
  // enemies: approach, take cover-ish positions, shoot back
  for (const e of S.enemies) {
    if (e.dead) continue;
    const dx = S.player.x - e.x, dz = S.player.z - e.z;
    const d = Math.hypot(dx, dz) || 1;
    e.heading = Math.atan2(dx, dz);
    if (d > 18) { e.x += (dx / d) * 4 * dt; e.z += (dz / d) * 4 * dt; }
    e.shootCd -= dt;
    if (e.shootCd <= 0 && d < 45) {
      e.shootCd = 1.6 + Math.random();
      // enemy bullet: 40% hit chance at range
      if (Math.random() < 0.4) {
        const dmg = 8;
        if (S.armour > 0) S.armour = Math.max(0, S.armour - dmg);
        else S.health -= dmg;
        S.message = 'Taking fire!'; S.messageTimer = 1;
        if (S.health <= 0) { S.health = 0; S.wasted = true; }
      }
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(e.x, 1.4, e.z), new THREE.Vector3(S.player.x, 1.4, S.player.z),
      ]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff6a5a, transparent: true, opacity: 0.8 }));
      scene.add(line);
      S.shots.push({ line, ttl: 0.1 });
    }
  }
  // pickups
  for (let i = S.pickups.length - 1; i >= 0; i--) {
    const pk = S.pickups[i];
    const d = Math.hypot(S.player.x - pk.x, S.player.z - pk.z);
    if (d < 3) {
      if (pk.kind === 'cash') { S.money += pk.amount; S.message = `+$${pk.amount}`; }
      else if (pk.kind === 'health') { S.health = Math.min(S.maxHealth, S.health + pk.amount); S.message = `+${pk.amount} health`; }
      else if (pk.kind === 'armour') { S.armour = Math.min(100, S.armour + pk.amount); S.message = `+${pk.amount} armour`; }
      else if (pk.kind === 'ammo') { S.ammo.pistol += 12; S.ammo.smg += 30; S.message = '+ammo'; }
      S.messageTimer = 1.5;
      if (pk.mesh) pk.mesh.visible = false;
      S.pickups.splice(i, 1);
    }
  }
}

export function spawnWorldPickups(S) {
  const spots = [
    [-300, 200, 'cash', 40], [-150, -200, 'health', 30], [200, 150, 'cash', 60],
    [40, -140, 'armour', 50], [-40, 200, 'cash', 35], [280, -180, 'health', 30],
    [120, 40, 'ammo', 0], [-240, -180, 'cash', 45], [320, 80, 'armour', 50],
    [-60, -220, 'cash', 55],
  ];
  for (const [x, z, kind, amount] of spots) S.pickups.push({ x, z, kind, amount, mesh: null });
}
