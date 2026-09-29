/** Stand-in for `@/common/vars/display-currency`: same reactive-var shape as
 * `persistent-var`'s real one, without the AsyncStorage-backed persistence. */
function reactiveVar<T>(initial: T) {
  let current = initial;
  return function value(next?: T): T {
    if (next !== undefined) current = next;
    return current;
  };
}

export const displayCurrencyVar = reactiveVar<Record<string, string>>({});
