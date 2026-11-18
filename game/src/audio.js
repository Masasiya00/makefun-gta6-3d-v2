// SOLMAR BAY 3D — procedural audio: all sound is generated with WebAudio.
// Three radio stations (chill synth, upbeat dance, talk with DJ text lines),
// engine hum that rises with speed, sirens, gunshots, waves and ambience.
// No audio files, no network. M toggles mute... (H is the mute key.)
let ctx = null, master = null, radioGain = null, engineOsc = null, engineGain = null;
let radioTimer = null, currentStation = -1, muted = false;
let noiseBuf = null;

const STATION_NAMES = ['Sunset FM', 'Bay Beats', 'Solmar Talk'];
const TALK_LINES = [
  'Welcome back to Solmar Talk — the bay never sleeps, and neither do we.',
  'Traffic on the Downtown avenue is moving slow today. Drive safe, Solmar.',
  'Rosa from the garage says the red coupe is the fastest thing on four wheels.',
  'Tonight: golden hour over Palm Beach. Best sunset on the coast, folks.',
  'Reminder: the Marina store has the best tacos after midnight. Allegedly.',
];

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    radioGain = ctx.createGain(); radioGain.gain.value = 0.22; radioGain.connect(master);
    engineGain = ctx.createGain(); engineGain.gain.value = 0; engineGain.connect(master);
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 60;
    const engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 400;
    engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineOsc.start();
    // shared noise buffer for waves / shots
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startWaves();
  } catch (_) { ctx = null; }
}

function startWaves() {
  if (!ctx) return;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
  const g = ctx.createGain(); g.gain.value = 0.05;
  src.connect(f); f.connect(g); g.connect(master); src.start();
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08;
  const lg = ctx.createGain(); lg.gain.value = 0.03;
  lfo.connect(lg); lg.connect(g.gain); lfo.start();
}

function note(freq, at, dur, type, vol) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, at + dur);
  o.connect(g); g.connect(radioGain);
  o.start(at); o.stop(at + dur + 0.05);
}

const CHILL = [220, 261.6, 329.6, 392, 329.6, 261.6, 196, 246.9];
const DANCE = [130.8, 164.8, 196, 261.6, 196, 164.8, 130.8, 98];

function playStationBar(station, bar) {
  if (!ctx || muted) return;
  const now = ctx.currentTime + 0.05;
  if (station === 0) {
    const root = CHILL[bar % CHILL.length];
    note(root, now, 1.6, 'sine', 0.5);
    note(root * 1.5, now + 0.4, 1.2, 'triangle', 0.25);
    note(root * 2, now + 0.8, 0.9, 'sine', 0.18);
  } else if (station === 1) {
    const root = DANCE[bar % DANCE.length];
    for (let b = 0; b < 4; b++) {
      note(root, now + b * 0.25, 0.22, 'square', 0.28);
      note(root * 2, now + b * 0.25 + 0.12, 0.12, 'sawtooth', 0.12);
    }
  }
}

export function setStation(S, index) {
  S.radio = ((index % 3) + 3) % 3;
  currentStation = S.radio;
  if (radioTimer) { clearInterval(radioTimer); radioTimer = null; }
  if (!ctx || muted) return;
  let bar = 0;
  if (S.radio === 2) {
    // talk station: a DJ line appears as HUD text every few seconds
    radioTimer = setInterval(() => {
      if (muted || !ctx) return;
      S.message = TALK_LINES[bar % TALK_LINES.length];
      S.messageTimer = 4;
      bar++;
    }, 6000);
    return;
  }
  playStationBar(S.radio, bar++);
  radioTimer = setInterval(() => playStationBar(S.radio, bar++), 1000);
}

export function setMuted(S, m) {
  muted = m; S.muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
  if (m && radioTimer) { clearInterval(radioTimer); radioTimer = null; }
  else if (!m && currentStation >= 0 && currentStation < 2) setStation(S, currentStation);
}

export function updateEngine(S) {
  if (!ctx || !engineOsc) return;
  const car = S.player.inCar;
  if (car && !car.wrecked) {
    engineOsc.frequency.value = 50 + Math.abs(car.speed) * 4;
    engineGain.gain.value = muted ? 0 : 0.06 + Math.abs(car.speed) * 0.002;
  } else {
    engineGain.gain.value = 0;
  }
}

export function playShot(weapon) {
  if (!ctx || muted) return;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = weapon === 'shotgun' ? 200 : 800;
  const g = ctx.createGain();
  g.gain.setValueAtTime(weapon === 'shotgun' ? 0.5 : 0.3, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (weapon === 'shotgun' ? 0.35 : 0.15));
  src.connect(f); f.connect(g); g.connect(master);
  src.start(); src.stop(ctx.currentTime + 0.4);
}

export function playSiren() {
  if (!ctx || muted) return;
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(700, ctx.currentTime);
  o.frequency.linearRampToValueAtTime(950, ctx.currentTime + 0.4);
  o.frequency.linearRampToValueAtTime(700, ctx.currentTime + 0.8);
  const g = ctx.createGain(); g.gain.value = 0.06;
  o.connect(g); g.connect(master);
  o.start(); o.stop(ctx.currentTime + 0.85);
}

export function playPickup() {
  if (!ctx || muted) return;
  note(660, ctx.currentTime, 0.15, 'sine', 0.3);
  note(880, ctx.currentTime + 0.08, 0.2, 'sine', 0.3);
}

export function playBusted() {
  if (!ctx || muted) return;
  note(220, ctx.currentTime, 0.5, 'sawtooth', 0.25);
  note(174, ctx.currentTime + 0.4, 0.8, 'sawtooth', 0.25);
}
