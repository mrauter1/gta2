import { DISTRICTS } from "../data/districts.js";
import {
  getActiveObjectivePoint,
  getCurrentPosition,
  getDistrictById,
  getNearestEnterableVehicle,
  getMissionScript,
  getMissionStage,
  getMissionTimer,
  getNearbyMissionContact,
  hasActiveMission,
  isNearObjective,
} from "../state/game-state.js";
import { distance2D } from "../utils/math.js";

function resizeCanvasToDisplaySize(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const targetWidth = Math.floor(canvas.clientWidth * ratio);
  const targetHeight = Math.floor(canvas.clientHeight * ratio);
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }
}

function worldToMinimap(point, canvasWidth, canvasHeight) {
  return {
    x: (point.x / 1000) * canvasWidth,
    y: (point.y / 1000) * canvasHeight,
  };
}

function formatMissionTimer(totalSeconds) {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function drawDistrictPreview(canvas, district) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  const sky = context.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, district.previewAccent);
  sky.addColorStop(1, district.districtTint);
  context.fillStyle = sky;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "rgba(255, 255, 255, 0.1)";
  context.fillRect(0, canvas.height * 0.54, canvas.width, canvas.height * 0.46);

  district.roads.forEach((road) => {
    context.fillStyle = "#474b53";
    context.fillRect(
      (road.x / 1000) * canvas.width,
      (road.y / 1000) * canvas.height,
      (road.w / 1000) * canvas.width,
      (road.h / 1000) * canvas.height
    );
  });

  context.fillStyle = "#f6d36f";
  context.beginPath();
  context.arc(canvas.width - 30, 28, 14, 0, Math.PI * 2);
  context.fill();

  const spawnX = (district.spawnPoint.x / 1000) * canvas.width;
  const spawnY = (district.spawnPoint.y / 1000) * canvas.height;
  context.fillStyle = "#71dff4";
  context.beginPath();
  context.moveTo(spawnX, spawnY - 12);
  context.lineTo(spawnX + 10, spawnY + 12);
  context.lineTo(spawnX - 10, spawnY + 12);
  context.closePath();
  context.fill();

  context.fillStyle = "#ffffff";
  district.vehicleSpawnPoints.slice(0, 2).forEach((vehicle) => {
    context.fillRect((vehicle.x / 1000) * canvas.width - 8, (vehicle.y / 1000) * canvas.height - 5, 16, 10);
  });

  context.fillStyle = "#1f3042";
  context.fillRect(18, 18, 82, 26);
  context.fillStyle = "#f8d567";
  context.font = "bold 18px Arial Black, Impact, sans-serif";
  context.fillText(district.seed, 28, 36);
}

function drawMinimap(canvas, state) {
  resizeCanvasToDisplaySize(canvas);
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const district = getDistrictById(state.session.districtId);
  const objective = getActiveObjectivePoint(state);
  const currentMap = worldToMinimap(getCurrentPosition(state), width, height);
  const objectiveMap = worldToMinimap(objective, width, height);
  const vehicleMap = worldToMinimap(state.session.vehicle, width, height);
  const homeMap = worldToMinimap(district.homePoint, width, height);
  const pulse = 0.5 + Math.sin(performance.now() * 0.006) * 0.5;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#34363b";
  context.fillRect(0, 0, width, height);

  context.save();
  context.globalAlpha = 0.82;
  district.roads.forEach((road) => {
    context.fillStyle = "#7f8389";
    context.fillRect(
      (road.x / 1000) * width,
      (road.y / 1000) * height,
      (road.w / 1000) * width,
      (road.h / 1000) * height
    );
  });
  context.restore();

  state.session.searchZones.forEach((zone, index) => {
    if (!zone.active) {
      return;
    }
    const zoneMap = worldToMinimap(zone, width, height);
    const zoneRadius = (zone.radius / 1000) * width;
    context.fillStyle = `rgba(241, 85, 100, ${0.06 + zone.pressure * 0.04})`;
    context.strokeStyle = `rgba(241, 85, 100, ${0.38 + pulse * 0.18})`;
    context.lineWidth = 2.5;
    context.beginPath();
    context.arc(zoneMap.x, zoneMap.y, zoneRadius, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    context.beginPath();
    context.arc(zoneMap.x, zoneMap.y, zoneRadius * (0.72 + ((pulse + index * 0.2) % 0.3)), 0, Math.PI * 2);
    context.stroke();
  });

  context.strokeStyle = "#efc03b";
  context.lineWidth = Math.max(2.5, width * 0.011 + state.session.ui.routePulseTimer * 2.6);
  context.beginPath();
  context.moveTo(currentMap.x, currentMap.y);
  context.lineTo(objectiveMap.x, currentMap.y);
  context.lineTo(objectiveMap.x, objectiveMap.y);
  context.stroke();

  context.fillStyle = "#6dda78";
  context.beginPath();
  context.moveTo(homeMap.x, homeMap.y - 12);
  context.lineTo(homeMap.x + 10, homeMap.y - 2);
  context.lineTo(homeMap.x + 10, homeMap.y + 10);
  context.lineTo(homeMap.x - 10, homeMap.y + 10);
  context.lineTo(homeMap.x - 10, homeMap.y - 2);
  context.closePath();
  context.fill();

  if (state.session.ui.homePingTimer > 0.05) {
    context.strokeStyle = `rgba(109, 218, 120, ${0.3 + pulse * 0.45})`;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(homeMap.x, homeMap.y, 16 + pulse * 10, 0, Math.PI * 2);
    context.stroke();
  }

  context.fillStyle = "#ffffff";
  context.fillRect(vehicleMap.x - 8, vehicleMap.y - 5, 16, 10);

  context.fillStyle = "#cc78ff";
  context.fillRect(objectiveMap.x - 8, objectiveMap.y - 8, 16, 16);

  context.fillStyle = "#7bf3ff";
  context.save();
  context.translate(currentMap.x, currentMap.y);
  context.rotate(state.session.player.angle + Math.PI / 2);
  context.beginPath();
  context.moveTo(0, -14);
  context.lineTo(10, 12);
  context.lineTo(0, 7);
  context.lineTo(-10, 12);
  context.closePath();
  context.fill();
  context.restore();
}

export function getElements() {
  const element = (id) => document.getElementById(id);
  return {
    appShell: element("appShell"),
    sceneCanvas: element("sceneCanvas"),
    minimapCanvas: element("minimapCanvas"),
    menuScreen: element("menuScreen"),
    districtScreen: element("districtScreen"),
    pauseScreen: element("pauseScreen"),
    settingsDrawer: element("settingsDrawer"),
    inventoryDrawer: element("inventoryDrawer"),
    missionIcon: element("missionIcon"),
    missionTitle: element("missionTitle"),
    missionStage: element("missionStage"),
    missionCopy: element("missionCopy"),
    missionStatus: element("missionStatus"),
    missionReward: element("missionReward"),
    missionTimer: element("missionTimer"),
    missionDistance: element("missionDistance"),
    districtBanner: element("districtBanner"),
    modeBanner: element("modeBanner"),
    audioBanner: element("audioBanner"),
    cashValue: element("cashValue"),
    weaponLabel: element("weaponLabel"),
    weaponMode: element("weaponMode"),
    weaponAmmo: element("weaponAmmo"),
    weaponStatus: element("weaponStatus"),
    starRow: element("starRow"),
    speedNeedle: element("speedNeedle"),
    speedValue: element("speedValue"),
    speedModeCopy: element("speedModeCopy"),
    healthFill: element("healthFill"),
    healthValue: element("healthValue"),
    staminaFill: element("staminaFill"),
    staminaValue: element("staminaValue"),
    durabilityFill: element("durabilityFill"),
    durabilityValue: element("durabilityValue"),
    enterPrompt: element("enterPrompt"),
    enterPromptName: element("enterPromptName"),
    enterPromptDetail: element("enterPromptDetail"),
    interactPrompt: element("interactPrompt"),
    interactPromptName: element("interactPromptName"),
    interactPromptDetail: element("interactPromptDetail"),
    slotOne: element("slotOne"),
    slotTwo: element("slotTwo"),
    slotThree: element("slotThree"),
    slotFour: element("slotFour"),
    slotFive: element("slotFive"),
    inventoryButton: element("inventoryButton"),
    pauseButton: element("pauseButton"),
    menuDistrictButton: element("menuDistrictButton"),
    quickDeployButton: element("quickDeployButton"),
    menuSettingsButton: element("menuSettingsButton"),
    menuDistrictValue: element("menuDistrictValue"),
    menuThemeValue: element("menuThemeValue"),
    menuAudioValue: element("menuAudioValue"),
    menuTouchValue: element("menuTouchValue"),
    menuGraphicsValue: element("menuGraphicsValue"),
    menuModeValue: element("menuModeValue"),
    menuSeedValue: element("menuSeedValue"),
    districtGrid: element("districtGrid"),
    districtBackButton: element("districtBackButton"),
    launchDistrictButton: element("launchDistrictButton"),
    districtFooterCopy: element("districtFooterCopy"),
    resumeButton: element("resumeButton"),
    pauseSettingsButton: element("pauseSettingsButton"),
    resetShellButton: element("resetShellButton"),
    returnDistrictButton: element("returnDistrictButton"),
    closeSettingsButton: element("closeSettingsButton"),
    closeInventoryButton: element("closeInventoryButton"),
    volumeSlider: element("volumeSlider"),
    volumeValue: element("volumeValue"),
    muteToggle: element("muteToggle"),
    sensitivitySlider: element("sensitivitySlider"),
    sensitivityValue: element("sensitivityValue"),
    invertToggle: element("invertToggle"),
    touchLayoutButtons: element("touchLayoutButtons"),
    graphicsButtons: element("graphicsButtons"),
    resetSettingsButton: element("resetSettingsButton"),
    toast: element("toast"),
    audioNotice: element("audioNotice"),
    lookPad: element("lookPad"),
    touchRideButton: element("touchRideButton"),
    touchInteractButton: element("touchInteractButton"),
    touchFireButton: element("touchFireButton"),
    touchPauseButton: element("touchPauseButton"),
    touchExitButton: element("touchExitButton"),
    touchVehicleInteractButton: element("touchVehicleInteractButton"),
    touchHandbrakeButton: element("touchHandbrakeButton"),
    touchBrakeButton: element("touchBrakeButton"),
    touchThrottleButton: element("touchThrottleButton"),
    touchVehiclePauseButton: element("touchVehiclePauseButton"),
    reticle: element("reticle"),
    slotOneName: element("slotOneName"),
    slotOneDetail: element("slotOneDetail"),
    slotTwoName: element("slotTwoName"),
    slotTwoDetail: element("slotTwoDetail"),
    slotThreeName: element("slotThreeName"),
    slotThreeDetail: element("slotThreeDetail"),
    slotFourName: element("slotFourName"),
    slotFourDetail: element("slotFourDetail"),
    slotFiveName: element("slotFiveName"),
    slotFiveDetail: element("slotFiveDetail"),
    leftTouchCluster: document.querySelector(".touch-cluster.left"),
    rightTouchCluster: document.querySelector(".touch-cluster.right"),
    slotButtons: [element("slotOne"), element("slotTwo"), element("slotThree"), element("slotFour"), element("slotFive")],
    touchMoveButtons: [...document.querySelectorAll("[data-touch-move]")],
  };
}

export function createDistrictCards(elements, state, onSelect) {
  elements.districtGrid.innerHTML = "";
  DISTRICTS.forEach((district) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "district-card interactive";
    button.dataset.districtId = district.id;
    button.innerHTML = `
      <div class="district-theme">${district.theme}</div>
      <h3>${district.name}</h3>
      <div class="district-copy">${district.description}</div>
      <canvas class="district-preview" width="320" height="180"></canvas>
      <div class="district-meta">
        <div><strong>Seed:</strong> ${district.seed}</div>
        <div><strong>Spawn:</strong> ${district.spawnPoint.x}, ${district.spawnPoint.y}</div>
        <div><strong>Rides:</strong> ${district.vehicleSpawnPoints.length}</div>
        <div><strong>Missions:</strong> ${district.missionPoints.length}</div>
      </div>
      <div class="district-landmarks">${district.landmarks.map((landmark) => `<span>${landmark}</span>`).join("")}</div>
    `;
    button.addEventListener("click", () => onSelect(district.id));
    elements.districtGrid.appendChild(button);
    drawDistrictPreview(button.querySelector("canvas"), district);
  });

  renderDistrictSelection(elements, state);
}

export function renderDistrictSelection(elements, state) {
  elements.districtGrid.querySelectorAll(".district-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.districtId === state.selectedDistrictId);
  });
}

export function updateTouchLayout(elements, state) {
  const leftCluster = elements.leftTouchCluster;
  const rightCluster = elements.rightTouchCluster;
  if (!leftCluster || !rightCluster) {
    return;
  }

  if (state.settings.touchLayout === "southpaw") {
    leftCluster.style.left = "auto";
    leftCluster.style.right = "18px";
    rightCluster.style.right = "auto";
    rightCluster.style.left = "18px";
  } else {
    leftCluster.style.left = "18px";
    leftCluster.style.right = "auto";
    rightCluster.style.right = "18px";
    rightCluster.style.left = "auto";
  }
}

export function renderHud(elements, state, audioArmed) {
  const district = getDistrictById(state.selectedDistrictId);
  const sessionDistrict = getDistrictById(state.session.districtId);
  const missionScript = getMissionScript(state);
  const missionStage = getMissionStage(state);
  const objectivePoint = getActiveObjectivePoint(state);
  const missionActive = hasActiveMission(state);
  const nearbyMissionContact = getNearbyMissionContact(state);
  const missionTimer = getMissionTimer(state);
  const distance = Math.round(distance2D(getCurrentPosition(state), objectivePoint));
  const speed = state.session.ui.speedDisplay;
  const heatLevel = Math.round(state.session.ui.heat);
  const showingMissionFlash = state.session.ui.missionFlashTimer > 0.05 && Boolean(state.session.ui.missionFlashText);
  const combat = state.session.combat;
  const reloadSeconds = combat.reloadTimer > 0 ? combat.reloadTimer.toFixed(1) : "0.0";

  elements.appShell.dataset.screen = state.screen;
  elements.appShell.dataset.mode = state.session.mode;
  elements.appShell.dataset.touch = state.touchMode ? "true" : "false";

  elements.menuScreen.classList.toggle("visible", state.screen === "menu");
  elements.districtScreen.classList.toggle("visible", state.screen === "district");
  elements.pauseScreen.classList.toggle("visible", state.screen === "pause");
  elements.settingsDrawer.classList.toggle("visible", state.activePanel === "settings");
  elements.inventoryDrawer.classList.toggle("visible", state.activePanel === "inventory");

  elements.missionIcon.textContent = missionScript.icon;
  elements.missionTitle.textContent = missionScript.title;
  elements.missionStage.textContent = objectivePoint.label;
  elements.missionCopy.textContent = missionStage.detail;
  elements.missionStatus.textContent = missionActive ? "ACTIVE RUN" : "RUN BOARD";
  elements.missionReward.textContent = `+$${missionScript.reward}`;
  elements.missionTimer.textContent = missionActive
    ? (missionTimer > 0 ? formatMissionTimer(missionTimer) : "NO TIMER")
    : "FREE ROAM";
  elements.missionDistance.textContent = `${distance}m`;
  if (showingMissionFlash) {
    elements.missionStatus.textContent = state.session.ui.missionFlashText;
    elements.missionDistance.textContent = state.session.ui.missionFlashText;
  }

  elements.districtBanner.textContent = sessionDistrict.name;
  elements.modeBanner.textContent = state.session.failureState
    ? "Respawning"
    : state.session.mode === "vehicle"
      ? "In Vehicle"
      : "On Foot";
  if (state.settings.mute) {
    elements.audioBanner.textContent = "Audio Muted";
  } else if (audioArmed) {
    elements.audioBanner.textContent = "Audio Armed";
  } else {
    elements.audioBanner.textContent = "Tap To Arm Audio";
  }

  elements.cashValue.textContent = `$${state.session.ui.cash.toLocaleString()}`;
  elements.weaponLabel.textContent = combat.weaponLabel;
  elements.weaponAmmo.textContent = `${combat.ammoInClip} / ${combat.reserveAmmo}`;
  if (state.session.mode === "vehicle") {
    elements.weaponMode.textContent = "STOWED";
    elements.weaponStatus.textContent = "Foot only while you are in the ride.";
  } else if (combat.reloadTimer > 0) {
    elements.weaponMode.textContent = "RELOADING";
    elements.weaponStatus.textContent = `Fresh mag in ${reloadSeconds}s.`;
  } else if (combat.equipped) {
    elements.weaponMode.textContent = "DRAWN";
    elements.weaponStatus.textContent = state.touchMode
      ? "Look to aim and tap Fire to send the shot."
      : "Drag to aim, click or C to fire, R to reload.";
  } else {
    elements.weaponMode.textContent = "HOLSTERED";
    elements.weaponStatus.textContent = "Slot 1 draws the sidearm for street work.";
  }
  [...elements.starRow.children].forEach((star, index) => {
    star.classList.toggle("filled", index < heatLevel);
  });

  elements.speedValue.textContent = String(speed);
  elements.speedModeCopy.textContent = state.session.mode === "vehicle" ? state.session.vehicle.label : "On foot";
  elements.speedNeedle.style.transform = `rotate(${-130 + Math.min(speed, 200) * 1.3}deg)`;

  elements.healthFill.style.width = `${state.session.player.health}%`;
  elements.healthValue.textContent = `${Math.round(state.session.player.health)}/100`;
  elements.staminaFill.style.width = `${state.session.player.stamina}%`;
  elements.staminaValue.textContent = `${Math.round(state.session.player.stamina)}/100`;
  elements.durabilityFill.style.width = `${state.session.vehicle.durability}%`;
  elements.durabilityValue.textContent = `${Math.round(state.session.vehicle.durability)}/100`;

  const nearestVehicle = getNearestEnterableVehicle(state);
  if (state.session.mode === "vehicle") {
    elements.enterPromptName.textContent = "Exit Ride";
    elements.enterPromptDetail.textContent = "Drop back to street control.";
    elements.enterPrompt.classList.remove("disabled");
  } else if (nearestVehicle) {
    elements.enterPromptName.textContent = "Enter Ride";
    elements.enterPromptDetail.textContent = `${nearestVehicle.label} is in reach.`;
    elements.enterPrompt.classList.remove("disabled");
  } else {
    elements.enterPromptName.textContent = "Ride Locked";
    elements.enterPromptDetail.textContent = "Move closer to any car.";
    elements.enterPrompt.classList.add("disabled");
  }

  if (!missionActive && nearbyMissionContact) {
    elements.interactPromptName.textContent = "Accept Run";
    elements.interactPromptDetail.textContent = `${nearbyMissionContact.title} is live here.`;
    elements.interactPrompt.classList.remove("disabled");
  } else if (missionActive && isNearObjective(state)) {
    const needsVehicle = missionStage.requiresMode === "vehicle";
    const needsFoot = missionStage.requiresMode === "foot";
    elements.interactPromptName.textContent = missionStage.actionLabel || (missionStage.trigger === "proximity" ? "Clear Gate" : "Interact");
    if (missionStage.trigger === "proximity") {
      elements.interactPromptDetail.textContent = needsVehicle
        ? "Drive through the live gate to clear it."
        : "Move through the live marker.";
      elements.interactPrompt.classList.add("disabled");
    } else if (needsVehicle && state.session.mode !== "vehicle") {
      elements.interactPromptDetail.textContent = "Enter a ride before you clear this leg.";
      elements.interactPrompt.classList.add("disabled");
    } else if (needsFoot && state.session.mode !== "foot") {
      elements.interactPromptDetail.textContent = "Exit the ride and tag this objective by hand.";
      elements.interactPrompt.classList.add("disabled");
    } else {
      elements.interactPromptDetail.textContent = "Current objective is live.";
      elements.interactPrompt.classList.remove("disabled");
    }
  } else {
    elements.interactPromptName.textContent = missionActive ? "Interact" : "Accept Run";
    elements.interactPromptDetail.textContent = missionActive
      ? "Approach the highlighted marker."
      : "Approach a live contract light to start a run.";
    elements.interactPrompt.classList.add("disabled");
  }

  elements.slotButtons.forEach((button, index) => {
    button.classList.toggle("active", state.activeSlot === index + 1);
  });
  elements.slotOneName.textContent = combat.weaponLabel;
  elements.slotOneDetail.textContent = state.session.mode === "vehicle"
    ? "Foot only"
    : combat.reloadTimer > 0
      ? `Reload ${reloadSeconds}s`
      : combat.equipped
        ? "Tap to holster"
        : "Draw sidearm";
  elements.slotTwoName.textContent = "Route Kit";
  elements.slotTwoDetail.textContent = "Pulse line";
  elements.slotThreeName.textContent = "Horn";
  elements.slotThreeDetail.textContent = "Street call";
  elements.slotFourName.textContent = "Reset";
  elements.slotFourDetail.textContent = "Ride recover";
  elements.slotFiveName.textContent = "Garage";
  elements.slotFiveDetail.textContent = "Safe ping";
  elements.reticle.classList.toggle("visible", state.screen === "game" && state.session.mode === "foot" && combat.equipped);
  elements.reticle.classList.toggle("impact", combat.hitMarkerTimer > 0.02);

  elements.menuDistrictValue.textContent = district.name;
  elements.menuThemeValue.textContent = district.theme;
  elements.menuAudioValue.textContent = state.settings.mute ? `${state.settings.volume}% muted` : `${state.settings.volume}% live`;
  elements.menuTouchValue.textContent = state.settings.touchLayout === "southpaw" ? "Southpaw" : "Split";
  elements.menuGraphicsValue.textContent = state.settings.graphicsQuality.toUpperCase();
  elements.menuModeValue.textContent = "Local solo only";
  elements.menuSeedValue.textContent = district.seed;

  elements.quickDeployButton.textContent = `Deploy ${getDistrictById(state.lastDistrictId).name}`;
  elements.launchDistrictButton.textContent = `Launch ${district.name}`;
  elements.districtFooterCopy.textContent =
    `${district.description} Spawn ${district.spawnPoint.x}, ${district.spawnPoint.y} with ${district.vehicleSpawnPoints.length} ride spots and ${district.missionPoints.length} mission nodes.`;

  elements.volumeSlider.value = String(state.settings.volume);
  elements.volumeValue.textContent = `${state.settings.volume}%`;
  elements.sensitivitySlider.value = String(Math.round(state.settings.sensitivity * 100));
  elements.sensitivityValue.textContent = `${state.settings.sensitivity.toFixed(2)}x`;
  elements.muteToggle.textContent = state.settings.mute ? "Muted" : "Live";
  elements.muteToggle.classList.toggle("active", !state.settings.mute);
  elements.invertToggle.textContent = state.settings.invertLook ? "Inverted" : "Standard";
  elements.invertToggle.classList.toggle("active", state.settings.invertLook);
  [...elements.touchLayoutButtons.querySelectorAll("[data-touch-layout]")].forEach((button) => {
    button.classList.toggle("active", button.dataset.touchLayout === state.settings.touchLayout);
  });
  [...elements.graphicsButtons.querySelectorAll("[data-graphics-quality]")].forEach((button) => {
    button.classList.toggle("active", button.dataset.graphicsQuality === state.settings.graphicsQuality);
  });

  elements.audioNotice.classList.toggle("visible", state.touchMode && !audioArmed && state.screen === "game");
  drawMinimap(elements.minimapCanvas, state);
}
