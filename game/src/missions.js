// SOLMAR BAY 3D — story missions (8), dialogue and objectives.
// Missions unlock in order. Each sets a marker, an objective line and a
// completion test; completing one pays the reward and saves progress.
// Marker targets (x, z): garage (-120,-120), beach (-320,120), docks (-220,40),
// downtown (0,0), marina store (0,180), hideout (300,200), marina finale (40,200).
import { MISSIONS, DIALOGUE } from './state.js';
import { addWanted, clearWanted } from './police.js';

const MARKERS = {
  1: { x: -108, z: -108, label: 'Take the red coupe' },
  2: { x: -320, z: 120, label: 'Reach Palm Beach, then stay hidden' },
  3: { x: 0, z: 0, label: 'Survive the chase — 45 seconds' },
  4: { x: -220, z: 40, label: 'Deliver the package to Dockside' },
  5: { x: 0, z: 0, label: 'Night delivery through Downtown' },
  6: { x: 0, z: 180, label: 'Rob the Marina store, then escape' },
  7: { x: 300, z: 200, label: 'Reach the Bayview hideout' },
  8: { x: 40, z: 200, label: 'Reach the Marina — survive five stars' },
};

export function currentMission(S) {
  return MISSIONS[S.missionIndex] || null;
}

export function startMission(S, index) {
  const m = MISSIONS[index];
  if (!m) return false;
  S.missionIndex = index;
  S.missionActive = true;
  S.missionStage = 0;
  S.missionTimer = 0;
  const mk = MARKERS[m.id];
  S.missionMarker = mk ? { x: mk.x, z: mk.z } : null;
  S.missionText = `${m.id}. ${m.name} — ${mk ? mk.label : m.brief}`;
  const lines = DIALOGUE[m.id] || [];
  S.dialogue = lines.map(([who, text]) => ({ who, text }));
  S.dialogueIndex = 0;
  S.dialogueTimer = 0;
  if (m.id === 2) addWanted(S, 30, 'Police spotted the coupe!');
  if (m.id === 3) { addWanted(S, 55, 'Three stars — helicopter incoming!'); S.missionTimer = 45; }
  if (m.id === 4) { S.hasPackage = true; }
  if (m.id === 5) { S.time = 21.5; addWanted(S, 12, 'Night patrols are out'); }
  if (m.id === 6) { S.missionStage = 0; }
  if (m.id === 7) { addWanted(S, 55, 'Four districts to the hideout!'); }
  if (m.id === 8) { addWanted(S, 95, 'FIVE STARS — the whole city is after you!'); }
  return true;
}

export function completeMission(S) {
  const m = MISSIONS[S.missionIndex];
  if (!m) return;
  S.money += m.reward;
  S.missionDone.push(m.id);
  S.stats.missionsDone++;
  S.missionActive = false;
  S.missionMarker = null;
  S.missionText = `Mission complete: ${m.name} — +$${m.reward}`;
  S.message = `+$${m.reward} — ${m.name} complete!`;
  S.messageTimer = 4;
  S.missionIndex++;
  clearWanted(S);
  if (m.id === 8) { S.victory = true; }
  // cash pickup celebration
  S.pickups.push({ x: S.player.x + 3, z: S.player.z, kind: 'cash', amount: 50 });
  if (window.__saveGame) window.__saveGame();
}

export function failMission(S, why) {
  S.missionActive = false;
  S.missionMarker = null;
  S.missionText = `Mission failed: ${why}. Press M to retry.`;
  S.message = `Mission failed — ${why}`;
  S.messageTimer = 4;
}

export function stepMissions(S, dt) {
  if (!S.missionActive) return;
  const m = MISSIONS[S.missionIndex];
  if (!m) return;
  const p = S.player;
  const at = (x, z, r = 10) => Math.hypot(p.x - x, p.z - z) < r;
  switch (m.id) {
    case 1: {
      if (S.missionStage === 0 && p.inCar && p.inCar.model.id === 'coupe') {
        S.missionStage = 1;
        S.missionMarker = { x: -120, z: -120 };
        S.missionText = '1. First Wheels — drive the coupe back to Rosa\'s garage';
      } else if (S.missionStage === 1 && at(-120, -120, 12)) completeMission(S);
      break;
    }
    case 2: {
      if (at(-320, 120, 25)) S.missionStage = 1;
      if (S.missionStage === 1 && S.wanted === 0) completeMission(S);
      break;
    }
    case 3: {
      S.missionTimer -= dt;
      S.missionText = `3. Hot Pursuit — survive! ${Math.max(0, Math.ceil(S.missionTimer))}s left`;
      if (S.missionTimer <= 0) completeMission(S);
      if (S.busted || S.wasted) failMission(S, 'caught');
      break;
    }
    case 4: {
      if (S.hasPackage && at(-220, 40, 12)) { S.hasPackage = false; completeMission(S); }
      if (S.wanted >= 3) { /* heat is fine, just keep driving */ }
      break;
    }
    case 5: {
      S.missionTimer += dt;
      if (S.missionTimer > 5 && at(0, 0, 14)) completeMission(S);
      break;
    }
    case 6: {
      if (S.missionStage === 0 && at(0, 180, 12)) {
        S.missionStage = 1;
        S.money += 200;
        addWanted(S, 70, 'Store robbed! Four stars!');
        S.missionMarker = { x: 300, z: 200 };
        S.missionText = '6. High Tide Heist — escape to the hideout!';
      } else if (S.missionStage === 1 && at(300, 200, 14) && S.wanted === 0) completeMission(S);
      else if (S.missionStage === 1 && at(300, 200, 14)) {
        S.missionText = '6. High Tide Heist — lose the cops first!';
      }
      break;
    }
    case 7: {
      if (at(300, 200, 14) && S.wanted === 0) completeMission(S);
      else if (at(300, 200, 14)) S.missionText = '7. The Getaway — lose the cops first!';
      break;
    }
    case 8: {
      if (at(40, 200, 14) && S.wanted <= 2) completeMission(S);
      else if (at(40, 200, 14)) S.missionText = '8. King of the Bay — drop to 2 stars or less first!';
      break;
    }
  }
}
