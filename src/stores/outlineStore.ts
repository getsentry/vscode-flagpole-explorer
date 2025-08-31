import * as vscode from 'vscode';
import {
  LogicalCondition,
  LogicalFeature,
  LogicalSegment,
  LogicalValue,
  symbolToLogicalFeature,
} from '../transform/transformers';

type SymbolMap = undefined | {
  range: vscode.Range,
  selectionRange: vscode.Range;
  allFeatures: LogicalFeature[];
  allSegments: LogicalSegment[];
  allConditions: LogicalCondition[];

  allOwners: Record<string, LogicalValue>;
  allRollouts: Record<string, LogicalValue>;
  allEnabled: Record<string, LogicalValue>;
  allCreatedAt: Record<string, LogicalValue>;
};

export type Outline = {
  uri: vscode.Uri,
  symbols: vscode.DocumentSymbol[],
  map: SymbolMap,
};

export default class OutlineStore extends vscode.EventEmitter<Outline> {
  private _uris: Map<string, vscode.Uri> = new Map();
  private _outlineCache: WeakMap<vscode.Uri, Outline> = new WeakMap();

  protected static documentSymbolsToMap(uri: vscode.Uri, symbols: vscode.DocumentSymbol[]): SymbolMap {
    const optionSymbol = symbols.find(symbol => symbol.name === 'options');
    if (!optionSymbol) {
      return undefined;
    }

    const allFeatures: LogicalFeature[] = [];
    const allSegments: LogicalSegment[] = [];
    const allConditions: LogicalCondition[] = [];

    const allOwners: Record<string, LogicalValue> = {};
    const allRollouts: Record<string, LogicalValue> = {};
    const allEnabled: Record<string, LogicalValue> = {};
    const allCreatedAt: Record<string, LogicalValue> = {};

    const optionParent = {...optionSymbol, uri, parent: undefined};

    for (const symbol of optionParent.children) {
      const feature = symbolToLogicalFeature(uri, symbol);

      allFeatures.push(feature);

      allOwners[feature.owner] = (allOwners[feature.owner] ?? new LogicalValue(uri, feature.owner)).addFeature(feature);
      allRollouts[feature.rolloutState] = (allRollouts[feature.rolloutState] ?? new LogicalValue(uri, feature.rolloutState)).addFeature(feature);
      allEnabled[String(feature.enabled)] = (allEnabled[String(feature.enabled)] ?? new LogicalValue(uri, String(feature.enabled))).addFeature(feature);
      allCreatedAt[feature.created_at] = (allCreatedAt[feature.created_at] ?? new LogicalValue(uri, feature.created_at)).addFeature(feature);

      for (const segment of feature.segments) {
        allSegments.push(segment);

        for (const condition of segment.conditions) {
          allConditions.push(condition);
        }
      }
    }

    return {
      range: optionSymbol.range,
      selectionRange: optionSymbol.selectionRange,
      allFeatures,
      allSegments,
      allConditions,
      allOwners,
      allRollouts,
      allEnabled,
      allCreatedAt,
    };
  }

  /**
   * Fire off an update to this Uri
   * 
   * Replaces what's in the cache with a new Outline instance
   */
  public async fire({uri}: Pick<Outline, 'uri'>): Promise<void> {
    this.forgetOutline(uri);
    const outline = await this.getOutline(uri);
    if (outline) {
      super.fire(outline);
    }
  }

  public knownUris(): vscode.Uri[] {
    return Array.from(this._uris.values());
  }

  /**
   * Gets an existing cached Outline
   */
  public async getOutline(uri: vscode.Uri): Promise<undefined | Outline> {
    if (this._outlineCache.has(uri)) {
      return this._outlineCache.get(uri);
    }

    const symbols = await getSymbols(uri);
    if (!symbols) {
      return undefined;
    }
    const map = OutlineStore.documentSymbolsToMap(uri, symbols);

    const outline: Outline = {uri, symbols, map};
    this._uris.set(uri.fsPath, uri);
    this._outlineCache.set(uri, outline);

    return outline;
  }

  /**
   * Drops an Outline from the cache
   */
  public forgetOutline(uri: vscode.Uri): void {
    if (this._outlineCache.has(uri)) {
      this._uris.delete(uri.fsPath);
      this._outlineCache.delete(uri);
    }
  }
}

function getSymbols(uri: vscode.Uri, timeout: number = 0): Promise<undefined | vscode.DocumentSymbol[]> {
  if (timeout > 5_000) {
    return Promise.resolve(undefined);
  }
  return new Promise(resolve => {
    setTimeout(() => {
      vscode.commands.executeCommand<undefined | vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        uri
      ).then((symbols) => resolve(symbols ? symbols : getSymbols(uri, timeout + 1_000)));
    }, timeout);
  });
}
