import { useState, useReducer, useEffect } from 'react';

/**
 * SCENARIO: State Updates
 *
 * Tests various state mutation patterns:
 * - useState with primitives
 * - useState with objects (replaced on every update)
 * - useReducer with an action dispatch
 * - Auto-incrementing timer (state changes every second)
 *
 * The agent should detect "state-change" render reasons with correct
 * hook indices and show the before/after values.
 */

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

type TodoAction =
  | { type: 'add'; text: string }
  | { type: 'toggle'; id: number }
  | { type: 'remove'; id: number };

function todoReducer(state: Todo[], action: TodoAction): Todo[] {
  switch (action.type) {
    case 'add':
      return [...state, { id: Date.now(), text: action.text, done: false }];
    case 'toggle':
      return state.map(t => t.id === action.id ? { ...t, done: !t.done } : t);
    case 'remove':
      return state.filter(t => t.id !== action.id);
  }
}

function AutoCounter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCount(c => c + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
      <div className="text-xs uppercase tracking-wider text-gray-500">Auto Counter</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{count}</div>
      <div className="mt-1 text-xs text-gray-500">State changes every second</div>
    </div>
  );
}

export function StateUpdatesScenario() {
  const [count, setCount] = useState(0);
  const [form, setForm] = useState({ name: '', email: '' });
  const [todos, dispatch] = useReducer(todoReducer, [
    { id: 1, text: 'Install React Insight', done: true },
    { id: 2, text: 'Find wasted renders', done: false },
  ]);
  const [input, setInput] = useState('');

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-400">
        Multiple state hooks in one component. The agent should attribute each
        re-render to the specific hook index that changed.
      </p>

      {/* Primitive state */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setCount(c => c + 1)}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
        >
          Count: {count}
        </button>
        <button
          onClick={() => setCount(count)}
          className="rounded bg-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-600"
        >
          Set same value (should bail out)
        </button>
      </div>

      {/* Object state replaced every keystroke */}
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wider text-gray-500">Form (object state)</div>
        <div className="flex gap-2">
          <input
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Name"
            className="rounded bg-gray-800 px-3 py-1.5 text-sm outline-none placeholder:text-gray-600 focus:ring-1 focus:ring-indigo-500"
          />
          <input
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="Email"
            className="rounded bg-gray-800 px-3 py-1.5 text-sm outline-none placeholder:text-gray-600 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="text-xs text-gray-500">
          Each keystroke replaces the entire form object
        </div>
      </div>

      {/* Reducer-based todo list */}
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wider text-gray-500">Todo List (useReducer)</div>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && input.trim()) {
                dispatch({ type: 'add', text: input.trim() });
                setInput('');
              }
            }}
            placeholder="Add a todo…"
            className="flex-1 rounded bg-gray-800 px-3 py-1.5 text-sm outline-none placeholder:text-gray-600 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <ul className="space-y-1">
          {todos.map(todo => (
            <li key={todo.id} className="flex items-center gap-2 rounded bg-gray-900 px-3 py-1.5 text-sm">
              <button
                onClick={() => dispatch({ type: 'toggle', id: todo.id })}
                className={`${todo.done ? 'line-through text-gray-600' : ''}`}
              >
                {todo.done ? '☑' : '☐'} {todo.text}
              </button>
              <button
                onClick={() => dispatch({ type: 'remove', id: todo.id })}
                className="ml-auto text-xs text-red-400 hover:text-red-300"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>

      <AutoCounter />
    </div>
  );
}
