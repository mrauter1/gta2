# Block City Visual Target Summary

- Reference image: `/home/rauter/code/gta2/gta.png`
- Native reference size: `1672x941` (`~16:9`, landscape)
- Locked working title: `Block City`
- Locked validation slug: `block-city-run`
- Lock reason: the user-facing title remains `Block City` from the central billboard cue, while the parent workflow requires the stable validation slug `block-city-run` for evidence artifacts.
- Protected-content guardrail: preserve the `Block City` billboard cue and the broad low-poly city-action feel, but do not reuse protected franchise names, logos, real brands, or copied map layouts.

## Viewport And Framing Assumptions

- The target composition is a full-bleed landscape gameplay frame with HUD overlays anchored to the edges.
- Primary fidelity target is desktop `16:9`; mobile should prefer landscape and compress the same HUD into the corners without covering the player, nearby vehicle, or route line.
- The playfield camera is third-person, slightly right-offset, and pitched down toward a wide avenue so the player, the nearest vehicle, the intersection, and the skyline are readable in one frame.

## Layout Structure

1. Full-screen world render showing a sunset city avenue with the avatar on a sidewalk beside a parked sedan.
2. Upper-left HUD cluster with a square minimap and a stacked mission card immediately below it.
3. Upper-right HUD cluster with cash on top and a heat-star row below it.
4. Lower-left survival cluster with two horizontal bars, icon badges, and numeric values.
5. Lower-center interaction cluster with keyboard prompts and a quick-slot strip.
6. Lower-right vehicle cluster with a circular speedometer and large touch-driving buttons.

## Major Regions And Relative Proportions

- Minimap block: about `17-18%` of frame width and `30-32%` of frame height, inset tightly from the top-left corner.
- Mission card: same left alignment as the minimap, roughly `16-18%` of frame width and `10-12%` of frame height.
- Cash plus heat cluster: right aligned, occupying the top-right `14-16%` of width.
- Health and stamina bars: bottom-left `20-22%` of width.
- Interaction prompts and quickbar: centered across the lower `32-38%` of width.
- Speedometer and touch-drive controls: bottom-right `22-26%` of width.
- Touch steering controls: lower-left above the survival bars, leaving the avatar and curb readable.

## Color, Lighting, And Surface Treatment

- Sky uses a warm sunset gradient: peach, orange, and pale gold, with atmospheric haze over the skyline.
- World lighting is late-day amber with soft bloom on streetlights, the sun disc, windows, and reflective paint.
- Streets are dark gray asphalt with warm yellow lane lines, white crosswalks, and soft brown-gray shadow pools.
- Buildings mix muted olive, brick red, tan, dusty blue, and concrete gray; storefront accents add saturated reds and blues without becoming neon-futurist.
- HUD panels use smoky near-black translucent plates with light blur cues, white body text, yellow mission accents, green economy text, gold heat stars, red health, and blue stamina or utility fill.
- Buttons and dials use soft white outlines plus a faint glassy highlight instead of flat minimalist UI.

## Typography And Hierarchy

- Use a bold condensed display face for the mission header, interaction prompts, slot numbers, and high-value HUD numerals.
- Use a heavy rounded display style for the cash value so it reads bright green with a dark outline and quick arcade legibility.
- Use a narrower sans for secondary copy such as mission instructions, distance, and build info.
- Favor uppercase labels on short actions (`PICK UP PACKAGE`, `ENTER CAR`, `INTERACT`) and mixed case for helper text.
- Typography should feel game-native and slightly chunky, not like a browser dashboard or default system UI.

## Camera Geometry And World Readability

- Camera height should sit slightly above shoulder level with the avatar occupying the lower middle of the frame and the nearby sedan filling the lower-right foreground.
- The street should run diagonally from lower-right toward upper-left-center so the player can immediately read drivable lanes and route direction.
- The skyline should sit in the upper-middle background with one central billboard, several towers, a rooftop water tower, and palms breaking the horizon.
- The world must show at least one readable cross street, curb edges, parked or moving traffic, pedestrians, streetlights, and storefront signage in the first gameplay frame.

## Visible HUD, Controls, And Labels

- Minimap: square grayscale street map with a white border, rounded corners, a black `N` compass badge, a blue player arrow, a yellow route line, and landmark icons for a vehicle, home or garage, and package objective.
- Mission card: yellow cube icon, uppercase mission title `PICK UP PACKAGE`, one-line instruction, and a highlighted distance readout.
- Economy and heat: green cash total above a five-star heat row with two filled gold stars and three dark empty stars in the reference state.
- Survival bars: red heart bar and blue lightning bar, both with `100/100` style numerics.
- Interaction prompts: black pill prompts with keycaps `E` and `F` followed by `Enter Car` and `Interact`.
- Quickbar: centered slot strip with a highlighted primary sidearm slot, four numbered live utility slots, and a bag or inventory slot.
- Speedometer: analog gauge with white numerals, redline accents, central digital speed, and `KM/H` label.
- Touch controls: left-side steering or movement circles, right-side `Use` or `Fire` or `Pause` actions on foot, and `Exit` or `Use` or `Handbrake` or `Brake / Rev` or `Accelerate` while driving.
- Build tag: small gray text at the bottom-left indicating this is a browser playable demo.

## Inferred Mechanics And Minimal Additional UI

- The image shows on-foot play beside an enterable parked vehicle, so vehicle entry and exit prompts must be reliable and immediate.
- The route line, package icon, and mission card imply waypoint-guided pickup and delivery style missions.
- The cash counter implies mission rewards; the heat stars imply escalating police or patrol pressure from reckless play.
- The second lower-left bar reads as stamina or ability energy on foot; in vehicle state the same area may swap to or add vehicle durability while preserving the red health bar.
- The quickbar implies loadout or inventory management. The shipped interpretation keeps slot `1` as the live original sidearm and uses slots `2-5` for route, horn, reset, and garage actions so the lower-center strip stays fully functional.
- The reference frame mixes keyboard prompts and touch buttons. Final runtime should preserve that cross-input visual language while contextually hiding or minimizing the irrelevant input family per device.
- District select, pause, respawn, fail, and menu states are not visible in the frame and therefore must be minimally inferred later while matching the same bold, smoky, arcade UI style.

## Spacing, Proportions, And Visual Rhythm

- HUD anchors hug the corners but leave a narrow breathable inset, roughly `16-24px` on desktop-equivalent scaling.
- Panels should layer without overlap: minimap over mission card on the left, cash over heat on the right, prompts above the slot bar in the lower center.
- The avatar and nearest vehicle must remain the visual focus, so mobile controls should stay translucent and edge-anchored.
- Use rounded rectangles and circular pads generously, but keep corners firm enough to feel like an action game, not soft consumer-app UI.

## State Targets That Must Exist

- Hover: desktop buttons and cards brighten slightly with a warm outline or raised shadow.
- Selected: active district cards, slots, or menu choices use a yellow or amber border with stronger contrast.
- Active: mission card, route line, and contextual prompts glow subtly and remain fully legible over the world.
- Disabled: unavailable actions must be visibly desaturated and labeled with a reason such as `Locked`, `Unavailable in Local Mode`, or `Need Vehicle`.
- Mission-complete: mission card should flash green or gold, reward text should pop near the cash counter, and the waypoint should clear or retarget.
- Mission-fail: the mission card should flip to a red or amber fail treatment with a retry or respawn action.
- Pause: the world should dim behind a translucent menu while keeping the skyline silhouette visible.
- Respawn: a brief fade or wipe should lead to a safe spawn card in the same HUD language.
- Heat-alert: stars should pulse brighter and the minimap should gain a warning tint or search highlight when heat spikes.
- On-foot: health plus stamina, interact prompts, and the slot strip are primary; speedometer should hide or minimize.
- In-vehicle: speedometer, durability, and vehicle touch buttons become primary; enter-car prompt becomes exit or interact context.

## Reference Gaps To Carry Forward

- The image does not show the menu, district selection, pause menu, fail screen, or respawn overlay, so those must be inferred with the same sunset-noir, chunky HUD language.
- The image does not fully specify mobile look control, touch enter or exit, or a handbrake button; those should be added minimally and documented later in `validation/ui-affordance-matrix.md`.
- The image shows a pistol-like primary slot, and the parent request separately requires a live original sidearm or action-tool combat loop. The shipped target therefore needs honest fire, reload, reticle, ammo, impact, and heat feedback wherever the combat surface remains visible.
