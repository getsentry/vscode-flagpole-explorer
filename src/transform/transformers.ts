import * as vscode from 'vscode';
import { Condition, Feature, FeatureName, RolloutState } from '../types';

export class LogicalValue {
  public children: LogicalFeature[] = [];

  constructor(
    public uri: vscode.Uri,
    public value: string,
  ) {}
  
  addFeature(feature: LogicalFeature): LogicalValue {
    this.children.push(feature);
    return this;
  }
};

export type LogicalFeature = {
  symbol: vscode.DocumentSymbol,
  uri: vscode.Uri;
  name: string;
  created_at: string;
  enabled: boolean;
  owner: string;
  segmentsSymbol: vscode.DocumentSymbol | undefined,
  segments: LogicalSegment[];
  rolloutState: RolloutState;
  hasExtraSegments: boolean;
};

export type LogicalSegment = {
  symbol: vscode.DocumentSymbol,
  uri: vscode.Uri;
  name: string;
  rollout: number;
  conditionsSymbol: vscode.DocumentSymbol | undefined,
  conditions: LogicalCondition[];
  hasConditions: boolean;
  rolloutState: RolloutState;
};

export type LogicalCondition = {
  symbol: vscode.DocumentSymbol,
  parent: vscode.DocumentSymbol,  
  uri: vscode.Uri;
  property: string;
  operator: string;
  value: string | string[];
};

export function logicalFeatureToFeature(logicalFeature: LogicalFeature): Feature {
  return {
    name: logicalFeature.name as FeatureName,
    definition: {
      created_at: logicalFeature.created_at,
      enabled: logicalFeature.enabled,
      owner: logicalFeature.owner,
      segments: logicalFeature.segments.map(segment => ({
        name: segment.name,
        rollout: segment.rollout,
        conditions: segment.conditions.map(condition => ({
          property: condition.property,
          operator: condition.operator,
          value: condition.value,
        } as Condition)),
      })),
    },
    rollout: logicalFeature.rolloutState,
  };
}

export function symbolToLogicalFeature(uri: vscode.Uri, symbol: vscode.DocumentSymbol): LogicalFeature {
  const createdAt = symbol.children.find(child => child.name === 'created_at');
  const enabled = symbol.children.find(child => child.name === 'enabled');
  const owner = symbol.children.find(child => child.name === 'owner');
  const segmentsSymbol = symbol.children.find(child => child.name === 'segments');
  const segments = segmentsSymbol?.children.map(symbol => symbolToLogicalSegment(uri, symbol)) ?? [];

  const rolloutState = segments.map(segments => segments.rolloutState).reduce((prev, rollout) => {
    if (prev === '100%' || rollout === '100%') {
      return '100%';
    }
    if (rollout === 'partial') {
      return 'partial';
    }
    return prev;
  }, '0%' as RolloutState);

  const hasExtraSegments = (rolloutState === '100%') ? (segments.at(-1)?.hasConditions ?? false) : false;

  let ownerValue = owner?.detail ?? '';
  if (!ownerValue && owner?.children?.length) {
    const email = owner.children.find(c => c.name === 'email');
    const team = owner.children.find(c => c.name === 'team');
    ownerValue = email?.detail || team?.detail || '';
  }

  return {
    symbol,
    uri,
    name: symbol.name,
    created_at: createdAt?.detail ?? '',
    enabled: enabled?.detail !== 'false', // default to true if omitted
    owner: ownerValue,
    segmentsSymbol,
    segments,
    rolloutState: rolloutState ?? '0%', // defaults to 0% of there are no segments
    hasExtraSegments,
  };
}

export function symbolToLogicalSegment(uri: vscode.Uri, symbol: vscode.DocumentSymbol): LogicalSegment {
  const name = symbol.children.find(child => child.name === 'name');
  const rollout = symbol.children.find(child => child.name === 'rollout');
  const conditionsSymbol = symbol.children.find(child => child.name === 'conditions');
  const conditions = conditionsSymbol?.children.map(symbol => symbolToLogicalCondition(uri, conditionsSymbol, symbol)) ?? [];

  // The YAML language server truncates the symbol tree once
  // `yaml.maxItemsComputed` is reached, dropping the `conditions` array items
  // on large files even though the `conditions` key itself is present. Its
  // `detail` still reflects the real array: `'[]'` for a genuinely empty
  // array, `undefined` when it has items. Trust `detail`, not `children`,
  // which may have been truncated to empty.
  const hasConditions = conditionsSymbol !== undefined && conditionsSymbol.detail !== '[]';

  const rolloutState = (function() {
    if (rollout?.detail === '0') {
      return '0%';
    }
    // If `rollout` is not specified it's defaulted to 100
    // Or if there are no conditions, it's also out to 100
    if ([undefined, '100'].includes(rollout?.detail) && !hasConditions) {
      return '100%';
    }
    return 'partial' as const;
  })();

  return {
    symbol,
    uri,
    name: name?.detail ?? '',
    rollout: Number(rollout?.detail ?? 100), // default to 100 if omitted
    conditionsSymbol,
    conditions,
    hasConditions,
    rolloutState,
  };
}

export function symbolToLogicalCondition(
  uri: vscode.Uri,
  parent: vscode.DocumentSymbol,
  symbol: vscode.DocumentSymbol,
): LogicalCondition {
  const operator = symbol.children.find(child => child.name === 'operator');
  const property = symbol.children.find(child => child.name === 'property');
  const value = symbol.children.find(child => child.name === 'value');
  return {
    symbol,
    parent,
    uri,
    operator: operator?.detail ?? '',
    property: property?.detail ?? '',
    value: conditionValue(value),
  };
}

/**
 * A condition's `value` is either a scalar (its `detail`) or a list, whose items
 * arrive as child symbols each carrying their scalar `detail`. An empty or
 * missing value falls back to `['...']` so the UI still renders a placeholder.
 */
function conditionValue(value: vscode.DocumentSymbol | undefined): string | string[] {
  if (value?.detail) {
    return value.detail;
  }
  const items = value?.children.map(child => child.detail).filter(detail => detail !== undefined) ?? [];
  return items.length ? items : ['...'];
}
