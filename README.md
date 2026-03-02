# iPixel Matrix Controller

Web Bluetooth controller for iPixel Color LED matrix displays. Features text rendering with Hebrew RTL support, animation controls, rainbow modes, and 10 Purim presets.

## Quick Start (Standalone HTML)

The `index.html` file is a complete standalone app that works without any build process:

1. Serve over HTTPS (required for Web Bluetooth)
2. Open in Chrome or Edge
3. Click "Connect Device" and select your LED_BLE_ device

## Development with Vite

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

1. Build the project:
```bash
npm run build
```

2. The `dist` folder contains your static site. Push to GitHub and enable Pages in repo settings pointing to the `dist` folder.

Or use the standalone `index.html` directly - just copy it to your hosting.

## Deploy to Netlify

### Option A: Drag & Drop
1. Build with `npm run build`
2. Drag the `dist` folder to [Netlify Drop](https://app.netlify.com/drop)

### Option B: Git Integration
1. Connect your GitHub repo to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`

## Requirements

- **Browser**: Chrome or Edge (Web Bluetooth support)
- **Connection**: HTTPS (required for Bluetooth API)
- **Device**: iPixel Color LED matrix (advertises as "LED_BLE_*")

## BLE Protocol

Based on the open-source:
- [pypixelcolor](https://github.com/lucagoc/pypixelcolor) (MIT)
- [ha-ipixel-color](https://github.com/cagcoach/ha-ipixel-color)
- [go-ipxl](https://github.com/yyewolf/go-ipxl)

### UUIDs
- Service: `0000fa00-0000-1000-8000-00805f9b34fb`
- Write: `0000fa02-0000-1000-8000-00805f9b34fb`
- Notify: `0000fa01-0000-1000-8000-00805f9b34fb`

## Features

- **Text Input**: Auto-detects Hebrew and reverses for RTL display
- **Canvas Preview**: Pixel-accurate preview of display output
- **Display Size**: Configurable dimensions (32x16 for caps, 64x20 for car displays)
- **Animation**: Scroll left/right/up/down with speed control
- **Rainbow Mode**: 9 color modes
- **Memory Slots**: Save to EEPROM slots 1-10
- **Brightness Control**: 0-100%
- **Purim Presets**: 10 built-in messages with batch upload

## License

MIT
