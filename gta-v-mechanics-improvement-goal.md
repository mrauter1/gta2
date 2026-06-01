# Botpipe Goal: GTA V-Quality Mechanics Improvement Pass

## Primary Objective

Upgrade the existing browser-only Three.js game into a much more playable open-world city action vertical slice. The target is the control responsiveness, sandbox readability, and core mechanics feel of GTA V, scaled down to a static browser prototype with original assets and original game content.

GTA V is the benchmark for feel and mechanics only. Do not copy GTA V assets, maps, missions, UI, audio, characters, brands, city names, or protected presentation. Keep the shipped game original and continue using the `Block City` identity unless a new original title is intentionally chosen.

## Current Issues To Fix

- WASD and arrow-key movement are not reliable or responsive enough.
- On-foot movement does not feel grounded, camera-relative, or GTA-like.
- Vehicle input and steering need stronger arcade driving feel.
- Collision handling is too weak: actors can clip, snag, pass through, or respond inconsistently.
- Cars can leave or go over the playable map instead of colliding with world bounds.
- Player character size is not proportional to vehicles, sidewalks, lanes, and buildings.
- There is no working gun, aim, or shoot ability.
- The overall playability still feels like a prototype demo instead of a compact GTA-like sandbox.

## Hard Constraints

1. The app must remain a browser-only static web app.
2. Three.js must remain the primary rendering and runtime layer.
3. No backend may be required for local single-player play.
4. Keep the existing modular architecture. Prefer focused changes in:
   - `src/systems/input.js`
   - `src/systems/gameplay.js`
   - `src/render/three-world.js`
   - `src/state/game-state.js`
   - `src/ui/hud.js`
   - `src/data/world-layout.js`
   - `src/data/districts.js`
   - `validation/block-city-run-validation.mjs`
5. Do not add fake UI for mechanics that do not work. If the HUD shows a gun, ammo, reticle, heat, or mission state, the mechanic must function.
6. Do not introduce copied GTA, Rockstar, real-brand, or commercial-game assets.
7. The final experience should be GTA V-like in responsiveness and systemic mechanics, but fully original in content.

## Required Implementation Work

### 1. Input And Movement Overhaul

Fix desktop keyboard movement first.

Acceptance requirements:

- WASD and arrow keys both move the player on foot.
- WASD and arrow keys both drive vehicles in vehicle mode.
- Movement must continue to work after clicking HUD buttons, opening or closing menus, entering vehicles, exiting vehicles, pausing, and resuming.
- Key-up handling must prevent stuck movement.
- Browser scrolling, focus loss, and button focus must not break controls.
- Diagonal input must be normalized so diagonal movement is not faster than cardinal movement.
- Movement must be delta-time stable.
- On-foot movement must be camera-relative or otherwise clearly third-person readable.
- On-foot player rotation must align naturally with movement direction.
- Sprint must feel responsive without making collision unreliable.
- Vehicle throttle, brake, reverse, steering, and handbrake must be immediately readable.

Desired GTA V-like feel:

- On foot: responsive acceleration, short stopping distance, readable turning, no sliding like a vehicle.
- In vehicle: heavier momentum, arcade steering, clear braking/reverse behavior, and handbrake-assisted turning.

### 2. Collision And World Physics Overhaul

Replace weak collision behavior with reliable actor-vs-world resolution.

Acceptance requirements:

- Player cannot walk through buildings, major props, parked vehicles, traffic, or map bounds.
- Vehicles cannot drive through buildings, major props, parked vehicles, traffic, pedestrians, or map bounds.
- High-speed vehicles must not tunnel through obstacles.
- Colliding with a wall or blocker should slide, stop, bounce, or damage the vehicle in a controlled way.
- Player collision should slide along walls instead of hard-sticking whenever possible.
- Static and dynamic collision radii must match the visible object sizes closely.
- Collision response must not teleport the player or vehicle unless using an explicit stuck recovery action.
- Dynamic traffic and pedestrian collision must update heat, damage, or avoidance behavior.

Implementation guidance:

- Use broad-phase filtering against nearby blockers.
- Use swept circle or swept capsule checks for fast movement where practical.
- Use object radii or oriented boxes that match visible car and player proportions.
- Keep collision code testable and isolated from rendering.

### 3. Keep Cars Inside The Playable Map

Cars must never be able to leave, float over, or drive beyond the designed map.

Acceptance requirements:

- The playable map must have physical boundary colliders or guardrail/barrier collision.
- A vehicle hitting the map edge should bounce, stop, scrape, or take damage.
- The vehicle must remain recoverable after repeated boundary impacts.
- Boundary logic must work at high speed, in reverse, while handbraking, and during diagonal steering.
- The player must not be able to exit a vehicle outside the playable map.
- Respawn and vehicle reset must place the actor at safe, valid map coordinates.

Do not rely only on end-of-frame hard clamping as the primary behavior. Clamping may remain as a final safety net, but the player should perceive a real collision.

### 4. Player, Vehicle, And City Scale Pass

Make the player character proportional to the world.

Acceptance requirements:

- Player height, width, and collision radius must read correctly next to cars.
- Cars must fit lanes and parking spaces.
- Sidewalk width, road width, vehicle size, pedestrian size, and building door/window scale must feel coherent.
- The third-person camera must frame the player and vehicle at a playable scale.
- The player must not look like a toy beside giant roads or like a giant beside small cars.
- Minimap and HUD scale must remain readable after world-scale changes.

Target proportions:

- Player: human-sized, roughly chest-height relative to a sedan roofline.
- Sedan: wide enough for one lane, visibly larger than the player, not oversized relative to roads.
- Roads: allow traffic flow and turning, but keep the compact district readable.
- Buildings: tall enough to frame a city, with sidewalk-level details that match player scale.

### 5. Add A Working Gun, Aim, And Shoot Ability

Add a compact non-graphic sidearm/shooting loop.

Acceptance requirements:

- Player has an original sidearm or generic action tool, not a copied weapon brand.
- Desktop supports aim and fire. Recommended mapping:
  - mouse movement or camera controls for aim direction,
  - left click or a clear keyboard action for fire,
  - optional reload key if ammo is implemented.
- Touch supports aim/fire without requiring keyboard or mouse.
- Shooting must create a real gameplay effect, such as raycast/projectile hits, prop impacts, vehicle damage, target markers, or patrol response.
- Shots must not pass through solid buildings or major blockers.
- Shooting should raise heat.
- HUD must show only honest information: ammo, cooldown, reticle, or equipped state if these are implemented.
- Audio/visual feedback must exist: muzzle flash, tracer, impact spark, hit marker, or equivalent lightweight original effects.
- No gore is required or desired.
- NPCs should react in a simple way: flee, scatter, alert patrol, or increase heat.
- Shooting from inside a vehicle is optional, but if implemented it must be controllable and tested.

### 6. Improve GTA V-Like Sandbox Playability

The game should feel like a small open-world city action sandbox, not just a movement demo.

Acceptance requirements:

- Entering and exiting cars must feel immediate and reliable.
- Camera behavior must be smooth and readable on foot and in vehicles.
- Driving should support controlled chaos: traffic bumps, handbrake turns, damage, heat, and recovery.
- Heat/wanted pressure must respond to reckless driving, collisions, and shooting.
- Patrol/security response should create pressure without requiring complex AI.
- Missions must remain playable after adding combat and collision changes.
- The first minute of play should clearly communicate:
  - where the player is,
  - where the nearest car is,
  - how to move,
  - how to enter the car,
  - how to cause or avoid heat,
  - how to start or continue a mission.
- The game loop must support free roam after mission completion or failure.

## Required Validation

Extend the existing browser validation instead of only claiming behavior manually.

Update `validation/block-city-run-validation.mjs` to cover:

1. WASD on-foot movement.
2. Arrow-key on-foot movement.
3. WASD vehicle driving.
4. Arrow-key vehicle driving.
5. Key-up release behavior with no stuck movement.
6. Player blocked by buildings or major props.
7. Vehicle blocked by buildings or major props.
8. Vehicle blocked by map bounds at speed.
9. Player cannot exit vehicle outside valid map coordinates.
10. Player scale and vehicle scale sanity checks using debug state and screenshot review.
11. Gun equip/fire works on desktop.
12. Shot creates a real state change or visible effect.
13. Shooting raises heat.
14. Shots do not pass through buildings.
15. Touch movement still works.
16. Touch vehicle controls still work.
17. Touch fire/action works if shooting is available on mobile.
18. Mission flow still works after the mechanics changes.
19. Failure/respawn still works after the mechanics changes.
20. No page-level console errors.

Run and repair until this command passes:

```bash
bash validation/block-city-run-validation.sh
```

If testing the deployed static output, also run:

```bash
node validation/block-city-run-validation.mjs --base-url=<deployed-url>
```

## Botpipe Producer Instructions

Implement the mechanics pass recursively until validation passes.

The producer must:

1. Inspect the current input, gameplay, rendering, state, and validation modules.
2. Identify the root causes of bad WASD/arrow movement.
3. Implement real fixes, not only validation workarounds.
4. Add shooting mechanics with honest gameplay effect and HUD affordance.
5. Rework collisions and map bounds so actors cannot pass through or leave the map.
6. Tune scale and camera until screenshots read as a coherent third-person city action game.
7. Extend automated validation for the new behavior.
8. Run validation and repair failures.
9. Write a concise evidence note with:
   - changed files,
   - mechanics added,
   - validation command output,
   - known remaining limitations.

## Botpipe Verifier Instructions

The verifier must independently inspect the repo and reject if any required mechanic is fake, untested, or only cosmetically implemented.

Reject if:

- WASD or arrow keys fail in either foot or vehicle mode.
- Any key can get stuck after key-up, focus changes, pause, or menu transitions.
- Vehicle map bounds are handled only by invisible teleporting or end-frame clamping.
- Buildings, props, traffic, or pedestrians can be passed through during normal play.
- Gun UI exists but shooting has no real effect.
- Shooting does not raise heat or interact with collision/line-of-sight.
- Player/cars/buildings remain visibly out of proportion.
- Mission flow regresses.
- Mobile touch controls regress.
- Validation is not updated to cover the new mechanics.
- The game uses protected GTA/Rockstar assets, names, maps, UI, audio, or brands.

Accept only when:

- The browser validation passes.
- The game is playable on desktop and mobile.
- The first minute feels like a compact original GTA V-inspired open-world action sandbox.
- Remaining limitations are documented honestly.

## Definition Of Done

The task is done when the shipped game:

1. Has reliable WASD and arrow movement.
2. Has reliable vehicle controls.
3. Has correct world, actor, and vehicle collision.
4. Keeps cars inside the playable map through real boundary collision.
5. Has player scale corrected against vehicles and buildings.
6. Has a working gun/shoot loop with input, feedback, collision, and heat integration.
7. Feels substantially closer to GTA V-style open-world controls and mechanics while remaining an original browser-scale game.
8. Passes the expanded validation suite.
9. Remains deployable as a static web app.
