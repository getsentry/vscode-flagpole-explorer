import * as vscode from 'vscode';
import SelectedElementsStore from '../stores/selectedElementsStore';

export default class ConditionLanguageProvider implements vscode.CodeLensProvider {
  private config: vscode.WorkspaceConfiguration;
  
  constructor(
    private selectedElementsStore: SelectedElementsStore,
    private documentFilter: vscode.DocumentFilter,
  ) {
    this.config = vscode.workspace.getConfiguration('flagpole-explorer');
  }

  public register(): vscode.Disposable[] {
    return [
      this.selectedElementsStore.onDidChangeSelected(() => {
        this.didChangeCodeLenses.fire();
      }),
      vscode.languages.registerCodeLensProvider(this.documentFilter, this),
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

    const selections = SelectedElementsStore.selections.get(document.uri);
    const selectedSegments = config.get('renderMutationLenses') === 'always'
      ? outline.map.allSegments
      : SelectedElementsStore.filterSelectedElements(
        selections,
        outline.map.allSegments,
      );
    const selectedConditions = config.get('renderMutationLenses') === 'always'
      ? outline.map.allConditions
      : SelectedElementsStore.filterSelectedElements(
        selections,
        outline.map.allConditions,
      );
    
    return [
      ...selectedSegments.filter(segment => segment.conditionsSymbol).map(segment => {
        return new vscode.CodeLens(segment.conditionsSymbol!.range, {
          title: `$(symbol-operator)\u2000Append Condition`,
          tooltip: 'Add a new condition to the end of the list',
          command: 'flagpole-explorer.addCondition',
          arguments: [segment.conditionsSymbol!.range.end],
        });
      }),
      ...selectedConditions.map(condition => {
        return new vscode.CodeLens(condition.symbol.range, {
          title: `$(symbol-operator)\u2000Insert Condition`,
          tooltip: 'Insert a condition here',
          command: 'flagpole-explorer.addCondition',
          arguments: [condition.symbol.range.start],
        });
      })
    ];
  }

  public resolveCodeLens?(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.CodeLens> {
    return codeLens;
  }
}
