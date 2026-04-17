import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export interface StoredEvent {
  id: number;
  timestamp: number;
  session_id: string;
  type: string;
  component_id: string | null;
  component_name: string | null;
  causality_parent_id: number | null;
  payload: string;
}

export interface EventQuery {
  sessionId?: string;
  types?: string[];
  componentId?: string;
  componentName?: string;
  limit?: number;
  offset?: number;
  after?: number;
  before?: number;
}

export interface SessionRecord {
  id: string;
  name: string | null;
  url: string | null;
  react_version: string | null;
  started_at: number;
  ended_at: number | null;
}

export class EventStore {
  private db: Database.Database;
  private insertEventStmt: Database.Statement;
  private insertComponentStmt: Database.Statement;
  private upsertSessionStmt: Database.Statement;
  private buffer: any[] = [];
  private flushInterval: ReturnType<typeof setInterval>;

  constructor(dbPath?: string) {
    if (!dbPath) {
      const sessionsDir = path.join(app.getPath('userData'), 'sessions');
      fs.mkdirSync(sessionsDir, { recursive: true });
      dbPath = path.join(sessionsDir, `session-${Date.now()}.db`);
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    this.createTables();

    this.insertEventStmt = this.db.prepare(`
      INSERT INTO events (timestamp, session_id, type, component_id, component_name, causality_parent_id, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    this.insertComponentStmt = this.db.prepare(`
      INSERT OR IGNORE INTO components (id, name, source_file, source_line, first_seen)
      VALUES (?, ?, ?, ?, ?)
    `);

    this.upsertSessionStmt = this.db.prepare(`
      INSERT INTO sessions (id, name, url, react_version, started_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = COALESCE(excluded.name, sessions.name),
        url = COALESCE(excluded.url, sessions.url),
        react_version = COALESCE(excluded.react_version, sessions.react_version)
    `);

    this.flushInterval = setInterval(() => this.flush(), 100);
  }

  private createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        component_id TEXT,
        component_name TEXT,
        causality_parent_id INTEGER,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_component ON events(component_id);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
      CREATE INDEX IF NOT EXISTS idx_events_causality ON events(causality_parent_id);
      CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);

      CREATE TABLE IF NOT EXISTS components (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source_file TEXT,
        source_line INTEGER,
        first_seen INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT,
        url TEXT,
        react_version TEXT,
        started_at INTEGER NOT NULL,
        ended_at INTEGER
      );
    `);
  }

  upsertSession(id: string, name: string | null, url: string | null, reactVersion: string | null) {
    this.upsertSessionStmt.run(id, name, url, reactVersion, Date.now());
  }

  addEvent(sessionId: string, event: any) {
    this.buffer.push({ sessionId, event });
  }

  addEvents(sessionId: string, events: any[]) {
    for (const event of events) {
      this.buffer.push({ sessionId, event });
    }
  }

  private flush() {
    if (this.buffer.length === 0) return;

    const batch = this.buffer;
    this.buffer = [];

    const tx = this.db.transaction(() => {
      for (const { sessionId, event } of batch) {
        this.insertEventStmt.run(
          event.timestamp || Date.now(),
          sessionId,
          event.type,
          event.componentId || null,
          event.componentName || null,
          event.causalityParentId || null,
          JSON.stringify(event),
        );

        if (event.componentId && event.componentName) {
          this.insertComponentStmt.run(
            event.componentId,
            event.componentName,
            event.sourceLocation?.file || null,
            event.sourceLocation?.line || null,
            event.timestamp || Date.now(),
          );
        }
      }
    });

    tx();
  }

  getSessions(): SessionRecord[] {
    return this.db.prepare('SELECT * FROM sessions ORDER BY started_at DESC').all() as SessionRecord[];
  }

  getEvents(query: EventQuery): StoredEvent[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (query.sessionId) {
      conditions.push('session_id = ?');
      params.push(query.sessionId);
    }
    if (query.types && query.types.length > 0) {
      conditions.push(`type IN (${query.types.map(() => '?').join(',')})`);
      params.push(...query.types);
    }
    if (query.componentId) {
      conditions.push('component_id = ?');
      params.push(query.componentId);
    }
    if (query.componentName) {
      conditions.push('component_name LIKE ?');
      params.push(`%${query.componentName}%`);
    }
    if (query.after) {
      conditions.push('timestamp > ?');
      params.push(query.after);
    }
    if (query.before) {
      conditions.push('timestamp < ?');
      params.push(query.before);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = query.limit || 1000;
    const offset = query.offset || 0;

    return this.db.prepare(
      `SELECT * FROM events ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as StoredEvent[];
  }

  getEvent(id: number): StoredEvent | undefined {
    return this.db.prepare('SELECT * FROM events WHERE id = ?').get(id) as StoredEvent | undefined;
  }

  getComponentHistory(componentId: string): StoredEvent[] {
    return this.db.prepare(
      'SELECT * FROM events WHERE component_id = ? ORDER BY timestamp DESC LIMIT 500'
    ).all(componentId) as StoredEvent[];
  }

  getEventCount(sessionId?: string): number {
    if (sessionId) {
      return (this.db.prepare('SELECT COUNT(*) as count FROM events WHERE session_id = ?').get(sessionId) as any).count;
    }
    return (this.db.prepare('SELECT COUNT(*) as count FROM events').get() as any).count;
  }

  clearSession(sessionId: string) {
    this.db.prepare('DELETE FROM events WHERE session_id = ?').run(sessionId);
    this.db.prepare('DELETE FROM components').run();
  }

  clearAll() {
    this.db.prepare('DELETE FROM events').run();
    this.db.prepare('DELETE FROM components').run();
    this.db.prepare('DELETE FROM sessions').run();
  }

  endSession(sessionId: string) {
    this.db.prepare('UPDATE sessions SET ended_at = ? WHERE id = ?').run(Date.now(), sessionId);
  }

  close() {
    clearInterval(this.flushInterval);
    this.flush();
    this.db.close();
  }
}
