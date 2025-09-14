import * as vscode from 'vscode';
import getRolloutEmoji from '../utils/getRolloutEmoji';
import SelectedElementsStore from '../stores/selectedElementsStore';

export default class SegmentLanguageProvider implements vscode.CodeLensProvider, vscode.InlayHintsProvider {
  constructor(
    private selectedElementsStore: SelectedElementsStore,
    private documentFilter: vscode.DocumentFilter,
  ) {}

  public register(): vscode.Disposable[] {
    return [
      this.selectedElementsStore.onDidChangeSelected(() => {
        const config = vscode.workspace.getConfiguration('flagpole-explorer.render');
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
    const config = vscode.workspace.getConfiguration('flagpole-explorer.render');
    if (config.get('renderMutationLenses') === 'never') {
      return [];
    }

    const outline = await this.selectedElementsStore.outlineStore.getOutline(document.uri);
    if (!outline?.map) {
      return undefined;
    }

    const selections = SelectedElementsStore.selections.get(document.uri);
    const selectedFeatures = config.get('renderMutationLenses') === 'always'
      ? outline.map.allFeatures
      : SelectedElementsStore.filterSelectedElements(
        selections,
        outline.map.allFeatures,
      );
    const selectedSegments = config.get('renderMutationLenses') === 'always'
      ? outline.map.allSegments
      : SelectedElementsStore.filterSelectedElements(
        selections,
        outline.map.allSegments,
      );

    return [
      ...selectedFeatures.filter(feature => feature.segmentsSymbol).map(feature => {
        return new vscode.CodeLens(feature.segmentsSymbol!.range, {
          title: `$(symbol-array)\u2000Append Segment`,
          tooltip: 'Add a new segment to the end of the list',
          command: 'flagpole-explorer.addSegment',
          arguments: [feature.segmentsSymbol!.range.end],
        });
      }),
      ...selectedSegments.map(segment => {
        return new vscode.CodeLens(segment.symbol.range, {
          title: `$(symbol-array)\u2000Insert Segment`,
          tooltip: 'Insert a segment here',
          command: 'flagpole-explorer.addSegment',
          arguments: [segment.symbol.range.start]
        });
      }),
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
    const config = vscode.workspace.getConfiguration('flagpole-explorer.render');
    if (!config.get('renderRolloutHints')) {
      return [];
    }

    const outline = await this.selectedElementsStore.outlineStore.getOutline(document.uri);
    const segmentsInRange = outline?.map?.allSegments
      .filter(segment => range.intersection(segment.symbol.selectionRange)) ?? [];

    return segmentsInRange
      .map(segment => {
        const hint = new vscode.InlayHint(
          segment.symbol.selectionRange.start.with({character: Number.MAX_SAFE_INTEGER}),
          `${getRolloutEmoji(segment.rolloutState)} ${segment.rolloutState} rollout`
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
