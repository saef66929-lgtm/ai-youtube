import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { sidecarManager } from './sidecar';
import { appLogger } from './logger';

/**
 * AI YouTube - Electron Main Process
 * Stage 0 & 1 & Production Packaging
 * Manages desktop window lifecycle, security boundaries, and the Python Sidecar process.
 */

let mainWindow: BrowserWindow | null = null;
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

function getPreloadPath(): string {
  const potentialPaths = [
    path.join(__dirname, 'preload.cjs'),
    path.join(__dirname, 'preload.js'),
    path.join(process.resourcesPath, 'dist-electron', 'preload.cjs'),
    path.join(app.getAppPath(), 'dist-electron', 'preload.cjs'),
    path.join(PROJECT_ROOT, 'dist-electron', 'preload.cjs'),
  ];
  for (const p of potentialPaths) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(__dirname, 'preload.cjs');
}

function getIconPath(): string | undefined {
  const candidates = [
    path.join(PROJECT_ROOT, 'build', 'icon.ico'),
    path.join(app.getAppPath(), 'build', 'icon.ico'),
    path.join(process.resourcesPath, 'build', 'icon.ico'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return undefined;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 840,
    minWidth: 980,
    minHeight: 660,
    title: 'AI YouTube',
    backgroundColor: '#090a0f',
    icon: getIconPath(),
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Determine whether to load dev server or static build
  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production' && !process.env.LOAD_DIST;
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:3000';

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
      path.join(PROJECT_ROOT, 'dist', 'index.html'),
      path.join(app.getAppPath(), 'dist', 'index.html'),
      path.join(process.resourcesPath, 'dist', 'index.html'),
      path.join(process.resourcesPath, 'app.asar', 'dist', 'index.html'),
    ];
    for (const indexPath of potentialIndexPaths) {
      if (fs.existsSync(indexPath)) {
        mainWindow?.loadFile(indexPath);
        return;
      }
    }
    appLogger.error(`Production build not found in search paths: ${potentialIndexPaths.join(', ')}`);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function getUserConfigPath(): string {
  const userDataDir = app.getPath('userData');
  const userConfigDir = path.join(userDataDir, 'config');
  const userConfigFile = path.join(userConfigDir, 'app_config.json');

  if (!fs.existsSync(userConfigFile)) {
    try {
      fs.mkdirSync(userConfigDir, { recursive: true });
      const candidates = [
        path.join(PROJECT_ROOT, 'config', 'app_config.json'),
        path.join(app.getAppPath(), 'config', 'app_config.json'),
        path.join(process.resourcesPath, 'config', 'app_config.json'),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          fs.copyFileSync(c, userConfigFile);
          break;
        }
      }
    } catch (e) {
      appLogger.error('Failed to initialize user config file', e);
    }
  }

  return userConfigFile;
}

function setupIpc(): void {
  ipcMain.handle('engine:get-status', async () => {
    return sidecarManager.getStatus();
  });

  ipcMain.handle('engine:start', async () => {
    return await sidecarManager.start(app.getPath('userData'));
  });

  ipcMain.handle('engine:stop', async () => {
    await sidecarManager.stop();
    return sidecarManager.getStatus();
  });

  ipcMain.handle('app:get-config', async () => {
    const configPath = getUserConfigPath();
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(raw);
      } catch (e) {
        appLogger.error('Failed reading app_config.json', e);
      }
    }
    return {};
  });

  ipcMain.handle('hardware:get-status', async () => {
    try {
      const http = await import('http');
      return await new Promise((resolve) => {
        const req = http.get('http://127.0.0.1:8765/api/hardware', { timeout: 4000 }, (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve({ status: 'Error', error: 'Invalid JSON from hardware endpoint' });
            }
          });
        });
        req.on('error', () => resolve({ status: 'Not Scanned Yet' }));
      });
    } catch {
      return { status: 'Not Scanned Yet' };
    }
  });

  ipcMain.handle('hardware:scan', async () => {
    try {
      const http = await import('http');
      return await new Promise((resolve) => {
        const req = http.request(
          'http://127.0.0.1:8765/api/hardware/scan',
          { method: 'POST', timeout: 15000 },
          (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch {
                resolve({ status: 'Error', error: 'Invalid JSON from hardware scan' });
              }
            });
          }
        );
        req.on('error', (err) => resolve({ status: 'Error', error: err.message }));
        req.end();
      });
    } catch (e: any) {
      return { status: 'Error', error: e.message };
    }
  });

  ipcMain.handle('app:save-config', async (_event, newSettings) => {
    const configPath = getUserConfigPath();
    try {
      let current: any = {};
      if (fs.existsSync(configPath)) {
        current = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      }
      const updated = { ...current, ...newSettings };
      fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf-8');
      return true;
    } catch (e) {
      appLogger.error('Failed saving app_config.json', e);
      return false;
    }
  });

  // Relay status changes to renderer
  sidecarManager.on('status-changed', (state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('engine:status-changed', state);
    }
  });
}

// Lifecycle Management
app.whenReady().then(async () => {
  appLogger.info('AI YouTube Electron Shell starting...');
  setupIpc();
  createWindow();

  // Automatically start Python Sidecar with writable user data directory
  try {
    await sidecarManager.start(app.getPath('userData'));
  } catch (err) {
    appLogger.error('Automatic Python Sidecar startup failed on launch', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  appLogger.info('All windows closed.');
  if (process.platform !== 'darwin') {
    await sidecarManager.stop();
    app.quit();
  }
});

app.on('before-quit', async () => {
  appLogger.info('Application quitting. Ensuring Python sidecar is stopped...');
  await sidecarManager.stop();
});
