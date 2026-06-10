# Assets

Binary assets are **not** committed as part of the code foundation — drop them
in here before building. The code references the following paths:

## Fonts (`assets/fonts/`) — required for the app to boot
- `CinzelDecorative-Bold.ttf` — headings (loaded in `App.tsx` as `Cinzel-Bold`)
- `CrimsonText-Regular.ttf` — body text (loaded as `Crimson-Regular`)

Both are free on Google Fonts (Cinzel Decorative, Crimson Text).

## Images (`assets/images/`)
- `ui/icon.png` — 1024×1024 app icon
- `ui/adaptive-icon.png` — 1024×1024 Android adaptive foreground
- `ui/splash.png` — splash image
- `ui/` — HUD frames, buttons, panels
- `buildings/` — top-down building sprites per type & level
- `weapons/` — weapon icons for the Arsenal
- `enemies/` — top-down zombie sprites per type

## Audio (`assets/audio/`)
- `music/` — day ambient, night build-up, night intense, boss, game-over
- `sfx/` — per-weapon fire/reload/empty, zombie vocals, building up/destroy

Until real font files are present, `App.tsx`'s `useFonts` call will fail to
resolve the `require(...)` at bundle time. Either add the TTFs or temporarily
stub the font loading while iterating on logic.
