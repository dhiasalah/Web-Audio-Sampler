import SamplerEngine from "./SamplerEngine.js";
import SamplerGUI from "./SamplerGUI.js";

// Configuration
const API_BASE_URL = "http://localhost:3000";
const PRESETS_ENDPOINT = "/api/presets";

let ctx;
let samplerEngine;
let samplerGUI;
let presets = [];

window.onload = async function init() {
  // Initialize Audio Context
  ctx = new AudioContext();

  // Initialize Sampler Engine
  samplerEngine = new SamplerEngine(ctx);

  // Initialize Sampler GUI
  samplerGUI = new SamplerGUI(samplerEngine);

  // Setup UI controls
  setupControls();

  // Try to load presets from server
  await loadPresetsFromServer();
};

/**
 * Setup UI controls
 */
function setupControls() {
  const presetDropdown = document.querySelector("#presetDropdown");
  const loadAllBtn = document.querySelector("#loadAllBtn");

  presetDropdown.onchange = function () {
    if (this.value !== "") {
      loadAllBtn.disabled = false;
    } else {
      loadAllBtn.disabled = true;
    }
  };

  loadAllBtn.onclick = async function () {
    const selectedIndex = presetDropdown.value;
    if (selectedIndex !== "") {
      await loadPresetSounds(parseInt(selectedIndex));
    }
  };
}

/**
 * Load presets from server
 */
async function loadPresetsFromServer() {
  const statusText = document.querySelector("#statusText");
  const presetDropdown = document.querySelector("#presetDropdown");

  try {
    statusText.textContent = "Connecting to server...";
    statusText.className = "";

    const response = await fetch(`${API_BASE_URL}${PRESETS_ENDPOINT}`);

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    presets = await response.json();

    if (!Array.isArray(presets) || presets.length === 0) {
      throw new Error("No presets found on server");
    }

    // Populate dropdown
    presetDropdown.innerHTML =
      '<option value="">-- Select a preset --</option>';
    presets.forEach((preset, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = preset.name || `Preset ${index + 1}`;
      presetDropdown.appendChild(option);
    });

    presetDropdown.disabled = false;

    statusText.textContent = `✓ Found ${presets.length} preset(s) - Ready!`;
    statusText.className = "success";
  } catch (error) {
    console.error("Error loading presets:", error);

    statusText.textContent = `⚠ Server not available - Using demo mode`;
    statusText.className = "error";

    // Load demo preset with online samples
    loadDemoPreset();
  }
}

/**
 * Load demo preset when server is not available
 */
function loadDemoPreset() {
  const presetDropdown = document.querySelector("#presetDropdown");

  presets = [
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

  presetDropdown.innerHTML = '<option value="">-- Select a preset --</option>';
  presets.forEach((preset, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = preset.name;
    presetDropdown.appendChild(option);
  });

  presetDropdown.disabled = false;
}

/**
 * Load all sounds from a preset
 */
async function loadPresetSounds(presetIndex) {
  const preset = presets[presetIndex];
  const statusText = document.querySelector("#statusText");
  const progressContainer = document.querySelector("#progressContainer");
  const progressBar = document.querySelector("#progressBar");
  const progressText = document.querySelector("#progressText");
  const loadAllBtn = document.querySelector("#loadAllBtn");

  try {
    statusText.textContent = `Loading preset: ${preset.name}...`;
    statusText.className = "";
    progressContainer.style.display = "block";
    loadAllBtn.disabled = true;

    // Build sound URLs - handle both old format (files array) and new format (samples array)
    let soundURLs = [];
    let soundNames = [];

    if (preset.samples && Array.isArray(preset.samples)) {
      // New server format with samples array containing {url, name}
      soundURLs = preset.samples.map((sample) => {
        // Check if URL is absolute or relative
        if (sample.url.startsWith("http")) {
          return sample.url;
        } else {
          // Relative URL - remove leading ./ and prepend base path
          let cleanPath = sample.url.startsWith("./")
            ? sample.url.substring(2)
            : sample.url;
          return `${API_BASE_URL}/presets/${cleanPath}`;
        }
      });
      soundNames = preset.samples.map((sample) => sample.name);
    } else if (preset.files && Array.isArray(preset.files)) {
      // Old format with files array
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

    // Limit to 16 sounds (our pad count)
    soundURLs = soundURLs.slice(0, 16);
    soundNames = soundNames.slice(0, 16);

    let loadedCount = 0;
    const totalSounds = soundURLs.length;

    // Load sounds using Promise.allSettled for better error handling
    const loadPromises = soundURLs.map(async (url, index) => {
      try {
        samplerGUI.showPadLoading(index, 0);

        const soundName = soundNames[index] || `Sound ${index + 1}`;
        await samplerEngine.loadSoundFromURL(index, url, (progress) => {
          samplerGUI.showPadLoading(index, progress);
        });

        // Update pad name
        const pad = samplerEngine.getPad(index);
        if (pad) {
          pad.name = soundName;
        }

        samplerGUI.enablePad(index);
        loadedCount++;

        // Update overall progress
        const overallProgress = (loadedCount / totalSounds) * 100;
        progressBar.style.setProperty("--progress", `${overallProgress}%`);
        progressText.textContent = `${Math.round(overallProgress)}%`;

        return { success: true, index };
      } catch (error) {
        console.error(`Failed to load sound ${index}:`, error);
        samplerGUI.showPadError(index);
        return { success: false, index, error };
      }
    });

    const results = await Promise.allSettled(loadPromises);

    // Check results
    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;

    progressContainer.style.display = "none";

    if (successCount === 0) {
      throw new Error("Failed to load any sounds");
    }

    statusText.textContent = `✓ Loaded ${successCount}/${totalSounds} sounds`;
    statusText.className = "success";
    loadAllBtn.disabled = false;
  } catch (error) {
    console.error("Error loading preset sounds:", error);
    statusText.textContent = `✗ Error: ${error.message}`;
    statusText.className = "error";
    progressContainer.style.display = "none";
    loadAllBtn.disabled = false;
  }
}
