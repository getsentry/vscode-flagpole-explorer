import * as vscode from 'vscode';
import OutlineStore from '../stores/outlineStore';
import FlagsByNameTreeViewProvider from './flagsByNameTreeViewProvider';
import {
  CategoryTreeViewElement,
  FlagsByCreatedAtTreeViewProvider,
  FlagsByEnabledTreeViewProvider,
  FlagsByOwnerTreeViewProvider,
  FlagsByRolloutTreeViewProvider,
} from './flagsByCategoryTreeProvider';
import FlagsWithExtraSegmentsTreeViewProvider from './flagsWithExtraSegmentsTreeViewProvider';
import EvaluateView from '../view/evaluateView';

export default class WindowEventHandlerProvider {
  views: vscode.TreeView<CategoryTreeViewElement>[] = [];

  constructor(
    private outlineStore: OutlineStore,
    private documentFilter: vscode.DocumentFilter,
  ) {}

  public register(context: vscode.ExtensionContext): vscode.Disposable[] {
    this.views = [
      vscode.window.createTreeView(
        'sentryFlagpoleFlagsByName', 
        {treeDataProvider: new FlagsByNameTreeViewProvider(this.outlineStore), showCollapseAll: true},
      ),
      vscode.window.createTreeView(
        'sentryFlagpoleFlagsByEnabled', 
        {treeDataProvider: new FlagsByEnabledTreeViewProvider(this.outlineStore), showCollapseAll: true},
      ),
      vscode.window.createTreeView(
        'sentryFlagpoleFlagsByCreatedAt', 
        {treeDataProvider: new FlagsByCreatedAtTreeViewProvider(this.outlineStore), showCollapseAll: true},
      ),
      vscode.window.createTreeView(
        'sentryFlagpoleFlagsByOwner', 
        {treeDataProvider: new FlagsByOwnerTreeViewProvider(this.outlineStore), showCollapseAll: true},
      ),
      vscode.window.createTreeView(
        'sentryFlagpoleFlagsByRollout', 
        {treeDataProvider: new FlagsByRolloutTreeViewProvider(this.outlineStore), showCollapseAll: true},
      ),
      vscode.window.createTreeView(
        'sentryFlagpoleFlagsWithExtraSegments', 
        {treeDataProvider: new FlagsWithExtraSegmentsTreeViewProvider(this.outlineStore), showCollapseAll: true},
      ),
    ];

    const serializers = [];
    if (vscode.window.registerWebviewPanelSerializer) {
      serializers.push(
        vscode.window.registerWebviewPanelSerializer(EvaluateView.viewType, {
          async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: unknown) {
            // Reset the webview options so we use latest uri for `localResourceRoots`.
            webviewPanel.webview.options = EvaluateView.viewOptions(context.extensionUri);
            EvaluateView.revive(webviewPanel, context.extensionUri);
          }
        }),
      );
    }

    return [
      // vscode.window.onDidChangeActiveTextEditor(this.handleDidChangeActiveTextEditor),
      vscode.window.onDidChangeTextEditorSelection(this.handleDidChangeTextEditorSelection),
      ...serializers,
      ...this.views,
    ];
  }

  /**
   * An {@link Event} which fires when the {@link window.activeTextEditor active editor}
   * has changed. *Note* that the event also fires when the active editor changes
   * to `undefined`.
   */
  handleDidChangeActiveTextEditor = (editor: vscode.TextEditor | undefined) => {
    // TODO: Do we need this?
  };

  /**
   * An {@link Event} which fires when the selection in an editor has changed.
   */
  handleDidChangeTextEditorSelection = async (event: vscode.TextEditorSelectionChangeEvent) => {
    if (vscode.languages.match(this.documentFilter, event.textEditor.document)) {
      const outline = await this.outlineStore.getOutline(event.textEditor.document.uri);
      const features = outline?.map?.allFeatures;
      if (!features) {
        return;
      }
      event.selections.forEach(selection => {
        features
          .filter(feature => selection.intersection(feature.symbol.range))
          .forEach(feature => {
            this.views?.forEach(view => {
              if (view.visible) {
                view.reveal(feature).then(() => {}, () => {});
              }
            });
          });
      });
    }
  };
}
