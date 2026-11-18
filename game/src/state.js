// SOLMAR BAY 3D — central game state.
// One plain object holds everything the simulation owns. Rendering, HUD and
// audio only READ this state; the fixed-step sim in main.js is the only
// writer. Nothing here imports three.js: state is pure data.
export const WORLD = { halfX: 360, halfZ: 260, beachX: -330, oceanX: -360 };

export const DISTRICTS = [
  { name: 'Palm Beach', x0: -360, z0: -260, x1: -270, z1: 260, color: 0xf2d8a0, ground: 0xe8d49a },
  { name: 'Old Town', x0: -270, z0: -260, x1: -90, z1: -60, color: 0xe8a34c, ground: 0x9a8a7a },
  { name: 'Dockside', x0: -270, z0: -60, x1: -90, z1: 100, color: 0x7a8a99, ground: 0x8a8a86 },
  { name: 'Downtown', x0: -90, z0: -260, x1: 90, z1: 60, color: 0x4c7ab8, ground: 0x6a6a72 },
  { name: 'Marina', x0: -90, z0: 60, x1: 90, z1: 260, color: 0x3fa8c8, ground: 0x9ab8a8 },
  { name: 'Coral Heights', x0: 90, z0: -260, x1: 360, z1: -60, color: 0xd87a7a, ground: 0xa8a078 },
  { name: 'Airfield', x0: 90, z0: -60, x1: 360, z1: 100, color: 0x9a9a92, ground: 0x8a8a82 },
  { name: 'Bayview', x0: 90, z0: 100, x1: 360, z1: 260, color: 0x7ac88a, ground: 0x8aa87a },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  return x < WORLD.beachX ? 'Palm Beach' : 'Solmar Bay';
}

export const CAR_MODELS = [
  { id: 'hatch', name: 'Pip Hatch', top: 34, accel: 16, grip: 2.6, colors: [0xe84c3d, 0xf2c14e, 0x4ea8e8] },
  { id: 'sedan', name: 'Solmar Sedan', top: 38, accel: 15, grip: 2.4, colors: [0x3a5a8c, 0xcccccc, 0x222831] },
  { id: 'coupe', name: 'Viper Coupe', top: 52, accel: 22, grip: 3.0, colors: [0xd81e2c, 0xf5c518, 0x111111] },
  { id: 'suv', name: 'Bay SUV', top: 36, accel: 13, grip: 2.2, colors: [0x2e5d3a, 0x888888, 0x8c4a2e] },
  { id: 'pickup', name: 'Ranchero Pickup', top: 37, accel: 14, grip: 2.3, colors: [0x7a4a2e, 0x4a6a8a, 0xc8b89a] },
  { id: 'taxi', name: 'Bay Taxi', top: 40, accel: 16, grip: 2.5, colors: [0xf5c518, 0xf5c518, 0xf5c518] },
];

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, rate: 2.2, range: 2.2, auto: false, ammo: Infinity, price: 0 },
  pistol: { name: 'P9 Pistol', damage: 22, rate: 3.5, range: 55, auto: false, ammo: 12, price: 250 },
  smg: { name: 'K9 SMG', damage: 13, rate: 9, range: 45, auto: true, ammo: 30, price: 600 },
  shotgun: { name: 'Boomstick', damage: 55, rate: 1.1, range: 22, auto: false, ammo: 6, price: 900 },
};

export const SHOPS = [
  { id: 'garage', name: "Rosa's Garage", kind: 'garage', x: -120, z: -120, color: 0xe86a2e },
  { id: 'arms', name: 'Ironworks Arms', kind: 'arms', x: 30, z: -30, color: 0x5a5a66 },
  { id: 'tacos', name: 'Tico Tacos', kind: 'tacos', x: -200, z: 30, color: 0xf2a13d },
  { id: 'threads', name: 'Neon Threads', kind: 'threads', x: 60, z: 120, color: 0xd84ad8 },
];

export const MISSIONS = [
  { id: 1, name: 'First Wheels', reward: 300, brief: 'Meet Rosa at her garage, take the coupe and drive it back to her.' },
  { id: 2, name: 'Beach Run', reward: 450, brief: 'Lose a two-star police pursuit by staying out of sight.' },
  { id: 3, name: 'Hot Pursuit', reward: 600, brief: 'Survive a 45-second three-star chase with a helicopter overhead.' },
  { id: 4, name: 'Dockside Deal', reward: 800, brief: 'Carry the package across the city to the docks. Avoid police.' },
  { id: 5, name: 'Night Shift', reward: 1000, brief: 'A night delivery through Downtown with traffic and patrols.' },
  { id: 6, name: 'High Tide Heist', reward: 1500, brief: 'Rob the Marina store and escape a four-star response.' },
  { id: 7, name: 'The Getaway', reward: 2000, brief: 'A long chase across four districts to the Bayview hideout.' },
  { id: 8, name: 'King of the Bay', reward: 2500, brief: 'The finale: five stars. Survive and reach the Marina.' },
];

export const DIALOGUE = {
  1: [['Rosa', 'Mara! New in town, huh? Take that red coupe out front and bring her back in one piece.'], ['Mara', 'One piece. Got it.']],
  2: [['Rosa', 'Cops spotted the coupe. Lose them on the beach roads — out of sight, out of mind.'], ['Mara', 'They will never see me coming.']],
  3: [['Rosa', 'Word is the whole precinct is after you. Forty-five seconds, chopper and all. Hold on tight!']],
  4: [['Rosa', 'Package for the Dockside crew. No stops, no cops, no questions.']],
  5: [['Rosa', 'Night run through Downtown. Traffic is thick, patrols thicker. Lights off, eyes open.']],
  6: [['Rosa', 'The Marina store keeps its cash in the back. Take it, and run like the tide.']],
  7: [['Rosa', 'They know your name now. Four districts to the hideout. Drive like the bay is on fire.']],
  8: [['Rosa', 'Last one, Mara. Five stars, the whole city watching. Bring it home and you are King of the Bay.']],
};

export function freshState() {
  return {
    time: 10.0, // in-game clock, hours 0..24
    timeScale: 1,
    money: 150,
    health: 100, maxHealth: 100,
    armour: 0,
    wanted: 0, heat: 0, lastSeen: null, hiddenTimer: 0,
    busted: false, wasted: false, victory: false,
    paused: false, started: false, inMenu: true,
    player: {
      x: -100, z: -100, heading: 0, speed: 0, vy: 0, onGround: true,
      moving: false, running: false, inCar: null, animTime: 0,
      shirt: 0x3a7bd5, pants: 0x2c2c34,
    },
    weapon: 'fists', ammo: { pistol: 24, smg: 60, shotgun: 12 },
    owned: { pistol: false, smg: false, shotgun: false },
    missionIndex: 0, missionActive: false, missionStage: 0, missionTimer: 0,
    missionDone: [], missionText: '', missionMarker: null,
    shopOpen: null, shopIndex: 0,
    radio: 0, muted: false,
    cars: [], traffic: [], peds: [], police: [], heli: null,
    enemies: [], pickups: [], shots: [],
    stats: { stolen: 0, shotsFired: 0, missionsDone: 0, distance: 0 },
    seed: 7, elapsed: 0, fps: 0, frameMs: 0,
    message: '', messageTimer: 0,
    camYaw: 0, camPitch: 0.35,
    weather: 'clear',
  };
}
