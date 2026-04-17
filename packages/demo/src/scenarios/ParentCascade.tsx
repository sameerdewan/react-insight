import { useState, memo, useCallback } from 'react';

/**
 * SCENARIO: Parent Cascade
 *
 * A parent re-renders (via timer or button) and all un-memoized children
 * re-render with no prop/state changes of their own. Demonstrates
 * the "parent-render" reason and shows the difference React.memo makes.
 */

function ExpensiveList({ items }: { items: string[] }) {
  // Simulate moderate work
  const start = performance.now();
  while (performance.now() - start < 2) { /* burn 2ms */ }

  return (
    <div className="rounded border border-gray-800 bg-gray-900 p-3">
      <div className="text-xs text-gray-500">ExpensiveList (no memo, ~2ms render)</div>
      <ul className="mt-1 space-y-0.5 text-sm">
        {items.map((item, i) => (
          <li key={i} className="text-gray-300">{item}</li>
        ))}
      </ul>
    </div>
  );
}

const MemoizedExpensiveList = memo(ExpensiveList);

function Sidebar() {
  return (
    <div className="rounded border border-gray-800 bg-gray-900 p-3">
      <div className="text-xs text-gray-500">Sidebar (no memo)</div>
      <div className="mt-1 text-sm text-gray-400">Static content, no props</div>
      <div className="mt-1 text-xs text-gray-600">Re-renders on every parent update — wasted</div>
    </div>
  );
}

const MemoizedSidebar = memo(Sidebar);

function Footer({ year }: { year: number }) {
  return (
    <div className="rounded border border-gray-800 bg-gray-900 p-3">
      <div className="text-xs text-gray-500">Footer (no memo)</div>
      <div className="mt-1 text-sm text-gray-400">© {year}</div>
    </div>
  );
}

function Header({ title, onAction }: { title: string; onAction: () => void }) {
  return (
    <div className="rounded border border-gray-800 bg-gray-900 p-3">
      <div className="text-xs text-gray-500">Header (no memo)</div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <button onClick={onAction} className="text-xs text-indigo-400 hover:text-indigo-300">Action</button>
      </div>
    </div>
  );
}

const MemoizedHeader = memo(Header);

export function ParentCascadeScenario() {
  const [tick, setTick] = useState(0);
  const stableItems = ['Dashboard', 'Settings', 'Profile', 'Logout'];

  // Unstable callback — new ref every render
  const unstableAction = () => console.log('action');

  // Stable callback
  const stableAction = useCallback(() => console.log('action'), []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Clicking the button re-renders the parent. Un-memoized children cascade.
        Compare the <span className="text-red-400">wasted</span> column vs.{' '}
        <span className="text-emerald-400">memoized</span> variants.
      </p>

      <button
        onClick={() => setTick(t => t + 1)}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500"
      >
        Re-render parent (tick: {tick})
      </button>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-red-400">Un-memoized (wasted)</div>
          <Sidebar />
          <Header title="App" onAction={unstableAction} />
          <ExpensiveList items={stableItems} />
          <Footer year={2026} />
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Memoized (efficient)</div>
          <MemoizedSidebar />
          <MemoizedHeader title="App" onAction={stableAction} />
          <MemoizedExpensiveList items={stableItems} />
          <Footer year={2026} />
        </div>
      </div>
    </div>
  );
}
