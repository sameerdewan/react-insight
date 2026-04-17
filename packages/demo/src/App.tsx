import { useState } from 'react';
import { InlinePropsScenario } from './scenarios/InlineProps';
import { StateUpdatesScenario } from './scenarios/StateUpdates';
import { ContextThrashScenario } from './scenarios/ContextThrash';
import { ParentCascadeScenario } from './scenarios/ParentCascade';
import { EffectChaosScenario } from './scenarios/EffectChaos';
import { MemoMismatchScenario } from './scenarios/MemoMismatch';
import { MountUnmountScenario } from './scenarios/MountUnmount';
import { LargeStateChurnScenario } from './scenarios/LargeStateChurn';
import { InteractionTrackingScenario } from './scenarios/InteractionTracking';
import { KitchenSinkScenario } from './scenarios/KitchenSink';

const SCENARIOS = [
  {
    id: 'inline-props',
    label: 'Inline Props',
    badge: 'prop-change',
    color: 'text-blue-400',
    description: 'New object references that are deep-equal — wasted renders',
    component: InlinePropsScenario,
  },
  {
    id: 'state-updates',
    label: 'State Updates',
    badge: 'state-change',
    color: 'text-emerald-400',
    description: 'useState, useReducer, and auto-incrementing timers',
    component: StateUpdatesScenario,
  },
  {
    id: 'context-thrash',
    label: 'Context Thrash',
    badge: 'context',
    color: 'text-purple-400',
    description: 'Provider creating new value objects every render',
    component: ContextThrashScenario,
  },
  {
    id: 'parent-cascade',
    label: 'Parent Cascade',
    badge: 'parent-render',
    color: 'text-blue-400',
    description: 'Parent re-render cascading to all un-memoized children',
    component: ParentCascadeScenario,
  },
  {
    id: 'effect-chaos',
    label: 'Effect Chaos',
    badge: 'effect-fire',
    color: 'text-purple-400',
    description: 'Effects with no deps, inline deps, and derived deps',
    component: EffectChaosScenario,
  },
  {
    id: 'memo-mismatch',
    label: 'Memo Mismatch',
    badge: 'memo-compute',
    color: 'text-amber-400',
    description: 'useMemo/useCallback that recompute but return the same value',
    component: MemoMismatchScenario,
  },
  {
    id: 'mount-unmount',
    label: 'Mount / Unmount',
    badge: 'lifecycle',
    color: 'text-cyan-400',
    description: 'Toggle visibility, dynamic lists, tab switching',
    component: MountUnmountScenario,
  },
  {
    id: 'large-state',
    label: 'Large State Churn',
    badge: 'state-change',
    color: 'text-emerald-400',
    description: 'Big objects replaced in state on every update',
    component: LargeStateChurnScenario,
  },
  {
    id: 'interactions',
    label: 'Interactions',
    badge: 'interaction',
    color: 'text-pink-400',
    description: 'Clicks, typing, sliders, form submits',
    component: InteractionTrackingScenario,
  },
  {
    id: 'kitchen-sink',
    label: 'Kitchen Sink',
    badge: 'realistic',
    color: 'text-indigo-400',
    description: 'A mini task-board combining all anti-patterns',
    component: KitchenSinkScenario,
  },
] as const;

export function App() {
  const [activeId, setActiveId] = useState(SCENARIOS[0].id);
  const active = SCENARIOS.find(s => s.id === activeId)!;
  const ActiveComponent = active.component;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-indigo-500" />
            <h1 className="text-sm font-bold tracking-tight">React Insight Demo</h1>
          </div>
          <span className="text-xs text-gray-600">|</span>
          <span className="text-xs text-gray-500">
            Open React Insight desktop app to see events in real time
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar nav */}
        <nav className="w-56 shrink-0 overflow-y-auto border-r border-gray-800 bg-gray-950 py-2">
          {SCENARIOS.map(scenario => (
            <button
              key={scenario.id}
              onClick={() => setActiveId(scenario.id)}
              className={`flex w-full flex-col px-4 py-2 text-left transition ${
                scenario.id === activeId
                  ? 'bg-gray-800/50 border-r-2 border-indigo-500'
                  : 'hover:bg-gray-800/30 border-r-2 border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${scenario.id === activeId ? 'text-white' : 'text-gray-300'}`}>
                  {scenario.label}
                </span>
                <span className={`rounded px-1 text-[10px] ${scenario.color} bg-gray-800`}>
                  {scenario.badge}
                </span>
              </div>
              <span className="mt-0.5 text-[11px] text-gray-600 leading-tight">
                {scenario.description}
              </span>
            </button>
          ))}
        </nav>

        {/* Scenario content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">{active.label}</h2>
            <p className="mt-0.5 text-sm text-gray-500">{active.description}</p>
          </div>
          <ActiveComponent />
        </main>
      </div>
    </div>
  );
}
