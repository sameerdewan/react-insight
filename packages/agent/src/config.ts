import type { AgentConfig } from './types';

const defaults: AgentConfig = {
  port: 8097,
  host: 'localhost',
  enabled: typeof process !== 'undefined'
    ? process.env?.NODE_ENV === 'development' || process.env?.NODE_ENV === undefined
    : true,
  maxEventsPerSecond: 10_000,
  serializationDepth: 6,
};

let config: AgentConfig = { ...defaults };

export function configure(options: Partial<AgentConfig>): void {
  config = { ...config, ...options };
}

export function getConfig(): AgentConfig {
  return config;
}
