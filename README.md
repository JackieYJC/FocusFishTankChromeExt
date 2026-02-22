# Focus Fish Tank

A Chrome extension with a virtual fish tank that reacts to your browsing habits.
Your fish thrive when you stay focused — visit distracting sites and watch them deteriorate.

## How It Works

| Behavior | Effect |
|----------|--------|
| Focused browsing | Fish swim actively, bright green, happy expressions |
| Distracting sites | Fish slow down, fade to red, look sad |

A **focus score** (0–100) decays while you're on distracting sites and slowly recovers on everything else. The fish, water color, and ambient lighting all respond to your score in real time.

### Built-in Distracting Sites

Twitter/X · Reddit · Facebook · Instagram · TikTok · YouTube · Twitch · Netflix · Hulu · Disney+ · Prime Video · Pinterest · Snapchat · Tumblr

## Installation

### Load from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/JackieYJC/FocusFishTankChromeExt.git
   cd FocusFishTankChromeExt
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked** and select the project folder
5. Click the extension icon in the toolbar to open your fish tank

## File Structure

```
├── manifest.json            Chrome Extension Manifest v3
├── icons/                   Extension icons (16, 48, 128 px)
└── src/
    ├── background.js        Service worker — tracks tabs, updates focus score every 5 s
    └── popup/
        ├── popup.html       Extension popup layout
        ├── popup.css        Dark aquarium-themed UI styles
        └── popup.js         Canvas fish animation + state rendering
```

## Tuning

Edit the constants at the top of `src/background.js` to adjust sensitivity:

| Constant    | Default | Description                              |
|-------------|---------|------------------------------------------|
| `TICK_SECS` | `5`     | How often (seconds) the score updates    |
| `DECAY`     | `1.5`   | Score lost per tick on a distracting site |
| `GAIN`      | `0.4`   | Score gained per tick on a focused site  |

## Contributing

Pull requests are welcome. Open an issue first for major changes.

## License

[MIT](LICENSE)
