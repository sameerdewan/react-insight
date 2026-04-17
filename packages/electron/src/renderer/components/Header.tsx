import { useInsightStore } from '../store';

export function Header() {
  const isRecording = useInsightStore(s => s.isRecording);
  const isConnected = useInsightStore(s => s.isConnected);
  const setRecording = useInsightStore(s => s.setRecording);
  const clearEvents = useInsightStore(s => s.clearEvents);
  const eventCount = useInsightStore(s => s.eventCount);
  const sessions = useInsightStore(s => s.sessions);

  async function handleToggleRecording() {
    if (!window.insightAPI) return;
    const recording = await window.insightAPI.toggleRecording();
    setRecording(recording);
  }

  async function handleClear() {
    if (!window.insightAPI) {
      clearEvents();
      return;
    }
    await window.insightAPI.clearEvents();
  }

  const activeSession = sessions[0];

  return (
    <header className="drag-region flex h-12 items-center gap-3 border-b border-slate-800 bg-slate-900 px-4">
      {/* macOS traffic light spacer */}
      <div className="w-16 shrink-0" />

      {/* Recording indicator */}
      <div className="no-drag flex items-center gap-2">
        <div className={`h-2.5 w-2.5 rounded-full ${isRecording ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]' : 'bg-slate-600'}`} />
        <span className="text-xs font-medium text-slate-400">
          {isRecording ? 'Recording' : 'Paused'}
        </span>
      </div>

      {/* Connection status */}
      <div className="no-drag flex items-center gap-1.5">
        <div className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-slate-600'}`} />
        <span className="text-xs text-slate-500">
          {isConnected ? 'Connected' : 'Waiting for agent…'}
        </span>
      </div>

      {/* Session name */}
      {activeSession && (
        <div className="no-drag rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
          {activeSession.name}
        </div>
      )}

      <div className="flex-1" />

      {/* Event counter */}
      <span className="text-xs tabular-nums text-slate-500">
        {eventCount.toLocaleString()} events
      </span>

      {/* Controls */}
      <div className="no-drag flex items-center gap-1">
        <button
          onClick={handleToggleRecording}
          className="rounded px-2.5 py-1 text-xs font-medium transition hover:bg-slate-800 text-slate-300"
        >
          {isRecording ? 'Pause' : 'Resume'}
        </button>
        <button
          onClick={handleClear}
          className="rounded px-2.5 py-1 text-xs font-medium transition hover:bg-slate-800 text-slate-400"
        >
          Clear
        </button>
      </div>
    </header>
  );
}
