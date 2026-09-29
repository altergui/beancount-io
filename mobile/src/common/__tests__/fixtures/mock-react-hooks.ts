/**
 * Stand-in for `react`'s `useRef`, `useMemo`, and `useCallback`, faithful on
 * the one point the hooks under test rely on: a ref and a memo keep their slot
 * across renders, and a memo recomputes only when a dependency changes
 * identity. `useCallback` is `useMemo` returning a function.
 */
let slots: unknown[] = [];
let cursor = 0;

export function resetHooks(): void {
  slots = [];
}

/** Run one render of a hook. */
export function render<T>(hook: () => T): T {
  cursor = 0;
  return hook();
}

export function useRef<T>(initial: T): { current: T } {
  const index = cursor++;
  if (!(index in slots)) slots[index] = { current: initial };
  return slots[index] as { current: T };
}

export function useMemo<T>(factory: () => T, deps: unknown[]): T {
  const index = cursor++;
  const previous = slots[index] as { deps: unknown[]; value: T } | undefined;
  if (
    previous &&
    previous.deps.length === deps.length &&
    previous.deps.every((dep, i) => Object.is(dep, deps[i]))
  ) {
    return previous.value;
  }
  const value = factory();
  slots[index] = { deps, value };
  return value;
}

export function useCallback<T extends (...args: never[]) => unknown>(
  fn: T,
  deps: unknown[],
): T {
  return useMemo(() => fn, deps);
}
