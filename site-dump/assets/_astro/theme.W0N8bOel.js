const l = "nearfield:theme";
function a() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}
function g(s) {
  const { button: e, sunIcon: r, moonIcon: h, hiddenClass: c, themeColor: m } = s;
  function n(t) {
    document.documentElement.dataset.theme = t;
    const o = t === "light";
    (r?.classList.toggle(c, o), h?.classList.toggle(c, !o));
    const i = o ? "Switch to dark mode" : "Switch to light mode";
    (e?.setAttribute("aria-label", i),
      e && (e.title = i),
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", m[t]));
  }
  (n(a()),
    e?.addEventListener("click", () => {
      const t = a() === "light" ? "dark" : "light";
      n(t);
      try {
        localStorage.setItem(l, t);
      } catch {}
    }),
    window.matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", (t) => {
      try {
        if (localStorage.getItem(l)) return;
      } catch {}
      n(t.matches ? "light" : "dark");
    }));
}
export { g as i };
