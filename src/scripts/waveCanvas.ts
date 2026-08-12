const TAU = Math.PI * 2;

/** Height the line widths and blur radius were authored against. */
const REFERENCE_HEIGHT = 521;

interface WaveLayer {
  opacity: number;
  lineWidth: number;
  frequency: number;
  amplitude: number;
  falloff: number;
  verticalPosition: number;
  phaseOffset: number;
  overscanFraction: number;
}

interface WavePreset {
  base: [number, number, number];
  speed: number;
  waves: [WaveLayer, WaveLayer];
}

const IDLE: WavePreset = {
  base: [0.949, 0.314, 0.047],
  speed: 0.055,
  waves: [
    {
      opacity: 0.85,
      lineWidth: 96,
      frequency: 1.485,
      amplitude: 0.535,
      falloff: 0,
      verticalPosition: 0.499,
      phaseOffset: -0.48,
      overscanFraction: 238 / 939,
    },
    {
      opacity: 0.329,
      lineWidth: 76,
      frequency: 1.485,
      amplitude: 0.535,
      falloff: 0,
      verticalPosition: 0.499,
      phaseOffset: -3.62,
      overscanFraction: 238 / 939,
    },
  ],
};

const HOVER: WavePreset = {
  base: [1, 0.353, 0.078],
  speed: 1.093,
  waves: [
    {
      opacity: 0.85,
      lineWidth: 26,
      frequency: 2.085,
      amplitude: 0.335,
      falloff: 0.314,
      verticalPosition: 0.499,
      phaseOffset: -0.48,
      overscanFraction: 83.3 / 939,
    },
    {
      opacity: 0.329,
      lineWidth: 17.833,
      frequency: 2.085,
      amplitude: 0.335,
      falloff: 0.314,
      verticalPosition: 0.499,
      phaseOffset: -3.62,
      overscanFraction: 83.3 / 939,
    },
  ],
};

const INK_DEFAULT: [number, number, number] = [1, 0.92, 0.82];
const INK_SETTINGS: [number, number, number] = [0.96, 0.84, 1];
const SETTINGS_IDLE_BASE: [number, number, number] = [0.482, 0, 0.969];
const SETTINGS_HOVER_BASE: [number, number, number] = [0.588, 0.075, 1];

const MAX_BLUR = 45.25;
const BLUR_EXP = 4.99;
const GRAIN = 0.03;

/** Time constant of the exponential hover glide, in seconds. */
const HOVER_SMOOTHING = 0.16;

const TRIGGER_SELECTOR = "[data-wave-trigger], .buy-btn";

const INTRO_DELAY_MS = 150;
const INTRO_DURATION_MS = 850;

const VERTEX_SHADER = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2  uRes;
uniform float uPhase;
uniform vec3  uBase;
uniform vec3  uInk;
uniform float uMaxBlur;
uniform float uBlurExp;
uniform float uStrongLeft;
uniform float uGrain;

uniform float uOpacity[2];
uniform float uLineW[2];
uniform float uFreq[2];
uniform float uAmp[2];
uniform float uFalloff[2];
uniform float uVPos[2];
uniform float uPhaseOff[2];
uniform float uOverscan[2];

const float TAU = 6.2831853071795864;

vec3 softLight(vec3 b, vec3 s) {
  vec3 d = mix(((16.0 * b - 12.0) * b + 4.0) * b, sqrt(b), step(0.25, b));
  vec3 lo = b - (1.0 - 2.0 * s) * b * (1.0 - b);
  vec3 hi = b + (2.0 * s - 1.0) * (d - b);
  return mix(lo, hi, step(0.5, s));
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Soft coverage of one wave stroke at a fragment. The edge softness 'e' grows
// across the width to emulate the app's variable-radius progressive blur.
float coverage(vec2 frag, float W, float H,
               float O, float lineW, float freq, float amp,
               float falloff, float vpos, float phaseOff, float opacity) {
  float T = W + 2.0 * O;
  float midY = H * vpos;
  float A = H * amp;
  float k = freq * TAU / T;
  float x = frag.x;
  float angle = (x + O) * k - uPhase - phaseOff;
  float s = sin(angle);
  float c = cos(angle);
  float visible = clamp(x / W, 0.0, 1.0);
  float env = max(1.0 - falloff * visible, 0.0);
  float envD = (x > 0.0 && x < W) ? (-falloff / W) : 0.0;
  float y = midY + s * A * env;
  // perpendicular distance to the curve (slope-corrected vertical distance)
  float slope = A * (envD * s + env * c * k);
  float perp = abs(frag.y - y) / sqrt(1.0 + slope * slope);
  float hw = lineW * 0.5;
  float leftAmount = (uStrongLeft > 0.5) ? (1.0 - x / W) : (x / W);
  float e = 0.8 + uMaxBlur * pow(clamp(leftAmount, 0.0, 1.0), uBlurExp);
  float cov = 1.0 - smoothstep(hw - e, hw + e, perp);
  return cov * opacity;
}

void main() {
  float W = uRes.x;
  float H = uRes.y;
  vec2 frag = vec2(gl_FragCoord.x, H - gl_FragCoord.y); // top-left origin

  float a0 = coverage(frag, W, H, uOverscan[0], uLineW[0], uFreq[0], uAmp[0], uFalloff[0], uVPos[0], uPhaseOff[0], uOpacity[0]);
  float a1 = coverage(frag, W, H, uOverscan[1], uLineW[1], uFreq[1], uAmp[1], uFalloff[1], uVPos[1], uPhaseOff[1], uOpacity[1]);
  float a = a0 + a1 * (1.0 - a0); // source-over composite of the two strokes

  vec3 col = mix(uBase, softLight(uBase, uInk), a);
  col += (hash21(frag) - 0.5) * uGrain;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error("Wave shader compile error: " + log);
  }
  return shader;
}

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

export function initWaveCanvas(canvas: HTMLCanvasElement, host: HTMLElement): () => void {
  const gl = (canvas.getContext("webgl", {
    antialias: true,
    alpha: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: "low-power",
  }) || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
  if (!gl) return () => {};

  let program: WebGLProgram;
  try {
    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    program = gl.createProgram()!;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error("Wave program link error: " + gl.getProgramInfoLog(program));
    }
  } catch (error) {
    console.warn(error);
    return () => {};
  }

  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const position = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const uRes = uniform("uRes");
  const uPhase = uniform("uPhase");
  const uBase = uniform("uBase");
  const uInk = uniform("uInk");
  const uMaxBlur = uniform("uMaxBlur");
  const uBlurExp = uniform("uBlurExp");
  const uStrongLeft = uniform("uStrongLeft");
  const uGrain = uniform("uGrain");
  const uOpacity = uniform("uOpacity");
  const uLineW = uniform("uLineW");
  const uFreq = uniform("uFreq");
  const uAmp = uniform("uAmp");
  const uFalloff = uniform("uFalloff");
  const uVPos = uniform("uVPos");
  const uPhaseOff = uniform("uPhaseOff");
  const uOverscan = uniform("uOverscan");

  const isSettingsVariant = host.dataset.waveVariant === "settings";
  const idleBase = isSettingsVariant ? SETTINGS_IDLE_BASE : IDLE.base;
  const hoverBase = isSettingsVariant ? SETTINGS_HOVER_BASE : HOVER.base;

  gl.uniform3fv(uInk, isSettingsVariant ? INK_SETTINGS : INK_DEFAULT);
  gl.uniform1f(uBlurExp, BLUR_EXP);
  gl.uniform1f(uStrongLeft, 1);
  gl.uniform1f(uGrain, GRAIN);

  const opacity = new Float32Array(2);
  const lineWidth = new Float32Array(2);
  const frequency = new Float32Array(2);
  const amplitude = new Float32Array(2);
  const falloff = new Float32Array(2);
  const verticalPosition = new Float32Array(2);
  const phaseOffset = new Float32Array(2);
  const overscan = new Float32Array(2);
  const baseColor = new Float32Array(3);

  let widthPx = 1;
  let heightPx = 1;

  function resize(): void {
    const rect = host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nextWidth = Math.max(1, Math.round(rect.width * dpr));
    const nextHeight = Math.max(1, Math.round(rect.height * dpr));
    if (nextWidth === widthPx && nextHeight === heightPx) return;
    widthPx = nextWidth;
    heightPx = nextHeight;
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    gl!.viewport(0, 0, nextWidth, nextHeight);
    if (!running) renderAt(phase);
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const startedAt = performance.now();

  /** Eased 0→1 ramp that grows the stroke width and amplitude on first paint. */
  function introProgress(): number {
    if (reducedMotion.matches) return 1;
    const t = Math.min(
      Math.max((performance.now() - startedAt - INTRO_DELAY_MS) / INTRO_DURATION_MS, 0),
      1,
    );
    return 1 - Math.pow(1 - t, 3);
  }

  let phase = 0;
  let hoverMix = 0;
  let hoverTarget = 0;
  let lastFrame = performance.now();
  let rafId = 0;
  let running = false;
  let visible = true;

  function draw(): void {
    const mix = hoverMix;
    const scale = heightPx / REFERENCE_HEIGHT;
    const intro = introProgress();

    for (let i = 0; i < 2; i++) {
      const idle = IDLE.waves[i];
      const hover = HOVER.waves[i];
      opacity[i] = lerp(idle.opacity, hover.opacity, mix);
      lineWidth[i] = lerp(idle.lineWidth, hover.lineWidth, mix) * scale * (0.3 + 0.7 * intro);
      frequency[i] = lerp(idle.frequency, hover.frequency, mix);
      amplitude[i] = lerp(idle.amplitude, hover.amplitude, mix) * intro;
      falloff[i] = lerp(idle.falloff, hover.falloff, mix);
      verticalPosition[i] = lerp(idle.verticalPosition, hover.verticalPosition, mix);
      phaseOffset[i] = lerp(idle.phaseOffset, hover.phaseOffset, mix);
      overscan[i] = lerp(idle.overscanFraction, hover.overscanFraction, mix) * widthPx;
    }

    baseColor[0] = lerp(idleBase[0], hoverBase[0], mix);
    baseColor[1] = lerp(idleBase[1], hoverBase[1], mix);
    baseColor[2] = lerp(idleBase[2], hoverBase[2], mix);

    gl!.uniform2f(uRes, widthPx, heightPx);
    gl!.uniform1f(uPhase, phase);
    gl!.uniform3fv(uBase, baseColor);
    gl!.uniform1f(uMaxBlur, MAX_BLUR * scale);
    gl!.uniform1fv(uOpacity, opacity);
    gl!.uniform1fv(uLineW, lineWidth);
    gl!.uniform1fv(uFreq, frequency);
    gl!.uniform1fv(uAmp, amplitude);
    gl!.uniform1fv(uFalloff, falloff);
    gl!.uniform1fv(uVPos, verticalPosition);
    gl!.uniform1fv(uPhaseOff, phaseOffset);
    gl!.uniform1fv(uOverscan, overscan);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
  }

  function renderAt(nextPhase: number): void {
    phase = nextPhase;
    draw();
  }

  function frame(now: number): void {
    const delta = Math.min(Math.max((now - lastFrame) / 1000, 0), 0.1);
    lastFrame = now;
    hoverMix += (hoverTarget - hoverMix) * (1 - Math.exp(-delta / HOVER_SMOOTHING));
    const speed = lerp(IDLE.speed, HOVER.speed, hoverMix);
    phase += delta * speed * TAU;
    draw();
    if (Math.abs(hoverTarget - hoverMix) < 0.001) hoverMix = hoverTarget;
    rafId = requestAnimationFrame(frame);
  }

  function start(): void {
    if (running || !visible || document.hidden || reducedMotion.matches) return;
    running = true;
    lastFrame = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function stop(): void {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(host);

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) start();
      else stop();
    },
    { threshold: 0 },
  );
  intersectionObserver.observe(host);

  const onVisibilityChange = () => (document.hidden ? stop() : start());
  document.addEventListener("visibilitychange", onVisibilityChange);

  const triggerFor = (target: EventTarget | null) =>
    target instanceof Element ? target.closest(TRIGGER_SELECTOR) : null;

  const enterHover = () => {
    host.dataset.waveHover = "true";
    hoverTarget = 1;
    start();
  };

  const leaveHover = () => {
    host.dataset.waveHover = "false";
    hoverTarget = 0;
    start();
  };

  host.dataset.waveHover = "false";

  const onPointerOver = (event: PointerEvent) => {
    const trigger = triggerFor(event.target);
    if (!trigger) return;
    const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
    if (!trigger.contains(related)) enterHover();
  };

  const onPointerOut = (event: PointerEvent) => {
    const trigger = triggerFor(event.target);
    if (!trigger) return;
    const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
    if (!trigger.contains(related)) leaveHover();
  };

  const onFocusIn = (event: FocusEvent) => {
    if (triggerFor(event.target)) enterHover();
  };

  const onFocusOut = (event: FocusEvent) => {
    if (triggerFor(event.target)) leaveHover();
  };

  document.addEventListener("pointerover", onPointerOver);
  document.addEventListener("pointerout", onPointerOut);
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);

  const onReducedMotionChange = () => {
    if (reducedMotion.matches) {
      stop();
      renderAt(phase);
    } else {
      start();
    }
  };
  reducedMotion.addEventListener?.("change", onReducedMotionChange);

  resize();
  renderAt(0);
  start();

  return function destroy(): void {
    stop();
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    document.removeEventListener("pointerover", onPointerOver);
    document.removeEventListener("pointerout", onPointerOut);
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("focusout", onFocusOut);
    delete host.dataset.waveHover;
    reducedMotion.removeEventListener?.("change", onReducedMotionChange);
  };
}
