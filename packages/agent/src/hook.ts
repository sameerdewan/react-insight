import type { Transport } from './transport';
import { processCommit, detectUnmounts } from './fiber-walker';

/**
 * Attaches to React's __REACT_DEVTOOLS_GLOBAL_HOOK__ and processes every
 * Fiber commit, emitting events through the given transport.
 */
export function attach(transport: Transport): void {
  if (typeof window === 'undefined') return;

  const w = window as any;

  // Ensure the global hook exists so React registers with it.
  // If React DevTools is already loaded, it will have created this.
  // We create a minimal stub otherwise so React can call inject().
  if (!w.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    let nextRendererID = 1;
    w.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      renderers: new Map(),
      supportsFiber: true,
      inject(renderer: any) {
        const id = nextRendererID++;
        this.renderers.set(id, renderer);
        return id;
      },
      onCommitFiberRoot() {},
      onCommitFiberUnmount() {},
      onPostCommitFiberRoot() {},
    };
  }

  const hook = w.__REACT_DEVTOOLS_GLOBAL_HOOK__;

  // Track previous roots for unmount detection
  const prevRoots = new Map<any, any>();

  // Wrap onCommitFiberRoot — chain with existing handler (e.g. React DevTools)
  const originalOnCommitFiberRoot = hook.onCommitFiberRoot;
  hook.onCommitFiberRoot = function (rendererID: number, root: any, priority: any) {
    if (typeof originalOnCommitFiberRoot === 'function') {
      try { originalOnCommitFiberRoot.call(hook, rendererID, root, priority); } catch { /* */ }
    }

    try {
      const current = root.current;
      if (!current) return;

      // Detect unmounts from previous tree
      const prev = prevRoots.get(root);
      if (prev) {
        const unmounts = detectUnmounts(prev, current);
        for (const event of unmounts) transport.send(event);
      }
      prevRoots.set(root, current);

      // Walk the current tree and extract events
      const events = processCommit(current);
      for (const event of events) transport.send(event);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[react-insight] Error processing commit:', err);
      }
    }
  };

  // Unmount detection via the dedicated hook
  const originalOnCommitFiberUnmount = hook.onCommitFiberUnmount;
  hook.onCommitFiberUnmount = function (rendererID: number, fiber: any) {
    if (typeof originalOnCommitFiberUnmount === 'function') {
      try { originalOnCommitFiberUnmount.call(hook, rendererID, fiber); } catch { /* */ }
    }
    // Individual unmount events are already detected via tree diffing
  };
}
