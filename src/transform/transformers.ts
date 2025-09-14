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

  const hasExtraSegments = (rolloutState === '100%') ?(segments.at(-1)?.conditions.length ?? 0) > 0 : false;

  return {
    symbol,
    uri,
    name: symbol.name,
    created_at: createdAt?.detail ?? '',
    enabled: enabled?.detail !== 'false', // default to true if omitted
    owner: owner?.detail ?? '',
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

  const rolloutState = (function() {
    if (rollout?.detail === '0') {
      return '0%';
    }
    // If `rollout` is not specified it's defaulted to 100
    // Or if there are no conditions, it's also out to 100
    if ([undefined, '100'].includes(rollout?.detail) && conditions?.length === 0) {
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
    value: value?.detail || ['...'],
    // TODO: we could go and read all the values in the array, but it'll be a bit
    // slower, and there are often a lot of values that makes things scroll a lot
    // value: (value?.detail || value?.children.map(child => ...)) ?? '',
  };
}
