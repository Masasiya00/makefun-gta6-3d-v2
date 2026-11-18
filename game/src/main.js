// SOLMAR BAY 3D — main loop: boot, fixed-step sim, chase camera, render.
// Sim advances in fixed 1/60 s steps; rendering, HUD and audio only read
// the state. All input handling lives here so the sim modules stay pure.
import * as THREE from 'three';
import { freshState, WEAPONS } from './state.js';
import { buildWorld, updateDayNight, boxGeo, mat, mesh } from './world.js';
import { buildPlayerMesh, stepPlayer, syncPlayerMesh, refreshOutfit } from './player.js';
import { spawnParkedCars, nearestCar, stepDriving, syncCarMeshes, damageCar } from './vehicles.js';
import { spawnTraffic, stepTraffic, syncTrafficMeshes, spawnPeds, stepPeds, syncPedMeshes } from './traffic.js';
import { stepPolice, addWanted, clearWanted } from './police.js';
import { startMission, stepMissions, currentMission } from './missions.js';
import { tryShoot, stepCombat, spawnWorldPickups, spawnEnemies } from './combat.js';
import { nearestShop, shopItems, buyItem } from './shops.js';
import { buildHUD, updateHUD, showHint, showShop, showMenu, clearMenu } from './hud.js';
import { initAudio, setStation, setMuted, updateEngine, playShot, playSiren, playPickup, playBusted } from './audio.js';
import { saveGame, loadGame, applySave, hasSave, clearSave } from './save.js';
import { keys, pressed, mouse, initInput, consumePress, clearPresses } from './input.js';
import { applyShot, runAutoplay } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '7', 10) || 7;
const shotName = params.get('shot');
const autoplay = params.has('autoplay');

const S = freshState();
S.seed = seed;
S.damageNumbers = [];
S.hasPackage = false;
S.lastShotAt = -10;
window.__game = { S };

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b8e8);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2000);
camera.position.set(-110, 30, -80);

const worldRefs = buildWorld(scene, seed);
const playerMesh = buildPlayerMesh(S);
scene.add(playerMesh);
spawnParkedCars(S, seed);
spawnTraffic(S, seed);
spawnPeds(S, seed);
spawnWorldPickups(S);
buildHUD();
initInput(canvas, () => { if (S.started && !S.inMenu) togglePause(); }, () => { initAudio(); });

// pickup meshes
const pickupMeshes = new Map();
function syncPickups() {
  for (const pk of S.pickups) {
    if (!pk.mesh) {
      const color = pk.kind === 'cash' ? 0x2fae4a : pk.kind === 'health' ? 0xe84c3d : pk.kind === 'armour' ? 0x4a8aff : 0xf5c518;
      const m = mesh(boxGeo(1.2, 0.5, 1.2), mat(color, { emissive: color, ei: 0.5 }), pk.x, 0.8, pk.z);
      scene.add(m); pk.mesh = m; pickupMeshes.set(pk, m);
    }
    pk.mesh.position.y = 0.8 + Math.sin(S.elapsed * 3 + pk.x) * 0.2;
    pk.mesh.rotation.y += 0.02;
  }
}
const enemyMeshes = new Map();
function syncEnemies() {
  for (const e of S.enemies) {
    if (e.dead) { if (e.mesh) e.mesh.visible = false; continue; }
    if (!e.mesh) {
      const g = new THREE.Group();
      const body = mesh(boxGeo(1.0, 1.3, 0.55), mat(0x3a3a42), 0, 1.5, 0);
      const head = mesh(new THREE.SphereGeometry(0.4, 8, 6), mat(0xc89878), 0, 2.5, 0);
      g.add(body, head);
      scene.add(g); e.mesh = g; enemyMeshes.set(e, g);
    }
    e.mesh.position.set(e.x, 0, e.z);
    e.mesh.rotation.y = e.heading;
  }
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---- actions -------------------------------------------------------------
function enterCar() {
  const car = nearestCar(S, S.player.x, S.player.z, 5.5);
  if (!car) return false;
  if (car.driver === 'traffic') return false;
  const wasParked = car.parked;
  S.player.inCar = car; car.isPlayer = true; car.parked = false;
  S.stats.stolen++;
  if (wasParked || car.driver) addWanted(S, 12, 'Car stolen!');
  S.message = `Driving ${car.model.name}`; S.messageTimer = 2;
  return true;
}
function exitCar() {
  const car = S.player.inCar;
  if (!car) return;
  car.speed = 0; car.isPlayer = false;
  S.player.inCar = null;
  S.player.x = car.x + Math.sin(car.heading + Math.PI / 2) * 3;
  S.player.z = car.z + Math.cos(car.heading + Math.PI / 2) * 3;
}
function togglePause() {
  S.paused = !S.paused;
  if (S.paused) showMenu(S, 'pause');
  else clearMenu();
}
function respawnAfterFail(kind) {
  const lost = Math.floor(S.money * 0.2);
  S.money -= lost;
  S.health = 100; S.armour = 0;
  clearWanted(S);
  S.busted = false; S.wasted = false;
  S.player.x = -120; S.player.z = -120; S.player.heading = 0;
  if (S.player.inCar) { S.player.inCar.isPlayer = false; S.player.inCar = null; }
  S.missionActive = false; S.missionMarker = null;
  showMenu(S, kind, String(lost));
  S.inMenu = true;
}
function startGame(fromSave) {
  clearMenu();
  S.started = true; S.inMenu = false; S.paused = false;
  if (fromSave) {
    const d = loadGame();
    if (d) { applySave(S, d); refreshOutfit(playerMesh, S); S.message = 'Save loaded'; S.messageTimer = 2; }
  } else {
    S.message = 'Welcome to Solmar Bay, Mara. Press M for your first job.';
    S.messageTimer = 4;
  }
  initAudio();
  setStation(S, S.radio);
}
window.__saveGame = () => saveGame(S);

// ---- fixed-step sim ------------------------------------------------------
const STEP = 1 / 60;
let acc = 0, last = performance.now(), fpsEMA = 60, dayNightTimer = 0;
let shotCooldown = 0, sirenTimer = 0;

function simStep(dt) {
  S.elapsed += dt;
  if (!S.started || S.paused || S.inMenu) { clearPresses(); return; }
  S.time = (S.time + dt * 0.004) % 24; // a full day in ~7 minutes
  if (S.messageTimer > 0) S.messageTimer -= dt;

  // camera look
  S.camYaw -= mouse.dx * 0.0032;
  S.camPitch = Math.max(0.05, Math.min(1.1, S.camPitch + mouse.dy * 0.0022));

  // dialogue advance
  if (S.dialogue && S.dialogueIndex < S.dialogue.length && consumePress('t')) S.dialogueIndex++;

  // shop interaction
  const shop = nearestShop(S);
  if (S.shopOpen) {
    const items = shopItems(S, S.shopOpen);
    for (let i = 0; i < items.length; i++) {
      if (consumePress(String(i + 1))) buyItem(S, S.shopOpen, items[i]);
    }
    if (consumePress('escape') || consumePress('e')) { S.shopOpen = null; showShop(S, null); }
    showShop(S, S.shopOpen, items, S.shopIndex);
  } else if (shop && !S.player.inCar) {
    showHint(`Press E — ${shop.name}`);
    if (consumePress('e')) { S.shopOpen = shop; initAudio(); }
  } else showHint('');

  // enter / exit car
  if (!S.shopOpen) {
    if (consumePress('e')) {
      if (S.player.inCar) exitCar();
      else enterCar();
    }
  }
  // weapons
  const wkeys = ['1', '2', '3', '4'];
  const wnames = ['fists', 'pistol', 'smg', 'shotgun'];
  wkeys.forEach((k, i) => {
    if (consumePress(k) && (wnames[i] === 'fists' || S.owned[wnames[i]])) S.weapon = wnames[i];
  });
  // radio / mute
  if (consumePress('r')) { setStation(S, S.radio + 1); S.message = `Radio: ${['Sunset FM', 'Bay Beats', 'Solmar Talk'][S.radio]}`; S.messageTimer = 2; }
  if (consumePress('h')) setMuted(S, !S.muted);
  // mission key
  if (consumePress('m')) {
    const m = currentMission(S);
    if (m && !S.missionActive) {
      startMission(S, S.missionIndex);
      showMenu(S, 'brief', `${m.id}. ${m.name} — $${m.reward}<br>${m.brief}`);
      S.inMenu = true;
    }
  }
  // save shortcut (F5 handled below via keydown when paused)

  // shooting / punching
  shotCooldown -= dt;
  const wantShoot = mouse.clicked || mouse.down || consumePress('f');
  if (wantShoot && shotCooldown <= 0 && !S.player.inCar) {
    const w = WEAPONS[S.weapon];
    shotCooldown = 1 / w.rate;
    const dir = { x: Math.sin(S.camYaw + Math.PI), z: Math.cos(S.camYaw + Math.PI) };
    // aim from player toward camera forward
    const aim = { x: -Math.sin(S.camYaw), z: -Math.cos(S.camYaw) };
    tryShoot(S, scene, { x: S.player.x, z: S.player.z }, aim);
    playShot(S.weapon);
    if (S.weapon === 'fists') S.message = '';
  }

  // sim systems
  stepPlayer(S, { keys, pressed }, dt);
  if (S.player.inCar) stepDriving(S, { keys, pressed }, dt);
  stepTraffic(S, dt);
  stepPeds(S, dt, S.lastShotAt > S.elapsed - 1);
  stepPolice(S, dt, scene);
  stepMissions(S, dt);
  stepCombat(S, dt, scene);
  if (S.player.inCar && S.player.inCar.wrecked) { /* wrecked: force exit */ }

  // mission 6 spawns enemies at the store
  if (S.missionActive && S.missionIndex === 5 && S.missionStage === 0 && S.enemies.length === 0 && !S._m6spawned) {
    S._m6spawned = true;
    spawnEnemies(S, 3, 0, 180);
  }
  if (S.missionIndex > 5) S._m6spawned = false;

  // busted / wasted
  if (S.busted && !S.inMenu) { playBusted(); respawnAfterFail('busted'); }
  if (S.wasted && !S.inMenu) { playBusted(); respawnAfterFail('wasted'); }
  if (S.victory && !S.inMenu) { S.inMenu = true; showMenu(S, 'victory'); }
  if (S.health <= 0 && !S.wasted) { S.health = 0; S.wasted = true; }

  // sirens
  sirenTimer -= dt;
  if (S.wanted > 0 && sirenTimer <= 0) { playSiren(); sirenTimer = 1.6; }

  updateEngine(S);
  clearPresses();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dtMs = Math.min(100, now - last);
  last = now;
  fpsEMA = fpsEMA * 0.95 + (1000 / Math.max(1, dtMs)) * 0.05;
  S.fps = Math.round(fpsEMA);
  S.frameMs = +(dtMs).toFixed(1);
  acc += Math.min(0.1, dtMs / 1000);
  let n = 0;
  while (acc >= STEP && n < 5) { simStep(STEP); acc -= STEP; n++; }
  if (n === 5) acc = 0;

  // render: chase camera behind player / car
  const target = S.player.inCar || null;
  const px = S.player.x, pz = S.player.z;
  const yaw = S.camYaw;
  const dist = target ? 13 : 9;
  const height = 4.5 + S.camPitch * 6;
  const cx = px + Math.sin(yaw) * dist;
  const cz = pz + Math.cos(yaw) * dist;
  camera.position.set(cx, height, cz);
  camera.lookAt(px, target ? 2 : 1.8, pz);

  // day/night refresh twice a second
  dayNightTimer -= dtMs / 1000;
  if (dayNightTimer <= 0) { updateDayNight(scene, worldRefs, S.time); dayNightTimer = 0.5; }
  // ocean waves
  if (worldRefs.ocean) {
    const pos = worldRefs.ocean.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, Math.sin(x * 0.08 + S.elapsed * 1.2) * 0.5 + Math.cos(y * 0.06 + S.elapsed * 0.9) * 0.4);
    }
    pos.needsUpdate = true;
    worldRefs.ocean.geometry.computeVertexNormals();
  }
  syncPlayerMesh(playerMesh, S);
  syncCarMeshes(S, scene);
  syncTrafficMeshes(S, scene);
  syncPedMeshes(S, scene);
  syncPickups();
  syncEnemies();
  if (!S.paused) updateHUD(S);
  renderer.render(scene, camera);
}

// ---- boot ---------------------------------------------------------------
if (shotName) {
  applyShot(S, shotName);
  setTimeout(() => { window.__shotReady = true; }, 2500);
} else if (autoplay) {
  S.started = true; S.inMenu = false;
  S.player.x = -100; S.player.z = -100;
  setTimeout(() => {
    const api = {
      simulateKeys(ks, steps) {
        for (let i = 0; i < steps; i++) {
          for (const k of ks) keys[k] = true;
          simStep(STEP);
          for (const k of ks) keys[k] = false;
        }
      },
      enterNearestCar: () => { const c = nearestCar(S, S.player.x, S.player.z, 8); if (c) { S.player.inCar = c; c.isPlayer = true; return c; } return null; },
      exitCar,
      startMission: (i) => startMission(S, i),
      step: (n) => { for (let i = 0; i < n; i++) simStep(STEP); },
      buyFromShop: (kind, id) => {
        const shop = { kind, id: kind, name: kind, x: S.player.x, z: S.player.z };
        const items = shopItems(S, shop);
        const it = items.find((x) => x.id === id);
        return it ? buyItem(S, shop, it) : false;
      },
      saveAndLoad: () => { saveGame(S); const d = loadGame(); return !!d && applySave(S, d); },
      setStation: (i) => setStation(S, i),
      setPaused: (v) => { S.paused = v; },
    };
    runAutoplay(S, api);
  }, 800);
} else {
  showMenu(S, 'title');
}

window.addEventListener('keydown', (e) => {
  // Pause / save / quit must work even while the sim is paused, so they live
  // here (the fixed-step sim early-returns while paused).
  if (S.started && (e.key === 'p' || e.key === 'P') && !S.inMenu) { togglePause(); return; }
  if (S.paused && (e.key === 's' || e.key === 'S')) { saveGame(S); S.message = 'Game saved'; S.messageTimer = 2; return; }
  if (S.paused && (e.key === 'q' || e.key === 'Q')) {
    S.paused = false; S.started = false; S.inMenu = true; showMenu(S, 'title'); return;
  }
  if (!S.started && (e.key === 'Enter' || e.key === 'l' || e.key === 'L')) {
    startGame(e.key === 'l' || e.key === 'L');
  } else if (S.inMenu && e.key === 'Enter') {
    if (S.victory) { S.victory = false; S.inMenu = false; clearMenu(); S.started = true; }
    else if (S.missionActive || currentMission(S)) { clearMenu(); S.inMenu = false; S.started = true; }
    else startGame(false);
  }
});

requestAnimationFrame(frame);
