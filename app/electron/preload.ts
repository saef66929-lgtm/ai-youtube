import { contextBridge, ipcRenderer } from 'electron';

/**
 * AI YouTube - Electron Preload Script
 * Stage 1: Hardware Diagnostics + Localization
 * Secure Context Bridge: Exposes strictly typed APIs to the renderer window
 * without enabling nodeIntegration.
 */

export interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  getEngineStatus: () => Promise<any>;
  startEngine: () => Promise<any>;
  stopEngine: () => Promise<void>;
  getAppConfig: () => Promise<any>;
  getHardwareStatus: () => Promise<any>;
  scanHardware: () => Promise<any>;
  saveConfig: (config: any) => Promise<boolean>;
  onEngineStatusChanged: (callback: (status: any) => void) => () => void;
}

const api: ElectronAPI = {
  isElectron: true,
  platform: process.platform,
  getEngineStatus: () => ipcRenderer.invoke('engine:get-status'),
  startEngine: () => ipcRenderer.invoke('engine:start'),
  stopEngine: () => ipcRenderer.invoke('engine:stop'),
  getAppConfig: () => ipcRenderer.invoke('app:get-config'),
  getHardwareStatus: () => ipcRenderer.invoke('hardware:get-status'),
  scanHardware: () => ipcRenderer.invoke('hardware:scan'),
  saveConfig: (cfg: any) => ipcRenderer.invoke('app:save-config', cfg),
  onEngineStatusChanged: (callback: (status: any) => void) => {
    const handler = (_event: unknown, val: any) => callback(val);
    ipcRenderer.on('engine:status-changed', handler);
    return () => {
      ipcRenderer.removeListener('engine:status-changed', handler);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
