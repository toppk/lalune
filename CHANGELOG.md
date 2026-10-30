# Changelog

## 0.2.0 — 2026-10-30

- Add classic script-tag builds: `dist/lalune-core.iife.min.js` (`LaLuneCore`)
  and `dist/lalune.iife.min.js` (`LaLune`), with core functions in both and
  no eager DOM, network, or WebGL activity. Bundle all three MIT notices in
  `THIRD_PARTY_NOTICES.txt`.
- Add `phaseName(date)`. Principal labels apply within exactly 24 hours of a
  calculated phase event; crescent/gibbous labels apply outside. `calculateMoon`
  uses the same labels. This intentionally changes some 0.1.0 phase labels.
- Add `riseSet({ observer, date, days = 1 })`, using upper limb and standard
  refraction, and `nextPhases(date, count = 4)` with chronological events.
- Add `tint` (`#RRGGBB`) and `brightness` (nonnegative display-space multiplier)
  to the renderer constructor and `update()`, preserving the previous defaults
  and transparent background. Styling affects the Moon, not the sky.
- Add `moon-color-2k.jpg` and `moon-height-2k.png`, selected explicitly by URL.
- Document the no-build, core-first/lazy-renderer integration, fallback behavior,
  scientific conventions, and Night palette acceptance check.

## 0.1.0

Initial release: observer-aware renderer, core calculations, 4K NASA maps,
optional sky colors, and the interactive demo.
