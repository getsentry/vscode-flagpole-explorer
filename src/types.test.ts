import * as assert from './test-utils/assert';
import {
  FEATURE_NAME_PATTERN,
  FEATURE_NAME_LINE,
  PROPERTIES,
  OPERATORS,
} from './types';

suite('types', () => {
  suite('FEATURE_NAME_PATTERN', () => {
    test('matches organization feature names', () => {
      assert.ok(FEATURE_NAME_PATTERN.test('feature.organizations:my-flag'));
      assert.ok(FEATURE_NAME_PATTERN.test('feature.organizations:workflow-engine-ui'));
      assert.ok(FEATURE_NAME_PATTERN.test('feature.organizations:issue-performance-n-plus-one-api-calls-experimental-visible'));
    });

    test('matches project feature names', () => {
      assert.ok(FEATURE_NAME_PATTERN.test('feature.projects:transaction-name-clustering-disabled'));
      assert.ok(FEATURE_NAME_PATTERN.test('feature.projects:my-project-flag'));
    });

    test('matches names with dots and underscores', () => {
      assert.ok(FEATURE_NAME_PATTERN.test('feature.organizations:some_flag'));
      assert.ok(FEATURE_NAME_PATTERN.test('feature.organizations:some.flag'));
    });

    test('matches names with numbers', () => {
      assert.ok(FEATURE_NAME_PATTERN.test('feature.organizations:inbound-filters-v2'));
      assert.ok(FEATURE_NAME_PATTERN.test('feature.organizations:am3-tier'));
    });

    test('rejects names without feature prefix', () => {
      assert.ok(!FEATURE_NAME_PATTERN.test('organizations:my-flag'));
      assert.ok(!FEATURE_NAME_PATTERN.test('my-flag'));
    });

    test('rejects names without scope', () => {
      assert.ok(!FEATURE_NAME_PATTERN.test('feature:my-flag'));
      assert.ok(!FEATURE_NAME_PATTERN.test('feature.my-flag'));
    });

    test('rejects unknown scopes', () => {
      assert.ok(!FEATURE_NAME_PATTERN.test('feature.users:my-flag'));
      assert.ok(!FEATURE_NAME_PATTERN.test('feature.teams:my-flag'));
    });

    test('rejects uppercase characters', () => {
      assert.ok(!FEATURE_NAME_PATTERN.test('feature.organizations:MyFlag'));
      assert.ok(!FEATURE_NAME_PATTERN.test('feature.organizations:MY-FLAG'));
    });

    test('rejects empty flag name after colon', () => {
      assert.ok(!FEATURE_NAME_PATTERN.test('feature.organizations:'));
    });

    test('rejects names with spaces', () => {
      assert.ok(!FEATURE_NAME_PATTERN.test('feature.organizations:my flag'));
    });
  });

  suite('FEATURE_NAME_LINE', () => {
    test('matches unquoted YAML key lines', () => {
      assert.ok(FEATURE_NAME_LINE.test('  feature.organizations:workflow-engine-ui:'));
      assert.ok(FEATURE_NAME_LINE.test('  feature.projects:transaction-name-clustering-disabled:'));
    });

    test('matches quoted YAML key lines', () => {
      assert.ok(FEATURE_NAME_LINE.test('  "feature.organizations:continuous-profiling":'));
      assert.ok(FEATURE_NAME_LINE.test('  "feature.organizations:inbound-filters-v2":'));
    });

    test('matches with various leading whitespace', () => {
      assert.ok(FEATURE_NAME_LINE.test('feature.organizations:my-flag:'));
      assert.ok(FEATURE_NAME_LINE.test('    feature.organizations:my-flag:'));
      assert.ok(FEATURE_NAME_LINE.test('\tfeature.organizations:my-flag:'));
    });

    test('rejects lines that are not feature definitions', () => {
      assert.ok(!FEATURE_NAME_LINE.test('  created_at: "2025-01-01"'));
      assert.ok(!FEATURE_NAME_LINE.test('  enabled: true'));
      assert.ok(!FEATURE_NAME_LINE.test('  owner:'));
    });

    test('rejects feature references in values', () => {
      assert.ok(!FEATURE_NAME_LINE.test('    value: feature.organizations:some-flag'));
    });
  });

  suite('PROPERTIES', () => {
    test('contains all expected property names', () => {
      const names = Object.keys(PROPERTIES);
      assert.ok(names.includes('organization_slug'));
      assert.ok(names.includes('organization_id'));
      assert.ok(names.includes('project_id'));
      assert.ok(names.includes('user_email'));
      assert.ok(names.includes('subscription_plan-tier'));
      assert.ok(names.includes('sentry_region'));
    });

    test('property types are valid', () => {
      const validTypes = ['number', 'string', 'boolean'];
      for (const [name, type] of Object.entries(PROPERTIES)) {
        assert.ok(validTypes.includes(type), `${name} has invalid type: ${type}`);
      }
    });

    test('project_id is number type', () => {
      assert.strictEqual(PROPERTIES['project_id'], 'number');
    });

    test('organization_slug is string type', () => {
      assert.strictEqual(PROPERTIES['organization_slug'], 'string');
    });

    test('boolean properties are typed correctly', () => {
      assert.strictEqual(PROPERTIES['organization_is-early-adopter'], 'boolean');
      assert.strictEqual(PROPERTIES['user_is-staff'], 'boolean');
      assert.strictEqual(PROPERTIES['user_is-superuser'], 'boolean');
      assert.strictEqual(PROPERTIES['subscription_is-free'], 'boolean');
      assert.strictEqual(PROPERTIES['sentry_singletenant'], 'boolean');
    });
  });

  suite('OPERATORS', () => {
    test('contains all eight operators', () => {
      assert.strictEqual(OPERATORS.length, 8);
    });

    test('includes each expected operator', () => {
      assert.ok(OPERATORS.includes('in'));
      assert.ok(OPERATORS.includes('not_in'));
      assert.ok(OPERATORS.includes('contains'));
      assert.ok(OPERATORS.includes('not_contains'));
      assert.ok(OPERATORS.includes('equals'));
      assert.ok(OPERATORS.includes('not_equals'));
      assert.ok(OPERATORS.includes('matches'));
      assert.ok(OPERATORS.includes('not_matches'));
    });
  });
});
