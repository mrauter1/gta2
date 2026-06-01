# Reference Comparison

- Reference image: [gta.png](/home/rauter/code/gta2/gta.png)
- Rendered comparison screenshot: [validation/screenshots/desktop-on-foot-reference.png](/home/rauter/code/gta2/validation/screenshots/desktop-on-foot-reference.png)
- Validation report: [validation/artifacts/block-city-run-report.json](/home/rauter/code/gta2/validation/artifacts/block-city-run-report.json)

## Viewport

- Reference size: `1672x941`
- Comparison screenshot size: `1672x941`
- Comparison state: desktop gameplay on foot in `Sunset Grid` with the hero framed beside the parked sedan.

## Comparison Method

- The browser validator served the app locally, captured the rendered page at the reference resolution, and then loaded both images back into the browser for a same-origin canvas comparison.
- sampled pixels: `393,338`
- mean absolute channel diff: `42.55`
- approximate match ratio: `0.4243`
- The numeric diff was followed by a structured manual review of HUD placement, typography, spacing, color language, world framing, and player-to-vehicle readability.

## Layout Comparison

- The broad HUD layout is aligned with the target image: minimap and mission card in the upper-left, cash and heat in the upper-right, survival bars in the lower-left, prompts plus quickbar at the lower center, and the speedometer in the lower-right.
- Menu and pause overlays are intentionally excluded from the comparison because the reference depicts active gameplay rather than front-end shell states.
- The shipped quickbar stays denser than the reference because every visible slot remains functional, including the live sidearm and street-tool utilities.

## Typography Comparison

- The build uses bold uppercase mission headers, oversized green cash numerals, and short action labels that stay directionally close to the reference hierarchy.
- The reference uses chunkier outlined numerals and storefront lettering, while the shipped build stays slightly flatter and cleaner to avoid copied branded presentation.

## Spacing And Alignment

- Corner panel spacing, card stacking, and lower-rail composition are close to the target frame at the shared viewport.
- The current build allocates slightly more horizontal space to the quickbar and touch affordances because each visible control is labeled and live.

## Color And Contrast

- The comparison shot keeps the warm sunset palette: amber sky, dark asphalt, green cash, gold heat stars, and smoky black HUD plates.
- The world remains more abstract and lower-frequency than the reference, so storefronts, lamp detail, and curb clutter read flatter than the source frame.

## Visible Controls And Labels

- Shared affordances present in both images include the minimap, mission card, cash counter, heat stars, survival bars, contextual prompts, quickbar, and speedometer.
- The reference's pistol-like slot is implemented as a fully working original sidearm surface in the shipped build, with honest ammo, reticle, reload, and fire feedback rather than decorative combat UI.
- Touch controls remain visible only in touch mode and use explicit text labels instead of icon-only arrows for browser readability.

## HUD And World Framing

- The camera keeps a third-person, warm-avenue composition with the hero and a reachable sedan framed together as the first-minute interaction cue.
- The biggest remaining mismatch is world density: the reference foreground car and curbside storefront massing are richer and more detailed than the shipped procedural scene.

## Player, Vehicle, And City-Scale Readability

- The comparison frame keeps the player human-scaled beside the sedan rather than toy-sized against the road network.
- Roads, sidewalks, and the parked sedan now read coherently together, but the source image still presents heavier curb detail and denser skyline layering.

## Visible Differences

- No copied GTA, Rockstar, or real-brand names, billboards, storefronts, or map labels appear in the shipped build.
- The shipped scene is intentionally more low-poly and schematic than the reference, with fewer palms, storefront decals, and curb props.
- The active quickbar and combat panel make the HUD denser than the reference frame, which shows a sparser lower-center loadout strip.

## Judgment

The shipped build is not pixel-perfect to the reference screenshot. It is close on HUD architecture, sunset color language, and compact browser-sandbox readability, while remaining visibly original in world content. Within the constraints of an original static Three.js web game with no copied brands or assets, this is as close as practical on the UI and first-minute gameplay read, with the remaining gap concentrated in world-detail density and exact curbside vehicle framing.
