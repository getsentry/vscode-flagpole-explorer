import * as assert from '../test-utils/assert';
import getRolloutEmoji from './getRolloutEmoji';

suite('getRolloutEmoji', () => {
  test('returns circle for 0%', () => {
    assert.strictEqual(getRolloutEmoji('0%'), '⭕');
  });

  test('returns orange for partial', () => {
    assert.strictEqual(getRolloutEmoji('partial'), '🟠');
  });

  test('returns green for 100%', () => {
    assert.strictEqual(getRolloutEmoji('100%'), '🟢');
  });

  test('throws for unknown state', () => {
    assert.throws(
      () => getRolloutEmoji('unknown' as any),
      /Unknown rollout state: unknown/,
    );
  });
});
