import * as assert from '../test-utils/assert';
import * as vscode from 'vscode';
import SelectedElementsStore from './selectedElementsStore';
import { LogicalFeature, LogicalSegment, LogicalCondition } from '../transform/transformers';

function makeRange(startLine: number, startChar: number, endLine: number, endChar: number): vscode.Range {
  return new vscode.Range(startLine, startChar, endLine, endChar);
}

function makeSelection(startLine: number, startChar: number, endLine: number, endChar: number): vscode.Selection {
  return new vscode.Selection(startLine, startChar, endLine, endChar);
}

function makeSymbol(name: string, range: vscode.Range): vscode.DocumentSymbol {
  return new vscode.DocumentSymbol(name, '', vscode.SymbolKind.Property, range, range);
}

const uri = vscode.Uri.parse('file:///test/flagpole.yaml');

function makeFeature(name: string, range: vscode.Range): LogicalFeature {
  return {
    symbol: makeSymbol(name, range),
    uri,
    name,
    created_at: '2025-01-01',
    enabled: true,
    owner: 'team-x',
    segmentsSymbol: undefined,
    segments: [],
    rolloutState: '0%',
    hasExtraSegments: false,
  };
}

function makeSegment(name: string, range: vscode.Range): LogicalSegment {
  return {
    symbol: makeSymbol(name, range),
    uri,
    name,
    rollout: 100,
    conditionsSymbol: undefined,
    conditions: [],
    hasConditions: false,
    rolloutState: '100%',
  };
}

function makeCondition(property: string, range: vscode.Range): LogicalCondition {
  const parentSymbol = makeSymbol('conditions', range);
  return {
    symbol: makeSymbol(property, range),
    parent: parentSymbol,
    uri,
    property,
    operator: 'in',
    value: 'sentry',
  };
}

suite('SelectedElementsStore.filterSelectedElements', () => {
  test('returns empty array when selections is undefined', () => {
    const features = [makeFeature('flag-a', makeRange(0, 0, 5, 0))];
    const result = SelectedElementsStore.filterSelectedElements(undefined, features);
    assert.deepStrictEqual(result, []);
  });

  test('returns empty array when selections is empty', () => {
    const features = [makeFeature('flag-a', makeRange(0, 0, 5, 0))];
    const result = SelectedElementsStore.filterSelectedElements([], features);
    assert.deepStrictEqual(result, []);
  });

  test('returns empty array when elements is empty', () => {
    const selections = [makeSelection(0, 0, 5, 0)];
    const result = SelectedElementsStore.filterSelectedElements(selections, []);
    assert.deepStrictEqual(result, []);
  });

  test('returns features that intersect with selection', () => {
    const featureA = makeFeature('flag-a', makeRange(0, 0, 5, 0));
    const featureB = makeFeature('flag-b', makeRange(10, 0, 15, 0));
    const featureC = makeFeature('flag-c', makeRange(20, 0, 25, 0));

    const selections = [makeSelection(3, 0, 3, 0)];
    const result = SelectedElementsStore.filterSelectedElements(selections, [featureA, featureB, featureC]);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'flag-a');
  });

  test('returns multiple features when selection spans them', () => {
    const featureA = makeFeature('flag-a', makeRange(0, 0, 5, 0));
    const featureB = makeFeature('flag-b', makeRange(5, 0, 10, 0));

    const selections = [makeSelection(0, 0, 10, 0)];
    const result = SelectedElementsStore.filterSelectedElements(selections, [featureA, featureB]);
    assert.strictEqual(result.length, 2);
  });

  test('handles multiple selections', () => {
    const featureA = makeFeature('flag-a', makeRange(0, 0, 5, 0));
    const featureB = makeFeature('flag-b', makeRange(10, 0, 15, 0));
    const featureC = makeFeature('flag-c', makeRange(20, 0, 25, 0));

    const selections = [
      makeSelection(2, 0, 2, 0),
      makeSelection(22, 0, 22, 0),
    ];
    const result = SelectedElementsStore.filterSelectedElements(selections, [featureA, featureB, featureC]);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].name, 'flag-a');
    assert.strictEqual(result[1].name, 'flag-c');
  });

  test('excludes features that do not intersect', () => {
    const featureA = makeFeature('flag-a', makeRange(0, 0, 5, 0));
    const selections = [makeSelection(10, 0, 15, 0)];
    const result = SelectedElementsStore.filterSelectedElements(selections, [featureA]);
    assert.strictEqual(result.length, 0);
  });

  test('works with segments', () => {
    const segmentA = makeSegment('LA', makeRange(5, 0, 10, 0));
    const segmentB = makeSegment('GA', makeRange(15, 0, 20, 0));

    const selections = [makeSelection(7, 0, 7, 0)];
    const result = SelectedElementsStore.filterSelectedElements(selections, [segmentA, segmentB]);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'LA');
  });

  test('works with conditions', () => {
    const condA = makeCondition('organization_slug', makeRange(6, 0, 8, 0));
    const condB = makeCondition('user_email', makeRange(12, 0, 14, 0));

    const selections = [makeSelection(13, 0, 13, 0)];
    const result = SelectedElementsStore.filterSelectedElements(selections, [condA, condB]);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].property, 'user_email');
  });

  test('cursor on boundary line is included', () => {
    const featureA = makeFeature('flag-a', makeRange(5, 0, 10, 0));
    const selections = [makeSelection(5, 0, 5, 0)];
    const result = SelectedElementsStore.filterSelectedElements(selections, [featureA]);
    assert.strictEqual(result.length, 1);
  });
});
