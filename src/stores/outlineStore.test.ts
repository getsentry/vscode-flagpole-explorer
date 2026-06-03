import * as assert from '../test-utils/assert';
import * as vscode from 'vscode';
import OutlineStore from './outlineStore';

function makeSymbol(name: string, detail: string, children: vscode.DocumentSymbol[] = []): vscode.DocumentSymbol {
  const range = new vscode.Range(0, 0, 0, 0);
  const sym = new vscode.DocumentSymbol(name, detail, vscode.SymbolKind.Property, range, range);
  sym.children = children;
  return sym;
}

const uri = vscode.Uri.parse('file:///test/flagpole.yaml');

class TestableOutlineStore extends OutlineStore {
  public static testDocumentSymbolsToMap(uri: vscode.Uri, symbols: vscode.DocumentSymbol[]) {
    return OutlineStore.documentSymbolsToMap(uri, symbols);
  }
}

suite('OutlineStore.documentSymbolsToMap', () => {
  test('returns undefined when no options symbol exists', () => {
    const symbols = [makeSymbol('not-options', '')];
    const result = TestableOutlineStore.testDocumentSymbolsToMap(uri, symbols);
    assert.strictEqual(result, undefined);
  });

  test('returns undefined for empty symbols array', () => {
    const result = TestableOutlineStore.testDocumentSymbolsToMap(uri, []);
    assert.strictEqual(result, undefined);
  });

  test('returns empty collections when options has no children', () => {
    const options = makeSymbol('options', '');
    const result = TestableOutlineStore.testDocumentSymbolsToMap(uri, [options]);
    assert.ok(result);
    assert.strictEqual(result.allFeatures.length, 0);
    assert.strictEqual(result.allSegments.length, 0);
    assert.strictEqual(result.allConditions.length, 0);
    assert.deepStrictEqual(result.allOwners, {});
    assert.deepStrictEqual(result.allRollouts, {});
    assert.deepStrictEqual(result.allEnabled, {});
    assert.deepStrictEqual(result.allCreatedAt, {});
  });

  test('parses a single feature into all collections', () => {
    const options = makeSymbol('options', '', [
      makeSymbol('feature.organizations:my-flag', '', [
        makeSymbol('created_at', '2025-01-15'),
        makeSymbol('enabled', 'true'),
        makeSymbol('owner', 'team-alpha'),
        makeSymbol('segments', '', [
          makeSymbol('0', '', [
            makeSymbol('name', 'GA'),
            makeSymbol('rollout', '100'),
            makeSymbol('conditions', '', []),
          ]),
        ]),
      ]),
    ]);

    const result = TestableOutlineStore.testDocumentSymbolsToMap(uri, [options]);
    assert.ok(result);
    assert.strictEqual(result.allFeatures.length, 1);
    assert.strictEqual(result.allFeatures[0].name, 'feature.organizations:my-flag');
    assert.strictEqual(result.allSegments.length, 1);
    assert.strictEqual(result.allConditions.length, 0);
    assert.ok('team-alpha' in result.allOwners);
    assert.ok('100%' in result.allRollouts);
    assert.ok('true' in result.allEnabled);
    assert.ok('2025-01-15' in result.allCreatedAt);
  });

  test('groups features by owner', () => {
    const options = makeSymbol('options', '', [
      makeSymbol('flag-a', '', [
        makeSymbol('created_at', '2025-01-01'),
        makeSymbol('owner', 'team-alpha'),
      ]),
      makeSymbol('flag-b', '', [
        makeSymbol('created_at', '2025-01-01'),
        makeSymbol('owner', 'team-alpha'),
      ]),
      makeSymbol('flag-c', '', [
        makeSymbol('created_at', '2025-01-01'),
        makeSymbol('owner', 'team-beta'),
      ]),
    ]);

    const result = TestableOutlineStore.testDocumentSymbolsToMap(uri, [options]);
    assert.ok(result);
    assert.strictEqual(Object.keys(result.allOwners).length, 2);
    assert.strictEqual(result.allOwners['team-alpha'].children.length, 2);
    assert.strictEqual(result.allOwners['team-beta'].children.length, 1);
  });

  test('groups features by rollout state', () => {
    const options = makeSymbol('options', '', [
      makeSymbol('flag-full', '', [
        makeSymbol('created_at', '2025-01-01'),
        makeSymbol('owner', 'team-x'),
        makeSymbol('segments', '', [
          makeSymbol('0', '', [
            makeSymbol('name', 'GA'),
            makeSymbol('rollout', '100'),
            makeSymbol('conditions', '', []),
          ]),
        ]),
      ]),
      makeSymbol('flag-partial', '', [
        makeSymbol('created_at', '2025-01-01'),
        makeSymbol('owner', 'team-x'),
        makeSymbol('segments', '', [
          makeSymbol('0', '', [
            makeSymbol('name', 'LA'),
            makeSymbol('rollout', '100'),
            makeSymbol('conditions', '', [
              makeSymbol('0', '', [
                makeSymbol('operator', 'in'),
                makeSymbol('property', 'organization_slug'),
                makeSymbol('value', 'sentry'),
              ]),
            ]),
          ]),
        ]),
      ]),
      makeSymbol('flag-zero', '', [
        makeSymbol('created_at', '2025-01-01'),
        makeSymbol('owner', 'team-x'),
      ]),
    ]);

    const result = TestableOutlineStore.testDocumentSymbolsToMap(uri, [options]);
    assert.ok(result);
    assert.ok('100%' in result.allRollouts);
    assert.ok('partial' in result.allRollouts);
    assert.ok('0%' in result.allRollouts);
    assert.strictEqual(result.allRollouts['100%'].children.length, 1);
    assert.strictEqual(result.allRollouts['partial'].children.length, 1);
    assert.strictEqual(result.allRollouts['0%'].children.length, 1);
  });

  test('groups features by enabled state', () => {
    const options = makeSymbol('options', '', [
      makeSymbol('flag-enabled', '', [
        makeSymbol('created_at', '2025-01-01'),
        makeSymbol('enabled', 'true'),
        makeSymbol('owner', 'team-x'),
      ]),
      makeSymbol('flag-disabled', '', [
        makeSymbol('created_at', '2025-01-01'),
        makeSymbol('enabled', 'false'),
        makeSymbol('owner', 'team-x'),
      ]),
    ]);

    const result = TestableOutlineStore.testDocumentSymbolsToMap(uri, [options]);
    assert.ok(result);
    assert.ok('true' in result.allEnabled);
    assert.ok('false' in result.allEnabled);
    assert.strictEqual(result.allEnabled['true'].children.length, 1);
    assert.strictEqual(result.allEnabled['false'].children.length, 1);
  });

  test('groups features by created_at', () => {
    const options = makeSymbol('options', '', [
      makeSymbol('flag-a', '', [
        makeSymbol('created_at', '2025-01-01'),
        makeSymbol('owner', 'team-x'),
      ]),
      makeSymbol('flag-b', '', [
        makeSymbol('created_at', '2025-01-01'),
        makeSymbol('owner', 'team-x'),
      ]),
      makeSymbol('flag-c', '', [
        makeSymbol('created_at', '2026-06-01'),
        makeSymbol('owner', 'team-x'),
      ]),
    ]);

    const result = TestableOutlineStore.testDocumentSymbolsToMap(uri, [options]);
    assert.ok(result);
    assert.strictEqual(Object.keys(result.allCreatedAt).length, 2);
    assert.strictEqual(result.allCreatedAt['2025-01-01'].children.length, 2);
    assert.strictEqual(result.allCreatedAt['2026-06-01'].children.length, 1);
  });

  test('collects all segments and conditions', () => {
    const options = makeSymbol('options', '', [
      makeSymbol('flag-a', '', [
        makeSymbol('created_at', '2025-01-01'),
        makeSymbol('owner', 'team-x'),
        makeSymbol('segments', '', [
          makeSymbol('0', '', [
            makeSymbol('name', 'LA'),
            makeSymbol('rollout', '100'),
            makeSymbol('conditions', '', [
              makeSymbol('0', '', [
                makeSymbol('operator', 'in'),
                makeSymbol('property', 'organization_slug'),
                makeSymbol('value', 'sentry'),
              ]),
              makeSymbol('1', '', [
                makeSymbol('operator', 'equals'),
                makeSymbol('property', 'user_is-staff'),
                makeSymbol('value', 'true'),
              ]),
            ]),
          ]),
          makeSymbol('1', '', [
            makeSymbol('name', 'GA'),
            makeSymbol('rollout', '100'),
            makeSymbol('conditions', '', []),
          ]),
        ]),
      ]),
    ]);

    const result = TestableOutlineStore.testDocumentSymbolsToMap(uri, [options]);
    assert.ok(result);
    assert.strictEqual(result.allSegments.length, 2);
    assert.strictEqual(result.allConditions.length, 2);
    assert.strictEqual(result.allConditions[0].property, 'organization_slug');
    assert.strictEqual(result.allConditions[1].property, 'user_is-staff');
  });

  test('preserves range and selectionRange from options symbol', () => {
    const range = new vscode.Range(10, 0, 100, 0);
    const selRange = new vscode.Range(10, 2, 10, 9);
    const options = new vscode.DocumentSymbol('options', '', vscode.SymbolKind.Property, range, selRange);
    options.children = [];

    const result = TestableOutlineStore.testDocumentSymbolsToMap(uri, [options]);
    assert.ok(result);
    assert.ok(result.range.isEqual(range));
    assert.ok(result.selectionRange.isEqual(selRange));
  });
});
