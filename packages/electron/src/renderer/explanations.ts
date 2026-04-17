import type { InsightEventItem } from './store';

export interface Explanation {
  prose: string;
  verdict: 'wasted' | 'expected' | 'suspicious' | 'info';
  verdictLabel: string;
  fixSuggestion: string | null;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function renderReasonExplanation(event: InsightEventItem): Explanation {
  const reasons = event.reasons || [];
  const name = event.componentName || 'Component';
  const count = event.renderCount ?? 1;
  const parts: string[] = [];

  parts.push(`**${name}** re-rendered (${ordinal(count)} time).`);
  parts.push('');

  let verdict: Explanation['verdict'] = 'expected';
  let verdictLabel = 'Expected re-render';
  let fixSuggestion: string | null = null;

  for (const reason of reasons) {
    switch (reason.type) {
      case 'initial-mount':
        parts.push('**Cause:** Initial mount — this component rendered for the first time.');
        verdict = 'info';
        verdictLabel = 'Initial mount';
        break;

      case 'prop-change':
        if (reason.deepEqual) {
          parts.push(
            `**Cause:** The \`${reason.propName}\` prop was a new object reference, but deep-equal ` +
            `to the previous value. This means the parent re-created the object on render instead of reusing it.`
          );
          parts.push('');
          verdict = 'wasted';
          verdictLabel = 'Likely wasted render';
          fixSuggestion =
            `Wrap the \`${reason.propName}\` value in \`useMemo\` in the parent component, ` +
            `or memoize **${name}** with \`React.memo\` to prevent re-renders when props are deep-equal.`;
        } else {
          parts.push(`**Cause:** The \`${reason.propName}\` prop changed to a new value.`);
        }
        break;

      case 'state-change':
        parts.push(`**Cause:** Internal state changed (hook #${reason.hookIndex}).`);
        parts.push('');
        parts.push('This is typically an expected re-render triggered by a \`useState\` or \`useReducer\` update.');
        break;

      case 'context-change':
        parts.push('**Cause:** A context value this component consumes has changed.');
        parts.push('');
        parts.push(
          'If this component only reads a subset of the context value, consider splitting ' +
          'the context or using \`useMemo\` to select only the fields you need.'
        );
        verdict = 'suspicious';
        verdictLabel = 'Investigate — context may be over-broad';
        break;

      case 'parent-render':
        parts.push(
          '**Cause:** The parent component re-rendered. This component has no local ' +
          'prop or state changes — it re-rendered solely because its parent did.'
        );
        parts.push('');
        verdict = 'wasted';
        verdictLabel = 'Likely wasted render';
        fixSuggestion =
          `Wrap **${name}** with \`React.memo\` to skip re-renders when props haven't changed. ` +
          `If this component is cheap to render, the overhead of memoization may not be worth it.`;
        break;

      case 'force-update':
        parts.push('**Cause:** A force update was triggered via \`forceUpdate()\` or an equivalent mechanism.');
        verdict = 'suspicious';
        verdictLabel = 'Force update — investigate';
        break;
    }
  }

  if (event.sourceLocation) {
    parts.push('');
    parts.push(`**Source:** \`${event.sourceLocation.file}:${event.sourceLocation.line}\``);
  }

  return { prose: parts.join('\n'), verdict, verdictLabel, fixSuggestion };
}

function effectExplanation(event: InsightEventItem): Explanation {
  const name = event.componentName || 'Component';
  const effectLabel = event.effectType === 'layoutEffect' ? 'useLayoutEffect' : 'useEffect';
  const parts: string[] = [];

  parts.push(`**${effectLabel}** in **${name}** fired.`);
  parts.push('');

  let verdict: Explanation['verdict'] = 'expected';
  let verdictLabel = 'Expected effect';
  let fixSuggestion: string | null = null;

  const depsChanged = event.depsChanged || [];
  const hasDeepOnlyChanges = depsChanged.length > 0 && depsChanged.every((d: any) => d.changeType === 'deep');

  if (depsChanged.length > 0) {
    const indices = depsChanged.map((d: any) => `dep[${d.index}] (${d.changeType})`).join(', ');
    parts.push(`**Changed deps:** ${indices}`);

    if (hasDeepOnlyChanges) {
      parts.push('');
      parts.push(
        'All changed dependencies are deep-equal to their previous values. ' +
        'This effect may be firing more often than intended.'
      );
      verdict = 'wasted';
      verdictLabel = 'Effect firing unnecessarily';
      fixSuggestion =
        'Consider memoizing the dependency values with `useMemo`, or use a deep-compare ' +
        'custom hook like `useDeepCompareEffect` if the deps are objects/arrays.';
    }
  } else {
    parts.push('No dependency array was provided, or all deps changed.');
    verdict = 'suspicious';
    verdictLabel = 'Runs every render — investigate';
    fixSuggestion =
      'Add a dependency array to this effect to control when it fires. ' +
      'An empty array `[]` means it runs only on mount.';
  }

  return { prose: parts.join('\n'), verdict, verdictLabel, fixSuggestion };
}

function memoExplanation(event: InsightEventItem): Explanation {
  const name = event.componentName || 'Component';
  const parts: string[] = [];

  parts.push(`**useMemo** in **${name}** recomputed.`);
  parts.push('');

  let verdict: Explanation['verdict'] = 'expected';
  let verdictLabel = 'Expected recomputation';
  let fixSuggestion: string | null = null;

  if (event.recomputedButUnchanged) {
    parts.push(
      'The new result is deep-equal to the previous result. ' +
      'The memo is recomputing but producing the same output — this is a performance smell.'
    );
    verdict = 'wasted';
    verdictLabel = 'Memoization mismatch';
    fixSuggestion =
      'The dependencies are changing (causing recomputation) but the result is always the same. ' +
      'Check if the deps are unstable references. Consider restructuring to avoid unnecessary recomputation.';
  } else {
    const depsChanged = event.depsChanged || [];
    if (depsChanged.length > 0) {
      const indices = depsChanged.map((d: any) => `dep[${d.index}]`).join(', ');
      parts.push(`**Changed deps:** ${indices}`);
    }
  }

  return { prose: parts.join('\n'), verdict, verdictLabel, fixSuggestion };
}

function mountExplanation(event: InsightEventItem): Explanation {
  const name = event.componentName || 'Component';
  return {
    prose: `**${name}** mounted and was added to the component tree.`,
    verdict: 'info',
    verdictLabel: 'Component mounted',
    fixSuggestion: null,
  };
}

function unmountExplanation(event: InsightEventItem): Explanation {
  const name = event.componentName || 'Component';
  return {
    prose: `**${name}** was removed from the component tree.`,
    verdict: 'info',
    verdictLabel: 'Component unmounted',
    fixSuggestion: null,
  };
}

function stateChangeExplanation(event: InsightEventItem): Explanation {
  const name = event.componentName || 'Component';
  const hookIdx = event.hookIndex ?? '?';
  return {
    prose:
      `State hook #${hookIdx} in **${name}** was updated.\n\n` +
      `This triggered a re-render of the component.`,
    verdict: 'info',
    verdictLabel: 'State update',
    fixSuggestion: null,
  };
}

export function generateExplanation(event: InsightEventItem): Explanation {
  switch (event.type) {
    case 'render':
      return renderReasonExplanation(event);
    case 'effect-fire':
      return effectExplanation(event);
    case 'memo-compute':
      return memoExplanation(event);
    case 'mount':
      return mountExplanation(event);
    case 'unmount':
      return unmountExplanation(event);
    case 'state-change':
      return stateChangeExplanation(event);
    default:
      return {
        prose: `**${event.type}** event on **${event.componentName || 'Unknown'}**.`,
        verdict: 'info',
        verdictLabel: event.type,
        fixSuggestion: null,
      };
  }
}
