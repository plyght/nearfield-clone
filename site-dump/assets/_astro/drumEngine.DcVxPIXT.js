const T = [523.25, 493.88, 440, 392, 329.63, 293.66, 261.63, 220, 196, 164.81, 146.83, 130.81, 110],
  v = [110, 110, 130.81, 130.81, 146.83, 146.83, 98, 98, 87.31, 87.31, 82.41, 82.41],
  a = (window.__nearfieldDrumEngine ??= {
    actx: null,
    master: null,
    perc: null,
    panner: null,
    noiseBuf: null,
    spatialDrive: !1,
    spatialDriveLevel: 0,
    spatialDriveTarget: 0,
    spatialFadeRaf: 0,
    lastSpatialFadeTime: 0,
  });
function y() {
  if (
    (a.actx?.state === "closed" &&
      ((a.actx = null), (a.master = null), (a.perc = null), (a.panner = null), (a.noiseBuf = null)),
    a.actx)
  )
    return;
  const e = window.AudioContext || window.webkitAudioContext;
  if (!e) return;
  const t = new e();
  a.actx = t;
  let i = t.destination;
  (typeof t.createStereoPanner == "function" &&
    ((a.panner = t.createStereoPanner()), a.panner.connect(t.destination), (i = a.panner)),
    (a.master = t.createGain()),
    (a.master.gain.value = 0.3));
  const n = t.createBiquadFilter();
  ((n.type = "lowpass"),
    (n.frequency.value = 2400),
    (n.Q.value = 0.55),
    a.master.connect(n),
    n.connect(i));
  const s = t.createDelay(1);
  s.delayTime.value = 0.33;
  const c = t.createGain();
  c.gain.value = 0.34;
  const r = t.createBiquadFilter();
  ((r.type = "lowpass"), (r.frequency.value = 1400));
  const o = t.createGain();
  ((o.gain.value = 0.16),
    n.connect(s),
    s.connect(r),
    r.connect(c),
    c.connect(s),
    r.connect(o),
    o.connect(i),
    (a.perc = t.createGain()),
    (a.perc.gain.value = 0.28),
    a.perc.connect(i));
}
function S() {
  const e = a.actx;
  if (!e) return;
  const t = e.createBufferSource();
  ((t.buffer = e.createBuffer(1, 1, e.sampleRate)),
    t.connect(e.destination),
    t.start(),
    e.state === "suspended" && e.resume().catch(() => {}));
}
function d(e) {
  a.actx && a.panner && a.panner.pan.setTargetAtTime(e, a.actx.currentTime, 0.05);
}
function x() {
  if (!a.actx) return null;
  if (!a.noiseBuf) {
    const e = Math.floor(a.actx.sampleRate * 0.15);
    a.noiseBuf = a.actx.createBuffer(1, e, a.actx.sampleRate);
    const t = a.noiseBuf.getChannelData(0);
    for (let i = 0; i < e; i++) t[i] = Math.random() * 2 - 1;
  }
  return a.noiseBuf;
}
function A(e, t) {
  const i = a.actx,
    n = a.perc;
  if (!i || !n) return;
  const s = x();
  if (!s) return;
  const c = i.createBufferSource();
  c.buffer = s;
  const r = i.createBiquadFilter();
  ((r.type = "highpass"), (r.frequency.value = 7e3));
  const o = i.createGain();
  (o.gain.setValueAtTime(0.14 * t, e),
    o.gain.exponentialRampToValueAtTime(1e-4, e + 0.05),
    c.connect(r),
    r.connect(o),
    o.connect(n),
    c.start(e),
    c.stop(e + 0.08));
}
function h(e, t) {
  const i = a.actx,
    n = a.perc;
  if (!i || !n) return;
  const s = x();
  if (!s) return;
  const c = i.createBufferSource();
  c.buffer = s;
  const r = i.createBiquadFilter();
  ((r.type = "bandpass"), (r.frequency.value = 1800), (r.Q.value = 0.9));
  const o = i.createGain();
  (o.gain.setValueAtTime(0.3 * t, e),
    o.gain.exponentialRampToValueAtTime(1e-4, e + 0.12),
    c.connect(r),
    r.connect(o),
    o.connect(n),
    c.start(e),
    c.stop(e + 0.15));
  const l = i.createOscillator();
  ((l.type = "sine"),
    l.frequency.setValueAtTime(220, e),
    l.frequency.exponentialRampToValueAtTime(160, e + 0.08));
  const u = i.createGain();
  (u.gain.setValueAtTime(0.18 * t, e),
    u.gain.exponentialRampToValueAtTime(1e-4, e + 0.1),
    l.connect(u),
    u.connect(n),
    l.start(e),
    l.stop(e + 0.12));
}
function D(e, t) {
  const i = a.actx,
    n = a.master;
  if (!i || !n) return;
  const s = i.createOscillator();
  ((s.type = "sine"),
    s.frequency.setValueAtTime(110, e),
    s.frequency.exponentialRampToValueAtTime(40, e + 0.12));
  const c = i.createGain();
  (c.gain.setValueAtTime(1e-4, e),
    c.gain.exponentialRampToValueAtTime(0.6 * t, e + 0.008),
    c.gain.exponentialRampToValueAtTime(1e-4, e + 0.32),
    s.connect(c),
    c.connect(n),
    s.start(e),
    s.stop(e + 0.35));
}
function V(e, t, i) {
  const n = a.actx,
    s = a.master;
  if (!n || !s) return;
  const c = Math.floor(t / 2),
    r = v[((c % v.length) + v.length) % v.length] ?? 110,
    o = n.createOscillator();
  ((o.type = "sine"), (o.frequency.value = r));
  const l = n.createOscillator();
  ((l.type = "sawtooth"), (l.frequency.value = r));
  const u = n.createGain();
  u.gain.value = 0.16;
  const p = n.createGain();
  (p.gain.setValueAtTime(1e-4, e),
    p.gain.exponentialRampToValueAtTime(0.46 * i, e + 0.025),
    p.gain.exponentialRampToValueAtTime(1e-4, e + 0.72),
    o.connect(p),
    l.connect(u),
    u.connect(p),
    p.connect(s),
    o.start(e),
    l.start(e),
    o.stop(e + 0.9),
    l.stop(e + 0.9));
}
function q(e, t, i) {
  const n = a.actx,
    s = a.master;
  if (!n || !s) return;
  const c = n.createOscillator();
  ((c.type = "triangle"), (c.frequency.value = t));
  const r = n.createOscillator();
  ((r.type = "sine"), (r.frequency.value = t), (r.detune.value = 7));
  const o = n.createOscillator();
  ((o.type = "sine"), (o.frequency.value = t * 2));
  const l = n.createGain();
  l.gain.value = 0.12;
  const u = n.createGain(),
    p = n.createBiquadFilter();
  ((p.type = "lowpass"),
    p.frequency.setValueAtTime(1850, e),
    p.frequency.exponentialRampToValueAtTime(720, e + 0.55),
    (p.Q.value = 0.9),
    u.gain.setValueAtTime(1e-4, e),
    u.gain.exponentialRampToValueAtTime(0.24 * i, e + 0.03),
    u.gain.exponentialRampToValueAtTime(1e-4, e + 1.25),
    c.connect(u),
    r.connect(u),
    o.connect(l),
    l.connect(u),
    u.connect(p),
    p.connect(s));
  const f = n.createOscillator();
  ((f.type = "sine"), (f.frequency.value = t / 2), (f.detune.value = -5));
  const m = n.createGain();
  (m.gain.setValueAtTime(1e-4, e),
    m.gain.exponentialRampToValueAtTime(0.055 * i, e + 0.12),
    m.gain.exponentialRampToValueAtTime(1e-4, e + 1.9),
    f.connect(m),
    m.connect(s),
    c.start(e),
    r.start(e),
    o.start(e),
    f.start(e),
    c.stop(e + 1.6),
    r.stop(e + 1.6),
    o.stop(e + 1.6),
    f.stop(e + 2));
}
function F(e, t, i = 0, n = 1) {
  if ((y(), !a.actx || !a.master)) return;
  const s = a.actx.currentTime,
    c = (0.85 + Math.random() * 0.3) * Math.max(0, Math.min(1, n));
  if (e <= 0 && t > 2) {
    A(s, c);
    return;
  }
  if (e >= t - 1 && t > 2) {
    D(s, c);
    return;
  }
  if (t >= 6) {
    if (e === t - 2) {
      V(s, i, c);
      return;
    }
    if (e === 1) {
      h(s, c);
      return;
    }
  }
  const r = t >= 6 ? 2 : 1,
    o = t >= 6 ? t - 3 : Math.max(r, t - 2),
    l = Math.max(1, o - r),
    u = Math.min(o, Math.max(r, e)),
    p = Math.round(((u - r) / l) * (T.length - 1)),
    f = T[Math.min(T.length - 1, Math.max(0, p))] ?? 220;
  q(s, f, c);
}
function g(e) {
  const t = a.lastSpatialFadeTime ? Math.min(80, e - a.lastSpatialFadeTime) : 16;
  a.lastSpatialFadeTime = e;
  const i = a.spatialDriveTarget > a.spatialDriveLevel ? 140 : 260;
  ((a.spatialDriveLevel += (a.spatialDriveTarget - a.spatialDriveLevel) * (1 - Math.exp(-t / i))),
    Math.abs(a.spatialDriveTarget - a.spatialDriveLevel) < 0.002 &&
      (a.spatialDriveLevel = a.spatialDriveTarget),
    (a.spatialDrive = a.spatialDriveLevel > 0.01 || a.spatialDriveTarget > 0),
    a.spatialDrive
      ? (a.spatialFadeRaf = requestAnimationFrame(g))
      : ((a.spatialFadeRaf = 0), (a.lastSpatialFadeTime = 0), d(0)));
}
function B(e, t = 0) {
  ((a.spatialDriveTarget = e ? 1 : 0),
    (a.spatialDrive = e || a.spatialDriveLevel > 0.01),
    e && d(t),
    a.spatialFadeRaf ||
      ((a.lastSpatialFadeTime = 0), (a.spatialFadeRaf = requestAnimationFrame(g))),
    window.dispatchEvent(
      new CustomEvent("nearfield:spatial-drive-changed", { detail: { on: e } }),
    ));
}
function M() {
  return a.spatialDrive;
}
function R() {
  return a.spatialDriveLevel;
}
export { d as a, y as e, R as g, M as i, F as p, S as r, B as s };
