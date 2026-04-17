import { useMemo, useRef, useEffect } from 'react';
import { useInsightStore, type InsightEventItem } from '../store';

const TYPE_COLORS: Record<string, string> = {
  'render': 'bg-insight-render/20 text-insight-render',
  'state-change': 'bg-insight-state/20 text-insight-state',
  'effect-fire': 'bg-insight-effect/20 text-insight-effect',
  'memo-compute': 'bg-insight-memo/20 text-insight-memo',
  'mount': 'bg-insight-mount/20 text-insight-mount',
  'unmount': 'bg-insight-unmount/20 text-insight-unmount',
  'context-provide': 'bg-amber-500/20 text-amber-400',
  'interaction': 'bg-insight-interaction/20 text-insight-interaction',
};

const TYPE_LABELS: Record<string, string> = {
  'render': 'render',
  'state-change': 'state',
  'effect-fire': 'effect',
  'memo-compute': 'memo',
  'mount': 'mount',
  'unmount': 'unmount',
  'context-provide': 'context',
  'interaction': 'interaction',
};

function summarize(event: InsightEventItem): string {
  switch (event.type) {
    case 'render': {
      const reasons = event.reasons || [];
      const first = reasons[0];
      if (!first) return 'rendered';
      switch (first.type) {
        case 'initial-mount': return 'initial mount';
        case 'prop-change': {
          const wasted = first.deepEqual ? ' (wasted)' : '';
          return `prop "${first.propName}" changed${wasted}`;
        }
        case 'state-change': return `state changed (hook #${first.hookIndex})`;
        case 'context-change': return 'context changed';
        case 'parent-render': return 'parent re-rendered';
        case 'force-update': return 'force update';
        default: return 'rendered';
      }
    }
    case 'state-change':
      return `hook #${event.hookIndex ?? '?'} updated`;
    case 'effect-fire':
      return `${event.effectType || 'effect'} fired`;
    case 'memo-compute':
      return event.recomputedButUnchanged
        ? 'recomputed (same result — perf smell)'
        : 'recomputed';
    case 'mount':
      return 'mounted';
    case 'unmount':
      return 'unmounted';
    case 'context-provide':
      return 'value changed';
    case 'interaction':
      return event.interactionType || 'interaction';
    default:
      return event.type;
  }
}

function isWasted(event: InsightEventItem): boolean {
  if (event.type !== 'render') return false;
  const reasons = event.reasons || [];
  return reasons.some((r: any) =>
    (r.type === 'prop-change' && r.deepEqual) ||
    r.type === 'parent-render'
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

export function EventStream() {
  const events = useInsightStore(s => s.events);
  const filters = useInsightStore(s => s.filters);
  const selectedEventId = useInsightStore(s => s.selectedEventId);
  const selectEvent = useInsightStore(s => s.selectEvent);
  const toggleType = useInsightStore(s => s.toggleType);
  const setFilters = useInsightStore(s => s.setFilters);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (!filters.types.has(e.type)) return false;
      if (filters.componentName && e.componentName &&
          !e.componentName.toLowerCase().includes(filters.componentName.toLowerCase())) return false;
      if (filters.wastedOnly && !isWasted(e)) return false;
      return true;
    });
  }, [events, filters]);

  // Auto-scroll when new events arrive (only if already at top)
  const prevCount = useRef(filteredEvents.length);
  useEffect(() => {
    if (filteredEvents.length > prevCount.current && listRef.current) {
      if (listRef.current.scrollTop < 50) {
        listRef.current.scrollTop = 0;
      }
    }
    prevCount.current = filteredEvents.length;
  }, [filteredEvents.length]);

  const allTypes = ['render', 'state-change', 'effect-fire', 'memo-compute', 'mount', 'unmount'];

  return (
    <div className="flex w-[42%] min-w-[320px] flex-col border-r border-slate-800">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800/60 px-3 py-2">
        {allTypes.map(type => (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
              filters.types.has(type)
                ? TYPE_COLORS[type] || 'bg-slate-700 text-slate-300'
                : 'bg-slate-800/40 text-slate-600'
            }`}
          >
            {TYPE_LABELS[type] || type}
          </button>
        ))}
        <div className="mx-1 h-3 w-px bg-slate-800" />
        <button
          onClick={() => setFilters({ wastedOnly: !filters.wastedOnly })}
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
            filters.wastedOnly ? 'bg-insight-warn/20 text-insight-warn' : 'bg-slate-800/40 text-slate-600'
          }`}
        >
          wasted only
        </button>
        <input
          type="text"
          placeholder="Filter component…"
          value={filters.componentName}
          onChange={e => setFilters({ componentName: e.target.value })}
          className="ml-auto w-32 rounded bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-300 outline-none placeholder:text-slate-600 focus:ring-1 focus:ring-insight-blue/50"
        />
      </div>

      {/* Event list */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="text-sm text-slate-600">No events yet</div>
              <div className="mt-1 text-xs text-slate-700">
                Import @react-insight/agent in your app to start
              </div>
            </div>
          </div>
        ) : (
          filteredEvents.map(event => (
            <EventRow
              key={event.id}
              event={event}
              isSelected={event.id === selectedEventId}
              onSelect={() => selectEvent(event.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function EventRow({
  event,
  isSelected,
  onSelect,
}: {
  event: InsightEventItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const wasted = isWasted(event);

  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-2 border-b border-slate-800/40 px-3 py-1.5 text-left transition ${
        isSelected
          ? 'bg-insight-blue/10 border-l-2 border-l-insight-blue'
          : 'hover:bg-slate-800/30 border-l-2 border-l-transparent'
      }`}
    >
      {/* Timestamp */}
      <span className="shrink-0 text-[10px] tabular-nums text-slate-600">
        {formatTime(event.timestamp)}
      </span>

      {/* Type badge */}
      <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-medium ${TYPE_COLORS[event.type] || 'bg-slate-700 text-slate-400'}`}>
        {TYPE_LABELS[event.type] || event.type}
      </span>

      {/* Component name */}
      {event.componentName && (
        <span className="shrink-0 text-xs font-medium text-slate-200">
          {event.componentName}
        </span>
      )}

      {/* Summary */}
      <span className={`min-w-0 truncate text-[11px] ${wasted ? 'text-insight-warn' : 'text-slate-500'}`}>
        {summarize(event)}
      </span>

      {/* Duration */}
      {event.duration != null && event.duration > 0 && (
        <span className={`ml-auto shrink-0 text-[10px] tabular-nums ${event.duration > 16 ? 'text-insight-warn' : 'text-slate-600'}`}>
          {event.duration.toFixed(1)}ms
        </span>
      )}

      {/* Render count badge */}
      {event.type === 'render' && event.renderCount != null && event.renderCount > 1 && (
        <span className="shrink-0 rounded-full bg-slate-800 px-1.5 text-[10px] tabular-nums text-slate-500">
          ×{event.renderCount}
        </span>
      )}
    </button>
  );
}
