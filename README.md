# Focus Fish Tank

A Chrome extension with a virtual fish tank that reacts to your browsing habits.
Stay on task and your fish thrive — visit distracting sites and watch them deteriorate.

## How It Works

A **focus score** (0–100) rises while you browse normally and decays when you visit
blocked sites. Fish health, water colour, ambient lighting, and tank effects all
respond to your score in real time.

| Behaviour | Effect |
|-----------|--------|
| Focused browsing | Fish swim actively, bright colours, happy expressions |
| Distracting sites | Fish slow down, desaturate, frown; tank turns murky |
| Idle / overnight | Score drifts back toward 70 (±15 from where you left off) |

A coin economy rewards focus — spend coins in the **Shop** on new species,
decorations, and backgrounds. Check the **🐠 Pals** tab for live stats on every
fish and plant in your tank.

### Default Blocked Sites

Twitter/X · Reddit · Facebook · Instagram · TikTok · YouTube · Twitch · Netflix ·
Hulu · Disney+ · Prime Video · Pinterest · Snapchat · Tumblr

---

## Development

### Prerequisites

- Node.js 18+ and npm
- Google Chrome

### Install dependencies

```bash
npm install
```

### Build

Compile TypeScript + bundle everything into `dist/`:

```bash
npm run build
```

### Watch mode

Rebuilds automatically on every file save:

```bash
npm run dev
```

### Type-check only (no output)

```bash
npm run typecheck
```

### Load the extension in Chrome

1. Run `npm run build` (or `npm run dev` to keep it live).
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer mode** (toggle, top-right).
4. Click **Load unpacked** → select the **`dist/`** folder (not the project root).
5. Click the extension icon in the toolbar to open your fish tank.

After any source change, run `npm run build` again and click the **↺ refresh** icon
on the extension card in `chrome://extensions/`.

---

## Releasing

### 1 — Bump the version

Edit **both** files to the new version (e.g. `0.2.0`):

```
manifest.json   →  "version": "0.2.0"
package.json    →  "version": "0.2.0"
```

Commit the bump:

```bash
git add manifest.json package.json
git commit -m "Bump version to 0.2.0"
git tag v0.2.0
git push && git push --tags
```

### 2 — Build a clean bundle

```bash
npm run build
```

### 3 — Create the zip

Zip only the `dist/` folder (Chrome Web Store expects a flat archive of the
extension root, not a nested folder):

```bash
cd dist && zip -r ../focus-fish-tank-0.2.0.zip . && cd ..
```

The resulting `focus-fish-tank-0.2.0.zip` is ready to upload.

> **Tip:** add `*.zip` to `.gitignore` if it isn't already.

### 4 — Publish to the Chrome Web Store

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Select **Focus Fish Tank** from your items list.
3. Click **Package** → **Upload new package**.
4. Select `focus-fish-tank-0.2.0.zip`.
5. Open the **Store listing** tab and update the description / screenshots if needed.
6. Open the **Publish** tab, fill in the release notes, and click
   **Submit for review**.

Chrome review typically takes a few hours to a few days for an update.

---

## Project Structure

```
├── manifest.json          MV3 manifest (source — copied to dist/ by Vite)
├── icons/                 16 / 48 / 128 px PNG icons
├── package.json
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── types.ts           Shared TypeScript types
    ├── constants.ts       GAME_BALANCE, SHOP_ITEMS, SPECIES_HUE, …
    ├── theme.ts           UI theme loader (5 colour themes)
    ├── fish-renderer.ts   All canvas drawing — fish, decorations, previews
    ├── background.ts      Service worker — score, coins, idle drift, alarms
    ├── popup/
    │   ├── popup.html     Popup markup (🪸 Home · 🐠 Pals · 🛒 Shop tabs)
    │   ├── popup.css      Dark aquarium UI + design tokens
    │   ├── main.ts        Popup entry point
    │   ├── tank.ts        Fish + Decoration classes, render loop
    │   ├── game-state.ts  Storage sync, coin float, time tracking
    │   ├── shop-pane.ts   Shop grids (fish / decorations / backgrounds)
    │   └── debug.ts       Debug panel (hidden behind dev console)
    └── settings/
        ├── settings.html  Settings page (sidebar nav + content)
        ├── settings.css   Settings styles
        └── main.ts        Blocklist, work hours, fish/decoration management
```

---

## Key Tuning Constants (`src/constants.ts`)

| Constant | Default | Description |
|----------|---------|-------------|
| `TICK_SECS` | `5` | Score update interval (seconds) |
| `DECAY` | `1.5` | Score lost per tick on a blocked site |
| `GAIN` | `0.4` | Score gained per tick while focused |
| `COIN_RATE` | `≈0.83` | Active coins/tick at full focus score |
| `IDLE_COIN_RATE` | `0.1` | Passive coins/tick always (caps at 200) |
| `IDLE_TARGET` | `70` | Score the tank drifts toward overnight |
| `IDLE_DRIFT_MAX` | `15` | Max overnight score movement from session end |

---

## Contributing

Pull requests are welcome. Please open an issue first for major changes.

## License

[MIT](LICENSE)
