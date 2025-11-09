/**
 * SamplerEngine - Core audio processing engine for the sampler
 * Can work independently without a GUI (headless mode)
 */
export default class SamplerEngine {
  constructor(audioContext) {
    this.ctx = audioContext;
    this.pads = []; // Array of pad objects
    this.maxPads = 16; // 4x4 grid
    this.initializePads();
  }

  /**
   * Initialize empty pads
   */
  initializePads() {
    for (let i = 0; i < this.maxPads; i++) {
      this.pads.push({
        index: i,
        buffer: null,
        name: `Pad ${i + 1}`,
        loaded: false,
        trimStart: 0,
        trimEnd: 1, // Normalized 0-1
        gain: 1.0,
      });
    }
  }

  /**
   * Load a sound into a specific pad
   * @param {number} padIndex - Index of the pad
   * @param {ArrayBuffer} audioData - Raw audio data
   * @param {string} name - Name for the sample
   * @param {Function} progressCallback - Optional progress callback
   */
  async loadSound(padIndex, audioData, name = null, progressCallback = null) {
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
   * @param {number} padIndex - Index of the pad
   * @param {string} url - URL of the sound file
   * @param {Function} progressCallback - Optional progress callback
   */
  async loadSoundFromURL(padIndex, url, progressCallback = null) {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch sound from ${url}: ${response.status} ${response.statusText}`
      );
    }

    // Track download progress
    const contentLength = response.headers.get("content-length");
    let receivedLength = 0;
    const reader = response.body.getReader();
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      receivedLength += value.length;

      if (progressCallback && contentLength) {
        const progress = (receivedLength / contentLength) * 100;
        progressCallback(progress);
      }
    }

    // Combine chunks
    const chunksAll = new Uint8Array(receivedLength);
    let position = 0;
    for (let chunk of chunks) {
      chunksAll.set(chunk, position);
      position += chunk.length;
    }

    const fileName = url
      .split("/")
      .pop()
      .replace(/\.[^/.]+$/, "");
    return await this.loadSound(
      padIndex,
      chunksAll.buffer,
      fileName,
      progressCallback
    );
  }

  /**
   * Play a pad
   * @param {number} padIndex - Index of the pad to play
   */
  play(padIndex) {
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
   * @private
   */
  _playBuffer(buffer, startTime, endTime, gain = 1.0) {
    // Create buffer source
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    // Create gain node
    const gainNode = this.ctx.createGain();
    gainNode.gain.value = gain;

    // Connect: source -> gain -> destination
    source.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    // Ensure valid times
    startTime = Math.max(0, Math.min(startTime, buffer.duration));
    endTime = Math.max(startTime, Math.min(endTime, buffer.duration));

    // Play
    source.start(0, startTime, endTime - startTime);
  }

  /**
   * Set trim points for a pad (in seconds)
   */
  setTrimPoints(padIndex, startTime, endTime) {
    if (padIndex < 0 || padIndex >= this.maxPads) return;

    const pad = this.pads[padIndex];
    if (!pad.loaded) return;

    pad.trimStart = Math.max(0, startTime);
    pad.trimEnd = Math.min(pad.buffer.duration, endTime);
  }

  /**
   * Get pad data
   */
  getPad(padIndex) {
    if (padIndex < 0 || padIndex >= this.maxPads) return null;
    return this.pads[padIndex];
  }

  /**
   * Get all pads
   */
  getAllPads() {
    return this.pads;
  }

  /**
   * Reset a pad
   */
  resetPad(padIndex) {
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
  clearAll() {
    this.pads.forEach((pad) => {
      pad.buffer = null;
      pad.loaded = false;
      pad.trimStart = 0;
      pad.trimEnd = 1;
    });
  }
}
