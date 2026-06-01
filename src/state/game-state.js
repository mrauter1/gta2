import { DISTRICTS } from "../data/districts.js";
import { distance2D } from "../utils/math.js";

export const STORAGE_KEYS = ["block-city-shell-v2", "block-city-shell-v1"];

export const DEFAULT_SETTINGS = {
  volume: 65,
  mute: false,
  sensitivity: 0.85,
  invertLook: false,
  touchLayout: "split",
  graphicsQuality: "auto",
};

export const SIDEARM_PROFILE = Object.freeze({
  label: "CINDER-9",
  clipSize: 8,
  reserveAmmo: 40,
  range: 230,
  reloadSeconds: 0.9,
});

export function detectTouchMode() {
  return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
}

function normalizeTouchLayout(value) {
  return ["split", "southpaw"].includes(value) ? value : DEFAULT_SETTINGS.touchLayout;
}

function normalizeGraphicsQuality(value) {
  return ["auto", "high", "low"].includes(value) ? value : DEFAULT_SETTINGS.graphicsQuality;
}

function normalizeSettings(rawSettings) {
  return {
    volume: Number.isFinite(rawSettings?.volume) ? Math.max(0, Math.min(100, rawSettings.volume)) : DEFAULT_SETTINGS.volume,
    mute: Boolean(rawSettings?.mute),
    sensitivity: Number.isFinite(rawSettings?.sensitivity)
      ? Math.max(0.4, Math.min(1.6, rawSettings.sensitivity))
      : DEFAULT_SETTINGS.sensitivity,
    invertLook: Boolean(rawSettings?.invertLook),
    touchLayout: normalizeTouchLayout(rawSettings?.touchLayout),
    graphicsQuality: normalizeGraphicsQuality(rawSettings?.graphicsQuality),
  };
}

function readRawPersistedState() {
  for (const key of STORAGE_KEYS) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (error) {
      return {};
    }
  }
  return {};
}

export function loadPersistedState() {
  const persisted = readRawPersistedState();
  return {
    selectedDistrictId: DISTRICTS.some((district) => district.id === persisted.selectedDistrictId)
      ? persisted.selectedDistrictId
      : DISTRICTS[0].id,
    lastDistrictId: DISTRICTS.some((district) => district.id === persisted.lastDistrictId)
      ? persisted.lastDistrictId
      : DISTRICTS[0].id,
    settings: normalizeSettings(persisted.settings || {}),
  };
}

export function savePersistedState(state) {
  const payload = {
    selectedDistrictId: state.selectedDistrictId,
    lastDistrictId: state.lastDistrictId,
    settings: state.settings,
  };

  try {
    window.localStorage.setItem(STORAGE_KEYS[0], JSON.stringify(payload));
  } catch (error) {
    return false;
  }

  return true;
}

export function getQueryOverrides() {
  const params = new URLSearchParams(window.location.search);
  const districtId = DISTRICTS.some((district) => district.id === params.get("district")) ? params.get("district") : null;
  const screen = ["menu", "district", "game", "pause"].includes(params.get("screen")) ? params.get("screen") : null;
  const mode = ["foot", "vehicle"].includes(params.get("mode")) ? params.get("mode") : null;
  const panel = ["settings", "inventory"].includes(params.get("panel")) ? params.get("panel") : null;
  const forceTouch = ["1", "true", "yes"].includes((params.get("touch") || "").toLowerCase());

  return {
    districtId,
    screen,
    mode,
    panel,
    touchMode: forceTouch ? true : null,
  };
}

export function getDistrictById(id) {
  return DISTRICTS.find((district) => district.id === id) || DISTRICTS[0];
}

export function createMissionScripts(district) {
  const fallbackPoint = district.missionPoints[0] || district.homePoint;
  const pickupPoint = district.missionPoints.find((point) => point.kind === "pickup") || fallbackPoint;
  const dropoffPoint = district.missionPoints.find((point) => point.kind === "dropoff") || district.homePoint;
  const checkpointPoints = district.missionPoints.filter((point) => point.kind === "checkpoint");
  const cooldownPoint = district.missionPoints.find((point) => point.kind === "cooldown") || district.homePoint;
  const relayPickupPoint = checkpointPoints[1] || checkpointPoints[0] || pickupPoint;
  const checkpointAcceptPoint = checkpointPoints[0] || pickupPoint || fallbackPoint;

  return [
    {
      id: "package-run",
      title: "PARCEL RUN",
      icon: "PKG",
      reward: 350,
      acceptPointId: district.homePoint.id,
      acceptCopy: "Roll into the garage dispatch light and take a crate run across the district.",
      successToast: "Parcel run cleared",
      failureToast: "Parcel run dropped",
      stages: [
        {
          pointId: pickupPoint.id,
          detail: "Exit the ride and tag the courier crate by hand.",
          trigger: "interact",
          requiresMode: "foot",
          actionLabel: "Tag Crate",
        },
        {
          pointId: dropoffPoint.id || district.homePoint.id,
          detail: "Drive the parcel to the drop and release it clean.",
          trigger: "interact",
          actionLabel: "Drop Parcel",
        },
      ],
    },
    {
      id: "checkpoint-dash",
      title: "CHECKPOINT DASH",
      icon: "RUN",
      reward: 430,
      acceptPointId: checkpointAcceptPoint.id,
      acceptCopy: "Hit the start gate and stay in the ride. Miss the timer and the run is burned.",
      timerSeconds: 42,
      successToast: "Checkpoint dash cleared",
      failureToast: "Checkpoint dash timed out",
      stages: (checkpointPoints.length ? checkpointPoints : [fallbackPoint]).map((point) => ({
        pointId: point.id,
        detail: "Keep the car moving and slice through the next gate.",
        trigger: "proximity",
        requiresMode: "vehicle",
        actionLabel: "Clear Gate",
      })),
    },
    {
      id: "crew-lift",
      title: "CREW LIFT",
      icon: "LIFT",
      reward: 390,
      acceptPointId: cooldownPoint.id || district.homePoint.id,
      acceptCopy: "Take the service call, collect the rider, and drive the lift back to the garage lane.",
      successToast: "Crew lift cleared",
      failureToast: "Crew lift failed",
      stages: [
        {
          pointId: relayPickupPoint.id,
          detail: "Reach the pickup beacon and confirm the lift.",
          trigger: "interact",
          actionLabel: "Load Rider",
        },
        {
          pointId: district.homePoint.id,
          detail: "Drive the rider back to the garage lane.",
          trigger: "interact",
          requiresMode: "vehicle",
          actionLabel: "Drop Rider",
        },
      ],
    },
  ];
}

function createSearchZones(district) {
  const pickupPoint = district.missionPoints.find((point) => point.kind === "pickup") || district.spawnPoint;
  const checkpointPoint = district.missionPoints.find((point) => point.kind === "checkpoint") || district.homePoint;

  return [
    {
      id: "alpha",
      anchorX: district.homePoint.x,
      anchorY: district.homePoint.y,
      x: district.homePoint.x,
      y: district.homePoint.y,
      radius: 136,
      active: false,
      pressure: 0,
    },
    {
      id: "bravo",
      anchorX: pickupPoint.x,
      anchorY: checkpointPoint.y,
      x: pickupPoint.x,
      y: checkpointPoint.y,
      radius: 112,
      active: false,
      pressure: 0,
    },
  ];
}

export function getVehicleSpawnProfile(district, spawnIndex = 0) {
  const fallback = district.vehicleSpawnPoints[0];
  const spawn = district.vehicleSpawnPoints[spawnIndex] || fallback;
  return {
    spawnIndex: district.vehicleSpawnPoints.indexOf(spawn),
    x: spawn.x,
    y: spawn.y,
    angle: spawn.angle ?? 0,
    speed: 0,
    durability: 96,
    type: spawn.type || "sedan",
    color: spawn.color || "#5c6875",
    label: spawn.label,
  };
}

export function buildCombatState() {
  return {
    equipped: false,
    weaponLabel: SIDEARM_PROFILE.label,
    clipSize: SIDEARM_PROFILE.clipSize,
    ammoInClip: SIDEARM_PROFILE.clipSize,
    reserveAmmo: SIDEARM_PROFILE.reserveAmmo,
    maxRange: SIDEARM_PROFILE.range,
    reloadSeconds: SIDEARM_PROFILE.reloadSeconds,
    fireCooldown: 0,
    reloadTimer: 0,
    muzzleTimer: 0,
    traceTimer: 0,
    impactTimer: 0,
    hitMarkerTimer: 0,
    patrolAlertTimer: 0,
    civilianAlertTimer: 0,
    actorReactions: {},
    lastTrace: null,
    lastImpact: null,
    lastShotResult: {
      kind: "idle",
      targetId: null,
      blocked: false,
      hit: false,
      x: 0,
      y: 0,
    },
    shotsFired: 0,
    shotsHit: 0,
  };
}

export function buildSession(districtId) {
  const district = getDistrictById(districtId);
  const vehicle = getVehicleSpawnProfile(district, 0);
  return {
    districtId,
    player: {
      x: district.spawnPoint.x,
      y: district.spawnPoint.y,
      angle: 0.15,
      health: 100,
      stamina: 100,
    },
    vehicle,
    ui: {
      cash: 2450,
      heat: 1,
      alertedHeatLevel: 1,
      cameraYaw: 0.34,
      speedDisplay: 0,
      routePulseTimer: 1.8,
      homePingTimer: 0,
      hornPulseTimer: 0,
      missionFlashTimer: 0,
      missionFlashText: "",
      collisionCooldown: 0,
      collisionPulseTimer: 0,
      respawnPulseTimer: 0,
      searchAlertCooldown: 0,
    },
    mode: "foot",
    clock: 0,
    failureState: null,
    missionScripts: createMissionScripts(district),
    activeMissionId: null,
    missionStageIndex: 0,
    missionTimer: 0,
    searchZones: createSearchZones(district),
    combat: buildCombatState(),
  };
}

export function createAppState() {
  const persisted = loadPersistedState();
  const forced = getQueryOverrides();
  const selectedDistrictId = forced.districtId || persisted.selectedDistrictId;
  const lastDistrictId = DISTRICTS.some((district) => district.id === persisted.lastDistrictId)
    ? persisted.lastDistrictId
    : selectedDistrictId;

  return {
    forced,
    screen: forced.screen || "menu",
    activePanel: forced.panel || null,
    touchMode: forced.touchMode ?? detectTouchMode(),
    settings: persisted.settings,
    selectedDistrictId,
    lastDistrictId,
    bootInputGuardUntil: performance.now() + 450,
    activeSlot: 1,
    keyboard: {},
    touchInput: {
      up: false,
      down: false,
      left: false,
      right: false,
      throttle: false,
      brake: false,
      handbrake: false,
    },
    lookDrag: {
      active: false,
      source: null,
      pointerId: null,
      lastX: 0,
      startX: 0,
      maxDelta: 0,
    },
    session: buildSession(forced.districtId || lastDistrictId),
  };
}

export function getMissionScript(state) {
  if (state.session.activeMissionId) {
    return state.session.missionScripts.find((mission) => mission.id === state.session.activeMissionId) || state.session.missionScripts[0];
  }

  const currentPosition = getCurrentPosition(state);
  let selectedMission = state.session.missionScripts[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  state.session.missionScripts.forEach((mission) => {
    const point = getMissionPointById(state, mission.acceptPointId);
    const missionDistance = distance2D(currentPosition, point);
    if (missionDistance < bestDistance) {
      bestDistance = missionDistance;
      selectedMission = mission;
    }
  });

  return selectedMission;
}

export function getMissionStage(state) {
  const script = getMissionScript(state);
  if (state.session.activeMissionId) {
    return script.stages[state.session.missionStageIndex];
  }

  return {
    pointId: script.acceptPointId,
    detail: script.acceptCopy,
    trigger: "interact",
    actionLabel: "Accept Run",
  };
}

export function getMissionPointById(state, pointId) {
  const district = getDistrictById(state.session.districtId);
  if (district.homePoint.id === pointId) {
    return district.homePoint;
  }
  return district.missionPoints.find((point) => point.id === pointId) || district.homePoint;
}

export function getActiveObjectivePoint(state) {
  const stage = getMissionStage(state);
  return getMissionPointById(state, stage.pointId);
}

export function getNearbyMissionContact(state) {
  if (state.session.activeMissionId) {
    return null;
  }

  const currentPosition = getCurrentPosition(state);
  let selectedMission = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  state.session.missionScripts.forEach((mission) => {
    const missionDistance = distance2D(currentPosition, getMissionPointById(state, mission.acceptPointId));
    if (missionDistance < 58 && missionDistance < bestDistance) {
      selectedMission = mission;
      bestDistance = missionDistance;
    }
  });

  return selectedMission;
}

export function getMissionTimer(state) {
  return state.session.activeMissionId ? state.session.missionTimer : 0;
}

export function hasActiveMission(state) {
  return Boolean(state.session.activeMissionId);
}

export function getCurrentPosition(state) {
  return state.session.mode === "vehicle" ? state.session.vehicle : state.session.player;
}

export function isNearVehicle(state) {
  return distance2D(state.session.player, state.session.vehicle) < 54;
}

export function isNearObjective(state) {
  return distance2D(getCurrentPosition(state), getActiveObjectivePoint(state)) < 58;
}
