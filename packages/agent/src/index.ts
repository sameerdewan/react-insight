export { configure } from './config';
export type { AgentConfig, InsightEvent, AgentMessage, RenderEvent, StateChangeEvent } from './types';

import { getConfig, configure } from './config';
import { attach } from './hook';
import { createTransport } from './transport';

let initialized = false;

function init() {
  if (initialized) return;
  initialized = true;

  const config = getConfig();
  if (!config.enabled) return;

  const transport = createTransport(config);
  attach(transport);

  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log(
      '%c[React Insight]%c Agent attached — streaming to ws://%s:%d',
      'color: #6366f1; font-weight: bold',
      'color: inherit',
      config.host,
      config.port,
    );
  }
}

// Auto-initialize on import
init();

export { configure as reconfigure };
