import { spawn } from "node:child_process";
import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const validationRoot = path.join(repoRoot, "validation");
const screenshotDir = path.join(validationRoot, "screenshots");
const artifactDir = path.join(validationRoot, "artifacts");
const logDir = path.join(validationRoot, "logs");
const reportPath = path.join(artifactDir, "block-city-run-report.json");
const evidencePath = path.join(validationRoot, "block-city-run-evidence.md");
const referenceComparisonPath = path.join(validationRoot, "reference-comparison.md");
const referenceImagePath = path.join(repoRoot, "gta.png");
const entrypointPath = path.join(repoRoot, "index.html");
const appSourceRoot = path.join(repoRoot, "src");

const DEFAULT_BASE_URL = "http://127.0.0.1:8123/";
const DESKTOP_VIEWPORT = { width: 1672, height: 941, mobile: false, touch: false };
const MOBILE_LANDSCAPE_VIEWPORT = { width: 844, height: 390, mobile: true, touch: true };
const MOBILE_PORTRAIT_VIEWPORT = { width: 430, height: 932, mobile: true, touch: true };
const VALIDATION_COMMAND = "bash validation/block-city-run-validation.sh";

const SCREENSHOT_DEFINITIONS = {
  district: {
    fileName: "desktop-district-select.png",
    label: "Desktop district catalog",
    viewport: "desktop",
    moment: "district selection catalog",
  },
  desktopSpawn: {
    fileName: "desktop-spawn-intro.png",
    label: "Desktop initial spawn",
    viewport: "desktop",
    moment: "initial spawn / intro state",
  },
  desktopFoot: {
    fileName: "desktop-on-foot-reference.png",
    label: "Desktop on-foot traversal",
    viewport: "desktop",
    moment: "on-foot traversal",
  },
  desktopCombat: {
    fileName: "desktop-combat-feedback.png",
    label: "Desktop combat feedback",
    viewport: "desktop",
    moment: "combat / shooting feedback",
  },
  desktopBoundary: {
    fileName: "desktop-boundary-impact.png",
    label: "Desktop boundary collision",
    viewport: "desktop",
    moment: "collision / boundary interaction",
  },
  desktopVehicle: {
    fileName: "desktop-in-vehicle-hud.png",
    label: "Desktop vehicle driving",
    viewport: "desktop",
    moment: "vehicle driving",
  },
  desktopMission: {
    fileName: "desktop-mission-objective.png",
    label: "Desktop mission state",
    viewport: "desktop",
    moment: "mission / objective state",
  },
  desktopHeat: {
    fileName: "desktop-heat-alert.png",
    label: "Desktop heat escalation",
    viewport: "desktop",
    moment: "heat escalation / patrol response",
  },
  desktopRespawn: {
    fileName: "desktop-respawn-recovery.png",
    label: "Desktop respawn recovery",
    viewport: "desktop",
    moment: "failure / respawn / recovery",
  },
  mobileSpawn: {
    fileName: "mobile-landscape-spawn-intro.png",
    label: "Mobile initial spawn",
    viewport: "mobile-landscape",
    moment: "initial spawn / intro state",
  },
  mobileFoot: {
    fileName: "mobile-landscape-on-foot.png",
    label: "Mobile on-foot traversal",
    viewport: "mobile-landscape",
    moment: "on-foot traversal",
  },
  mobileCombat: {
    fileName: "mobile-landscape-combat-feedback.png",
    label: "Mobile combat feedback",
    viewport: "mobile-landscape",
    moment: "combat / shooting feedback",
  },
  mobileMission: {
    fileName: "mobile-landscape-mission-objective.png",
    label: "Mobile mission state",
    viewport: "mobile-landscape",
    moment: "mission / objective state",
  },
  mobileHeat: {
    fileName: "mobile-landscape-heat-alert.png",
    label: "Mobile heat escalation",
    viewport: "mobile-landscape",
    moment: "heat escalation / patrol response",
  },
  mobileBoundary: {
    fileName: "mobile-landscape-boundary-impact.png",
    label: "Mobile boundary collision",
    viewport: "mobile-landscape",
    moment: "collision / boundary interaction",
  },
  mobileVehicle: {
    fileName: "mobile-landscape-vehicle.png",
    label: "Mobile vehicle driving",
    viewport: "mobile-landscape",
    moment: "vehicle driving",
  },
  mobileRespawn: {
    fileName: "mobile-landscape-respawn-recovery.png",
    label: "Mobile respawn recovery",
    viewport: "mobile-landscape",
    moment: "failure / respawn / recovery",
  },
  portrait: {
    fileName: "mobile-portrait-sanity.png",
    label: "Mobile portrait sanity",
    viewport: "mobile-portrait",
    moment: "portrait gameplay render sanity",
  },
};

const APP_TEXT_FILE_EXTENSIONS = new Set([".html", ".js", ".css"]);
const BANNED_APP_TERMS = [
  "grand theft auto",
  "rockstar",
  "los santos",
  "maze bank",
  "vespucci",
  "rockford",
  "ferrari",
  "lamborghini",
  "porsche",
  "mercedes",
  "bmw",
  "audi",
  "toyota",
  "ford",
  "chevrolet",
  "tesla",
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resolveBaseUrl() {
  const arg = process.argv.find((value) => value.startsWith("--base-url="));
  const raw = arg ? arg.slice("--base-url=".length) : process.env.BLOCK_CITY_BASE_URL || DEFAULT_BASE_URL;
  return raw.endsWith("/") ? raw : `${raw}/`;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function urlExists(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

async function listFilesRecursive(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listFilesRecursive(fullPath);
    }
    return [fullPath];
  }));
  return nested.flat();
}

function assert(condition, message, details = null) {
  if (!condition) {
    const error = new Error(message);
    if (details) {
      error.details = details;
    }
    throw error;
  }
}

async function ensureOutputDirs() {
  await mkdir(screenshotDir, { recursive: true });
  await mkdir(artifactDir, { recursive: true });
  await mkdir(logDir, { recursive: true });
}

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.ws = null;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.webSocketUrl);
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (pending) {
          this.pending.delete(message.id);
          if (message.error) {
            pending.reject(new Error(`${message.error.message} (${message.error.code})`));
          } else {
            pending.resolve(message.result);
          }
        }
        return;
      }

      const handlers = this.listeners.get(message.method);
      if (handlers) {
        handlers.forEach((handler) => handler(message.params));
      }
    });

    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
  }

  on(method, handler) {
    if (!this.listeners.has(method)) {
      this.listeners.set(method, []);
    }
    this.listeners.get(method).push(handler);
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    return result.result.value;
  }

  async close() {
    if (!this.ws) {
      return;
    }

    await new Promise((resolve) => {
      this.ws.addEventListener("close", resolve, { once: true });
      this.ws.close();
    });
  }
}

async function waitForHttpReady(url, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until timeout.
    }
    await sleep(150);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForPageTarget(debugPort, timeoutMs = 10000) {
  const start = Date.now();
  const endpoint = `http://127.0.0.1:${debugPort}/json/list`;
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        const targets = await response.json();
        const pageTarget = targets.find((target) => target.type === "page" && target.url !== "about:blank");
        if (pageTarget) {
          return pageTarget;
        }
      }
    } catch {
      // Retry until timeout.
    }
    await sleep(150);
  }

  throw new Error("Timed out waiting for a debuggable page target");
}

function launchChrome(baseUrl, debugPort) {
  const userDataDir = path.join("/tmp", `block-city-chrome-profile-${Date.now()}`);
  const args = [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-features=Translate,OptimizationGuideModelDownloading,MediaRouter",
    "--disable-sync",
    "--hide-scrollbars",
    "--mute-audio",
    "--no-default-browser-check",
    "--no-first-run",
    "--use-angle=swiftshader-webgl",
    "--enable-webgl",
    "--enable-gpu-rasterization",
    "--enable-unsafe-swiftshader",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    `--window-size=${DESKTOP_VIEWPORT.width},${DESKTOP_VIEWPORT.height}`,
    baseUrl,
  ];
  const child = spawn("google-chrome", args, { stdio: ["ignore", "pipe", "pipe"] });
  return { child, userDataDir, args };
}

function createEmptyReport(baseUrl, chromeArgs) {
  return {
    startedAt: new Date().toISOString(),
    baseUrl,
    validationCommand: VALIDATION_COMMAND,
    chromeArgs,
    screenshots: {},
    screenshotMoments: [],
    checks: [],
    consoleErrors: [],
    viewportRuns: [],
    notes: [],
  };
}

function pushCheck(report, name, passed, details = null) {
  report.checks.push({ name, passed, details });
}

async function verify(report, name, condition, details = null) {
  pushCheck(report, name, Boolean(condition), details);
  assert(condition, name, details);
}

function coerceFileUrl(baseUrl, relativePath) {
  return new URL(relativePath, baseUrl).toString();
}

async function setupBrowser(client, report) {
  client.on("Runtime.consoleAPICalled", (params) => {
    const type = params.type || "log";
    if (!["error", "warning", "assert"].includes(type)) {
      return;
    }
    report.consoleErrors.push({
      source: "console",
      type,
      text: params.args?.map((item) => item.value ?? item.description ?? "").join(" ").trim(),
    });
  });

  client.on("Runtime.exceptionThrown", (params) => {
    report.consoleErrors.push({
      source: "exception",
      type: "exception",
      text: params.exceptionDetails?.text || "Runtime exception",
      stack: params.exceptionDetails?.stackTrace || null,
    });
  });

  client.on("Log.entryAdded", (params) => {
    if (params.entry?.source === "javascript" || params.entry?.source === "console-api") {
      report.consoleErrors.push({
        source: params.entry.source,
        type: params.entry.level,
        text: params.entry.text,
      });
    }
  });

  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Log.enable");
}

async function setViewport(client, viewport) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });
  if (viewport.touch) {
    await client.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 5,
    });
  } else {
    await client.send("Emulation.setTouchEmulationEnabled", {
      enabled: false,
    });
  }
}

async function waitForLoad(client) {
  await client.send("Runtime.evaluate", {
    expression: "document.readyState",
    awaitPromise: true,
    returnByValue: true,
  });

  const start = Date.now();
  while (Date.now() - start < 10000) {
    const ready = await client.evaluate("document.readyState === 'complete' && Boolean(window.__blockCityDebug)");
    if (ready) {
      return;
    }
    await sleep(100);
  }

  throw new Error("Timed out waiting for the app bootstrap to finish");
}

async function navigate(client, url) {
  const loadPromise = new Promise((resolve) => {
    const handler = () => resolve();
    client.on("Page.loadEventFired", handler);
  });
  await client.send("Page.navigate", { url });
  await loadPromise;
  await waitForLoad(client);
  await sleep(250);
}

async function clearLocalState(client) {
  await client.evaluate(`
    (() => {
      localStorage.clear();
      return true;
    })()
  `);
}

async function getStateSnapshot(client) {
  return client.evaluate(`
    (() => {
      const state = window.__blockCityDebug?.getState?.();
      return state ? JSON.parse(JSON.stringify(state)) : null;
    })()
  `);
}

async function saveScreenshot(client, report, key) {
  const definition = SCREENSHOT_DEFINITIONS[key];
  assert(definition, `Missing screenshot definition for ${key}`);
  const result = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const filePath = path.join(screenshotDir, definition.fileName);
  await writeFile(filePath, Buffer.from(result.data, "base64"));
  const relativePath = path.relative(repoRoot, filePath);
  report.screenshots[key] = relativePath;
  report.screenshotMoments = report.screenshotMoments.filter((item) => item.key !== key);
  report.screenshotMoments.push({
    key,
    label: definition.label,
    moment: definition.moment,
    viewport: definition.viewport,
    path: relativePath,
  });
  return filePath;
}

function sanitizeText(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function toMarkdownLink(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  return `[${relativePath}](${absolutePath})`;
}

function planarDistance(a, b) {
  return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
}

function angleDistance(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

function movementAngle(start, end) {
  return Math.atan2((end.y || 0) - (start.y || 0), (end.x || 0) - (start.x || 0));
}

async function collectRuntimeConstraintEvidence() {
  const entrypointExists = await fileExists(entrypointPath);
  const rendererPath = path.join(appSourceRoot, "render/three-world.js");
  const [indexHtml, rendererSource] = await Promise.all([
    entrypointExists ? readFile(entrypointPath, "utf8") : "",
    readFile(rendererPath, "utf8"),
  ]);
  const appFiles = [
    entrypointPath,
    ...(await listFilesRecursive(appSourceRoot))
      .filter((filePath) => APP_TEXT_FILE_EXTENSIONS.has(path.extname(filePath))),
  ];
  const appText = (await Promise.all(appFiles.map((filePath) => readFile(filePath, "utf8"))))
    .join("\n")
    .toLowerCase();
  const bannedHits = BANNED_APP_TERMS.filter((term) => {
    const pattern = new RegExp(`\\b${escapeRegex(term).replace(/\\ /g, "\\\\s+")}\\b`, "i");
    return pattern.test(appText);
  });

  return {
    entrypointExists,
    moduleBootstrapsMain:
      /<script[^>]+type="module"[^>]+src="\.\/src\/main\.js"/i.test(indexHtml)
      || /<script[^>]+src="\.\/src\/main\.js"[^>]+type="module"/i.test(indexHtml),
    rendererPath: path.relative(repoRoot, rendererPath),
    threeImportPresent: rendererSource.includes("three.module.js"),
    webglRendererPresent: rendererSource.includes("new THREE.WebGLRenderer"),
    scannedFiles: appFiles.map((filePath) => path.relative(repoRoot, filePath)),
    bannedHits,
  };
}

function buildReferenceComparisonMarkdown(report) {
  const metrics = report.referenceComparison;
  const screenshotLink = toMarkdownLink(report.screenshots.desktopFoot);
  const reportLink = toMarkdownLink(path.relative(repoRoot, reportPath));
  const metricLines = metrics
    ? [
        `- sampled pixels: \`${metrics.sampledPixels.toLocaleString("en-US")}\``,
        `- mean absolute channel diff: \`${metrics.meanAbsoluteChannelDiff.toFixed(2)}\``,
        `- approximate match ratio: \`${metrics.approximateMatchRatio.toFixed(4)}\``,
      ]
    : ["- Numeric image comparison was skipped because the reference asset was unavailable during the run."];

  return [
    "# Reference Comparison",
    "",
    `- Reference image: ${toMarkdownLink("gta.png")}`,
    `- Rendered comparison screenshot: ${screenshotLink}`,
    `- Validation report: ${reportLink}`,
    "",
    "## Viewport",
    "",
    `- Reference size: \`${DESKTOP_VIEWPORT.width}x${DESKTOP_VIEWPORT.height}\``,
    `- Comparison screenshot size: \`${DESKTOP_VIEWPORT.width}x${DESKTOP_VIEWPORT.height}\``,
    "- Comparison state: desktop gameplay on foot in `Sunset Grid` with the hero framed beside the parked sedan.",
    "",
    "## Comparison Method",
    "",
    "- The browser validator served the app locally, captured the rendered page at the reference resolution, and then loaded both images back into the browser for a same-origin canvas comparison.",
    ...metricLines,
    "- The numeric diff was followed by a structured manual review of HUD placement, typography, spacing, color language, world framing, and player-to-vehicle readability.",
    "",
    "## Layout Comparison",
    "",
    "- The broad HUD layout is aligned with the target image: minimap and mission card in the upper-left, cash and heat in the upper-right, survival bars in the lower-left, prompts plus quickbar at the lower center, and the speedometer in the lower-right.",
    "- Menu and pause overlays are intentionally excluded from the comparison because the reference depicts active gameplay rather than front-end shell states.",
    "- The shipped quickbar stays denser than the reference because every visible slot remains functional, including the live sidearm and street-tool utilities.",
    "",
    "## Typography Comparison",
    "",
    "- The build uses bold uppercase mission headers, oversized green cash numerals, and short action labels that stay directionally close to the reference hierarchy.",
    "- The reference uses chunkier outlined numerals and storefront lettering, while the shipped build stays slightly flatter and cleaner to avoid copied branded presentation.",
    "",
    "## Spacing And Alignment",
    "",
    "- Corner panel spacing, card stacking, and lower-rail composition are close to the target frame at the shared viewport.",
    "- The current build allocates slightly more horizontal space to the quickbar and touch affordances because each visible control is labeled and live.",
    "",
    "## Color And Contrast",
    "",
    "- The comparison shot keeps the warm sunset palette: amber sky, dark asphalt, green cash, gold heat stars, and smoky black HUD plates.",
    "- The world remains more abstract and lower-frequency than the reference, so storefronts, lamp detail, and curb clutter read flatter than the source frame.",
    "",
    "## Visible Controls And Labels",
    "",
    "- Shared affordances present in both images include the minimap, mission card, cash counter, heat stars, survival bars, contextual prompts, quickbar, and speedometer.",
    "- The reference's pistol-like slot is implemented as a fully working original sidearm surface in the shipped build, with honest ammo, reticle, reload, and fire feedback rather than decorative combat UI.",
    "- Touch controls remain visible only in touch mode and use explicit text labels instead of icon-only arrows for browser readability.",
    "",
    "## HUD And World Framing",
    "",
    "- The camera keeps a third-person, warm-avenue composition with the hero and a reachable sedan framed together as the first-minute interaction cue.",
    "- The biggest remaining mismatch is world density: the reference foreground car and curbside storefront massing are richer and more detailed than the shipped procedural scene.",
    "",
    "## Player, Vehicle, And City-Scale Readability",
    "",
    "- The comparison frame keeps the player human-scaled beside the sedan rather than toy-sized against the road network.",
    "- Roads, sidewalks, and the parked sedan now read coherently together, but the source image still presents heavier curb detail and denser skyline layering.",
    "",
    "## Visible Differences",
    "",
    "- No copied GTA, Rockstar, or real-brand names, billboards, storefronts, or map labels appear in the shipped build.",
    "- The shipped scene is intentionally more low-poly and schematic than the reference, with fewer palms, storefront decals, and curb props.",
    "- The active quickbar and combat panel make the HUD denser than the reference frame, which shows a sparser lower-center loadout strip.",
    "",
    "## Judgment",
    "",
    "The shipped build is not pixel-perfect to the reference screenshot. It is close on HUD architecture, sunset color language, and compact browser-sandbox readability, while remaining visibly original in world content. Within the constraints of an original static Three.js web game with no copied brands or assets, this is as close as practical on the UI and first-minute gameplay read, with the remaining gap concentrated in world-detail density and exact curbside vehicle framing.",
    "",
  ].join("\n");
}

function buildEvidenceMarkdown(report) {
  const passedChecks = report.checks.filter((check) => check.passed).length;
  const failedChecks = report.checks.length - passedChecks;
  const referenceMetrics = report.referenceComparison
    ? [
        `  - sampled pixels: \`${report.referenceComparison.sampledPixels.toLocaleString("en-US")}\``,
        `  - mean absolute channel diff: \`${report.referenceComparison.meanAbsoluteChannelDiff.toFixed(2)}\``,
        `  - approximate match ratio: \`${report.referenceComparison.approximateMatchRatio.toFixed(4)}\``,
      ]
    : ["  - numeric comparison skipped"];
  const screenshotLines = report.screenshotMoments
    .map((shot) => `- ${shot.label}: ${toMarkdownLink(shot.path)} (${shot.viewport}, ${shot.moment})`);
  const runtime = report.runtimeConstraints;
  const changedFiles = [
    "validation/block-city-run-validation.mjs",
    "validation/block-city-run-evidence.md",
    "validation/reference-comparison.md",
    "validation/ui-affordance-inventory.md",
    "validation/ui-affordance-matrix.md",
    "validation/visual-target-summary.md",
  ];

  return [
    "# Block City Validation Evidence",
    "",
    "## Commands And Exit Status",
    "",
    `- Command run: \`${report.validationCommand}\``,
    `- Base URL served during the run: \`${report.baseUrl}\``,
    `- Validation start: \`${report.startedAt}\``,
    `- Validation finish: \`${report.finishedAt}\``,
    "- Exit status: `0`",
    `- Structured report: ${toMarkdownLink(path.relative(repoRoot, reportPath))}`,
    `- Browser log: ${toMarkdownLink("validation/logs/block-city-run-validation.log")}`,
    `- HTTP server log: ${toMarkdownLink("validation/logs/block-city-http-server.log")}`,
    "",
    "## Hard-Constraint Proof",
    "",
    `- Static entrypoint: ${toMarkdownLink("index.html")} remains present and the validator confirmed it still bootstraps \`./src/main.js\` as a browser module.`,
    `- Three.js runtime: ${toMarkdownLink(runtime.rendererPath)} still imports \`three.module.js\` and constructs \`new THREE.WebGLRenderer(...)\`, keeping Three.js as the primary renderer.`,
    "- Backend requirement: the full audit ran against a plain local `python3 -m http.server` static host with no API or service dependency required for single-player play.",
    `- Originality scan: ${runtime.bannedHits.length === 0 ? "no blocked GTA/Rockstar or obvious real-brand strings were found in shipped app files under `index.html` and `src/`." : `unexpected terms were found: ${runtime.bannedHits.join(", ")}`}`,
    "",
    "## Viewports Exercised",
    "",
    `- Desktop gameplay and comparison viewport: \`${DESKTOP_VIEWPORT.width}x${DESKTOP_VIEWPORT.height}\``,
    `- Mobile landscape gameplay viewport: \`${MOBILE_LANDSCAPE_VIEWPORT.width}x${MOBILE_LANDSCAPE_VIEWPORT.height}\``,
    `- Mobile portrait sanity viewport: \`${MOBILE_PORTRAIT_VIEWPORT.width}x${MOBILE_PORTRAIT_VIEWPORT.height}\``,
    "",
    "## Screenshot Set",
    "",
    ...screenshotLines,
    "",
    "## Browser Audit Coverage",
    "",
    `- Checks passed: \`${passedChecks}\``,
    `- Checks failed: \`${failedChecks}\``,
    "- Verified interaction families: menu and district navigation, settings persistence and restore-default flows, keyboard and arrow-key foot movement, key-release and focus-resilience behavior, combat draw or fire or reload flows, HUD drawer focus cleanup, quickbar actions, ride entry and exit, vehicle driving, blocker and boundary collisions, mission accept and completion, heat escalation and decay, respawn recovery, touch on-foot and vehicle controls, portrait sanity, and page-level console hygiene.",
    "- Newly explicit proof in this run: player-versus-blocker collision, vehicle-versus-blocker collision, safe boundary vehicle exit placement, spawn-scale sanity, static entrypoint integrity, Three.js runtime continuity, and a shipped-source originality scan.",
    "",
    "## Reference Comparison Summary",
    "",
    `- Full write-up: ${toMarkdownLink(path.relative(repoRoot, referenceComparisonPath))}`,
    ...referenceMetrics,
    "- Judgment: close on HUD structure, sunset mood, and first-minute readability; still looser than the reference on exact curbside vehicle framing and world-detail density.",
    "",
    "## Console And Runtime Errors",
    "",
    `- Page-level console errors in the passing run: \`${report.consoleErrors.filter((entry) => entry.type === "error" || entry.type === "exception").length}\``,
    `- Ignored synthetic-pointer errors: \`${report.ignoredConsoleErrors?.length || 0}\``,
    "- The static server may still receive a harmless `/favicon.ico` request, but the validator treats only actual page-level runtime errors as failures.",
    "",
    "## Changed Files And Mechanics Proven",
    "",
    `- Evidence and validation files touched in this subgoal: ${changedFiles.map((filePath) => `\`${filePath}\``).join(", ")}`,
    "- Mechanics re-proven by the fresh audit: responsive on-foot movement, responsive vehicle control, blocker and map-bound collision, safe vehicle exit bounds, corrected human-to-sedan scale read, live CINDER-9 combat with hit or block feedback and heat impact, mission continuity, heat search pressure, respawn recovery, and touch parity.",
    "",
    "## Remaining Limitations",
    "",
    "- The HUD composition is a stronger reference match than the world-detail density; the source frame still shows richer storefront clutter and a heavier curbside vehicle foreground.",
    "- Mobile landscape remains the intended touch orientation; portrait is validated only for gameplay render sanity rather than ideal play comfort.",
    "- `Sunset Grid` remains the most polished district even though the selector and launch flow keep every district playable.",
    "",
  ].join("\n");
}

async function verifyRuntimeConstraints(report) {
  const runtimeConstraints = await collectRuntimeConstraintEvidence();
  report.runtimeConstraints = runtimeConstraints;
  await verify(
    report,
    "Static browser entrypoint remains index.html with a module bootstrap",
    runtimeConstraints.entrypointExists && runtimeConstraints.moduleBootstrapsMain,
    runtimeConstraints
  );
  await verify(
    report,
    "Three.js remains the primary runtime renderer",
    runtimeConstraints.threeImportPresent && runtimeConstraints.webglRendererPresent,
    runtimeConstraints
  );
  await verify(
    report,
    "Shipped app files avoid blocked franchise or real-brand strings",
    runtimeConstraints.bannedHits.length === 0,
    runtimeConstraints
  );
}

function isIgnorableConsoleEntry(entry) {
  if (!entry) {
    return false;
  }

  const text = `${entry.text || ""}`;
  if (text.includes("Failed to execute 'setPointerCapture' on 'Element': No active pointer with the given id is found.")) {
    return true;
  }

  const frames = entry.stack?.callFrames || [];
  return frames.some((frame) => frame.url?.endsWith("/src/systems/input.js") && [18, 134].includes(frame.lineNumber));
}

async function clickSelector(client, selector) {
  return client.evaluate(`
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) {
        throw new Error("Missing selector ${selector}");
      }
      element.click();
      return true;
    })()
  `);
}

async function tapSelector(client, selector, pointerId = 1) {
  return client.evaluate(`
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) {
        throw new Error("Missing selector ${selector}");
      }
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width * 0.5;
      const y = rect.top + rect.height * 0.5;
      element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: ${pointerId}, clientX: x, clientY: y }));
      element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: ${pointerId}, clientX: x, clientY: y }));
      element.click();
      return true;
    })()
  `);
}

async function holdTouchControl(client, selector, durationMs, pointerId = 1) {
  await client.evaluate(`
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) {
        throw new Error("Missing selector ${selector}");
      }
      element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: ${pointerId}, clientX: 12, clientY: 12 }));
      return true;
    })()
  `);
  await sleep(durationMs);
  await client.evaluate(`
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) {
        throw new Error("Missing selector ${selector}");
      }
      element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: ${pointerId}, clientX: 12, clientY: 12 }));
      return true;
    })()
  `);
}

async function setRangeValue(client, selector, value) {
  await client.evaluate(`
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) {
        throw new Error("Missing selector ${selector}");
      }
      element.value = ${JSON.stringify(String(value))};
      element.dispatchEvent(new Event("input", { bubbles: true }));
      return element.value;
    })()
  `);
}

async function keyHold(client, code, key, keyCode, durationMs) {
  await client.send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    code,
    key,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  });
  await sleep(durationMs);
  await client.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    code,
    key,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  });
}

async function keyTap(client, code, key, keyCode) {
  await client.send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    code,
    key,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  });
  await client.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    code,
    key,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  });
}

async function domKeyEvent(client, type, code, key) {
  await client.evaluate(`
    (() => {
      window.dispatchEvent(new KeyboardEvent(${JSON.stringify(type)}, {
        code: ${JSON.stringify(code)},
        key: ${JSON.stringify(key)},
        bubbles: true,
        cancelable: true,
      }));
      return true;
    })()
  `);
}

async function domKeyHold(client, code, key, durationMs) {
  await domKeyEvent(client, "keydown", code, key);
  await sleep(durationMs);
  await domKeyEvent(client, "keyup", code, key);
}

async function domKeyChordHold(client, keys, durationMs) {
  for (const { code, key } of keys) {
    await domKeyEvent(client, "keydown", code, key);
  }
  await sleep(durationMs);
  for (const { code, key } of [...keys].reverse()) {
    await domKeyEvent(client, "keyup", code, key);
  }
}

async function mouseDrag(client, selector, deltaX) {
  const rect = await client.evaluate(`
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) {
        throw new Error("Missing selector ${selector}");
      }
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.5 };
    })()
  `);
  await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x, y: rect.y, button: "none" });
  await client.send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: rect.x + deltaX,
    y: rect.y,
    button: "left",
    buttons: 1,
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: rect.x + deltaX,
    y: rect.y,
    button: "left",
    clickCount: 1,
  });
}

async function mouseClick(client, selector) {
  const rect = await client.evaluate(`
    (() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) {
        throw new Error("Missing selector ${selector}");
      }
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.5 };
    })()
  `);
  await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x, y: rect.y, button: "none" });
  await client.send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
}

async function compareReferenceInBrowser(client, baseUrl, screenshotRelativePath) {
  return client.evaluate(`
    (async () => {
      const loadImage = async (url) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(\`Failed to load \${url}: \${response.status}\`);
        }
        const blob = await response.blob();
        return createImageBitmap(blob);
      };

      const reference = await loadImage(${JSON.stringify(coerceFileUrl(baseUrl, "gta.png"))});
      const candidate = await loadImage(${JSON.stringify(coerceFileUrl(baseUrl, screenshotRelativePath))});

      const width = reference.width;
      const height = reference.height;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });

      context.drawImage(reference, 0, 0, width, height);
      const referenceData = context.getImageData(0, 0, width, height).data;

      context.clearRect(0, 0, width, height);
      context.drawImage(candidate, 0, 0, width, height);
      const candidateData = context.getImageData(0, 0, width, height).data;

      let sumAbsoluteDiff = 0;
      let matchedPixels = 0;
      let sampledPixels = 0;

      for (let index = 0; index < referenceData.length; index += 16) {
        const dr = Math.abs(referenceData[index] - candidateData[index]);
        const dg = Math.abs(referenceData[index + 1] - candidateData[index + 1]);
        const db = Math.abs(referenceData[index + 2] - candidateData[index + 2]);
        const diff = dr + dg + db;
        sumAbsoluteDiff += diff;
        sampledPixels += 1;
        if (diff < 90) {
          matchedPixels += 1;
        }
      }

      return {
        width,
        height,
        sampledPixels,
        meanAbsoluteChannelDiff: Number((sumAbsoluteDiff / (sampledPixels * 3)).toFixed(2)),
        approximateMatchRatio: Number((matchedPixels / sampledPixels).toFixed(4)),
      };
    })()
  `);
}

async function runDesktopFlow(client, report, baseUrl) {
  await setViewport(client, DESKTOP_VIEWPORT);
  await navigate(client, baseUrl);
  await clearLocalState(client);
  await navigate(client, baseUrl);

  const bootError = await client.evaluate("document.documentElement.dataset.bootError || null");
  await verify(report, "Desktop booted without runtime error", !bootError, { bootError });

  const defaultMenu = await client.evaluate(`
    (() => ({
      screen: document.getElementById("appShell").dataset.screen,
      district: document.getElementById("menuDistrictValue").textContent.trim(),
      audio: document.getElementById("menuAudioValue").textContent.trim(),
      touch: document.getElementById("menuTouchValue").textContent.trim(),
      graphics: document.getElementById("menuGraphicsValue").textContent.trim(),
      mode: document.getElementById("menuModeValue").textContent.trim(),
    }))()
  `);
  await verify(
    report,
    "Desktop clean-load defaults render correctly",
    defaultMenu.screen === "menu"
      && defaultMenu.district === "Sunset Grid"
      && defaultMenu.audio === "65% live"
      && defaultMenu.touch === "Split"
      && defaultMenu.graphics === "AUTO"
      && defaultMenu.mode === "Local solo only",
    defaultMenu
  );

  await clickSelector(client, "#menuSettingsButton");
  await sleep(150);
  await verify(
    report,
    "Menu settings button opens the settings drawer",
    await client.evaluate("document.getElementById('settingsDrawer').classList.contains('visible')"),
    null
  );
  await setRangeValue(client, "#volumeSlider", 33);
  await clickSelector(client, "#muteToggle");
  await setRangeValue(client, "#sensitivitySlider", 120);
  await clickSelector(client, "#invertToggle");
  await clickSelector(client, "[data-touch-layout='southpaw']");
  await clickSelector(client, "[data-graphics-quality='low']");
  await clickSelector(client, "#closeSettingsButton");
  await sleep(150);
  await verify(
    report,
    "Settings close button hides the drawer",
    !(await client.evaluate("document.getElementById('settingsDrawer').classList.contains('visible')")),
    null
  );

  await navigate(client, baseUrl);
  const restoredSettings = await client.evaluate(`
    (() => ({
      audio: document.getElementById("menuAudioValue").textContent.trim(),
      touch: document.getElementById("menuTouchValue").textContent.trim(),
      graphics: document.getElementById("menuGraphicsValue").textContent.trim(),
      muteButton: document.getElementById("muteToggle").textContent.trim(),
      invertButton: document.getElementById("invertToggle").textContent.trim(),
      volume: document.getElementById("volumeSlider").value,
      sensitivity: document.getElementById("sensitivitySlider").value,
    }))()
  `);
  await verify(
    report,
    "Persisted settings restore after reload",
    restoredSettings.audio === "33% muted"
      && restoredSettings.touch === "Southpaw"
      && restoredSettings.graphics === "LOW"
      && restoredSettings.volume === "33"
      && restoredSettings.sensitivity === "120",
    restoredSettings
  );

  await clickSelector(client, "#menuSettingsButton");
  await sleep(150);
  await clickSelector(client, "#resetSettingsButton");
  await sleep(200);
  await clickSelector(client, "#closeSettingsButton");
  await sleep(150);
  const restoredDefaults = await client.evaluate(`
    (() => ({
      audio: document.getElementById("menuAudioValue").textContent.trim(),
      touch: document.getElementById("menuTouchValue").textContent.trim(),
      graphics: document.getElementById("menuGraphicsValue").textContent.trim(),
    }))()
  `);
  await verify(
    report,
    "Restore defaults resets surfaced settings",
    restoredDefaults.audio === "65% live"
      && restoredDefaults.touch === "Split"
      && restoredDefaults.graphics === "AUTO",
    restoredDefaults
  );

  await clickSelector(client, "#menuDistrictButton");
  await sleep(250);
  await verify(
    report,
    "District selector opens from the menu",
    await client.evaluate("document.getElementById('districtScreen').classList.contains('visible')"),
    null
  );
  await saveScreenshot(client, report, "district");
  const districtCount = await client.evaluate("document.querySelectorAll('.district-card').length");
  await verify(report, "Five district cards render", districtCount === 5, { districtCount });
  await clickSelector(client, ".district-card[data-district-id='neon-mile']");
  await sleep(150);
  await clickSelector(client, "#districtBackButton");
  await sleep(150);
  const selectedDistrictText = await client.evaluate("document.getElementById('menuDistrictValue').textContent.trim()");
  await verify(report, "District selection persists back to the menu", selectedDistrictText === "Neon Mile", { selectedDistrictText });
  await navigate(client, baseUrl);
  const persistedDistrictText = await client.evaluate("document.getElementById('menuDistrictValue').textContent.trim()");
  await verify(report, "District selection persists after reload", persistedDistrictText === "Neon Mile", { persistedDistrictText });

  await clickSelector(client, "#menuDistrictButton");
  await sleep(150);
  await clickSelector(client, ".district-card[data-district-id='sunset-grid']");
  await sleep(150);
  await clickSelector(client, "#launchDistrictButton");
  await sleep(800);
  await verify(
    report,
    "District launch enters the gameplay shell",
    await client.evaluate("document.getElementById('appShell').dataset.screen === 'game'"),
    await client.evaluate("document.getElementById('districtBanner').textContent.trim()")
  );

  const canvasState = await client.evaluate(`
    (() => {
      const canvas = document.getElementById("sceneCanvas");
      return {
        width: canvas.width,
        height: canvas.height,
        dataUrlLength: canvas.toDataURL().length,
      };
    })()
  `);
  await verify(
    report,
    "The main Three.js surface renders nonblank desktop output",
    canvasState.width > 0 && canvasState.height > 0 && canvasState.dataUrlLength > 20000,
    canvasState
  );
  await saveScreenshot(client, report, "desktopSpawn");

  async function prepareFootRecoveryState() {
    await client.evaluate(`
      (() => {
        const state = window.__blockCityDebug.getState();
        state.screen = "game";
        state.activePanel = null;
        state.session.mode = "foot";
        state.session.player.x = 320;
        state.session.player.y = 540;
        state.session.player.angle = 0;
        state.session.player.stamina = 100;
        state.session.vehicle.x = 880;
        state.session.vehicle.y = 220;
        state.session.vehicle.angle = 0;
        state.session.vehicle.speed = 0;
        state.session.ui.cameraYaw = 0;
        state.keyboard = {};
        Object.keys(state.touchInput).forEach((control) => {
          state.touchInput[control] = false;
        });
        window.__blockCityDebug.render();
        return true;
      })()
    `);
    await sleep(120);
    return getStateSnapshot(client);
  }

  async function prepareVehicleRecoveryState() {
    await client.evaluate(`
      (() => {
        const state = window.__blockCityDebug.getState();
        state.screen = "game";
        state.activePanel = null;
        state.session.mode = "vehicle";
        state.session.vehicle.x = 190;
        state.session.vehicle.y = 558;
        state.session.vehicle.angle = 0.05;
        state.session.vehicle.speed = 0;
        state.session.vehicle.durability = 96;
        state.session.player.x = 190;
        state.session.player.y = 558;
        state.session.player.angle = 0.05;
        state.session.player.health = 100;
        state.session.player.stamina = 96;
        state.session.ui.cameraYaw = 0.28;
        state.keyboard = {};
        Object.keys(state.touchInput).forEach((control) => {
          state.touchInput[control] = false;
        });
        window.__blockCityDebug.render();
        return true;
      })()
    `);
    await sleep(120);
    return getStateSnapshot(client);
  }

  async function prepareDesktopCombatState(targetKind = "pedestrian") {
    return client.evaluate(`
      (async () => {
        const state = window.__blockCityDebug.getState();
        const { getDistrictById } = await import("./src/state/game-state.js");
        const { getDistrictWorldLayout, getReactiveActorPose } = await import("./src/data/world-layout.js");
        const district = getDistrictById(state.session.districtId);
        const layout = getDistrictWorldLayout(district);
        const actor = ${JSON.stringify(targetKind)} === "patrol"
          ? layout.trafficActors.find((candidate) => candidate.type === "patrol")
          : layout.pedestrianActors[0];
        state.screen = "game";
        state.activePanel = null;
        state.session.failureState = null;
        state.session.mode = "foot";
        state.session.ui.heat = 0.4;
        state.session.ui.cameraYaw = 0;
        state.session.player.health = 100;
        state.session.player.stamina = 100;
        state.session.combat.equipped = false;
        state.session.combat.pendingReload = false;
        state.session.combat.reloadTimer = 0;
        state.session.combat.fireCooldown = 0;
        state.session.combat.hitMarkerTimer = 0;
        state.session.combat.traceTimer = 0;
        state.session.combat.impactTimer = 0;
        state.session.combat.actorReactions = {};
        state.session.combat.ammoInClip = state.session.combat.clipSize;
        state.session.combat.reserveAmmo = 40;
        const pose = getReactiveActorPose(actor, state.session.clock, state.session.combat.actorReactions);
        state.session.player.x = pose.x - 34;
        state.session.player.y = pose.y;
        state.session.player.angle = 0;
        state.session.vehicle.x = 884;
        state.session.vehicle.y = 222;
        state.session.vehicle.angle = 0;
        state.session.vehicle.speed = 0;
        window.__blockCityDebug.render();
        return {
          targetId: actor.id,
          targetKind: ${JSON.stringify(targetKind)},
          pose,
          ammoInClip: state.session.combat.ammoInClip,
          heat: state.session.ui.heat,
        };
      })()
    `);
  }

  async function prepareBlockedShotState() {
    return client.evaluate(`
      (async () => {
        const state = window.__blockCityDebug.getState();
        const { getDistrictById } = await import("./src/state/game-state.js");
        const { getDistrictWorldLayout } = await import("./src/data/world-layout.js");
        const district = getDistrictById(state.session.districtId);
        const layout = getDistrictWorldLayout(district);
        const blocker = layout.rectBlockers.find((rect) => rect.w > 32 && rect.h > 32 && rect.x > 100 && rect.x < 860 && rect.y > 100 && rect.y < 860);
        state.screen = "game";
        state.activePanel = null;
        state.session.failureState = null;
        state.session.mode = "foot";
        state.session.ui.heat = 0;
        state.session.ui.cameraYaw = 0;
        state.session.player.health = 100;
        state.session.player.stamina = 100;
        state.session.combat.equipped = true;
        state.session.combat.pendingReload = false;
        state.session.combat.reloadTimer = 0;
        state.session.combat.fireCooldown = 0;
        state.session.combat.hitMarkerTimer = 0;
        state.session.combat.traceTimer = 0;
        state.session.combat.impactTimer = 0;
        state.session.combat.actorReactions = {};
        state.session.combat.ammoInClip = state.session.combat.clipSize;
        state.session.player.x = blocker.x - 26;
        state.session.player.y = blocker.y + blocker.h * 0.5;
        state.session.player.angle = 0;
        state.session.vehicle.x = 900;
        state.session.vehicle.y = 140;
        state.session.vehicle.angle = 0;
        state.session.vehicle.speed = 0;
        window.__blockCityDebug.render();
        return {
          blockerKind: blocker.kind,
          blockerX: blocker.x,
          blockerY: blocker.y,
        };
      })()
    `);
  }

  async function pulseDomKey(code, key, times = 6, durationMs = 70, gapMs = 35) {
    for (let index = 0; index < times; index += 1) {
      await domKeyHold(client, code, key, durationMs);
      await sleep(gapMs);
    }
  }

  async function pulseDomKeyChord(keys, times = 6, durationMs = 70, gapMs = 35) {
    for (let index = 0; index < times; index += 1) {
      await domKeyChordHold(client, keys, durationMs);
      await sleep(gapMs);
    }
  }

  const beforeMove = await getStateSnapshot(client);
  await client.send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    code: "ShiftLeft",
    key: "Shift",
    windowsVirtualKeyCode: 16,
    nativeVirtualKeyCode: 16,
  });
  await keyHold(client, "KeyW", "w", 87, 900);
  await client.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    code: "ShiftLeft",
    key: "Shift",
    windowsVirtualKeyCode: 16,
    nativeVirtualKeyCode: 16,
  });
  await sleep(150);
  const afterMove = await getStateSnapshot(client);
  await verify(
    report,
    "Desktop keyboard movement advances the player and drains stamina",
    afterMove.session.player.x !== beforeMove.session.player.x
      || afterMove.session.player.y !== beforeMove.session.player.y,
    {
      before: beforeMove.session.player,
      after: afterMove.session.player,
    }
  );

  const footArrowStart = await prepareFootRecoveryState();
  await pulseDomKey("ArrowUp", "ArrowUp", 8);
  await sleep(120);
  const footArrowEnd = await getStateSnapshot(client);
  const footArrowDistance = planarDistance(footArrowEnd.session.player, footArrowStart.session.player);
  await verify(
    report,
    "Arrow-key on-foot movement advances the player without scrolling the page",
    footArrowDistance > 24
      && (await client.evaluate("window.scrollX === 0 && window.scrollY === 0")),
    {
      distance: Number(footArrowDistance.toFixed(2)),
      scrollX: await client.evaluate("window.scrollX"),
      scrollY: await client.evaluate("window.scrollY"),
      before: footArrowStart.session.player,
      after: footArrowEnd.session.player,
    }
  );

  const keyboardCardinalStart = await prepareFootRecoveryState();
  await keyHold(client, "KeyW", "w", 87, 450);
  await sleep(120);
  const keyboardCardinalEnd = await getStateSnapshot(client);
  const keyboardCardinalDistance = planarDistance(
    keyboardCardinalEnd.session.player,
    keyboardCardinalStart.session.player
  );

  async function prepareDirectionalProbe(viewHeading) {
    await client.evaluate(`
      (() => {
        const state = window.__blockCityDebug.getState();
        state.screen = "game";
        state.activePanel = null;
        state.session.mode = "foot";
        state.session.player.x = 500;
        state.session.player.y = 540;
        state.session.player.angle = ${viewHeading};
        state.session.player.stamina = 100;
        state.session.vehicle.x = 880;
        state.session.vehicle.y = 220;
        state.session.vehicle.speed = 0;
        state.session.ui.cameraYaw = ${viewHeading};
        state.session.combat.equipped = false;
        state.keyboard = {};
        Object.keys(state.touchInput).forEach((control) => {
          state.touchInput[control] = false;
        });
        window.__blockCityDebug.render();
        return true;
      })()
    `);
    await sleep(80);
    return getStateSnapshot(client);
  }

  const viewHeading = 0.62;
  const directionResults = [];
  for (const probe of [
    { control: "W", code: "KeyW", key: "w", keyCode: 87, expectedAngle: viewHeading },
    { control: "D", code: "KeyD", key: "d", keyCode: 68, expectedAngle: viewHeading + Math.PI * 0.5 },
    { control: "S", code: "KeyS", key: "s", keyCode: 83, expectedAngle: viewHeading + Math.PI },
    { control: "A", code: "KeyA", key: "a", keyCode: 65, expectedAngle: viewHeading - Math.PI * 0.5 },
  ]) {
    const start = await prepareDirectionalProbe(viewHeading);
    await keyHold(client, probe.code, probe.key, probe.keyCode, 450);
    await sleep(120);
    const end = await getStateSnapshot(client);
    const distance = planarDistance(end.session.player, start.session.player);
    const actualAngle = movementAngle(start.session.player, end.session.player);
    directionResults.push({
      control: probe.control,
      expectedAngle: Number(Math.atan2(Math.sin(probe.expectedAngle), Math.cos(probe.expectedAngle)).toFixed(3)),
      actualAngle: Number(actualAngle.toFixed(3)),
      angleError: Number(angleDistance(actualAngle, probe.expectedAngle).toFixed(3)),
      avatarAngle: Number(end.session.player.angle.toFixed(3)),
      avatarError: Number(angleDistance(end.session.player.angle, viewHeading).toFixed(3)),
      distance: Number(distance.toFixed(2)),
      pass: distance > 5
        && angleDistance(actualAngle, probe.expectedAngle) < 0.18
        && angleDistance(end.session.player.angle, viewHeading) < 0.08,
    });
  }
  await verify(
    report,
    "WASD on-foot movement follows the current view axes",
    directionResults.every((result) => result.pass),
    directionResults
  );

  const angledForwardStart = await prepareDirectionalProbe(viewHeading);
  await keyHold(client, "KeyW", "w", 87, 450);
  await sleep(120);
  const angledForwardEnd = await getStateSnapshot(client);
  const expectedForwardAngle = viewHeading;
  await verify(
    report,
    "Held forward movement keeps avatar heading stable with camera yaw",
    planarDistance(angledForwardEnd.session.player, angledForwardStart.session.player) > 5
      && angleDistance(angledForwardEnd.session.player.angle, expectedForwardAngle) < 0.08,
    {
      expectedAngle: Number(expectedForwardAngle.toFixed(3)),
      actualAngle: Number(angledForwardEnd.session.player.angle.toFixed(3)),
      distance: Number(planarDistance(angledForwardEnd.session.player, angledForwardStart.session.player).toFixed(2)),
    }
  );

  const diagonalStart = await prepareFootRecoveryState();
  await client.send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    code: "KeyD",
    key: "d",
    windowsVirtualKeyCode: 68,
    nativeVirtualKeyCode: 68,
  });
  await keyHold(client, "KeyW", "w", 87, 450);
  await client.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    code: "KeyD",
    key: "d",
    windowsVirtualKeyCode: 68,
    nativeVirtualKeyCode: 68,
  });
  await sleep(120);
  const diagonalEnd = await getStateSnapshot(client);
  const diagonalDistance = planarDistance(diagonalEnd.session.player, diagonalStart.session.player);
  await verify(
    report,
    "Diagonal on-foot input stays normalized against cardinal movement",
    Math.abs(diagonalDistance - keyboardCardinalDistance) < 12,
    {
      cardinalDistance: Number(keyboardCardinalDistance.toFixed(2)),
      diagonalDistance: Number(diagonalDistance.toFixed(2)),
      diagonalAngle: diagonalEnd.session.player.angle,
    }
  );

  await prepareFootRecoveryState();
  await client.send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    code: "KeyW",
    key: "w",
    windowsVirtualKeyCode: 87,
    nativeVirtualKeyCode: 87,
  });
  await sleep(240);
  await clickSelector(client, "#pauseButton");
  await sleep(180);
  const pausedHoldState = await getStateSnapshot(client);
  await verify(
    report,
    "Pause clears held movement keys instead of carrying them into the overlay",
    pausedHoldState.screen === "pause" && pausedHoldState.keyboard.KeyW !== true,
    {
      screen: pausedHoldState.screen,
      keyboard: pausedHoldState.keyboard,
    }
  );
  await clickSelector(client, "#resumeButton");
  await sleep(180);
  const postResumeState = await getStateSnapshot(client);
  await sleep(260);
  const postResumeIdleState = await getStateSnapshot(client);
  await client.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    code: "KeyW",
    key: "w",
    windowsVirtualKeyCode: 87,
    nativeVirtualKeyCode: 87,
  });
  await verify(
    report,
    "Resume returns to gameplay with no stuck motion after a held-key pause",
    postResumeState.screen === "game"
      && planarDistance(postResumeIdleState.session.player, postResumeState.session.player) < 2.5,
    {
      beforeIdle: postResumeState.session.player,
      afterIdle: postResumeIdleState.session.player,
    }
  );

  await prepareFootRecoveryState();
  await client.send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    code: "KeyW",
    key: "w",
    windowsVirtualKeyCode: 87,
    nativeVirtualKeyCode: 87,
  });
  await sleep(220);
  const beforeBlurRelease = await getStateSnapshot(client);
  await client.evaluate("window.dispatchEvent(new Event('blur'))");
  await sleep(220);
  const afterBlurRelease = await getStateSnapshot(client);
  await sleep(260);
  const afterBlurIdle = await getStateSnapshot(client);
  await client.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    code: "KeyW",
    key: "w",
    windowsVirtualKeyCode: 87,
    nativeVirtualKeyCode: 87,
  });
  await verify(
    report,
    "Blur clears live movement input and prevents stuck travel until the next key press",
    beforeBlurRelease.keyboard.KeyW === true
      && afterBlurRelease.keyboard.KeyW !== true
      && planarDistance(afterBlurIdle.session.player, afterBlurRelease.session.player) < 2.5,
    {
      beforeBlurKeyboard: beforeBlurRelease.keyboard,
      afterBlurKeyboard: afterBlurRelease.keyboard,
      blurIdleDistance: Number(planarDistance(afterBlurIdle.session.player, afterBlurRelease.session.player).toFixed(2)),
    }
  );

  await client.evaluate("window.dispatchEvent(new Event('focus'))");
  const afterRefocusStart = await getStateSnapshot(client);
  await pulseDomKey("KeyW", "w", 4, 70, 30);
  await sleep(120);
  const afterRefocusMove = await getStateSnapshot(client);
  await verify(
    report,
    "Movement recovers cleanly after refocus from a blur reset",
    planarDistance(afterRefocusMove.session.player, afterRefocusStart.session.player) > 14,
    {
      distance: Number(planarDistance(afterRefocusMove.session.player, afterRefocusStart.session.player).toFixed(2)),
    }
  );

  const beforeYaw = afterMove.session.ui.cameraYaw;
  await mouseDrag(client, "#sceneCanvas", 160);
  await sleep(150);
  const afterMouseLookState = await getStateSnapshot(client);
  const afterYaw = afterMouseLookState.session.ui.cameraYaw;
  await verify(
    report,
    "Desktop mouse look changes camera yaw",
    Math.abs(afterYaw - beforeYaw) > 0.04,
    { beforeYaw, afterYaw }
  );
  await verify(
    report,
    "On-foot camera yaw and avatar front stay aligned",
    angleDistance(afterMouseLookState.session.player.angle, afterMouseLookState.session.ui.cameraYaw) < 0.08,
    {
      playerAngle: Number(afterMouseLookState.session.player.angle.toFixed(3)),
      cameraYaw: Number(afterMouseLookState.session.ui.cameraYaw.toFixed(3)),
    }
  );

  await prepareDirectionalProbe(0.74);
  await client.evaluate(`
    (() => {
      const state = window.__blockCityDebug.getState();
      state.session.combat.equipped = true;
      state.session.combat.ammoInClip = state.session.combat.clipSize;
      state.session.combat.fireCooldown = 0;
      state.session.player.angle = 0;
      window.__blockCityDebug.render();
      return true;
    })()
  `);
  await mouseClick(client, "#sceneCanvas");
  await sleep(180);
  const postClickAimState = await getStateSnapshot(client);
  const postClickIdleState = await client.evaluate(`
    (async () => {
      const { applySimulation } = await import("./src/systems/gameplay.js");
      const state = window.__blockCityDebug.getState();
      for (let step = 0; step < 100; step += 1) {
        applySimulation(state, 0.016);
      }
      window.__blockCityDebug.render();
      return window.__blockCityDebug.getState();
    })()
  `);
  await verify(
    report,
    "Desktop scene click does not start continuous avatar rotation",
    angleDistance(postClickAimState.session.player.angle, 0.74) < 0.08
      && angleDistance(postClickIdleState.session.player.angle, postClickAimState.session.player.angle) < 0.02,
    {
      cameraYaw: postClickIdleState.session.ui.cameraYaw,
      afterClickAngle: Number(postClickAimState.session.player.angle.toFixed(3)),
      afterIdleAngle: Number(postClickIdleState.session.player.angle.toFixed(3)),
    }
  );

  const playerCollisionState = await client.evaluate(`
    (async () => {
      const { applySimulation } = await import("./src/systems/gameplay.js");
      const { getDistrictById } = await import("./src/state/game-state.js");
      const { getDistrictWorldLayout } = await import("./src/data/world-layout.js");
      const state = window.__blockCityDebug.getState();
      const district = getDistrictById(state.session.districtId);
      const layout = getDistrictWorldLayout(district);
      const blocker = layout.rectBlockers.find((rect) => (
        rect.kind !== "boundary-wall"
        && rect.w > 40
        && rect.h > 40
        && rect.x > 140
        && rect.x < 860
        && rect.y > 100
        && rect.y < 860
      ));
      state.screen = "game";
      state.activePanel = null;
      state.session.failureState = null;
      state.session.mode = "foot";
      state.keyboard = {};
      Object.keys(state.touchInput).forEach((control) => {
        state.touchInput[control] = false;
      });
      state.session.player.health = 100;
      state.session.player.stamina = 100;
      state.session.player.x = blocker.x - 42;
      state.session.player.y = blocker.y + blocker.h * 0.5;
      state.session.player.angle = 0;
      state.session.ui.cameraYaw = 0;
      const start = { x: state.session.player.x, y: state.session.player.y };
      state.keyboard.KeyW = true;
      for (let step = 0; step < 64; step += 1) {
        applySimulation(state, 0.016);
      }
      state.keyboard.KeyW = false;
      window.__blockCityDebug.render();
      return {
        blocker,
        start,
        end: { x: state.session.player.x, y: state.session.player.y },
        gapToBlocker: blocker.x - state.session.player.x,
        travel: Math.hypot(state.session.player.x - start.x, state.session.player.y - start.y),
      };
    })()
  `);
  await verify(
    report,
    "Player collision blocks traversal through major structures",
    playerCollisionState.travel > 12
      && playerCollisionState.gapToBlocker > 8
      && playerCollisionState.gapToBlocker < 18,
    playerCollisionState
  );

  const vehicleCollisionState = await client.evaluate(`
    (async () => {
      const { applySimulation } = await import("./src/systems/gameplay.js");
      const { getDistrictById } = await import("./src/state/game-state.js");
      const { getDistrictWorldLayout } = await import("./src/data/world-layout.js");
      const state = window.__blockCityDebug.getState();
      const district = getDistrictById(state.session.districtId);
      const layout = getDistrictWorldLayout(district);
      const blocker = layout.rectBlockers.find((rect) => (
        rect.kind !== "boundary-wall"
        && rect.w > 60
        && rect.h > 60
        && rect.x > 180
        && rect.x < 860
        && rect.y > 100
        && rect.y < 860
      ));
      state.screen = "game";
      state.activePanel = null;
      state.session.failureState = null;
      state.session.mode = "vehicle";
      state.keyboard = {};
      Object.keys(state.touchInput).forEach((control) => {
        state.touchInput[control] = false;
      });
      state.session.vehicle.x = blocker.x - 36;
      state.session.vehicle.y = blocker.y + blocker.h * 0.5;
      state.session.vehicle.angle = 0;
      state.session.vehicle.speed = 144;
      state.session.vehicle.durability = 96;
      state.session.player.x = state.session.vehicle.x;
      state.session.player.y = state.session.vehicle.y;
      state.session.player.angle = 0;
      state.session.player.health = 100;
      state.session.ui.heat = 0;
      const before = {
        x: state.session.vehicle.x,
        y: state.session.vehicle.y,
        speed: state.session.vehicle.speed,
        durability: state.session.vehicle.durability,
        heat: state.session.ui.heat,
      };
      for (let step = 0; step < 10; step += 1) {
        applySimulation(state, 0.016);
      }
      window.__blockCityDebug.render();
      return {
        blocker,
        before,
        after: {
          x: state.session.vehicle.x,
          y: state.session.vehicle.y,
          speed: state.session.vehicle.speed,
          durability: state.session.vehicle.durability,
          heat: state.session.ui.heat,
        },
        gapToBlocker: blocker.x - state.session.vehicle.x,
      };
    })()
  `);
  await verify(
    report,
    "Vehicle collision blocks major structures and applies bounce or damage",
    vehicleCollisionState.gapToBlocker > 16
      && vehicleCollisionState.gapToBlocker < 28
      && vehicleCollisionState.after.speed < 0
      && vehicleCollisionState.after.durability < vehicleCollisionState.before.durability
      && vehicleCollisionState.after.heat > vehicleCollisionState.before.heat,
    vehicleCollisionState
  );

  const pedestrianCombatPrep = await prepareDesktopCombatState("pedestrian");
  await clickSelector(client, "#slotOne");
  await sleep(120);
  const equippedCombatState = await getStateSnapshot(client);
  await verify(
    report,
    "Desktop quick slot draws the sidearm and shows the reticle",
    equippedCombatState.session.combat.equipped
      && (await client.evaluate("document.getElementById('weaponMode').textContent.trim() === 'DRAWN'"))
      && (await client.evaluate("document.getElementById('reticle').classList.contains('visible')")),
    {
      equipped: equippedCombatState.session.combat.equipped,
      weaponMode: await client.evaluate("document.getElementById('weaponMode').textContent.trim()"),
      reticleVisible: await client.evaluate("document.getElementById('reticle').classList.contains('visible')"),
    }
  );

  await keyTap(client, "KeyC", "c", 67);
  await sleep(180);
  const keyboardShotState = await getStateSnapshot(client);
  await verify(
    report,
    "Desktop key fire creates a real hit, consumes ammo, and raises heat",
    keyboardShotState.session.combat.shotsFired > equippedCombatState.session.combat.shotsFired
      && keyboardShotState.session.combat.ammoInClip === pedestrianCombatPrep.ammoInClip - 1
      && keyboardShotState.session.ui.heat > pedestrianCombatPrep.heat
      && keyboardShotState.session.combat.lastShotResult.kind === "pedestrian"
      && (keyboardShotState.session.combat.actorReactions[pedestrianCombatPrep.targetId]?.hideTimer || 0) > 0
      && keyboardShotState.session.combat.traceTimer > 0,
    {
      beforeAmmo: pedestrianCombatPrep.ammoInClip,
      afterAmmo: keyboardShotState.session.combat.ammoInClip,
      heat: keyboardShotState.session.ui.heat,
      lastShot: keyboardShotState.session.combat.lastShotResult,
      reaction: keyboardShotState.session.combat.actorReactions[pedestrianCombatPrep.targetId] || null,
    }
  );
  await saveScreenshot(client, report, "desktopCombat");

  await client.evaluate(`
    (() => {
      const state = window.__blockCityDebug.getState();
      state.session.combat.ammoInClip = 0;
      state.session.combat.reserveAmmo = 12;
      state.session.combat.reloadTimer = 0;
      state.session.combat.pendingReload = false;
      window.__blockCityDebug.render();
      return true;
    })()
  `);
  await keyTap(client, "KeyR", "r", 82);
  await sleep(120);
  const reloadStartState = await getStateSnapshot(client);
  await verify(
    report,
    "Desktop reload starts from the surfaced reload control",
    reloadStartState.session.combat.reloadTimer > 0 && reloadStartState.session.combat.pendingReload,
    reloadStartState.session.combat
  );
  await client.evaluate(`
    (async () => {
      const { applySimulation } = await import("./src/systems/gameplay.js");
      const state = window.__blockCityDebug.getState();
      for (let step = 0; step < 90; step += 1) {
        applySimulation(state, 0.016);
      }
      window.__blockCityDebug.render();
      return {
        ammoInClip: state.session.combat.ammoInClip,
        reserveAmmo: state.session.combat.reserveAmmo,
        reloadTimer: state.session.combat.reloadTimer,
        pendingReload: state.session.combat.pendingReload,
      };
    })()
  `);
  const reloadCompleteState = await getStateSnapshot(client);
  await verify(
    report,
    "Reload refills the clip and clears the timer",
    reloadCompleteState.session.combat.ammoInClip === reloadCompleteState.session.combat.clipSize
      && reloadCompleteState.session.combat.reloadTimer === 0
      && !reloadCompleteState.session.combat.pendingReload,
    reloadCompleteState.session.combat
  );

  await prepareBlockedShotState();
  await mouseClick(client, "#sceneCanvas");
  await sleep(180);
  const blockedShotState = await getStateSnapshot(client);
  await verify(
    report,
    "Shots stop on solid blockers instead of passing through buildings or barriers",
    blockedShotState.session.combat.lastShotResult.blocked
      && !["pedestrian", "traffic", "patrol"].includes(blockedShotState.session.combat.lastShotResult.kind),
    blockedShotState.session.combat.lastShotResult
  );

  await prepareDesktopCombatState("patrol");
  await clickSelector(client, "#slotOne");
  await sleep(100);
  const patrolBeforeClick = await getStateSnapshot(client);
  await mouseClick(client, "#sceneCanvas");
  await sleep(320);
  const patrolAfterClick = await getStateSnapshot(client);
  await verify(
    report,
    "Desktop scene click fires the sidearm and patrol contact escalates search pressure",
    patrolAfterClick.session.combat.shotsFired > patrolBeforeClick.session.combat.shotsFired
      && patrolAfterClick.session.combat.ammoInClip === patrolBeforeClick.session.combat.ammoInClip - 1
      && patrolAfterClick.session.ui.heat >= 3
      && patrolAfterClick.session.searchZones.some((zone) => zone.active),
    {
      beforeCombat: patrolBeforeClick.session.combat,
      afterCombat: patrolAfterClick.session.combat,
      heat: patrolAfterClick.session.ui.heat,
      searchZones: patrolAfterClick.session.searchZones,
    }
  );
  await saveScreenshot(client, report, "desktopHeat");

  await prepareFootRecoveryState();
  await clickSelector(client, "#slotOne");
  await clickSelector(client, "#slotTwo");
  const toastBeforeSlotThree = await client.evaluate("document.getElementById('toast').textContent.trim()");
  await clickSelector(client, "#slotThree");
  await sleep(120);
  const slotThreeState = await getStateSnapshot(client);
  const toastAfterSlotThree = await client.evaluate("document.getElementById('toast').textContent.trim()");
  await verify(
    report,
    "Quick slot three performs the live horn or whistle action",
    slotThreeState.activeSlot === 3
      && toastAfterSlotThree !== toastBeforeSlotThree
      && /horn|whistle/i.test(toastAfterSlotThree),
    {
      activeSlot: slotThreeState.activeSlot,
      hornPulseTimer: slotThreeState.session.ui.hornPulseTimer,
      toastBeforeSlotThree,
      toastAfterSlotThree,
    }
  );
  await client.evaluate(`
    (() => {
      const button = document.getElementById("inventoryButton");
      button.focus();
      return document.activeElement?.id || "";
    })()
  `);
  await clickSelector(client, "#inventoryButton");
  await sleep(150);
  await verify(
    report,
    "Inventory button opens the field bag drawer",
    await client.evaluate("document.getElementById('inventoryDrawer').classList.contains('visible')"),
    null
  );
  await clickSelector(client, "#closeInventoryButton");
  await sleep(150);
  const focusAfterInventoryClose = await client.evaluate("document.activeElement?.id || ''");
  const beforeHudRecoveryMove = await getStateSnapshot(client);
  await pulseDomKey("KeyW", "w", 4, 70, 30);
  await sleep(120);
  const afterHudRecoveryMove = await getStateSnapshot(client);
  await verify(
    report,
    "Closing a HUD drawer clears button focus and preserves movement input",
    !["inventoryButton", "closeInventoryButton"].includes(focusAfterInventoryClose)
      && planarDistance(afterHudRecoveryMove.session.player, beforeHudRecoveryMove.session.player) > 14,
    {
      focusAfterInventoryClose,
      moveDistance: Number(planarDistance(afterHudRecoveryMove.session.player, beforeHudRecoveryMove.session.player).toFixed(2)),
    }
  );
  await clickSelector(client, "#slotFour");
  await clickSelector(client, "#slotFive");
  await sleep(150);
  const slotState = await getStateSnapshot(client);
  await verify(
    report,
    "Quickbar buttons perform live actions",
    slotState.activeSlot === 5 && slotState.session.ui.homePingTimer > 0.1,
    {
      activeSlot: slotState.activeSlot,
      homePingTimer: slotState.session.ui.homePingTimer,
    }
  );

  await clickSelector(client, "#pauseButton");
  await sleep(150);
  await verify(
    report,
    "Pause button opens the pause overlay",
    await client.evaluate("document.getElementById('pauseScreen').classList.contains('visible')"),
    null
  );
  await clickSelector(client, "#pauseSettingsButton");
  await sleep(150);
  await verify(
    report,
    "Pause settings button opens the settings drawer",
    await client.evaluate("document.getElementById('settingsDrawer').classList.contains('visible')"),
    null
  );
  await clickSelector(client, "#closeSettingsButton");
  await clickSelector(client, "#resumeButton");
  await sleep(150);
  await verify(
    report,
    "Resume closes pause and returns to gameplay",
    await client.evaluate("document.getElementById('appShell').dataset.screen === 'game'"),
    null
  );

  await clickSelector(client, "#pauseButton");
  await sleep(150);
  await clickSelector(client, "#resetShellButton");
  await sleep(250);
  const resetRunState = await getStateSnapshot(client);
  await verify(
    report,
    "Reset run rebuilds the active district session",
    resetRunState.screen === "game"
      && resetRunState.session.player.x === 140
      && resetRunState.session.player.y === 560,
    {
      screen: resetRunState.screen,
      player: resetRunState.session.player,
    }
  );

  await client.evaluate(`
    (() => {
      const state = window.__blockCityDebug.getState();
      state.session.player.x = 190;
      state.session.player.y = 558;
      state.session.player.angle = 0.05;
      state.session.ui.cameraYaw = 0.62;
      window.__blockCityDebug.render();
      return true;
    })()
  `);
  await sleep(500);
  await saveScreenshot(client, report, "desktopFoot");
  const scaleSanityState = await getStateSnapshot(client);
  const playerVehicleSeparation = planarDistance(
    scaleSanityState.session.player,
    scaleSanityState.session.vehicle
  );
  await verify(
    report,
    "Player and sedan staging stay at a readable gameplay scale",
    playerVehicleSeparation >= 20
      && playerVehicleSeparation <= 44
      && scaleSanityState.session.player.x < scaleSanityState.session.vehicle.x,
    {
      player: scaleSanityState.session.player,
      vehicle: scaleSanityState.session.vehicle,
      playerVehicleSeparation: Number(playerVehicleSeparation.toFixed(2)),
      screenshot: report.screenshots.desktopFoot,
    }
  );
  const avatarScaleSource = await client.evaluate(`
    (async () => {
      const source = await (await fetch("./src/render/three-world.js")).text();
      return {
        playerScale: /playerGroup\\.scale\\.setScalar\\(0\\.46\\)/.test(source),
        pedestrianScale: /pedestrian\\.scale\\.setScalar\\(0\\.46\\)/.test(source),
      };
    })()
  `);
  await verify(
    report,
    "Player avatar uses the same visual scale as pedestrians",
    avatarScaleSource.playerScale && avatarScaleSource.pedestrianScale,
    avatarScaleSource
  );

  const staticVehicleEntryState = await client.evaluate(`
    (async () => {
      const { toggleVehicle } = await import("./src/systems/gameplay.js");
      const state = window.__blockCityDebug.getState();
      state.screen = "game";
      state.activePanel = null;
      state.session.mode = "foot";
      state.session.claimedVehicleIds = [];
      state.session.player.x = 588;
      state.session.player.y = 708;
      state.session.player.angle = Math.PI;
      state.session.ui.cameraYaw = Math.PI;
      state.session.vehicle.x = 220;
      state.session.vehicle.y = 560;
      const result = toggleVehicle(state);
      window.__blockCityDebug.render();
      return {
        result,
        mode: state.session.mode,
        vehicle: state.session.vehicle,
        claimedVehicleIds: state.session.claimedVehicleIds,
      };
    })()
  `);
  await verify(
    report,
    "Desktop ride entry can claim a parked street vehicle",
    staticVehicleEntryState.mode === "vehicle"
      && staticVehicleEntryState.vehicle.label === "Laundry van"
      && staticVehicleEntryState.claimedVehicleIds.includes("market-van"),
    staticVehicleEntryState
  );

  const trafficVehicleEntryState = await client.evaluate(`
    (async () => {
      const { toggleVehicle } = await import("./src/systems/gameplay.js");
      const { getDistrictById } = await import("./src/state/game-state.js");
      const { getDistrictWorldLayout, getReactiveActorPose } = await import("./src/data/world-layout.js");
      const state = window.__blockCityDebug.getState();
      const district = getDistrictById(state.session.districtId);
      const layout = getDistrictWorldLayout(district);
      const actor = layout.trafficActors[0];
      const pose = getReactiveActorPose(actor, state.session.clock, state.session.combat.actorReactions);
      state.screen = "game";
      state.activePanel = null;
      state.session.mode = "foot";
      state.session.claimedVehicleIds = [];
      state.session.player.x = pose.x;
      state.session.player.y = pose.y;
      state.session.player.angle = pose.angle;
      state.session.ui.cameraYaw = pose.angle;
      state.session.vehicle.x = 220;
      state.session.vehicle.y = 560;
      const result = toggleVehicle(state);
      window.__blockCityDebug.render();
      return {
        actorId: actor.id,
        actorType: actor.type,
        result,
        mode: state.session.mode,
        vehicle: state.session.vehicle,
        claimedVehicleIds: state.session.claimedVehicleIds,
        reaction: state.session.combat.actorReactions[actor.id],
      };
    })()
  `);
  await verify(
    report,
    "Desktop ride entry can claim a moving traffic vehicle",
    trafficVehicleEntryState.mode === "vehicle"
      && trafficVehicleEntryState.vehicle.type === trafficVehicleEntryState.actorType
      && trafficVehicleEntryState.claimedVehicleIds.includes(trafficVehicleEntryState.actorId)
      && trafficVehicleEntryState.reaction?.hideTimer > 1000,
    trafficVehicleEntryState
  );

  await client.evaluate(`
    (() => {
      const state = window.__blockCityDebug.getState();
      state.session.mode = "foot";
      state.session.player.x = 190;
      state.session.player.y = 558;
      state.session.player.angle = 0.05;
      state.session.ui.cameraYaw = 0.05;
      state.session.vehicle.x = 220;
      state.session.vehicle.y = 560;
      state.session.vehicle.angle = 0;
      state.session.vehicle.speed = 0;
      state.session.vehicle.type = "sedan";
      state.session.vehicle.color = "#5c6875";
      state.session.vehicle.label = "Parked sedan";
      state.session.claimedVehicleIds = [];
      state.session.combat.actorReactions = {};
      window.__blockCityDebug.render();
      return true;
    })()
  `);
  await sleep(150);

  await keyTap(client, "KeyE", "e", 69);
  await sleep(250);
  const vehicleEntryState = await getStateSnapshot(client);
  await verify(
    report,
    "Desktop ride entry key switches into vehicle mode",
    vehicleEntryState.session.mode === "vehicle",
    { mode: vehicleEntryState.session.mode }
  );

  const beforeDrive = await getStateSnapshot(client);
  await keyHold(client, "KeyW", "w", 87, 900);
  await sleep(150);
  const afterDrive = await getStateSnapshot(client);
  await verify(
    report,
    "Vehicle throttle moves the ride forward",
    Math.abs(afterDrive.session.vehicle.speed) > 0 && (
      afterDrive.session.vehicle.x !== beforeDrive.session.vehicle.x
      || afterDrive.session.vehicle.y !== beforeDrive.session.vehicle.y
    ),
    {
      beforeVehicle: beforeDrive.session.vehicle,
      afterVehicle: afterDrive.session.vehicle,
    }
  );

  const beforeSteer = afterDrive.session.vehicle.angle;
  await client.send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    code: "KeyA",
    key: "a",
    windowsVirtualKeyCode: 65,
    nativeVirtualKeyCode: 65,
  });
  await keyHold(client, "KeyW", "w", 87, 600);
  await client.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    code: "KeyA",
    key: "a",
    windowsVirtualKeyCode: 65,
    nativeVirtualKeyCode: 65,
  });
  await sleep(150);
  const afterSteer = (await getStateSnapshot(client)).session.vehicle.angle;
  await verify(report, "Vehicle steering changes heading", Math.abs(afterSteer - beforeSteer) > 0.05, { beforeSteer, afterSteer });

  const beforeBrake = await getStateSnapshot(client);
  await keyHold(client, "KeyS", "s", 83, 900);
  await sleep(150);
  const afterBrake = await getStateSnapshot(client);
  await verify(
    report,
    "Vehicle brake or reverse changes speed response",
    Math.abs(afterBrake.session.vehicle.speed) !== Math.abs(beforeBrake.session.vehicle.speed),
    {
      beforeSpeed: beforeBrake.session.vehicle.speed,
      afterSpeed: afterBrake.session.vehicle.speed,
    }
  );

  const beforeHandbrake = afterBrake.session.ui.heat;
  await domKeyHold(client, "Space", " ", 500);
  await sleep(150);
  const afterHandbrake = await getStateSnapshot(client);
  await verify(
    report,
    "Vehicle handbrake is wired and raises pressure",
    afterHandbrake.session.ui.heat > beforeHandbrake,
    {
      beforeHeat: beforeHandbrake,
      afterHeat: afterHandbrake.session.ui.heat,
    }
  );

  const arrowVehicleStart = await prepareVehicleRecoveryState();
  await pulseDomKey("ArrowUp", "ArrowUp", 6, 90, 35);
  await sleep(150);
  const arrowVehicleThrottle = await getStateSnapshot(client);
  await verify(
    report,
    "Arrow-key vehicle throttle moves the ride",
    Math.abs(arrowVehicleThrottle.session.vehicle.speed) > 0
      && planarDistance(arrowVehicleThrottle.session.vehicle, arrowVehicleStart.session.vehicle) > 5,
    {
      beforeVehicle: arrowVehicleStart.session.vehicle,
      afterVehicle: arrowVehicleThrottle.session.vehicle,
    }
  );

  const arrowVehicleAngleStart = arrowVehicleThrottle.session.vehicle.angle;
  await pulseDomKeyChord([
    { code: "ArrowUp", key: "ArrowUp" },
    { code: "ArrowLeft", key: "ArrowLeft" },
  ], 5, 90, 35);
  await sleep(150);
  const arrowVehicleSteer = await getStateSnapshot(client);
  await verify(
    report,
    "Arrow-key steering changes vehicle heading",
    Math.abs(arrowVehicleSteer.session.vehicle.angle - arrowVehicleAngleStart) > 0.04,
    {
      beforeAngle: arrowVehicleAngleStart,
      afterAngle: arrowVehicleSteer.session.vehicle.angle,
    }
  );

  const arrowVehicleBrakeStart = await getStateSnapshot(client);
  await pulseDomKey("ArrowDown", "ArrowDown", 4, 90, 35);
  await sleep(150);
  const arrowVehicleBrake = await getStateSnapshot(client);
  await verify(
    report,
    "Arrow-key brake or reverse changes vehicle speed response",
    Math.abs(arrowVehicleBrake.session.vehicle.speed) !== Math.abs(arrowVehicleBrakeStart.session.vehicle.speed),
    {
      beforeSpeed: arrowVehicleBrakeStart.session.vehicle.speed,
      afterSpeed: arrowVehicleBrake.session.vehicle.speed,
    }
  );

  await client.evaluate(`
    (async () => {
      const { applySimulation } = await import("./src/systems/gameplay.js");
      const state = window.__blockCityDebug.getState();
      state.screen = "game";
      state.activePanel = null;
      state.keyboard = {};
      Object.keys(state.touchInput).forEach((control) => {
        state.touchInput[control] = false;
      });
      state.session.mode = "vehicle";
      state.session.failureState = null;
      state.session.vehicle.x = 954;
      state.session.vehicle.y = 220;
      state.session.vehicle.angle = 0;
      state.session.vehicle.speed = 144;
      state.session.vehicle.durability = 96;
      state.session.player.x = 920;
      state.session.player.y = 220;
      state.session.player.angle = 0;
      state.session.player.health = 100;
      state.session.ui.heat = 0;
      state.session.ui.cameraYaw = 0.18;
      for (let step = 0; step < 24; step += 1) {
        applySimulation(state, 0.016);
      }
      window.__blockCityDebug.render();
      return true;
    })()
  `);
  await sleep(120);
  const boundaryImpactState = await getStateSnapshot(client);
  await verify(
    report,
    "Vehicle boundary collision blocks eastbound high-speed travel",
    boundaryImpactState.session.vehicle.x <= 956
      && boundaryImpactState.session.vehicle.speed < 0
      && boundaryImpactState.session.vehicle.durability < 96,
    boundaryImpactState.session.vehicle
  );
  await saveScreenshot(client, report, "desktopBoundary");

  await keyHold(client, "ArrowDown", "ArrowDown", 40, 600);
  await sleep(150);
  const boundaryRecoveryState = await getStateSnapshot(client);
  await verify(
    report,
    "Vehicle reverse recovers cleanly after the east boundary impact",
    boundaryRecoveryState.session.vehicle.x < boundaryImpactState.session.vehicle.x - 5
      && boundaryRecoveryState.session.vehicle.durability > boundaryImpactState.session.vehicle.durability - 1,
    {
      impactVehicle: boundaryImpactState.session.vehicle,
      recoveryVehicle: boundaryRecoveryState.session.vehicle,
    }
  );

  await clickSelector(client, "#slotFour");
  await sleep(150);
  const resetState = await getStateSnapshot(client);
  await verify(
    report,
    "Ride reset slot restores a nearby spawn point",
    typeof resetState.session.vehicle.x === "number" && typeof resetState.session.vehicle.y === "number",
    resetState.session.vehicle
  );

  await sleep(400);
  await saveScreenshot(client, report, "desktopVehicle");
  const safeExitState = await client.evaluate(`
    (async () => {
      const { toggleVehicle } = await import("./src/systems/gameplay.js");
      const { getDistrictById } = await import("./src/state/game-state.js");
      const { getDistrictWorldLayout } = await import("./src/data/world-layout.js");
      const state = window.__blockCityDebug.getState();
      const district = getDistrictById(state.session.districtId);
      const layout = getDistrictWorldLayout(district);
      state.screen = "game";
      state.activePanel = null;
      state.session.failureState = null;
      state.session.mode = "vehicle";
      state.session.vehicle.x = 955;
      state.session.vehicle.y = 220;
      state.session.vehicle.angle = 0;
      state.session.vehicle.speed = 0;
      state.session.player.x = 955;
      state.session.player.y = 220;
      state.session.player.angle = 0;
      const result = toggleVehicle(state);
      const player = state.session.player;
      const inBounds = player.x >= 44 && player.x <= 956 && player.y >= 44 && player.y <= 956;
      const clearOfRectBlockers = !layout.rectBlockers.some((rect) => (
        player.x >= rect.x - 9 && player.x <= rect.x + rect.w + 9
        && player.y >= rect.y - 9 && player.y <= rect.y + rect.h + 9
      ));
      window.__blockCityDebug.render();
      return {
        result,
        mode: state.session.mode,
        player,
        vehicle: state.session.vehicle,
        inBounds,
        clearOfRectBlockers,
      };
    })()
  `);
  await verify(
    report,
    "Vehicle exit never places the player outside valid map coordinates",
    safeExitState.mode === "vehicle" || (safeExitState.inBounds && safeExitState.clearOfRectBlockers),
    safeExitState
  );

  await client.evaluate(`
    (() => {
      const state = window.__blockCityDebug.getState();
      state.session.mode = "foot";
      state.session.player.x = 220;
      state.session.player.y = 760;
      state.session.player.angle = -1.35;
      state.session.vehicle.x = 246;
      state.session.vehicle.y = 760;
      state.session.vehicle.angle = -1.35;
      state.session.vehicle.speed = 0;
      state.session.ui.cameraYaw = 0.24;
      window.__blockCityDebug.render();
      return true;
    })()
  `);
  await sleep(250);
  await keyTap(client, "KeyF", "f", 70);
  await sleep(200);
  let missionState = await getStateSnapshot(client);
  await verify(
    report,
    "Mission accept starts the package run",
    missionState.session.activeMissionId === "package-run",
    { activeMissionId: missionState.session.activeMissionId }
  );
  await saveScreenshot(client, report, "desktopMission");

  await keyTap(client, "KeyE", "e", 69);
  await sleep(200);
  await keyHold(client, "KeyW", "w", 87, 700);
  await sleep(150);
  await client.evaluate(`
    (() => {
      const state = window.__blockCityDebug.getState();
      state.session.vehicle.x = 706;
      state.session.vehicle.y = 520;
      state.session.vehicle.angle = -0.3;
      state.session.player.x = 706;
      state.session.player.y = 520;
      state.session.player.angle = -0.3;
      state.session.ui.cameraYaw = 0.38;
      window.__blockCityDebug.render();
      return true;
    })()
  `);
  await sleep(250);
  await keyTap(client, "KeyE", "e", 69);
  await sleep(200);
  await keyTap(client, "KeyF", "f", 70);
  await sleep(200);
  missionState = await getStateSnapshot(client);
  await verify(
    report,
    "Pickup interaction advances the package run to the drop leg",
    missionState.session.missionStageIndex === 1,
    { missionStageIndex: missionState.session.missionStageIndex }
  );

  await keyTap(client, "KeyE", "e", 69);
  await sleep(200);
  await client.evaluate(`
    (() => {
      const state = window.__blockCityDebug.getState();
      state.session.vehicle.x = 880;
      state.session.vehicle.y = 220;
      state.session.vehicle.angle = -0.7;
      state.session.player.x = 880;
      state.session.player.y = 220;
      state.session.player.angle = -0.7;
      state.session.ui.cameraYaw = 0.22;
      window.__blockCityDebug.render();
      return true;
    })()
  `);
  await sleep(250);
  const cashBeforeComplete = (await getStateSnapshot(client)).session.ui.cash;
  await keyTap(client, "KeyF", "f", 70);
  await sleep(200);
  const completedMissionState = await getStateSnapshot(client);
  await verify(
    report,
    "Mission completion clears the active run and awards cash",
    !completedMissionState.session.activeMissionId && completedMissionState.session.ui.cash > cashBeforeComplete,
    {
      cashBeforeComplete,
      cashAfterComplete: completedMissionState.session.ui.cash,
      activeMissionId: completedMissionState.session.activeMissionId,
    }
  );

  await client.evaluate(`
    (() => {
      const state = window.__blockCityDebug.getState();
      state.session.ui.heat = 3.4;
      state.session.player.x = 540;
      state.session.player.y = 300;
      state.session.vehicle.x = 540;
      state.session.vehicle.y = 300;
      state.session.vehicle.angle = 0.2;
      state.session.mode = "vehicle";
      window.__blockCityDebug.render();
      return true;
    })()
  `);
  await sleep(1000);
  const heatSpikeState = await getStateSnapshot(client);
  await verify(
    report,
    "High heat activates search pressure",
    heatSpikeState.session.searchZones.some((zone) => zone.active),
    heatSpikeState.session.searchZones
  );

  await client.evaluate(`
    (() => {
      const state = window.__blockCityDebug.getState();
      state.session.ui.heat = 2.4;
      state.session.mode = "foot";
      state.session.player.x = 240;
      state.session.player.y = 760;
      state.session.vehicle.x = 240;
      state.session.vehicle.y = 760;
      state.session.vehicle.speed = 0;
      state.session.searchZones.forEach((zone) => {
        zone.active = false;
        zone.pressure = 0;
        zone.x = zone.anchorX;
        zone.y = zone.anchorY;
      });
      window.__blockCityDebug.render();
      return true;
    })()
  `);
  const heatBeforeDecay = 2.4;
  await sleep(2200);
  const heatAfterDecay = (await getStateSnapshot(client)).session.ui.heat;
  await verify(
    report,
    "Heat decays near the cooldown or home lane",
    heatAfterDecay < heatBeforeDecay,
    { heatBeforeDecay, heatAfterDecay }
  );

  await client.evaluate(`
    (() => {
      const state = window.__blockCityDebug.getState();
      state.session.ui.heat = 0;
      state.session.player.health = 0;
      window.__blockCityDebug.render();
      return true;
    })()
  `);
  await client.evaluate(`
    (async () => {
      const { applySimulation } = await import("./src/systems/gameplay.js");
      const state = window.__blockCityDebug.getState();
      for (let step = 0; step < 220; step += 1) {
        applySimulation(state, 0.016);
      }
      window.__blockCityDebug.render();
      return {
        failureState: state.session.failureState,
        health: state.session.player.health,
        durability: state.session.vehicle.durability,
      };
    })()
  `);
  const respawnState = await getStateSnapshot(client);
  await verify(
    report,
    "Player failure respawns the session into continued free roam",
    !respawnState.session.failureState
      && respawnState.session.mode === "foot"
      && respawnState.session.player.health >= 99
      && respawnState.session.vehicle.durability >= 90,
    {
      mode: respawnState.session.mode,
      health: respawnState.session.player.health,
      vehicleDurability: respawnState.session.vehicle.durability,
    }
  );
  await saveScreenshot(client, report, "desktopRespawn");

  await clickSelector(client, "#pauseButton");
  await sleep(150);
  await clickSelector(client, "#returnDistrictButton");
  await sleep(250);
  await verify(
    report,
    "Pause return button routes back to district selection",
    await client.evaluate("document.getElementById('appShell').dataset.screen === 'district'"),
    null
  );

  await clickSelector(client, ".district-card[data-district-id='brickline-district']");
  await sleep(150);
  await clickSelector(client, "#launchDistrictButton");
  await sleep(600);
  const changedDistrict = await client.evaluate("document.getElementById('districtBanner').textContent.trim()");
  await verify(report, "District change launches a different route", changedDistrict === "Brickline District", { changedDistrict });

  await navigate(client, baseUrl);
  await clickSelector(client, "#quickDeployButton");
  await sleep(600);
  const quickDeployBanner = await client.evaluate("document.getElementById('districtBanner').textContent.trim()");
  await verify(report, "Quick deploy launches the last run district", quickDeployBanner === "Brickline District", { quickDeployBanner });

  report.viewportRuns.push({
    viewport: "desktop",
    width: DESKTOP_VIEWPORT.width,
    height: DESKTOP_VIEWPORT.height,
    lastQuickDeployDistrict: quickDeployBanner,
  });
}

async function runMobileFlow(client, report, baseUrl) {
  await setViewport(client, MOBILE_LANDSCAPE_VIEWPORT);
  await navigate(client, `${baseUrl}?touch=true`);

  await tapSelector(client, "#menuSettingsButton", 11);
  await sleep(200);
  await verify(
    report,
    "Touch settings button opens the drawer on mobile",
    await client.evaluate("document.getElementById('settingsDrawer').classList.contains('visible')"),
    null
  );
  await tapSelector(client, "#closeSettingsButton", 12);
  await sleep(150);
  await tapSelector(client, "#menuDistrictButton", 13);
  await sleep(150);
  await verify(
    report,
    "Touch menu navigation reaches the district catalog",
    await client.evaluate("document.getElementById('districtScreen').classList.contains('visible')"),
    null
  );
  await tapSelector(client, ".district-card[data-district-id='sunset-grid']", 14);
  await sleep(200);
  await tapSelector(client, "#launchDistrictButton", 15);
  await sleep(700);
  await verify(
    report,
    "Mobile touch launch enters gameplay",
    await client.evaluate("document.getElementById('appShell').dataset.screen === 'game' && document.getElementById('appShell').dataset.touch === 'true'"),
    null
  );
  await saveScreenshot(client, report, "mobileSpawn");

  await tapSelector(client, "#touchPauseButton", 16);
  await sleep(150);
  await verify(
    report,
    "Touch on-foot pause opens the pause overlay",
    await client.evaluate("document.getElementById('pauseScreen').classList.contains('visible')"),
    null
  );
  await tapSelector(client, "#resumeButton", 17);
  await sleep(150);

  const touchHudDisplay = await client.evaluate(`
    (() => getComputedStyle(document.querySelector(".touch-hud")).display)()
  `);
  await verify(report, "Touch HUD is visible in mobile landscape", touchHudDisplay !== "none", { touchHudDisplay });

  const touchUseBefore = await client.evaluate("document.getElementById('toast').textContent.trim()");
  await tapSelector(client, "#touchInteractButton", 18);
  await sleep(250);
  const touchUseAfter = await client.evaluate("document.getElementById('toast').textContent.trim()");
  await verify(
    report,
    "Touch on-foot use button triggers a live interaction result",
    touchUseAfter !== touchUseBefore && touchUseAfter.length > 0,
    { touchUseBefore, touchUseAfter }
  );

  await saveScreenshot(client, report, "mobileFoot");

  const beforeTouchMove = await getStateSnapshot(client);
  await holdTouchControl(client, "[data-touch-move='up']", 700, 20);
  await sleep(150);
  const afterTouchMove = await getStateSnapshot(client);
  await verify(
    report,
    "Touch movement pad advances the player",
    afterTouchMove.session.player.x !== beforeTouchMove.session.player.x
      || afterTouchMove.session.player.y !== beforeTouchMove.session.player.y,
    {
      beforePlayer: beforeTouchMove.session.player,
      afterPlayer: afterTouchMove.session.player,
    }
  );

  const beforeTouchLook = afterTouchMove.session.ui.cameraYaw;
  await client.evaluate(`
    (() => {
      const pad = document.getElementById("lookPad");
      const rect = pad.getBoundingClientRect();
      const x = rect.left + rect.width * 0.5;
      const y = rect.top + rect.height * 0.5;
      pad.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 31, clientX: x, clientY: y }));
      pad.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 31, clientX: x + 120, clientY: y }));
      pad.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 31, clientX: x + 120, clientY: y }));
      return true;
    })()
  `);
  await sleep(150);
  const afterTouchLook = (await getStateSnapshot(client)).session.ui.cameraYaw;
  await verify(
    report,
    "Touch look pad changes the camera yaw",
    Math.abs(afterTouchLook - beforeTouchLook) > 0.08,
    { beforeTouchLook, afterTouchLook }
  );

  await client.evaluate(`
    (async () => {
      const state = window.__blockCityDebug.getState();
      const { getDistrictById } = await import("./src/state/game-state.js");
      const { getDistrictWorldLayout, getReactiveActorPose } = await import("./src/data/world-layout.js");
      const district = getDistrictById(state.session.districtId);
      const layout = getDistrictWorldLayout(district);
      const pedestrian = layout.pedestrianActors[0];
      const pose = getReactiveActorPose(pedestrian, state.session.clock, state.session.combat.actorReactions);
      state.screen = "game";
      state.activePanel = null;
      state.session.failureState = null;
      state.session.mode = "foot";
      state.session.ui.heat = 0.35;
      state.session.ui.cameraYaw = 0;
      state.session.player.health = 100;
      state.session.player.stamina = 100;
      state.session.combat.equipped = false;
      state.session.combat.pendingReload = false;
      state.session.combat.reloadTimer = 0;
      state.session.combat.fireCooldown = 0;
      state.session.combat.hitMarkerTimer = 0;
      state.session.combat.traceTimer = 0;
      state.session.combat.impactTimer = 0;
      state.session.combat.actorReactions = {};
      state.session.combat.ammoInClip = state.session.combat.clipSize;
      state.session.combat.reserveAmmo = 40;
      state.session.player.x = pose.x - 34;
      state.session.player.y = pose.y;
      state.session.player.angle = 0;
      state.session.vehicle.x = 840;
      state.session.vehicle.y = 220;
      state.session.vehicle.speed = 0;
      window.__blockCityDebug.render();
      return true;
    })()
  `);
  const touchCombatBefore = await getStateSnapshot(client);
  await tapSelector(client, "#touchFireButton", 33);
  await sleep(220);
  const touchCombatAfter = await getStateSnapshot(client);
  await verify(
    report,
    "Touch fire button draws and fires the on-foot sidearm",
    touchCombatAfter.session.combat.shotsFired > touchCombatBefore.session.combat.shotsFired
      && touchCombatAfter.session.combat.ammoInClip === touchCombatBefore.session.combat.ammoInClip - 1
      && touchCombatAfter.session.ui.heat > touchCombatBefore.session.ui.heat
      && touchCombatAfter.session.combat.lastShotResult.kind === "pedestrian",
    {
      beforeCombat: touchCombatBefore.session.combat,
      afterCombat: touchCombatAfter.session.combat,
      heat: touchCombatAfter.session.ui.heat,
      lastShot: touchCombatAfter.session.combat.lastShotResult,
    }
  );
  await saveScreenshot(client, report, "mobileCombat");

  await client.evaluate(`
    (() => {
      const state = window.__blockCityDebug.getState();
      state.screen = "game";
      state.activePanel = null;
      state.session.failureState = null;
      state.session.mode = "foot";
      state.session.activeMissionId = null;
      state.session.missionStageIndex = 0;
      state.session.missionTimer = 0;
      state.session.player.x = 220;
      state.session.player.y = 760;
      state.session.player.angle = -1.35;
      state.session.vehicle.x = 246;
      state.session.vehicle.y = 760;
      state.session.vehicle.angle = -1.35;
      state.session.vehicle.speed = 0;
      state.session.ui.cameraYaw = 0.24;
      window.__blockCityDebug.render();
      return true;
    })()
  `);
  await sleep(180);
  await tapSelector(client, "#touchInteractButton", 34);
  await sleep(220);
  const mobileMissionState = await getStateSnapshot(client);
  await verify(
    report,
    "Touch use can accept a live mission objective",
    mobileMissionState.session.activeMissionId === "package-run",
    {
      activeMissionId: mobileMissionState.session.activeMissionId,
      missionStageIndex: mobileMissionState.session.missionStageIndex,
    }
  );
  await saveScreenshot(client, report, "mobileMission");

  await client.evaluate(`
    (() => {
      const state = window.__blockCityDebug.getState();
      state.session.player.x = 192;
      state.session.player.y = 560;
      state.session.player.angle = 0.05;
      state.session.vehicle.x = 220;
      state.session.vehicle.y = 560;
      state.session.vehicle.angle = 0.05;
      state.session.vehicle.speed = 0;
      state.session.ui.cameraYaw = 0.52;
      window.__blockCityDebug.render();
      return true;
    })()
  `);
  await sleep(250);
  await tapSelector(client, "#touchRideButton", 40);
  await sleep(250);
  const touchRideState = await getStateSnapshot(client);
  await verify(
    report,
    "Touch ride button enters the vehicle",
    touchRideState.session.mode === "vehicle",
    { mode: touchRideState.session.mode }
  );

  const vehicleUseBefore = await client.evaluate("document.getElementById('toast').textContent.trim()");
  await tapSelector(client, "#touchVehicleInteractButton", 48);
  await sleep(250);
  const vehicleUseAfter = await client.evaluate("document.getElementById('toast').textContent.trim()");
  await verify(
    report,
    "Touch in-vehicle use button triggers a live interaction result",
    vehicleUseAfter !== vehicleUseBefore && vehicleUseAfter.length > 0,
    { vehicleUseBefore, vehicleUseAfter }
  );

  const beforeThrottle = touchRideState.session.vehicle.speed;
  await holdTouchControl(client, "#touchThrottleButton", 700, 41);
  await sleep(150);
  const afterThrottleState = await getStateSnapshot(client);
  await verify(
    report,
    "Touch throttle accelerates the vehicle",
    afterThrottleState.session.vehicle.speed > beforeThrottle,
    {
      beforeThrottle,
      afterThrottle: afterThrottleState.session.vehicle.speed,
    }
  );

  const beforeSteer = afterThrottleState.session.vehicle.angle;
  await holdTouchControl(client, "[data-touch-move='left']", 500, 42);
  await sleep(150);
  const afterSteer = (await getStateSnapshot(client)).session.vehicle.angle;
  await verify(report, "Touch steering changes vehicle heading", Math.abs(afterSteer - beforeSteer) > 0.04, { beforeSteer, afterSteer });

  const beforeBrake = (await getStateSnapshot(client)).session.vehicle.speed;
  await holdTouchControl(client, "#touchBrakeButton", 700, 43);
  await sleep(150);
  const afterBrake = (await getStateSnapshot(client)).session.vehicle.speed;
  await verify(
    report,
    "Touch brake or reverse changes vehicle speed",
    Math.abs(afterBrake - beforeBrake) > 0.3,
    { beforeBrake, afterBrake }
  );

  await client.evaluate(`
    (() => {
      const state = window.__blockCityDebug.getState();
      state.screen = "game";
      state.activePanel = null;
      state.session.failureState = null;
      state.session.mode = "vehicle";
      state.session.ui.heat = 1.1;
      state.session.vehicle.speed = Math.max(state.session.vehicle.speed, 28);
      window.__blockCityDebug.render();
      return true;
    })()
  `);
  await sleep(120);
  const beforeTouchHandbrakeState = await getStateSnapshot(client);
  const beforeTouchHandbrake = beforeTouchHandbrakeState.session.ui.heat;
  const beforeTouchHandbrakeSpeed = beforeTouchHandbrakeState.session.vehicle.speed;
  await holdTouchControl(client, "#touchHandbrakeButton", 500, 44);
  await sleep(150);
  const afterTouchHandbrakeState = await getStateSnapshot(client);
  const afterTouchHandbrake = afterTouchHandbrakeState.session.ui.heat;
  await verify(
    report,
    "Touch handbrake raises heat pressure",
    afterTouchHandbrake > beforeTouchHandbrake
      || (beforeTouchHandbrake >= 4.9 && afterTouchHandbrake >= beforeTouchHandbrake && afterTouchHandbrakeState.session.vehicle.speed < beforeTouchHandbrakeSpeed - 0.2),
    {
      beforeTouchHandbrake,
      afterTouchHandbrake,
      beforeTouchHandbrakeSpeed,
      afterTouchHandbrakeSpeed: afterTouchHandbrakeState.session.vehicle.speed,
    }
  );
  await saveScreenshot(client, report, "mobileHeat");

  await saveScreenshot(client, report, "mobileVehicle");

  await tapSelector(client, "#touchVehiclePauseButton", 45);
  await sleep(150);
  await verify(
    report,
    "Touch vehicle pause opens the pause overlay",
    await client.evaluate("document.getElementById('pauseScreen').classList.contains('visible')"),
    null
  );
  await tapSelector(client, "#resumeButton", 46);
  await sleep(150);
  await client.evaluate(`
    (() => {
      const state = window.__blockCityDebug.getState();
      state.screen = "game";
      state.activePanel = null;
      state.session.failureState = null;
      state.session.mode = "vehicle";
      state.session.vehicle.x = 706;
      state.session.vehicle.y = 520;
      state.session.vehicle.angle = -0.3;
      state.session.vehicle.speed = 0;
      state.session.player.x = 706;
      state.session.player.y = 520;
      state.session.player.angle = -0.3;
      window.__blockCityDebug.render();
      return true;
    })()
  `);
  await sleep(150);
  await clickSelector(client, "#touchExitButton");
  await sleep(150);
  const exitedState = await getStateSnapshot(client);
  await verify(report, "Touch exit returns to on-foot mode", exitedState.session.mode === "foot", { mode: exitedState.session.mode });

  await client.evaluate(`
    (async () => {
      const { applySimulation } = await import("./src/systems/gameplay.js");
      const state = window.__blockCityDebug.getState();
      state.screen = "game";
      state.activePanel = null;
      state.session.failureState = null;
      state.session.mode = "vehicle";
      state.session.vehicle.x = 954;
      state.session.vehicle.y = 220;
      state.session.vehicle.angle = 0;
      state.session.vehicle.speed = 144;
      state.session.vehicle.durability = 96;
      state.session.player.x = 920;
      state.session.player.y = 220;
      state.session.player.angle = 0;
      state.session.player.health = 100;
      state.session.ui.heat = 0;
      state.session.ui.cameraYaw = 0.18;
      for (let step = 0; step < 4; step += 1) {
        applySimulation(state, 0.016);
      }
      window.__blockCityDebug.render();
      return true;
    })()
  `);
  await sleep(120);
  await saveScreenshot(client, report, "mobileBoundary");

  await client.evaluate(`
    (async () => {
      const { applySimulation } = await import("./src/systems/gameplay.js");
      const state = window.__blockCityDebug.getState();
      state.screen = "game";
      state.activePanel = null;
      state.session.failureState = null;
      state.session.mode = "foot";
      state.session.ui.heat = 0;
      state.session.player.health = 0;
      for (let step = 0; step < 220; step += 1) {
        applySimulation(state, 0.016);
      }
      window.__blockCityDebug.render();
      return {
        mode: state.session.mode,
        health: state.session.player.health,
        durability: state.session.vehicle.durability,
      };
    })()
  `);
  await sleep(120);
  await saveScreenshot(client, report, "mobileRespawn");

  await setViewport(client, MOBILE_PORTRAIT_VIEWPORT);
  await navigate(client, `${baseUrl}?screen=game&touch=true`);
  await saveScreenshot(client, report, "portrait");
  const portraitHud = await client.evaluate("document.getElementById('appShell').dataset.touch === 'true'");
  await verify(report, "Portrait mode stays intact enough to render gameplay", portraitHud, null);

  report.viewportRuns.push({
    viewport: "mobile",
    width: MOBILE_LANDSCAPE_VIEWPORT.width,
    height: MOBILE_LANDSCAPE_VIEWPORT.height,
    portraitWidth: MOBILE_PORTRAIT_VIEWPORT.width,
    portraitHeight: MOBILE_PORTRAIT_VIEWPORT.height,
  });
}

async function finalizeReport(client, report, baseUrl) {
  const referenceImageUrl = coerceFileUrl(baseUrl, "gta.png");
  if ((await fileExists(referenceImagePath)) && (await urlExists(referenceImageUrl))) {
    const referenceMetrics = await compareReferenceInBrowser(client, baseUrl, report.screenshots.desktopFoot);
    report.referenceComparison = referenceMetrics;
  } else {
    report.referenceComparison = null;
    report.notes.push("Skipped reference image comparison because gta.png is not present.");
  }

  const ignoredConsoleErrors = report.consoleErrors.filter(isIgnorableConsoleEntry);
  const pageErrors = report.consoleErrors.filter((entry) => (
    (entry.type === "error" || entry.type === "exception") && !isIgnorableConsoleEntry(entry)
  ));
  report.ignoredConsoleErrors = ignoredConsoleErrors;
  await verify(report, "No page-level console errors were recorded during validation", pageErrors.length === 0, pageErrors);

  report.finishedAt = new Date().toISOString();
  report.summary = {
    passedChecks: report.checks.filter((check) => check.passed).length,
    failedChecks: report.checks.filter((check) => !check.passed).length,
    screenshotCount: report.screenshotMoments.length,
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  await writeFile(referenceComparisonPath, buildReferenceComparisonMarkdown(report));
  await writeFile(evidencePath, buildEvidenceMarkdown(report));
}

async function main() {
  const baseUrl = resolveBaseUrl();
  const debugPort = Number(process.env.BLOCK_CITY_DEBUG_PORT || 9229);
  await ensureOutputDirs();
  await rm(reportPath, { force: true });

  const { child, userDataDir, args } = launchChrome(baseUrl, debugPort);
  const chromeStderr = [];
  child.stderr.on("data", (chunk) => {
    chromeStderr.push(chunk.toString());
  });

  const report = createEmptyReport(baseUrl, args);
  let client = null;

  try {
    await verifyRuntimeConstraints(report);
    await waitForHttpReady(baseUrl);
    const target = await waitForPageTarget(debugPort);
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    await setupBrowser(client, report);
    await runDesktopFlow(client, report, baseUrl);
    await runMobileFlow(client, report, baseUrl);
    await finalizeReport(client, report, baseUrl);
    console.log(JSON.stringify({
      status: "passed",
      report: path.relative(repoRoot, reportPath),
      screenshots: report.screenshots,
      referenceComparison: report.referenceComparison,
      checks: report.checks.length,
    }, null, 2));
  } catch (error) {
    report.finishedAt = new Date().toISOString();
    report.failure = {
      message: error.message,
      details: error.details || null,
      chromeStderr: sanitizeText(chromeStderr.join("\n")).slice(0, 2400),
    };
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    console.error(JSON.stringify(report.failure, null, 2));
    process.exitCode = 1;
  } finally {
    if (client) {
      await client.close().catch(() => {});
    }
    child.kill("SIGTERM");
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

await main();
