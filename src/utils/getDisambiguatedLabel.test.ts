import * as assert from '../test-utils/assert';
import * as vscode from 'vscode';
import { getDisambiguatedLabel } from './getDisambiguatedLabel';

suite('getDisambiguatedLabel', () => {
  test('returns basename when uri is the only one', () => {
    const uri = vscode.Uri.parse('file:///repo/options/default/flagpole.yaml');
    assert.strictEqual(getDisambiguatedLabel(uri, [uri]), 'flagpole.yaml');
  });

  test('returns basename when all uris share a basename but only one exists', () => {
    const uri = vscode.Uri.parse('file:///repo/options/default/flagpole.yaml');
    assert.strictEqual(getDisambiguatedLabel(uri, []), 'flagpole.yaml');
  });

  test('adds parent segments until unique among colliding basenames', () => {
    const a = vscode.Uri.parse('file:///repo/options/default/flagpole.yaml');
    const b = vscode.Uri.parse('file:///repo/.claude/worktrees/seer-agent-autofix-flag/options/default/flagpole.yaml');

    assert.strictEqual(getDisambiguatedLabel(a, [a, b]), 'repo/options/default/flagpole.yaml');
    assert.strictEqual(
      getDisambiguatedLabel(b, [a, b]),
      'seer-agent-autofix-flag/options/default/flagpole.yaml',
    );
  });

  test('walks all the way to the full path when needed', () => {
    const a = vscode.Uri.parse('file:///repo-one/options/default/flagpole.yaml');
    const b = vscode.Uri.parse('file:///repo-two/options/default/flagpole.yaml');

    assert.strictEqual(getDisambiguatedLabel(a, [a, b]), 'repo-one/options/default/flagpole.yaml');
    assert.strictEqual(getDisambiguatedLabel(b, [a, b]), 'repo-two/options/default/flagpole.yaml');
  });

  test('non-colliding uris keep the bare basename even when others exist', () => {
    const a = vscode.Uri.parse('file:///repo/flagpole.yaml');
    const b = vscode.Uri.parse('file:///repo/other.yaml');

    assert.strictEqual(getDisambiguatedLabel(a, [a, b]), 'flagpole.yaml');
  });
});
