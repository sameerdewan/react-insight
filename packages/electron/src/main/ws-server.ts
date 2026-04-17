import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import type { BrowserWindow } from 'electron';

export interface AgentConnection {
  id: string;
  sessionId: string;
  ws: WebSocket;
  agentVersion?: string;
  reactVersion?: string;
  sessionName?: string;
  url?: string;
}

export interface WSServerCallbacks {
  onHello(conn: AgentConnection, msg: any): void;
  onEvents(conn: AgentConnection, events: any[]): void;
  onDisconnect(conn: AgentConnection): void;
}

export class InsightWSServer {
  private wss: WebSocketServer;
  private connections = new Map<string, AgentConnection>();

  constructor(
    private port: number,
    private callbacks: WSServerCallbacks,
  ) {
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws) => {
      const conn: AgentConnection = {
        id: randomUUID(),
        sessionId: randomUUID(),
        ws,
      };
      this.connections.set(conn.id, conn);

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleMessage(conn, msg);
        } catch {
          /* malformed message */
        }
      });

      ws.on('close', () => {
        this.connections.delete(conn.id);
        this.callbacks.onDisconnect(conn);
      });

      ws.on('error', () => {
        ws.close();
      });
    });
  }

  private handleMessage(conn: AgentConnection, msg: any) {
    switch (msg.type) {
      case 'hello':
        conn.agentVersion = msg.agentVersion;
        conn.reactVersion = msg.reactVersion;
        conn.sessionName = msg.sessionName;
        conn.url = msg.url;
        this.callbacks.onHello(conn, msg);
        break;

      case 'event':
        if (msg.event) {
          this.callbacks.onEvents(conn, [msg.event]);
        }
        break;

      case 'batch':
        if (Array.isArray(msg.events)) {
          this.callbacks.onEvents(conn, msg.events);
        }
        break;

      case 'heartbeat':
        break;
    }
  }

  getConnections(): AgentConnection[] {
    return Array.from(this.connections.values());
  }

  close() {
    this.wss.close();
  }
}
