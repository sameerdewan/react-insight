import { useState, useRef } from 'react';

/**
 * SCENARIO: Interaction Tracking
 *
 * Various user interactions that trigger state changes:
 * - Clicks, form inputs, keyboard events, submit
 * - Drag simulation (frequent events)
 * - Each interaction should open a causality frame in the agent
 *
 * The agent should emit interaction events and attribute subsequent
 * renders + state changes to them.
 */

function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);

  const allItems = [
    'Dashboard', 'Settings', 'Profile', 'Analytics', 'Reports',
    'Users', 'Teams', 'Billing', 'Integrations', 'API Keys',
    'Notifications', 'Security', 'Audit Log', 'Webhooks', 'Exports',
  ];

  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.length > 0) {
      setResults(allItems.filter(item =>
        item.toLowerCase().includes(value.toLowerCase())
      ));
    } else {
      setResults([]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">Search (each keystroke → state change → filtered render)</div>
      <input
        value={query}
        onChange={e => handleSearch(e.target.value)}
        placeholder="Type to search…"
        className="w-full rounded bg-gray-800 px-3 py-2 text-sm outline-none placeholder:text-gray-600 focus:ring-1 focus:ring-indigo-500"
      />
      {results.length > 0 && (
        <ul className="rounded border border-gray-800 bg-gray-900">
          {results.map(result => (
            <li key={result} className="border-b border-gray-800/50 px-3 py-1.5 text-sm last:border-0 hover:bg-gray-800">
              {result}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClickCounter() {
  const [clicks, setClicks] = useState<{ x: number; y: number; ts: number }[]>([]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setClicks(prev => [
      ...prev.slice(-19),
      { x: e.clientX - rect.left, y: e.clientY - rect.top, ts: Date.now() },
    ]);
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">Click Area ({clicks.length} clicks tracked)</div>
      <div
        onClick={handleClick}
        className="relative h-32 cursor-crosshair rounded border border-gray-800 bg-gray-900"
      >
        {clicks.map((click, i) => (
          <div
            key={click.ts}
            className="absolute h-2 w-2 -translate-x-1 -translate-y-1 rounded-full bg-indigo-500"
            style={{ left: click.x, top: click.y, opacity: (i + 1) / clicks.length }}
          />
        ))}
        <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-600">
          Click anywhere
        </div>
      </div>
    </div>
  );
}

function FormExample() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">Form (submit event + field changes)</div>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          placeholder="Name"
          className="w-full rounded bg-gray-800 px-3 py-1.5 text-sm outline-none placeholder:text-gray-600 focus:ring-1 focus:ring-indigo-500"
        />
        <input
          value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          placeholder="Email"
          className="w-full rounded bg-gray-800 px-3 py-1.5 text-sm outline-none placeholder:text-gray-600 focus:ring-1 focus:ring-indigo-500"
        />
        <textarea
          value={form.message}
          onChange={e => setForm({ ...form, message: e.target.value })}
          placeholder="Message"
          rows={2}
          className="w-full rounded bg-gray-800 px-3 py-1.5 text-sm outline-none placeholder:text-gray-600 focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
        >
          Submit
        </button>
        {submitted && (
          <div className="text-xs text-emerald-400">Submitted! (component will re-render when this clears)</div>
        )}
      </form>
    </div>
  );
}

function SliderControl() {
  const [value, setValue] = useState(50);
  const [dragging, setDragging] = useState(false);
  const updateCount = useRef(0);

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">
        Slider ({updateCount.current} state updates)
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onMouseDown={() => setDragging(true)}
          onMouseUp={() => setDragging(false)}
          onChange={e => {
            updateCount.current++;
            setValue(Number(e.target.value));
          }}
          className="flex-1"
        />
        <span className={`w-8 text-right text-sm tabular-nums ${dragging ? 'text-indigo-400' : 'text-gray-400'}`}>
          {value}
        </span>
      </div>
      <div className="text-xs text-gray-600">
        Dragging triggers rapid state updates — stress-tests batching
      </div>
    </div>
  );
}

function KeyboardTracker() {
  const [keys, setKeys] = useState<string[]>([]);

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">Keyboard Tracker</div>
      <input
        onKeyDown={e => setKeys(prev => [...prev.slice(-20), e.key])}
        placeholder="Type here…"
        className="w-full rounded bg-gray-800 px-3 py-1.5 text-sm outline-none placeholder:text-gray-600 focus:ring-1 focus:ring-indigo-500"
      />
      <div className="flex flex-wrap gap-1">
        {keys.map((key, i) => (
          <span key={i} className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-mono text-gray-400">
            {key}
          </span>
        ))}
      </div>
    </div>
  );
}

export function InteractionTrackingScenario() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-400">
        User interactions that trigger chains of state changes and renders.
        The agent should capture interaction events and attribute renders to them.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <SearchBox />
        <ClickCounter />
        <FormExample />
        <SliderControl />
        <KeyboardTracker />
      </div>
    </div>
  );
}
