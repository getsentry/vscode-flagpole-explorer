import * as assert from '../test-utils/assert';
import * as vscode from 'vscode';
import { getRolloutStateIconPath } from './getRolloutStateIconPath';

suite('getRolloutStateIconPath', () => {
  test('0% returns circle-large-outline with red color', () => {
    const icon = getRolloutStateIconPath('0%');
    assert.ok(icon instanceof vscode.ThemeIcon);
    assert.strictEqual(icon.id, 'circle-large-outline');
  });

  test('partial returns color-mode with yellow color', () => {
    const icon = getRolloutStateIconPath('partial');
    assert.ok(icon instanceof vscode.ThemeIcon);
    assert.strictEqual(icon.id, 'color-mode');
  });

  test('100% returns pass-filled with green color', () => {
    const icon = getRolloutStateIconPath('100%');
    assert.ok(icon instanceof vscode.ThemeIcon);
    assert.strictEqual(icon.id, 'pass-filled');
  });

  test('unknown state returns question icon', () => {
    const icon = getRolloutStateIconPath('unknown' as any);
    assert.ok(icon instanceof vscode.ThemeIcon);
    assert.strictEqual(icon.id, 'question');
  });
});
