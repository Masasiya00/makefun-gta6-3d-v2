// SOLMAR BAY 3D — world building: the city of Solmar Bay.
// Builds the ground, ocean, roads, buildings, palms, lamps, shops and sky
// from the seeded RNG in state.js. All geometry is low-poly boxes, cylinders
// and cones with shared materials, so draw calls stay low.
import * as THREE from 'three';
import { WORLD, DISTRICTS, SHOPS } from './state.js';
import { mulberry32, pick, range, intRange } from './rng.js';

const geoCache = new Map();
const matCache = new Map();
export function boxGeo(w, h, d) {
  const k = `b${w}|${h}|${d}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}
export function cylGeo(rt, rb, h, seg = 8) {
  const k = `c${rt}|${rb}|${h}|${seg}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.CylinderGeometry(rt, rb, h, seg));
  return geoCache.get(k);
}
export function mat(color, opts = {}) {
  const k = `${color}|${opts.emissive || 0}|${opts.flat ? 1 : 0}`;
  if (!matCache.has(k)) {
    matCache.set(k, new THREE.MeshLambertMaterial({
      color, emissive: opts.emissive || 0x000000,
      emissiveIntensity: opts.ei || 1, flatShading: !!opts.flat,
    }));
  }
  return matCache.get(k);
}
export function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  return m;
}

export const ROAD_X = [-270, -180, -90, 0, 90, 180, 270];
export const ROAD_Z = [-180, -90, 0, 90, 180];

export function buildWorld(scene, seed) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  group.name = 'world';
  const refs = { buildings: [], palms: [], lamps: [], shopMarkers: [], ocean: null, sun: null, hemi: null, sky: null, clouds: [] };

  // Ground: one big plane, tinted per district by overlay quads.
  const ground = mesh(new THREE.PlaneGeometry(WORLD.halfX * 2 + 160, WORLD.halfZ * 2 + 40), mat(0x8a9a6a), 0, -0.05, 0);
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);
  for (const d of DISTRICTS) {
    const w = d.x1 - d.x0, h = d.z1 - d.z0;
    const patch = mesh(new THREE.PlaneGeometry(w, h), mat(d.ground), (d.x0 + d.x1) / 2, 0.0, (d.z0 + d.z1) / 2);
    patch.rotation.x = -Math.PI / 2;
    group.add(patch);
  }
  // Beach sand strip on the west edge.
  const sand = mesh(new THREE.PlaneGeometry(60, WORLD.halfZ * 2 + 40), mat(0xe8d49a), WORLD.beachX - 15, 0.02, 0);
  sand.rotation.x = -Math.PI / 2;
  group.add(sand);

  // Ocean: animated plane west of the beach.
  const oceanGeo = new THREE.PlaneGeometry(260, WORLD.halfZ * 2 + 400, 24, 24);
  const ocean = new THREE.Mesh(oceanGeo, new THREE.MeshLambertMaterial({ color: 0x1e7fb8, transparent: true, opacity: 0.92 }));
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(WORLD.oceanX - 130, 0.4, 0);
  group.add(ocean);
  refs.ocean = ocean;

  // Roads: dark strips + centre dashes + sidewalks.
  const roadMat = mat(0x3a3a40);
  const lineMat = mat(0xf5d76e);
  const walkMat = mat(0xb8b0a4);
  for (const x of ROAD_X) {
    const r = mesh(new THREE.PlaneGeometry(14, WORLD.halfZ * 2), roadMat, x, 0.03, 0);
    r.rotation.x = -Math.PI / 2; group.add(r);
    for (let z = -WORLD.halfZ; z < WORLD.halfZ; z += 16) {
      const dash = mesh(new THREE.PlaneGeometry(0.7, 5), lineMat, x, 0.05, z);
      dash.rotation.x = -Math.PI / 2; group.add(dash);
    }
    for (const s of [-8.5, 8.5]) {
      const w = mesh(new THREE.PlaneGeometry(3, WORLD.halfZ * 2), walkMat, x + s, 0.04, 0);
      w.rotation.x = -Math.PI / 2; group.add(w);
    }
  }
  for (const z of ROAD_Z) {
    const r = mesh(new THREE.PlaneGeometry(WORLD.halfX * 2, 14), roadMat, 0, 0.03, z);
    r.rotation.x = -Math.PI / 2; group.add(r);
    for (let x = -WORLD.halfX; x < WORLD.halfX; x += 16) {
      const dash = mesh(new THREE.PlaneGeometry(5, 0.7), lineMat, x, 0.05, z);
      dash.rotation.x = -Math.PI / 2; group.add(dash);
    }
  }
  // Diagonal avenue (Downtown to Marina).
  const diag = mesh(new THREE.PlaneGeometry(12, 420), roadMat, 45, 0.03, 60);
  diag.rotation.x = -Math.PI / 2; diag.rotation.z = 0.6; group.add(diag);

  // Buildings: blocks between roads, height by district (Downtown tall).
  const palettes = {
    'Downtown': [0x6a8ab8, 0x8ab8d8, 0x5a6a8a, 0xa8c8e8],
    'Palm Beach': [0xf2e8c8, 0xe8c8a8, 0xffffff, 0xd8b89a],
    'Old Town': [0xe8a34c, 0xd87a5a, 0xf2d06a, 0xc85a6a],
    'Dockside': [0x7a8a99, 0x9a8a7a, 0x6a7a8a, 0xb8a888],
    'Marina': [0xffffff, 0xd8e8f2, 0xc8d8e8, 0xf2e8d8],
    'Coral Heights': [0xf2d8c8, 0xe8c8b8, 0xd8b8a8, 0xffffff],
    'Airfield': [0x9a9a92, 0x8a8a82, 0xb8b8ae, 0x7a7a72],
    'Bayview': [0xe8d8b8, 0xd8c8a8, 0xc8d8b8, 0xf2e8c8],
  };
  const winMat = mat(0xffe9a8, { emissive: 0xffc84a, ei: 0.9 });
  const bandMat = mat(0xd8e8f2);
  const roofMat = mat(0x3a3a40);
  for (const d of DISTRICTS) {
    const tall = d.name === 'Downtown';
    const n = tall ? 26 : 14;
    for (let i = 0; i < n; i++) {
      const w = range(rng, 14, 30), dep = range(rng, 14, 30);
      const h = tall ? range(rng, 40, 110) : range(rng, 8, 26);
      const x = range(rng, d.x0 + 22, d.x1 - 22);
      const z = range(rng, d.z0 + 22, d.z1 - 22);
      // keep off roads
      if (ROAD_X.some((rx) => Math.abs(x - rx) < 14) || ROAD_Z.some((rz) => Math.abs(z - rz) < 14)) continue;
      const b = mesh(boxGeo(w, h, dep), mat(pick(rng, palettes[d.name] || palettes['Bayview'])), x, h / 2, z);
      b.rotation.y = (rng() < 0.5 ? 0 : Math.PI / 2);
      group.add(b);
      refs.buildings.push(b);
      // window bands break up flat facades on every building
      if (h > 10) {
        for (const frac of [0.3, 0.62]) {
          const band = mesh(boxGeo(w * 0.82, 1.1, 0.25), bandMat, x, h * frac, z + dep / 2 + 0.15);
          group.add(band); refs.buildings.push(band);
        }
        const roof = mesh(boxGeo(w * 0.9, 0.8, dep * 0.9), roofMat, x, h + 0.4, z);
        group.add(roof); refs.buildings.push(roof);
      }
      // lit window strip near the top of tall towers
      if (h > 20) {
        const win = mesh(boxGeo(w * 0.7, 1.2, 0.3), winMat, x, h * 0.7, z + dep / 2 + 0.2);
        win.userData.nightOnly = true;
        group.add(win); refs.buildings.push(win);
      }
    }
  }

  // Palm trees along the beach and parks.
  const trunkMat = mat(0x8a6a42), leafMat = mat(0x2e8a4a, { flat: true });
  for (let i = 0; i < 64; i++) {
    const x = i < 40 ? range(rng, WORLD.beachX - 20, WORLD.beachX + 18) : range(rng, -340, 340);
    const z = range(rng, -250, 250);
    if (ROAD_X.some((rx) => Math.abs(x - rx) < 10) || ROAD_Z.some((rz) => Math.abs(z - rz) < 10)) continue;
    const h = range(rng, 7, 11);
    const trunk = mesh(cylGeo(0.35, 0.55, h, 6), trunkMat, x, h / 2, z);
    trunk.rotation.z = range(rng, -0.08, 0.08);
    group.add(trunk);
    const crown = mesh(new THREE.ConeGeometry(3.2, 3.4, 7), leafMat, x, h + 1.2, z);
    group.add(crown);
    refs.palms.push(trunk, crown);
  }

  // Street lamps along the avenues.
  const poleMat = mat(0x2a2a30);
  const lampGlow = mat(0xffe9a8, { emissive: 0xffd76a, ei: 1 });
  for (const x of ROAD_X) {
    for (let z = -220; z <= 220; z += 88) {
      const pole = mesh(cylGeo(0.18, 0.24, 7, 6), poleMat, x + 9, 3.5, z);
      group.add(pole);
      const bulb = mesh(new THREE.SphereGeometry(0.55, 8, 6), lampGlow, x + 9, 7.1, z);
      bulb.userData.nightOnly = true;
      group.add(bulb);
      refs.lamps.push(pole, bulb);
    }
  }

  // Shops: distinct coloured boxes with a sign slab.
  for (const s of SHOPS) {
    const base = mesh(boxGeo(20, 9, 14), mat(s.color), s.x, 4.5, s.z);
    group.add(base);
    const sign = mesh(boxGeo(16, 2.4, 1), mat(0xffffff, { emissive: s.color, ei: 0.55 }), s.x, 8.2, s.z + 7.2);
    group.add(sign);
    refs.shopMarkers.push({ shop: s, mesh: base });
  }

  // Dockside containers + cranes.
  const contCols = [0xd84a3a, 0x3a7ad8, 0x3aa84a, 0xd8a83a];
  for (let i = 0; i < 18; i++) {
    const x = range(rng, -260, -110), z = range(rng, -50, 90);
    const c = mesh(boxGeo(12, 3, 3), mat(pick(rng, contCols)), x, 1.5 + (i % 3) * 3.1, z);
    c.rotation.y = rng() < 0.5 ? 0 : Math.PI / 2;
    group.add(c);
  }
  // Airfield runway + hangars + parked planes (simple fuselage + wings).
  const runway = mesh(new THREE.PlaneGeometry(60, 300), mat(0x2e2e34), 240, 0.04, 20);
  runway.rotation.x = -Math.PI / 2; group.add(runway);
  for (let i = 0; i < 3; i++) {
    const hangar = mesh(boxGeo(34, 12, 24), mat(0xb8b8ae), 150 + i * 46, 6, -40);
    group.add(hangar);
    const fus = mesh(cylGeo(1.6, 1.6, 22, 8), mat(0xffffff), 210 + i * 30, 2.2, 60);
    fus.rotation.z = Math.PI / 2; group.add(fus);
    const wing = mesh(boxGeo(4, 0.4, 18), mat(0xd8d8d8), 210 + i * 30, 2.2, 60);
    group.add(wing);
  }
  // Marina yachts: hull + mast.
  for (let i = 0; i < 6; i++) {
    const x = range(rng, -80, 80), z = range(rng, 80, 240);
    const hull = mesh(boxGeo(5, 2, 16), mat(0xffffff), x, 1, z);
    group.add(hull);
    const mast = mesh(cylGeo(0.15, 0.2, 10, 6), mat(0x8a8a8a), x, 7, z);
    group.add(mast);
  }
  // Park benches + trees in Bayview park.
  const treeMat = mat(0x3a8a4a, { flat: true });
  for (let i = 0; i < 24; i++) {
    const x = range(rng, 120, 340), z = range(rng, 120, 240);
    const t = mesh(cylGeo(0.4, 0.5, 3, 6), trunkMat, x, 1.5, z);
    group.add(t);
    const top = mesh(new THREE.SphereGeometry(2.6, 8, 6), treeMat, x, 4.6, z);
    group.add(top);
  }

  // Sky dome + clouds + sun + hemisphere light.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 12),
    new THREE.MeshBasicMaterial({ color: 0x87b8e8, side: THREE.BackSide, fog: false }));
  sky.name = 'sky';
  group.add(sky);
  refs.sky = sky;
  for (let i = 0; i < 14; i++) {
    const cl = mesh(new THREE.SphereGeometry(range(rng, 18, 34), 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false }),
      range(rng, -900, 900), range(rng, 120, 220), range(rng, -700, 700));
    cl.scale.y = 0.35;
    group.add(cl); refs.clouds.push(cl);
  }
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
  sun.position.set(300, 400, 200);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 1200;
  group.add(sun);
  refs.sun = sun;
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x8a7a5a, 0.9);
  group.add(hemi);
  refs.hemi = hemi;

  scene.add(group);
  return refs;
}

// Update sun, sky colour and fog from the in-game clock (hours).
export function updateDayNight(scene, refs, time) {
  const t = time / 24;
  const ang = (t - 0.25) * Math.PI * 2; // sun path
  const sunH = Math.sin(ang);
  const isNight = time < 5.5 || time >= 19.5;
  const isSunset = (time >= 17 && time < 19.5) || (time >= 5.5 && time < 7.5);
  const sunColor = isSunset ? 0xff8a3a : 0xfff2d8;
  refs.sun.color.setHex(sunColor);
  refs.sun.position.set(Math.cos(ang) * 500, Math.max(40, sunH * 500), 220);
  refs.sun.intensity = isNight ? 0.35 : isSunset ? 1.1 : 1.6;
  refs.hemi.intensity = isNight ? 0.4 : 0.9;
  const skyCol = isNight ? 0x0e1a33 : isSunset ? 0xff9a4a : 0x87b8e8;
  refs.sky.material.color.setHex(skyCol);
  scene.fog = new THREE.Fog(isNight ? 0x0e1a33 : isSunset ? 0xe8905a : 0xa8c8e8, 220, 900);
  scene.traverse((o) => {
    if (o.userData && o.userData.nightOnly) o.visible = isNight || isSunset;
  });
  return { isNight, isSunset };
}

export function isOnRoad(x, z) {
  return ROAD_X.some((rx) => Math.abs(x - rx) < 8) || ROAD_Z.some((rz) => Math.abs(z - rz) < 8);
}
