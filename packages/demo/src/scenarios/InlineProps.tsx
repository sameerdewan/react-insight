import { useState, memo } from 'react';

/**
 * SCENARIO: Inline Object Props
 *
 * The parent creates a new object literal on every render and passes it
 * as a prop. The child receives a new reference each time, even though
 * the value is deep-equal. The agent should flag this as a wasted render
 * with reason "prop-change, deepEqual: true".
 *
 * The memoized variant shows that React.memo alone doesn't help here
 * because the reference changes — you need useMemo on the parent side.
 */

function UserCard({ user }: { user: { name: string; age: number; role: string } }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="font-semibold">{user.name}</div>
      <div className="text-sm text-gray-400">{user.role}, age {user.age}</div>
    </div>
  );
}

const MemoizedUserCard = memo(UserCard);

function StyleBadge({ style }: { style: { color: string; size: number } }) {
  return (
    <span
      className="inline-block rounded px-2 py-1 text-xs font-medium"
      style={{ color: style.color, fontSize: style.size }}
    >
      Styled Badge
    </span>
  );
}

export function InlinePropsScenario() {
  const [tick, setTick] = useState(0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Parent re-renders on every tick. Both children receive inline objects
        as props — new references but identical values. The agent should detect
        <code className="mx-1 rounded bg-gray-800 px-1 text-indigo-300">prop-change (deepEqual: true)</code>
        on every render.
      </p>

      <button
        onClick={() => setTick(t => t + 1)}
        className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
      >
        Re-render parent (tick: {tick})
      </button>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Inline object — new ref every render, deep-equal */}
        <UserCard user={{ name: 'Alice', age: 32, role: 'Engineer' }} />

        {/* Even React.memo can't save this — the ref is new */}
        <MemoizedUserCard user={{ name: 'Bob', age: 28, role: 'Designer' }} />

        {/* Inline style prop — same pattern */}
        <StyleBadge style={{ color: '#6366f1', size: 14 }} />
      </div>
    </div>
  );
}
