import { useState, useMemo, useCallback } from 'react';

/**
 * SCENARIO: Memo & Callback Mismatch
 *
 * - useMemo whose deps change every render but the result is always the same
 * - useCallback that depends on a value that changes every render
 * - useMemo with proper stable deps (control)
 *
 * The agent should detect memo-compute events with recomputedButUnchanged: true.
 */

function ExpensiveFormatter({ data }: { data: string[] }) {
  const [renderCount, setRenderCount] = useState(0);

  // BUG: deps include `data` which is a new array ref every render,
  // but the formatted result is always identical
  const formatted = useMemo(() => {
    return data.map(d => d.toUpperCase()).join(', ');
  }, [data]);

  // BUG: callback depends on `data` ref — new function every render
  const handleClick = useCallback(() => {
    console.log('Items:', data.length);
  }, [data]);

  return (
    <div className="rounded border border-gray-800 bg-gray-900 p-3">
      <div className="text-xs text-gray-500">ExpensiveFormatter</div>
      <div className="mt-1 text-sm">{formatted}</div>
      <div className="mt-1 text-xs text-gray-600">
        useMemo recomputes every render — result is always the same
      </div>
      <button
        onClick={() => { handleClick(); setRenderCount(c => c + 1); }}
        className="mt-2 rounded bg-gray-700 px-3 py-1 text-xs hover:bg-gray-600"
      >
        Trigger ({renderCount})
      </button>
    </div>
  );
}

function StableMemo() {
  const [count, setCount] = useState(0);

  const doubled = useMemo(() => count * 2, [count]);
  const label = useMemo(() => `Count is ${doubled}`, [doubled]);

  return (
    <div className="rounded border border-gray-800 bg-gray-900 p-3">
      <div className="text-xs text-gray-500">StableMemo (control)</div>
      <div className="mt-1 text-sm">{label}</div>
      <div className="mt-1 text-xs text-gray-600">Proper deps — recomputes only when count changes</div>
      <button
        onClick={() => setCount(c => c + 1)}
        className="mt-2 rounded bg-gray-700 px-3 py-1 text-xs hover:bg-gray-600"
      >
        Increment ({count})
      </button>
    </div>
  );
}

function WastedCallback() {
  const [tick, setTick] = useState(0);

  // BUG: object dep in useCallback changes every render
  const config = { retries: 3 };
  const fetchData = useCallback(() => {
    return fetch('/api/data', { headers: { 'X-Retries': String(config.retries) } });
  }, [config]); // eslint-disable-line — intentionally wrong

  void fetchData;

  return (
    <div className="rounded border border-gray-800 bg-gray-900 p-3">
      <div className="text-xs text-gray-500">WastedCallback</div>
      <div className="mt-1 text-sm text-amber-400">useCallback with inline obj dep</div>
      <div className="mt-1 text-xs text-gray-600">New function ref every render — defeats the purpose</div>
      <button
        onClick={() => setTick(t => t + 1)}
        className="mt-2 rounded bg-gray-700 px-3 py-1 text-xs hover:bg-gray-600"
      >
        Render ({tick})
      </button>
    </div>
  );
}

export function MemoMismatchScenario() {
  const [parentTick, setParentTick] = useState(0);

  // BUG: creates a new array reference with the same contents
  const items = ['react', 'insight', 'demo'];

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        useMemo and useCallback with unstable deps. The agent should detect
        <code className="mx-1 rounded bg-gray-800 px-1 text-indigo-300">recomputedButUnchanged: true</code>
        and flag unstable callback references.
      </p>

      <button
        onClick={() => setParentTick(t => t + 1)}
        className="rounded bg-amber-600 px-4 py-2 text-sm font-medium hover:bg-amber-500"
      >
        Re-render parent ({parentTick})
      </button>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ExpensiveFormatter data={items} />
        <StableMemo />
        <WastedCallback />
      </div>
    </div>
  );
}
