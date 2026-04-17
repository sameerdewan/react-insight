import type { SerializedValue } from './types';
import { getConfig } from './config';

const MAX_STRING = 1000;
const MAX_KEYS = 50;

const REACT_ELEMENT_SYMBOL = Symbol.for('react.element');
const REACT_TRANSITIONAL_ELEMENT_SYMBOL = Symbol.for('react.transitional.element');

export function serialize(value: unknown, depth = 0, seen = new WeakSet<object>()): SerializedValue {
  const maxDepth = getConfig().serializationDepth;
  if (depth > maxDepth) return { type: 'truncated' };

  if (value === null) return { type: 'null' };
  if (value === undefined) return { type: 'undefined' };

  switch (typeof value) {
    case 'string':
      return {
        type: 'string',
        value: value.length > MAX_STRING ? value.slice(0, MAX_STRING) + '…' : value,
      };
    case 'number':
      return { type: 'number', value };
    case 'boolean':
      return { type: 'boolean', value };
    case 'bigint':
      return { type: 'bigint', value: value.toString() };
    case 'symbol':
      return { type: 'symbol', value: value.toString() };
    case 'function':
      return { type: 'function', name: (value as Function).name || 'anonymous' };
  }

  const obj = value as Record<string, unknown>;

  if (seen.has(obj)) return { type: 'circular' };
  seen.add(obj);

  try {
    if (Array.isArray(obj)) {
      const items = obj.slice(0, MAX_KEYS).map(v => serialize(v, depth + 1, seen));
      return {
        type: 'array',
        items,
        length: obj.length,
        truncated: obj.length > MAX_KEYS,
      };
    }

    if (obj instanceof Date) return { type: 'date', value: obj.toISOString() };
    if (obj instanceof RegExp) return { type: 'regexp', value: obj.toString() };
    if (obj instanceof Error) return { type: 'error', name: obj.name, message: obj.message };

    if (obj instanceof Map) {
      const entries: [SerializedValue, SerializedValue][] = [];
      let i = 0;
      for (const [k, v] of obj) {
        if (i++ >= MAX_KEYS) break;
        entries.push([serialize(k, depth + 1, seen), serialize(v, depth + 1, seen)]);
      }
      return { type: 'map', entries, size: obj.size };
    }

    if (obj instanceof Set) {
      const items: SerializedValue[] = [];
      let i = 0;
      for (const v of obj) {
        if (i++ >= MAX_KEYS) break;
        items.push(serialize(v, depth + 1, seen));
      }
      return { type: 'set', items, size: obj.size };
    }

    // React elements
    const $$typeof = (obj as any).$$typeof;
    if ($$typeof === REACT_ELEMENT_SYMBOL || $$typeof === REACT_TRANSITIONAL_ELEMENT_SYMBOL || $$typeof === 0xeac7) {
      const elType = (obj as any).type;
      const name = typeof elType === 'string'
        ? elType
        : elType?.displayName || elType?.name || 'Unknown';
      return { type: 'react-element', name };
    }

    // DOM nodes
    if (typeof HTMLElement !== 'undefined' && obj instanceof HTMLElement) {
      return { type: 'dom', tag: obj.tagName.toLowerCase(), id: obj.id || undefined };
    }

    // Plain objects and class instances
    const keys = Object.keys(obj);
    const entries: Record<string, SerializedValue> = {};
    const limit = Math.min(keys.length, MAX_KEYS);
    for (let i = 0; i < limit; i++) {
      entries[keys[i]] = serialize(obj[keys[i]], depth + 1, seen);
    }

    const ctor = obj.constructor?.name;
    return {
      type: 'object',
      entries,
      totalKeys: keys.length,
      truncated: keys.length > MAX_KEYS,
      className: ctor && ctor !== 'Object' ? ctor : undefined,
    };
  } finally {
    seen.delete(obj);
  }
}

/** Structural deep equality, capped at 10 levels. */
export function deepEqual(a: unknown, b: unknown, depth = 0): boolean {
  if (depth > 10) return false;
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual((a as any)[key], (b as any)[key], depth + 1)) return false;
  }
  return true;
}
