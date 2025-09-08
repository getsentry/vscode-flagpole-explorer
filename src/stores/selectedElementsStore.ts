import * as vscode from 'vscode';
import OutlineStore, { Outline } from './outlineStore';
import { LogicalCondition, LogicalFeature, LogicalSegment } from '../transform/transformers';

export default class SelectedElementsStore {
  public static selections: WeakMap<vscode.Uri, readonly vscode.Selection[]> = new WeakMap();

  constructor(
    public outlineStore: OutlineStore,
    private documentFilter: vscode.DocumentFilter,
  ) {}

  private didChangeSelected = new vscode.EventEmitter<vscode.Uri>();
  public onDidChangeSelected = this.didChangeSelected.event;

  public register(): vscode.Disposable[] {
    return [
      vscode.window.onDidChangeTextEditorSelection(async (event: vscode.TextEditorSelectionChangeEvent) => {
        const uri = event.textEditor.document.uri;
        if (vscode.languages.match(this.documentFilter, event.textEditor.document)) {
          SelectedElementsStore.selections.set(uri, event.selections);
          this.didChangeSelected.fire(uri);
        }
      }),
    ];
  }

  public static filterSelectedElements<T extends LogicalFeature | LogicalSegment | LogicalCondition>(
    selections: readonly vscode.Selection[] | undefined,
    elements: T[],
  ): T[] {
    return selections
      ? elements.filter(element => {
        for (const selection of selections!) {
          if (selection.intersection(element.symbol.range)) {
            return true;
          }
        }
      })
      : [] as T[];
  }  
}
