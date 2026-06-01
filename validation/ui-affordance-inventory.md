# Block City UI Affordance Inventory

- Reference image inspected directly: `/home/rauter/code/gta2/gta.png`
- Locked working title: `Block City`
- Locked validation slug: `block-city-run`
- Inventory purpose: enumerate every visible or reasonably inferred control, option, status surface, interaction, and mechanic from the reference image and the playable-game request before implementation starts while keeping the parent validation artifact contract on the stable `block-city-run` slug.

## Status Legend

- `required`: must exist and function in the final game.
- `optional`: may be added, but if shown it must function and persist state where applicable.
- `disabled with rationale`: may be visible only if clearly marked unavailable with an in-app reason.
- `intentionally excluded`: should not appear as a live control in the final build; omission must be carried into the final affordance matrix.

## Visible HUD, Controls, And Status Surfaces

| Item | Source | Expected behavior | Status | Notes / rationale |
| --- | --- | --- | --- | --- |
| `Block City` title branding | reference image | Use `Block City` as the user-visible title in menu, district flow, and validation artifacts. | required | Locked from the central billboard. |
| Minimap panel | both | Show the local district street grid, player position and facing, and nearby objective context. | required | Must stay readable on desktop and mobile. |
| North compass badge | reference image | Mark minimap orientation with a clear `N` badge. | required | Can rotate the player arrow instead of the whole map. |
| Player arrow on minimap | both | Track current position and facing in real time. | required | Blue arrow in reference. |
| Route line | both | Draw the current suggested mission route or direct waypoint path. | required | Yellow path in reference. |
| Vehicle icon on minimap | reference image | Mark the nearest usable or mission-relevant vehicle. | required | White car icon in reference. |
| Home / garage icon on minimap | reference image | Mark the hub, garage, safehouse, or district-return location. | required | Green house icon in reference. |
| Package / mission icon on minimap | both | Mark pickup, delivery, or mission interaction points. | required | Purple package icon in reference. |
| Mission card shell | both | Present the active mission title, instruction text, and distance or progress. | required | Must support multiple mission types, not only pickups. |
| Mission icon | reference image | Visually signal mission type, starting with a package icon for pickup flows. | required | Can swap per mission type later. |
| Mission distance readout | both | Update remaining distance or target range live. | required | Yellow numeric distance in reference. |
| Cash / reward counter | both | Increase when missions are completed and remain visible during free roam. | required | Green money total in reference. |
| Weapon status panel | both | Show the currently available sidearm state, honest ammo count, and whether it is drawn, holstered, or reloading. | required | Added during the combat subgoal; must remain truthful in foot and vehicle modes. |
| Heat star row | both | Display current wanted / heat level and pulse when danger escalates. | required | Reference shows 2 of 5 stars filled. |
| Health bar | both | Track player health and support damage, fail, and respawn loops. | required | Red bar with heart icon. |
| Stamina / energy bar | reference image | Track on-foot sprint or action stamina. | required | Blue bar with lightning icon. |
| Vehicle durability surface | user request | Show vehicle damage while driving. | required | Can replace or sit beside stamina in vehicle mode. |
| Speedometer | both | Show current vehicle speed clearly in `KM/H`. | required | Analog dial plus central digital number. |
| Build / demo label | reference image | Show a small browser-build tag or equivalent debug label. | optional | Safe to omit from shipping UI if not needed for fidelity. |
| `Enter Car` desktop prompt | both | Enter the nearest usable vehicle when in range. | required | Reference shows `E Enter Car`. |
| `Interact` desktop prompt | both | Trigger context actions such as mission accept, pickup, delivery, garage use, or exit sub-interaction. | required | Reference shows `F Interact`. |
| Combat reticle | user request | Display a visible aim point only when the on-foot sidearm is drawn. | required | Must not remain visible as inert decoration while the weapon is holstered or while driving. |
| Quick-slot strip | reference image | Provide a working lower-center loadout or inventory surface. | required | Must not be inert if visible. |
| Primary quick slot | both | Show the currently selected sidearm draw or holster action plus honest ammo or reload state when combat is active. | required | The combat subgoal converts the first slot into the live sidearm affordance. |
| Utility quick slots `2-5` | both | Keep the lower-center strip fully live with route pulse, horn or whistle, ride reset, and garage ping actions. | required | The reference allows a compact loadout strip; the shipped build uses those extra slots for honest street-tool actions instead of empty placeholders. |
| Bag / inventory button | reference image | Open a loadout, inventory, or mission-items panel. | required | Can be compact on mobile. |
| Left touch movement / steering control | both | Support touch-only on-foot movement and vehicle steering. | required | Final form may be a d-pad, joystick, or the reference's left-right pads if still playable. |
| Touch fire button | user request | Fire the on-foot sidearm without requiring keyboard or mouse input. | required | Must remain hidden or clearly unavailable while driving. |
| Touch action buttons | both | Surface live `Use`, `Pause`, and `Exit` interactions across foot and vehicle modes. | required | The touch HUD carries separate on-foot and in-vehicle action stacks so no visible button is inert. |
| Right touch accelerate button | both | Apply vehicle throttle on touch devices. | required | Large stacked-chevron button in reference. |
| Right touch brake / reverse button | both | Brake and reverse on touch devices. | required | Down-chevron button in reference. |
| Right touch handbrake button | user request | Trigger the live drift-lite or handbrake action while driving. | required | Explicitly required by the mechanics brief even though the exact button art is inferred. |

## Inferred Input, Menu, And Session Affordances

| Item | Source | Expected behavior | Status | Notes / rationale |
| --- | --- | --- | --- | --- |
| Main menu start action | user request | Enter the district-selection flow or resume the latest local session. | required | Needed for the stated core loop. |
| District selection screen | user request | Let the player choose among at least five districts, with one tuned main district. | required | Must use `Block City` branding, not protected names. |
| District card / row selection state | user request | Clearly show hover, selected, and active district states. | required | State styling must match the reference HUD language. |
| Back action from district select | user request | Return to the previous menu without breaking the session. | required | Must work on desktop and touch. |
| Pause action | user request | Freeze gameplay and open a pause overlay. | required | Keyboard and touch access both required. |
| Pause menu resume action | user request | Resume gameplay immediately from pause. | required | No inert pause option allowed. |
| Pause menu restart / respawn action | user request | Reset the current run or respawn without reloading the page. | required | Needed for recovery and feel-test continuity. |
| Return to district select action | user request | Leave the current district and return to district selection. | required | Part of the full loop. |
| Desktop on-foot movement (`WASD` / arrows) | user request | Move, rotate, and traverse on foot responsively. | required | Must work without touch UI. |
| Desktop mouse look / orbit | user request | Aim the third-person camera or orbit the view smoothly. | required | Must fail gracefully if pointer lock is unavailable. |
| Touch look area / swipe look | user request | Let touch players rotate the camera without a keyboard or mouse. | required | Minimally inferred because it is not visible in the frame. |
| Touch enter / exit vehicle button | user request | Enter or exit vehicles reliably on touch devices. | required | Minimally inferred because the frame only shows keyboard prompts. |
| Touch interact / action button | user request | Accept missions, pick up packages, use garages, and trigger context actions on touch devices. | required | Minimally inferred. |
| Touch handbrake / drift button | user request | Provide drift-lite or handbrake control while driving on touch. | required | Not visible in the frame, but required by the product contract. |
| Keyboard hint suppression on touch | both | Hide or minimize keyboard-only prompts on touch-first devices. | required | Preserves the cross-input style without clutter. |
| Touch control suppression on desktop | both | Hide or minimize touch pads on fine-pointer desktop sessions. | required | Prevents HUD crowding. |
| Local-mode notice | user request | If multiplayer is mentioned anywhere, explain that local single-player remains available. | disabled with rationale | Only needed if a multiplayer affordance is shown. |
| Multiplayer menu entry | user request | Do not show a live multiplayer action unless it is implemented. | intentionally excluded | Avoid inert controls. If added later, it must be clearly disabled or functional. |

## Mechanics, Objectives, And World Interactions

| Item | Source | Expected behavior | Status | Notes / rationale |
| --- | --- | --- | --- | --- |
| Third-person on-foot avatar | both | Keep a visible player character in frame during traversal. | required | The player cannot be only a floating camera. |
| Nearby vehicle affordance | both | Ensure at least one reachable vehicle is obvious from spawn. | required | The reference foreground sedan sets the first-minute target. |
| Enter vehicle mechanic | both | Mount a vehicle when the prompt or touch action is used in range. | required | Must be reliable. |
| Exit vehicle mechanic | both | Leave the vehicle cleanly and place the player safely in the world. | required | Must work on desktop and touch. |
| Drive through city traffic | both | Support throttle, brake, reverse, steering, and drift-lite movement through readable streets. | required | Core feel requirement. |
| Vehicle reset if stuck | user request | Recover a flipped or wedged vehicle without reloading. | required | Needed for browser-scale robustness. |
| Package pickup mission loop | both | Reach a marked pickup, interact, then deliver or continue the mission chain. | required | Explicitly shown by the mission card. |
| Delivery / dropoff mission loop | user request | Move cargo or a passenger-equivalent from one marked point to another. | required | Natural extension of the package route cue. |
| Checkpoint or timed drive mission loop | user request | Pass through route markers under time pressure. | required | Satisfies the timer-pressure requirement. |
| Heat escape or patrol-pressure mission loop | user request | Survive or lose pursuing patrol pressure until heat clears or the target is met. | required | Satisfies the wanted-system contract. |
| Mission accept interaction | both | Accept or begin a mission from a marker, garage, or NPC prompt. | required | Can share the `Interact` action. |
| Mission completion feedback | both | Show a positive state change, reward, and route clear on success. | required | Must be visible and immediate. |
| Mission failure feedback | user request | Show fail state, reason, and retry or respawn path. | required | Needed for timer, damage, or heat failure. |
| Reward payout | both | Increase cash, score, XP, or reputation on completion. | required | The reference emphasizes cash. |
| Heat escalation | both | Increase heat from collisions, reckless driving, or mission trouble. | required | Visible through stars and warning feedback. |
| Patrol / security response | user request | Add moving pressure at higher heat levels. | required | Can stay lightweight and arcade-like. |
| Traffic vehicles | both | Populate roads with moving cars that can obstruct or be hit. | required | Needed for city-life feel. |
| Pedestrians | both | Populate sidewalks or curbs with walkers or idlers. | required | Needed for city texture and player readability. |
| Garage / home return point | both | Provide a safe hub, respawn point, or district-return interaction. | required | Implied by the green home icon. |
| Landmark signage and skyline | both | Keep at least one distant recognizable landmark plus storefront variety for navigation. | required | Central billboard and skyline are major fidelity cues. |

## Settings, Persistence, And Optional Surfaces

| Item | Source | Expected behavior | Status | Notes / rationale |
| --- | --- | --- | --- | --- |
| Last selected district persistence | user request | Restore the latest chosen district in local storage for the next session. | required | Explicit persistence requirement. |
| Audio mute / volume setting | user request | If a settings panel exists, persist the latest audio choice locally. | optional | Must persist if surfaced. |
| Camera sensitivity / invert-look setting | user request | If exposed, persist the latest preference locally. | optional | Not visible in the frame, so do not add casually. |
| Touch handedness / control layout setting | user request | If exposed, persist the latest preference locally. | optional | Only add if the mobile HUD truly benefits from it. |
| Difficulty / timer modifier setting | user request | If exposed, persist the latest choice locally. | optional | Keep out unless it improves the prototype. |

## Adapted Or Excluded Interpretation Notes

| Item | Source | Expected behavior | Status | Notes / rationale |
| --- | --- | --- | --- | --- |
| Direct firearm / sidearm shooting loop | both | Surface explicit firing and aiming controls only alongside a fully working original sidearm loop with honest HUD feedback, collision, heat impact, and touch parity. | required | The combat subgoal lands this as the `CINDER-9` sidearm with slot draw, desktop click or key fire, touch fire, reticle, ammo, and reload state. |
| Decorative inert buttons | both | Never leave a visible control that does nothing. | intentionally excluded | Applies to menu buttons, touch controls, quick slots, and settings toggles. |
| Real-brand signage or protected franchise labels | both | Avoid copied names, logos, and brands in UI, districts, vehicles, and storefronts. | intentionally excluded | Preserve the scene structure, not the IP. |

## Reference Gaps Requiring Minimal Later Inference

- The frame does not show the menu, district select, pause, fail, respawn, or settings overlays, so those states must be designed to match the same smoky black panels, bold condensed labels, and warm accent colors.
- The frame does not show touch look, touch enter or exit, or touch handbrake controls, but those are required for mobile play and should be introduced minimally.
- The frame does not show vehicle durability directly, so that surface must be added in a way that harmonizes with the lower-left health and stamina cluster or the speedometer cluster.
