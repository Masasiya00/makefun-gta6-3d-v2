# SOLMAR BAY 3D

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Masasiya00/makefun-gta6-3d-v2/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Masasiya00/makefun-gta6-3d-v2/reward.svg)](https://make.fun/c/gta6-01)

An original open-world crime game in the browser, built for the make.fun **gta6-01** competition. Explore the sun-soaked coastal city of **Solmar Bay** — eight districts from Palm Beach to the Airfield — on foot and by car, steal cars, outrun the police, and play through 8 story missions as Mara, a driver new to town.

## What is in the game

- **Open world**: 8 districts, beach + animated ocean, Downtown towers, Dockside containers, Marina yachts, Airfield runway, day/night cycle with golden-hour sunsets.
- **On foot**: third-person camera, walk/run/jump, punch and shoot.
- **Cars**: 6 drivable models (hatchback, sedan, coupe, SUV, pickup, taxi) with headlights, brake lights, engine sound and damage. Traffic (26 cars) and 44 pedestrians keep the city alive.
- **Wanted system**: 1–5 stars, police cars that chase and ram, a helicopter with a searchlight from 3 stars, heat that fades when you stay out of sight. Busted / Wasted screens.
- **8 story missions** with dialogue, objectives and rewards ($300–$2,500), from *First Wheels* to the finale *King of the Bay*.
- **Combat**: fists, pistol, SMG, shotgun, tracers, hit markers, damage numbers, enemies in missions.
- **4 shops**: Rosa's Garage (repair/armour), Ironworks Arms (weapons/ammo), Tico Tacos (health), Neon Threads (outfits). Money from missions and pickups.
- **HUD + minimap**: money, district, clock, wanted stars, health/armour, weapon/ammo, speed, mission tracker, circular minimap with police blips and mission markers.
- **Radio**: 3 procedural WebAudio stations (Sunset FM, Bay Beats, Solmar Talk) plus engine, sirens, gunshots and waves — no audio files.
- **Save**: progress saves to localStorage (money, missions, weapons, position).

## How to play

Serve the game folder with any static server and open `game/index.html` in desktop Chrome:

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests — everything is vendored under `game/`.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Move / drive |
| Mouse | Look around (click to lock) |
| Shift | Sprint |
| Space | Jump / handbrake (driving) |
| E | Enter / exit car, open shop |
| F / mouse click | Punch / shoot |
| 1–4 | Switch weapon (fists, pistol, SMG, shotgun) |
| M | Start next mission |
| T | Advance dialogue |
| R | Next radio station |
| H | Mute |
| P / Esc | Pause (S save, Q quit to title) |
| Enter | Start / confirm |

Deterministic screenshots: `?shot=chase|city|mission|night&seed=7`. Self-test: `?autoplay`.

## Tech

three.js (vendored minified build under `game/vendor/three/`). Simulation runs in fixed 1/60 s steps, separated from rendering, HUD and audio. All art is procedural low-poly geometry; all sound is procedural WebAudio.

## License

MIT — see `LICENSE`.
