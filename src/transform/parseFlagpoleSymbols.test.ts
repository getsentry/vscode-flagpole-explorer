import * as assert from '../test-utils/assert';
import * as vscode from 'vscode';
import parseFlagpoleSymbols from './parseFlagpoleSymbols';
import { symbolToLogicalFeature } from './transformers';

async function parse(content: string): Promise<vscode.DocumentSymbol[]> {
  const document = await vscode.workspace.openTextDocument({ content, language: 'yaml' });
  return parseFlagpoleSymbols(document);
}

function findChild(symbols: vscode.DocumentSymbol[], name: string): vscode.DocumentSymbol | undefined {
  return symbols.find(symbol => symbol.name === name);
}

async function firstFeature(content: string) {
  const symbols = await parse(content);
  const options = findChild(symbols, 'options');
  assert.ok(options, 'expected an options symbol');
  const featureSymbol = options.children[0];
  assert.ok(featureSymbol, 'expected at least one feature');
  return symbolToLogicalFeature(vscode.Uri.parse('file:///test/flagpole.yaml'), featureSymbol);
}

suite('parseFlagpoleSymbols', () => {
  test('segment with rollout 100 and a condition is partial', async () => {
    const feature = await firstFeature(`options:
  feature.organizations:sentry-apps-claude-routine-webhooks:
    created_at: "2026-07-13"
    enabled: true
    owner:
      team: issue_detection
    segments:
      - name: Sentry
        rollout: 100
        conditions:
          - operator: in
            property: organization_slug
            value:
              - sentry
              - charlie-test
`);
    assert.strictEqual(feature.name, 'feature.organizations:sentry-apps-claude-routine-webhooks');
    assert.strictEqual(feature.created_at, '2026-07-13');
    assert.strictEqual(feature.enabled, true);
    assert.strictEqual(feature.owner, 'issue_detection');
    assert.strictEqual(feature.rolloutState, 'partial');
    assert.strictEqual(feature.segments.length, 1);
    assert.strictEqual(feature.segments[0].rollout, 100);
    assert.strictEqual(feature.segments[0].hasConditions, true);
    assert.strictEqual(feature.segments[0].conditions.length, 1);
    const condition = feature.segments[0].conditions[0];
    assert.strictEqual(condition.operator, 'in');
    assert.strictEqual(condition.property, 'organization_slug');
    assert.deepStrictEqual(condition.value, ['sentry', 'charlie-test']);
  });

  test('segment with rollout 100 and empty conditions is 100%', async () => {
    const feature = await firstFeature(`options:
  feature.organizations:ga:
    created_at: "2025-01-01"
    enabled: true
    owner: team-x
    segments:
      - name: GA
        rollout: 100
        conditions: []
`);
    assert.strictEqual(feature.rolloutState, '100%');
    assert.strictEqual(feature.segments[0].hasConditions, false);
  });

  test('segment with omitted rollout and no conditions is 100%', async () => {
    const feature = await firstFeature(`options:
  feature.organizations:ga:
    created_at: "2025-01-01"
    enabled: true
    owner: team-x
    segments:
      - name: GA
        conditions: []
`);
    assert.strictEqual(feature.rolloutState, '100%');
    assert.strictEqual(feature.segments[0].rollout, 100);
  });

  test('segment with rollout 0 is 0%', async () => {
    const feature = await firstFeature(`options:
  feature.organizations:off:
    created_at: "2025-01-01"
    enabled: true
    owner: team-x
    segments:
      - name: dev
        rollout: 0
`);
    assert.strictEqual(feature.rolloutState, '0%');
  });

  test('100% wins over partial, and a conditioned last segment is an extra segment', async () => {
    const feature = await firstFeature(`options:
  feature.organizations:mixed:
    created_at: "2025-01-01"
    enabled: true
    owner: team-x
    segments:
      - name: GA
        rollout: 100
        conditions: []
      - name: LA
        rollout: 100
        conditions:
          - operator: in
            property: organization_slug
            value:
              - sentry
`);
    assert.strictEqual(feature.rolloutState, '100%');
    assert.strictEqual(feature.hasExtraSegments, true);
  });

  test('partial wins when no segment is fully rolled out', async () => {
    const feature = await firstFeature(`options:
  feature.organizations:multi:
    created_at: "2025-01-01"
    enabled: true
    owner: team-x
    segments:
      - name: LA
        rollout: 100
        conditions:
          - operator: in
            property: organization_slug
            value:
              - sentry
      - name: EA
        rollout: 0
        conditions: []
`);
    assert.strictEqual(feature.rolloutState, 'partial');
  });

  test('owner as a team map and as a scalar shorthand both resolve', async () => {
    const symbols = await parse(`options:
  feature.organizations:team-map:
    created_at: "2025-01-01"
    owner:
      team: issue_detection
  feature.organizations:team-scalar:
    created_at: "2025-01-01"
    owner: alerts-notifications
`);
    const options = findChild(symbols, 'options');
    assert.ok(options);
    const uri = vscode.Uri.parse('file:///test/flagpole.yaml');
    const mapFeature = symbolToLogicalFeature(uri, options.children[0]);
    const scalarFeature = symbolToLogicalFeature(uri, options.children[1]);
    assert.strictEqual(mapFeature.owner, 'issue_detection');
    assert.strictEqual(scalarFeature.owner, 'alerts-notifications');
  });

  test('enabled: false is detected', async () => {
    const feature = await firstFeature(`options:
  feature.organizations:disabled:
    created_at: "2026-02-23"
    enabled: false
    owner: team-x
    segments:
      - name: LA
        rollout: 100
        conditions:
          - operator: in
            property: organization_slug
            value:
              - sentry
`);
    assert.strictEqual(feature.enabled, false);
  });

  test('symbol ranges point at the source location', async () => {
    const content = `options:
  feature.organizations:first:
    created_at: "2025-01-01"
    owner: team-x
  feature.organizations:second:
    created_at: "2025-01-02"
    owner: team-y
`;
    const symbols = await parse(content);
    const options = findChild(symbols, 'options');
    assert.ok(options);
    const second = options.children[1];
    assert.strictEqual(second.name, 'feature.organizations:second');
    // The `feature.organizations:second` key is on the 5th line (0-indexed 4).
    assert.strictEqual(second.selectionRange.start.line, 4);
    assert.strictEqual(second.selectionRange.start.character, 2);
  });

  test('returns an empty tree for an empty document', async () => {
    const symbols = await parse('');
    assert.deepStrictEqual(symbols, []);
  });

  test('condition value sequence reports having items via detail', async () => {
    const symbols = await parse(`options:
  feature.organizations:cond:
    segments:
      - name: LA
        rollout: 100
        conditions:
          - operator: in
            property: organization_slug
            value:
              - sentry
`);
    const options = findChild(symbols, 'options');
    const feature = findChild(options!.children, 'feature.organizations:cond');
    const segments = findChild(feature!.children, 'segments');
    const conditions = findChild(segments!.children[0].children, 'conditions');
    assert.ok(conditions);
    assert.strictEqual(conditions.detail as unknown, undefined);
    assert.strictEqual(conditions.children.length, 1);
  });

  test('reads a scalar condition value', async () => {
    const feature = await firstFeature(`options:
  feature.organizations:scalar-value:
    segments:
      - name: EA
        conditions:
          - operator: equals
            property: organization_is-early-adopter
            value: true
`);
    assert.deepStrictEqual(feature.segments[0].conditions[0].value, 'true');
  });

  test('resolves an aliased condition value list', async () => {
    const feature = await firstFeature(`_anchors:
  single_tenants: &_single_tenants
    - us
    - de
options:
  feature.organizations:aliased-value:
    segments:
      - name: GA
        rollout: 100
        conditions:
          - operator: not_in
            property: sentry_region
            value: *_single_tenants
`);
    assert.strictEqual(feature.rolloutState, 'partial');
    assert.deepStrictEqual(feature.segments[0].conditions[0].value, ['us', 'de']);
  });

  test('resolves an aliased segment so its conditions are seen', async () => {
    // An aliased segment whose anchor is rollout 100 *with* a condition must
    // read as partial, not as a bare 100% segment.
    const feature = await firstFeature(`_anchors:
  closed_beta: &_closed_beta
    name: Closed Beta
    rollout: 100
    conditions:
      - operator: in
        property: organization_slug
        value:
          - sentry
options:
  feature.organizations:aliased-segment:
    segments:
      - *_closed_beta
`);
    assert.strictEqual(feature.rolloutState, 'partial');
    assert.strictEqual(feature.segments.length, 1);
    assert.strictEqual(feature.segments[0].rollout, 100);
    assert.strictEqual(feature.segments[0].hasConditions, true);
    assert.deepStrictEqual(feature.segments[0].conditions[0].value, ['sentry']);
  });
});
