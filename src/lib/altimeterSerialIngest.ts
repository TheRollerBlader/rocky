/**
 * Web Serial API Ingest Client for Rocky 1 Altimeter & Avionics Telemetry.
 * Connects directly to flight computers (Altus Metrum, PerfectFlite, ESP32 UART)
 * via browser USB/Serial to stream real-time sensor packets.
 */

export type FlightPhase =
  | 'PAD_IDLE'
  | 'POWERED_FLIGHT'
  | 'COASTING'
  | 'APOGEE'
  | 'DROGUE_DESCENT'
  | 'MAIN_DESCENT'
  | 'LANDED';

export interface TelemetryFrame {
  timestampS: number;
  pressureHpa: number;
  altitudeM: number;
  verticalVelocityMps: number;
  verticalAccelG: number;
  batteryVoltageV: number;
  temperatureC: number;
  phase: FlightPhase;
  rawSentence: string;
}

export interface SerialConnectionStatus {
  connected: boolean;
  portName?: string;
  baudRate: number;
  error?: string;
}

export type TelemetryListener = (frame: TelemetryFrame) => void;
export type StatusListener = (status: SerialConnectionStatus) => void;

export class AltimeterSerialIngest {
  private port: any = null;
  private reader: any = null;
  private isReading = false;
  private buffer = '';
  private baudRate: number;
  private groundElevationM: number;
  private seaLevelHpa: number;
  private lastTimeS: number | null = null;
  private lastAltitudeM: number | null = null;
  private maxAltitudeM = 0;
  private currentPhase: FlightPhase = 'PAD_IDLE';

  private telemetryListeners: Set<TelemetryListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();

  constructor(baudRate = 115200, groundElevationM = 0, seaLevelHpa = 1013.25) {
    self.crypto; // ensure web API environment
    this.baudRate = baudRate;
    this.groundElevationM = groundElevationM;
    this.seaLevelHpa = seaLevelHpa;
  }

  public subscribe(onPacket: TelemetryListener): () => void {
    this.telemetryListeners.add(onPacket);
    return () => this.telemetryListeners.delete(onPacket);
  }

  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private notifyStatus(status: SerialConnectionStatus) {
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }

  public async requestAndConnect(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serial' in navigator)) {
      this.notifyStatus({
        connected: false,
        baudRate: this.baudRate,
        error: 'Web Serial API is not supported in this browser. Please use Chrome/Edge or enable Web Serial.',
      });
      return false;
    }

    try {
      // @ts-expect-error Web Serial navigator API
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: this.baudRate });
      this.isReading = true;

      this.notifyStatus({
        connected: true,
        baudRate: this.baudRate,
      });

      this.startReadLoop();
      return true;
    } catch (err: any) {
      this.notifyStatus({
        connected: false,
        baudRate: this.baudRate,
        error: err?.message || 'Failed to connect to serial port',
      });
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    this.isReading = false;
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader.releaseLock();
        this.reader = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch {
      // Ignore teardown errors
    } finally {
      this.notifyStatus({
        connected: false,
        baudRate: this.baudRate,
      });
    }
  }

  private async startReadLoop(): Promise<void> {
    const textDecoder = new TextDecoderStream();
    if (!this.port?.readable) return;

    const readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
    this.reader = textDecoder.readable.getReader();

    try {
      while (this.isReading) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          this.processIncomingChunk(value);
        }
      }
    } catch (err) {
      if (this.isReading) {
        this.notifyStatus({
          connected: false,
          baudRate: this.baudRate,
          error: String(err),
        });
      }
    } finally {
      try {
        await readableStreamClosed.catch(() => {});
      } catch {
        // stream closed
      }
    }
  }

  public processIncomingChunk(chunk: string): TelemetryFrame[] {
    this.buffer += chunk;
    const frames: TelemetryFrame[] = [];

    while (this.buffer.includes('\n')) {
      const splitIdx = this.buffer.indexOf('\n');
      const line = this.buffer.slice(0, splitIdx).replace(/\r$/, '').trim();
      this.buffer = this.buffer.slice(splitIdx + 1);

      if (line) {
        const frame = this.parseSentence(line);
        if (frame) {
          frames.push(frame);
          for (const listener of this.telemetryListeners) {
            listener(frame);
          }
        }
      }
    }

    return frames;
  }

  public parseSentence(sentence: string): TelemetryFrame | null {
    if (!sentence.startsWith('$ROCKY,')) return null;

    let body = sentence.slice(1);
    if (sentence.includes('*')) {
      const [payload, checksum] = sentence.slice(1).split('*');
      if (this.computeXorChecksum(payload) !== checksum.toUpperCase()) {
        return null; // Corrupted checksum
      }
      body = payload;
    }

    const tokens = body.split(',');
    if (tokens.length < 6) return null;

    const timeS = parseFloat(tokens[1]);
    const pressHpa = parseFloat(tokens[2]);
    const accelG = parseFloat(tokens[3]);
    const battV = parseFloat(tokens[4]);
    const tempC = parseFloat(tokens[5]);

    if ([timeS, pressHpa, accelG, battV, tempC].some(isNaN)) return null;

    // ISA pressure altitude
    const rawAlt = 44330.0 * (1.0 - Math.pow(pressHpa / this.seaLevelHpa, 1.0 / 5.2558));
    const altM = Math.max(0, rawAlt - this.groundElevationM);

    let velocityMps = 0;
    if (this.lastTimeS !== null && this.lastAltitudeM !== null) {
      const dt = timeS - this.lastTimeS;
      if (dt > 0.001) {
        velocityMps = (altM - this.lastAltitudeM) / dt;
      }
    }

    this.lastTimeS = timeS;
    this.lastAltitudeM = altM;

    if (altM > this.maxAltitudeM) {
      this.maxAltitudeM = altM;
    }

    this.currentPhase = this.evaluatePhase(altM, velocityMps, accelG);

    return {
      timestampS: Math.round(timeS * 1000) / 1000,
      pressureHpa: Math.round(pressHpa * 100) / 100,
      altitudeM: Math.round(altM * 100) / 100,
      verticalVelocityMps: Math.round(velocityMps * 100) / 100,
      verticalAccelG: Math.round(accelG * 100) / 100,
      batteryVoltageV: Math.round(battV * 100) / 100,
      temperatureC: Math.round(tempC * 10) / 10,
      phase: this.currentPhase,
      rawSentence: sentence,
    };
  }

  private computeXorChecksum(sentence: string): string {
    let ck = 0;
    for (let i = 0; i < sentence.length; i++) {
      ck ^= sentence.charCodeAt(i);
    }
    return ck.toString(16).toUpperCase().padStart(2, '0');
  }

  private evaluatePhase(altitudeM: number, velocityMps: number, accelG: number): FlightPhase {
    if (this.currentPhase === 'PAD_IDLE') {
      if (accelG > 2.0 || altitudeM > 5.0) return 'POWERED_FLIGHT';
      return 'PAD_IDLE';
    }
    if (this.currentPhase === 'POWERED_FLIGHT') {
      if (accelG < 0.2 && velocityMps > 5.0) return 'COASTING';
      if (velocityMps <= 0.0 && altitudeM > 20.0) return 'APOGEE';
      return 'POWERED_FLIGHT';
    }
    if (this.currentPhase === 'COASTING') {
      if (velocityMps <= 0.5 || this.maxAltitudeM - altitudeM > 2.0) return 'APOGEE';
      return 'COASTING';
    }
    if (this.currentPhase === 'APOGEE') {
      return 'DROGUE_DESCENT';
    }
    if (this.currentPhase === 'DROGUE_DESCENT') {
      if (altitudeM <= 120.0 && altitudeM > 3.0) return 'MAIN_DESCENT';
      if (altitudeM <= 2.0 && Math.abs(velocityMps) < 1.0) return 'LANDED';
      return 'DROGUE_DESCENT';
    }
    if (this.currentPhase === 'MAIN_DESCENT') {
      if (altitudeM <= 3.0 && Math.abs(velocityMps) < 1.5) return 'LANDED';
      return 'MAIN_DESCENT';
    }
    return this.currentPhase;
  }
}
