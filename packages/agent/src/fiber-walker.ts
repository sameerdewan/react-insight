import type { InsightEvent, RenderEvent, RenderReason, MountEvent, UnmountEvent, SourceLocation } from './types';
import { deepEqual, serialize } from './serializer';

// ── Fiber tag constants ──
const FunctionComponent = 0;
const ClassComponent = 1;
const ForwardRef = 11;
const MemoComponent = 14;
const SimpleMemoComponent = 15;

const COMPONENT_TAGS = new Set([FunctionComponent, ClassComponent, ForwardRef, MemoComponent, SimpleMemoComponent]);

// ── Stable identity tracking ──

const fiberIds = new WeakMap<object, string>();
let nextFiberId = 1;

function getFiberId(fiber: any): string {
  let id = fiberIds.get(fiber);
  if (id) return id;

  if (fiber.alternate) {
    id = fiberIds.get(fiber.alternate);
    if (id) {
      fiberIds.set(fiber, id);
      return id;
    }
  }

  id = `c${nextFiberId++}`;
  fiberIds.set(fiber, id);
  if (fiber.alternate) fiberIds.set(fiber.alternate, id);
  return id;
}

const renderCounts = new Map<string, number>();

function getComponentName(fiber: any): string {
  const type = fiber.type;
  if (!type) return 'Unknown';
  if (typeof type === 'string') return type;
  return type.displayName || type.name || 'Anonymous';
}

function getSourceLocation(fiber: any): SourceLocation | null {
  const source = fiber._debugSource;
  if (!source) return null;
  return { file: source.fileName, line: source.lineNumber, column: source.columnNumber || 0 };
}

// ── Render reason computation ──

function diffProps(prevProps: any, nextProps: any): RenderReason[] {
  if (!prevProps || !nextProps) return [];
  const reasons: RenderReason[] = [];
  const allKeys = new Set([...Object.keys(prevProps), ...Object.keys(nextProps)]);

  for (const key of allKeys) {
    if (key === 'children') continue;
    const prev = prevProps[key];
    const next = nextProps[key];
    if (prev !== next) {
      let isDeepEqual = false;
      try {
        isDeepEqual = deepEqual(prev, next);
      } catch { /* swallow — exotic objects */ }
      reasons.push({ type: 'prop-change', propName: key, shallowEqual: false, deepEqual: isDeepEqual });
    }
  }
  return reasons;
}

function diffHookStates(prevHook: any, nextHook: any): RenderReason[] {
  const reasons: RenderReason[] = [];
  let prev = prevHook;
  let next = nextHook;
  let hookIndex = 0;

  while (prev && next) {
    // useState / useReducer hooks have a non-null queue
    if (prev.queue !== null && next.queue !== null) {
      if (!Object.is(prev.memoizedState, next.memoizedState)) {
        reasons.push({ type: 'state-change', hookIndex });
      }
    }
    prev = prev.next;
    next = next.next;
    hookIndex++;
  }
  return reasons;
}

function computeRenderReasons(fiber: any): RenderReason[] {
  const alternate = fiber.alternate;
  if (!alternate) return [{ type: 'initial-mount' }];

  const reasons: RenderReason[] = [];

  if (fiber.memoizedProps !== alternate.memoizedProps) {
    reasons.push(...diffProps(alternate.memoizedProps, fiber.memoizedProps));
  }

  if (fiber.memoizedState !== alternate.memoizedState) {
    const tag = fiber.tag;
    if (tag === FunctionComponent || tag === ForwardRef || tag === SimpleMemoComponent) {
      reasons.push(...diffHookStates(alternate.memoizedState, fiber.memoizedState));
    } else if (tag === ClassComponent) {
      reasons.push({ type: 'state-change', hookIndex: -1 });
    }
  }

  // Context change detection: function components track dependencies on fiber.dependencies
  if (fiber.dependencies && alternate.dependencies) {
    const prevCtx = alternate.dependencies?.firstContext;
    const nextCtx = fiber.dependencies?.firstContext;
    if (prevCtx !== nextCtx) {
      reasons.push({ type: 'context-change' });
    }
  }

  if (reasons.length === 0) {
    reasons.push({ type: 'parent-render' });
  }

  return reasons;
}

// ── Detect effect events ──

function extractEffectEvents(fiber: any, componentId: string, componentName: string): InsightEvent[] {
  const events: InsightEvent[] = [];
  if (fiber.tag !== FunctionComponent && fiber.tag !== ForwardRef && fiber.tag !== SimpleMemoComponent) {
    return events;
  }

  const updateQueue = fiber.updateQueue;
  if (!updateQueue || !updateQueue.lastEffect) return events;

  const HasEffect = 0b0001;
  const Passive = 0b1000;  // useEffect
  const Layout = 0b0100;   // useLayoutEffect
  const Insertion = 0b0010; // useInsertionEffect

  let effect = updateQueue.lastEffect.next;
  const firstEffect = effect;
  let hookIndex = 0;

  do {
    if (effect.tag & HasEffect) {
      let effectType: 'effect' | 'layoutEffect' | 'insertionEffect' = 'effect';
      if (effect.tag & Layout) effectType = 'layoutEffect';
      else if (effect.tag & Insertion) effectType = 'insertionEffect';
      else if (effect.tag & Passive) effectType = 'effect';

      // Diff deps if available
      const currentDeps = effect.deps;
      let prevDeps: any[] | null = null;
      if (fiber.alternate?.updateQueue?.lastEffect) {
        let altEffect = fiber.alternate.updateQueue.lastEffect.next;
        const altFirst = altEffect;
        let idx = 0;
        do {
          if (idx === hookIndex) {
            prevDeps = altEffect.deps;
            break;
          }
          altEffect = altEffect.next;
          idx++;
        } while (altEffect !== altFirst);
      }

      const depsChanged: { index: number; changeType: 'reference' | 'primitive' | 'deep' }[] = [];
      if (prevDeps && currentDeps) {
        for (let i = 0; i < currentDeps.length; i++) {
          if (!Object.is(prevDeps[i], currentDeps[i])) {
            const changeType = typeof prevDeps[i] !== 'object' || prevDeps[i] === null
              ? 'primitive'
              : deepEqual(prevDeps[i], currentDeps[i]) ? 'deep' : 'reference';
            depsChanged.push({ index: i, changeType });
          }
        }
      }

      events.push({
        id: generateEventId(),
        timestamp: Date.now(),
        type: 'effect-fire',
        componentId,
        componentName,
        hookIndex,
        effectType,
        depsChanged,
        previousDeps: prevDeps ? prevDeps.map(d => serialize(d)) : [],
        currentDeps: currentDeps ? currentDeps.map((d: any) => serialize(d)) : [],
        cleanupDuration: null,
        effectDuration: null,
      });
    }
    effect = effect.next;
    hookIndex++;
  } while (effect !== firstEffect);

  return events;
}

// ── Memo/callback detection ──

function extractMemoEvents(fiber: any, componentId: string, componentName: string): InsightEvent[] {
  const events: InsightEvent[] = [];
  if (fiber.tag !== FunctionComponent && fiber.tag !== ForwardRef && fiber.tag !== SimpleMemoComponent) {
    return events;
  }
  if (!fiber.alternate) return events;

  let currHook = fiber.memoizedState;
  let prevHook = fiber.alternate.memoizedState;
  let hookIndex = 0;

  while (currHook && prevHook) {
    // useMemo/useCallback: queue is null, memoizedState is [value, deps]
    if (currHook.queue === null && Array.isArray(currHook.memoizedState) && currHook.memoizedState.length === 2) {
      const [currValue, currDeps] = currHook.memoizedState;
      const [prevValue, prevDeps] = prevHook.memoizedState || [undefined, undefined];

      if (Array.isArray(currDeps) && Array.isArray(prevDeps) && currValue !== prevValue) {
        const depsChanged: { index: number; changeType: 'reference' | 'primitive' | 'deep' }[] = [];
        for (let i = 0; i < currDeps.length; i++) {
          if (!Object.is(prevDeps[i], currDeps[i])) {
            const changeType = typeof prevDeps[i] !== 'object' || prevDeps[i] === null
              ? 'primitive'
              : deepEqual(prevDeps[i], currDeps[i]) ? 'deep' : 'reference';
            depsChanged.push({ index: i, changeType });
          }
        }

        const recomputedButUnchanged = deepEqual(prevValue, currValue);
        events.push({
          id: generateEventId(),
          timestamp: Date.now(),
          type: 'memo-compute',
          componentId,
          componentName,
          hookIndex,
          depsChanged,
          duration: null,
          result: serialize(currValue),
          recomputedButUnchanged,
        });
      }
    }
    currHook = currHook.next;
    prevHook = prevHook.next;
    hookIndex++;
  }

  return events;
}

// ── Tree walking ──

let eventCounter = 0;
function generateEventId(): string {
  return `e${++eventCounter}-${Date.now().toString(36)}`;
}

/**
 * Walks the committed Fiber tree and emits events for every component
 * that rendered in this commit.
 */
export function processCommit(root: any): InsightEvent[] {
  const events: InsightEvent[] = [];
  walkFiber(root, events);
  return events;
}

function fiberDidWork(fiber: any): boolean {
  if (!fiber.alternate) return true;
  if (fiber.memoizedProps !== fiber.alternate.memoizedProps) return true;
  if (fiber.memoizedState !== fiber.alternate.memoizedState) return true;
  // PerformedWork flag — React sets bit 0 when the component function executed
  if ((fiber.flags & 1) !== 0) return true;
  return false;
}

function walkFiber(fiber: any, events: InsightEvent[]): void {
  if (!fiber) return;

  if (COMPONENT_TAGS.has(fiber.tag)) {
    if (fiberDidWork(fiber)) {
      const componentId = getFiberId(fiber);
      const componentName = getComponentName(fiber);
      const isMount = !fiber.alternate;

      if (isMount) {
        const parentId = findParentComponentId(fiber);
        events.push({
          id: generateEventId(),
          timestamp: Date.now(),
          type: 'mount',
          componentId,
          componentName,
          parentId,
          sourceLocation: getSourceLocation(fiber),
        });
      }

      const count = (renderCounts.get(componentId) || 0) + 1;
      renderCounts.set(componentId, count);

      const renderEvent: RenderEvent = {
        id: generateEventId(),
        timestamp: Date.now(),
        type: 'render',
        componentId,
        componentName,
        duration: fiber.actualDuration ?? null,
        reasons: computeRenderReasons(fiber),
        sourceLocation: getSourceLocation(fiber),
        renderCount: count,
      };
      events.push(renderEvent);

      // Extract hook-level events
      events.push(...extractEffectEvents(fiber, componentId, componentName));
      events.push(...extractMemoEvents(fiber, componentId, componentName));
    }
  }

  if (fiber.child) walkFiber(fiber.child, events);
  if (fiber.sibling) walkFiber(fiber.sibling, events);
}

function findParentComponentId(fiber: any): string | null {
  let parent = fiber.return;
  while (parent) {
    if (COMPONENT_TAGS.has(parent.tag)) {
      return getFiberId(parent);
    }
    parent = parent.return;
  }
  return null;
}

/**
 * Detects unmounted fibers by comparing the previous tree's children.
 * Called with the previous root before React replaces it.
 */
export function detectUnmounts(prevFiber: any, currFiber: any): UnmountEvent[] {
  const events: UnmountEvent[] = [];
  const currentIds = new Set<string>();

  function collectIds(fiber: any) {
    if (!fiber) return;
    if (COMPONENT_TAGS.has(fiber.tag)) currentIds.add(getFiberId(fiber));
    if (fiber.child) collectIds(fiber.child);
    if (fiber.sibling) collectIds(fiber.sibling);
  }

  function findMissing(fiber: any) {
    if (!fiber) return;
    if (COMPONENT_TAGS.has(fiber.tag)) {
      const id = getFiberId(fiber);
      if (!currentIds.has(id)) {
        events.push({
          id: generateEventId(),
          timestamp: Date.now(),
          type: 'unmount',
          componentId: id,
          componentName: getComponentName(fiber),
        });
        renderCounts.delete(id);
      }
    }
    if (fiber.child) findMissing(fiber.child);
    if (fiber.sibling) findMissing(fiber.sibling);
  }

  if (currFiber) collectIds(currFiber);
  if (prevFiber) findMissing(prevFiber);
  return events;
}
