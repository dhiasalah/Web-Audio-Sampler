import { useState } from "react";
import SamplerEngine from "@/lib/SamplerEngine";

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

export function useAudioEngine() {
  const [engine] = useState<SamplerEngine | null>(() => {
    // Only initialize on client-side
    if (typeof window === "undefined") {
      return null;
    }

    const AudioContextConstructor =
      window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContextConstructor();
    const sampler = new SamplerEngine(audioCtx);
    return sampler;
  });

  return engine;
}
