import * as vscode from 'vscode';
import OutlineStore from '../stores/outlineStore';

export default class ConditionLanguageProvider implements vscode.CodeLensProvider {
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

    return outline.map.allConditions.map(condition => {
      return new vscode.CodeLens(condition.symbol.range, {
        title: '$(symbol-operator)\u2000Add Condition',
        command: 'flagpole-explorer.addCondition',
        arguments: [condition.symbol.range.end]
      });
    });
  }

  public resolveCodeLens?(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.CodeLens> {
    return codeLens;
  }
}
