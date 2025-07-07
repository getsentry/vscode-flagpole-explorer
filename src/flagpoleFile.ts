import * as vscode from 'vscode';
import { parseYaml } from './utils/readYamlFile';
import { Feature, FeatureName, RolloutState, Segment } from './types';
import { appendToMap } from './utils/appendToMap';
import sortMapByKeys from './utils/sortMapByKeys';
import yaml from 'yaml';

type FlagpoleFileContent = {options: Record<FeatureName, Feature['definition']>};
export default class FlagpoleFile {
  public static factory(
    uri: vscode.Uri,
    rawFle: string
  ) {
    // TODO: Should we assume the file is valid, conforming to the schema?

    return new FlagpoleFile(uri, rawFle);
  }

  public ast: yaml.Document.Parsed;
  public js: FlagpoleFileContent;

  // Every feature, grouped by the created_at value.
  public featuresByCreatedAt: Map<string, Set<Feature>> = new Map();

  // Every feature, grouped by the enabled value.
  public featuresByEnabled: Map<boolean, Set<Feature>> = new Map();

  // Every feature, grouped by the name value. Quick way to lookup a feature by its name.
  public featuresByName: Map<FeatureName, Set<Feature>> = new Map();

  // Every feature, grouped by the owner value.
  public featuresByOwner: Map<string, Set<Feature>> = new Map();

  public featuresByRollout: Map<RolloutState, Set<Feature>> = new Map([
    ['0%', new Set()],
    ['partial', new Set()],
    ['100%', new Set()]
  ]);
  
  // Every segment, with it's current rollout percentage included.
  public allSegmentsByName: Map<string, Set<Segment>> = new Map();

  // Unique segment definitions, ignoring `rollout`, by name.
  public uniqueSegmentsByName: Map<string, Set<Segment>> = new Map();

  public constructor(
    public uri: vscode.Uri,
    rawFle: string,
  ) {
    this.ast = parseYaml(rawFle);
    this.js = this.ast.toJS() as FlagpoleFileContent;

    this.prepareTreeMaps(this.js.options);
  }

  private prepareTreeMaps(options: FlagpoleFileContent['options']): void {
    const segmentFingerprintsByName: Map<string, Set<string>> = new Map();
    for (const [name, definition] of Object.entries(options)) {
      const feature: Feature = {name: name as FeatureName, definition, rollout: undefined};
      appendToMap(this.featuresByCreatedAt, definition.created_at, feature);
      appendToMap(this.featuresByEnabled, definition.enabled, feature);
      appendToMap(this.featuresByName, name, feature);
      appendToMap(this.featuresByOwner, definition.owner, feature);

      const segmentRollouts: RolloutState[] = [];
      for (const segment of definition.segments) {
        appendToMap(this.allSegmentsByName, segment.name, segment);

        const segmentDefinition: Segment = {name: segment.name, conditions: segment.conditions};
        const fingerprint = JSON.stringify(segmentDefinition);
        appendToMap(segmentFingerprintsByName, segment.name, fingerprint);

        const segmentRollout = getSegmentRollout(segment);
        segmentRollouts.push(segmentRollout);
      };

      feature.rollout = segmentRollouts.reduce((prev, rollout) => {
        if (prev === undefined || rollout === '100%') {
          return rollout;
        }
        if ([false, 'partial'].includes(prev) && rollout === 'partial') {
          return 'partial';
        }
        return prev;
      }, undefined);
      appendToMap(this.featuresByRollout, feature.rollout, feature);
    };

    for (const [name, fingerprints] of segmentFingerprintsByName.entries()) {
      fingerprints.forEach((fingerprint: string) => {
        appendToMap(this.uniqueSegmentsByName, name, JSON.parse(fingerprint));
      });
    }

    this.featuresByCreatedAt = sortMapByKeys(this.featuresByCreatedAt);
    this.featuresByEnabled = sortMapByKeys(this.featuresByEnabled);
    this.featuresByName = sortMapByKeys(this.featuresByName);
    this.featuresByOwner = sortMapByKeys(this.featuresByOwner);
    this.allSegmentsByName = sortMapByKeys(this.allSegmentsByName);
    this.uniqueSegmentsByName = sortMapByKeys(this.uniqueSegmentsByName);
  }

  public async findPosition(feature: Feature): Promise<vscode.Position | undefined> {
    const contents = this.ast.contents;
    if (!contents || !('items' in contents)) {
      return undefined;
    }
    const optionsMap = contents.items.filter((item) => 'key' in item && 'value' in item.key && item.key.value === 'options').at(0);
    // @ts-expect-error
    const optionsValue = optionsMap?.value.items;
    // @ts-expect-error
    const found = optionsValue.filter(item => item.key.value === feature.name).at(0);

    const document = await vscode.workspace.openTextDocument(this.uri);
    return document.positionAt(found.srcToken.key.offset);
  }

  public nearestFeatureFrom(cursorOffset: number): Feature | undefined {
    const contents = this.ast.contents;
    if (!contents || !('items' in contents)) {
      return undefined;
    }
    
    const optionsMap = contents.items.filter((item) => 'key' in item && 'value' in item.key && item.key.value === 'options').at(0);
    // @ts-expect-error
    const optionsValue = optionsMap?.value.items;

    let nearestOption = undefined;
    for (const value of optionsValue) {
      const cursorIsAfterThisFeature = value.srcToken.key.offset <= cursorOffset;
      const thisFeatureIsEarlierThanNearestFeature = nearestOption
        ? value.srcToken.key.offset > nearestOption.srcToken.key.offset
        : true;

      if (cursorIsAfterThisFeature && thisFeatureIsEarlierThanNearestFeature) {
        nearestOption = value;
      }
    }

    if (nearestOption) {
      return Array.from(this.featuresByName.get(nearestOption.key.value) ?? []).at(0);
    }
    return undefined;
  }
}

function getSegmentRollout(segment: Segment): RolloutState {
  if (segment.rollout === 0) {
    return '0%';
  }
  // If `rollout` is not specified, it's defaulted to 100
  if ([undefined, 100].includes(segment.rollout) && segment.conditions.length === 0) {
    return '100%';
  }
  return 'partial' as const;
}
