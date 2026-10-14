import { GPSCoordinate, SerialLogMessage } from '../types/gps';
import { validateGPS, formatTimestamp } from '../utils/geoUtils';

export interface SerialErrorDiagnostic {
  type: 'iframe_policy' | 'already_open' | 'cancelled' | 'driver_or_permission' | 'unsupported' | 'unknown';
  message: string;
  suggestion: string;
}

export class WebSerialManager {
  private port: any = null;
  private reader: any = null;
  private keepReading = false;
  private buffer = '';
  private currentBaudRate: number = 115200;

  private onGpsReceived: ((coord: GPSCoordinate) => void) | null = null;
  private onLog: ((log: SerialLogMessage) => void) | null = null;
  private onStateChange: ((isConnected: boolean, error?: string, diagnostic?: SerialErrorDiagnostic) => void) | null = null;

  public static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public static isInsideIframe(): boolean {
    try {
      return typeof window !== 'undefined' && window.self !== window.top;
    } catch (e) {
      return true;
    }
  }

  constructor(
    onGpsReceived: (coord: GPSCoordinate) => void,
    onLog: (log: SerialLogMessage) => void,
    onStateChange: (isConnected: boolean, error?: string, diagnostic?: SerialErrorDiagnostic) => void
  ) {
    this.onGpsReceived = onGpsReceived;
    this.onLog = onLog;
    this.onStateChange = onStateChange;

    if (typeof navigator !== 'undefined' && 'serial' in navigator) {
      (navigator as any).serial.addEventListener('connect', (event: any) => {
        this.emitLog('info', '🔌 USB Serial device detected! Automatically connecting...');
        this.autoConnect(this.currentBaudRate);
      });

      (navigator as any).serial.addEventListener('disconnect', (event: any) => {
        if (event.port === this.port) {
          this.emitLog('warn', 'USB Device was unplugged / disconnected.');
          this.disconnect();
        }
      });
    }
  }

  private emitLog(type: SerialLogMessage['type'], message: string) {
    if (this.onLog) {
      this.onLog({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        type,
        message,
      });
    }
  }

  /**
   * Automatically connect to previously authorized USB port without showing permission dialog
   */
  public async autoConnect(baudRate: number = 115200): Promise<boolean> {
    if (!WebSerialManager.isSupported()) return false;
    this.currentBaudRate = baudRate;
    try {
      const serial = (navigator as any).serial;
      const ports = await serial.getPorts();
      if (ports && ports.length > 0) {
        this.emitLog('info', `Found authorized ESP8266 USB port. Auto-connecting at ${baudRate} baud...`);
        this.port = ports[0];
        await this.port.open({
          baudRate,
          dataBits: 8,
          stopBits: 1,
          parity: 'none',
          bufferSize: 16384,
          flowControl: 'none',
        });

        try {
          await this.port.setSignals({ dataTerminalReady: false, requestToSend: false });
        } catch {}

        this.keepReading = true;
        if (this.onStateChange) this.onStateChange(true);
        this.emitLog('info', `✅ ESP8266 automatically connected at ${baudRate} baud.`);
        this.startReadLoop();
        return true;
      }
    } catch (e: any) {
      console.debug('Auto-connect attempt not ready or already open:', e);
    }
    return false;
  }

  /**
   * List any serial devices already paired with this origin
   */
  public async getPairedPorts(): Promise<any[]> {
    if (!WebSerialManager.isSupported()) return [];
    try {
      return await (navigator as any).serial.getPorts();
    } catch {
      return [];
    }
  }

  public async connect(baudRate: number = 115200): Promise<boolean> {
    this.currentBaudRate = baudRate;

    if (!WebSerialManager.isSupported()) {
      const diag: SerialErrorDiagnostic = {
        type: 'unsupported',
        message: 'Web Serial API is not supported in this browser.',
        suggestion: 'Please open this website in Google Chrome, Microsoft Edge, or Opera on desktop (Windows, Mac, or Linux).',
      };
      this.emitLog('error', diag.message);
      if (this.onStateChange) this.onStateChange(false, diag.message, diag);
      return false;
    }

    try {
      this.emitLog('info', `Requesting USB Serial port permission (Target Baud: ${baudRate})...`);
      const serial = (navigator as any).serial;

      // Check if we already have an authorized port
      const existingPorts = await serial.getPorts();
      let selectedPort: any = null;

      if (existingPorts.length > 0) {
        this.emitLog('info', `Found authorized USB device. Connecting directly at ${baudRate} baud...`);
        try {
          selectedPort = existingPorts[0];
          await selectedPort.open({
            baudRate,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            bufferSize: 16384,
            flowControl: 'none',
          });
          this.port = selectedPort;
        } catch (reuseErr) {
          this.emitLog('info', 'Opening port picker to confirm device...');
          selectedPort = await serial.requestPort();
          this.port = selectedPort;
          await this.port.open({
            baudRate,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            bufferSize: 16384,
            flowControl: 'none',
          });
        }
      } else {
        selectedPort = await serial.requestPort();
        this.port = selectedPort;
        await this.port.open({
          baudRate,
          dataBits: 8,
          stopBits: 1,
          parity: 'none',
          bufferSize: 16384,
          flowControl: 'none',
        });
      }

      // ESP8266 NodeMCU Signal Configuration:
      // NodeMCU auto-reset circuit triggers when DTR and RTS are in certain states.
      // Setting DTR: false, RTS: false ensures the ESP8266 is released from RESET and runs normally.
      try {
        await this.port.setSignals({ dataTerminalReady: false, requestToSend: false });
        this.emitLog('info', 'ESP8266 DTR/RTS signals released (Normal run mode).');
      } catch (signalErr) {
        // Some USB drivers do not implement setSignals, ignore gracefully
      }

      this.keepReading = true;
      if (this.onStateChange) this.onStateChange(true);
      this.emitLog(
        'info',
        `✅ ESP8266 USB Serial connected at ${baudRate} baud. Listening for GPS JSON stream {"lat":...,"lng":...}`
      );

      // Start asynchronous read loop
      this.startReadLoop();
      return true;
    } catch (err: any) {
      const diag = this.diagnoseError(err);
      this.emitLog('error', `Connection error: ${diag.message}`);
      this.emitLog('warn', `💡 Suggestion: ${diag.suggestion}`);
      if (this.onStateChange) this.onStateChange(false, diag.message, diag);
      return false;
    }
  }

  private diagnoseError(err: any): SerialErrorDiagnostic {
    const name = err?.name || '';
    const message = err?.message || String(err);

    if (name === 'SecurityError' || message.includes('Permissions-Policy') || message.includes('disallowed')) {
      return {
        type: 'iframe_policy',
        message: 'Browser blocked USB access inside the preview iframe.',
        suggestion: 'Click the "Open in Dedicated Window" button at the top to access USB Serial directly without iframe restrictions.',
      };
    }

    if (name === 'NotFoundError') {
      return {
        type: 'cancelled',
        message: 'No USB serial device selected.',
        suggestion: 'Ensure your ESP8266 NodeMCU is firmly plugged in via micro-USB, click Connect again, and click on your device (e.g. "USB-Serial", "CH340", or "CP2102") in the browser dialog.',
      };
    }

    if (name === 'InvalidStateError' || message.includes('already open') || message.includes('Failed to open serial port')) {
      return {
        type: 'already_open',
        message: 'The serial port is currently in use or already open.',
        suggestion: 'Close the Arduino IDE Serial Monitor, Cura, PuTTY, or any other browser tab using this port, then try again.',
      };
    }

    if (name === 'NetworkError' || message.includes('device') || message.includes('denied')) {
      return {
        type: 'driver_or_permission',
        message: `USB device access denied: ${message}`,
        suggestion: 'On Windows/Mac, verify that CH340 or CP2102 drivers are installed. On Linux, ensure your user is in the "dialout" group (sudo usermod -a -G dialout $USER).',
      };
    }

    return {
      type: 'unknown',
      message: message || 'Failed to connect to USB device.',
      suggestion: 'Check that the USB cable supports data (not a charge-only cable) and that the ESP8266 power LED is lit.',
    };
  }

  /**
   * Reset the ESP8266 via DTR/RTS hardware toggle
   */
  public async pulseEspReset(): Promise<boolean> {
    if (!this.port) return false;
    try {
      this.emitLog('warn', 'Sending hardware RESET pulse to ESP8266 NodeMCU...');
      // Pull RTS active to ground reset pin
      await this.port.setSignals({ requestToSend: true, dataTerminalReady: false });
      await new Promise((resolve) => setTimeout(resolve, 200));
      // Release reset pin
      await this.port.setSignals({ requestToSend: false, dataTerminalReady: false });
      this.emitLog('info', 'ESP8266 reboot pulse sent. Waiting for firmware boot...');
      return true;
    } catch (e: any) {
      this.emitLog('error', `Failed to toggle hardware signals: ${e.message}`);
      return false;
    }
  }

  private async startReadLoop() {
    if (!this.port || !this.port.readable) return;

    // Use TextDecoder with direct reader to avoid lock leaks associated with TextDecoderStream
    const decoder = new TextDecoder('utf-8', { fatal: false });

    try {
      this.reader = this.port.readable.getReader();

      while (this.keepReading) {
        const { value, done } = await this.reader.read();
        if (done) {
          break;
        }
        if (value) {
          const text = decoder.decode(value, { stream: true });
          this.processIncomingChunk(text);
        }
      }
    } catch (err: any) {
      if (this.keepReading) {
        this.emitLog('error', `Serial read error: ${err?.message || err}`);
      }
    } finally {
      if (this.reader) {
        try {
          await this.reader.cancel();
        } catch {}
        try {
          this.reader.releaseLock();
        } catch {}
        this.reader = null;
      }
    }
  }

  public processIncomingChunk(chunk: string) {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      // Remove any control characters or null bytes from hardware boot noise
      const line = rawLine.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '').trim();
      if (!line) continue;

      this.emitLog('rx', line);
      this.parseLine(line, 'hardware');
    }
  }

  public parseLine(line: string, source: 'hardware' | 'test' = 'hardware'): boolean {
    const jsonMatch = line.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return false;
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);

      const latVal = parsed.lat ?? parsed.latitude;
      const lngVal = parsed.lng ?? parsed.longitude ?? parsed.lon;

      if (latVal === undefined || lngVal === undefined) {
        this.emitLog('gps_invalid', `JSON packet missing lat/lng: ${line}`);
        return false;
      }

      const validation = validateGPS(latVal, lngVal);
      if (!validation.valid || validation.lat === undefined || validation.lng === undefined) {
        this.emitLog('gps_invalid', `GPS validation failed: ${validation.error || 'Invalid bounds'} (${line})`);
        return false;
      }

      const now = Date.now();
      const coord: GPSCoordinate = {
        lat: validation.lat,
        lng: validation.lng,
        timestamp: now,
        formattedTime: formatTimestamp(now),
        source,
        rawJson: jsonMatch[0],
        altitude: typeof parsed.alt === 'number' ? parsed.alt : undefined,
        satellites: typeof parsed.sats === 'number' ? parsed.sats : undefined,
      };

      this.emitLog('gps_valid', `VALID GPS [${source.toUpperCase()}]: lat=${coord.lat.toFixed(6)}, lng=${coord.lng.toFixed(6)}`);

      if (this.onGpsReceived) {
        this.onGpsReceived(coord);
      }
      return true;
    } catch {
      this.emitLog('error', `Failed to parse serial JSON line: ${line}`);
      return false;
    }
  }

  public async disconnect() {
    this.keepReading = false;

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {}
      try {
        this.reader.releaseLock();
      } catch {}
      this.reader = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch (err: any) {
        console.warn('Error during serial port close:', err);
      }
      this.port = null;
    }

    this.buffer = '';
    if (this.onStateChange) this.onStateChange(false);
    this.emitLog('info', 'Serial port closed and disconnected cleanly.');
  }
}
