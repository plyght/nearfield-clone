import { e as U, r as _, s as j, a as rt } from "./drumEngine.DcVxPIXT.js";
function at(r) {
  const C = r.querySelector("[data-window]"),
    B = r.querySelector("[data-window-mask]"),
    $ = r.querySelector("[data-clip-path]"),
    b = [...r.querySelectorAll("[data-clip-rect]")],
    f = [...r.querySelectorAll("[data-display]")];
  if (!C || !B || !$ || b.length < 2 || f.length < 2) return;
  const e = C,
    q = `spatial-clip-${Math.random().toString(36).slice(2, 9)}`;
  (($.id = q), (B.style.clipPath = `url(#${q})`));
  let d = 1,
    c = 0,
    h = 0,
    w = 0,
    R = 0,
    I = !1;
  r.dataset.windowMode = "drag";
  function W() {
    (e.style.setProperty("--window-x", `${c}px`), e.style.setProperty("--window-y", `${h}px`));
  }
  function G(t) {
    const o = r.getBoundingClientRect(),
      i = f[t].getBoundingClientRect(),
      n = f[0].getBoundingClientRect().width;
    return { x: i.left - o.left + 0.2635 * n, y: i.top - o.top + 0.168 * n };
  }
  function F(t) {
    const o = r.getBoundingClientRect(),
      i = t + w / 2;
    let n = 0,
      s = 1 / 0;
    return (
      f.forEach((m, y) => {
        const a = m.getBoundingClientRect(),
          p = a.left - o.left + a.width / 2,
          E = Math.abs(i - p);
        E < s && ((n = y), (s = E));
      }),
      n
    );
  }
  function J(t) {
    t !== d && ((d = t), (r.dataset.active = String(d)), (l || u) && rt(d === 0 ? -1 : 1));
  }
  function D(t) {
    const o = r.getBoundingClientRect(),
      n = f[0].getBoundingClientRect().width;
    if (
      ((w = 0.425 * n),
      (R = 0.234 * n),
      (e.style.width = `${w}px`),
      (e.style.height = `${R}px`),
      (e.style.borderRadius = `${0.0195 * n}px`),
      (e.style.left = "0px"),
      (e.style.top = "0px"),
      f.forEach((s, m) => {
        const y = s.querySelector(".screen"),
          a = b[m];
        if (!y || !a) return;
        const p = y.getBoundingClientRect(),
          E = 0.016 * n;
        (a.setAttribute("x", String(p.left - o.left)),
          a.setAttribute("y", String(p.top - o.top)),
          a.setAttribute("width", String(p.width)),
          a.setAttribute("height", String(p.height)),
          a.setAttribute("rx", String(E)),
          a.setAttribute("ry", String(E)));
      }),
      I)
    )
      ((c = Math.min(Math.max(0, c), Math.max(0, o.width - w))),
        (h = Math.min(Math.max(0, h), Math.max(0, o.height - R))),
        (d = F(c)));
    else {
      const s = G(d);
      ((c = s.x), (h = s.y));
    }
    ((e.style.transition = "none"),
      W(),
      e.offsetWidth,
      (e.style.transition = ""),
      (r.dataset.active = String(d)),
      e.classList.add("ready"));
  }
  (new ResizeObserver(() => D()).observe(r), D());
  const N = window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    v = [...e.querySelectorAll(".bar")];
  let l = !1,
    u = !1,
    M = !1,
    S = -1,
    T = 0,
    X = 0;
  e.dataset.soundActive = "false";
  const K = v.map((t, o) => ({ f: 5.5 + o * 1.6 + Math.random() * 2, p: Math.random() * 6.28 }));
  let g = 0,
    x = 0;
  function Y(t) {
    const o = t / 1e3;
    x += ((l || u ? 1 : 0) - x) * 0.1;
    for (let i = 0; i < v.length; i++) {
      const n = K[i],
        m = 0.45 + (0.5 + 0.5 * Math.sin(o * n.f + n.p));
      v[i].style.transform = `scaleY(${(1 + x * (m - 1)).toFixed(3)})`;
    }
    l || u || x > 0.01
      ? (g = requestAnimationFrame(Y))
      : (v.forEach((i) => (i.style.transform = "")), (g = 0));
  }
  function z() {
    g || (g = requestAnimationFrame(Y));
  }
  const Q =
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>';
  let A = 0;
  function O() {
    const t = r.getBoundingClientRect(),
      o = f[d].querySelector(".screen");
    if (!o) return;
    const i = o.getBoundingClientRect(),
      n = document.createElement("span");
    ((n.className = "note"), (n.innerHTML = Q));
    const s = 11 + Math.random() * 11,
      m = 0.05 + Math.random() * 0.9,
      y = 0.08 + Math.random() * 0.1,
      a = i.left - t.left + i.width * m,
      p = i.top - t.top + i.height * y;
    ((n.style.left = `${a}px`),
      (n.style.top = `${p}px`),
      n.style.setProperty("--sz", `${s}px`),
      n.style.setProperty("--dx", `${(Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 24)}px`),
      n.style.setProperty("--dy", `${-42 - Math.random() * 42}px`),
      n.style.setProperty("--rot0", `${Math.random() * 30 - 15}deg`),
      n.style.setProperty("--rot1", `${Math.random() * 60 - 30}deg`),
      n.style.setProperty("--op", (0.45 + Math.random() * 0.35).toFixed(2)),
      n.style.setProperty("--dur", `${(1.5 + Math.random() * 0.9).toFixed(2)}s`),
      n.addEventListener("animationend", () => n.remove()),
      r.appendChild(n));
  }
  function Z() {
    A || (O(), (A = window.setInterval(O, 400)));
  }
  function tt() {
    (clearInterval(A), (A = 0), r.querySelectorAll(".note").forEach((t) => t.remove()));
  }
  window.addEventListener(
    "pointerdown",
    () => {
      (U(), _());
    },
    { once: !0 },
  );
  function H() {
    const t = l;
    ((l = !0), et(), !N && !t && z());
  }
  function et() {
    u ||
      ((u = !0),
      (e.dataset.soundActive = "true"),
      e.classList.add("is-playing"),
      U(),
      _(),
      j(!0, d === 0 ? -1 : 1),
      N || (z(), Z()));
  }
  function P() {
    M || (!l && !u) || ((l = !1), k());
  }
  function k() {
    (!u && !e.classList.contains("is-playing")) ||
      ((u = !1),
      (e.dataset.soundActive = "false"),
      e.classList.remove("is-playing"),
      tt(),
      j(!1),
      l ||
        ((x = 0),
        g && cancelAnimationFrame(g),
        (g = 0),
        v.forEach((t) => (t.style.transform = ""))));
  }
  (e.addEventListener("pointerenter", H), e.addEventListener("pointerleave", P));
  function nt(t, o) {
    const i = r.getBoundingClientRect();
    ((c = t - i.left - T),
      (h = o - i.top - X),
      (c = Math.min(Math.max(0, c), Math.max(0, i.width - w))),
      (h = Math.min(Math.max(0, h), Math.max(0, i.height - R))),
      W(),
      J(F(c)));
  }
  function it(t, o) {
    const i = e.getBoundingClientRect();
    return t >= i.left && t <= i.right && o >= i.top && o <= i.bottom;
  }
  function ot(t) {
    if (t.pointerType === "mouse" && t.button !== 0) return;
    (t.preventDefault(), H(), (M = !0), (I = !0), (S = t.pointerId), e.classList.add("dragging"));
    const o = e.getBoundingClientRect();
    ((T = t.clientX - o.left), (X = t.clientY - o.top));
    try {
      e.setPointerCapture(t.pointerId);
    } catch {}
  }
  function V(t) {
    !M || t.pointerId !== S || (t.preventDefault(), nt(t.clientX, t.clientY));
  }
  function L(t) {
    if (!(!M || t.pointerId !== S)) {
      ((M = !1), (S = -1), e.classList.remove("dragging"));
      try {
        e.releasePointerCapture(t.pointerId);
      } catch {}
      (t.pointerType !== "mouse" || !it(t.clientX, t.clientY)) && P();
    }
  }
  (e.addEventListener("pointerdown", ot),
    e.addEventListener("pointermove", V),
    e.addEventListener("pointerup", L),
    e.addEventListener("pointercancel", L),
    document.addEventListener("pointermove", V),
    document.addEventListener("pointerup", L),
    document.addEventListener("pointercancel", L),
    document.addEventListener("visibilitychange", () => {
      document.hidden && (P(), k());
    }));
}
document.querySelectorAll("[data-spatial]").forEach(at);
