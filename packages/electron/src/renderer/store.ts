import { create } from 'zustand';

declare global {
  interface Window {
    insightAPI: {
      getSessions(): Promise<any[]>;
      getEvents(query: any): Promise<any[]>;
      getEvent(id: number): Promise<any>;
      getComponentHistory(componentId: string): Promise<any[]>;
      getEventCount(sessionId?: string): Promise<number>;
      clearEvents(): Promise<void>;
      clearSession(sessionId: string): Promise<void>;
      toggleRecording(): Promise<boolean>;
      isRecording(): Promise<boolean>;
      openInEditor(file: string, line: number): Promise<void>;
      onNewEvents(callback: (events: any[]) => void): () => void;
      onEventsCleared(callback: () => void): () => void;
      onSessionStarted(callback: (session: any) => void): () => void;
      onSessionEnded(callback: (sessionId: string) => void): () => void;
    };
  }
}

export interface InsightEventItem {
  id: string;
  dbId?: number;
  timestamp: number;
  type: string;
  componentId?: string;
  componentName?: string;
  reasons?: any[];
  renderCount?: number;
  duration?: number | null;
  sourceLocation?: { file: string; line: number; column: number } | null;
  hookIndex?: number;
  effectType?: string;
  depsChanged?: any[];
  previousValue?: any;
  nextValue?: any;
  previousDeps?: any[];
  currentDeps?: any[];
  result?: any;
  recomputedButUnchanged?: boolean;
  parentId?: string | null;
  _sessionId?: string;
  [key: string]: any;
}

export interface Session {
  id: string;
  name: string;
  url: string;
  reactVersion: string;
  startedAt: number;
  endedAt?: number;
}

export interface Filters {
  types: Set<string>;
  componentName: string;
  wastedOnly: boolean;
}

interface InsightStore {
  events: InsightEventItem[];
  selectedEventId: string | null;
  selectedEvent: InsightEventItem | null;
  sessions: Session[];
  activeSessionId: string | null;
  isRecording: boolean;
  isConnected: boolean;
  filters: Filters;
  eventCount: number;

  addEvents: (events: InsightEventItem[]) => void;
  selectEvent: (id: string | null) => void;
  setRecording: (recording: boolean) => void;
  setConnected: (connected: boolean) => void;
  clearEvents: () => void;
  addSession: (session: Session) => void;
  endSession: (sessionId: string) => void;
  setFilters: (update: Partial<Filters>) => void;
  toggleType: (type: string) => void;
}

const ALL_TYPES = new Set(['render', 'state-change', 'effect-fire', 'memo-compute', 'mount', 'unmount', 'context-provide', 'interaction']);

const MAX_EVENTS = 5000;

export const useInsightStore = create<InsightStore>((set, get) => ({
  events: [],
  selectedEventId: null,
  selectedEvent: null,
  sessions: [],
  activeSessionId: null,
  isRecording: true,
  isConnected: false,
  filters: {
    types: new Set(ALL_TYPES),
    componentName: '',
    wastedOnly: false,
  },
  eventCount: 0,

  addEvents: (newEvents) => {
    set((state) => {
      const combined = [...newEvents, ...state.events];
      const trimmed = combined.length > MAX_EVENTS ? combined.slice(0, MAX_EVENTS) : combined;
      return {
        events: trimmed,
        eventCount: state.eventCount + newEvents.length,
        isConnected: true,
      };
    });
  },

  selectEvent: (id) => {
    const state = get();
    const event = id ? state.events.find(e => e.id === id) ?? null : null;
    set({ selectedEventId: id, selectedEvent: event });
  },

  setRecording: (recording) => set({ isRecording: recording }),
  setConnected: (connected) => set({ isConnected: connected }),

  clearEvents: () => set({
    events: [],
    selectedEventId: null,
    selectedEvent: null,
    eventCount: 0,
  }),

  addSession: (session) => set((state) => ({
    sessions: [session, ...state.sessions.filter(s => s.id !== session.id)],
    activeSessionId: session.id,
  })),

  endSession: (sessionId) => set((state) => ({
    sessions: state.sessions.map(s =>
      s.id === sessionId ? { ...s, endedAt: Date.now() } : s
    ),
  })),

  setFilters: (update) => set((state) => ({
    filters: { ...state.filters, ...update },
  })),

  toggleType: (type) => set((state) => {
    const types = new Set(state.filters.types);
    if (types.has(type)) types.delete(type);
    else types.add(type);
    return { filters: { ...state.filters, types } };
  }),
}));
