import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('insightAPI', {
  getSessions: () => ipcRenderer.invoke('get-sessions'),
  getEvents: (query: any) => ipcRenderer.invoke('get-events', query),
  getEvent: (id: number) => ipcRenderer.invoke('get-event', id),
  getComponentHistory: (componentId: string) => ipcRenderer.invoke('get-component-history', componentId),
  getEventCount: (sessionId?: string) => ipcRenderer.invoke('get-event-count', sessionId),
  clearEvents: () => ipcRenderer.invoke('clear-events'),
  clearSession: (sessionId: string) => ipcRenderer.invoke('clear-session', sessionId),
  toggleRecording: () => ipcRenderer.invoke('toggle-recording'),
  isRecording: () => ipcRenderer.invoke('is-recording'),
  openInEditor: (file: string, line: number) => ipcRenderer.invoke('open-in-editor', file, line),

  onNewEvents: (callback: (events: any[]) => void) => {
    const handler = (_: any, events: any[]) => callback(events);
    ipcRenderer.on('new-events', handler);
    return () => { ipcRenderer.removeListener('new-events', handler); };
  },

  onEventsCleared: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('events-cleared', handler);
    return () => { ipcRenderer.removeListener('events-cleared', handler); };
  },

  onSessionStarted: (callback: (session: any) => void) => {
    const handler = (_: any, session: any) => callback(session);
    ipcRenderer.on('session-started', handler);
    return () => { ipcRenderer.removeListener('session-started', handler); };
  },

  onSessionEnded: (callback: (sessionId: string) => void) => {
    const handler = (_: any, sessionId: string) => callback(sessionId);
    ipcRenderer.on('session-ended', handler);
    return () => { ipcRenderer.removeListener('session-ended', handler); };
  },
});
