import { useState, useEffect } from 'react';

/**
 * SCENARIO: Large State Churn
 *
 * - useState holding a big object (>10KB) that gets fully replaced on updates
 * - Frequent updates that create GC pressure
 * - Contrast with a version that patches instead of replaces
 *
 * The agent should serialize the state values (truncated) and show
 * the churn pattern in the event stream.
 */

interface DataRow {
  id: number;
  name: string;
  email: string;
  score: number;
  tags: string[];
  metadata: Record<string, string>;
}

function generateRows(count: number, seed: number): DataRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    name: `User ${i + seed}`,
    email: `user${i + seed}@example.com`,
    score: Math.round(Math.sin(i + seed) * 100),
    tags: ['active', i % 2 === 0 ? 'premium' : 'free', `cohort-${(i % 5) + 1}`],
    metadata: {
      region: ['us-east', 'eu-west', 'ap-south'][i % 3],
      plan: ['starter', 'pro', 'enterprise'][i % 3],
      source: 'api',
    },
  }));
}

function DataTable({ rows }: { rows: DataRow[] }) {
  return (
    <div className="max-h-64 overflow-auto rounded border border-gray-800">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-gray-900">
          <tr className="border-b border-gray-800">
            <th className="px-2 py-1 text-left font-medium text-gray-500">ID</th>
            <th className="px-2 py-1 text-left font-medium text-gray-500">Name</th>
            <th className="px-2 py-1 text-left font-medium text-gray-500">Score</th>
            <th className="px-2 py-1 text-left font-medium text-gray-500">Tags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-b border-gray-800/50">
              <td className="px-2 py-1 tabular-nums text-gray-600">{row.id}</td>
              <td className="px-2 py-1 text-gray-300">{row.name}</td>
              <td className={`px-2 py-1 tabular-nums ${row.score > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {row.score}
              </td>
              <td className="px-2 py-1 text-gray-500">{row.tags.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FullReplaceTable() {
  const [data, setData] = useState(() => generateRows(100, 0));
  const [updateCount, setUpdateCount] = useState(0);

  const refresh = () => {
    // ANTI-PATTERN: full replacement of a large state object
    setData(generateRows(100, updateCount + 1));
    setUpdateCount(c => c + 1);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">Full Replace ({data.length} rows × ~200B each)</div>
          <div className="text-xs text-amber-400">~20KB replaced on every refresh</div>
        </div>
        <button
          onClick={refresh}
          className="rounded bg-amber-600 px-3 py-1 text-xs font-medium hover:bg-amber-500"
        >
          Refresh ({updateCount})
        </button>
      </div>
      <DataTable rows={data} />
    </div>
  );
}

function AutoChurnTable() {
  const [data, setData] = useState(() => generateRows(50, 0));
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    let tick = 0;
    const id = setInterval(() => {
      tick++;
      setData(generateRows(50, tick));
    }, 500);
    return () => clearInterval(id);
  }, [running]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">Auto Churn (50 rows, every 500ms)</div>
          <div className={`text-xs ${running ? 'text-red-400' : 'text-gray-600'}`}>
            {running ? 'Churning — watch the event stream fill up' : 'Stopped'}
          </div>
        </div>
        <button
          onClick={() => setRunning(r => !r)}
          className={`rounded px-3 py-1 text-xs font-medium ${
            running ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'
          }`}
        >
          {running ? 'Stop' : 'Start'}
        </button>
      </div>
      <DataTable rows={data} />
    </div>
  );
}

export function LargeStateChurnScenario() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-400">
        Large state objects replaced in full on every update. The agent should
        show serialized state diffs and flag the churn pattern in diagnostics.
      </p>

      <FullReplaceTable />
      <AutoChurnTable />
    </div>
  );
}
