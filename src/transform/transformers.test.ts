import * as assert from '../test-utils/assert';
import * as vscode from 'vscode';
import {
  LogicalValue,
  LogicalFeature,
  LogicalSegment,
  logicalFeatureToFeature,
  symbolToLogicalFeature,
  symbolToLogicalSegment,
  symbolToLogicalCondition,
} from './transformers';

function makeSymbol(name: string, detail: string, children: vscode.DocumentSymbol[] = []): vscode.DocumentSymbol {
  const range = new vscode.Range(0, 0, 0, 0);
  const sym = new vscode.DocumentSymbol(name, detail, vscode.SymbolKind.Property, range, range);
  sym.children = children;
  return sym;
}

// Mirrors the YAML language server's `getDetail`: an array symbol's `detail`
// is `'[]'` when empty and `undefined` when it has items. The item symbols are
// also dropped once `yaml.maxItemsComputed` is exhausted, so `detail` — not
// `children` — is the reliable signal for "has conditions".
function makeConditions(children: vscode.DocumentSymbol[] = []): vscode.DocumentSymbol {
  const detail = children.length ? undefined : '[]';
  const range = new vscode.Range(0, 0, 0, 0);
  const sym = new vscode.DocumentSymbol('conditions', detail as unknown as string, vscode.SymbolKind.Array, range, range);
  sym.children = children;
  return sym;
}

const uri = vscode.Uri.parse('file:///test/flagpole.yaml');

suite('transformers', () => {
  suite('LogicalValue', () => {
    test('constructor stores uri and value', () => {
      const lv = new LogicalValue(uri, 'flagpole');
      assert.strictEqual(lv.uri, uri);
      assert.strictEqual(lv.value, 'flagpole');
      assert.deepStrictEqual(lv.children, []);
    });

    test('addFeature appends and returns self', () => {
      const lv = new LogicalValue(uri, 'flagpole');
      const feature = {} as LogicalFeature;
      const result = lv.addFeature(feature);
      assert.strictEqual(result, lv);
      assert.strictEqual(lv.children.length, 1);
      assert.strictEqual(lv.children[0], feature);
    });
  });

  suite('symbolToLogicalCondition', () => {
    test('extracts operator, property, and value detail', () => {
      const parent = makeConditions([]);
      const conditionSymbol = makeSymbol('0', '', [
        makeSymbol('operator', 'in'),
        makeSymbol('property', 'organization_slug'),
        makeSymbol('value', 'sentry'),
      ]);
      const result = symbolToLogicalCondition(uri, parent, conditionSymbol);
      assert.strictEqual(result.operator, 'in');
      assert.strictEqual(result.property, 'organization_slug');
      assert.strictEqual(result.value, 'sentry');
      assert.strictEqual(result.uri, uri);
      assert.strictEqual(result.symbol, conditionSymbol);
      assert.strictEqual(result.parent, parent);
    });

    test('defaults to empty strings when children are missing', () => {
      const parent = makeConditions([]);
      const conditionSymbol = makeSymbol('0', '', []);
      const result = symbolToLogicalCondition(uri, parent, conditionSymbol);
      assert.strictEqual(result.operator, '');
      assert.strictEqual(result.property, '');
      assert.deepStrictEqual(result.value, ['...']);
    });

    test('falls back to ["..."] when value detail is empty string', () => {
      const parent = makeConditions([]);
      const conditionSymbol = makeSymbol('0', '', [
        makeSymbol('operator', 'in'),
        makeSymbol('property', 'organization_slug'),
        makeSymbol('value', ''),
      ]);
      const result = symbolToLogicalCondition(uri, parent, conditionSymbol);
      assert.deepStrictEqual(result.value, ['...']);
    });

    test('reads a list value from its child items', () => {
      const parent = makeConditions([]);
      const value = makeSymbol('value', '', [
        makeSymbol('0', 'sentry'),
        makeSymbol('1', 'charlie-test'),
      ]);
      const conditionSymbol = makeSymbol('0', '', [
        makeSymbol('operator', 'in'),
        makeSymbol('property', 'organization_slug'),
        value,
      ]);
      const result = symbolToLogicalCondition(uri, parent, conditionSymbol);
      assert.deepStrictEqual(result.value, ['sentry', 'charlie-test']);
    });
  });

  suite('symbolToLogicalSegment', () => {
    test('segment with rollout 100 and conditions is partial', () => {
      const symbol = makeSymbol('0', '', [
        makeSymbol('name', 'is_sentry'),
        makeSymbol('rollout', '100'),
        makeConditions([
          makeSymbol('0', '', [
            makeSymbol('operator', 'in'),
            makeSymbol('property', 'organization_slug'),
            makeSymbol('value', 'sentry'),
          ]),
        ]),
      ]);
      const result = symbolToLogicalSegment(uri, symbol);
      assert.strictEqual(result.name, 'is_sentry');
      assert.strictEqual(result.rollout, 100);
      assert.strictEqual(result.rolloutState, 'partial');
      assert.strictEqual(result.conditions.length, 1);
    });

    test('segment with rollout 100 and no conditions is 100%', () => {
      const symbol = makeSymbol('0', '', [
        makeSymbol('name', 'GA'),
        makeSymbol('rollout', '100'),
        makeConditions([]),
      ]);
      const result = symbolToLogicalSegment(uri, symbol);
      assert.strictEqual(result.rolloutState, '100%');
      assert.strictEqual(result.rollout, 100);
    });

    test('segment with no rollout field and no conditions is 100%', () => {
      const symbol = makeSymbol('0', '', [
        makeSymbol('name', 'GA'),
        makeConditions([]),
      ]);
      const result = symbolToLogicalSegment(uri, symbol);
      assert.strictEqual(result.rolloutState, '100%');
      assert.strictEqual(result.rollout, 100);
    });

    test('segment with no rollout field and conditions is partial', () => {
      const symbol = makeSymbol('0', '', [
        makeSymbol('name', 'EA'),
        makeConditions([
          makeSymbol('0', '', [
            makeSymbol('operator', 'equals'),
            makeSymbol('property', 'organization_is-early-adopter'),
            makeSymbol('value', 'true'),
          ]),
        ]),
      ]);
      const result = symbolToLogicalSegment(uri, symbol);
      assert.strictEqual(result.rolloutState, 'partial');
      assert.strictEqual(result.rollout, 100);
    });

    test('segment with rollout 0 is 0%', () => {
      const symbol = makeSymbol('0', '', [
        makeSymbol('name', 'dev'),
        makeSymbol('rollout', '0'),
        makeConditions([
          makeSymbol('0', '', [
            makeSymbol('operator', 'in'),
            makeSymbol('property', 'organization_slug'),
            makeSymbol('value', 'sentry'),
          ]),
        ]),
      ]);
      const result = symbolToLogicalSegment(uri, symbol);
      assert.strictEqual(result.rolloutState, '0%');
      assert.strictEqual(result.rollout, 0);
    });

    test('segment with rollout 50 and conditions is partial', () => {
      const symbol = makeSymbol('0', '', [
        makeSymbol('name', 'gradual'),
        makeSymbol('rollout', '50'),
        makeConditions([
          makeSymbol('0', '', [
            makeSymbol('operator', 'in'),
            makeSymbol('property', 'subscription_plan-tier'),
            makeSymbol('value', 'am3'),
          ]),
        ]),
      ]);
      const result = symbolToLogicalSegment(uri, symbol);
      assert.strictEqual(result.rolloutState, 'partial');
      assert.strictEqual(result.rollout, 50);
    });

    test('segment with rollout 50 and no conditions is partial', () => {
      const symbol = makeSymbol('0', '', [
        makeSymbol('name', 'gradual'),
        makeSymbol('rollout', '50'),
        makeConditions([]),
      ]);
      const result = symbolToLogicalSegment(uri, symbol);
      assert.strictEqual(result.rolloutState, 'partial');
      assert.strictEqual(result.rollout, 50);
    });

    test('segment with no conditions symbol defaults to empty', () => {
      const symbol = makeSymbol('0', '', [
        makeSymbol('name', 'bare'),
        makeSymbol('rollout', '100'),
      ]);
      const result = symbolToLogicalSegment(uri, symbol);
      assert.strictEqual(result.conditions.length, 0);
      assert.strictEqual(result.conditionsSymbol, undefined);
      assert.strictEqual(result.rolloutState, '100%');
    });

    test('rollout 100 with truncated conditions (no children, detail undefined) is partial', () => {
      // Reproduces a large flagpole.yaml where the YAML language server hit
      // `yaml.maxItemsComputed` and dropped the condition items. The
      // `conditions` key is present with `detail: undefined` (non-empty array),
      // but `children` is empty.
      const conditionsSymbol = makeSymbol('conditions', undefined as unknown as string, []);
      const symbol = makeSymbol('0', '', [
        makeSymbol('name', 'LA'),
        makeSymbol('rollout', '100'),
        conditionsSymbol,
      ]);
      const result = symbolToLogicalSegment(uri, symbol);
      assert.strictEqual(result.conditions.length, 0);
      assert.strictEqual(result.hasConditions, true);
      assert.strictEqual(result.rolloutState, 'partial');
    });

    test('empty conditions (detail "[]") with rollout 100 is 100%', () => {
      const symbol = makeSymbol('0', '', [
        makeSymbol('name', 'GA'),
        makeSymbol('rollout', '100'),
        makeConditions([]),
      ]);
      const result = symbolToLogicalSegment(uri, symbol);
      assert.strictEqual(result.hasConditions, false);
      assert.strictEqual(result.rolloutState, '100%');
    });

    test('segment with no name defaults to empty string', () => {
      const symbol = makeSymbol('0', '', [
        makeSymbol('rollout', '100'),
        makeConditions([]),
      ]);
      const result = symbolToLogicalSegment(uri, symbol);
      assert.strictEqual(result.name, '');
    });

    test('preserves uri and symbol references', () => {
      const symbol = makeSymbol('0', '', [
        makeSymbol('name', 'test'),
        makeSymbol('rollout', '100'),
        makeConditions([]),
      ]);
      const result = symbolToLogicalSegment(uri, symbol);
      assert.strictEqual(result.uri, uri);
      assert.strictEqual(result.symbol, symbol);
    });
  });

  suite('symbolToLogicalFeature', () => {
    test('feature with one partial segment is partial', () => {
      const symbol = makeSymbol('feature.organizations:inbound-filters-v2', '', [
        makeSymbol('created_at', '2026-05-29'),
        makeSymbol('enabled', 'true'),
        makeSymbol('owner', 'telemetry-experience'),
        makeSymbol('segments', '', [
          makeSymbol('0', '', [
            makeSymbol('name', 'IA'),
            makeSymbol('rollout', '100'),
            makeConditions([
              makeSymbol('0', '', [
                makeSymbol('operator', 'in'),
                makeSymbol('property', 'organization_slug'),
                makeSymbol('value', 'simon-test-us'),
              ]),
            ]),
          ]),
        ]),
      ]);
      const result = symbolToLogicalFeature(uri, symbol);
      assert.strictEqual(result.name, 'feature.organizations:inbound-filters-v2');
      assert.strictEqual(result.created_at, '2026-05-29');
      assert.strictEqual(result.enabled, true);
      assert.strictEqual(result.owner, 'telemetry-experience');
      assert.strictEqual(result.rolloutState, 'partial');
      assert.strictEqual(result.segments.length, 1);
      assert.strictEqual(result.hasExtraSegments, false);
    });

    test('feature with rollout-100 segment whose conditions were truncated is partial', () => {
      // A large file where the YAML language server dropped the condition
      // items: the segment reports rollout 100 with an empty (truncated)
      // conditions list, which previously mis-read as 100%.
      const symbol = makeSymbol('feature.organizations:issue-performance-n-plus-one-db-queries-experimental-visible', '', [
        makeSymbol('created_at', '2025-05-09'),
        makeSymbol('enabled', 'true'),
        makeSymbol('owner', '', [makeSymbol('team', 'issue_detection')]),
        makeSymbol('segments', '', [
          makeSymbol('0', '', [
            makeSymbol('name', 'LA'),
            makeSymbol('rollout', '100'),
            makeSymbol('conditions', undefined as unknown as string, []),
          ]),
        ]),
      ]);
      const result = symbolToLogicalFeature(uri, symbol);
      assert.strictEqual(result.rolloutState, 'partial');
      assert.strictEqual(result.segments.length, 1);
      assert.strictEqual(result.segments[0].hasConditions, true);
      assert.strictEqual(result.hasExtraSegments, false);
    });

    test('feature with 100% segment becomes 100%', () => {
      const symbol = makeSymbol('feature.organizations:full-rollout', '', [
        makeSymbol('created_at', '2025-01-01'),
        makeSymbol('enabled', 'true'),
        makeSymbol('owner', 'team-x'),
        makeSymbol('segments', '', [
          makeSymbol('0', '', [
            makeSymbol('name', 'GA'),
            makeSymbol('rollout', '100'),
            makeConditions([]),
          ]),
        ]),
      ]);
      const result = symbolToLogicalFeature(uri, symbol);
      assert.strictEqual(result.rolloutState, '100%');
      assert.strictEqual(result.hasExtraSegments, false);
    });

    test('feature at 100% with last segment having conditions sets hasExtraSegments', () => {
      const symbol = makeSymbol('feature.organizations:extra-segments', '', [
        makeSymbol('created_at', '2025-01-01'),
        makeSymbol('enabled', 'true'),
        makeSymbol('owner', 'team-x'),
        makeSymbol('segments', '', [
          makeSymbol('0', '', [
            makeSymbol('name', 'GA'),
            makeSymbol('rollout', '100'),
            makeConditions([]),
          ]),
          makeSymbol('1', '', [
            makeSymbol('name', 'LA'),
            makeSymbol('rollout', '100'),
            makeConditions([
              makeSymbol('0', '', [
                makeSymbol('operator', 'in'),
                makeSymbol('property', 'organization_slug'),
                makeSymbol('value', 'sentry'),
              ]),
            ]),
          ]),
        ]),
      ]);
      const result = symbolToLogicalFeature(uri, symbol);
      assert.strictEqual(result.rolloutState, '100%');
      assert.strictEqual(result.hasExtraSegments, true);
    });

    test('feature with all 0% segments is 0%', () => {
      const symbol = makeSymbol('feature.organizations:disabled-flag', '', [
        makeSymbol('created_at', '2025-06-06'),
        makeSymbol('enabled', 'true'),
        makeSymbol('owner', 'issue_detection'),
        makeSymbol('segments', '', [
          makeSymbol('0', '', [
            makeSymbol('name', 'GA'),
            makeSymbol('rollout', '0'),
            makeConditions([]),
          ]),
        ]),
      ]);
      const result = symbolToLogicalFeature(uri, symbol);
      assert.strictEqual(result.rolloutState, '0%');
      assert.strictEqual(result.hasExtraSegments, false);
    });

    test('feature with no segments is 0%', () => {
      const symbol = makeSymbol('feature.organizations:no-segments', '', [
        makeSymbol('created_at', '2025-01-01'),
        makeSymbol('enabled', 'true'),
        makeSymbol('owner', 'team-x'),
      ]);
      const result = symbolToLogicalFeature(uri, symbol);
      assert.strictEqual(result.rolloutState, '0%');
      assert.strictEqual(result.segments.length, 0);
      assert.strictEqual(result.segmentsSymbol, undefined);
    });

    test('enabled defaults to true when omitted', () => {
      const symbol = makeSymbol('feature.organizations:no-enabled', '', [
        makeSymbol('created_at', '2025-01-01'),
        makeSymbol('owner', 'team-x'),
      ]);
      const result = symbolToLogicalFeature(uri, symbol);
      assert.strictEqual(result.enabled, true);
    });

    test('enabled: false is detected', () => {
      const symbol = makeSymbol('feature.organizations:disabled', '', [
        makeSymbol('created_at', '2026-02-23'),
        makeSymbol('enabled', 'false'),
        makeSymbol('owner', 'issue_detection'),
        makeSymbol('segments', '', [
          makeSymbol('0', '', [
            makeSymbol('name', 'LA'),
            makeSymbol('rollout', '100'),
            makeConditions([
              makeSymbol('0', '', [
                makeSymbol('operator', 'in'),
                makeSymbol('property', 'organization_slug'),
                makeSymbol('value', 'sentry'),
              ]),
            ]),
          ]),
        ]),
      ]);
      const result = symbolToLogicalFeature(uri, symbol);
      assert.strictEqual(result.enabled, false);
    });

    test('owner from detail string (team shorthand)', () => {
      const symbol = makeSymbol('feature.organizations:team-owner', '', [
        makeSymbol('created_at', '2025-01-01'),
        makeSymbol('owner', 'alerts-notifications'),
      ]);
      const result = symbolToLogicalFeature(uri, symbol);
      assert.strictEqual(result.owner, 'alerts-notifications');
    });

    test('owner from email child when detail is empty', () => {
      const ownerSymbol = makeSymbol('owner', '', [
        makeSymbol('email', 'shayna.chambless@sentry.io'),
        makeSymbol('team', 'issue_detection'),
      ]);
      const symbol = makeSymbol('feature.organizations:email-owner', '', [
        makeSymbol('created_at', '2025-12-11'),
        ownerSymbol,
      ]);
      const result = symbolToLogicalFeature(uri, symbol);
      assert.strictEqual(result.owner, 'shayna.chambless@sentry.io');
    });

    test('owner from team child when no email child', () => {
      const ownerSymbol = makeSymbol('owner', '', [
        makeSymbol('team', 'data-browsing'),
      ]);
      const symbol = makeSymbol('feature.organizations:team-child-owner', '', [
        makeSymbol('created_at', '2025-01-01'),
        ownerSymbol,
      ]);
      const result = symbolToLogicalFeature(uri, symbol);
      assert.strictEqual(result.owner, 'data-browsing');
    });

    test('owner defaults to empty string when missing', () => {
      const symbol = makeSymbol('feature.organizations:no-owner', '', [
        makeSymbol('created_at', '2025-01-01'),
      ]);
      const result = symbolToLogicalFeature(uri, symbol);
      assert.strictEqual(result.owner, '');
    });

    test('created_at defaults to empty string when missing', () => {
      const symbol = makeSymbol('feature.organizations:no-date', '', [
        makeSymbol('owner', 'team-x'),
      ]);
      const result = symbolToLogicalFeature(uri, symbol);
      assert.strictEqual(result.created_at, '');
    });

    test('multiple segments — partial wins if no 100%', () => {
      const symbol = makeSymbol('feature.organizations:multi-segment', '', [
        makeSymbol('created_at', '2025-01-01'),
        makeSymbol('enabled', 'true'),
        makeSymbol('owner', 'team-x'),
        makeSymbol('segments', '', [
          makeSymbol('0', '', [
            makeSymbol('name', 'LA'),
            makeSymbol('rollout', '100'),
            makeConditions([
              makeSymbol('0', '', [
                makeSymbol('operator', 'in'),
                makeSymbol('property', 'organization_slug'),
                makeSymbol('value', 'sentry'),
              ]),
            ]),
          ]),
          makeSymbol('1', '', [
            makeSymbol('name', 'EA'),
            makeSymbol('rollout', '0'),
            makeConditions([]),
          ]),
        ]),
      ]);
      const result = symbolToLogicalFeature(uri, symbol);
      assert.strictEqual(result.rolloutState, 'partial');
    });

    test('100% wins over partial in mixed segments', () => {
      const symbol = makeSymbol('feature.organizations:mixed', '', [
        makeSymbol('created_at', '2025-01-01'),
        makeSymbol('enabled', 'true'),
        makeSymbol('owner', 'team-x'),
        makeSymbol('segments', '', [
          makeSymbol('0', '', [
            makeSymbol('name', 'LA'),
            makeSymbol('rollout', '100'),
            makeConditions([
              makeSymbol('0', '', [
                makeSymbol('operator', 'in'),
                makeSymbol('property', 'organization_slug'),
                makeSymbol('value', 'sentry'),
              ]),
            ]),
          ]),
          makeSymbol('1', '', [
            makeSymbol('name', 'GA'),
            makeSymbol('rollout', '100'),
            makeConditions([]),
          ]),
        ]),
      ]);
      const result = symbolToLogicalFeature(uri, symbol);
      assert.strictEqual(result.rolloutState, '100%');
    });

    test('feature with rollout 50 and empty conditions is partial', () => {
      const ownerSymbol = makeSymbol('owner', '', [
        makeSymbol('team', 'ml-ai'),
      ]);
      const symbol = makeSymbol('feature.organizations:rollout-50-empty-conditions', '', [
        makeSymbol('created_at', '2026-06-01'),
        makeSymbol('enabled', 'true'),
        ownerSymbol,
        makeSymbol('segments', '', [
          makeSymbol('0', '', [
            makeConditions([]),
            makeSymbol('name', 'GA'),
            makeSymbol('rollout', '50'),
          ]),
        ]),
      ]);
      const result = symbolToLogicalFeature(uri, symbol);
      assert.strictEqual(result.name, 'feature.organizations:rollout-50-empty-conditions');
      assert.strictEqual(result.created_at, '2026-06-01');
      assert.strictEqual(result.enabled, true);
      assert.strictEqual(result.owner, 'ml-ai');
      assert.strictEqual(result.rolloutState, 'partial');
      assert.strictEqual(result.segments.length, 1);
      assert.strictEqual(result.segments[0].name, 'GA');
      assert.strictEqual(result.segments[0].rollout, 50);
      assert.strictEqual(result.segments[0].conditions.length, 0);
      assert.strictEqual(result.segments[0].rolloutState, 'partial');
      assert.strictEqual(result.hasExtraSegments, false);
    });

    test('preserves uri and symbol references', () => {
      const symbol = makeSymbol('feature.organizations:refs', '', [
        makeSymbol('created_at', '2025-01-01'),
        makeSymbol('owner', 'team-x'),
      ]);
      const result = symbolToLogicalFeature(uri, symbol);
      assert.strictEqual(result.uri, uri);
      assert.strictEqual(result.symbol, symbol);
    });
  });

  suite('logicalFeatureToFeature', () => {
    function makeLogicalFeature(overrides: Partial<LogicalFeature> = {}): LogicalFeature {
      const range = new vscode.Range(0, 0, 0, 0);
      return {
        symbol: new vscode.DocumentSymbol('test', '', vscode.SymbolKind.Property, range, range),
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

    function makeLogicalSegment(overrides: Partial<LogicalSegment> = {}): LogicalSegment {
      const range = new vscode.Range(0, 0, 0, 0);
      return {
        symbol: new vscode.DocumentSymbol('seg', '', vscode.SymbolKind.Property, range, range),
        uri,
        name: 'GA',
        rollout: 100,
        conditionsSymbol: undefined,
        conditions: [],
        hasConditions: false,
        rolloutState: '100%',
        ...overrides,
      };
    }

    test('converts a feature with no segments', () => {
      const logical = makeLogicalFeature();
      const feature = logicalFeatureToFeature(logical);
      assert.strictEqual(feature.name, 'feature.organizations:test');
      assert.strictEqual(feature.definition.created_at, '2025-01-01');
      assert.strictEqual(feature.definition.enabled, true);
      assert.strictEqual(feature.definition.owner, 'team-x');
      assert.deepStrictEqual(feature.definition.segments, []);
      assert.strictEqual(feature.rollout, '0%');
    });

    test('converts segments with conditions', () => {
      const range = new vscode.Range(0, 0, 0, 0);
      const condParent = new vscode.DocumentSymbol('conditions', '', vscode.SymbolKind.Property, range, range);
      const condSymbol = new vscode.DocumentSymbol('0', '', vscode.SymbolKind.Property, range, range);
      const logical = makeLogicalFeature({
        rolloutState: 'partial',
        segments: [
          makeLogicalSegment({
            name: 'IA',
            rollout: 100,
            rolloutState: 'partial',
            conditions: [
              {
                symbol: condSymbol,
                parent: condParent,
                uri,
                property: 'organization_slug',
                operator: 'in',
                value: 'sentry',
              },
            ],
          }),
        ],
      });
      const feature = logicalFeatureToFeature(logical);
      assert.strictEqual(feature.definition.segments.length, 1);
      assert.strictEqual(feature.definition.segments[0].name, 'IA');
      assert.strictEqual(feature.definition.segments[0].rollout, 100);
      assert.strictEqual(feature.definition.segments[0].conditions.length, 1);
      assert.strictEqual(feature.definition.segments[0].conditions[0].property, 'organization_slug');
      assert.strictEqual(feature.definition.segments[0].conditions[0].operator, 'in');
      assert.strictEqual(feature.definition.segments[0].conditions[0].value, 'sentry');
    });

    test('strips symbol/uri fields from output', () => {
      const logical = makeLogicalFeature({
        segments: [makeLogicalSegment()],
      });
      const feature = logicalFeatureToFeature(logical);
      const segment = feature.definition.segments[0] as Record<string, unknown>;
      assert.strictEqual(segment['symbol'], undefined);
      assert.strictEqual(segment['uri'], undefined);
      assert.strictEqual(segment['conditionsSymbol'], undefined);
    });

    test('maps rolloutState to rollout field', () => {
      const partial = logicalFeatureToFeature(makeLogicalFeature({ rolloutState: 'partial' }));
      assert.strictEqual(partial.rollout, 'partial');

      const full = logicalFeatureToFeature(makeLogicalFeature({ rolloutState: '100%' }));
      assert.strictEqual(full.rollout, '100%');

      const zero = logicalFeatureToFeature(makeLogicalFeature({ rolloutState: '0%' }));
      assert.strictEqual(zero.rollout, '0%');
    });
  });
});
