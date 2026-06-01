Primary objective:
Create a polished, playable browser-based open-world city action vertical slice that works as a static web app on both desktop and mobile browsers.

The game must support the complete flow:

menu → district select → spawn on foot → walk around → approach vehicle → enter vehicle → drive through traffic → accept mission → follow minimap waypoint → complete objective → earn reward → trigger/avoid heat → take damage or fail → respawn → continue free roam → return/change district.

The game must feel mechanically like a small GTA-style open-world sandbox: third-person free roam, enterable vehicles, arcade driving, traffic, pedestrians, minimap navigation, mission markers, light city chaos, heat/wanted pressure, fail states, respawn, and repeatable free-roam missions.

The implementation must run as a browser-only static web app. It should build into static files that can be hosted on a normal static host such as GitHub Pages, Netlify, Vercel static output, Cloudflare Pages, or any simple static file server. It must not require a native game engine, desktop binary, mobile app install, custom backend, server-rendered runtime, or non-browser executable to play locally.

Desktop and mobile controls are both required.

Desktop control requirements:

* Keyboard and mouse must be fully supported.
* On-foot movement should support WASD or arrow keys.
* Mouse should control camera orbit/look.
* Enter/exit vehicle should use a clear keyboard interaction key, such as E or F.
* Vehicle driving should support accelerate, brake, reverse, steering, and handbrake/drift-lite behavior.
* Shooting/combat or action mechanics, if implemented, should work with mouse or keyboard.
* Pause/menu should be accessible from keyboard.
* Desktop controls must feel responsive in a normal browser tab.
* Pointer lock may be used on desktop where appropriate, but the game must still fail gracefully if pointer lock is unavailable.

Mobile control requirements:

* Touch controls must be fully supported.
* The game must be playable without a physical keyboard.
* Use a mobile-friendly on-screen control layout:

  * left virtual joystick or directional pad for on-foot movement and vehicle steering,
  * right-side camera/look area or swipe-to-look behavior,
  * enter/exit vehicle button,
  * interact/action button,
  * accelerate button,
  * brake/reverse button,
  * handbrake/drift button,
  * pause/menu button.
* Mobile controls must adapt between on-foot mode and vehicle mode.
* Buttons must be large enough for touch input and must not block critical gameplay information.
* The minimap, mission panel, health, durability, heat, and speed indicators must remain readable on mobile.
* The game should be landscape-first on phones, but it should not break completely in portrait.
* Mobile Safari and Android Chrome should be considered primary mobile targets.
* Audio should unlock correctly after the first user tap.
* Fullscreen or “add to home screen” support is optional, but the game must remain playable in a normal mobile browser tab.

Responsive UI requirements:

* The HUD must automatically adapt to desktop and mobile screen sizes.
* Desktop can use a fuller HUD layout with minimap, mission panel, speedometer, health, cash/XP, and heat indicator.
* Mobile should use a compressed HUD layout that prioritizes:

  * minimap,
  * current objective,
  * health/durability,
  * heat level,
  * essential touch controls.
* UI must avoid SaaS-style panels and remain game-like.
* Touch controls should be hidden on desktop and shown on touch/coarse-pointer devices.
* Keyboard hints should be shown on desktop and hidden or minimized on mobile.
* The same gameplay features must be accessible on both desktop and mobile.

Static web app constraints:

1. The app must run entirely in the browser.
2. The app must be buildable into static files.
3. The game must work from a static host with no required backend.
4. Local single-player mode must work without external services.
5. Multiplayer, if implemented, must be optional and gracefully disabled when no backend or realtime configuration is available.
6. Missing multiplayer configuration must not prevent local play.
7. All procedural assets, game data, districts, missions, HUD, and controls must load from the static app bundle or local static files.
8. No native mobile app, native desktop app, Electron shell, Unity/Unreal build, or server process may be required for gameplay.

Implementation stack and architecture requirements:

1. Use Three.js as the primary implementation technology for the 3D game scene.
2. Three.js should handle the world scene, cameras, lighting, materials, procedural geometry, vehicles, characters, props, interaction markers, and runtime rendering.
3. Do not replace Three.js with Unity, Unreal, Babylon.js, PlayCanvas, raw WebGL-only rendering, CSS-only 3D, or a canvas-only 2D implementation.
4. Browser framework and build tooling choices are flexible, but the playable game layer must be built around Three.js and must still produce static files.
5. The implementation must be modular. Avoid one giant game file or tightly coupled script where rendering, input, gameplay, UI, missions, and data are all mixed together.
6. Split the code into focused modules or systems, such as app/bootstrap, Three.js scene setup, procedural city/district generation, player controller, vehicle controller, traffic, pedestrians, missions, heat/wanted pressure, HUD/minimap, input, audio, and game state.
7. Keep district definitions, mission definitions, vehicle/pedestrian data, tuning constants, and reusable procedural builders separate from the main runtime loop where practical.
8. Use clear module boundaries so desktop controls, mobile controls, gameplay systems, UI/HUD, and procedural world generation can be tested and iterated independently.
9. Shared state should be explicit and small. Prefer structured game-state objects, event-style handoffs, or system update functions over hidden globals.
10. The final code should be understandable as a maintainable browser game prototype, not just a single-file demo.

Input/platform acceptance criteria:
The task is complete only if:

1. The game is playable on desktop using keyboard and mouse.
2. The game is playable on mobile using touch controls only.
3. The player can walk, enter a vehicle, drive, complete at least one mission, fail/respawn, and continue playing on both desktop and mobile.
4. The HUD remains readable on both desktop and mobile.
5. Touch controls do not obscure the main gameplay view.
6. Desktop controls do not require mobile UI.
7. Mobile controls do not require keyboard input.
8. The production build outputs static files and can be served by a static file server.
9. Local play works without backend configuration.
10. Optional multiplayer, if present, fails gracefully when unavailable.
11. The 3D implementation uses Three.js as the primary rendering/runtime layer.
12. The codebase is modular, with clear separation between scene/rendering, controls, gameplay systems, data, HUD, audio, and app bootstrap.

Additional verifier gate — Desktop controls:
Using a desktop browser:

* menu navigation works,
* district selection works,
* keyboard movement works,
* mouse camera works,
* enter/exit vehicle works,
* vehicle acceleration/brake/reverse/steering works,
* handbrake or drift-lite behavior works,
* mission interaction works,
* pause/menu works,
* respawn works.

Additional verifier gate — Mobile controls:
Using a mobile browser or mobile viewport with touch simulation:

* menu navigation works with touch,
* district selection works with touch,
* on-foot movement works with virtual controls,
* camera/look control works with touch,
* enter/exit vehicle works with a touch button,
* vehicle acceleration/brake/reverse/steering works with touch controls,
* handbrake/drift button works,
* mission interaction works with touch,
* pause/menu works with touch,
* respawn works with touch,
* the game remains playable without a keyboard.

Additional verifier gate — Static deployment:

* production build succeeds,
* output is static,
* app can be served from a simple static file server,
* direct browser navigation to the app works,
* local single-player mode works without backend,
* missing multiplayer configuration does not crash the app,
* mobile and desktop controls both work from the static build.

You are implementing a browser-only, GTA-inspired open-world city action prototype.

The goal is to create an original game that feels mechanically and experientially like a small browser-scale GTA-style sandbox, while using fully original procedural assets and avoiding any copyrighted Grand Theft Auto, Rockstar, real-brand, or commercial-game content.

This must not be just a low-poly city viewer or a driving demo. It must feel like a playable open-world urban action game: third-person character control, walkable city streets, enterable vehicles, arcade driving, traffic, pedestrians, mission markers, minimap navigation, city chaos, vehicle collisions, damage/fail states, respawn, rewards, and a light wanted/heat system.

The game should capture the broad GTA-like feel through mechanics and pacing, not through copied assets, copied missions, copied cities, copied UI, copied names, or copied characters.

Required GTA-like feel:

1. The player starts on foot in a compact open city district.
2. The player can freely walk around the city in third person.
3. The player can approach vehicles and enter them.
4. The player can exit vehicles and continue on foot.
5. Vehicles must feel like arcade open-world cars: acceleration, braking, reverse, steering, handbrake or drift-lite turn behavior, collision bumps, vehicle durability, and reset if stuck.
6. The city must contain moving traffic and simple pedestrians so it feels alive.
7. The player should be able to cause light city chaos through collisions, fast driving, mission actions, or entering restricted areas.
8. The game must include a minimap with roads, player arrow, mission markers, and waypoints.
9. The game must include a simple wanted/heat system inspired by open-world city games:

   * Heat increases after reckless collisions, hitting traffic, damaging props, entering restricted zones, or failing certain mission conditions.
   * Heat decays when the player avoids patrols or leaves the search zone.
   * At higher heat, simple patrol vehicles or security NPCs should move toward the player or create pressure.
   * This should remain arcade-like and non-graphic.
10. The player must have health, and vehicles must have durability.
11. The game must include mission loops that feel like open-world city missions:

* pick up an objective,
* follow a marker or route,
* drive or move through the city,
* avoid traffic or heat,
* complete the objective,
* receive cash/score/XP,
* continue free roaming.

12. The player should be able to fail, respawn, and continue playing without restarting the app.
13. The result should feel like a small sandbox city, not a linear level.

Important originality rule:
Do not use the names GTA, Grand Theft Auto, Rockstar, Los Santos, Liberty City, Vice City, San Andreas, or any other protected names in the game UI, repo title, map names, code-facing user-visible labels, vehicle names, missions, signs, or marketing copy.

Do not use:

* Grand Theft Auto assets.
* Rockstar logos.
* GTA fonts.
* GTA UI.
* GTA maps.
* GTA vehicle models.
* GTA characters.
* GTA mission names.
* GTA radio/audio.
* Real car brands.
* Real storefront brands.
* Copied real-world celebrity likenesses.
* Ripped commercial game assets.

Use an original working title such as:

* Block City Run
* Open District
* Lowpoly Metro
* Street Grid
* Metro Drift
* Brickline

Visual target:
The game should look browser-achievable. Use procedural, modular, blocky 3D geometry rather than photorealistic assets.

The intended visual style is:

* Low-poly.
* Modular.
* Blocky but not Minecraft-like.
* Third-person.
* Readable.
* Lightweight.
* Browser-native.
* Early-2000s open-world inspired.
* More like a playable prototype than a cinematic concept image.

The city should be built from simple procedural geometry:

* roads,
* sidewalks,
* buildings,
* alleys,
* intersections,
* parking lots,
* storefronts,
* warehouses,
* garages,
* traffic lights,
* streetlights,
* signs,
* simple props,
* blocky vehicles,
* blocky pedestrians,
* blocky player avatar.

Primary objective:
Create a polished, playable browser-based open-world city action vertical slice with this complete flow:

menu → district select → spawn on foot → walk around → approach vehicle → enter vehicle → drive through traffic → accept mission → follow minimap waypoint → complete objective → earn reward → trigger/avoid heat → take damage or fail → respawn → continue free roam → return/change district.

Core gameplay requirements:

1. Third-person on-foot camera.
2. Third-person vehicle camera.
3. Keyboard movement.
4. Mouse camera orbit or smooth follow camera.
5. Walk, run, and rotate the player avatar.
6. Enter and exit vehicles using an interaction prompt.
7. Vehicle driving with acceleration, braking, reverse, steering, and handbrake/drift-lite behavior.
8. Vehicle collision with buildings, props, traffic, and pedestrians.
9. Vehicle durability.
10. Player health.
11. Damage/fail state.
12. Respawn.
13. Vehicle reset if stuck.
14. Minimap with roads, player direction, mission marker, and waypoint.
15. At least 3 playable mission types.
16. Mission reward system using cash, score, XP, or reputation.
17. Simple traffic vehicles moving through roads.
18. Simple pedestrians walking or idling on sidewalks.
19. Light wanted/heat system.
20. Patrol/security response at higher heat.
21. District selection.
22. Return to district selection.
23. Pause menu.
24. Original procedural audio feedback.

Mission requirements:
Implement at least 3 GTA-like open-world mission loops, scaled down for a browser prototype.

Mission 1 — Package delivery:

* Player picks up a package at marker A.
* Player follows minimap waypoint to marker B.
* Completion gives reward.
* Optional timer gives bonus reward.
* Heat may increase if the player causes collisions during delivery.

Mission 2 — Checkpoint drive:

* Player enters a vehicle.
* Player drives through a sequence of checkpoints.
* Completion gives reward.
* Missing the timer fails the mission.
* Traffic should make the route feel alive.

Mission 3 — Pickup/dropoff:

* Player reaches a pickup marker.
* Player drives to a dropoff landmark.
* The minimap shows the route or destination.
* Completion gives reward.
* Optional traffic or heat pressure can make the route harder.

Mission 4 — Heat escape:

* Heat rises to a target level.
* Patrol/security vehicles or search markers pressure the player.
* Player must leave the search zone or reach a safe marker.
* Completion gives reward.
* Keep this arcade-like and non-graphic.

Mission 5 — Vehicle recovery:

* Player must find a marked vehicle.
* Player enters it.
* Player drives it to a garage or depot.
* Vehicle durability matters.
* Reward depends on condition.

The game does not need a story campaign, but the free-roam mission loop should feel like a small open-world city sandbox.

Driving feel requirements:
The vehicle controller is one of the most important parts of the prototype.

Accepted driving feel:

* Arcade-like, immediate, and readable.
* Car accelerates quickly enough to feel fun.
* Braking is responsive.
* Reverse works.
* Steering tightens at low speed and smooths at high speed.
* Handbrake or drift-lite turn exists.
* Vehicle collisions create bounce, slowdown, or damage.
* Camera follows behind the vehicle smoothly.
* Speedometer or speed readout appears.
* Vehicle durability appears.
* Horn or simple action button is optional.
* Vehicle reset works if stuck.

Not accepted:

* Vehicle feels like a sliding cube.
* Vehicle rotates uncontrollably.
* Vehicle flips constantly.
* Vehicle camera detaches or jitters.
* Roads are too narrow to drive.
* Every curb traps the car.
* Driving feels like a static tech demo rather than an open-world city game.

On-foot feel requirements:
Accepted on-foot feel:

* Player moves responsively.
* Player can rotate toward movement direction.
* Third-person camera follows smoothly.
* Player can walk near vehicles and mission markers.
* Interaction prompts appear clearly.
* Entering/exiting vehicle is reliable.
* Player collision prevents walking through major buildings.
* Player avatar is visible and readable.

Not accepted:

* Player is only a floating camera.
* Player cannot be seen.
* Enter/exit interaction is unreliable.
* Camera constantly clips or jitters.
* Player walks through buildings.
* On-foot mode feels irrelevant.

Wanted/heat system requirements:
Implement a simple, readable heat system inspired by open-world city games.

Heat should be represented by stars, bars, or alert levels.

Heat increases from:

* hitting traffic vehicles,
* damaging props,
* reckless collisions,
* entering restricted zones,
* failing mission stealth/speed conditions,
* optional contact with patrol/security vehicles.

Heat decreases from:

* driving away from the search area,
* avoiding patrol vehicles,
* waiting without causing more incidents,
* reaching a safe zone,
* completing a heat escape mission.

At higher heat:

* simple patrol cars spawn or activate,
* patrols move toward the player using waypoint or steering behavior,
* the minimap may show danger/search zones,
* the player can escape by distance or time.

Keep this lightweight. Do not implement realistic police simulation. Do not include graphic violence, gore, or realistic criminal instruction.

City-life requirements:
The city must feel alive enough to support GTA-like free roam.

Include:

* Traffic cars following lanes or waypoint paths.
* Pedestrians on sidewalks.
* Parked vehicles.
* Mission markers.
* Fictional storefront signs.
* Traffic lights or street props.
* Garage/depot area.
* At least one alley shortcut.
* At least one parking lot.
* At least one recognizable landmark visible from a distance.

Traffic and pedestrians can be simple. They do not need advanced AI. Their purpose is to create open-world city texture and light chaos.

Main district requirements:
Create one main district that is tuned for gameplay, plus at least 4 additional district entries.

The main district must include:

1. At least 6 to 10 readable city blocks.
2. A main avenue.
3. At least two secondary streets.
4. At least one alley shortcut.
5. A garage or hub.
6. A mission pickup area.
7. A delivery/dropoff area.
8. A warehouse or industrial zone.
9. A plaza, park, service station, or parking lot.
10. At least 5 recognizable landmarks.
11. Vehicle spawns.
12. Traffic paths.
13. Pedestrian paths.
14. Mission points.
15. A readable route from spawn to first vehicle.
16. A readable route from first vehicle to first mission.

Additional districts:
Include at least 5 district entries total. Each should have:

* name,
* short description,
* visual theme,
* procedural seed,
* spawn point,
* vehicle spawn points,
* mission points,
* landmark list,
* preview/minimap representation.

Suggested districts:

1. Sunset Grid — warm downtown streets, garage, plaza, warehouse.
2. Brickline District — brick apartments, alleys, laundromat, service station.
3. Harbor Blocks — waterfront roads, containers, pier, depot.
4. Neon Mile — nightlife signs, hotel strip, bright signs, wider roads.
5. Industrial Loop — warehouses, loading bays, fences, ramps.
6. Parkside — park roads, open plaza, civic buildings.

HUD requirements:
The HUD should feel like an open-world city action game HUD.

Include:

* Health.
* Vehicle durability when driving.
* Cash/score/XP.
* Current mission.
* Mission distance.
* Minimap.
* Waypoint marker.
* Heat/wanted indicator.
* Speedometer when driving.
* Interact prompts.
* District name.
* Mission complete/fail/respawn feedback.

The HUD must be game-like, compact, and readable. It must not look like a SaaS dashboard.

Procedural model requirements:
Create procedural low-poly models for:

* player avatar,
* pedestrians,
* at least 3 vehicle silhouettes,
* traffic vehicles,
* patrol/security vehicle,
* mission package/objective marker,
* buildings,
* signs,
* road props,
* garage/depot.

Vehicles should be built from simple shapes:

* box body,
* slightly smaller cabin,
* cylinder or low-poly wheel shapes,
* headlights,
* brake lights,
* bumper blocks,
* optional roof sign for taxi-like generic vehicle.

Player and pedestrians should be built from simple shapes:

* head,
* torso,
* arms,
* legs,
* simple hair or hat block,
* shirt/jacket color,
* pants,
* shoes.

No external assets are required. Prefer procedural geometry.

Audio requirements:
Use original browser-generated audio with Web Audio API.

Include:

* menu/select sound,
* engine idle/drive sound,
* acceleration pitch change,
* collision bump sound,
* mission pickup sound,
* mission complete sound,
* heat alert sound,
* fail/respawn cue.

Do not use copyrighted music, radio, commercial sound effects, or GTA-like audio clips.

Multiplayer:
Multiplayer is optional unless an existing real-time/backend setup is already present.

If no backend exists:

* local single-player mode is acceptable,
* show a graceful “local mode” or “multiplayer unavailable” note,
* document how multiplayer could be added later.

If a backend exists:

* players in the same district should see each other,
* player and vehicle positions should update,
* entering/exiting vehicles should be visible,
* districts should act as separate rooms,
* player count should update.

Verifier gates:
Do not call the project complete unless these gates pass.

Gate 1 — Build:

* dependencies install,
* typecheck passes if configured,
* lint passes if configured,
* production build succeeds.

Gate 2 — Browser launch:

* app launches locally,
* menu appears,
* district select works,
* selected district loads,
* no blocking console errors.

Gate 3 — GTA-like mechanics and feel:

* player can free roam on foot,
* player can enter a vehicle,
* player can drive through city streets,
* player can exit vehicle,
* minimap helps navigation,
* mission loop works,
* heat/wanted pressure works,
* traffic and pedestrians create city life,
* fail/respawn works,
* player can keep playing after completing or failing a mission.

Gate 4 — Driving:

* acceleration works,
* steering works,
* braking/reverse works,
* handbrake or drift-lite behavior works,
* collision/durability works,
* speed/durability HUD works,
* vehicle reset works.

Gate 5 — Missions:

* at least 3 mission types are playable,
* objectives appear in the world,
* minimap/waypoint points to objective,
* reward appears after completion,
* failure state works where applicable.

Gate 6 — District quality:

* main district has 6 to 10 readable blocks,
* main avenue exists,
* secondary streets exist,
* alley shortcut exists,
* landmarks exist,
* vehicle spawns exist,
* mission points exist,
* traffic/pedestrian paths exist,
* district does not copy any GTA city.

Gate 7 — Visual target:

* game is low-poly, modular, blocky, and browser-achievable,
* city reads as an open-world urban sandbox,
* vehicles and characters are recognizable,
* HUD reads as game UI,
* no copyrighted GTA/Rockstar/commercial/real-brand content is used.

Gate 8 — Implementation architecture:

* Three.js is the primary 3D scene and rendering implementation,
* the app still builds to static browser files,
* runtime code is organized into focused modules or systems,
* scene setup, world generation, player control, vehicle control, traffic, pedestrians, missions, heat/wanted pressure, HUD/minimap, input, audio, and game state are not all mixed into one monolithic file,
* procedural builders and game data are separated from the main loop where practical,
* desktop and mobile controls share gameplay systems instead of duplicating separate game implementations.

Gate 9 — Documentation:
Update README with:

* what was built,
* how to run,
* controls,
* how to play,
* district generation,
* mission system,
* vehicle system,
* heat/wanted system,
* Three.js implementation architecture,
* modular code organization,
* asset usage,
* known limitations,
* commands run,
* verifier gate results.

Feel verification:
Run a 90-second playtest on the main district.

The playtest passes only if at least 8 of these 10 checks are true:

1. Within 5 seconds, the player understands this is an open-world city action game.
2. Within 10 seconds, the player can identify a vehicle.
3. Within 15 seconds, the player can enter a vehicle.
4. Within 25 seconds, the player can drive through readable streets.
5. Within 45 seconds, the player can start or progress a mission.
6. Driving feels arcade-like and fun enough for a prototype.
7. On-foot movement feels usable.
8. Minimap and waypoint help navigation.
9. Traffic, pedestrians, collisions, or heat create light city chaos.
10. Fail/respawn is understandable and does not break the session.

Critical fail conditions:
The implementation fails if any of these are true:

1. The game is only a city viewer.
2. The game is only a driving demo with no on-foot mode.
3. The player cannot enter and exit vehicles.
4. The city has no missions.
5. The city has no traffic or pedestrians.
6. The minimap is missing.
7. The heat/wanted system is missing.
8. Vehicles are not controllable enough to be fun.
9. The city looks like random boxes with no roads, landmarks, or mission layout.
10. The UI looks like a SaaS dashboard.
11. The game uses GTA, Rockstar, real-brand, ripped, or copyrighted commercial assets.
12. The final result does not feel like a small GTA-like open-world browser game.
13. The 3D gameplay implementation does not use Three.js as its primary rendering/runtime layer.
14. The codebase is a monolithic script with no meaningful separation between rendering, controls, gameplay systems, HUD, data, and app bootstrap.

Final response format:
When done, respond with:

1. What was implemented.
2. How the GTA-like mechanics and feel were achieved.
3. Visual target summary.
4. How the main district was designed.
5. How procedural city generation works.
6. How on-foot movement works.
7. How vehicle enter/exit and driving work.
8. How missions work.
9. How heat/wanted pressure works.
10. How traffic and pedestrians work.
11. How Three.js is used for the 3D implementation.
12. How the codebase is organized into modular systems.
13. External assets used, if any, with license notes.
14. Files changed.
15. Commands run and results.
16. Verifier gates passed or failed.
17. Feel test result.
18. Known limitations.
19. How to run and test locally.
