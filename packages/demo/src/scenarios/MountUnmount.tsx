import { useState, useEffect } from 'react';

/**
 * SCENARIO: Mount / Unmount Cycles
 *
 * Components that frequently mount and unmount:
 * - Toggle visibility
 * - Conditional rendering based on state
 * - List that adds/removes items
 * - Tab switching (old tab unmounts, new tab mounts)
 *
 * The agent should emit mount and unmount events with correct
 * component IDs and parent relationships.
 */

function Notification({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="flex items-center justify-between rounded border border-emerald-800 bg-emerald-950 px-4 py-2 text-sm">
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-2 text-emerald-400 hover:text-emerald-300">✕</button>
    </div>
  );
}

function ExpandableSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded border border-gray-800 bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium hover:bg-gray-800"
      >
        {title}
        <span className="text-gray-500">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="border-t border-gray-800 px-4 py-3">{children}</div>}
    </div>
  );
}

function TabContent({ tab }: { tab: string }) {
  useEffect(() => {
    return () => {};
  }, []);

  return (
    <div className="rounded border border-gray-800 bg-gray-900 p-4">
      <div className="text-sm font-medium">{tab} Content</div>
      <div className="mt-1 text-xs text-gray-500">Mounted when selected, unmounted when tab changes</div>
    </div>
  );
}

function DynamicList() {
  const [items, setItems] = useState<{ id: number; label: string }[]>([
    { id: 1, label: 'Item A' },
    { id: 2, label: 'Item B' },
  ]);
  let nextId = items.length + 1;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          onClick={() => setItems([...items, { id: Date.now(), label: `Item ${String.fromCharCode(65 + (nextId % 26))}` }])}
          className="rounded bg-gray-700 px-3 py-1 text-xs hover:bg-gray-600"
        >
          Add item
        </button>
        <button
          onClick={() => items.length > 0 && setItems(items.slice(0, -1))}
          className="rounded bg-gray-700 px-3 py-1 text-xs hover:bg-gray-600"
        >
          Remove last
        </button>
        <button
          onClick={() => setItems([])}
          className="rounded bg-red-900 px-3 py-1 text-xs hover:bg-red-800"
        >
          Clear all
        </button>
      </div>
      <ul className="space-y-1">
        {items.map(item => (
          <li key={item.id} className="flex items-center justify-between rounded bg-gray-900 px-3 py-1.5 text-sm">
            <span>{item.label}</span>
            <button
              onClick={() => setItems(items.filter(i => i.id !== item.id))}
              className="text-xs text-red-400 hover:text-red-300"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MountUnmountScenario() {
  const [showNotif, setShowNotif] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');
  const tabs = ['Overview', 'Details', 'Settings', 'Logs'];

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-400">
        Components mounting and unmounting. The agent should track
        <code className="mx-1 rounded bg-gray-800 px-1 text-cyan-300">mount</code> and
        <code className="mx-1 rounded bg-gray-800 px-1 text-gray-400">unmount</code> events
        with parent IDs and component names.
      </p>

      {/* Notification toggle */}
      <div className="space-y-2">
        <button
          onClick={() => setShowNotif(true)}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
        >
          Show notification (auto-dismiss 3s)
        </button>
        {showNotif && (
          <Notification
            message="This component will unmount in 3 seconds"
            onDismiss={() => setShowNotif(false)}
          />
        )}
      </div>

      {/* Expandable sections */}
      <div className="space-y-2">
        <ExpandableSection title="Section A — Click to mount/unmount children">
          <div className="text-sm text-gray-300">Content A is mounted</div>
        </ExpandableSection>
        <ExpandableSection title="Section B — Nested content">
          <ExpandableSection title="Nested section">
            <div className="text-sm text-gray-300">Deeply nested — mount events should show parent chain</div>
          </ExpandableSection>
        </ExpandableSection>
      </div>

      {/* Tabs */}
      <div className="space-y-2">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-t px-3 py-1.5 text-xs font-medium ${
                activeTab === tab ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <TabContent tab={activeTab} />
      </div>

      {/* Dynamic list */}
      <div>
        <div className="mb-2 text-xs uppercase tracking-wider text-gray-500">Dynamic List</div>
        <DynamicList />
      </div>
    </div>
  );
}
