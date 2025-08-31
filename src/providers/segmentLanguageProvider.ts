import * as vscode from 'vscode';
import OutlineStore from '../stores/outlineStore';
import getRolloutEmoji from '../utils/getRolloutEmoji';

export default class SegmentLanguageProvider implements vscode.CodeLensProvider, vscode.InlayHintsProvider {
  constructor(
    private outlineStore: OutlineStore,
    private documentSelector: vscode.DocumentSelector,
  ) {
    this.outlineStore.event(() => {
      this.didChangeCodeLenses.fire();
    });
  }

  public register(): vscode.Disposable[] {
    return [
      vscode.languages.registerCodeLensProvider(this.documentSelector, this),
      vscode.languages.registerInlayHintsProvider(this.documentSelector, this),
    ];
  }

  private didChangeCodeLenses = new vscode.EventEmitter<void>();
  public onDidChangeCodeLenses = this.didChangeCodeLenses.event;

  public async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<Array<vscode.CodeLens> | undefined> {
    const outline = await this.outlineStore.getOutline(document.uri);
    if (!outline?.map) {
      return undefined;
    }

    return outline.map.allSegments.map(segment => {
      return new vscode.CodeLens(segment.symbol.range, {
        title: '$(symbol-array)\u2000Add Segment',
        command: 'flagpole-explorer.addSegment',
        arguments: [segment.symbol.range.end]
      });
    });
  }

  public resolveCodeLens?(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.CodeLens> {
    return codeLens;
  }

  private didChangeInlayHints = new vscode.EventEmitter<void>();
  public onDidChangeInlayHints = this.didChangeInlayHints.event;

  public async provideInlayHints(
    document: vscode.TextDocument,
    range: vscode.Range,
    token: vscode.CancellationToken
  ): Promise<Array<vscode.InlayHint>> {
    const outline = await this.outlineStore.getOutline(document.uri);
    const segments = outline?.map?.allSegments ?? [];

    return segments
      .filter(segment => range.intersection(segment.symbol.selectionRange))
      .map(segment => {
        const hint = new vscode.InlayHint(
          segment.symbol.selectionRange.start.with({character: Number.MAX_SAFE_INTEGER}),
          getRolloutEmoji(segment.rolloutState)
        );
        hint.tooltip = `${segment.rolloutState} rollout`;
        hint.paddingLeft = true;
        return hint;
      });
  }

  public resolveInlayHint?(
    hint: vscode.InlayHint,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.InlayHint> {
    return hint;
  }
}
