var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// app/electron/preload.ts
var preload_exports = {};
module.exports = __toCommonJS(preload_exports);
var import_electron = require("electron");
var api = {
  isElectron: true,
  platform: process.platform,
  getEngineStatus: () => import_electron.ipcRenderer.invoke("engine:get-status"),
  startEngine: () => import_electron.ipcRenderer.invoke("engine:start"),
  stopEngine: () => import_electron.ipcRenderer.invoke("engine:stop"),
  getAppConfig: () => import_electron.ipcRenderer.invoke("app:get-config"),
  getHardwareStatus: () => import_electron.ipcRenderer.invoke("hardware:get-status"),
  scanHardware: () => import_electron.ipcRenderer.invoke("hardware:scan"),
  saveConfig: (cfg) => import_electron.ipcRenderer.invoke("app:save-config", cfg),
  onEngineStatusChanged: (callback) => {
    const handler = (_event, val) => callback(val);
    import_electron.ipcRenderer.on("engine:status-changed", handler);
    return () => {
      import_electron.ipcRenderer.removeListener("engine:status-changed", handler);
    };
  }
};
import_electron.contextBridge.exposeInMainWorld("electronAPI", api);
