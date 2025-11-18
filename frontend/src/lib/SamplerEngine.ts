/**
 * SamplerEngine - Core audio processing engine for the sampler
 * Can work independently without a GUI (headless mode)
 */

export interface Pad {
  index: number;
  buffer: AudioBuffer | null;
  name: string;
  loaded: boolean;
  trimStart: number;
  trimEnd: number;
  gain: number;
}

export class SamplerEngine {
  private ctx: AudioContext;
  private pads: Pad[];
  private maxPads: number = 16;

  constructor(audioContext: AudioContext) {
    this.ctx = audioContext;
    this.pads = [];
    this.initializePads();
  }

  /**
   * Initialize empty pads
   */
  private initializePads(): void {
    for (let i = 0; i < this.maxPads; i++) {
      this.pads.push({
        index: i,
        buffer: null,
        name: `Pad ${i + 1}`,
        loaded: false,
        trimStart: 0,
        trimEnd: 1,
        gain: 1.0,
      });
    }
  }

  /**
   * Load a sound into a specific pad
   */
  async loadSound(
    padIndex: number,
    audioData: ArrayBuffer,
    name: string | null = null,
    progressCallback: ((progress: number) => void) | null = null
  ): Promise<Pad> {
    if (padIndex < 0 || padIndex >= this.maxPads) {
      throw new Error(`Invalid pad index: ${padIndex}`);
    }

    try {
      const buffer = await this.ctx.decodeAudioData(audioData);

      const pad = this.pads[padIndex];
      pad.buffer = buffer;
      pad.name = name || `Pad ${padIndex + 1}`;
      pad.loaded = true;
      pad.trimEnd = buffer.duration;

      if (progressCallback) {
        progressCallback(100);
      }

      return pad;
    } catch (error) {
      console.error(`Error decoding audio for pad ${padIndex}:`, error);
      throw error;
    }
  }

  /**
   * Load a sound from URL
   */
  async loadSoundFromURL(
    padIndex: number,
    url: string,
    progressCallback: ((progress: number) => void) | null = null
  ): Promise<Pad> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch sound from ${url}: ${response.status} ${response.statusText}`
      );
    }

    const contentLength = response.headers.get("content-length");
    let receivedLength = 0;
    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      receivedLength += value.length;

      if (progressCallback && contentLength) {
        const progress = (receivedLength / parseInt(contentLength)) * 100;
        progressCallback(progress);
      }
    }

    const chunksAll = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
      chunksAll.set(chunk, position);
      position += chunk.length;
    }

    const fileName =
      url
        .split("/")
        .pop()
        ?.replace(/\.[^/.]+$/, "") || "sound";
    return await this.loadSound(
      padIndex,
      chunksAll.buffer,
      fileName,
      progressCallback
    );
  }

  /**
   * Play a pad
   */
  play(padIndex: number): void {
    if (padIndex < 0 || padIndex >= this.maxPads) {
      console.warn(`Invalid pad index: ${padIndex}`);
      return;
    }

    const pad = this.pads[padIndex];

    if (!pad.loaded || !pad.buffer) {
      console.warn(`Pad ${padIndex} is not loaded`);
      return;
    }

    this._playBuffer(pad.buffer, pad.trimStart, pad.trimEnd, pad.gain);
  }

  /**
   * Internal method to play a buffer
   */
  private _playBuffer(
    buffer: AudioBuffer,
    startTime: number,
    endTime: number,
    gain: number = 1.0
  ): void {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = gain;

    source.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    startTime = Math.max(0, Math.min(startTime, buffer.duration));
    endTime = Math.max(startTime, Math.min(endTime, buffer.duration));

    source.start(0, startTime, endTime - startTime);
  }

  /**
   * Set trim points for a pad
   */
  setTrimPoints(padIndex: number, startTime: number, endTime: number): void {
    if (padIndex < 0 || padIndex >= this.maxPads) return;

    const pad = this.pads[padIndex];
    if (!pad.loaded || !pad.buffer) return;

    pad.trimStart = Math.max(0, startTime);
    pad.trimEnd = Math.min(pad.buffer.duration, endTime);
  }

  /**
   * Get pad data
   */
  getPad(padIndex: number): Pad | null {
    if (padIndex < 0 || padIndex >= this.maxPads) return null;
    return this.pads[padIndex];
  }

  /**
   * Get all pads
   */
  getAllPads(): Pad[] {
    return this.pads;
  }

  /**
   * Reset a pad
   */
  resetPad(padIndex: number): void {
    if (padIndex < 0 || padIndex >= this.maxPads) return;

    const pad = this.pads[padIndex];
    if (pad.loaded && pad.buffer) {
      pad.trimStart = 0;
      pad.trimEnd = pad.buffer.duration;
    }
  }

  /**
   * Clear all pads
   */
  clearAll(): void {
    this.pads.forEach((pad) => {
      pad.buffer = null;
      pad.loaded = false;
      pad.trimStart = 0;
      pad.trimEnd = 1;
    });
  }
}

export default SamplerEngine;
