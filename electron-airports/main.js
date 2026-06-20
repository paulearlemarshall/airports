const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('node:path');

const airportGapClient = require('./airportgapClient');
const { AirportStore } = require('./airportStore');
const { registerAirportIpcHandlers } = require('./ipcHandlers');

let airportStore;

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 650,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const source = sourceId ? `${sourceId}:${line}` : `line ${line}`;
    const prefix = `[renderer:${level}] ${source}`;
    if (level >= 2) {
      console.error(`${prefix} ${message}`);
    } else {
      console.log(`${prefix} ${message}`);
    }
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[renderer:load-failed] ${errorCode} ${errorDescription} ${validatedURL}`);
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[renderer:process-gone] ${details.reason} exitCode=${details.exitCode}`);
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function configureMapTileHeaders() {
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (details.url.includes('tile.openstreetmap.org')) {
      details.requestHeaders.Referer = 'https://airportgap.com/';
      details.requestHeaders['User-Agent'] =
        details.requestHeaders['User-Agent'] || 'airport-distance-desktop/1.0 (+https://airportgap.com/)';
    }

    callback({ requestHeaders: details.requestHeaders });
  });
}

function isBrokenPipeError(err) {
  return err && (err.code === 'EPIPE' || String(err.message || '').toLowerCase().includes('broken pipe'));
}

function installProcessErrorHandlers() {
  if (process.stdout) {
    process.stdout.on('error', (err) => {
      if (!isBrokenPipeError(err)) {
        console.error('stdout error:', err);
      }
    });
  }

  if (process.stderr) {
    process.stderr.on('error', (err) => {
      if (!isBrokenPipeError(err)) {
        console.error('stderr error:', err);
      }
    });
  }

  process.on('uncaughtException', (err) => {
    if (!isBrokenPipeError(err)) {
      console.error('uncaught exception:', err);
    }
  });
}

app.whenReady().then(async () => {
  airportStore = new AirportStore({
    cachePath: path.join(app.getPath('userData'), 'airportgap-airports-cache.json'),
    client: airportGapClient,
  });

  await airportStore.loadDiskCache();

  configureMapTileHeaders();
  registerAirportIpcHandlers({ ipcMain, store: airportStore, client: airportGapClient });

  airportStore.startBackgroundCrawl();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

installProcessErrorHandlers();

app.on('before-quit', () => {
  if (airportStore) {
    void airportStore.saveDiskCache().catch(() => {});
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
