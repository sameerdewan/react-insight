import { useMemo } from 'react';
import { useInsightStore } from '../store';
import { generateExplanation } from '../explanations';

const VERDICT_STYLES: Record<string, string> = {
  wasted: 'bg-insight-warn/10 border-insight-warn/30 text-insight-warn',
  expected: 'bg-insight-state/10 border-insight-state/30 text-insight-state',
  suspicious: 'bg-insight-memo/10 border-insight-memo/30 text-insight-memo',
  info: 'bg-insight-blue/10 border-insight-blue/30 text-insight-blue',
};

const TYPE_ICON: Record<string, string> = {
  render: '🔄',
  'state-change': '📦',
  'effect-fire': '⚡',
  'memo-compute': '🧮',
  mount: '📌',
  unmount: '🗑',
  'context-provide': '🌐',
  interaction: '👆',
};

function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-slate-300">
      {lines.map((line, i) => {
        if (line === '') return <div key={i} className="h-1" />;
        const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        return (
          <p key={i}>
            {parts.map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={j} className="font-semibold text-slate-100">{part.slice(2, -2)}</strong>;
              }
              if (part.startsWith('`') && part.endsWith('`')) {
                return <code key={j} className="rounded bg-slate-800 px-1 py-0.5 text-xs font-mono text-indigo-300">{part.slice(1, -1)}</code>;
              }
              return <span key={j}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}

function PropDiffTable({ reasons }: { reasons: any[] }) {
  const propChanges = reasons.filter((r: any) => r.type === 'prop-change');
  if (propChanges.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Changed Props</h4>
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-left">
              <th className="px-3 py-1.5 font-medium text-slate-500">Prop</th>
              <th className="px-3 py-1.5 font-medium text-slate-500">Ref Changed</th>
              <th className="px-3 py-1.5 font-medium text-slate-500">Deep Equal</th>
              <th className="px-3 py-1.5 font-medium text-slate-500">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {propChanges.map((r: any, i: number) => (
              <tr key={i} className="border-b border-slate-800/50 last:border-0">
                <td className="px-3 py-1.5 font-mono text-indigo-300">{r.propName}</td>
                <td className="px-3 py-1.5 text-slate-400">Yes</td>
                <td className="px-3 py-1.5">
                  <span className={r.deepEqual ? 'text-insight-warn' : 'text-slate-400'}>
                    {r.deepEqual ? 'Yes (wasted)' : 'No'}
                  </span>
                </td>
                <td className="px-3 py-1.5">
                  {r.deepEqual ? (
                    <span className="text-insight-warn">New ref, same value</span>
                  ) : (
                    <span className="text-insight-state">Legitimate change</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EventDetail() {
  const event = useInsightStore(s => s.selectedEvent);

  const explanation = useMemo(
    () => event ? generateExplanation(event) : null,
    [event],
  );

  if (!event || !explanation) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-slate-700">Select an event</div>
          <div className="mt-1 text-sm text-slate-800">
            Click any event in the stream to see a detailed explanation
          </div>
        </div>
      </div>
    );
  }

  const formatTs = (ts: number) => new Date(ts).toLocaleTimeString('en-US', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3,
  } as any);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Event header */}
      <div className="border-b border-slate-800 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">{TYPE_ICON[event.type] || '📋'}</span>
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              {event.componentName || event.type}
            </h2>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
              <span>{event.type}</span>
              <span>·</span>
              <span className="tabular-nums">{formatTs(event.timestamp)}</span>
              {event.duration != null && event.duration > 0 && (
                <>
                  <span>·</span>
                  <span className={`tabular-nums ${event.duration > 16 ? 'text-insight-warn' : ''}`}>
                    {event.duration.toFixed(2)}ms
                  </span>
                </>
              )}
              {event.renderCount != null && (
                <>
                  <span>·</span>
                  <span>render #{event.renderCount}</span>
                </>
              )}
            </div>
          </div>

          {/* Source link */}
          {event.sourceLocation && (
            <button
              onClick={() => window.insightAPI?.openInEditor(
                event.sourceLocation!.file,
                event.sourceLocation!.line,
              )}
              className="ml-auto rounded bg-slate-800 px-2 py-1 text-[11px] font-mono text-indigo-400 transition hover:bg-slate-700"
            >
              {event.sourceLocation.file.split('/').pop()}:{event.sourceLocation.line}
            </button>
          )}
        </div>
      </div>

      {/* Verdict badge */}
      <div className="px-5 pt-4">
        <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${VERDICT_STYLES[explanation.verdict]}`}>
          {explanation.verdict === 'wasted' && <span className="mr-1.5">⚠</span>}
          {explanation.verdict === 'expected' && <span className="mr-1.5">✓</span>}
          {explanation.verdict === 'suspicious' && <span className="mr-1.5">?</span>}
          {explanation.verdictLabel}
        </div>
      </div>

      {/* Explanation prose */}
      <div className="px-5 py-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Explanation</h3>
        <SimpleMarkdown text={explanation.prose} />
      </div>

      {/* Fix suggestion */}
      {explanation.fixSuggestion && (
        <div className="mx-5 mb-4 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-400">Suggested Fix</h4>
          <p className="text-sm leading-relaxed text-slate-300">{explanation.fixSuggestion}</p>
        </div>
      )}

      {/* Prop diff table for renders */}
      {event.type === 'render' && event.reasons && (
        <div className="px-5 pb-4">
          <PropDiffTable reasons={event.reasons} />
        </div>
      )}

      {/* Deps info for effects/memos */}
      {(event.type === 'effect-fire' || event.type === 'memo-compute') && event.depsChanged && event.depsChanged.length > 0 && (
        <div className="px-5 pb-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Dependency Changes</h4>
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            {event.depsChanged.map((d: any, i: number) => (
              <div key={i} className="flex items-center gap-2 py-1 text-xs">
                <span className="font-mono text-slate-400">deps[{d.index}]</span>
                <span className={`rounded px-1.5 py-px ${
                  d.changeType === 'deep' ? 'bg-insight-warn/20 text-insight-warn' :
                  d.changeType === 'reference' ? 'bg-insight-render/20 text-insight-render' :
                  'bg-slate-700 text-slate-400'
                }`}>
                  {d.changeType}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
