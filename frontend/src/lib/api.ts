import axios, { AxiosProgressEvent } from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Suppress error logging for 404 on presets endpoint (expected when no backend)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only suppress 404 errors on /api/presets endpoint
    if (
      axios.isAxiosError(error) &&
      error.config?.url?.includes("/api/presets") &&
      error.response?.status === 404
    ) {
      // Silently throw - will be caught by getPresets()
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);

export interface Preset {
  name: string;
  files?: string[];
  samples?: Array<{
    url: string;
    name: string;
  }>;
}

/**
 * Get all presets from server
 */
export async function getPresets(): Promise<Preset[]> {
  try {
    const response = await apiClient.get<Preset[]>("/api/presets");
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      // Server endpoint not found, will use demo mode
      throw new Error("API endpoint not available");
    }
    throw error;
  }
}

/**
 * Get a single preset by name
 */
export async function getPreset(name: string): Promise<Preset> {
  const response = await apiClient.get<Preset>(`/api/presets/${name}`);
  return response.data;
}

/**
 * Get sound file with progress
 */
export async function getSoundFile(
  url: string,
  onProgress?: (progress: number) => void
): Promise<ArrayBuffer> {
  const response = await apiClient.get(url, {
    responseType: "arraybuffer",
    onDownloadProgress: (progressEvent: AxiosProgressEvent) => {
      if (onProgress && progressEvent.total) {
        const progress = (progressEvent.loaded / progressEvent.total) * 100;
        onProgress(progress);
      }
    },
  });
  return response.data;
}

export default apiClient;
