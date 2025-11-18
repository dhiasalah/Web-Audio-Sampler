"use client";

import { useEffect, useRef, useState } from "react";
import SamplerEngine from "@/lib/SamplerEngine";
import WaveformDrawer from "@/lib/WaveformDrawer";
import TrimbarsDrawer from "@/lib/TrimbarsDrawer";
import { pixelToSeconds } from "@/lib/utils";
import { getPresets, type Preset } from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface PromiseResult {
  success: boolean;
  index: number;
  error?: Error;
}

export default function SamplerApp() {
  const [engine, setEngine] = useState<SamplerEngine | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [statusText, setStatusText] = useState("Initializing...");
  const [statusClass, setStatusClass] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const [selectedPadIndex, setSelectedPadIndex] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [loadingBtn, setLoadingBtn] = useState(false);
  const [showWaveform, setShowWaveform] = useState(false);

  const padsGridRef = useRef<HTMLDivElement>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const padButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const waveformDrawerRef = useRef<WaveformDrawer | null>(null);
  const trimbarsDrawerRef = useRef<TrimbarsDrawer | null>(null);

  const updateTrimBarsFromPadRef = useRef<() => void>(() => {});
  const startAnimationLoopRef = useRef<() => void>(() => {});
  const selectPadRef = useRef<(padIndex: number) => void>(() => {});

  // Initialize audio context and engine
  useEffect(() => {
    const audioCtx = new AudioContext();
    const sampler = new SamplerEngine(audioCtx);
    setEngine(sampler);

    // Load demo preset
    const loadDemoPreset = () => {
      const demoPresets: Preset[] = [
        {
          name: "Demo Drums",
          files: [
            "https://upload.wikimedia.org/wikipedia/commons/a/a3/Hardstyle_kick.wav",
            "https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c7/Redoblante_de_marcha.ogg/Redoblante_de_marcha.ogg.mp3",
            "https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c9/Hi-Hat_Cerrado.ogg/Hi-Hat_Cerrado.ogg.mp3",
            "https://upload.wikimedia.org/wikipedia/commons/transcoded/0/07/Hi-Hat_Abierto.ogg/Hi-Hat_Abierto.ogg.mp3",
            "https://upload.wikimedia.org/wikipedia/commons/transcoded/3/3c/Tom_Agudo.ogg/Tom_Agudo.ogg.mp3",
            "https://upload.wikimedia.org/wikipedia/commons/transcoded/a/a4/Tom_Medio.ogg/Tom_Medio.ogg.mp3",
            "https://upload.wikimedia.org/wikipedia/commons/transcoded/8/8d/Tom_Grave.ogg/Tom_Grave.ogg.mp3",
            "https://upload.wikimedia.org/wikipedia/commons/transcoded/6/68/Crash.ogg/Crash.ogg.mp3",
            "https://upload.wikimedia.org/wikipedia/commons/transcoded/2/24/Ride.ogg/Ride.ogg.mp3",
          ],
        },
      ];

      setPresets(demoPresets);
    };

    // Load presets from server
    const loadPresetsFromServer = async () => {
      try {
        setStatusText("Connecting to server...");
        setStatusClass("");

        const data = await getPresets();

        if (!Array.isArray(data) || data.length === 0) {
          throw new Error("No presets found on server");
        }

        setPresets(data);
        setStatusText(`✓ Found ${data.length} preset(s) - Ready!`);
        setStatusClass("success");
      } catch (error) {
        console.error("Error loading presets:", error);
        setStatusText("⚠ Server not available - Using demo mode");
        setStatusClass("error");
        loadDemoPreset();
      }
    };

    // Create pad buttons
    const createPadButtons = () => {
      const keyboardShortcuts = [
        "A",
        "B",
        "C",
        "D",
        "E",
        "F",
        "G",
        "H",
        "I",
        "J",
        "K",
        "L",
        "M",
        "N",
        "O",
        "P",
      ];

      const padIndices = [];
      for (let row = 3; row >= 0; row--) {
        for (let col = 0; col < 4; col++) {
          padIndices.push(row * 4 + col);
        }
      }

      if (!padsGridRef.current) return;

      padsGridRef.current.innerHTML = "";
      padButtonsRef.current = [];

      padIndices.forEach((padIndex) => {
        const button = document.createElement("button");
        button.className = "pad";
        button.disabled = true;
        const shortcut = keyboardShortcuts[padIndex] || "";
        button.innerHTML = `
          <span class="pad-name">Empty</span>
          <span class="pad-shortcut">${shortcut}</span>
          <div class="pad-progress"></div>
        `;

        button.onclick = () => selectPadRef.current(padIndex);

        padButtonsRef.current[padIndex] = button;
        padsGridRef.current!.appendChild(button);
      });
    };

    const initializeApp = async () => {
      createPadButtons();
      await loadPresetsFromServer();
    };

    initializeApp();
  }, []);

  // Load preset sounds
  const loadPresetSounds = async () => {
    if (!engine || selectedPreset === "") return;

    const presetIndex = parseInt(selectedPreset);
    const preset = presets[presetIndex];

    try {
      setStatusText(`Loading preset: ${preset.name}...`);
      setStatusClass("");
      setLoadingBtn(true);
      setProgress(0);

      let soundURLs: string[] = [];
      let soundNames: string[] = [];

      if (preset.samples && Array.isArray(preset.samples)) {
        soundURLs = preset.samples.map((sample) => {
          if (sample.url.startsWith("http")) {
            return sample.url;
          } else {
            const cleanPath = sample.url.startsWith("./")
              ? sample.url.substring(2)
              : sample.url;
            return `${API_BASE_URL}/presets/${cleanPath}`;
          }
        });
        soundNames = preset.samples.map((sample) => sample.name);
      } else if (preset.files && Array.isArray(preset.files)) {
        if (typeof preset.files[0] === "string") {
          soundURLs = preset.files.map((file) => {
            if (file.startsWith("http")) {
              return file;
            } else {
              return `${API_BASE_URL}/sounds/${file}`;
            }
          });
        }
      }

      if (soundURLs.length === 0) {
        throw new Error("No sound files found in preset");
      }

      soundURLs = soundURLs.slice(0, 16);
      soundNames = soundNames.slice(0, 16);

      let loadedCount = 0;
      const totalSounds = soundURLs.length;

      const loadPromises = soundURLs.map(async (url, index) => {
        try {
          updatePadButton(index, "loading", 0);

          const soundName = soundNames[index] || `Sound ${index + 1}`;
          await engine.loadSoundFromURL(index, url, (prog) => {
            updatePadButton(index, "loading", prog);
          });

          const pad = engine.getPad(index);
          if (pad) {
            pad.name = soundName;
          }

          updatePadButton(index, "loaded");
          loadedCount++;

          const overallProgress = (loadedCount / totalSounds) * 100;
          setProgress(Math.round(overallProgress));

          return { success: true, index } as PromiseResult;
        } catch (error) {
          console.error(`Failed to load sound ${index}:`, error);
          updatePadButton(index, "error");
          return {
            success: false,
            index,
            error: error instanceof Error ? error : new Error(String(error)),
          } as PromiseResult;
        }
      });

      const results = await Promise.allSettled(loadPromises);

      const successCount = results.filter(
        (r) => r.status === "fulfilled" && (r.value as PromiseResult).success
      ).length;

      setProgress(0);

      if (successCount === 0) {
        throw new Error("Failed to load any sounds");
      }

      setStatusText(`✓ Loaded ${successCount}/${totalSounds} sounds`);
      setStatusClass("success");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Error loading preset sounds:", error);
      setStatusText(`✗ Error: ${errorMsg}`);
      setStatusClass("error");
    } finally {
      setLoadingBtn(false);
    }
  };

  // Update pad button UI
  const updatePadButton = (
    padIndex: number,
    state: string,
    prog: number = 0
  ) => {
    const button = padButtonsRef.current[padIndex];
    if (!button) return;

    const nameSpan = button.querySelector(".pad-name") as HTMLElement;
    const progressBar = button.querySelector(".pad-progress") as HTMLElement;
    const pad = engine?.getPad(padIndex);

    button.classList.remove("loading", "error");

    switch (state) {
      case "loading":
        button.classList.add("loading");
        button.disabled = true;
        nameSpan.textContent = "Loading...";
        progressBar.style.setProperty("--progress", `${prog}%`);
        break;

      case "loaded":
        button.disabled = false;
        nameSpan.textContent = pad?.name || "Sound";
        progressBar.style.setProperty("--progress", "100%");
        setTimeout(() => {
          progressBar.style.setProperty("--progress", "0%");
        }, 500);
        break;

      case "error":
        button.classList.add("error");
        button.disabled = true;
        nameSpan.textContent = "Error";
        progressBar.style.setProperty("--progress", "0%");
        break;

      case "empty":
        button.disabled = true;
        nameSpan.textContent = "Empty";
        progressBar.style.setProperty("--progress", "0%");
        break;
    }
  };

  // Select pad and show waveform
  selectPadRef.current = (padIndex: number) => {
    if (!engine) return;

    setSelectedPadIndex(padIndex);
    const pad = engine.getPad(padIndex);

    padButtonsRef.current.forEach((btn, idx) => {
      if (btn) {
        if (idx === padIndex) {
          btn.classList.add("selected");
        } else {
          btn.classList.remove("selected");
        }
      }
    });

    // Show waveform if pad is loaded
    if (pad && pad.loaded) {
      setShowWaveform(true);

      // Wait for state to update and DOM to render the canvases
      setTimeout(() => {
        if (!waveformCanvasRef.current || !overlayCanvasRef.current) return;

        if (!waveformDrawerRef.current) {
          waveformDrawerRef.current = new WaveformDrawer();
        }

        waveformDrawerRef.current.init(
          pad.buffer!,
          waveformCanvasRef.current,
          "#667eea"
        );
        waveformDrawerRef.current.drawWave(0, waveformCanvasRef.current.height);

        overlayCanvasRef.current.width = waveformCanvasRef.current.width;
        overlayCanvasRef.current.height = waveformCanvasRef.current.height;

        if (!trimbarsDrawerRef.current) {
          trimbarsDrawerRef.current = new TrimbarsDrawer(
            overlayCanvasRef.current,
            100,
            waveformCanvasRef.current.width - 100
          );
        }

        // Initialize trim bars and animation
        if (updateTrimBarsFromPadRef.current) {
          updateTrimBarsFromPadRef.current();
        }
        if (startAnimationLoopRef.current) {
          startAnimationLoopRef.current();
        }
      }, 50);
    }
  };

  // Setup canvas interaction
  useEffect(() => {
    const overlayCanvas = overlayCanvasRef.current;
    const waveformCanvas = waveformCanvasRef.current;
    if (!overlayCanvas || !waveformCanvas) return;

    // Update trim bars from pad
    const updateTrimBarsFromPad = () => {
      if (
        selectedPadIndex < 0 ||
        !engine ||
        !waveformCanvasRef.current ||
        !trimbarsDrawerRef.current
      )
        return;

      const pad = engine.getPad(selectedPadIndex);
      if (!pad || !pad.loaded || !pad.buffer) return;

      const duration = pad.buffer.duration;
      const trimStart = Math.max(0, Math.min(pad.trimStart || 0, duration));
      const trimEnd = Math.max(
        trimStart,
        Math.min(pad.trimEnd || duration, duration)
      );

      const leftPixel =
        (trimStart / duration) * waveformCanvasRef.current.width;
      const rightPixel = (trimEnd / duration) * waveformCanvasRef.current.width;

      trimbarsDrawerRef.current.getLeftTrimBar().x = leftPixel;
      trimbarsDrawerRef.current.getRightTrimBar().x = rightPixel;

      trimbarsDrawerRef.current.clear();
      trimbarsDrawerRef.current.draw();
    };

    // Update pad from trim bars
    const updatePadFromTrimBars = () => {
      if (
        selectedPadIndex < 0 ||
        !engine ||
        !waveformCanvasRef.current ||
        !trimbarsDrawerRef.current
      )
        return;

      const pad = engine.getPad(selectedPadIndex);
      if (!pad || !pad.loaded) return;

      const startTime = pixelToSeconds(
        trimbarsDrawerRef.current.getLeftTrimBar().x,
        pad.buffer!.duration,
        waveformCanvasRef.current.width
      );
      const endTime = pixelToSeconds(
        trimbarsDrawerRef.current.getRightTrimBar().x,
        pad.buffer!.duration,
        waveformCanvasRef.current.width
      );

      engine.setTrimPoints(selectedPadIndex, startTime, endTime);
    };

    // Animation loop
    const startAnimationLoop = () => {
      if (!overlayCanvasRef.current || !trimbarsDrawerRef.current) return;

      let isAnimating = false;
      const animate = () => {
        trimbarsDrawerRef.current?.clear();
        trimbarsDrawerRef.current?.draw();
        isAnimating = false;
      };

      const scheduleAnimation = () => {
        if (!isAnimating) {
          isAnimating = true;
          requestAnimationFrame(animate);
        }
      };

      overlayCanvasRef.current.addEventListener(
        "mousemove",
        scheduleAnimation,
        {
          passive: true,
        }
      );

      scheduleAnimation();
    };

    // Store in refs for access from other functions
    updateTrimBarsFromPadRef.current = updateTrimBarsFromPad;
    startAnimationLoopRef.current = startAnimationLoop;

    const handleMouseMove = (evt: MouseEvent) => {
      const rect = waveformCanvas.getBoundingClientRect();
      const x = evt.clientX - rect.left;
      const y = evt.clientY - rect.top;

      if (trimbarsDrawerRef.current) {
        trimbarsDrawerRef.current.moveTrimBars({ x, y });
      }
    };

    const handleMouseDown = () => {
      if (trimbarsDrawerRef.current) {
        trimbarsDrawerRef.current.startDrag();
      }
    };

    const handleMouseUp = () => {
      if (trimbarsDrawerRef.current) {
        trimbarsDrawerRef.current.stopDrag();
        updatePadFromTrimBars();
      }
    };

    overlayCanvas.addEventListener("mousemove", handleMouseMove);
    overlayCanvas.addEventListener("mousedown", handleMouseDown);
    overlayCanvas.addEventListener("mouseup", handleMouseUp);

    return () => {
      overlayCanvas.removeEventListener("mousemove", handleMouseMove);
      overlayCanvas.removeEventListener("mousedown", handleMouseDown);
      overlayCanvas.removeEventListener("mouseup", handleMouseUp);
    };
  }, [selectedPadIndex, engine]);

  // Setup keyboard controls
  useEffect(() => {
    const keyToPadMap: Record<string, number> = {
      a: 0,
      b: 1,
      c: 2,
      d: 3,
      e: 4,
      f: 5,
      g: 6,
      h: 7,
      i: 8,
      j: 9,
      k: 10,
      l: 11,
      m: 12,
      n: 13,
      o: 14,
      p: 15,
      q: 0,
      r: 1,
      s: 2,
      t: 3,
      u: 4,
      v: 5,
      w: 6,
      x: 7,
      y: 8,
      z: 9,
    };

    const keysPressed: Record<string, boolean> = {};

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (key in keyToPadMap && !keysPressed[key]) {
        keysPressed[key] = true;
        event.preventDefault();

        const padIndex = keyToPadMap[key];
        const pad = engine?.getPad(padIndex);

        if (pad && pad.loaded) {
          const button = padButtonsRef.current[padIndex];
          if (button) button.classList.add("playing");

          engine?.play(padIndex);

          setTimeout(() => {
            if (button) button.classList.remove("playing");
          }, 150);
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key in keyToPadMap) {
        keysPressed[key] = false;
        event.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [engine]);

  // Waveform control handlers
  const handlePlaySelected = () => {
    if (selectedPadIndex >= 0 && engine) {
      engine.play(selectedPadIndex);
    }
  };

  const handlePlayFull = () => {
    if (selectedPadIndex >= 0 && engine) {
      const pad = engine.getPad(selectedPadIndex);
      if (pad && pad.loaded) {
        const originalStart = pad.trimStart;
        const originalEnd = pad.trimEnd;
        pad.trimStart = 0;
        pad.trimEnd = pad.buffer!.duration;
        engine.play(selectedPadIndex);
        pad.trimStart = originalStart;
        pad.trimEnd = originalEnd;
      }
    }
  };

  const handleResetTrim = () => {
    if (selectedPadIndex >= 0 && engine) {
      engine.resetPad(selectedPadIndex);
      updateTrimBarsFromPadRef.current();
    }
  };

  const progressBarStyle = {
    "--progress": `${progress}%`,
  } as React.CSSProperties;

  return (
    <div className="container">
      <header className="main-header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">♪</span>
            <h1>SAMPLER</h1>
          </div>
          <p className="tagline">Professional Web Audio Beat Maker</p>
        </div>
      </header>

      <section className="control-panel">
        <div className="preset-section">
          <label htmlFor="presetDropdown" className="label-icon">
            🎵
          </label>
          <select
            id="presetDropdown"
            disabled={presets.length === 0}
            className="preset-select"
            value={selectedPreset}
            onChange={(e) => setSelectedPreset(e.target.value)}
          >
            <option value="">-- Select a preset --</option>
            {presets.map((preset, index) => (
              <option key={index} value={index}>
                {preset.name || `Preset ${index + 1}`}
              </option>
            ))}
          </select>
          <button
            id="loadAllBtn"
            disabled={selectedPreset === "" || loadingBtn}
            className="btn btn-primary"
            onClick={loadPresetSounds}
          >
            <span>⚡ Load Sounds</span>
          </button>
        </div>

        <div className="status-panel">
          <span className={`status-text ${statusClass}`}>{statusText}</span>
          {progress > 0 && (
            <div className="progress-container">
              <div className="progress-bar" style={progressBarStyle}></div>
              <span className="progress-text">{progress}%</span>
            </div>
          )}
        </div>
      </section>

      <section className="pads-section">
        <div className="pads-header">
          <h2>🎹 Trigger Pads</h2>
          <p className="pads-subtitle">Press A-P or click pads to play</p>
        </div>
        <div ref={padsGridRef} className="pads-grid"></div>
      </section>

      {showWaveform && (
        <section className="waveform-section">
          <div className="waveform-header">
            <h2>Waveform Editor</h2>
            <span className="current-sample">
              {engine?.getPad(selectedPadIndex)?.name || "-"}
            </span>
          </div>

          <div className="waveform-container">
            <canvas
              ref={waveformCanvasRef}
              width={900}
              height={200}
              className="waveform-canvas"
            ></canvas>
            <canvas
              ref={overlayCanvasRef}
              width={900}
              height={200}
              className="overlay-canvas"
            ></canvas>
            <div className="trim-hint">
              Drag the green lines to trim the sample
            </div>
          </div>

          <div className="waveform-controls">
            <button className="btn btn-secondary" onClick={handlePlaySelected}>
              <span>▶ Play Selection</span>
            </button>
            <button className="btn btn-secondary" onClick={handlePlayFull}>
              <span>▶▶ Play Full</span>
            </button>
            <button className="btn btn-tertiary" onClick={handleResetTrim}>
              <span>↺ Reset</span>
            </button>
          </div>
        </section>
      )}

      <section className="info-section">
        <h3>📚 How to Use</h3>
        <div className="instructions-grid">
          <div className="instruction-card">
            <span className="card-icon">1️⃣</span>
            <h4>Select Preset</h4>
            <p>Choose a drum kit from the dropdown menu</p>
          </div>
          <div className="instruction-card">
            <span className="card-icon">2️⃣</span>
            <h4>Load Sounds</h4>
            <p>Click &quot;Load Sounds&quot; to download samples</p>
          </div>
          <div className="instruction-card">
            <span className="card-icon">3️⃣</span>
            <h4>Play &amp; Edit</h4>
            <p>Click pads or press keyboard to trigger</p>
          </div>
          <div className="instruction-card">
            <span className="card-icon">4️⃣</span>
            <h4>Trim Samples</h4>
            <p>Drag green bars to trim waveforms</p>
          </div>
        </div>

        <div className="keyboard-shortcuts">
          <h4>⌨️ Keyboard Shortcuts (A-Z)</h4>
          <div className="shortcuts-grid">
            <div className="shortcut-row">
              <strong>Row 1:</strong>
              <code>A B C D</code> <em>(Pads 1-4)</em>
            </div>
            <div className="shortcut-row">
              <strong>Row 2:</strong>
              <code>E F G H</code> <em>(Pads 5-8)</em>
            </div>
            <div className="shortcut-row">
              <strong>Row 3:</strong>
              <code>I J K L</code> <em>(Pads 9-12)</em>
            </div>
            <div className="shortcut-row">
              <strong>Row 4:</strong>
              <code>M N O P</code> <em>(Pads 13-16)</em>
            </div>
            <div className="shortcut-row">
              <strong>Extra:</strong>
              <code>Q-Z</code> <em>(Additional triggers)</em>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <p>
          🎵 Web Audio Sampler v1.0 | Built with Next.js, Web Audio API &amp;
          TypeScript
        </p>
      </footer>
    </div>
  );
}
