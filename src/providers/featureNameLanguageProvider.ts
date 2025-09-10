import * as vscode from 'vscode';
import getRolloutEmoji from '../utils/getRolloutEmoji';
import SelectedElementsStore from '../stores/selectedElementsStore';

export default class FeatureNameLanguageProvider implements vscode.CodeLensProvider, vscode.InlayHintsProvider {
  constructor(
    private selectedElementsStore: SelectedElementsStore,
    private documentFilter: vscode.DocumentFilter,
  ) {}

  public register(): vscode.Disposable[] {
    return [
      this.selectedElementsStore.onDidChangeSelected(() => {
        const config = vscode.workspace.getConfiguration('flagpole-explorer');
        if (config.get('renderMutationLenses') === 'for selection') {
          this.didChangeCodeLenses.fire();
        }
      }),
      this.selectedElementsStore.outlineStore.event(() => {
        this.didChangeCodeLenses.fire();
        this.didChangeInlayHints.fire();
      }),
      vscode.languages.registerCodeLensProvider(this.documentFilter, this),
      vscode.languages.registerInlayHintsProvider(this.documentFilter, this),
    ];
  }

  private didChangeCodeLenses = new vscode.EventEmitter<void>();
  public onDidChangeCodeLenses = this.didChangeCodeLenses.event;

  public async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<Array<vscode.CodeLens> | undefined> {
    const config = vscode.workspace.getConfiguration('flagpole-explorer');
    if (config.get('renderMutationLenses') === 'never') {
      return [];
    }

    const outline = await this.selectedElementsStore.outlineStore.getOutline(document.uri);
    if (!outline?.map) {
      return undefined;
    }

    const optionsLens = new vscode.CodeLens(outline.map.range, {
      title: '$(plus)\u2000Create Feature',
      tooltip: 'Add a new feature to the end of the list',
      command: 'flagpole-explorer.addFeature',
      arguments: [outline.map.range.end.translate()]
    });

    const selections = SelectedElementsStore.selections.get(document.uri);
    const selectedFeatures = config.get('renderMutationLenses') === 'always'
      ? outline.map.allFeatures
      : SelectedElementsStore.filterSelectedElements(
        selections,
        outline.map.allFeatures,
      );

    const featureLenses = selectedFeatures.flatMap(feature => {
      return [
        new vscode.CodeLens(feature.symbol.range, {
          title: '$(plus)\u2000Insert Feature',
          tooltip: 'Insert a feature here',
          command: 'flagpole-explorer.addFeature',
          arguments: [feature.symbol.range.start]
        }),
        config.get('renderEvalLens')
          ? new vscode.CodeLens(feature.symbol.range, {
            title: '$(beaker)\u2000Evaluate',
            command: 'flagpole-explorer.show-evaluate-view',
            arguments: [feature.name, feature]
          })
          : undefined,
      ];
    });
    return [
      optionsLens,
      ...featureLenses.filter<vscode.CodeLens>(_ => !!_),
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
    const config = vscode.workspace.getConfiguration('flagpole-explorer');
    if (!config.get('renderRolloutHints')) {
      return [];
    }
    
    const outline = await this.selectedElementsStore.outlineStore.getOutline(document.uri);
    const featuresInRange = outline?.map?.allFeatures
      .filter(feature => range.intersection(feature.symbol.selectionRange)) ?? [];

    return featuresInRange
      .map(feature => {
        const label = [
            feature.enabled
              ? `${getRolloutEmoji(feature.rolloutState)} ${feature.rolloutState} rollout`
              : '❌ disabled',
            feature.hasExtraSegments
              ? '⚠️ unused segments'
              : undefined,
        ].filter(Boolean).join(' | ');
        
        const hint = new vscode.InlayHint(
          feature.symbol.selectionRange.end.translate(0, 1),
          label
        );
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
