import * as vscode from 'vscode';
import OutlineStore from '../stores/outlineStore';
import getRolloutEmoji from '../utils/getRolloutEmoji';

export default class FeatureNameLanguageProvider implements vscode.CodeLensProvider, vscode.InlayHintsProvider {
  constructor(
    private outlineStore: OutlineStore,
    private documentSelector: vscode.DocumentSelector,
  ) {
    this.outlineStore.event(() => {
      this.didChangeCodeLenses.fire();
      this.didChangeInlayHints.fire();
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

    const optionsLens = new vscode.CodeLens(outline.map.range, {
      title: '$(plus)\u2000Create Feature',
      command: 'flagpole-explorer.addFeature',
      arguments: [outline.map.selectionRange.end.translate(1)]
    });
    const featureLenses = outline.map.allFeatures.map(feature => {
      return new vscode.CodeLens(feature.symbol.range, {
        title: '$(plus)\u2000Create Feature',
        command: 'flagpole-explorer.addFeature',
        arguments: [feature.symbol.range.end]
      });
    });
    return [
      optionsLens,
      ...featureLenses,
    ];
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
    const features = outline?.map?.allFeatures ?? [];

    return features
      .filter(feature => range.intersection(feature.symbol.selectionRange))
      .map(feature => {
        const label = feature.enabled
          ? `${getRolloutEmoji(feature.rolloutState)} ${feature.rolloutState} rollout`
          : '❌ disabled';
        const hint = new vscode.InlayHint(
          feature.symbol.selectionRange.end.translate(0, 1),
          label
        );
        hint.tooltip = `${feature.rolloutState} rollout`;
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


