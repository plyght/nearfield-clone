# nearfield-clone

A structural clone of [trynearfield.com](https://trynearfield.com/), rebuilt as an Astro 7 +
Tailwind v4 project.

The original is itself an Astro + Tailwind site, so the port is 1:1: hand-authored CSS is copied
verbatim, Tailwind utilities are regenerated from a reconstructed `@theme`, and every shipped
JavaScript island was rewritten as readable TypeScript rather than pasted in minified.

## Getting started

```bash
bun install
bun run dev            # http://localhost:4321
bun run build          # static output in dist/
bun run preview
```

Quality gates:

```bash
bun run format         # prettier (incl. prettier-plugin-astro)
bun run typecheck      # astro check, errors only
bun run lint           # astro check, warnings too
bun run check          # format:check + typecheck + test + build
```

## Layout

```
site-dump/                 mirror of the source site — gitignored, regenerate locally
extracted/                 intermediate CSS split — gitignored, regenerate locally
scripts/                   fetch + conversion pipeline
src/
  layouts/    Base.astro, Legal.astro
  components/ Nav, Footer, Logo, Hero, SpatialDisplays, Display, DrumMachine,
              CompanionCard, FeatureCards, FeatureGrid, BottomCta, BuyButton, FaqItem
  pages/      index, faqs, nearfield-vs-stereofuse, privacy, terms, refund-policy
  scripts/    converted islands (see below)
  styles/     global.css + components/*.css
public/       fonts/ (self-hosted Inter), images, favicon, og image
```

## The JavaScript islands

The original ships six minified ES modules. Each was read, traced, and rewritten as typed,
commented TypeScript. Behaviour and every tuning constant are preserved exactly — shader
uniforms, spring/decay time constants, audio envelopes, pattern maths.

| Source bundle          | Converted to                | What it does                                            |
| ---------------------- | --------------------------- | ------------------------------------------------------- |
| `WaveCanvas...js`      | `src/scripts/waveCanvas.ts` | WebGL hero wave; GLSL and all presets copied verbatim    |
| `drumEngine...js`      | `src/scripts/drumEngine.ts` | Web Audio graph, voices, stereo drive                    |
| `DrumMachine...js`     | `src/scripts/drumMachine.ts`| Step sequencer, sweep, persistence                       |
| `SpatialDisplays...js` | `src/scripts/spatialDisplays.ts` | Draggable window, clip mask, note particles         |
| `Cards...js`           | `src/scripts/cards.ts`      | Card settings view, speed slider, template buttons       |
| `Nav...js` + `theme...js` | `src/scripts/theme.ts` + `Nav.astro` | Theme + sound toggles                     |

Pure pattern maths lives in `src/scripts/drumPatterns.ts` so `DrumMachine.astro` can import it at
build time and server-render the initial grid instead of flashing an empty one.

The three page-level inline `<script>` blocks were converted too: `heroHeadline.ts`
(per-character headline stagger), `faqAccordion.ts` (height-animated `<details>`), and
`companionScroll.ts` (drives `--scroll-progress`, which slides the settings-window mock as the
section crosses the viewport).

`scripts/audit-animations.mjs` cross-checks every `@keyframes` and JS-driven custom property in
the source CSS against what the clone ships, so a dropped animation surface fails loudly.

## CSS strategy

The source bundle mixes compiled Tailwind output with hand-authored scoped CSS. Pasting the
compiled bundle would leave a dead build, so instead:

- Custom design tokens were reconstructed into `@theme` in `src/styles/global.css`; Tailwind
  regenerates all utilities from the markup. Adding a new utility class works normally.
- Hand-authored rules were split per Astro scope id into `src/styles/components/*.css` and copied
  verbatim, with the `[data-astro-cid-*]` attributes stripped.
- Page-level `<style>` blocks (the legal/FAQ styles) are extracted into `page-styles.css`.
- Light/dark theming works exactly as the original: tokens are redefined under
  `html[data-theme="light"]`, so utilities flip automatically.

`scripts/build-component-css.mjs` warns if a class is defined in more than one sheet — those
sheets are global once de-scoped, so collisions would otherwise override silently.

## Regenerating from the source site

`site-dump/`, `extracted/` and `shots/` are gitignored, so a fresh clone has none of them.
Recreate them before running any extractor:

```bash
bun run site:fetch      # mirror routes + assets into site-dump/
bun run site:unminify   # format HTML/CSS/JS, keeping *.min.* originals
bun run site:css        # split CSS, rebuild global.css
bun run site:assets     # copy fonts/images into public/
bun scripts/extract-inline-css.mjs
```

Extractors read the `.min.*` copies, so re-formatting the dump cannot silently break them.

Verification:

```bash
bun run site:shots      # local vs original, desktop + mobile, into shots/
bun run site:smoke      # console errors, failed requests, remote assets
bun scripts/audit-animations.mjs   # every keyframe + driven variable still shipped
```

## Known gaps

These are deliberate, not oversights:

- **Copy is not the original's.** Headlines, body copy, FAQ answers, legal pages, and the
  comparison page use placeholder wording. The layout, class names, and structure are faithful;
  the prose is not the site owner's writing and needs replacing before any real use. Files with
  placeholder text carry a comment saying so.
- **Checkout is removed.** The original has a payment dialog (`CheckoutModal`); it was dropped by
  request. Its scoped stylesheet is excluded from the CSS build, and all CTAs point at the GitHub
  releases page instead. The buttons, sizes, and hover/wave-trigger behaviour are otherwise intact.
- **Analytics removed.** The original loads Vercel Analytics; nothing third-party is loaded here.
  `bun run site:smoke` asserts no remote script or stylesheet survives in the build.
- **The drum machine's dev tuning panel is not rendered.** It is a floating debug overlay whose
  `.panel` rule collides with the display bezel's `.panel`. `initDrumMachine` still supports it if
  you add markup with `[data-panel]`.
- **Branding is the original's.** The Nearfield name, logo, wordmark, and product imagery belong to
  the site's owner. Replace them before publishing anything from this repo.
- **Visual verification is per-route screenshots, not pixel diffing.** `shots/` holds local and
  original captures side by side at 1440px and 390px; comparison is by eye. There is no automated
  perceptual-diff threshold, and no unit tests cover the converted islands' runtime behaviour —
  they were verified by reading the source and by smoke-checking each route.

## Deploying

Static output, no adapter. `bun run build` then point Vercel (or any static host) at `dist/`.
