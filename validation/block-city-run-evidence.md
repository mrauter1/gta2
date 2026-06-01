# Block City Validation Evidence

## Commands And Exit Status

- Command run: `bash validation/block-city-run-validation.sh`
- Base URL served during the run: `https://gta2.onrender.com/`
- Validation start: `2026-06-01T17:49:58.829Z`
- Validation finish: `2026-06-01T17:52:36.676Z`
- Exit status: `0`
- Structured report: [validation/artifacts/block-city-run-report.json](/home/rauter/code/gta2/validation/artifacts/block-city-run-report.json)
- Browser log: [validation/logs/block-city-run-validation.log](/home/rauter/code/gta2/validation/logs/block-city-run-validation.log)
- HTTP server log: [validation/logs/block-city-http-server.log](/home/rauter/code/gta2/validation/logs/block-city-http-server.log)

## Hard-Constraint Proof

- Static entrypoint: [index.html](/home/rauter/code/gta2/index.html) remains present and the validator confirmed it still bootstraps `./src/main.js` as a browser module.
- Three.js runtime: [src/render/three-world.js](/home/rauter/code/gta2/src/render/three-world.js) still imports `three.module.js` and constructs `new THREE.WebGLRenderer(...)`, keeping Three.js as the primary renderer.
- Backend requirement: the full audit ran against a plain local `python3 -m http.server` static host with no API or service dependency required for single-player play.
- Originality scan: no blocked GTA/Rockstar or obvious real-brand strings were found in shipped app files under `index.html` and `src/`.

## Viewports Exercised

- Desktop gameplay and comparison viewport: `1672x941`
- Mobile landscape gameplay viewport: `844x390`
- Mobile portrait sanity viewport: `430x932`

## Screenshot Set

- Desktop district catalog: [validation/screenshots/desktop-district-select.png](/home/rauter/code/gta2/validation/screenshots/desktop-district-select.png) (desktop, district selection catalog)
- Desktop initial spawn: [validation/screenshots/desktop-spawn-intro.png](/home/rauter/code/gta2/validation/screenshots/desktop-spawn-intro.png) (desktop, initial spawn / intro state)
- Desktop combat feedback: [validation/screenshots/desktop-combat-feedback.png](/home/rauter/code/gta2/validation/screenshots/desktop-combat-feedback.png) (desktop, combat / shooting feedback)
- Desktop heat escalation: [validation/screenshots/desktop-heat-alert.png](/home/rauter/code/gta2/validation/screenshots/desktop-heat-alert.png) (desktop, heat escalation / patrol response)
- Desktop on-foot traversal: [validation/screenshots/desktop-on-foot-reference.png](/home/rauter/code/gta2/validation/screenshots/desktop-on-foot-reference.png) (desktop, on-foot traversal)
- Desktop boundary collision: [validation/screenshots/desktop-boundary-impact.png](/home/rauter/code/gta2/validation/screenshots/desktop-boundary-impact.png) (desktop, collision / boundary interaction)
- Desktop vehicle driving: [validation/screenshots/desktop-in-vehicle-hud.png](/home/rauter/code/gta2/validation/screenshots/desktop-in-vehicle-hud.png) (desktop, vehicle driving)
- Desktop mission state: [validation/screenshots/desktop-mission-objective.png](/home/rauter/code/gta2/validation/screenshots/desktop-mission-objective.png) (desktop, mission / objective state)
- Desktop respawn recovery: [validation/screenshots/desktop-respawn-recovery.png](/home/rauter/code/gta2/validation/screenshots/desktop-respawn-recovery.png) (desktop, failure / respawn / recovery)
- Mobile initial spawn: [validation/screenshots/mobile-landscape-spawn-intro.png](/home/rauter/code/gta2/validation/screenshots/mobile-landscape-spawn-intro.png) (mobile-landscape, initial spawn / intro state)
- Mobile on-foot traversal: [validation/screenshots/mobile-landscape-on-foot.png](/home/rauter/code/gta2/validation/screenshots/mobile-landscape-on-foot.png) (mobile-landscape, on-foot traversal)
- Mobile combat feedback: [validation/screenshots/mobile-landscape-combat-feedback.png](/home/rauter/code/gta2/validation/screenshots/mobile-landscape-combat-feedback.png) (mobile-landscape, combat / shooting feedback)
- Mobile mission state: [validation/screenshots/mobile-landscape-mission-objective.png](/home/rauter/code/gta2/validation/screenshots/mobile-landscape-mission-objective.png) (mobile-landscape, mission / objective state)
- Mobile heat escalation: [validation/screenshots/mobile-landscape-heat-alert.png](/home/rauter/code/gta2/validation/screenshots/mobile-landscape-heat-alert.png) (mobile-landscape, heat escalation / patrol response)
- Mobile vehicle driving: [validation/screenshots/mobile-landscape-vehicle.png](/home/rauter/code/gta2/validation/screenshots/mobile-landscape-vehicle.png) (mobile-landscape, vehicle driving)
- Mobile boundary collision: [validation/screenshots/mobile-landscape-boundary-impact.png](/home/rauter/code/gta2/validation/screenshots/mobile-landscape-boundary-impact.png) (mobile-landscape, collision / boundary interaction)
- Mobile respawn recovery: [validation/screenshots/mobile-landscape-respawn-recovery.png](/home/rauter/code/gta2/validation/screenshots/mobile-landscape-respawn-recovery.png) (mobile-landscape, failure / respawn / recovery)
- Mobile portrait sanity: [validation/screenshots/mobile-portrait-sanity.png](/home/rauter/code/gta2/validation/screenshots/mobile-portrait-sanity.png) (mobile-portrait, portrait gameplay render sanity)

## Browser Audit Coverage

- Checks passed: `81`
- Checks failed: `0`
- Verified interaction families: menu and district navigation, settings persistence and restore-default flows, keyboard and arrow-key foot movement, key-release and focus-resilience behavior, combat draw or fire or reload flows, HUD drawer focus cleanup, quickbar actions, ride entry and exit, vehicle driving, blocker and boundary collisions, mission accept and completion, heat escalation and decay, respawn recovery, touch on-foot and vehicle controls, portrait sanity, and page-level console hygiene.
- Newly explicit proof in this run: player-versus-blocker collision, vehicle-versus-blocker collision, safe boundary vehicle exit placement, spawn-scale sanity, static entrypoint integrity, Three.js runtime continuity, and a shipped-source originality scan.

## Reference Comparison Summary

- Full write-up: [validation/reference-comparison.md](/home/rauter/code/gta2/validation/reference-comparison.md)
  - numeric comparison skipped
- Judgment: close on HUD structure, sunset mood, and first-minute readability; still looser than the reference on exact curbside vehicle framing and world-detail density.

## Console And Runtime Errors

- Page-level console errors in the passing run: `0`
- Ignored synthetic-pointer errors: `0`
- The static server may still receive a harmless `/favicon.ico` request, but the validator treats only actual page-level runtime errors as failures.

## Changed Files And Mechanics Proven

- Evidence and validation files touched in this subgoal: `validation/block-city-run-validation.mjs`, `validation/block-city-run-evidence.md`, `validation/reference-comparison.md`, `validation/ui-affordance-inventory.md`, `validation/ui-affordance-matrix.md`, `validation/visual-target-summary.md`
- Mechanics re-proven by the fresh audit: responsive on-foot movement, responsive vehicle control, blocker and map-bound collision, safe vehicle exit bounds, corrected human-to-sedan scale read, live CINDER-9 combat with hit or block feedback and heat impact, mission continuity, heat search pressure, respawn recovery, and touch parity.

## Remaining Limitations

- The HUD composition is a stronger reference match than the world-detail density; the source frame still shows richer storefront clutter and a heavier curbside vehicle foreground.
- Mobile landscape remains the intended touch orientation; portrait is validated only for gameplay render sanity rather than ideal play comfort.
- `Sunset Grid` remains the most polished district even though the selector and launch flow keep every district playable.
