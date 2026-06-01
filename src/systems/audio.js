import { clamp, damp } from "../utils/math.js";

export function createAudioSystem() {
  let armed = false;
  let context = null;
  let engineOscillator = null;
  let engineGain = null;
  let hornTimeout = 0;

  function ensureContext() {
    if (context) {
      return context;
    }

    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) {
      return null;
    }

    context = new AudioCtor();
    return context;
  }

  function stopEngine() {
    if (engineOscillator) {
      engineOscillator.stop();
      engineOscillator.disconnect();
      engineOscillator = null;
    }
    if (engineGain) {
      engineGain.disconnect();
      engineGain = null;
    }
  }

  function arm() {
    const activeContext = ensureContext();
    if (!activeContext) {
      armed = false;
      return false;
    }

    activeContext.resume();
    armed = true;
    return true;
  }

  function isArmed() {
    return armed;
  }

  function playTone(frequency, duration, type = "triangle", volumeScale = 1) {
    if (!armed || !context) {
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.value = clamp(volumeScale, 0, 1) * 0.22;

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.stop(context.currentTime + duration);
  }

  function beepHorn(volume) {
    if (!armed || !context || hornTimeout > 0) {
      return;
    }

    hornTimeout = 0.25;
    playTone(240, 0.12, "square", volume * 0.75);
    playTone(320, 0.1, "square", volume * 0.45);
  }

  function update(state, deltaSeconds) {
    if (!armed || !ensureContext()) {
      return;
    }

    hornTimeout = Math.max(0, hornTimeout - deltaSeconds);

    if (state.settings.mute || state.screen !== "game") {
      stopEngine();
      return;
    }

    const masterVolume = clamp(state.settings.volume / 100, 0, 1);

    if (state.session.mode === "vehicle") {
      if (!engineOscillator || !engineGain) {
        engineOscillator = context.createOscillator();
        engineGain = context.createGain();
        engineOscillator.type = "sawtooth";
        engineOscillator.connect(engineGain);
        engineGain.connect(context.destination);
        engineOscillator.start();
      }

      const speed = Math.abs(state.session.vehicle.speed);
      const throttleIntent = (state.keyboard.KeyW || state.keyboard.ArrowUp || state.touchInput.throttle ? 1 : 0)
        - (state.keyboard.KeyS || state.keyboard.ArrowDown || state.touchInput.brake ? 1 : 0);
      const targetFrequency = 64 + speed * 2.15 + Math.max(0, throttleIntent) * 18;
      const targetGain = 0.02 + masterVolume * (0.02 + speed / 9000);
      engineOscillator.frequency.value = damp(engineOscillator.frequency.value, targetFrequency, 14, deltaSeconds);
      engineGain.gain.value = damp(engineGain.gain.value, targetGain, 12, deltaSeconds);

      if (state.session.ui.hornPulseTimer > 0) {
        beepHorn(masterVolume);
      }

      return;
    }

    stopEngine();
    if (state.session.ui.hornPulseTimer > 0) {
      playTone(520, 0.05, "triangle", masterVolume * 0.45);
      state.session.ui.hornPulseTimer = 0;
    }
  }

  function destroy() {
    stopEngine();
    if (context) {
      context.close();
      context = null;
    }
    armed = false;
  }

  return {
    arm,
    isArmed,
    playTone,
    update,
    destroy,
  };
}
