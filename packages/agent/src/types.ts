// ── Agent configuration ──

export interface AgentConfig {
  port: number;
  host: string;
  enabled: boolean;
  maxEventsPerSecond: number;
  serializationDepth: number;
}

// ── Source locations ──

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
}

// ── Render reasons ──

export type RenderReason =
  | { type: 'initial-mount' }
  | { type: 'prop-change'; propName: string; shallowEqual: boolean; deepEqual: boolean }
  | { type: 'state-change'; hookIndex: number }
  | { type: 'context-change'; contextId?: string }
  | { type: 'parent-render' }
  | { type: 'force-update' };

// ── Dep change descriptor ──

export interface DepsChange {
  index: number;
  changeType: 'reference' | 'primitive' | 'deep';
}

// ── Serialized values (JSON-safe) ──

export type SerializedValue =
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean }
  | { type: 'null' }
  | { type: 'undefined' }
  | { type: 'symbol'; value: string }
  | { type: 'bigint'; value: string }
  | { type: 'function'; name: string }
  | { type: 'array'; items: SerializedValue[]; length: number; truncated?: boolean }
  | { type: 'object'; entries: Record<string, SerializedValue>; totalKeys: number; truncated?: boolean; className?: string }
  | { type: 'map'; entries: [SerializedValue, SerializedValue][]; size: number }
  | { type: 'set'; items: SerializedValue[]; size: number }
  | { type: 'date'; value: string }
  | { type: 'regexp'; value: string }
  | { type: 'error'; name: string; message: string }
  | { type: 'dom'; tag: string; id?: string }
  | { type: 'react-element'; name: string }
  | { type: 'circular' }
  | { type: 'truncated' };

// ── Events ──

interface BaseEvent {
  id: string;
  timestamp: number;
  causalityParentId?: string;
}

export interface RenderEvent extends BaseEvent {
  type: 'render';
  componentId: string;
  componentName: string;
  duration: number | null;
  reasons: RenderReason[];
  sourceLocation: SourceLocation | null;
  renderCount: number;
}

export interface StateChangeEvent extends BaseEvent {
  type: 'state-change';
  componentId: string;
  componentName: string;
  hookIndex: number;
  hookName: string;
  previousValue: SerializedValue;
  nextValue: SerializedValue;
  setterSource?: string;
}

export interface EffectFireEvent extends BaseEvent {
  type: 'effect-fire';
  componentId: string;
  componentName: string;
  hookIndex: number;
  effectType: 'effect' | 'layoutEffect' | 'insertionEffect';
  depsChanged: DepsChange[];
  previousDeps: SerializedValue[];
  currentDeps: SerializedValue[];
  cleanupDuration: number | null;
  effectDuration: number | null;
}

export interface MemoComputeEvent extends BaseEvent {
  type: 'memo-compute';
  componentId: string;
  componentName: string;
  hookIndex: number;
  depsChanged: DepsChange[];
  duration: number | null;
  result: SerializedValue;
  recomputedButUnchanged: boolean;
}

export interface MountEvent extends BaseEvent {
  type: 'mount';
  componentId: string;
  componentName: string;
  parentId: string | null;
  sourceLocation: SourceLocation | null;
}

export interface UnmountEvent extends BaseEvent {
  type: 'unmount';
  componentId: string;
  componentName: string;
}

export interface ContextProvideEvent extends BaseEvent {
  type: 'context-provide';
  contextId: string;
  previousValue: SerializedValue;
  nextValue: SerializedValue;
  consumers: string[];
}

export interface InteractionEvent extends BaseEvent {
  type: 'interaction';
  interactionType: string;
  target: string;
  targetSelector: string;
}

export type InsightEvent =
  | RenderEvent
  | StateChangeEvent
  | EffectFireEvent
  | MemoComputeEvent
  | MountEvent
  | UnmountEvent
  | ContextProvideEvent
  | InteractionEvent;

// ── Wire protocol ──

export type AgentMessage =
  | { type: 'hello'; agentVersion: string; reactVersion: string; sessionName: string; url: string }
  | { type: 'event'; event: InsightEvent }
  | { type: 'batch'; events: InsightEvent[] }
  | { type: 'heartbeat' };
