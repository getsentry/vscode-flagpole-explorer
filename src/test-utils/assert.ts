class AssertionError extends Error {
  actual: unknown;
  expected: unknown;
  operator: string;

  constructor(opts: {actual: unknown; expected: unknown; operator: string; message?: string}) {
    super(
      opts.message ||
        `Expected ${JSON.stringify(opts.actual)} ${opts.operator} ${JSON.stringify(opts.expected)}`
    );
    this.name = 'AssertionError';
    this.actual = opts.actual;
    this.expected = opts.expected;
    this.operator = opts.operator;
  }
}

export function strictEqual<T>(actual: unknown, expected: T, message?: string): asserts actual is T {
  if (actual !== expected) {
    throw new AssertionError({actual, expected, operator: '===', message});
  }
}

export function notStrictEqual(actual: unknown, expected: unknown, message?: string): void {
  if (actual === expected) {
    throw new AssertionError({actual, expected, operator: '!==', message});
  }
}

function _deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  if (keysA.length !== keysB.length) {
    return false;
  }
  for (const key of keysA) {
    if (
      !_deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    ) {
      return false;
    }
  }
  return true;
}

export function deepStrictEqual(actual: unknown, expected: unknown, message?: string): void {
  if (!_deepEqual(actual, expected)) {
    throw new AssertionError({actual, expected, operator: 'deepStrictEqual', message});
  }
}

export function ok(value: unknown, message?: string): asserts value {
  if (!value) {
    throw new AssertionError({actual: value, expected: true, operator: '==', message});
  }
}

export function throws(fn: () => void, expected?: RegExp | string): void {
  try {
    fn();
  } catch (err) {
    if (expected instanceof RegExp) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!expected.test(msg)) {
        throw new AssertionError({
          actual: msg,
          expected: expected.toString(),
          operator: 'throws',
          message: `Error message "${msg}" does not match ${expected}`,
        });
      }
    }
    return;
  }
  throw new AssertionError({
    actual: 'no error',
    expected: 'error',
    operator: 'throws',
    message: typeof expected === 'string' ? expected : undefined,
  });
}

export async function rejects(
  fn: (() => Promise<unknown>) | Promise<unknown>,
  expected?: RegExp | string,
): Promise<void> {
  try {
    const promise = typeof fn === 'function' ? fn() : fn;
    await promise;
  } catch (err) {
    if (expected instanceof RegExp) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!expected.test(msg)) {
        throw new AssertionError({
          actual: msg,
          expected: expected.toString(),
          operator: 'rejects',
          message: `Error message "${msg}" does not match ${expected}`,
        });
      }
    }
    return;
  }
  throw new AssertionError({
    actual: 'no rejection',
    expected: 'rejection',
    operator: 'rejects',
    message: typeof expected === 'string' ? expected : undefined,
  });
}
