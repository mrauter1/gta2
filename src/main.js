import { createAppState, DEFAULT_SETTINGS, savePersistedState } from "./state/game-state.js";
import { createAudioSystem } from "./systems/audio.js";
import { clearTransientInputState, createInputSystem } from "./systems/input.js";
import {
  applySimulation,
  fireCombat,
  interactWithMission,
  openScreen,
  reloadCombat,
  resetSessionToDistrict,
  startDistrictRun,
  togglePause,
  toggleVehicle,
  triggerSlotAction,
} from "./systems/gameplay.js";
import { createWorldRenderer } from "./render/three-world.js";
import { createDistrictCards, getElements, renderDistrictSelection, renderHud, updateTouchLayout } from "./ui/hud.js";

function reportBootError(error) {
  const message = error?.stack || error?.message || String(error);
  document.documentElement.setAttribute("data-boot-error", message);
  const toast = document.getElementById("toast");
  if (toast) {
    toast.textContent = `BOOT ERROR: ${message}`;
    toast.classList.add("visible");
  }
  console.error(error);
}

window.addEventListener("error", (event) => {
  reportBootError(event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  reportBootError(event.reason);
});

const state = createAppState();
const elements = getElements();
const audioSystem = createAudioSystem();
const worldRenderer = createWorldRenderer(elements.sceneCanvas);

if (state.forced.mode === "vehicle") {
  state.session.mode = "vehicle";
  state.session.player.x = state.session.vehicle.x;
  state.session.player.y = state.session.vehicle.y;
  state.session.player.angle = state.session.vehicle.angle;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  window.clearTimeout(showToast.timerId);
  showToast.timerId = window.setTimeout(() => {
    elements.toast.classList.remove("visible");
  }, 1800);
}

showToast.timerId = 0;

function armAudio() {
  audioSystem.arm();
  renderUi();
}

function playTone(tone) {
  if (!tone) {
    return;
  }
  audioSystem.playTone(tone.frequency, tone.duration, tone.type);
}

function applyResult(result, persist = false) {
  if (result?.toast) {
    showToast(result.toast);
  }
  if (result?.tone) {
    playTone(result.tone);
  }
  if (persist) {
    savePersistedState(state);
  }
  renderUi();
}

function blurFocusedControl() {
  const activeElement = document.activeElement;
  if (
    !(activeElement instanceof HTMLElement)
    || activeElement === document.body
    || activeElement === document.documentElement
    || activeElement === elements.sceneCanvas
    || !activeElement.matches("button, input, select, textarea, [tabindex]")
  ) {
    return;
  }
  activeElement.blur();
}

function commitShellChange(action, persist = false) {
  clearTransientInputState(state);
  applyResult(action(), persist);
}

function renderUi() {
  updateTouchLayout(elements, state);
  renderDistrictSelection(elements, state);
  renderHud(elements, state, audioSystem.isArmed());
  if (state.screen === "game" && !state.activePanel) {
    blurFocusedControl();
  }
}

window.__blockCityDebug = {
  getState: () => state,
  render: () => renderUi(),
  startDistrictRun: (districtId = state.selectedDistrictId) => {
    commitShellChange(() => startDistrictRun(state, districtId), true);
    return state;
  },
  interact: () => {
    const result = interactWithMission(state);
    applyResult(result);
    return state;
  },
  toggleVehicle: () => {
    commitShellChange(() => toggleVehicle(state));
    return state;
  },
  togglePause: () => {
    commitShellChange(() => togglePause(state));
    return state;
  },
  slotAction: (slotNumber) => {
    applyResult(triggerSlotAction(state, slotNumber));
    return state;
  },
  fireCombat: () => {
    applyResult(fireCombat(state));
    return state;
  },
  reloadCombat: () => {
    applyResult(reloadCombat(state));
    return state;
  },
};

function selectDistrict(districtId) {
  armAudio();
  clearTransientInputState(state);
  state.selectedDistrictId = districtId;
  savePersistedState(state);
  playTone({ frequency: 540, duration: 0.05, type: "triangle" });
  renderUi();
}

function launchSelectedDistrict() {
  armAudio();
  commitShellChange(() => startDistrictRun(state, state.selectedDistrictId), true);
}

function toggleInventory() {
  if (state.screen !== "game") {
    return;
  }
  armAudio();
  commitShellChange(() => {
    state.activePanel = state.activePanel === "inventory" ? null : "inventory";
    return { tone: { frequency: 460, duration: 0.05, type: "triangle" } };
  });
}

createDistrictCards(elements, state, selectDistrict);

elements.menuDistrictButton.addEventListener("click", () => {
  armAudio();
  commitShellChange(() => {
    openScreen(state, "district");
    return { tone: { frequency: 480, duration: 0.06, type: "triangle" } };
  });
});

elements.quickDeployButton.addEventListener("click", () => {
  armAudio();
  commitShellChange(() => startDistrictRun(state, state.lastDistrictId), true);
});

elements.menuSettingsButton.addEventListener("click", () => {
  commitShellChange(() => {
    state.activePanel = "settings";
  });
});

elements.districtBackButton.addEventListener("click", () => {
  commitShellChange(() => {
    openScreen(state, "menu");
  });
});

elements.launchDistrictButton.addEventListener("click", launchSelectedDistrict);

[elements.pauseButton, elements.touchPauseButton, elements.touchVehiclePauseButton, elements.resumeButton].forEach((button) => {
  button.addEventListener("click", () => {
    armAudio();
    commitShellChange(() => togglePause(state));
  });
});

elements.pauseSettingsButton.addEventListener("click", () => {
  commitShellChange(() => {
    state.activePanel = "settings";
  });
});

elements.resetShellButton.addEventListener("click", () => {
  commitShellChange(() => {
    resetSessionToDistrict(state, state.session.districtId);
    state.screen = "game";
    return {
      toast: "District reset",
      tone: { frequency: 430, duration: 0.07, type: "triangle" },
    };
  }, true);
});

elements.returnDistrictButton.addEventListener("click", () => {
  commitShellChange(() => {
    openScreen(state, "district");
  });
});

elements.closeSettingsButton.addEventListener("click", () => {
  commitShellChange(() => {
    state.activePanel = null;
  });
});

elements.closeInventoryButton.addEventListener("click", () => {
  commitShellChange(() => {
    state.activePanel = null;
  });
});

elements.inventoryButton.addEventListener("click", toggleInventory);

elements.slotOne.addEventListener("click", () => {
  armAudio();
  applyResult(triggerSlotAction(state, 1));
});
elements.slotTwo.addEventListener("click", () => {
  armAudio();
  applyResult(triggerSlotAction(state, 2));
});
elements.slotThree.addEventListener("click", () => {
  armAudio();
  applyResult(triggerSlotAction(state, 3));
});
elements.slotFour.addEventListener("click", () => {
  armAudio();
  applyResult(triggerSlotAction(state, 4));
});
elements.slotFive.addEventListener("click", () => {
  armAudio();
  applyResult(triggerSlotAction(state, 5));
});

elements.volumeSlider.addEventListener("input", (event) => {
  state.settings.volume = Number(event.target.value);
  savePersistedState(state);
  renderUi();
});

elements.muteToggle.addEventListener("click", () => {
  state.settings.mute = !state.settings.mute;
  savePersistedState(state);
  applyResult({
    toast: state.settings.mute ? "Audio muted" : "Audio live",
  });
});

elements.sensitivitySlider.addEventListener("input", (event) => {
  state.settings.sensitivity = Number(event.target.value) / 100;
  savePersistedState(state);
  renderUi();
});

elements.invertToggle.addEventListener("click", () => {
  state.settings.invertLook = !state.settings.invertLook;
  savePersistedState(state);
  applyResult({
    toast: state.settings.invertLook ? "Look inverted" : "Look standard",
  });
});

[...elements.touchLayoutButtons.querySelectorAll("[data-touch-layout]")].forEach((button) => {
  button.addEventListener("click", () => {
    state.settings.touchLayout = button.dataset.touchLayout;
    savePersistedState(state);
    applyResult({
      toast: state.settings.touchLayout === "southpaw" ? "Southpaw saved" : "Split layout saved",
      tone: { frequency: 520, duration: 0.05, type: "triangle" },
    });
  });
});

[...elements.graphicsButtons.querySelectorAll("[data-graphics-quality]")].forEach((button) => {
  button.addEventListener("click", () => {
    state.settings.graphicsQuality = button.dataset.graphicsQuality;
    savePersistedState(state);
    applyResult({
      toast: `${button.dataset.graphicsQuality.toUpperCase()} graphics saved`,
      tone: { frequency: 490, duration: 0.05, type: "triangle" },
    });
  });
});

elements.resetSettingsButton.addEventListener("click", () => {
  state.settings = { ...DEFAULT_SETTINGS };
  savePersistedState(state);
  applyResult({
    toast: "Defaults restored",
    tone: { frequency: 520, duration: 0.07, type: "triangle" },
  });
});

elements.touchRideButton.addEventListener("click", () => {
  armAudio();
  commitShellChange(() => toggleVehicle(state));
});

elements.touchExitButton.addEventListener("click", () => {
  armAudio();
  commitShellChange(() => toggleVehicle(state));
});

elements.touchInteractButton.addEventListener("click", () => {
  armAudio();
  applyResult(interactWithMission(state));
});

elements.touchVehicleInteractButton.addEventListener("click", () => {
  armAudio();
  applyResult(interactWithMission(state));
});

elements.touchFireButton?.addEventListener("click", () => {
  armAudio();
  applyResult(fireCombat(state));
});

createInputSystem({
  state,
  elements,
  callbacks: {
    armAudio,
    render: renderUi,
    openScreen: (screenName) => {
      commitShellChange(() => {
        openScreen(state, screenName);
      });
    },
    togglePause: () => commitShellChange(() => togglePause(state)),
    toggleVehicle: () => commitShellChange(() => toggleVehicle(state)),
    interact: () => applyResult(interactWithMission(state)),
    fireCombat: () => applyResult(fireCombat(state)),
    reloadCombat: () => applyResult(reloadCombat(state)),
    toggleInventory,
    slotAction: (slotNumber) => applyResult(triggerSlotAction(state, slotNumber)),
  },
});

renderUi();

let lastFrame = performance.now();
function loop(now) {
  const deltaSeconds = Math.min((now - lastFrame) / 1000, 0.033);
  lastFrame = now;
  const simulationEvents = applySimulation(state, deltaSeconds);
  simulationEvents.forEach((event) => applyResult(event));
  audioSystem.update(state, deltaSeconds);
  worldRenderer.update(state, now * 0.001, deltaSeconds);
  renderUi();
  requestAnimationFrame(loop);
}

window.addEventListener("beforeunload", () => {
  audioSystem.destroy();
});

requestAnimationFrame(loop);
