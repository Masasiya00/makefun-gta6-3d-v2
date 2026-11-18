// SOLMAR BAY 3D — save and load through localStorage.
// Stores money, completed missions, owned weapons, player position and
// outfit. Wanted level is always cleared on load, per the brief.
const KEY = 'solmar-bay-3d-save-v1';

export function saveGame(S) {
  try {
    const data = {
      money: S.money, health: S.health, armour: S.armour,
      missionDone: S.missionDone, missionIndex: S.missionIndex,
      owned: S.owned, ammo: S.ammo, weapon: S.weapon,
      x: S.player.x, z: S.player.z, heading: S.player.heading,
      shirt: S.player.shirt, pants: S.player.pants,
      radio: S.radio, time: S.time, savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (_) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) { return null; }
}

export function applySave(S, d) {
  if (!d) return false;
  S.money = d.money ?? S.money;
  S.health = d.health ?? 100;
  S.armour = d.armour ?? 0;
  S.missionDone = Array.isArray(d.missionDone) ? d.missionDone : [];
  S.missionIndex = d.missionIndex ?? S.missionDone.length;
  S.owned = { ...S.owned, ...(d.owned || {}) };
  S.ammo = { ...S.ammo, ...(d.ammo || {}) };
  S.weapon = d.weapon || 'fists';
  S.player.x = d.x ?? S.player.x; S.player.z = d.z ?? S.player.z;
  S.player.heading = d.heading ?? 0;
  S.player.shirt = d.shirt ?? S.player.shirt;
  S.player.pants = d.pants ?? S.player.pants;
  S.radio = d.radio ?? 0; S.time = d.time ?? 10;
  S.wanted = 0; S.heat = 0;
  return true;
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch (_) { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (_) { /* storage unavailable */ }
}
