/**
 * AI YouTube - Engine Client Service
 * Stage 1: Hardware Diagnostics + Localization
 * Handles communication with the Python Sidecar either via Electron IPC bridge
 * or local API proxy (/api/*).
 */

export interface GpuDetails {
  index: number;
  name: string;
  driver_version?: string;
  total_vram_gb: number;
  used_vram_gb: number;
  free_vram_gb: number;
  gpu_utilization_percent: number;
}

export interface HardwareProfile {
  status: 'Ready' | 'Warning' | 'Error' | 'Unavailable' | string;
  scanned: boolean;
  overall_status: string;
  cpu: {
    status: string;
    name: string;
    architecture: string;
    physical_cores: number | null;
    logical_cores: number | null;
    frequency_mhz: number | null;
  };
  ram: {
    status: string;
    total_gb: number | null;
    available_gb: number | null;
    used_gb: number | null;
    usage_percent: number | null;
  };
  gpu: {
    name: string | null;
    count: number;
    total_vram_gb: number | null;
    used_vram_gb: number | null;
    free_vram_gb: number | null;
    gpu_utilization_percent: number | null;
    all_gpus: GpuDetails[];
    status: string;
  };
  nvidia: {
    status: string;
    nvidia_available: boolean;
    nvidia_smi_found: boolean;
    smi_path?: string;
    gpu_count: number;
    gpus: GpuDetails[];
    primary_gpu?: string;
    driver_version?: string;
    total_vram_gb?: number;
    used_vram_gb?: number;
    free_vram_gb?: number;
    gpu_utilization_percent?: number;
    message_ar: string;
    message_en: string;
  };
  cuda: {
    status: string;
    cuda_available: boolean;
    driver_cuda_version: string | null;
    message_ar: string;
    message_en: string;
  };
  pytorch: {
    status: string;
    pytorch_installed: boolean;
    version: string | null;
    cuda_available: boolean;
    torch_cuda_version: string | null;
    cudnn_version: string | null;
    gpu_count: number;
    gpu_names: string[];
    message_ar: string;
    message_en: string;
  };
  disk: {
    status: string;
    path: string;
    total_gb: number | null;
    used_gb: number | null;
    free_gb: number | null;
    usage_percent: number | null;
    low_space_warning: boolean;
  };
  ffmpeg: {
    status: string;
    ffmpeg_available: boolean;
    version: string | null;
    path?: string;
    message_ar: string;
    message_en: string;
  };
  scanner: {
    timestamp: string;
    duration_ms: number;
    platform: string;
    python_version?: string;
  };
}

export interface EngineStatusData {
  appName: string;
  status: 'Application Ready' | string;
  engine: {
    name: string;
    status: 'Connected' | 'Starting' | 'Not Connected' | 'Stopped';
    host?: string;
    port?: number;
    pid?: number;
    uptimeSeconds?: number;
  };
  hardware: string;
  language?: string;
  lastError?: string;
}

export interface AppConfigData {
  app_name: string;
  app_version: string;
  environment: string;
  language?: string;
  paths: {
    models_dir: string;
    outputs_dir: string;
    logs_dir: string;
    cache_dir: string;
  };
  hardware_status: string;
}

export const engineApi = {
  isElectron(): boolean {
    return Boolean(window.electronAPI?.isElectron);
  },

  async getStatus(): Promise<EngineStatusData> {
    // 1. If running in Electron, use secure IPC bridge
    if (window.electronAPI) {
      try {
        const sidecarState = await window.electronAPI.getEngineStatus();
        let engineStatusText: 'Connected' | 'Starting' | 'Not Connected' | 'Stopped' = 'Not Connected';

        if (sidecarState.status === 'connected') engineStatusText = 'Connected';
        else if (sidecarState.status === 'starting') engineStatusText = 'Starting';
        else if (sidecarState.status === 'stopped') engineStatusText = 'Stopped';

        return {
          appName: 'AI YouTube',
          status: 'Application Ready',
          engine: {
            name: 'Python Sidecar',
            status: engineStatusText,
            host: sidecarState.host,
            port: sidecarState.port,
            pid: sidecarState.pid,
            uptimeSeconds: sidecarState.uptimeSeconds,
          },
          hardware: sidecarState.hardwareStatus || 'Not Scanned Yet',
          lastError: sidecarState.lastError,
        };
      } catch (err) {
        return {
          appName: 'AI YouTube',
          status: 'Application Ready',
          engine: {
            name: 'Python Sidecar',
            status: 'Not Connected',
          },
          hardware: 'Not Scanned Yet',
          lastError: String(err),
        };
      }
    }

    // 2. Browser / server fallback: query server API
    try {
      const res = await fetch('/api/status', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        let engStatus: 'Connected' | 'Starting' | 'Not Connected' | 'Stopped' = 'Not Connected';
        const rawStatus = json.engine?.status;
        if (rawStatus === 'Connected') engStatus = 'Connected';
        else if (rawStatus === 'Starting') engStatus = 'Starting';
        else if (rawStatus === 'Stopped') engStatus = 'Stopped';

        return {
          appName: json.app_name || 'AI YouTube',
          status: json.status || 'Application Ready',
          engine: {
            name: json.engine?.name || 'Python Sidecar',
            status: engStatus,
            host: json.engine?.host || '127.0.0.1',
            port: json.engine?.port || 8765,
            pid: json.engine?.pid,
            uptimeSeconds: json.engine?.uptime_seconds,
          },
          hardware: json.hardware || 'Not Scanned Yet',
          language: json.language,
          lastError: json.last_error,
        };
      }
    } catch {
      // Fallback
    }

    return {
      appName: 'AI YouTube',
      status: 'Application Ready',
      engine: {
        name: 'Python Sidecar',
        status: 'Not Connected',
      },
      hardware: 'Not Scanned Yet',
    };
  },

  async startEngine(): Promise<void> {
    if (window.electronAPI) {
      await window.electronAPI.startEngine();
      return;
    }
    try {
      await fetch('/api/engine/start', { method: 'POST' });
    } catch {
      // Ignored
    }
  },

  async stopEngine(): Promise<void> {
    if (window.electronAPI) {
      await window.electronAPI.stopEngine();
      return;
    }
    try {
      await fetch('/api/engine/stop', { method: 'POST' });
    } catch {
      // Ignored
    }
  },

  async getConfig(): Promise<AppConfigData | null> {
    if (window.electronAPI) {
      try {
        return await window.electronAPI.getAppConfig();
      } catch {
        return null;
      }
    }

    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    return null;
  },

  async getHardwareProfile(): Promise<HardwareProfile | null> {
    try {
      const res = await fetch('/api/hardware');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Failed to fetch hardware profile:', e);
    }
    return null;
  },

  async scanHardware(): Promise<HardwareProfile | null> {
    try {
      const res = await fetch('/api/hardware/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Failed to run hardware scan:', e);
    }
    return null;
  },

  async saveLanguage(lang: 'ar' | 'en'): Promise<boolean> {
    try {
      const res = await fetch('/api/config/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};
