// SOLMAR BAY 3D — shops and economy.
// Four shops near their doors; E opens the menu, number keys buy, Esc closes.
// Rosa's Garage: repair + armour. Ironworks Arms: weapons + ammo.
// Tico Tacos: food restores health. Neon Threads: outfit colours.
import { SHOPS, WEAPONS } from './state.js';

export function shopItems(S, shop) {
  switch (shop.kind) {
    case 'garage': return [
      { id: 'repair', name: 'Repair current car', price: 120, desc: 'Full repair' },
      { id: 'armour', name: 'Body armour +50', price: 200, desc: 'Wearable protection' },
    ];
    case 'arms': return [
      { id: 'pistol', name: 'P9 Pistol', price: WEAPONS.pistol.price, desc: '12-round sidearm' },
      { id: 'smg', name: 'K9 SMG', price: WEAPONS.smg.price, desc: 'Rapid fire' },
      { id: 'shotgun', name: 'Boomstick', price: WEAPONS.shotgun.price, desc: 'Close-range power' },
      { id: 'ammo', name: 'Ammo pack', price: 80, desc: 'Ammo for all guns' },
    ];
    case 'tacos': return [
      { id: 'taco', name: 'Tico Taco', price: 15, desc: '+25 health' },
      { id: 'burrito', name: 'Big Burrito', price: 30, desc: '+50 health' },
      { id: 'feast', name: 'Fiesta Feast', price: 60, desc: 'Full health' },
    ];
    case 'threads': return [
      { id: 'blue', name: 'Ocean Blue outfit', price: 100, desc: 'Blue shirt' },
      { id: 'red', name: 'Sunset Red outfit', price: 100, desc: 'Red shirt' },
      { id: 'gold', name: 'Golden Hour outfit', price: 250, desc: 'Gold shirt + dark pants' },
    ];
    default: return [];
  }
}

export function nearestShop(S, maxDist = 14) {
  let best = null, bd = maxDist;
  for (const s of SHOPS) {
    const d = Math.hypot(S.player.x - s.x, S.player.z - s.z);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

export function buyItem(S, shop, item) {
  if (S.money < item.price) { S.message = 'Not enough cash!'; S.messageTimer = 2; return false; }
  S.money -= item.price;
  switch (item.id) {
    case 'repair': if (S.player.inCar) { S.player.inCar.health = 100; S.player.inCar.wrecked = false; } break;
    case 'armour': S.armour = Math.min(100, S.armour + 50); break;
    case 'pistol': case 'smg': case 'shotgun':
      S.owned[item.id] = true; S.weapon = item.id;
      S.ammo[item.id] = (S.ammo[item.id] || 0) + WEAPONS[item.id].ammo;
      break;
    case 'ammo': S.ammo.pistol += 24; S.ammo.smg += 60; S.ammo.shotgun += 12; break;
    case 'taco': S.health = Math.min(S.maxHealth, S.health + 25); break;
    case 'burrito': S.health = Math.min(S.maxHealth, S.health + 50); break;
    case 'feast': S.health = S.maxHealth; break;
    case 'blue': S.player.shirt = 0x2e6ad8; break;
    case 'red': S.player.shirt = 0xd81e2c; break;
    case 'gold': S.player.shirt = 0xf5c518; S.player.pants = 0x1a1a22; break;
    default: break;
  }
  S.message = `Bought ${item.name} (-$${item.price})`;
  S.messageTimer = 2;
  return true;
}
