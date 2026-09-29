import * as assert from '../test-utils/assert';
import cliVersionProblem from './sentryOptionsCliVersion';

suite('cliVersionProblem', () => {
  test('accepts the minimum version and newer', () => {
    assert.strictEqual(cliVersionProblem('sentry-options-cli 1.2.13\n'), null);
    assert.strictEqual(cliVersionProblem('sentry-options-cli 1.3.0'), null);
    assert.strictEqual(cliVersionProblem('sentry-options-cli 2.0.0'), null);
  });

  test('rejects older versions', () => {
    assert.strictEqual(
      cliVersionProblem('sentry-options-cli 0.0.9'),
      'Flag evaluation needs sentry-options-cli 1.2.13 or later, found 0.0.9.',
    );
    assert.notStrictEqual(cliVersionProblem('sentry-options-cli 1.2.9'), null);
  });

  test('reports a missing CLI', () => {
    assert.strictEqual(
      cliVersionProblem('zsh:1: command not found: sentry-options-cli'),
      "Flag evaluation needs sentry-options-cli 1.2.13 or later, and it isn't installed.",
    );
  });
});
