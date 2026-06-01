import { detectTouchMode } from "../state/game-state.js";

const GAMEPLAY_KEY_CODES = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ShiftLeft",
  "ShiftRight",
  "Space",
  "KeyE",
  "KeyF",
  "KeyB",
  "KeyR",
  "KeyC",
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Digit5",
]);

function updateLookYaw(state, deltaX, factor) {
  if (!state.session) {
    return;
  }
  const invert = state.settings.invertLook ? -1 : 1;
  const nextYaw = state.session.ui.cameraYaw + deltaX * factor * state.settings.sensitivity * invert;
  state.session.ui.cameraYaw = Math.atan2(Math.sin(nextYaw), Math.cos(nextYaw));
}

function safeSetPointerCapture(element, pointerId) {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Synthetic events used in validation do not create an active pointer to capture.
  }
}

function resetLookDrag(state) {
  state.lookDrag.active = false;
  state.lookDrag.pointerId = null;
  state.lookDrag.source = null;
  state.lookDrag.startX = 0;
  state.lookDrag.lastX = 0;
  state.lookDrag.maxDelta = 0;
}

function shouldPreventDefault(state, code) {
  if (code === "Escape") {
    return Boolean(state.activePanel) || state.screen === "game" || state.screen === "pause";
  }

  if (code === "Enter") {
    return state.screen === "menu";
  }

  return state.screen === "game" && !state.activePanel && GAMEPLAY_KEY_CODES.has(code);
}

export function clearTransientInputState(state) {
  Object.keys(state.keyboard).forEach((code) => {
    state.keyboard[code] = false;
  });
  Object.keys(state.touchInput).forEach((control) => {
    state.touchInput[control] = false;
  });
  resetLookDrag(state);
}

function bindHoldButton(element, onDown, onUp) {
  element.addEventListener("pointerdown", (event) => {
    onDown();
    safeSetPointerCapture(element, event.pointerId);
  });
  element.addEventListener("pointerup", onUp);
  element.addEventListener("pointercancel", onUp);
  element.addEventListener("pointerleave", onUp);
  element.addEventListener("lostpointercapture", onUp);
}

export function createInputSystem({ state, elements, callbacks }) {
  function render() {
    callbacks.render();
  }

  function releaseLook(event) {
    if (state.lookDrag.pointerId === event.pointerId) {
      const shouldFire = state.lookDrag.source === "scene"
        && !state.touchMode
        && state.screen === "game"
        && !state.activePanel
        && state.lookDrag.maxDelta < 10;
      resetLookDrag(state);
      if (shouldFire) {
        callbacks.fireCombat();
      }
    }
  }

  window.addEventListener("keydown", (event) => {
    if (shouldPreventDefault(state, event.code)) {
      event.preventDefault();
    }

    callbacks.armAudio();

    if (event.code === "Escape") {
      if (state.activePanel) {
        clearTransientInputState(state);
        state.activePanel = null;
        render();
        return;
      }
      if (state.screen === "game" || state.screen === "pause") {
        callbacks.togglePause();
        return;
      }
    }

    if (event.code === "Enter" && state.screen === "menu") {
      if (performance.now() < (state.bootInputGuardUntil || 0)) {
        return;
      }
      callbacks.openScreen("district");
      return;
    }

    if (event.code === "KeyE" && state.screen === "game") {
      callbacks.toggleVehicle();
      return;
    }

    if (event.code === "KeyF" && state.screen === "game") {
      callbacks.interact();
      return;
    }

    if (event.code === "KeyB" && state.screen === "game") {
      callbacks.toggleInventory();
      return;
    }

    if (event.code === "KeyR" && state.screen === "game") {
      callbacks.reloadCombat();
      return;
    }

    if (event.code === "KeyC" && state.screen === "game") {
      callbacks.fireCombat();
      return;
    }

    if (["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"].includes(event.code) && state.screen === "game") {
      callbacks.slotAction(Number(event.code.slice(-1)));
      return;
    }

    state.keyboard[event.code] = true;
  });

  window.addEventListener("keyup", (event) => {
    if (shouldPreventDefault(state, event.code)) {
      event.preventDefault();
    }
    state.keyboard[event.code] = false;
  });

  window.addEventListener("blur", () => {
    clearTransientInputState(state);
    render();
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      return;
    }
    clearTransientInputState(state);
    render();
  });

  elements.sceneCanvas.addEventListener("pointerdown", (event) => {
    if (state.screen !== "game" || state.activePanel) {
      return;
    }
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    callbacks.armAudio();
    state.lookDrag.active = true;
    state.lookDrag.source = "scene";
    state.lookDrag.pointerId = event.pointerId;
    state.lookDrag.lastX = event.clientX;
    state.lookDrag.startX = event.clientX;
    state.lookDrag.maxDelta = 0;
    safeSetPointerCapture(elements.sceneCanvas, event.pointerId);
  });

  elements.sceneCanvas.addEventListener("pointermove", (event) => {
    if (!state.lookDrag.active || state.lookDrag.source !== "scene" || state.lookDrag.pointerId !== event.pointerId) {
      return;
    }
    if (event.pointerType === "mouse" && event.buttons === 0) {
      resetLookDrag(state);
      return;
    }
    event.preventDefault();
    const delta = event.clientX - state.lookDrag.lastX;
    state.lookDrag.lastX = event.clientX;
    state.lookDrag.maxDelta = Math.max(state.lookDrag.maxDelta, Math.abs(event.clientX - state.lookDrag.startX));
    updateLookYaw(state, delta, 0.0021);
    render();
  });

  elements.sceneCanvas.addEventListener("pointerup", releaseLook);
  elements.sceneCanvas.addEventListener("pointercancel", releaseLook);
  elements.sceneCanvas.addEventListener("lostpointercapture", releaseLook);
  window.addEventListener("pointerup", releaseLook);
  window.addEventListener("pointercancel", releaseLook);

  elements.lookPad.addEventListener("pointerdown", (event) => {
    callbacks.armAudio();
    state.lookDrag.active = true;
    state.lookDrag.source = "touch";
    state.lookDrag.pointerId = event.pointerId;
    state.lookDrag.lastX = event.clientX;
    state.lookDrag.startX = event.clientX;
    state.lookDrag.maxDelta = 0;
    safeSetPointerCapture(elements.lookPad, event.pointerId);
  });

  elements.lookPad.addEventListener("pointermove", (event) => {
    if (!state.lookDrag.active || state.lookDrag.source !== "touch" || state.lookDrag.pointerId !== event.pointerId) {
      return;
    }
    const delta = event.clientX - state.lookDrag.lastX;
    state.lookDrag.lastX = event.clientX;
    state.lookDrag.maxDelta = Math.max(state.lookDrag.maxDelta, Math.abs(event.clientX - state.lookDrag.startX));
    updateLookYaw(state, delta, 0.0027);
    render();
  });

  elements.lookPad.addEventListener("pointerup", releaseLook);
  elements.lookPad.addEventListener("pointercancel", releaseLook);
  elements.lookPad.addEventListener("lostpointercapture", releaseLook);

  for (const button of elements.touchMoveButtons) {
    const control = button.dataset.touchMove;
    const activate = (value) => {
      state.touchInput[control] = value;
    };
    bindHoldButton(button, () => {
      callbacks.armAudio();
      activate(true);
    }, () => activate(false));
  }

  bindHoldButton(elements.touchThrottleButton, () => {
    callbacks.armAudio();
    state.touchInput.throttle = true;
  }, () => {
    state.touchInput.throttle = false;
  });

  bindHoldButton(elements.touchBrakeButton, () => {
    callbacks.armAudio();
    state.touchInput.brake = true;
  }, () => {
    state.touchInput.brake = false;
  });

  bindHoldButton(elements.touchHandbrakeButton, () => {
    callbacks.armAudio();
    state.touchInput.handbrake = true;
  }, () => {
    state.touchInput.handbrake = false;
  });

  window.addEventListener("resize", () => {
    state.touchMode = state.forced.touchMode ?? detectTouchMode();
    render();
  });

  return {
    syncTouchMode() {
      state.touchMode = state.forced.touchMode ?? detectTouchMode();
    },
  };
}
