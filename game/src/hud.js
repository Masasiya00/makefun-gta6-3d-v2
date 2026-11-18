// SOLMAR BAY 3D — HUD and circular minimap.
// DOM overlay: money, district, clock, wanted stars, health/armour bars,
// weapon + ammo, speed, mission tracker, radio strip, messages, menus.
// The minimap is a 2D canvas: roads, player arrow, mission marker, police
// blips and shop icons, with a north indicator.
import { districtAt, WEAPONS, SHOPS } from './state.js';

let els = {};
let mapCtx = null;

export function buildHUD() {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div id="hud-top-left">
      <div id="hud-money">$<span id="hud-money-val">150</span></div>
      <div id="hud-district">Solmar Bay</div>
      <div id="hud-clock">10:00</div>
    </div>
    <div id="hud-stars"></div>
    <div id="hud-bars">
      <div class="bar"><div id="bar-health"></div><span>HEALTH</span></div>
      <div class="bar"><div id="bar-armour"></div><span>ARMOUR</span></div>
    </div>
    <div id="hud-weapon">Fists</div>
    <div id="hud-speed"></div>
    <div id="hud-mission"></div>
    <div id="hud-radio">RADIO: Sunset FM</div>
    <div id="hud-message"></div>
    <div id="hud-hint"></div>
    <div id="hud-crosshair">+</div>
    <canvas id="minimap" width="180" height="180"></canvas>
    <div id="hud-dialogue"></div>
    <div id="hud-shop"></div>
    <div id="hud-menu"></div>`;
  els = {
    money: document.getElementById('hud-money-val'),
    district: document.getElementById('hud-district'),
    clock: document.getElementById('hud-clock'),
    stars: document.getElementById('hud-stars'),
    health: document.getElementById('bar-health'),
    armour: document.getElementById('bar-armour'),
    weapon: document.getElementById('hud-weapon'),
    speed: document.getElementById('hud-speed'),
    mission: document.getElementById('hud-mission'),
    radio: document.getElementById('hud-radio'),
    message: document.getElementById('hud-message'),
    hint: document.getElementById('hud-hint'),
    crosshair: document.getElementById('hud-crosshair'),
    dialogue: document.getElementById('hud-dialogue'),
    shop: document.getElementById('hud-shop'),
    menu: document.getElementById('hud-menu'),
  };
  mapCtx = document.getElementById('minimap').getContext('2d');
}

const STATIONS = ['Sunset FM', 'Bay Beats', 'Solmar Talk'];

export function updateHUD(S) {
  els.money.textContent = S.money;
  els.district.textContent = districtAt(S.player.x, S.player.z);
  const h = Math.floor(S.time) % 24, m = Math.floor((S.time % 1) * 60);
  els.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < S.wanted ? '★' : '☆';
  els.stars.textContent = stars;
  els.stars.style.color = S.wanted > 0 ? '#ffd23d' : '#888';
  els.health.style.width = `${S.health}%`;
  els.armour.style.width = `${S.armour}%`;
  const w = WEAPONS[S.weapon];
  const ammo = S.weapon === 'fists' ? '∞' : `${S.ammo[S.weapon] || 0}`;
  els.weapon.textContent = `${w.name}  •  ${ammo}`;
  els.speed.textContent = S.player.inCar ? `${Math.round(Math.abs(S.player.inCar.speed) * 3.6)} km/h` : '';
  els.mission.textContent = S.missionText || 'Free roam — press M for the next mission';
  els.radio.textContent = `RADIO: ${STATIONS[S.radio]}  ${S.muted ? '(muted)' : ''}`;
  els.message.textContent = S.messageTimer > 0 ? S.message : '';
  els.crosshair.style.display = (!S.player.inCar && S.weapon !== 'fists') ? 'block' : 'none';
  // dialogue line
  if (S.dialogue && S.dialogueIndex < S.dialogue.length) {
    const line = S.dialogue[S.dialogueIndex];
    els.dialogue.innerHTML = `<b>${line.who}:</b> ${line.text}<br><i>press T to continue</i>`;
  } else els.dialogue.innerHTML = '';
  drawMinimap(S);
}

export function showHint(text) { els.hint.textContent = text || ''; }

export function showShop(S, shop, items, sel) {
  if (!shop) { els.shop.innerHTML = ''; return; }
  let html = `<div class="panel"><h3>${shop.name}</h3>`;
  items.forEach((it, i) => {
    html += `<div class="shop-row${i === sel ? ' sel' : ''}">${i + 1}. ${it.name} — $${it.price} <span>${it.desc}</span></div>`;
  });
  html += `<div class="panel-foot">1-${items.length} buy • Esc close • You have $${S.money}</div></div>`;
  els.shop.innerHTML = html;
}

export function showMenu(S, kind, extra = '') {
  let html = '';
  if (kind === 'title') {
    html = `<div class="panel big"><h1>SOLMAR BAY 3D</h1><p>A sun-soaked open-world crime game.<br>You are Mara, a driver new to Solmar Bay.</p>
      <p>Press <b>ENTER</b> to play &nbsp;•&nbsp; <b>L</b> to continue saved game</p>
      <p class="dim">WASD move • Mouse look • E enter car • F punch / click shoot<br>1-4 weapons • R radio • M mission • P pause • H mute</p></div>`;
  } else if (kind === 'pause') {
    html = `<div class="panel big"><h1>PAUSED</h1><p>Press <b>P</b> or <b>Esc</b> to resume • <b>S</b> save • <b>Q</b> quit to title</p>${extra}</div>`;
  } else if (kind === 'busted') {
    html = `<div class="panel big"><h1>BUSTED!</h1><p>The police caught you. You lost $${extra}.</p><p>Press <b>ENTER</b> to retry</p></div>`;
  } else if (kind === 'wasted') {
    html = `<div class="panel big"><h1>WASTED</h1><p>Mara is down. You lost $${extra}.</p><p>Press <b>ENTER</b> to retry</p></div>`;
  } else if (kind === 'victory') {
    html = `<div class="panel big"><h1>KING OF THE BAY</h1><p>All 8 missions complete. Solmar Bay is yours, Mara.</p><p>Press <b>ENTER</b> for free roam</p></div>`;
  } else if (kind === 'brief') {
    html = `<div class="panel big"><h1>${extra}</h1><p>Press <b>ENTER</b> to start</p></div>`;
  }
  els.menu.innerHTML = html;
}

export function clearMenu() { els.menu.innerHTML = ''; }

function drawMinimap(S) {
  if (!mapCtx) return;
  const ctx = mapCtx, W = 180, C = W / 2;
  ctx.clearRect(0, 0, W, W);
  ctx.save();
  ctx.beginPath(); ctx.arc(C, C, C - 2, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#1c2a1e'; ctx.fillRect(0, 0, W, W);
  const sx = (x) => C + (x / 360) * (C - 6);
  const sz = (z) => C + (z / 260) * (C - 6);
  // ocean
  ctx.fillStyle = '#1e6fa8'; ctx.fillRect(0, 0, sx(-330), W);
  // roads
  ctx.strokeStyle = '#5a5a60'; ctx.lineWidth = 3;
  for (const rx of [-270, -180, -90, 0, 90, 180, 270]) {
    ctx.beginPath(); ctx.moveTo(sx(rx), 0); ctx.lineTo(sx(rx), W); ctx.stroke();
  }
  for (const rz of [-180, -90, 0, 90, 180]) {
    ctx.beginPath(); ctx.moveTo(0, sz(rz)); ctx.lineTo(W, sz(rz)); ctx.stroke();
  }
  // shops
  ctx.fillStyle = '#ffd23d';
  for (const s of SHOPS) { ctx.beginPath(); ctx.arc(sx(s.x), sz(s.z), 3, 0, Math.PI * 2); ctx.fill(); }
  // mission marker
  if (S.missionMarker) {
    ctx.fillStyle = '#ff4a3d';
    ctx.beginPath(); ctx.arc(sx(S.missionMarker.x), sz(S.missionMarker.z), 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // police blips
  ctx.fillStyle = '#4a8aff';
  for (const c of S.police) { ctx.beginPath(); ctx.arc(sx(c.x), sz(c.z), 3, 0, Math.PI * 2); ctx.fill(); }
  if (S.heli) { ctx.fillStyle = '#8affff'; ctx.beginPath(); ctx.arc(sx(S.heli.x), sz(S.heli.z), 4, 0, Math.PI * 2); ctx.fill(); }
  // player arrow
  ctx.save();
  ctx.translate(sx(S.player.x), sz(S.player.z));
  ctx.rotate(S.player.heading);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  // ring + north
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(C, C, C - 2, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.fillText('N', C - 4, 14);
}
