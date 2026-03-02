import { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';

// BLE UUIDs
const SERVICE_UUID = '0000fa00-0000-1000-8000-00805f9b34fb';
const WRITE_UUID = '0000fa02-0000-1000-8000-00805f9b34fb';
const NOTIFY_UUID = '0000fa01-0000-1000-8000-00805f9b34fb';

// CRC32 lookup table
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Purim presets
const PURIM_PRESETS = [
  { text: 'א פרייליכן פורים', name: 'A Freilichen Purim' },
  { text: '🤮 עד דלא ידע 🤮', name: 'Ad Delo Yada' },
  { text: 'אורה זו תורה', name: 'Orah Zu Torah' },
  { text: 'ארור המן ברוך מרדכי', name: 'Arur Haman Baruch Mordechai' },
  { text: 'ארור מרדכי ברוך המן', name: 'Arur Mordechai Baruch Haman' },
  { text: "If you can read this you're too sober", name: 'Too Sober' },
  { text: 'חייב איניש לבסומי', name: 'Chayav Inish' },
  { text: 'מי שלא נותן מקבל המן טאש', name: 'Hamantash Warning' },
  { text: 'עני בא לפניך ואתה מסתכל על הכובע', name: 'Poor Man & Hat' },
  { text: "Even $100 is fine I'm not judging", name: '$100 Is Fine' },
];

const ANIMATION_MODES = [
  { value: 0, label: 'None', icon: '⬜' },
  { value: 1, label: 'Scroll Left', icon: '⬅️' },
  { value: 2, label: 'Scroll Right', icon: '➡️' },
  { value: 3, label: 'Scroll Up', icon: '⬆️' },
  { value: 4, label: 'Scroll Down', icon: '⬇️' },
];

const RAINBOW_MODES = [
  { value: 0, label: 'Off' },
  { value: 1, label: 'Mode 1' },
  { value: 2, label: 'Mode 2' },
  { value: 3, label: 'Mode 3' },
  { value: 4, label: 'Mode 4' },
  { value: 5, label: 'Mode 5' },
  { value: 6, label: 'Mode 6' },
  { value: 7, label: 'Mode 7' },
  { value: 8, label: 'Mode 8' },
  { value: 9, label: 'Full Rainbow' },
];

function isHebrew(text) {
  return /[\u0590-\u05FF]/.test(text);
}

function reverseHebrew(text) {
  if (!isHebrew(text)) return text;
  return text.split('').reverse().join('');
}

export default function App() {
  const [device, setDevice] = useState(null);
  const [writeChar, setWriteChar] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const [text, setText] = useState('חג פורים שמח');
  const [fontSize, setFontSize] = useState(15);
  const [yOffset, setYOffset] = useState(-3);
  const [displayWidth, setDisplayWidth] = useState(64);
  const [displayHeight, setDisplayHeight] = useState(20);
  const [animation, setAnimation] = useState(1);
  const [speed, setSpeed] = useState(50);
  const [rainbow, setRainbow] = useState(9);
  const [slot, setSlot] = useState(0);
  const [brightness, setBrightness] = useState(80);

  const [deviceFilter, setDeviceFilter] = useState('LED_BLE_');
  const [scanAll, setScanAll] = useState(false);

  const [logs, setLogs] = useState([]);
  const [sending, setSending] = useState(false);
  const [fontLoaded, setFontLoaded] = useState(false);

  const canvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const logRef = useRef(null);

  const log = useCallback((msg, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [...prev.slice(-100), { msg, type, timestamp }]);
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  // Load font
  useEffect(() => {
    document.fonts.ready.then(() => {
      document.fonts.load('700 20px Rubik').then(() => {
        setFontLoaded(true);
        log('Rubik Bold font loaded', 'success');
      });
    });
  }, [log]);

  // Render canvas preview
  useEffect(() => {
    if (!fontLoaded) return;

    const canvas = canvasRef.current;
    const preview = previewCanvasRef.current;
    if (!canvas || !preview) return;

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${fontSize}px Rubik`;
    ctx.textBaseline = 'top';

    const displayText = isHebrew(text) ? reverseHebrew(text) : text;
    ctx.fillText(displayText, 0, yOffset);

    // Draw pixelated preview
    const pCtx = preview.getContext('2d');
    const scale = 8;
    preview.width = displayWidth * scale;
    preview.height = displayHeight * scale;

    pCtx.imageSmoothingEnabled = false;
    pCtx.fillStyle = '#000000';
    pCtx.fillRect(0, 0, preview.width, preview.height);

    const imageData = ctx.getImageData(0, 0, displayWidth, displayHeight);

    for (let y = 0; y < displayHeight; y++) {
      for (let x = 0; x < displayWidth; x++) {
        const i = (y * displayWidth + x) * 4;
        const pixelBrightness = imageData.data[i];
        if (pixelBrightness > 30) {
          pCtx.fillStyle = `rgb(${pixelBrightness}, ${pixelBrightness}, ${pixelBrightness})`;
          pCtx.fillRect(x * scale + 1, y * scale + 1, scale - 2, scale - 2);
        } else {
          pCtx.fillStyle = '#111118';
          pCtx.fillRect(x * scale + 1, y * scale + 1, scale - 2, scale - 2);
        }
      }
    }
  }, [text, fontSize, yOffset, displayWidth, displayHeight, fontLoaded]);

  async function connect() {
    if (!navigator.bluetooth) {
      log('Web Bluetooth not supported. Use Chrome/Edge on HTTPS.', 'error');
      return;
    }

    try {
      setConnecting(true);

      let requestOptions;
      if (scanAll) {
        log('Scanning for ALL Bluetooth devices...', 'info');
        requestOptions = {
          acceptAllDevices: true,
          optionalServices: [SERVICE_UUID]
        };
      } else {
        log(`Scanning for devices with prefix "${deviceFilter}"...`, 'info');
        requestOptions = {
          filters: [{ namePrefix: deviceFilter }],
          optionalServices: [SERVICE_UUID]
        };
      }

      const bleDevice = await navigator.bluetooth.requestDevice(requestOptions);

      log(`Found device: ${bleDevice.name}`, 'success');

      bleDevice.addEventListener('gattserverdisconnected', () => {
        log('Device disconnected', 'warning');
        setConnected(false);
        setDevice(null);
        setWriteChar(null);
      });

      const server = await bleDevice.gatt.connect();
      log('Connected to GATT server', 'success');

      const service = await server.getPrimaryService(SERVICE_UUID);
      log('Got primary service', 'info');

      const wChar = await service.getCharacteristic(WRITE_UUID);
      const nChar = await service.getCharacteristic(NOTIFY_UUID);

      await nChar.startNotifications();
      nChar.addEventListener('characteristicvaluechanged', (event) => {
        const value = new Uint8Array(event.target.value.buffer);
        log(`Notify: [${Array.from(value).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`, 'notify');
      });

      setDevice(bleDevice);
      setWriteChar(wChar);
      setConnected(true);
      log('Ready to send commands!', 'success');

    } catch (err) {
      log(`Connection failed: ${err.message}`, 'error');
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    if (device?.gatt?.connected) {
      device.gatt.disconnect();
    }
    setConnected(false);
    setDevice(null);
    setWriteChar(null);
    log('Disconnected', 'info');
  }

  async function writeChunked(data) {
    if (!writeChar) {
      log('Not connected', 'error');
      return false;
    }

    const MTU = 20;
    for (let i = 0; i < data.length; i += MTU) {
      const chunk = data.slice(i, i + MTU);
      try {
        await writeChar.writeValue(chunk);
        log(`Sent chunk ${Math.floor(i/MTU)+1}/${Math.ceil(data.length/MTU)}: [${Array.from(chunk).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`, 'tx');
        await new Promise(r => setTimeout(r, 20));
      } catch (err) {
        log(`Write error: ${err.message}`, 'error');
        return false;
      }
    }
    return true;
  }

  async function sendBrightness() {
    const cmd = new Uint8Array([0x05, 0x00, 0x04, 0x80, brightness]);
    log(`Setting brightness to ${brightness}%`, 'info');
    await writeChunked(cmd);
  }

  async function sendPowerOn() {
    const cmd = new Uint8Array([0x05, 0x00, 0x07, 0x01, 0x01]);
    log('Sending power on', 'info');
    await writeChunked(cmd);
  }

  async function sendAnimation(mode, spd) {
    const cmd = new Uint8Array([0x06, 0x00, 0x05, 0x80, mode, spd]);
    log(`Setting animation mode ${mode}, speed ${spd}`, 'info');
    await writeChunked(cmd);
  }

  async function sendRainbow(mode) {
    const cmd = new Uint8Array([0x05, 0x00, 0x06, 0x80, mode]);
    log(`Setting rainbow mode ${mode}`, 'info');
    await writeChunked(cmd);
  }

  async function sendPNG(pngData, bufferNum = 0) {
    const size = pngData.length;
    const crc = crc32(pngData);

    const headerLen = 11 + pngData.length;
    const totalLen = 2 + headerLen;

    const packet = new Uint8Array(totalLen);
    packet[0] = headerLen & 0xFF;
    packet[1] = (headerLen >> 8) & 0xFF;
    packet[2] = 0x02;
    packet[3] = 0x00;
    packet[4] = 0x00;
    packet[5] = size & 0xFF;
    packet[6] = (size >> 8) & 0xFF;
    packet[7] = (size >> 16) & 0xFF;
    packet[8] = (size >> 24) & 0xFF;
    packet[9] = crc & 0xFF;
    packet[10] = (crc >> 8) & 0xFF;
    packet[11] = (crc >> 16) & 0xFF;
    packet[12] = (crc >> 24) & 0xFF;
    packet[13] = 0x00;
    packet[14] = bufferNum;
    packet.set(pngData, 15);

    log(`Sending PNG: ${size} bytes, CRC32: ${crc.toString(16)}, slot: ${bufferNum}`, 'info');
    return await writeChunked(packet);
  }

  async function sendToDisplay() {
    if (!connected) {
      log('Not connected to device', 'error');
      return;
    }

    setSending(true);
    try {
      const canvas = canvasRef.current;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const pngData = new Uint8Array(await blob.arrayBuffer());

      log(`Generated PNG: ${pngData.length} bytes`, 'info');

      const success = await sendPNG(pngData, slot);
      if (!success) {
        log('Failed to send PNG', 'error');
        return;
      }

      const animMode = animation === 0 ? 0 :
        (animation === 1 && isHebrew(text)) ? 2 : animation;
      await sendAnimation(animMode, speed);

      if (rainbow > 0) {
        await sendRainbow(rainbow);
      }

      log(`Sent to ${slot === 0 ? 'preview' : `slot ${slot}`}!`, 'success');

    } catch (err) {
      log(`Send error: ${err.message}`, 'error');
    } finally {
      setSending(false);
    }
  }

  async function loadPreset(preset) {
    setText(preset.text);
    log(`Loaded preset: ${preset.name}`, 'info');
  }

  async function loadAllPresets() {
    if (!connected) {
      log('Not connected to device', 'error');
      return;
    }

    setSending(true);
    log('Loading all Purim presets to slots 1-10...', 'info');

    for (let i = 0; i < PURIM_PRESETS.length; i++) {
      const preset = PURIM_PRESETS[i];
      const targetSlot = i + 1;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = displayWidth;
      canvas.height = displayHeight;

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, displayWidth, displayHeight);
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${fontSize}px Rubik`;
      ctx.textBaseline = 'top';

      const displayText = isHebrew(preset.text) ? reverseHebrew(preset.text) : preset.text;
      ctx.fillText(displayText, 0, yOffset);

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const pngData = new Uint8Array(await blob.arrayBuffer());

      log(`Sending preset ${i+1}/10: ${preset.name}`, 'info');
      await sendPNG(pngData, targetSlot);

      const animMode = isHebrew(preset.text) ? 2 : 1;
      await sendAnimation(animMode, speed);

      if (rainbow > 0) {
        await sendRainbow(rainbow);
      }

      await new Promise(r => setTimeout(r, 100));
    }

    log('All presets loaded!', 'success');
    setSending(false);
  }

  const textIsHebrew = isHebrew(text);

  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1 className="title">
            <span className="title-icon">◈</span>
            iPIXEL MATRIX
            <span className="title-icon">◈</span>
          </h1>
          <p className="subtitle">LED DISPLAY CONTROLLER</p>
        </div>
        <div className="connection-status">
          <div
            className="status-dot"
            style={{
              backgroundColor: connected ? 'var(--accent-green)' : connecting ? 'var(--accent-yellow)' : 'var(--text-dim)',
              boxShadow: connected ? 'var(--glow-green)' : 'none',
            }}
          />
          <span className="status-text">
            {connected ? device?.name : connecting ? 'CONNECTING...' : 'DISCONNECTED'}
          </span>
        </div>
      </header>

      {/* Main Grid */}
      <main className="main">
        {/* Left Column - Controls */}
        <div className="left-column">
          {/* Connection Panel */}
          <section className="panel">
            <h2 className="panel-title">
              <span className="panel-icon">⚡</span>
              CONNECTION
            </h2>

            {/* Device Filter Controls */}
            <div className="filter-row">
              <label className="filter-label">
                <input
                  type="checkbox"
                  checked={scanAll}
                  onChange={(e) => setScanAll(e.target.checked)}
                  className="checkbox"
                />
                <span className="checkbox-label">Scan All Devices</span>
              </label>
            </div>

            {!scanAll && (
              <div className="filter-input-row">
                <label className="label">Name Prefix</label>
                <input
                  type="text"
                  value={deviceFilter}
                  onChange={(e) => setDeviceFilter(e.target.value)}
                  className="filter-input"
                  placeholder="LED_BLE_"
                />
              </div>
            )}

            <div className="connection-buttons">
              {!connected ? (
                <button
                  className="button button-cyan"
                  onClick={connect}
                  disabled={connecting}
                >
                  {connecting ? '⟳ SCANNING...' : '◉ CONNECT DEVICE'}
                </button>
              ) : (
                <>
                  <button className="button button-red" onClick={disconnect}>
                    ✕ DISCONNECT
                  </button>
                  <button className="button button-yellow" onClick={sendPowerOn}>
                    ⏻ POWER ON
                  </button>
                </>
              )}
            </div>
          </section>

          {/* Text Input Panel */}
          <section className="panel">
            <h2 className="panel-title">
              <span className="panel-icon">✎</span>
              TEXT INPUT
            </h2>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="text-input"
              style={{
                direction: textIsHebrew ? 'rtl' : 'ltr',
                textAlign: textIsHebrew ? 'right' : 'left',
              }}
              placeholder="Enter text..."
            />
            <div className="input-meta">
              {textIsHebrew && <span className="rtl-badge">עברית RTL</span>}
              <span className="char-count">{text.length} chars</span>
            </div>
          </section>

          {/* Display Settings */}
          <section className="panel">
            <h2 className="panel-title">
              <span className="panel-icon">⚙</span>
              DISPLAY SETTINGS
            </h2>
            <div className="settings-grid">
              <div className="setting-row">
                <label className="label">Size</label>
                <div className="size-inputs">
                  <input
                    type="number"
                    value={displayWidth}
                    onChange={(e) => setDisplayWidth(parseInt(e.target.value) || 32)}
                    className="number-input"
                  />
                  <span className="size-separator">×</span>
                  <input
                    type="number"
                    value={displayHeight}
                    onChange={(e) => setDisplayHeight(parseInt(e.target.value) || 16)}
                    className="number-input"
                  />
                </div>
              </div>
              <div className="setting-row">
                <label className="label">Font Size</label>
                <input
                  type="range"
                  min="8"
                  max="32"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="slider"
                />
                <span className="slider-value">{fontSize}px</span>
              </div>
              <div className="setting-row">
                <label className="label">Y Offset</label>
                <input
                  type="range"
                  min="-10"
                  max="10"
                  value={yOffset}
                  onChange={(e) => setYOffset(parseInt(e.target.value))}
                  className="slider"
                />
                <span className="slider-value">{yOffset}px</span>
              </div>
            </div>
          </section>

          {/* Animation Panel */}
          <section className="panel">
            <h2 className="panel-title">
              <span className="panel-icon">↻</span>
              ANIMATION
            </h2>
            <div className="animation-grid">
              {ANIMATION_MODES.map(mode => (
                <button
                  key={mode.value}
                  className={`anim-button ${animation === mode.value ? 'active' : ''}`}
                  onClick={() => setAnimation(mode.value)}
                >
                  <span className="anim-icon">{mode.icon}</span>
                  <span className="anim-label">{mode.label}</span>
                </button>
              ))}
            </div>
            <div className="setting-row">
              <label className="label">Speed</label>
              <input
                type="range"
                min="0"
                max="100"
                value={speed}
                onChange={(e) => setSpeed(parseInt(e.target.value))}
                className="slider"
              />
              <span className="slider-value">{speed}</span>
            </div>
          </section>

          {/* Rainbow Panel */}
          <section className="panel">
            <h2 className="panel-title">
              <span className="panel-icon rainbow-icon">🌈</span>
              RAINBOW MODE
            </h2>
            <div className="rainbow-grid">
              {RAINBOW_MODES.map(mode => (
                <button
                  key={mode.value}
                  className={`rainbow-button ${rainbow === mode.value ? 'active' : ''}`}
                  onClick={() => setRainbow(mode.value)}
                >
                  {mode.value === 0 ? 'OFF' : mode.value}
                </button>
              ))}
            </div>
          </section>

          {/* Brightness Panel */}
          <section className="panel">
            <h2 className="panel-title">
              <span className="panel-icon">☀</span>
              BRIGHTNESS
            </h2>
            <div className="brightness-row">
              <input
                type="range"
                min="0"
                max="100"
                value={brightness}
                onChange={(e) => setBrightness(parseInt(e.target.value))}
                className="slider flex-1"
              />
              <span className="brightness-value">{brightness}%</span>
              <button
                className="button button-small button-yellow"
                onClick={sendBrightness}
                disabled={!connected}
              >
                SET
              </button>
            </div>
          </section>
        </div>

        {/* Right Column - Preview & Slots */}
        <div className="right-column">
          {/* Preview Panel */}
          <section className="panel">
            <h2 className="panel-title">
              <span className="panel-icon">◫</span>
              PREVIEW
            </h2>
            <div className="preview-container">
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <canvas ref={previewCanvasRef} className="preview-canvas" />
              <div className="preview-info">
                {displayWidth}×{displayHeight} pixels
              </div>
            </div>
          </section>

          {/* Slot Selection */}
          <section className="panel">
            <h2 className="panel-title">
              <span className="panel-icon">▤</span>
              MEMORY SLOT
            </h2>
            <div className="slot-grid">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => (
                <button
                  key={s}
                  className={`slot-button ${slot === s ? 'active' : ''}`}
                  onClick={() => setSlot(s)}
                >
                  {s === 0 ? '⟐' : s}
                </button>
              ))}
            </div>
            <p className="slot-hint">
              Slot 0 = Preview only • Slots 1-10 = Save to EEPROM
            </p>
          </section>

          {/* Send Button */}
          <button
            className="send-button"
            onClick={sendToDisplay}
            disabled={!connected || sending}
            style={{ opacity: !connected || sending ? 0.5 : 1 }}
          >
            {sending ? '⟳ SENDING...' : '▶ SEND TO DISPLAY'}
          </button>

          {/* Purim Presets */}
          <section className="panel">
            <h2 className="panel-title">
              <span className="panel-icon">🎭</span>
              PURIM PRESETS
            </h2>
            <div className="preset-grid">
              {PURIM_PRESETS.map((preset, i) => (
                <button
                  key={i}
                  className="preset-button"
                  onClick={() => loadPreset(preset)}
                  title={preset.text}
                >
                  <span className="preset-number">{i + 1}</span>
                  <span className="preset-name">{preset.name}</span>
                </button>
              ))}
            </div>
            <button
              className="button button-purple full-width mt-12"
              onClick={loadAllPresets}
              disabled={!connected || sending}
            >
              ⬇ LOAD ALL TO SLOTS 1-10
            </button>
          </section>

          {/* Debug Log */}
          <section className="panel flex-1 min-h-200">
            <h2 className="panel-title">
              <span className="panel-icon">⌘</span>
              DEBUG LOG
            </h2>
            <div className="log-container" ref={logRef}>
              {logs.map((logEntry, i) => (
                <div
                  key={i}
                  className="log-entry"
                  style={{
                    color: logEntry.type === 'error' ? '#ff4466' :
                           logEntry.type === 'success' ? 'var(--accent-green)' :
                           logEntry.type === 'warning' ? 'var(--accent-yellow)' :
                           logEntry.type === 'tx' ? 'var(--accent-cyan)' :
                           logEntry.type === 'notify' ? 'var(--accent-magenta)' :
                           'var(--text-secondary)',
                  }}
                >
                  <span className="log-time">{logEntry.timestamp}</span>
                  <span className="log-msg">{logEntry.msg}</span>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="log-empty">No logs yet. Connect to a device to begin.</div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <span>Protocol: pypixelcolor (MIT) • ha-ipixel-color • go-ipxl</span>
        <span>Chrome/Edge only • HTTPS required</span>
      </footer>
    </div>
  );
}
