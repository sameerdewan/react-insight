import { useState, useEffect, useMemo, useCallback, useReducer, useRef, createContext, useContext, memo } from 'react';

/**
 * SCENARIO: Kitchen Sink
 *
 * A realistic mini-app (task board) that combines multiple anti-patterns
 * in one place. This is the closest to what a real codebase looks like —
 * problems are mixed together, not isolated.
 */

interface Task {
  id: number;
  title: string;
  status: 'todo' | 'doing' | 'done';
  assignee: string;
  priority: 'low' | 'medium' | 'high';
}

// --- Context with unstable value ---
const BoardContext = createContext<{
  filter: string;
  sortBy: string;
  highlight: string | null;
}>({ filter: '', sortBy: 'priority', highlight: null });

function BoardProvider({ children }: { children: React.ReactNode }) {
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState('priority');
  const [highlight, setHighlight] = useState<string | null>(null);

  // BUG: new object every render
  const value = { filter, sortBy, highlight };

  return (
    <BoardContext.Provider value={value}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter tasks…"
            className="flex-1 rounded bg-gray-800 px-3 py-1.5 text-sm outline-none placeholder:text-gray-600 focus:ring-1 focus:ring-indigo-500"
          />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="rounded bg-gray-800 px-3 py-1.5 text-sm outline-none"
          >
            <option value="priority">Priority</option>
            <option value="assignee">Assignee</option>
            <option value="title">Title</option>
          </select>
          <button
            onClick={() => setHighlight(highlight ? null : 'high')}
            className={`rounded px-3 py-1 text-xs ${highlight ? 'bg-red-600' : 'bg-gray-700'}`}
          >
            {highlight ? 'Clear highlight' : 'Highlight high'}
          </button>
        </div>
        {children}
      </div>
    </BoardContext.Provider>
  );
}

// --- Task card: reads context, receives inline style prop ---
function TaskCard({ task, style }: { task: Task; style: { borderColor: string } }) {
  const { highlight } = useContext(BoardContext);
  const isHighlighted = highlight === task.priority;

  const priorityColors = { low: 'text-gray-500', medium: 'text-amber-400', high: 'text-red-400' };

  return (
    <div
      className={`rounded border bg-gray-900 p-3 ${isHighlighted ? 'ring-1 ring-red-500' : ''}`}
      style={{ borderColor: style.borderColor }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{task.title}</span>
        <span className={`text-xs ${priorityColors[task.priority]}`}>{task.priority}</span>
      </div>
      <div className="mt-1 text-xs text-gray-500">{task.assignee}</div>
    </div>
  );
}

const MemoizedTaskCard = memo(TaskCard);

// --- Column component ---
function Column({ title, tasks }: { title: string; tasks: Task[] }) {
  const { filter, sortBy } = useContext(BoardContext);

  // Derived computation every render — creates new array ref
  const filtered = tasks
    .filter(t => t.title.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => a[sortBy as keyof Task] > b[sortBy as keyof Task] ? 1 : -1);

  // BUG: useMemo with unstable dep (filtered is a new array every render)
  const count = useMemo(() => filtered.length, [filtered]);

  return (
    <div className="flex-1 rounded-lg border border-gray-800 bg-gray-950 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</span>
        <span className="rounded bg-gray-800 px-1.5 text-xs tabular-nums text-gray-400">{count}</span>
      </div>
      <div className="space-y-2">
        {filtered.map(task => (
          // BUG: inline style object — new ref every render
          <MemoizedTaskCard key={task.id} task={task} style={{ borderColor: '#1e293b' }} />
        ))}
      </div>
    </div>
  );
}

// --- Stats bar that re-renders on every board change ---
function StatsBar({ tasks }: { tasks: Task[] }) {
  const stats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    doing: tasks.filter(t => t.status === 'doing').length,
    done: tasks.filter(t => t.status === 'done').length,
  };

  return (
    <div className="flex gap-4 rounded bg-gray-900 px-4 py-2 text-xs">
      <span className="text-gray-400">Total: <strong>{stats.total}</strong></span>
      <span className="text-blue-400">Todo: <strong>{stats.todo}</strong></span>
      <span className="text-amber-400">Doing: <strong>{stats.doing}</strong></span>
      <span className="text-emerald-400">Done: <strong>{stats.done}</strong></span>
    </div>
  );
}

export function KitchenSinkScenario() {
  const [tasks, dispatch] = useReducer(
    (state: Task[], action: { type: 'add' | 'move'; task?: Omit<Task, 'id'>; id?: number; status?: Task['status'] }) => {
      switch (action.type) {
        case 'add':
          return [...state, { ...action.task!, id: Date.now() }];
        case 'move':
          return state.map(t => t.id === action.id ? { ...t, status: action.status! } : t);
        default:
          return state;
      }
    },
    [
      { id: 1, title: 'Set up project', status: 'done', assignee: 'Alice', priority: 'high' },
      { id: 2, title: 'Design API schema', status: 'done', assignee: 'Bob', priority: 'high' },
      { id: 3, title: 'Build auth flow', status: 'doing', assignee: 'Alice', priority: 'high' },
      { id: 4, title: 'Write tests', status: 'doing', assignee: 'Charlie', priority: 'medium' },
      { id: 5, title: 'Add pagination', status: 'todo', assignee: 'Bob', priority: 'medium' },
      { id: 6, title: 'Dark mode support', status: 'todo', assignee: 'Alice', priority: 'low' },
      { id: 7, title: 'Perf optimization', status: 'todo', assignee: 'Charlie', priority: 'low' },
      { id: 8, title: 'Deploy to staging', status: 'todo', assignee: 'Bob', priority: 'medium' },
    ],
  );

  const [autoAdd, setAutoAdd] = useState(false);
  const counter = useRef(0);

  useEffect(() => {
    if (!autoAdd) return;
    const id = setInterval(() => {
      counter.current++;
      dispatch({
        type: 'add',
        task: {
          title: `Auto task #${counter.current}`,
          status: 'todo',
          assignee: ['Alice', 'Bob', 'Charlie'][counter.current % 3],
          priority: (['low', 'medium', 'high'] as const)[counter.current % 3],
        },
      });
    }, 2000);
    return () => clearInterval(id);
  }, [autoAdd]);

  const todoTasks = tasks.filter(t => t.status === 'todo');
  const doingTasks = tasks.filter(t => t.status === 'doing');
  const doneTasks = tasks.filter(t => t.status === 'done');

  // BUG: inline callback
  const handleAddTask = () => {
    dispatch({
      type: 'add',
      task: { title: `New task`, status: 'todo', assignee: 'Alice', priority: 'medium' },
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        A realistic task board combining multiple anti-patterns: context thrashing,
        inline prop objects, unstable memos, cascading renders.
      </p>

      <div className="flex gap-2">
        <button
          onClick={handleAddTask}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
        >
          Add task
        </button>
        <button
          onClick={() => setAutoAdd(a => !a)}
          className={`rounded px-4 py-2 text-sm font-medium ${autoAdd ? 'bg-red-600 hover:bg-red-500' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          {autoAdd ? 'Stop auto-add' : 'Auto-add every 2s'}
        </button>
      </div>

      <BoardProvider>
        <StatsBar tasks={tasks} />
        <div className="flex gap-3">
          <Column title="Todo" tasks={todoTasks} />
          <Column title="In Progress" tasks={doingTasks} />
          <Column title="Done" tasks={doneTasks} />
        </div>
      </BoardProvider>
    </div>
  );
}
