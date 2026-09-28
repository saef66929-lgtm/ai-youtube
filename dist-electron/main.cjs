var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// app/electron/main.ts
var import_electron = require("electron");
var import_path3 = __toESM(require("path"), 1);
var import_fs3 = __toESM(require("fs"), 1);

// app/electron/sidecar.ts
var import_child_process = require("child_process");
var import_http = __toESM(require("http"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_fs2 = __toESM(require("fs"), 1);
var import_events = require("events");

// app/electron/logger.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var PROJECT_ROOT = import_path.default.resolve(__dirname, "..", "..");
var LOGS_DIR = import_path.default.join(PROJECT_ROOT, "logs");
function ensureLogsDir() {
  if (!import_fs.default.existsSync(LOGS_DIR)) {
    import_fs.default.mkdirSync(LOGS_DIR, { recursive: true });
  }
}
function formatMessage(level, message) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").substring(0, 19);
  return `[${timestamp}] [${level}] [App]: ${message}
`;
}
var appLogger = {
  info(message) {
    ensureLogsDir();
    const formatted = formatMessage("INFO", message);
    process.stdout.write(formatted);
    try {
      import_fs.default.appendFileSync(import_path.default.join(LOGS_DIR, "app.log"), formatted, { encoding: "utf-8" });
    } catch {
    }
  },
  warn(message) {
    ensureLogsDir();
    const formatted = formatMessage("WARN", message);
    process.stdout.write(formatted);
    try {
      import_fs.default.appendFileSync(import_path.default.join(LOGS_DIR, "app.log"), formatted, { encoding: "utf-8" });
    } catch {
    }
  },
  error(message, error) {
    ensureLogsDir();
    const errorDetails = error instanceof Error ? `${error.message}
${error.stack || ""}` : String(error || "");
    const fullMsg = error ? `${message} | Error: ${errorDetails}` : message;
    const formatted = formatMessage("ERROR", fullMsg);
    process.stderr.write(formatted);
    try {
      import_fs.default.appendFileSync(import_path.default.join(LOGS_DIR, "app.log"), formatted, { encoding: "utf-8" });
      import_fs.default.appendFileSync(import_path.default.join(LOGS_DIR, "error.log"), formatted, { encoding: "utf-8" });
    } catch {
    }
  }
};

// app/electron/sidecar.ts
var SidecarManager = class extends import_events.EventEmitter {
  constructor(projectRoot) {
    super();
    this.process = null;
    this.host = "127.0.0.1";
    this.port = 8765;
    this.status = "not_connected";
    this.isShuttingDown = false;
    this.projectRoot = projectRoot || import_path2.default.resolve(__dirname, "..", "..");
  }
  getStatus() {
    return {
      status: this.status,
      host: this.host,
      port: this.port,
      pid: this.process?.pid,
      hardwareStatus: "Not Scanned Yet",
      lastError: this.lastError
    };
  }
  setStatus(newStatus, error) {
    this.status = newStatus;
    if (error) this.lastError = error;
    appLogger.info(`Sidecar status transitioned to: ${newStatus}${error ? ` (${error})` : ""}`);
    this.emit("status-changed", this.getStatus());
  }
  resolvePythonExecutable() {
    const isWin = process.platform === "win32";
    const bundledPythonPaths = [
      import_path2.default.join(process.resourcesPath, "python", "python.exe"),
      import_path2.default.join(this.projectRoot, "resources", "python", "python.exe")
    ];
    if (isWin) {
      for (const p of bundledPythonPaths) {
        if (import_fs2.default.existsSync(p)) {
          appLogger.info(`Using bundled Python runtime: ${p}`);
          return p;
        }
      }
    }
    const venvWindows = import_path2.default.join(this.projectRoot, ".venv", "Scripts", "python.exe");
    const venvUnix = import_path2.default.join(this.projectRoot, ".venv", "bin", "python");
    if (isWin && import_fs2.default.existsSync(venvWindows)) {
      return venvWindows;
    }
    if (import_fs2.default.existsSync(venvUnix)) {
      return venvUnix;
    }
    return isWin ? "python" : "python3";
  }
  resolveScriptPath() {
    const candidates = [
      import_path2.default.join(process.resourcesPath, "engine", "main.py"),
      import_path2.default.join(this.projectRoot, "engine", "main.py")
    ];
    for (const c of candidates) {
      if (import_fs2.default.existsSync(c)) {
        return c;
      }
    }
    return import_path2.default.join(this.projectRoot, "engine", "main.py");
  }
  async start(userDataPath) {
    if (this.status === "connected" || this.status === "starting") {
      return this.getStatus();
    }
    this.isShuttingDown = false;
    this.setStatus("starting");
    const pythonBin = this.resolvePythonExecutable();
    const scriptPath = this.resolveScriptPath();
    if (!import_fs2.default.existsSync(scriptPath)) {
      const err = `Engine entry script not found at ${scriptPath}`;
      this.setStatus("stopped", err);
      appLogger.error(err);
      throw new Error(err);
    }
    const args = [scriptPath, "--host", this.host, "--port", String(this.port)];
    if (userDataPath) {
      args.push("--user-data", userDataPath);
    }
    appLogger.info(`Starting Python Sidecar: ${pythonBin} ${args.join(" ")}`);
    try {
      this.process = (0, import_child_process.spawn)(pythonBin, args, {
        cwd: import_path2.default.dirname(scriptPath),
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
          PYTHONIOENCODING: "utf-8",
          ...userDataPath ? { AI_YOUTUBE_USER_DATA: userDataPath } : {}
        },
        stdio: ["pipe", "pipe", "pipe"]
      });
      this.process.stdout?.on("data", (chunk) => {
        const text = chunk.toString("utf-8");
        appLogger.info(`[Engine stdout]: ${text.trim()}`);
        if (text.includes("AI_YOUTUBE_SIDECAR_READY")) {
          this.setStatus("connected");
        }
      });
      this.process.stderr?.on("data", (chunk) => {
        const text = chunk.toString("utf-8");
        appLogger.warn(`[Engine stderr]: ${text.trim()}`);
      });
      this.process.on("error", (err) => {
        appLogger.error("Failed to spawn Python Sidecar process", err);
        this.setStatus("stopped", `Process spawn failed: ${err.message}`);
      });
      this.process.on("close", (code, signal) => {
        appLogger.info(`Python Sidecar process terminated with code=${code} signal=${signal}`);
        this.process = null;
        if (!this.isShuttingDown) {
          this.setStatus("stopped", `Unexpected exit code: ${code}`);
        } else {
          this.setStatus("not_connected");
        }
      });
      const connected = await this.waitForReady(1e4);
      if (connected) {
        this.setStatus("connected");
      } else {
        this.setStatus("stopped", "Timed out waiting for Python sidecar to respond");
      }
      return this.getStatus();
    } catch (err) {
      this.setStatus("stopped", err.message);
      appLogger.error("Fatal error starting Python sidecar", err);
      throw err;
    }
  }
  async stop() {
    if (!this.process && this.status === "not_connected") {
      return;
    }
    this.isShuttingDown = true;
    appLogger.info("Stopping Python Sidecar process...");
    try {
      await this.requestGracefulShutdown();
    } catch {
    }
    if (this.process) {
      try {
        this.process.kill("SIGTERM");
      } catch {
        this.process.kill("SIGKILL");
      }
      this.process = null;
    }
    this.setStatus("not_connected");
  }
  requestGracefulShutdown() {
    return new Promise((resolve) => {
      const req = import_http.default.request(
        {
          host: this.host,
          port: this.port,
          path: "/api/shutdown",
          method: "POST",
          timeout: 1e3
        },
        () => resolve()
      );
      req.on("error", () => resolve());
      req.end();
    });
  }
  waitForReady(timeoutMs) {
    const startTime = Date.now();
    return new Promise((resolve) => {
      const check = () => {
        if (this.status === "connected") {
          resolve(true);
          return;
        }
        if (Date.now() - startTime >= timeoutMs) {
          resolve(false);
          return;
        }
        const req = import_http.default.get(
          {
            host: this.host,
            port: this.port,
            path: "/api/health",
            timeout: 800
          },
          (res) => {
            if (res.statusCode === 200) {
              resolve(true);
            } else {
              setTimeout(check, 400);
            }
          }
        );
        req.on("error", () => {
          setTimeout(check, 400);
        });
      };
      setTimeout(check, 300);
    });
  }
};
var sidecarManager = new SidecarManager();

// app/electron/main.ts
var mainWindow = null;
var PROJECT_ROOT2 = import_path3.default.resolve(__dirname, "..", "..");
function getPreloadPath() {
  const potentialPaths = [
    import_path3.default.join(__dirname, "preload.cjs"),
    import_path3.default.join(__dirname, "preload.js"),
    import_path3.default.join(process.resourcesPath, "dist-electron", "preload.cjs"),
    import_path3.default.join(import_electron.app.getAppPath(), "dist-electron", "preload.cjs"),
    import_path3.default.join(PROJECT_ROOT2, "dist-electron", "preload.cjs")
  ];
  for (const p of potentialPaths) {
    if (import_fs3.default.existsSync(p)) return p;
  }
  return import_path3.default.join(__dirname, "preload.cjs");
}
function getIconPath() {
  const candidates = [
    import_path3.default.join(PROJECT_ROOT2, "build", "icon.ico"),
    import_path3.default.join(import_electron.app.getAppPath(), "build", "icon.ico"),
    import_path3.default.join(process.resourcesPath, "build", "icon.ico")
  ];
  for (const c of candidates) {
    if (import_fs3.default.existsSync(c)) return c;
  }
  return void 0;
}
function createWindow() {
  mainWindow = new import_electron.BrowserWindow({
    width: 1240,
    height: 840,
    minWidth: 980,
    minHeight: 660,
    title: "AI YouTube",
    backgroundColor: "#090a0f",
    icon: getIconPath(),
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    },
    show: false
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });
  const isDev = !import_electron.app.isPackaged && process.env.NODE_ENV !== "production" && !process.env.LOAD_DIST;
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:3000";
  if (isDev) {
    mainWindow.loadURL(devServerUrl).catch((err) => {
      appLogger.error(`Failed to load dev server at ${devServerUrl}, falling back to static build.`, err);
      loadStaticBuild();
    });
  } else {
    loadStaticBuild();
  }
  function loadStaticBuild() {
    const potentialIndexPaths = [
      import_path3.default.join(PROJECT_ROOT2, "dist", "index.html"),
      import_path3.default.join(import_electron.app.getAppPath(), "dist", "index.html"),
      import_path3.default.join(process.resourcesPath, "dist", "index.html"),
      import_path3.default.join(process.resourcesPath, "app.asar", "dist", "index.html")
    ];
    for (const indexPath of potentialIndexPaths) {
      if (import_fs3.default.existsSync(indexPath)) {
        mainWindow?.loadFile(indexPath);
        return;
      }
    }
    appLogger.error(`Production build not found in search paths: ${potentialIndexPaths.join(", ")}`);
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function getUserConfigPath() {
  const userDataDir = import_electron.app.getPath("userData");
  const userConfigDir = import_path3.default.join(userDataDir, "config");
  const userConfigFile = import_path3.default.join(userConfigDir, "app_config.json");
  if (!import_fs3.default.existsSync(userConfigFile)) {
    try {
      import_fs3.default.mkdirSync(userConfigDir, { recursive: true });
      const candidates = [
        import_path3.default.join(PROJECT_ROOT2, "config", "app_config.json"),
        import_path3.default.join(import_electron.app.getAppPath(), "config", "app_config.json"),
        import_path3.default.join(process.resourcesPath, "config", "app_config.json")
      ];
      for (const c of candidates) {
        if (import_fs3.default.existsSync(c)) {
          import_fs3.default.copyFileSync(c, userConfigFile);
          break;
        }
      }
    } catch (e) {
      appLogger.error("Failed to initialize user config file", e);
    }
  }
  return userConfigFile;
}
function setupIpc() {
  import_electron.ipcMain.handle("engine:get-status", async () => {
    return sidecarManager.getStatus();
  });
  import_electron.ipcMain.handle("engine:start", async () => {
    return await sidecarManager.start(import_electron.app.getPath("userData"));
  });
  import_electron.ipcMain.handle("engine:stop", async () => {
    await sidecarManager.stop();
    return sidecarManager.getStatus();
  });
  import_electron.ipcMain.handle("app:get-config", async () => {
    const configPath = getUserConfigPath();
    if (import_fs3.default.existsSync(configPath)) {
      try {
        const raw = import_fs3.default.readFileSync(configPath, "utf-8");
        return JSON.parse(raw);
      } catch (e) {
        appLogger.error("Failed reading app_config.json", e);
      }
    }
    return {};
  });
  import_electron.ipcMain.handle("hardware:get-status", async () => {
    try {
      const http2 = await import("http");
      return await new Promise((resolve) => {
        const req = http2.get("http://127.0.0.1:8765/api/hardware", { timeout: 4e3 }, (res) => {
          let data = "";
          res.on("data", (c) => data += c);
          res.on("end", () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve({ status: "Error", error: "Invalid JSON from hardware endpoint" });
            }
          });
        });
        req.on("error", () => resolve({ status: "Not Scanned Yet" }));
      });
    } catch {
      return { status: "Not Scanned Yet" };
    }
  });
  import_electron.ipcMain.handle("hardware:scan", async () => {
    try {
      const http2 = await import("http");
      return await new Promise((resolve) => {
        const req = http2.request(
          "http://127.0.0.1:8765/api/hardware/scan",
          { method: "POST", timeout: 15e3 },
          (res) => {
            let data = "";
            res.on("data", (c) => data += c);
            res.on("end", () => {
              try {
                resolve(JSON.parse(data));
              } catch {
                resolve({ status: "Error", error: "Invalid JSON from hardware scan" });
              }
            });
          }
        );
        req.on("error", (err) => resolve({ status: "Error", error: err.message }));
        req.end();
      });
    } catch (e) {
      return { status: "Error", error: e.message };
    }
  });
  import_electron.ipcMain.handle("app:save-config", async (_event, newSettings) => {
    const configPath = getUserConfigPath();
    try {
      let current = {};
      if (import_fs3.default.existsSync(configPath)) {
        current = JSON.parse(import_fs3.default.readFileSync(configPath, "utf-8"));
      }
      const updated = { ...current, ...newSettings };
      import_fs3.default.writeFileSync(configPath, JSON.stringify(updated, null, 2), "utf-8");
      return true;
    } catch (e) {
      appLogger.error("Failed saving app_config.json", e);
      return false;
    }
  });
  sidecarManager.on("status-changed", (state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("engine:status-changed", state);
    }
  });
}
import_electron.app.whenReady().then(async () => {
  appLogger.info("AI YouTube Electron Shell starting...");
  setupIpc();
  createWindow();
  try {
    await sidecarManager.start(import_electron.app.getPath("userData"));
  } catch (err) {
    appLogger.error("Automatic Python Sidecar startup failed on launch", err);
  }
  import_electron.app.on("activate", () => {
    if (import_electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
import_electron.app.on("window-all-closed", async () => {
  appLogger.info("All windows closed.");
  if (process.platform !== "darwin") {
    await sidecarManager.stop();
    import_electron.app.quit();
  }
});
import_electron.app.on("before-quit", async () => {
  appLogger.info("Application quitting. Ensuring Python sidecar is stopped...");
  await sidecarManager.stop();
});
