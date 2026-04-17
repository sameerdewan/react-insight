import type { AgentConfig, InsightEvent, AgentMessage } from './types';

export interface Transport {
  send(event: InsightEvent): void;
  destroy(): void;
}

export function createTransport(config: AgentConfig): Transport {
  let ws: WebSocket | null = null;
  let buffer: InsightEvent[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let connected = false;
  let destroyed = false;
  let helloSent = false;

  function connect() {
    if (destroyed) return;
    try {
      ws = new WebSocket(`ws://${config.host}:${config.port}`);
    } catch {
      scheduleRetry();
      return;
    }

    ws.onopen = () => {
      connected = true;
      if (!helloSent) {
        sendHello();
        helloSent = true;
      }
      heartbeatTimer = setInterval(() => {
        sendRaw({ type: 'heartbeat' });
      }, 30_000);
      flush();
    };

    ws.onclose = () => {
      connected = false;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = null;
      helloSent = false;
      scheduleRetry();
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  function sendHello() {
    let reactVersion = 'unknown';
    try {
      const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (hook?.renderers) {
        for (const [, renderer] of hook.renderers) {
          if (renderer?.version) { reactVersion = renderer.version; break; }
        }
      }
    } catch { /* ok */ }

    const msg: AgentMessage = {
      type: 'hello',
      agentVersion: '0.1.0',
      reactVersion,
      sessionName: document.title || location.hostname,
      url: location.href,
    };
    sendRaw(msg);
  }

  function sendRaw(msg: AgentMessage) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try { ws.send(JSON.stringify(msg)); } catch { /* connection lost */ }
  }

  function scheduleRetry() {
    if (destroyed || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, 3_000);
  }

  function flush() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (!connected || buffer.length === 0) return;

    const events = buffer;
    buffer = [];

    sendRaw({ type: 'batch', events });
  }

  function send(event: InsightEvent) {
    if (destroyed) return;

    buffer.push(event);

    // Backpressure: drop oldest if exceeding rate limit
    if (buffer.length > config.maxEventsPerSecond) {
      buffer = buffer.slice(buffer.length - config.maxEventsPerSecond);
    }

    if (buffer.length >= 100) {
      flush();
    } else if (!flushTimer) {
      flushTimer = setTimeout(flush, 16);
    }
  }

  function destroy() {
    destroyed = true;
    flush();
    if (flushTimer) clearTimeout(flushTimer);
    if (retryTimer) clearTimeout(retryTimer);
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    ws?.close();
  }

  connect();

  return { send, destroy };
}
