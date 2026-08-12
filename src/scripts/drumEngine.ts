/**
 * Web Audio engine shared by the drum machine and the spatial-displays demo.
 * The graph lives on `window` so both islands drive one context.
 */

/** Descending scale the melodic rows are mapped onto. */
const MELODY_SCALE = [
  523.25, 493.88, 440, 392, 329.63, 293.66, 261.63, 220, 196, 164.81, 146.83, 130.81, 110,
];

/** Bass note per column pair. */
const BASS_NOTES = [110, 110, 130.81, 130.81, 146.83, 146.83, 98, 98, 87.31, 87.31, 82.41, 82.41];

interface DrumEngine {
  actx: AudioContext | null;
  master: GainNode | null;
  perc: GainNode | null;
  panner: StereoPannerNode | null;
  noiseBuf: AudioBuffer | null;
  spatialDrive: boolean;
  spatialDriveLevel: number;
  spatialDriveTarget: number;
  spatialFadeRaf: number;
  lastSpatialFadeTime: number;
}

declare global {
  interface Window {
    __nearfieldDrumEngine?: DrumEngine;
    webkitAudioContext?: typeof AudioContext;
  }
}

const engine: DrumEngine = (window.__nearfieldDrumEngine ??= {
  actx: null,
  master: null,
  perc: null,
  panner: null,
  noiseBuf: null,
  spatialDrive: false,
  spatialDriveLevel: 0,
  spatialDriveTarget: 0,
  spatialFadeRaf: 0,
  lastSpatialFadeTime: 0,
});

export function ensureAudioGraph(): void {
  if (engine.actx?.state === "closed") {
    engine.actx = null;
    engine.master = null;
    engine.perc = null;
    engine.panner = null;
    engine.noiseBuf = null;
  }
  if (engine.actx) return;

  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return;

  const actx = new Ctor();
  engine.actx = actx;

  let output: AudioNode = actx.destination;
  if (typeof actx.createStereoPanner === "function") {
    engine.panner = actx.createStereoPanner();
    engine.panner.connect(actx.destination);
    output = engine.panner;
  }

  engine.master = actx.createGain();
  engine.master.gain.value = 0.3;

  const tone = actx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 2400;
  tone.Q.value = 0.55;
  engine.master.connect(tone);
  tone.connect(output);

  // Feedback delay: tone -> delay -> damp -> feedback -> delay, plus a wet tap.
  const delay = actx.createDelay(1);
  delay.delayTime.value = 0.33;

  const feedback = actx.createGain();
  feedback.gain.value = 0.34;

  const damp = actx.createBiquadFilter();
  damp.type = "lowpass";
  damp.frequency.value = 1400;

  const wet = actx.createGain();
  wet.gain.value = 0.16;

  tone.connect(delay);
  delay.connect(damp);
  damp.connect(feedback);
  feedback.connect(delay);
  damp.connect(wet);
  wet.connect(output);

  engine.perc = actx.createGain();
  engine.perc.gain.value = 0.28;
  engine.perc.connect(output);
}

/** Plays one silent sample so iOS unlocks the context on first gesture. */
export function resumeAudio(): void {
  const actx = engine.actx;
  if (!actx) return;
  const source = actx.createBufferSource();
  source.buffer = actx.createBuffer(1, 1, actx.sampleRate);
  source.connect(actx.destination);
  source.start();
  if (actx.state === "suspended") actx.resume().catch(() => {});
}

export function setPan(value: number): void {
  if (!engine.actx || !engine.panner) return;
  engine.panner.pan.setTargetAtTime(value, engine.actx.currentTime, 0.05);
}

function noiseBuffer(): AudioBuffer | null {
  if (!engine.actx) return null;
  if (!engine.noiseBuf) {
    const length = Math.floor(engine.actx.sampleRate * 0.15);
    engine.noiseBuf = engine.actx.createBuffer(1, length, engine.actx.sampleRate);
    const data = engine.noiseBuf.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }
  return engine.noiseBuf;
}

function playHat(at: number, velocity: number): void {
  const actx = engine.actx;
  const perc = engine.perc;
  if (!actx || !perc) return;
  const buffer = noiseBuffer();
  if (!buffer) return;

  const source = actx.createBufferSource();
  source.buffer = buffer;

  const highpass = actx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 7000;

  const gain = actx.createGain();
  gain.gain.setValueAtTime(0.14 * velocity, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);

  source.connect(highpass);
  highpass.connect(gain);
  gain.connect(perc);
  source.start(at);
  source.stop(at + 0.08);
}

function playSnare(at: number, velocity: number): void {
  const actx = engine.actx;
  const perc = engine.perc;
  if (!actx || !perc) return;
  const buffer = noiseBuffer();
  if (!buffer) return;

  const source = actx.createBufferSource();
  source.buffer = buffer;

  const band = actx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1800;
  band.Q.value = 0.9;

  const noiseGain = actx.createGain();
  noiseGain.gain.setValueAtTime(0.3 * velocity, at);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);

  source.connect(band);
  band.connect(noiseGain);
  noiseGain.connect(perc);
  source.start(at);
  source.stop(at + 0.15);

  const body = actx.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(220, at);
  body.frequency.exponentialRampToValueAtTime(160, at + 0.08);

  const bodyGain = actx.createGain();
  bodyGain.gain.setValueAtTime(0.18 * velocity, at);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);

  body.connect(bodyGain);
  bodyGain.connect(perc);
  body.start(at);
  body.stop(at + 0.12);
}

function playKick(at: number, velocity: number): void {
  const actx = engine.actx;
  const master = engine.master;
  if (!actx || !master) return;

  const osc = actx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(110, at);
  osc.frequency.exponentialRampToValueAtTime(40, at + 0.12);

  const gain = actx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.6 * velocity, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);

  osc.connect(gain);
  gain.connect(master);
  osc.start(at);
  osc.stop(at + 0.35);
}

function playBass(at: number, column: number, velocity: number): void {
  const actx = engine.actx;
  const master = engine.master;
  if (!actx || !master) return;

  const pair = Math.floor(column / 2);
  const freq =
    BASS_NOTES[((pair % BASS_NOTES.length) + BASS_NOTES.length) % BASS_NOTES.length] ?? 110;

  const sine = actx.createOscillator();
  sine.type = "sine";
  sine.frequency.value = freq;

  const saw = actx.createOscillator();
  saw.type = "sawtooth";
  saw.frequency.value = freq;

  const sawGain = actx.createGain();
  sawGain.gain.value = 0.16;

  const gain = actx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.46 * velocity, at + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.72);

  sine.connect(gain);
  saw.connect(sawGain);
  sawGain.connect(gain);
  gain.connect(master);
  sine.start(at);
  saw.start(at);
  sine.stop(at + 0.9);
  saw.stop(at + 0.9);
}

function playTone(at: number, freq: number, velocity: number): void {
  const actx = engine.actx;
  const master = engine.master;
  if (!actx || !master) return;

  const triangle = actx.createOscillator();
  triangle.type = "triangle";
  triangle.frequency.value = freq;

  const detuned = actx.createOscillator();
  detuned.type = "sine";
  detuned.frequency.value = freq;
  detuned.detune.value = 7;

  const octave = actx.createOscillator();
  octave.type = "sine";
  octave.frequency.value = freq * 2;

  const octaveGain = actx.createGain();
  octaveGain.gain.value = 0.12;

  const gain = actx.createGain();

  const lowpass = actx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.setValueAtTime(1850, at);
  lowpass.frequency.exponentialRampToValueAtTime(720, at + 0.55);
  lowpass.Q.value = 0.9;

  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.24 * velocity, at + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.25);

  triangle.connect(gain);
  detuned.connect(gain);
  octave.connect(octaveGain);
  octaveGain.connect(gain);
  gain.connect(lowpass);
  lowpass.connect(master);

  const sub = actx.createOscillator();
  sub.type = "sine";
  sub.frequency.value = freq / 2;
  sub.detune.value = -5;

  const subGain = actx.createGain();
  subGain.gain.setValueAtTime(0.0001, at);
  subGain.gain.exponentialRampToValueAtTime(0.055 * velocity, at + 0.12);
  subGain.gain.exponentialRampToValueAtTime(0.0001, at + 1.9);

  sub.connect(subGain);
  subGain.connect(master);

  triangle.start(at);
  detuned.start(at);
  octave.start(at);
  sub.start(at);
  triangle.stop(at + 1.6);
  detuned.stop(at + 1.6);
  octave.stop(at + 1.6);
  sub.stop(at + 2);
}

/**
 * Voices one grid cell. The row picks the instrument: the top row is a hat, the
 * bottom a kick, and on tall grids row `total - 2` is bass and row 1 a snare.
 * Everything between maps across MELODY_SCALE.
 */
export function playStep(row: number, total: number, column = 0, velocity = 1): void {
  ensureAudioGraph();
  if (!engine.actx || !engine.master) return;

  const at = engine.actx.currentTime;
  const gain = (0.85 + Math.random() * 0.3) * Math.max(0, Math.min(1, velocity));

  if (row <= 0 && total > 2) {
    playHat(at, gain);
    return;
  }
  if (row >= total - 1 && total > 2) {
    playKick(at, gain);
    return;
  }
  if (total >= 6) {
    if (row === total - 2) {
      playBass(at, column, gain);
      return;
    }
    if (row === 1) {
      playSnare(at, gain);
      return;
    }
  }

  const first = total >= 6 ? 2 : 1;
  const last = total >= 6 ? total - 3 : Math.max(first, total - 2);
  const span = Math.max(1, last - first);
  const clamped = Math.min(last, Math.max(first, row));
  const index = Math.round(((clamped - first) / span) * (MELODY_SCALE.length - 1));
  const freq = MELODY_SCALE[Math.min(MELODY_SCALE.length - 1, Math.max(0, index))] ?? 220;

  playTone(at, freq, gain);
}

function spatialFadeFrame(now: number): void {
  const delta = engine.lastSpatialFadeTime ? Math.min(80, now - engine.lastSpatialFadeTime) : 16;
  engine.lastSpatialFadeTime = now;

  const tau = engine.spatialDriveTarget > engine.spatialDriveLevel ? 140 : 260;
  engine.spatialDriveLevel +=
    (engine.spatialDriveTarget - engine.spatialDriveLevel) * (1 - Math.exp(-delta / tau));

  if (Math.abs(engine.spatialDriveTarget - engine.spatialDriveLevel) < 0.002) {
    engine.spatialDriveLevel = engine.spatialDriveTarget;
  }

  engine.spatialDrive = engine.spatialDriveLevel > 0.01 || engine.spatialDriveTarget > 0;

  if (engine.spatialDrive) {
    engine.spatialFadeRaf = requestAnimationFrame(spatialFadeFrame);
  } else {
    engine.spatialFadeRaf = 0;
    engine.lastSpatialFadeTime = 0;
    setPan(0);
  }
}

export function setSpatialDrive(on: boolean, pan = 0): void {
  engine.spatialDriveTarget = on ? 1 : 0;
  engine.spatialDrive = on || engine.spatialDriveLevel > 0.01;
  if (on) setPan(pan);
  if (!engine.spatialFadeRaf) {
    engine.lastSpatialFadeTime = 0;
    engine.spatialFadeRaf = requestAnimationFrame(spatialFadeFrame);
  }
  window.dispatchEvent(new CustomEvent("nearfield:spatial-drive-changed", { detail: { on } }));
}

export function isSpatialDriveOn(): boolean {
  return engine.spatialDrive;
}

export function spatialDriveLevel(): number {
  return engine.spatialDriveLevel;
}
