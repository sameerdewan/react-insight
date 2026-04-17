import { createContext, useContext, useState, memo } from 'react';

/**
 * SCENARIO: Context Thrashing
 *
 * The provider creates a new object reference for its value on every render,
 * even though the contents are the same. All consumers re-render —
 * even those reading fields that didn't change.
 *
 * The agent should detect context-change render reasons and flag the
 * provider as creating unstable references.
 */

interface ThemeContextValue {
  mode: 'dark' | 'light';
  fontSize: number;
  accentColor: string;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  fontSize: 14,
  accentColor: '#6366f1',
});

function ThemeModeDisplay() {
  const { mode } = useContext(ThemeContext);
  return (
    <div className="rounded border border-gray-800 bg-gray-900 p-3">
      <div className="text-xs text-gray-500">ThemeModeDisplay</div>
      <div className="text-sm">Mode: <strong>{mode}</strong></div>
      <div className="mt-1 text-xs text-gray-600">Only reads `mode` — shouldn't re-render when fontSize changes</div>
    </div>
  );
}

function FontSizeDisplay() {
  const { fontSize } = useContext(ThemeContext);
  return (
    <div className="rounded border border-gray-800 bg-gray-900 p-3">
      <div className="text-xs text-gray-500">FontSizeDisplay</div>
      <div className="text-sm">Font size: <strong>{fontSize}px</strong></div>
    </div>
  );
}

const AccentColorDisplay = memo(function AccentColorDisplay() {
  const { accentColor } = useContext(ThemeContext);
  return (
    <div className="rounded border border-gray-800 bg-gray-900 p-3">
      <div className="text-xs text-gray-500">AccentColorDisplay (memo)</div>
      <div className="flex items-center gap-2 text-sm">
        <div className="h-4 w-4 rounded" style={{ backgroundColor: accentColor }} />
        {accentColor}
      </div>
      <div className="mt-1 text-xs text-gray-600">React.memo doesn't help — context bypasses it</div>
    </div>
  );
});

function UnrelatedChild() {
  const _ctx = useContext(ThemeContext);
  return (
    <div className="rounded border border-gray-800 bg-gray-900 p-3">
      <div className="text-xs text-gray-500">UnrelatedChild</div>
      <div className="text-sm text-gray-400">Reads context but doesn't use any field</div>
    </div>
  );
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSize] = useState(14);
  const [mode] = useState<'dark' | 'light'>('dark');

  // BUG: creating a new object on every render
  const value: ThemeContextValue = {
    mode,
    fontSize,
    accentColor: '#6366f1',
  };

  return (
    <ThemeContext.Provider value={value}>
      <div className="space-y-3">
        <button
          onClick={() => setFontSize(s => s + 1)}
          className="rounded bg-purple-600 px-4 py-2 text-sm font-medium hover:bg-purple-500"
        >
          Increase font size ({fontSize}px)
        </button>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function ContextThrashScenario() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        The provider creates a <strong>new object reference</strong> on every render.
        All four consumers re-render, even though only <code className="rounded bg-gray-800 px-1 text-indigo-300">fontSize</code> actually
        changes. The agent should flag context-change reasons on all consumers.
      </p>

      <ThemeProvider>
        <div className="grid gap-3 sm:grid-cols-2">
          <ThemeModeDisplay />
          <FontSizeDisplay />
          <AccentColorDisplay />
          <UnrelatedChild />
        </div>
      </ThemeProvider>
    </div>
  );
}
