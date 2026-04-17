import { ipcMain, shell } from 'electron';
import type { EventStore, EventQuery } from './store';

export function setupIPC(store: EventStore) {
  ipcMain.handle('get-sessions', () => {
    return store.getSessions();
  });

  ipcMain.handle('get-events', (_e, query: EventQuery) => {
    return store.getEvents(query);
  });

  ipcMain.handle('get-event', (_e, id: number) => {
    return store.getEvent(id);
  });

  ipcMain.handle('get-component-history', (_e, componentId: string) => {
    return store.getComponentHistory(componentId);
  });

  ipcMain.handle('get-event-count', (_e, sessionId?: string) => {
    return store.getEventCount(sessionId);
  });

  ipcMain.handle('clear-session', (_e, sessionId: string) => {
    store.clearSession(sessionId);
  });

  ipcMain.handle('clear-all', () => {
    store.clearAll();
  });

  ipcMain.handle('open-in-editor', async (_e, file: string, line: number) => {
    const url = `vscode://file/${encodeURIComponent(file)}:${line}`;
    await shell.openExternal(url);
  });
}
