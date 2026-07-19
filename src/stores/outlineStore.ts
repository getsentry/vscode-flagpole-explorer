import * as vscode from 'vscode';
import { addBreadcrumb, captureMessage } from '../utils/sentry';
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

type CacheEntry = {
  outline: Outline;
  // `TextDocument.version` when the outline was computed, or undefined when
  // the document was not open in any editor at the time.
  documentVersion: undefined | number;
};

const SYMBOLS_RETRY_LIMIT_MS = 5_000;

// The YAML language server re-parses asynchronously after a document change,
// so symbols requested immediately after a change can be computed from the
// previous content. We re-request after this delay and compare; see
// scheduleVerification().
const VERIFY_DELAY_MS = 1_000;
const VERIFY_MAX_ROUNDS = 3;

export default class OutlineStore extends vscode.EventEmitter<Outline> {
  // All keys are uri.toString(): vscode.Uri instances are not canonical, and
  // keying by object identity would let the same file hold multiple,
  // disagreeing cache entries.
  private _cache: Map<string, CacheEntry> = new Map();
  private _pending: Map<string, Promise<undefined | Outline>> = new Map();
  private _generations: Map<string, number> = new Map();
  private _verifyTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  private _initialLoad: Promise<void>;
  private _resolveReady!: () => void;

  constructor() {
    super();
    this._initialLoad = new Promise(resolve => {
      this._resolveReady = resolve;
    });
  }

  /**
   * Resolves once the initial file scan has completed. Root `getChildren()`
   * calls await this so VS Code renders its native loading spinner instead of
   * a blank view while the YAML symbols are still being parsed.
   */
  public whenReady(): Promise<void> {
    return this._initialLoad;
  }

  public markReady(): void {
    this._resolveReady();
  }

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
   * Recomputes the Outline and, if this update is still the newest one for
   * the Uri when the computation finishes, replaces the cache entry and
   * notifies listeners. Overlapping calls for the same Uri are resolved by a
   * generation counter so a slow computation from older content can never
   * overwrite a newer one.
   */
  public async fire({uri}: Pick<Outline, 'uri'>): Promise<void> {
    const key = uri.toString();
    const generation = (this._generations.get(key) ?? 0) + 1;
    this._generations.set(key, generation);
    // In-flight computations were started against older content.
    this._pending.delete(key);
    this.clearVerifyTimer(key);

    const outline = await this.computeOutline(uri);
    if (!outline || this._generations.get(key) !== generation) {
      return;
    }
    super.fire(outline);
    this.scheduleVerification(uri, generation, 0);
  }

  /**
   * Recompute only when the cached Outline was built from a different
   * document version than what is open now. Cheap no-op otherwise.
   */
  public async refreshIfStale(uri: vscode.Uri): Promise<void> {
    const cached = this._cache.get(uri.toString());
    if (cached && cached.documentVersion === this.getDocumentVersion(uri)) {
      return;
    }
    return this.fire({uri});
  }

  public knownUris(): vscode.Uri[] {
    return Array.from(this._cache.values(), entry => entry.outline.uri);
  }

  /**
   * Gets the cached Outline, recomputing it when the cache was built from a
   * different version of the document than what is currently open.
   */
  public async getOutline(uri: vscode.Uri): Promise<undefined | Outline> {
    const cached = this._cache.get(uri.toString());
    if (cached && cached.documentVersion === this.getDocumentVersion(uri)) {
      return cached.outline;
    }

    return this.computeOutline(uri);
  }

  /**
   * Drops an Outline from the cache and cancels any in-flight computation.
   */
  public forgetOutline(uri: vscode.Uri): void {
    const key = uri.toString();
    this._generations.set(key, (this._generations.get(key) ?? 0) + 1);
    this._cache.delete(key);
    this._pending.delete(key);
    this.clearVerifyTimer(key);
  }

  public override dispose(): void {
    for (const timer of this._verifyTimers.values()) {
      clearTimeout(timer);
    }
    this._verifyTimers.clear();
    super.dispose();
  }

  /**
   * Seam for tests: production behavior polls the document symbol provider.
   */
  protected fetchSymbols(uri: vscode.Uri): Promise<undefined | vscode.DocumentSymbol[]> {
    return getSymbols(uri);
  }

  /**
   * Seam for tests: the single-shot request used by the verification pass.
   */
  protected fetchSymbolsOnce(uri: vscode.Uri): Thenable<undefined | vscode.DocumentSymbol[]> {
    return requestSymbols(uri);
  }

  /**
   * Seam for tests: production behavior reads the version of the matching
   * open TextDocument, if any.
   */
  protected getDocumentVersion(uri: vscode.Uri): undefined | number {
    const key = uri.toString();
    return vscode.workspace.textDocuments.find(doc => doc.uri.toString() === key)?.version;
  }

  /**
   * Computes an Outline, deduplicating concurrent requests for the same Uri.
   * The result is committed to the cache only when no newer update for the
   * Uri started while the symbols request was in flight.
   */
  private computeOutline(uri: vscode.Uri): Promise<undefined | Outline> {
    const key = uri.toString();
    const pending = this._pending.get(key);
    if (pending) {
      return pending;
    }

    const generation = this._generations.get(key) ?? 0;
    // Captured before the request: if the document changes while symbols are
    // being computed, the entry won't match and will be recomputed on read.
    const documentVersion = this.getDocumentVersion(uri);

    const promise = this.fetchSymbols(uri).then(symbols => {
      if (this._pending.get(key) === promise) {
        this._pending.delete(key);
      }
      if (!symbols) {
        return undefined;
      }
      const outline: Outline = {uri, symbols, map: OutlineStore.documentSymbolsToMap(uri, symbols)};
      if (this._generations.get(key) === generation || this._generations.get(key) === undefined) {
        this._cache.set(key, {outline, documentVersion});
      }
      return outline;
    });
    this._pending.set(key, promise);
    return promise;
  }

  /**
   * Re-request symbols after the YAML language server has had time to
   * re-parse, and correct the cache if the first response was stale.
   */
  private scheduleVerification(uri: vscode.Uri, generation: number, round: number): void {
    if (round >= VERIFY_MAX_ROUNDS) {
      return;
    }
    const key = uri.toString();
    this.clearVerifyTimer(key);
    const timer = setTimeout(async () => {
      this._verifyTimers.delete(key);
      if (this._generations.get(key) !== generation) {
        return;
      }
      const symbols = await this.fetchSymbolsOnce(uri);
      if (!symbols || this._generations.get(key) !== generation) {
        return;
      }
      const cached = this._cache.get(key);
      if (!cached || fingerprintSymbols(cached.outline.symbols) === fingerprintSymbols(symbols)) {
        return;
      }

      addBreadcrumb('Corrected stale document symbols', 'outline', 'info', {
        uri: uri.toString(),
        round,
      });
      const outline: Outline = {uri, symbols, map: OutlineStore.documentSymbolsToMap(uri, symbols)};
      this._cache.set(key, {outline, documentVersion: this.getDocumentVersion(uri)});
      super.fire(outline);
      this.scheduleVerification(uri, generation, round + 1);
    }, VERIFY_DELAY_MS);
    this._verifyTimers.set(key, timer);
  }

  private clearVerifyTimer(key: string): void {
    const timer = this._verifyTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this._verifyTimers.delete(key);
    }
  }
}

function requestSymbols(uri: vscode.Uri): Thenable<undefined | vscode.DocumentSymbol[]> {
  return vscode.commands.executeCommand<undefined | vscode.DocumentSymbol[]>(
    'vscode.executeDocumentSymbolProvider',
    uri
  );
}

function fingerprintSymbols(symbols: vscode.DocumentSymbol[]): string {
  return symbols
    .map(s => `${s.name}@${s.range.start.line}.${s.range.start.character}-${s.range.end.line}.${s.range.end.character}[${fingerprintSymbols(s.children)}]`)
    .join(';');
}

function getSymbols(uri: vscode.Uri, timeout: number = 0): Promise<undefined | vscode.DocumentSymbol[]> {
  if (timeout > SYMBOLS_RETRY_LIMIT_MS) {
    captureMessage('Timed out waiting for document symbols', 'warning', {
      uri: uri.toString(),
    });
    return Promise.resolve(undefined);
  }
  return new Promise(resolve => {
    setTimeout(() => {
      requestSymbols(uri).then((symbols) => resolve(symbols ? symbols : getSymbols(uri, timeout + 1_000)));
    }, timeout);
  });
}
