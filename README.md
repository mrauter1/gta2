# Block City

`Block City` is a browser-only Three.js sandbox slice that recreates a compact GTA-style loop with original low-poly art, five district choices, on-foot traversal, enterable vehicles, repeatable courier missions, heat pressure, failure or respawn recovery, and shared desktop plus touch controls.

## What Was Built

- A static-web Three.js game shell launched from [index.html](index.html).
- Five selectable districts with persisted selection, procedural preview cards, landmarks, spawn points, vehicle stashes, mission nodes, and district seeds.
- A tuned main district, `Sunset Grid`, with on-foot free roam, vehicle entry or exit, traffic, pedestrians, minimap routing, a mission board, package or checkpoint or crew-lift missions, heat search zones, and respawn recovery.
- A persistent settings drawer for volume, mute, look sensitivity, invert look, touch layout, and graphics quality.
- A validation bundle under [validation](validation) with screenshots, a browser-driven audit script, comparison metrics, logs, and evidence notes.

## Run Locally

Serve the repository root with any static file server.

```bash
python3 -m http.server 8000
```

Then open `http://127.0.0.1:8000/` in a desktop browser or a touch-capable mobile browser.

The game has no backend, no build step, and no non-browser runtime requirement.

## How To Play

1. Open the menu and pick a district or use `Deploy Saved Run`.
2. Spawn on foot, move toward the parked vehicle, and use the ride control to enter.
3. Drive to a live contract light, accept a mission, and follow the minimap route.
4. Complete the package, checkpoint, or crew-lift objective for cash.
5. Avoid collisions and high-speed chaos to keep heat low, or use the home lane to cool down.
6. If you fail, get busted, or total the vehicle, the run respawns into free roam without reloading the page.

## Controls

### Desktop

- `WASD` or arrow keys: move on foot, throttle, brake, and steer in vehicles
- `Shift`: sprint
- Mouse drag on the world canvas: orbit or look
- `E`: enter or exit vehicle
- `F`: interact, accept run, tag pickup, or complete mission objective
- `B`: open or close the field bag
- `R`: reset the current ride to the nearest spawn
- `1-5`: trigger route pulse, horn or whistle, ride reset, camera snap, or garage ping
- `Esc`: pause or resume

### Mobile / Touch

- Left d-pad: move on foot or steer in a vehicle
- `LOOK DRAG`: touch look pad
- `Ride`, `Use`, `Pause`: on-foot actions
- `Exit`, `Use`, `Handbrake`, `Brake / Rev`, `Accelerate`, `Pause`: in-vehicle actions

Touch mode is forced automatically on coarse-pointer devices and can also be tested with `?touch=true`.

## District Catalog And Generation

District data lives in [src/data/districts.js](src/data/districts.js) and procedural block filling plus traffic or pedestrian layouts live in [src/data/world-layout.js](src/data/world-layout.js).

### Districts

- `Sunset Grid` (`SG-041`): amber avenue civic core, tuned main district
- `Brickline District` (`BD-128`): brownstone tram cut
- `Harbor Blocks` (`HB-277`): warehouse dusk docks
- `Neon Mile` (`NM-384`): entertainment strip
- `Industrial Loop` (`IL-512`): machine-yard ring route

Each district record includes:

- theme and description
- procedural seed
- spawn point
- home or garage point
- vehicle spawn points
- mission points
- landmark labels
- preview colors and road layout

## Missions

Mission definitions are assembled in [src/state/game-state.js](src/state/game-state.js).

- `PARCEL RUN`: accept at the garage, tag the pickup on foot, then deliver by vehicle
- `CHECKPOINT DASH`: stay in the car and clear timed gates
- `CREW LIFT`: pick up the rider marker, then return to the garage lane

Runs are repeatable in free roam and update the mission card, minimap route, timers, rewards, and toast feedback.

## Vehicles, Heat, Traffic, And Failure

Gameplay state and simulation live in [src/systems/gameplay.js](src/systems/gameplay.js).

- On-foot traversal uses explicit collision resolution against buildings, props, and static vehicles.
- Vehicles support acceleration, braking, reverse, steering, and a drift-lite handbrake.
- Traffic and pedestrians animate through district-specific and procedural routes.
- Heat rises from reckless driving, collisions, handbrake abuse, and pressure zones.
- Search zones tighten at higher heat levels and can bust the player out of a run.
- Player health and vehicle durability both feed the respawn loop.

## Three.js Architecture

The runtime stays modular rather than packing the whole game into one file.

- [src/main.js](src/main.js): bootstrap, event wiring, persistence, and the frame loop
- [src/render/three-world.js](src/render/three-world.js): renderer, low-poly world models, camera, lighting, and scene updates
- [src/systems/input.js](src/systems/input.js): desktop and touch inputs
- [src/systems/gameplay.js](src/systems/gameplay.js): movement, missions, heat, and respawn logic
- [src/state/game-state.js](src/state/game-state.js): persisted settings, session state, mission scripts, and query overrides
- [src/ui/hud.js](src/ui/hud.js): HUD, minimap, district cards, and settings rendering
- [src/systems/audio.js](src/systems/audio.js): original Web Audio cues

## Originality And Asset Notes

- Rendering uses the official Three.js `0.166.0` ES module from jsDelivr.
- World art, cars, pedestrians, signs, mission markers, and HUD surfaces are original low-poly or procedurally generated browser assets.
- Audio cues are generated in-browser with Web Audio rather than imported commercial sound effects.
- No protected GTA, Rockstar, city-name, or real-brand content is surfaced in the UI.

## Validation Commands And Latest Results

Latest audited command:

```bash
bash validation/block-city-run-validation.sh
```

Latest successful run:

- started: `2026-06-01T06:37:11.912Z`
- finished: `2026-06-01T06:38:56.049Z`
- exit status: `0`
- generated report: `validation/artifacts/block-city-run-report.json`
- generated screenshots:
  - `validation/screenshots/desktop-district-select.png`
  - `validation/screenshots/desktop-on-foot-reference.png`
  - `validation/screenshots/desktop-in-vehicle-hud.png`
  - `validation/screenshots/mobile-landscape-on-foot.png`
  - `validation/screenshots/mobile-landscape-vehicle.png`
  - `validation/screenshots/mobile-portrait-sanity.png`
- browser checks passed: `53`
- reference comparison: skipped for the Render-style packaged output because `gta.png` is a local-only validation reference image

Supporting logs:

- `validation/logs/block-city-run-validation.log`
- `validation/logs/block-city-http-server.log`

Generated validation artifacts, screenshots, logs, the local reference image, and the optional vendored Three.js file are ignored by git to keep the deployed repository small.

## Render Deployment

The live Render static site uses `SITE_TGZ_B64` as a build-time environment variable containing the validated static app archive. The build command unpacks that archive into `public/`, and Render serves `public/`.

## Known Limitations

- The HUD layout and sunset palette track the reference closely, but the world framing is still more abstract and lower-density than the reference screenshot.
- The feel loop is strongest in `Sunset Grid`; the other districts are selectable and playable but are lighter variants rather than equally dense hero spaces.
- Touch screenshots still show aggressive HUD overlap at very small portrait widths. The layout remains playable enough for sanity coverage, but landscape is the intended mobile orientation.
- Audio unlock still depends on the first user interaction, which is normal browser behavior for Web Audio.
