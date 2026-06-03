import * as assert from '../test-utils/assert';
import * as vscode from 'vscode';
import { FileTreeItem, ValueTreeItem, FeatureTreeItem } from './treeViewItems';
import { LogicalFeature, LogicalValue } from '../transform/transformers';

const uri = vscode.Uri.parse('file:///test/flagpole.yaml');

function makeSymbol(name: string, range?: vscode.Range): vscode.DocumentSymbol {
  const r = range ?? new vscode.Range(0, 0, 0, 0);
  return new vscode.DocumentSymbol(name, '', vscode.SymbolKind.Property, r, r);
}

function makeLogicalFeature(overrides: Partial<LogicalFeature> = {}): LogicalFeature {
  return {
    symbol: makeSymbol('feature.organizations:test'),
    uri,
    name: 'feature.organizations:test',
    created_at: '2025-01-01',
    enabled: true,
    owner: 'team-x',
    segmentsSymbol: undefined,
    segments: [],
    rolloutState: '0%',
    hasExtraSegments: false,
    ...overrides,
  };
}

suite('treeViewItems', () => {
  suite('FileTreeItem', () => {
    test('sets label to uri', () => {
      const item = new FileTreeItem(uri, '42');
      assert.strictEqual(item.resourceUri, uri);
    });

    test('sets description', () => {
      const item = new FileTreeItem(uri, '42');
      assert.strictEqual(item.description, '42');
    });

    test('is expanded by default', () => {
      const item = new FileTreeItem(uri, '5');
      assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
    });

    test('uses json icon', () => {
      const item = new FileTreeItem(uri, '0');
      assert.ok(item.iconPath instanceof vscode.ThemeIcon);
      assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, 'json');
    });
  });

  suite('ValueTreeItem', () => {
    test('sets label from element value', () => {
      const element = new LogicalValue(uri, 'team-alpha');
      const item = new ValueTreeItem(element, () => undefined);
      assert.strictEqual(item.label, 'team-alpha');
    });

    test('sets description to child count', () => {
      const element = new LogicalValue(uri, 'team-alpha');
      element.addFeature(makeLogicalFeature({ name: 'flag-a' }));
      element.addFeature(makeLogicalFeature({ name: 'flag-b' }));
      const item = new ValueTreeItem(element, () => undefined);
      assert.strictEqual(item.description, '2');
    });

    test('is collapsed by default', () => {
      const element = new LogicalValue(uri, 'test');
      const item = new ValueTreeItem(element, () => undefined);
      assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
    });

    test('uses icon from callback', () => {
      const element = new LogicalValue(uri, 'test');
      const icon = new vscode.ThemeIcon('pass-filled');
      const item = new ValueTreeItem(element, () => icon);
      assert.strictEqual(item.iconPath, icon);
    });

    test('allows undefined icon', () => {
      const element = new LogicalValue(uri, 'test');
      const item = new ValueTreeItem(element, () => undefined);
      assert.strictEqual(item.iconPath, undefined);
    });
  });

  suite('FeatureTreeItem', () => {
    test('sets label to feature name', () => {
      const feature = makeLogicalFeature({ name: 'feature.organizations:my-flag' });
      const item = new FeatureTreeItem(feature);
      assert.strictEqual(item.label, 'feature.organizations:my-flag');
    });

    test('is not collapsible', () => {
      const feature = makeLogicalFeature();
      const item = new FeatureTreeItem(feature);
      assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.None);
    });

    test('has a go-to-location command', () => {
      const feature = makeLogicalFeature();
      const item = new FeatureTreeItem(feature);
      assert.ok(item.command);
      assert.strictEqual(item.command.command, 'editor.action.goToLocations');
      assert.strictEqual(item.command.title, 'view');
    });

    test('command arguments include feature uri and range', () => {
      const range = new vscode.Range(10, 2, 15, 0);
      const symbol = makeSymbol('test', range);
      const feature = makeLogicalFeature({ symbol, uri });
      const item = new FeatureTreeItem(feature);
      assert.ok(item.command);
      assert.ok(item.command.arguments);
      assert.strictEqual(item.command.arguments[0], uri);
      assert.ok(item.command.arguments[1].isEqual(range.start));
    });

    test('icon reflects rollout state 0%', () => {
      const feature = makeLogicalFeature({ rolloutState: '0%' });
      const item = new FeatureTreeItem(feature);
      assert.ok(item.iconPath instanceof vscode.ThemeIcon);
      assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, 'circle-large-outline');
    });

    test('icon reflects rollout state partial', () => {
      const feature = makeLogicalFeature({ rolloutState: 'partial' });
      const item = new FeatureTreeItem(feature);
      assert.ok(item.iconPath instanceof vscode.ThemeIcon);
      assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, 'color-mode');
    });

    test('icon reflects rollout state 100%', () => {
      const feature = makeLogicalFeature({ rolloutState: '100%' });
      const item = new FeatureTreeItem(feature);
      assert.ok(item.iconPath instanceof vscode.ThemeIcon);
      assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, 'pass-filled');
    });
  });
});
