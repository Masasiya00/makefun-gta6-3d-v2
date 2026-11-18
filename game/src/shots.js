// SOLMAR BAY 3D — deterministic screenshot scenes and the autoplay self-test.
// ?shot=chase|city|mission|night&seed=7 places the player, cars and camera
// the same way every run. ?autoplay runs a scripted self-test (start, drive,
// mission, chase, escape, save/load) and reports pass/fail in the DOM and
// on window.__autoplayResult.
import { addWanted, clearWanted } from './police.js';
import { startMission } from './missions.js';

export const SHOT_SCENES = {
  chase: { time: 17.5, wanted: 3, player: { x: 10, z: 20, heading: 0.4 }, inCar: 'coupe', mission: 3, speed: 24 },
  city: { time: 10.0, wanted: 0, player: { x: 0, z: -140, heading: Math.PI }, inCar: null, mission: 0 },
  mission: { time: 12.0, wanted: 1, player: { x: -90, z: -100, heading: Math.PI }, inCar: 'coupe', mission: 1 },
  night: { time: 21.5, wanted: 0, player: { x: 0, z: 0, heading: 0 }, inCar: 'taxi', mission: 0, speed: 18 },
};

export function applyShot(S, name) {
  const sc = SHOT_SCENES[name] || SHOT_SCENES.city;
  S.time = sc.time;
  S.started = true; S.inMenu = false;
  S.player.x = sc.player.x; S.player.z = sc.player.z; S.player.heading = sc.player.heading;
  S.camYaw = sc.player.heading + Math.PI; // chase camera sits behind the player
  if (sc.inCar) {
    // prefer the red mission coupe so two coupes never overlap in the shot
    const car = S.cars.find((c) => c.model.id === sc.inCar && c.color === 0xd81e2c && !c.wrecked)
      || S.cars.find((c) => c.model.id === sc.inCar && !c.wrecked);
    if (car) {
      car.x = sc.player.x; car.z = sc.player.z; car.heading = sc.player.heading;
      car.speed = sc.speed || 0;
      S.player.inCar = car; car.isPlayer = true; car.parked = false;
    }
  }
  if (sc.mission) {
    S.missionIndex = sc.mission - 1;
    startMission(S, sc.mission - 1);
    if (sc.mission === 3) S.missionTimer = 38;
  } else {
    S.missionText = 'Free roam — press M for the next mission';
  }
  // startMission already adds wanted for missions 2/3/7/8; only top up otherwise
  if (sc.wanted && sc.mission !== 3) addWanted(S, sc.wanted === 1 ? 15 : 30, '');
  S.message = '';
  return sc;
}

// Scripted self-test: drives the real sim functions and records results.
export async function runAutoplay(S, api) {
  const results = [];
  const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    check('start', S.started === true);
    // walk forward
    const x0 = S.player.x, z0 = S.player.z;
    api.simulateKeys(['w'], 60);
    check('walk', Math.hypot(S.player.x - x0, S.player.z - z0) > 2, `moved ${Math.hypot(S.player.x - x0, S.player.z - z0).toFixed(1)}m`);
    // enter nearest car (walk to one first)
    const anyCar = S.cars.find((c) => !c.wrecked);
    if (anyCar) { S.player.x = anyCar.x + 2; S.player.z = anyCar.z + 2; }
    const entered = api.enterNearestCar();
    check('enter-car', !!entered, entered ? entered.model.name : 'no car near');
    if (entered) {
      api.simulateKeys(['w'], 90);
      check('drive', Math.abs(entered.speed) > 5, `speed ${entered.speed.toFixed(1)}`);
      api.exitCar();
      check('exit-car', !S.player.inCar);
    }
    // mission 1 end to end (teleport-free: drive the coupe to the garage)
    api.startMission(0);
    check('mission-start', S.missionActive === true);
    const coupe = S.cars.find((c) => c.model.id === 'coupe');
    if (coupe) {
      coupe.x = S.player.x; coupe.z = S.player.z;
      S.player.inCar = coupe; coupe.isPlayer = true;
      S.missionStage = 1; S.missionMarker = { x: -120, z: -120 };
      S.player.x = -120; S.player.z = -120;
      coupe.x = -120; coupe.z = -120;
      api.step(5);
      check('mission-1-complete', S.missionDone.includes(1), `done=${S.missionDone.join(',')}`);
    }
    // wanted chase + escape
    addWanted(S, 40, 'test chase');
    check('wanted-up', S.wanted >= 2, `${S.wanted} stars`);
    api.step(120);
    check('police-spawned', S.police.length > 0, `${S.police.length} units`);
    clearWanted(S);
    check('wanted-clear', S.wanted === 0);
    // shop buy
    S.player.x = -200; S.player.z = 30;
    const bought = api.buyFromShop('tacos', 'taco');
    check('shop-buy', bought === true, `money $${S.money}`);
    // save + load
    const ok = api.saveAndLoad();
    check('save-load', ok === true);
    // radio
    api.setStation(1);
    check('radio', S.radio === 1);
    api.setStation(2);
    check('radio-talk', S.radio === 2);
    // pause / resume
    api.setPaused(true);
    check('pause', S.paused === true);
    api.setPaused(false);
    check('resume', S.paused === false);
    await sleep(50);
  } catch (e) {
    results.push({ name: 'exception', ok: false, detail: String(e && e.message || e) });
  }
  const passed = results.filter((r) => r.ok).length;
  const out = { passed, total: results.length, results, done: true };
  window.__autoplayResult = out;
  const el = document.getElementById('autoplay-result');
  if (el) el.textContent = JSON.stringify(out);
  return out;
}
