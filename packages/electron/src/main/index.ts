import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { InsightWSServer } from './ws-server';
import { EventStore } from './store';
import { setupIPC } from './ipc';

let mainWindow: BrowserWindow | null = null;
let wsServer: InsightWSServer | null = null;
let store: EventStore | null = null;
let isPaused = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'React Insight',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    backgroundColor: '#0f172a',
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5188');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startWSServer() {
  store = new EventStore();
  setupIPC(store);

  // Recording controls
  ipcMain.handle('toggle-recording', () => {
    isPaused = !isPaused;
    return !isPaused;
  });

  ipcMain.handle('is-recording', () => {
    return !isPaused;
  });

  wsServer = new InsightWSServer(8097, {
    onHello(conn, msg) {
      store!.upsertSession(conn.sessionId, msg.sessionName, msg.url, msg.reactVersion);
      mainWindow?.webContents.send('session-started', {
        id: conn.sessionId,
        name: msg.sessionName,
        url: msg.url,
        reactVersion: msg.reactVersion,
        startedAt: Date.now(),
      });
    },

    onEvents(conn, events) {
      if (isPaused) return;

      store!.addEvents(conn.sessionId, events);

      // Stream to renderer for live display
      mainWindow?.webContents.send('new-events', events.map(e => ({
        ...e,
        _sessionId: conn.sessionId,
      })));
    },

    onDisconnect(conn) {
      store!.endSession(conn.sessionId);
      mainWindow?.webContents.send('session-ended', conn.sessionId);
    },
  });

  // Handle clear from renderer
  ipcMain.handle('clear-events', () => {
    store!.clearAll();
    mainWindow?.webContents.send('events-cleared');
  });
}

app.whenReady().then(() => {
  startWSServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  wsServer?.close();
  store?.close();
});
