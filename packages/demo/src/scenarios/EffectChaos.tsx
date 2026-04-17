import { useState, useEffect, useRef } from 'react';

/**
 * SCENARIO: Effect Chaos
 *
 * Demonstrates effects that fire too often:
 * - useEffect with no deps array (fires every render)
 * - useEffect with an inline object dep (new ref each render, deep-equal)
 * - useEffect with a properly stable dep
 * - useEffect with a dep that changes every render (derived value)
 *
 * The agent should flag effects with deep-only dep changes and
 * effects that fire on every single render.
 */

function EffectNoDeps() {
  const runCount = useRef(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    runCount.current++;
  });

  return (
    <div className="rounded border border-gray-800 bg-gray-900 p-3">
      <div className="text-xs text-gray-500">EffectNoDeps</div>
      <div className="mt-1 text-sm">Effect ran <strong className="text-red-400">{runCount.current}</strong> times</div>
      <div className="mt-1 text-xs text-gray-600">No dependency array → runs on every render</div>
      <button
        onClick={() => setTick(t => t + 1)}
        className="mt-2 rounded bg-gray-700 px-3 py-1 text-xs hover:bg-gray-600"
      >
        Trigger render
      </button>
    </div>
  );
}

function EffectInlineDep() {
  const runCount = useRef(0);
  const [count, setCount] = useState(0);

  // BUG: inline object as dep — new ref every render, same value
  const config = { threshold: 10, enabled: true };

  useEffect(() => {
    runCount.current++;
  }, [config]); // eslint-disable-line — intentionally wrong

  return (
    <div className="rounded border border-gray-800 bg-gray-900 p-3">
      <div className="text-xs text-gray-500">EffectInlineDep</div>
      <div className="mt-1 text-sm">Effect ran <strong className="text-amber-400">{runCount.current}</strong> times</div>
      <div className="mt-1 text-xs text-gray-600">Dep is an inline object → fires every render</div>
      <button
        onClick={() => setCount(c => c + 1)}
        className="mt-2 rounded bg-gray-700 px-3 py-1 text-xs hover:bg-gray-600"
      >
        Render ({count})
      </button>
    </div>
  );
}

function EffectDerivedDep() {
  const runCount = useRef(0);
  const [items, setItems] = useState(['a', 'b', 'c']);

  // Derived value changes every render because .filter creates a new array
  const activeItems = items.filter(Boolean);

  useEffect(() => {
    runCount.current++;
  }, [activeItems]); // eslint-disable-line — intentionally unstable

  return (
    <div className="rounded border border-gray-800 bg-gray-900 p-3">
      <div className="text-xs text-gray-500">EffectDerivedDep</div>
      <div className="mt-1 text-sm">Effect ran <strong className="text-amber-400">{runCount.current}</strong> times</div>
      <div className="mt-1 text-xs text-gray-600">.filter() creates a new array ref every render</div>
      <button
        onClick={() => setItems([...items])}
        className="mt-2 rounded bg-gray-700 px-3 py-1 text-xs hover:bg-gray-600"
      >
        Re-render ({items.length} items)
      </button>
    </div>
  );
}

function EffectStable() {
  const runCount = useRef(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    runCount.current++;
  }, [count]);

  return (
    <div className="rounded border border-gray-800 bg-gray-900 p-3">
      <div className="text-xs text-gray-500">EffectStable</div>
      <div className="mt-1 text-sm">Effect ran <strong className="text-emerald-400">{runCount.current}</strong> times</div>
      <div className="mt-1 text-xs text-gray-600">Primitive dep → fires only when count changes</div>
      <button
        onClick={() => setCount(c => c + 1)}
        className="mt-2 rounded bg-gray-700 px-3 py-1 text-xs hover:bg-gray-600"
      >
        Increment ({count})
      </button>
    </div>
  );
}

function LongEffect() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!active) return;
    // Simulate expensive setup (>16ms)
    const start = performance.now();
    while (performance.now() - start < 25) { /* burn 25ms */ }
    return () => {
      const s = performance.now();
      while (performance.now() - s < 10) { /* burn 10ms cleanup */ }
    };
  }, [active]);

  return (
    <div className="rounded border border-gray-800 bg-gray-900 p-3">
      <div className="text-xs text-gray-500">LongEffect</div>
      <div className="mt-1 text-sm">{active ? '🔴 Active (25ms setup, 10ms cleanup)' : '⚪ Inactive'}</div>
      <button
        onClick={() => setActive(a => !a)}
        className="mt-2 rounded bg-gray-700 px-3 py-1 text-xs hover:bg-gray-600"
      >
        Toggle
      </button>
    </div>
  );
}

export function EffectChaosScenario() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Five effect patterns from worst to best. The agent should flag effects
        that fire every render and effects with deep-equal dep changes.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <EffectNoDeps />
        <EffectInlineDep />
        <EffectDerivedDep />
        <EffectStable />
        <LongEffect />
      </div>
    </div>
  );
}
