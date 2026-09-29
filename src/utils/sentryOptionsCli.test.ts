import * as assert from '../test-utils/assert';
import { cliProblem, expandHome, shellQuote } from './sentryOptionsCli';

suite('shellQuote', () => {
  test('wraps values in single quotes', () => {
    assert.strictEqual(shellQuote('/a b/sentry-options-cli'), `'/a b/sentry-options-cli'`);
    assert.strictEqual(shellQuote('{"a":"$HOME `id`"}'), `'{"a":"$HOME \`id\`"}'`);
  });

  test('escapes embedded single quotes', () => {
    assert.strictEqual(shellQuote(`O'Brien`), `'O'\\''Brien'`);
  });
});

suite('expandHome', () => {
  test('expands a leading ~ or $HOME only', () => {
    assert.strictEqual(expandHome('~/code/x.yaml', '/Users/me'), '/Users/me/code/x.yaml');
    assert.strictEqual(expandHome('$HOME/code/x.yaml', '/Users/me'), '/Users/me/code/x.yaml');
    assert.strictEqual(expandHome('/tmp/$HOME/x', '/Users/me'), '/tmp/$HOME/x');
    assert.strictEqual(expandHome('~other/x', '/Users/me'), '~other/x');
  });
});

suite('cliProblem', () => {
  test('flags a missing or outdated CLI', () => {
    assert.notStrictEqual(cliProblem(127), null);
    assert.notStrictEqual(cliProblem(2), null);
  });

  test('ignores success and evaluation errors', () => {
    assert.strictEqual(cliProblem(0), null);
    assert.strictEqual(cliProblem(1), null);
    assert.strictEqual(cliProblem(undefined), null);
  });
});
