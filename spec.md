# React Insight — Build Specification

## What you are building

A local development tool that helps React developers understand *why* their components render, why effects fire, and why memos recompute. It consists of two pieces:

1. **An npm package** (`@react-insight/agent`) that developers install in their React app. It attaches to React's internals, captures every render and hook event, and streams them to a local desktop app.
2. **An Electron desktop app** (React Insight) that receives those events, stores them, and displays them in a three-panel UI with human-readable explanations of what happened and why.

The product's core value is turning React's internal state — Fiber nodes, hook lists, commit phases — into plain-English explanations a developer can act on. Not a log viewer. Not another Profiler. A tool that says *"UserCard re-rendered because the `user` prop is a new object reference that's deep-equal to the previous one — the parent is creating it inline"* and tells the developer how to fix it.

## Architecture overview

```
┌───────────────────────────────────────────────┐
│  User's React app (development mode)          │
│                                               │
│  @react-insight/agent                         │
│   - Attaches to __REACT_DEVTOOLS_GLOBAL_HOOK__│
│   - Captures Fiber commits                    │
│   - Patches hook dispatcher for setter calls  │
│   - Installs interaction listeners            │
│   - Sends events via WebSocket                │
└──────────────────┬────────────────────────────┘
                   │ ws://localhost:8097
                   ▼
┌───────────────────────────────────────────────┐
│  React Insight (Electron)                     │
│                                               │
│  Main process                                 │
│   - WebSocket server (ws library)             │
│   - SQLite event store (better-sqlite3)       │
│   - Session management                        │
│   - IPC to renderer                           │
│                                               │
│  Renderer process (React app)                 │
│   - Timeline, event stream, detail panel      │
│   - Component tree and inspector              │
│   - Queries event store via IPC               │
└───────────────────────────────────────────────┘
```

Two packages published to npm (`@react-insight/agent` as a library, React Insight as an Electron binary distributed via installer and GitHub releases).

## Part 1: The agent (`@react-insight/agent`)

### Integration API

The developer installs the package and adds one import to their app's entry point:

```js
if (process.env.NODE_ENV === 'development') {
  import('@react-insight/agent');
}
```

The agent must:
- Work in Vite, webpack, Next.js, Create React App, Remix, and Astro without configuration
- No-op silently if the Electron app isn't running (retry connection every 3 seconds)
- Add less than 5% render overhead on a 500-component app
- Be completely stripped from production builds (gate imports behind `NODE_ENV === 'development'`)

Optionally the developer can configure:

```js
import { configure } from '@react-insight/agent';
configure({
  port: 8097,           // default
  host: 'localhost',    // default
  enabled: true,        // default: true in development
  maxEventsPerSecond: 10000, // backpressure threshold
});
```

### How the agent hooks into React

React exposes `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` for tools like React DevTools. The agent registers itself on this hook. This is the same mechanism React DevTools and React Scan use, and it works across React 16.8+ without patching React's internals directly.

The agent registers a renderer listener:

```js
const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
hook.onCommitFiberRoot = (rendererID, root, priority) => {
  processCommit(root.current);
};
```

On every commit, it walks the Fiber tree from the root, compares each Fiber's `memoizedProps` with `alternate.memoizedProps` and `memoizedState` with `alternate.memoizedState`, and emits events for everything that changed.

### Event types to capture

The agent must capture these events from the Fiber tree:

**`render`** — Fired for every Fiber that rendered in a commit. Includes:
- `componentId` (stable per Fiber instance)
- `componentName` (from `type.displayName || type.name`)
- `duration` (from `actualDuration` on the Fiber)
- `reason` — one of:
  - `initial-mount`
  - `state-change` (with hook index)
  - `prop-change` (with prop name, `shallowEqual`, `deepEqual`)
  - `context-change` (with context ID)
  - `parent-render` (no local reason)
  - `force-update` (from `forceUpdate` or `useReducer` dispatch)
- `sourceLocation` (from `_debugSource` when available — file, line, column)
- `renderCount` (nth render of this instance)

**`state-change`** — Fired when a `useState` or `useReducer` hook value changed between commits. Includes:
- `componentId`, `hookIndex`
- `hookName` (if available via Babel plugin; otherwise `state #N`)
- `previousValue`, `nextValue` (serialized with depth limit)
- `setterSource` (call site of the `set` function, captured via stack trace)

**`effect-fire`** — Fired when a `useEffect` or `useLayoutEffect` ran. Includes:
- `componentId`, `hookIndex`, `effectType` (`effect` | `layoutEffect` | `insertionEffect`)
- `depsChanged` (array of dep indices that changed, with change type: `reference` | `primitive` | `deep`)
- `previousDeps`, `currentDeps` (serialized)
- `cleanupDuration` (ms to run previous cleanup)
- `effectDuration` (ms to run new effect body)

**`memo-compute`** — Fired when a `useMemo` recomputed. Includes:
- `componentId`, `hookIndex`
- `depsChanged`, `duration`
- `result` (serialized with depth limit, truncated if large)
- `recomputedButUnchanged` (true if the new result deep-equals the old — a perf smell)

**`callback-change`** — Fired when a `useCallback` returned a new reference. Same shape as `memo-compute`.

**`ref-read`** — Opt-in only. Refs mutate outside the render cycle so they can't be observed reactively; the agent only reads `ref.current` during commits and logs changes since the last commit.

**`context-provide`** — Fired when a context provider's value changed. Includes:
- `contextId` (from the context object)
- `previousValue`, `nextValue`
- `consumers` (list of component IDs that read this context and will re-render)

**`mount` / `unmount`** — Component lifecycle events with parent ID and reason.

**`interaction`** — User events captured via capture-phase listeners on `document` (click, input, keydown, submit, change, mouseup, pointerup, touchend). Each interaction opens a causality frame: all synchronous work and microtasks spawned before the next macrotask are attributed to this interaction.

### Causality attribution

Every event must carry a `causalityParentId` when possible. The rules:

1. **Interactions seed causality chains.** When a DOM event fires, push a frame onto a causality stack with a generated ID. All renders, state changes, and effect fires in that synchronous span + microtask drain get this ID as their ancestor.

2. **State setters capture call sites.** Patch the dispatcher so every `useState` returns a wrapped setter. When the setter is called, capture `new Error().stack`, parse the top frame, and store it in a map keyed by `fiberId + hookIndex`. On the next commit, the agent looks up which setter calls led to this commit and attributes renders accordingly.

3. **Effects are attributed to the render that scheduled them.** An effect firing in commit N gets `causalityParentId = <the render event in commit N>`.

4. **Async work preserves causality across the await boundary.** When a setter is called inside a `.then()` or after an `await`, the agent uses async context (via `queueMicrotask` wrapping or `AsyncLocalStorage` equivalents in the browser) to maintain the parent chain. This is imperfect but catches most cases.

### Serialization rules

Props, state, and values must be serialized for display. Use these rules:

- Depth limit: 6 levels by default, configurable
- Max string length: 1000 chars, truncate with `…`
- Max array/object keys displayed: 50, show `…+N more`
- Handle: primitives, plain objects, arrays, Maps, Sets, Dates, RegExps, Errors, DOM nodes (as tag + id), functions (as `ƒ name()` or `ƒ anonymous`), Symbols, class instances (constructor name + public fields)
- Circular refs: detect via WeakSet, render as `[Circular → path]`
- React elements: render as `<ComponentName />`
- Preserve object identity tags across events so the UI can show "same reference" vs "new reference" diffs — attach a stable object ID via WeakMap

Use [telejson](https://github.com/storybookjs/telejson) as a starting point; extend for identity tracking.

### Transport

Agent connects to `ws://localhost:8097` via the standard `WebSocket` API. Wire format is JSON messages, one per line, with this envelope:

```ts
type AgentMessage =
  | { type: 'hello', agentVersion: string, reactVersion: string, sessionName: string, url: string }
  | { type: 'event', event: InsightEvent }
  | { type: 'batch', events: InsightEvent[] }
  | { type: 'heartbeat' };
```

Events are batched every 16ms or every 100 events, whichever comes first. If the buffer grows past `maxEventsPerSecond`, drop oldest events and emit a `dropped` event with the count.

## Part 2: The Electron app (React Insight)

### Tech stack

- Electron 30+
- Main process: Node 20, TypeScript, `ws` for WebSocket server, `better-sqlite3` for event store
- Renderer: React 19, Vite for build, TanStack Virtual for virtualized lists, Tailwind or similar for styling
- Build and distribution: electron-builder, with macOS notarization and Windows code signing configured
- State management in renderer: Zustand or Jotai

### Main process responsibilities

**WebSocket server** on port 8097. Accepts any number of agent connections. Each connection gets a `sessionId`. The `hello` message establishes session metadata.

**SQLite event store.** One database file per session, stored at `<userData>/sessions/<timestamp>-<name>.db`. Schema:

```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  component_id TEXT,
  component_name TEXT,
  causality_parent_id INTEGER,
  payload TEXT NOT NULL  -- JSON blob
);
CREATE INDEX idx_timestamp ON events(timestamp);
CREATE INDEX idx_component ON events(component_id);
CREATE INDEX idx_type ON events(type);
CREATE INDEX idx_causality ON events(causality_parent_id);

CREATE TABLE components (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_file TEXT,
  source_line INTEGER,
  first_seen INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  name TEXT,
  url TEXT,
  react_version TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER
);
```

Inserts use prepared statements and run in a transaction every 100ms (or per WebSocket batch). The goal is 10k inserts/sec minimum on a modest laptop — achievable with `better-sqlite3` in WAL mode.

**Ring buffer mode.** User can toggle "recent only" which caps event table at 100k rows (delete oldest in the same 100ms transaction). Full recording is default when paused/saved.

**IPC API** to renderer (use `contextBridge`, never `nodeIntegration: true`):

```ts
interface InsightAPI {
  getSessions(): Promise<Session[]>;
  getEvents(query: EventQuery): Promise<Event[]>;
  getEvent(id: number): Promise<EventDetail>;
  getCausalityTree(eventId: number): Promise<CausalityNode>;
  getComponentTree(sessionId: string, at: number): Promise<ComponentNode>;
  getComponentHistory(componentId: string): Promise<Event[]>;
  saveSession(id: string, path: string): Promise<void>;
  loadSession(path: string): Promise<Session>;
  startRecording(): Promise<void>;
  pauseRecording(): Promise<void>;
  clearSession(): Promise<void>;
  openInEditor(file: string, line: number): Promise<void>;
  subscribeToEvents(callback: (event: Event) => void): () => void;
}
```

**Open in editor** uses protocol handlers: `vscode://file/<path>:<line>`, `idea://open?file=<path>&line=<line>`, etc. User configures editor in settings.

### Renderer UI

The main window has a three-panel layout plus a header bar:

**Header** (always visible):
- Recording indicator (red dot when recording, gray when paused)
- Session selector dropdown (switch between active and saved sessions)
- Pause / Resume button
- Clear current session button
- Save session button (exports SQLite file)
- Search box (full-text search across events)
- Settings gear

**Left panel — Event stream** (40% width default, resizable):
- Virtualized list of events in reverse chronological order
- Each row: timestamp, component name, event type badge, one-line summary
- Filter bar at top: by event type (checkboxes), by component (multi-select), by "wasted renders only", by causality root
- Click a row to select → populates detail panel
- Expand arrow on rows with children (causality descendants)
- Color coding: renders blue, state changes green, effects purple, memos yellow, warnings red

**Right panel — Detail view** (60% width):
- Shows the selected event in full
- Header: component name, event type, timestamp, source location with "Open in editor" button
- **Explanation section** — human-readable prose (see next section)
- **Diff view** — for events with before/after (props, state, deps): two-column or unified diff with identity tags
- **Verdict** — a judgment line: `Likely wasted render`, `Expected re-render`, `Suspicious: investigate`, etc.
- **Fix suggestion** — when applicable, a concrete prose suggestion with a "Copy fix" button that copies suggested code
- **Causality chain** — breadcrumb trail from root interaction to this event, each step clickable
- **Related events** — effects fired by this render, children that re-rendered, etc.

**Bottom bar — Timeline** (collapsible, 120px tall):
- Horizontal time axis, zoomable with scroll/pinch
- One row per significant component (others collapsed into "other")
- Bars for renders (height = duration, color = "wasted" or normal)
- Markers for interactions (labeled: "click submit", "keydown Enter")
- Brush-select a range to filter the event stream to that window

**Secondary views** (accessed via left sidebar icons):

- **Component tree** — current or scrubbed-to-time tree of all mounted components. Click a component → see its complete render history, current props, current state, all hooks with values and deps.
- **Diagnostics** — passive detection of anti-patterns: "UserList re-rendered 47 times in 2s, always from `filters` prop with new reference but same value." Each diagnostic has severity, component, description, and "Show me" button that filters events to the cause.
- **Sessions** — list of saved sessions with metadata, open/delete/rename.

### Writing the human-readable explanations

This is the product's core. For every event type, there's a template that produces prose. Examples:

**Render event, prop-change reason, deep-equal:**
```
{ComponentName} re-rendered ({renderCount} time{s} so far).

Cause: The `{propName}` prop was a new object reference, but deep-equal
to the previous value. This means the parent re-created the object
on render instead of reusing it.

Where: {sourceFile}:{line} in {parentComponent}

Likely a wasted render. Wrapping the value in useMemo, lifting it
above the parent's render, or memoizing the parent with React.memo
would prevent this.
```

**Effect fire, deps changed by reference only:**
```
useEffect in {ComponentName} fired.

Cause: Dependency `{depName}` changed by reference, but the new
value is deep-equal to the old one.

The effect ran for {duration}ms and its cleanup took
{cleanupDuration}ms.

This effect may be firing more often than intended. If `{depName}`
doesn't need to trigger re-runs when its contents are the same,
consider memoizing it or using a deep-compare custom hook.
```

**Context value change affecting many consumers:**
```
ThemeContext value changed.

{consumerCount} components consumed this context. Of those,
{actuallyAffectedCount} read fields that actually changed.
The remaining {wastedCount} re-rendered unnecessarily.

The provider at {source} creates a new value object on each render.
Splitting the context by field, or memoizing the provider value,
would reduce wasted work.
```

The phrasing must be consistent: second person, direct, actionable. No jargon without definition. Always include the "where" and, when possible, the "why it matters." Build a template system so explanations stay consistent across events.

### Diagnostics engine

A passive rule engine runs in the main process, scanning new events and surfacing warnings:

Rules to implement:
- **Frequent unnecessary renders** — N renders in T seconds where >80% are `prop-change` with `deepEqual: true`
- **Effect firing every render** — useEffect with deps that change every render, or no deps array at all
- **Context thrash** — provider value with new reference but same contents, many consumers
- **Unstable callback** — useCallback whose deps change every render (probably another useCallback/useMemo is unstable above it)
- **Memoization mismatch** — useMemo whose result is always the same despite deps changing
- **Render during render** — setState called during render body (triggers warning in React too, but catch earlier)
- **Suspiciously long effects** — effects taking >16ms that might belong in a worker or async
- **Large state object churn** — useState holding an object >10KB replaced often

Each rule emits a diagnostic event with severity, components involved, and a pointer to exemplar events. Diagnostics view shows these grouped.

## Part 3: Distribution

- **Agent:** publish to npm as `@react-insight/agent`. Ship ESM + CJS + types. Zero dependencies if possible (bundle telejson and its deps).
- **Electron app:** build with electron-builder targeting macOS (arm64 + x64, notarized), Windows (x64, signed), and Linux (AppImage and deb). Distribute via GitHub Releases plus a landing page at react-insight.dev (or similar).
- **Auto-update:** use electron-updater with GitHub Releases as the feed. Check on launch.
- **Crash reporting:** Sentry or similar, opt-in, disabled by default.
- **Telemetry:** anonymous usage metrics (which features used, how often) with clear opt-in on first launch. Defaults to off.

## Part 4: What to build first (shipping order)

Build in this order. Each step is a checkpoint — working software before moving on.

1. **Agent v0**: attach to the DevTools hook, walk Fiber tree on commit, compute render reasons (prop-change, state-change, context-change, parent-render, initial-mount), console.log them. Test on three real apps. Validate the data is correct before anything else.

2. **Transport**: WebSocket server in a basic Node script (not Electron yet). Agent streams events to it. Events persist to a JSON file. Confirm end-to-end flow.

3. **Electron shell**: main + renderer processes, IPC, SQLite store, replace the JSON file with real persistence. Renderer shows a dumb scrolling event list. Basic pause/record/clear.

4. **Detail panel with explanations**: the prose rendering for render events. This is where the product starts to feel real. Get the writing right on five event types before adding more.

5. **Remaining event types**: state changes, effects, memos, callbacks, context, interactions. Each one needs agent capture + explanation template.

6. **Causality attribution**: setter call-site capture, interaction stack, causality IDs on events. Add the causality breadcrumb to the detail panel.

7. **Timeline, component tree, diagnostics**: the remaining views, in that order.

8. **Polish and ship**: landing page, README with GIFs, code signing, notarization, installer, npm publish, launch post.

Each step should take roughly a week for a focused developer. Steps 1–4 are the MVP; everything beyond 4 is expansion.

## Non-goals for v1

Be ruthless about not building these:
- Time travel (scrub state back to a prior point and have the app reflect it)
- React Native support
- Remote debugging over network (beyond localhost)
- Server-side / Node rendering support
- A Babel plugin for hook name capture (the hook index is usable for v1)
- Cloud sync, team features, session sharing beyond file export
- Profiler-style flame graphs (the timeline is enough)
- A browser extension version (Electron app only)

These are all reasonable future additions. None of them are required to ship something people will install and use.

## Success criteria

The v1 ships when:
- A developer can install the agent, launch React Insight, and within 30 seconds see a stream of events from their running app
- They can click any render and get a human-readable explanation of why it happened, in plain English, with a source link
- The "Diagnostics" view surfaces at least three real problems in a typical mid-size app
- The agent adds less than 5% overhead to a typical development session
- The Electron app uses less than 300MB of RAM for a 10-minute session and stays responsive

If those five things are true, ship it. Iterate on everything else post-launch.